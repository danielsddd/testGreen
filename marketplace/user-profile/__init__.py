# backend/marketplace/user-profile/__init__.py
import logging
import json
import azure.functions as func
from ..db_client import get_container, get_main_container

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for marketplace user profile processed a request.')
    
    try:
        # Get user ID from route parameters or query
        user_id = req.route_params.get('id') or req.params.get('id')
        
        if not user_id:
            return func.HttpResponse(
                body=json.dumps({"error": "User ID is required"}),
                mimetype="application/json",
                status_code=400
            )
        
        # Access the marketplace_users container
        container = get_container("marketplace_users")
        
        # Query for the user
        query = "SELECT * FROM c WHERE c.id = @id"
        parameters = [{"name": "@id", "value": user_id}]
        
        users = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        if not users:
            # Check if the user exists in the main Users container
            try:
                main_users_container = get_main_container("Users")
                
                main_query = "SELECT * FROM c WHERE c.email = @email"
                main_params = [{"name": "@email", "value": user_id}]
                
                main_users = list(main_users_container.query_items(
                    query=main_query,
                    parameters=main_params,
                    enable_cross_partition_query=True
                ))
                
                if main_users:
                    # Create a marketplace user profile from the main user
                    main_user = main_users[0]
                    
                    marketplace_user = {
                        "id": main_user.get('email'),
                        "email": main_user.get('email'),
                        "name": main_user.get('name', 'Greener User'),
                        "avatar": main_user.get('avatar'),
                        "bio": main_user.get('bio', ''),
                        "location": main_user.get('location', ''),
                        "joinDate": main_user.get('joinDate', ''),
                        "stats": {
                            "plantsCount": 0,
                            "salesCount": 0,
                            "rating": 0,
                            "reviewsCount": 0
                        }
                    }
                    
                    # Create the user in the marketplace_users container
                    container.create_item(body=marketplace_user)
                    
                    # Return the new user
                    return func.HttpResponse(
                        body=json.dumps(marketplace_user, default=str),
                        mimetype="application/json",
                        status_code=200
                    )
                else:
                    return func.HttpResponse(
                        body=json.dumps({"error": "User not found"}),
                        mimetype="application/json",
                        status_code=404
                    )
            except Exception as e:
                logging.error(f"Error checking main Users container: {str(e)}")
                return func.HttpResponse(
                    body=json.dumps({"error": "User not found"}),
                    mimetype="application/json",
                    status_code=404
                )
        
        # Return the user
        user = users[0]
        
        # Ensure we have the basic structure
        if 'stats' not in user:
            user['stats'] = {
                "plantsCount": 0,
                "salesCount": 0,
                "rating": 0,
                "reviewsCount": 0
            }
        
        # Get the user's plant listings count
        try:
            plants_container = get_container("marketplace_plants")
            
            count_query = "SELECT VALUE COUNT(1) FROM c WHERE c.sellerId = @sellerId"
            count_params = [{"name": "@sellerId", "value": user_id}]
            
            counts = list(plants_container.query_items(
                query=count_query,
                parameters=count_params,
                enable_cross_partition_query=True
            ))
            
            if counts and len(counts) > 0:
                user['stats']['plantsCount'] = counts[0]
        except Exception as e:
            logging.warning(f"Error getting plant count: {str(e)}")
        
        return func.HttpResponse(
            body=json.dumps(user, default=str),
            mimetype="application/json",
            status_code=200
        )
    
    except Exception as e:
        logging.error(f"Error getting user profile: {str(e)}")
        return func.HttpResponse(
            body=json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )