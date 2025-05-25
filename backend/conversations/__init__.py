import logging
import json
import azure.functions as func
from db_helpers import get_container, get_marketplace_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for getting user conversations processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get user ID from query parameters or request body
        user_id = extract_user_id(req)
        if not user_id:
            return create_error_response("User ID is required", 400)
        
        # Access the marketplace-conversations container
        container = get_container("marketplace-conversations")
        
        # Query for conversations where the user is a participant
        query = "SELECT * FROM c WHERE ARRAY_CONTAINS(c.participants, @userId)"
        parameters = [{"name": "@userId", "value": user_id}]
        conversations = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        enhanced_conversations = []
        for conv in conversations:
            try:
                # Identify the other participant
                other_user_id = next((p for p in conv['participants'] if p != user_id), None)
                # Default other user info
                other_user = {"name": "Unknown User", "avatar": None}
                is_business = False
                business_info = None

                # If we have another user, fetch their details
                if other_user_id:
                    # Check individual user
                    users_container = get_container("users")
                    user_query = "SELECT c.name, c.avatar FROM c WHERE c.id = @id OR c.email = @email"
                    user_params = [
                        {"name": "@id", "value": other_user_id},
                        {"name": "@email", "value": other_user_id}
                    ]
                    users = list(users_container.query_items(
                        query=user_query,
                        parameters=user_params,
                        enable_cross_partition_query=True
                    ))
                    if users:
                        other_user = {"name": users[0].get('name', 'User'), "avatar": users[0].get('avatar')}

                    # Check if it's a business
                    business_container = get_marketplace_container("business_users")
                    business_query = "SELECT * FROM c WHERE c.id = @id"
                    business_params = [{"name": "@id", "value": other_user_id}]
                    businesses = list(business_container.query_items(
                        query=business_query,
                        parameters=business_params,
                        enable_cross_partition_query=True
                    ))
                    if businesses:
                        is_business = True
                        business_info = businesses[0]
                        other_user = {
                            "name": business_info.get('businessName', 'Business'),
                            "avatar": business_info.get('logo'),
                            "type": "business"
                        }

                # Get plant details if available
                plant_info = {"name": "Plant Discussion", "id": None, "image": None}
                if 'plantId' in conv and conv['plantId']:
                    plants_container = get_container("marketplace-plants")
                    plant_query = "SELECT c.id, c.title, c.image, c.images FROM c WHERE c.id = @id"
                    plant_params = [{"name": "@id", "value": conv['plantId']}]
                    plants = list(plants_container.query_items(
                        query=plant_query,
                        parameters=plant_params,
                        enable_cross_partition_query=True
                    ))
                    if plants:
                        plant = plants[0]
                        plant_image = plant.get('image') or (plant.get('images') and plant['images'][0])
                        plant_info = {
                            "name": plant.get('title', 'Plant Discussion'),
                            "id": plant.get('id'),
                            "image": plant_image
                        }

                # Build the enhanced conversation object
                enhanced_conv = {
                    "id": conv.get('id'),
                    "otherUserName": other_user.get('name'),
                    "otherUserAvatar": other_user.get('avatar'),
                    "otherUserType": "business" if is_business else "individual",
                    "plantName": plant_info.get('name'),
                    "plantId": plant_info.get('id') or conv.get('plantId'),
                    "plantImage": plant_info.get('image'),
                    "sellerId": other_user_id,
                    "lastMessage": conv.get('lastMessage', {}).get('text', ''),
                    "lastMessageTimestamp": conv.get('lastMessageAt'),
                    "unreadCount": conv.get('unreadCounts', {}).get(user_id, 0),
                    "businessInfo": business_info if is_business else None
                }
                enhanced_conversations.append(enhanced_conv)
            except Exception as e:
                logging.error(f"Error enhancing conversation {conv.get('id')}: {str(e)}")
                # Fallback minimal data
                enhanced_conversations.append({
                    "id": conv.get('id'),
                    "otherUserName": "User",
                    "plantName": "Discussion",
                    "lastMessage": conv.get('lastMessage', {}).get('text', ''),
                    "lastMessageTimestamp": conv.get('lastMessageAt'),
                    "unreadCount": 0
                })

        # Sort by last message timestamp, most recent first
        enhanced_conversations.sort(
            key=lambda c: c.get('lastMessageTimestamp', ''),
            reverse=True
        )

        return create_success_response(enhanced_conversations)
    except Exception as e:
        logging.error(f"Error getting user conversations: {str(e)}")
        return create_error_response(str(e), 500)
