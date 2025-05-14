# backend/marketplace/user-profile/__init__.py
import logging
import json
import azure.functions as func
from ..db_client import get_container, get_main_container
from datetime import datetime

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
        
        # Try to get the user from marketplace 'users' container first
        try:
            marketplace_users_container = get_container("users")
            
            query = "SELECT * FROM c WHERE c.id = @id OR c.email = @email"
            parameters = [
                {"name": "@id", "value": user_id},
                {"name": "@email", "value": user_id}
            ]
            
            marketplace_users = list(marketplace_users_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            
            if marketplace_users:
                user = marketplace_users[0]
                # Get marketplace stats
                user = enrich_with_marketplace_stats(user)
                return func.HttpResponse(
                    body=json.dumps({"user": user}, default=str),
                    mimetype="application/json",
                    status_code=200
                )
        except Exception as e:
            logging.warning(f"Error checking marketplace users container: {str(e)}")
        
        # If no user found in marketplace DB, check main Users container
        try:
            main_users_container = get_main_container("Users")
            
            # In main DB, email is the primary identifier
            main_query = "SELECT * FROM c WHERE c.email = @email"
            main_params = [{"name": "@email", "value": user_id}]
            
            main_users = list(main_users_container.query_items(
                query=main_query,
                parameters=main_params,
                enable_cross_partition_query=True
            ))
            
            if main_users:
                # Convert from main DB format to marketplace format
                main_user = main_users[0]
                
                # Create a new marketplace user
                marketplace_user = {
                    "id": main_user.get('email'),
                    "email": main_user.get('email'),
                    "name": main_user.get('name', 'Greener User'),
                    "phoneNumber": main_user.get('phoneNumber', ''),
                    "avatar": main_user.get('avatar'),
                    "bio": main_user.get('bio', ''),
                    "location": main_user.get('location', ''),
                    "joinDate": main_user.get('joinDate', datetime.utcnow().isoformat()),
                    "userType": main_user.get('userType', 'individual'),
                    "stats": {
                        "plantsCount": 0,
                        "salesCount": 0,
                        "rating": 0,
                        "reviewsCount": 0
                    }
                }
                
                # Store the new user in marketplace DB
                try:
                    marketplace_users_container.create_item(body=marketplace_user)
                    logging.info(f"Created new marketplace user profile for {user_id}")
                except Exception as e:
                    logging.warning(f"Could not create marketplace user: {str(e)}")
                
                # Enrich with marketplace stats
                marketplace_user = enrich_with_marketplace_stats(marketplace_user)
                
                return func.HttpResponse(
                    body=json.dumps({"user": marketplace_user}, default=str),
                    mimetype="application/json",
                    status_code=200
                )
            else:
                return func.HttpResponse(
                    body=json.dumps({"error": "User not found in either database"}),
                    mimetype="application/json",
                    status_code=404
                )
        except Exception as e:
            logging.error(f"Error checking main Users container: {str(e)}")
            return func.HttpResponse(
                body=json.dumps({"error": f"Error retrieving user: {str(e)}"}),
                mimetype="application/json",
                status_code=500
            )
    
    except Exception as e:
        logging.error(f"Error getting user profile: {str(e)}")
        return func.HttpResponse(
            body=json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )

def enrich_with_marketplace_stats(user):
    """
    Calculate marketplace stats for a user and add them to the user object
    
    Args:
        user: User object
        
    Returns:
        User object with updated stats
    """
    try:
        user_id = user.get('id') or user.get('email')
        
        # Initialize stats if not present
        if 'stats' not in user:
            user['stats'] = {
                "plantsCount": 0,
                "salesCount": 0,
                "rating": 0,
                "reviewsCount": 0
            }
        
        # Get the user's plant listings count
        try:
            plants_container = get_container("marketplace-plants")
            
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
        
        # Get sold items count
        try:
            sold_query = "SELECT VALUE COUNT(1) FROM c WHERE c.sellerId = @sellerId AND c.status = 'sold'"
            sold_params = [{"name": "@sellerId", "value": user_id}]
            
            sold_counts = list(plants_container.query_items(
                query=sold_query,
                parameters=sold_params,
                enable_cross_partition_query=True
            ))
            
            if sold_counts and len(sold_counts) > 0:
                user['stats']['salesCount'] = sold_counts[0]
        except Exception as e:
            logging.warning(f"Error getting sold count: {str(e)}")
            
        # Get the user's average rating
        try:
            # For now, use a placeholder rating calculation
            # In a real system, this would be based on ratings given by other users
            if user['stats']['salesCount'] > 0:
                # Default to 4.5-5.0 rating for users with sales
                import random
                user['stats']['rating'] = round(4.5 + random.random() * 0.5, 1)
                user['stats']['reviewsCount'] = max(1, round(user['stats']['salesCount'] * 0.7))
        except Exception as e:
            logging.warning(f"Error calculating rating: {str(e)}")
            
        # Ensure the listings array is initialized
        if 'listings' not in user:
            # Get user's listings
            try:
                listings_query = """
                SELECT c.id, c.title, c.description, c.price, c.category, 
                       c.images[0] as imageUrl, c.addedAt as listedDate, c.status
                FROM c 
                WHERE c.sellerId = @sellerId
                ORDER BY c.addedAt DESC
                """
                listings_params = [{"name": "@sellerId", "value": user_id}]
                
                listings = list(plants_container.query_items(
                    query=listings_query,
                    parameters=listings_params,
                    enable_cross_partition_query=True
                ))
                
                user['listings'] = listings
            except Exception as e:
                logging.warning(f"Error getting listings: {str(e)}")
                user['listings'] = []
        
        # Get wishlist items
        if 'favorites' not in user:
            try:
                wishlist_container = get_container("marketplace-wishlists")
                
                # Get all wishlist IDs
                wishlist_query = """
                SELECT c.plantId
                FROM c 
                WHERE c.userId = @userId
                """
                wishlist_params = [{"name": "@userId", "value": user_id}]
                
                wishlist_items = list(wishlist_container.query_items(
                    query=wishlist_query,
                    parameters=wishlist_params,
                    enable_cross_partition_query=True
                ))
                
                # Extract plant IDs from wishlist
                plant_ids = [item['plantId'] for item in wishlist_items]
                
                if plant_ids:
                    # Get details for wishlist plants
                    favorites = []
                    for plant_id in plant_ids:
                        plant_query = """
                        SELECT c.id, c.title, c.description, c.price, c.category, 
                               c.images[0] as imageUrl, c.addedAt as listedDate, c.status
                        FROM c 
                        WHERE c.id = @id
                        """
                        plant_params = [{"name": "@id", "value": plant_id}]
                        
                        plants = list(plants_container.query_items(
                            query=plant_query,
                            parameters=plant_params,
                            enable_cross_partition_query=True
                        ))
                        
                        if plants:
                            favorites.append(plants[0])
                    
                    user['favorites'] = favorites
                else:
                    user['favorites'] = []
            except Exception as e:
                logging.warning(f"Error getting favorites: {str(e)}")
                user['favorites'] = []
                
        return user
    except Exception as e:
        logging.error(f"Error enriching user stats: {str(e)}")
        return user