# user-profile/__init__.py

import logging
import json
from datetime import datetime
import azure.functions as func
from db_helpers import get_container, get_main_container
from http_helpers import (
    add_cors_headers,
    handle_options_request,
    create_error_response,
    create_success_response,
    extract_user_id,
)

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('User profile API triggered.')

    if req.method == 'OPTIONS':
        return handle_options_request()

    if req.method == 'GET':
        return handle_get_user(req)

    if req.method == 'PATCH':
        return handle_patch_user(req)

    return create_error_response("Unsupported HTTP method", 405)


# ========== Shared Utility ==========

def find_user(container, user_id):
    query = "SELECT * FROM c WHERE c.email = @email OR c.id = @id"
    params = [
        {"name": "@email", "value": user_id},
        {"name": "@id", "value": user_id}
    ]
    return list(container.query_items(query=query, parameters=params, enable_cross_partition_query=True))


# ========== GET Handler ==========

def handle_get_user(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user_id = req.route_params.get('id') or extract_user_id(req)
        if not user_id:
            return create_error_response("User ID is required", 400)

        # Check main DB first
        try:
            main_users_container = get_main_container("Users")
            main_users = find_user(main_users_container, user_id)
            if main_users:
                user = main_users[0]

                # Add stats from marketplace if available
                try:
                    plants_container = get_container("marketplace-plants")
                    plant_query = "SELECT VALUE COUNT(1) FROM c WHERE c.sellerId = @sellerId"
                    plant_params = [{"name": "@sellerId", "value": user_id}]
                    plant_count = list(plants_container.query_items(
                        query=plant_query,
                        parameters=plant_params,
                        enable_cross_partition_query=True
                    ))
                    if plant_count and plant_count[0] > 0:
                        user.setdefault('stats', {})['plantsCount'] = plant_count[0]
                except Exception as e:
                    logging.warning(f"[Stats] Failed to load plant stats for {user_id}: {e}")

                return create_success_response({"user": user})
        except Exception as e:
            logging.warning(f"[MainDB] Error fetching user {user_id}: {e}")

        # Fallback to marketplace DB
        try:
            users_container = get_container("users")
            users = find_user(users_container, user_id)
            if users:
                return create_success_response({"user": users[0]})
        except Exception as e:
            logging.warning(f"[MarketplaceDB] Error fetching user {user_id}: {e}")

        # Create new user if not found
        try:
            new_user = {
                "id": str(user_id),
                "email": str(user_id),
                "name": user_id.split('@')[0] if '@' in user_id else user_id,
                "joinDate": datetime.utcnow().isoformat(),
                "stats": {
                    "plantsCount": 0,
                    "salesCount": 0,
                    "rating": 0
                }
            }
            users_container = get_container("users")
            users_container.create_item(body=new_user)
            logging.info(f"[Create] New user created: {user_id}")
            return create_success_response({"user": new_user})
        except Exception as e:
            logging.error(f"[Create] Error creating new user {user_id}: {e}")

        return create_error_response("User not found and could not be created", 404)

    except Exception as e:
        logging.error(f"[GET] Fatal error: {e}")
        return create_error_response(str(e), 500)


# ========== PATCH Handler ==========

def handle_patch_user(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user_id = req.route_params.get('id')
        if not user_id:
            return create_error_response("User ID is required", 400)

        update_data = req.get_json()
        if not isinstance(update_data, dict):
            return create_error_response("Update data must be a JSON object", 400)

        # Try main DB first
        try:
            main_users_container = get_main_container("Users")
            users = find_user(main_users_container, user_id)
            if users:
                user = users[0]
                for key, value in update_data.items():
                    if key not in ['id', 'email']:
                        user[key] = value
                main_users_container.replace_item(item=user['id'], body=user)
                return create_success_response({
                    "message": "User profile updated successfully",
                    "user": user
                })
        except Exception as e:
            logging.warning(f"[MainDB] Failed to update user {user_id}: {e}")

        # Fallback to marketplace DB
        try:
            users_container = get_container("users")
            users = find_user(users_container, user_id)
            if users:
                user = users[0]
                for key, value in update_data.items():
                    if key not in ['id', 'email']:
                        user[key] = value
                users_container.replace_item(item=user['id'], body=user)
                return create_success_response({
                    "message": "User profile updated successfully",
                    "user": user
                })
        except Exception as e:
            logging.warning(f"[MarketplaceDB] Failed to update user {user_id}: {e}")

        return create_error_response("User not found", 404)

    except Exception as e:
        logging.error(f"[PATCH] Fatal error: {e}")
        return create_error_response(str(e), 500)
