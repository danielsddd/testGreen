import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
import uuid
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for submitting reviews processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get target type and ID from route parameters
        target_type = req.route_params.get('targetType')
        target_id = req.route_params.get('targetId')
        
        if not target_type or not target_id:
            return create_error_response("Target type and ID are required", 400)
        
        # Validate target type
        if target_type not in ['seller', 'product']:
            return create_error_response("Invalid target type. Must be 'seller' or 'product'", 400)
        
        # Get user ID from request for review attribution
        user_id = extract_user_id(req)
        
        if not user_id:
            return create_error_response("User ID is required", 400)
        
        # Get request body
        try:
            review_data = req.get_json()
        except ValueError:
            return create_error_response("Invalid JSON body", 400)
        
        # Validate required fields
        if 'rating' not in review_data or 'text' not in review_data:
            return create_error_response("Rating and text are required", 400)
        
        # Validate rating value
        try:
            rating = int(review_data['rating'])
            if rating < 1 or rating > 5:
                return create_error_response("Rating must be between 1 and 5", 400)
        except (ValueError, TypeError):
            return create_error_response("Rating must be a number between 1 and 5", 400)
        
        # Access the reviews container
        reviews_container = get_container("marketplace-reviews")
        
        # Determine the seller ID for proper partitioning
        if target_type == 'product':
            try:
                # Get the product to find the sellerId
                logging.info(f"Finding sellerId for product {target_id}")
                products_container = get_container("marketplace-plants")
                product_query = "SELECT c.sellerId FROM c WHERE c.id = @id"
                product_params = [{"name": "@id", "value": target_id}]
                
                products = list(products_container.query_items(
                    query=product_query,
                    parameters=product_params,
                    enable_cross_partition_query=True
                ))
                
                if products and 'sellerId' in products[0]:
                    seller_id = products[0]['sellerId']
                    logging.info(f"Found sellerId {seller_id} for product {target_id}")
                else:
                    # Fallback if product doesn't have sellerId
                    logging.warning(f"Could not find sellerId for product {target_id}")
                    seller_id = f"product_{target_id}_seller"
            except Exception as e:
                logging.warning(f"Error finding product seller: {str(e)}")
                seller_id = f"product_{target_id}_seller"
        else:
            # For seller reviews, the seller ID is the target ID
            seller_id = target_id
        
        logging.info(f"Using sellerId {seller_id} as partition key")
        
        # Check if user has already reviewed this target
        if target_type == 'seller':
            query = "SELECT VALUE COUNT(1) FROM c WHERE c.sellerId = @sellerId AND c.userId = @userId"
            parameters = [
                {"name": "@sellerId", "value": seller_id},
                {"name": "@userId", "value": user_id}
            ]
            enable_cross_partition = False
        else:
            query = "SELECT VALUE COUNT(1) FROM c WHERE c.productId = @productId AND c.userId = @userId"
            parameters = [
                {"name": "@productId", "value": target_id},
                {"name": "@userId", "value": user_id}
            ]
            enable_cross_partition = True
        
        existing_review_count = list(reviews_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=enable_cross_partition
        ))[0]
        
        if existing_review_count > 0:
            return create_error_response("You have already reviewed this " + target_type, 400)
        
        # Get user's name
        try:
            users_container = get_container("users")
            
            user_query = "SELECT c.name FROM c WHERE c.id = @id OR c.email = @email"
            user_params = [
                {"name": "@id", "value": user_id},
                {"name": "@email", "value": user_id}
            ]
            
            users = list(users_container.query_items(
                query=user_query,
                parameters=user_params,
                enable_cross_partition_query=True
            ))
            
            user_name = users[0]['name'] if users else 'User'
        except Exception as e:
            logging.warning(f"Error getting user name: {str(e)}")
            user_name = 'User'
        
        # Create review object
        review_id = str(uuid.uuid4())
        current_time = datetime.utcnow().isoformat()
        
        # Create review object with proper partition key
        review_item = {
            "id": review_id,
            "sellerId": seller_id,  # Always use a valid sellerId for the partition key
            "productId": target_id if target_type == 'product' else None,
            "targetType": target_type,  # Store the target type for clarity
            "userId": user_id,
            "userName": user_name,
            "rating": rating,
            "text": review_data['text'],
            "createdAt": current_time
        }
        
        # Create the review in the database with partition key
        logging.info(f"Creating review with id {review_id} and partition key {seller_id}")
        reviews_container.create_item(body=review_item, partition_key=seller_id)
        
        # Add isOwnReview flag for the frontend
        review_item['isOwnReview'] = True
        
        # Update the target's average rating
        try:
            update_target_rating(target_type, target_id)
        except Exception as e:
            logging.warning(f"Error updating target rating: {str(e)}")
        
        # Return success response
        return create_success_response({
            "success": True,
            "review": review_item,
            "message": f"Review submitted successfully"
        }, 201)
    
    except Exception as e:
        logging.error(f"Error submitting review: {str(e)}")
        return create_error_response(str(e), 500)

def update_target_rating(target_type, target_id):
    """Update the average rating of a seller or product"""
    
    # Get all reviews for the target
    reviews_container = get_container("marketplace-reviews")
    
    if target_type == 'seller':
        query = "SELECT VALUE c.rating FROM c WHERE c.sellerId = @sellerId"
        parameters = [{"name": "@sellerId", "value": target_id}]
        enable_cross_partition = False
    else:
        query = "SELECT VALUE c.rating FROM c WHERE c.productId = @productId"
        parameters = [{"name": "@productId", "value": target_id}]
        enable_cross_partition = True
    
    ratings = list(reviews_container.query_items(
        query=query,
        parameters=parameters,
        enable_cross_partition_query=enable_cross_partition
    ))
    
    if not ratings:
        return
    
    average_rating = sum(ratings) / len(ratings)
    
    container_name = "marketplace-plants" if target_type == "product" else "users"
    container = get_container(container_name)
    
    query = "SELECT * FROM c WHERE c.id = @id"
    parameters = [{"name": "@id", "value": target_id}]
    
    targets = list(container.query_items(
        query=query,
        parameters=parameters,
        enable_cross_partition_query=True
    ))
    
    if not targets:
        if target_type == "seller":
            query = "SELECT * FROM c WHERE c.email = @email"
            parameters = [{"name": "@email", "value": target_id}]
            targets = list(container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
    
    if not targets:
        logging.warning(f"Could not find {target_type} with ID {target_id}")
        return
    
    target = targets[0]
    
    if 'stats' not in target:
        target['stats'] = {}
    
    target['stats']['rating'] = average_rating
    target['stats']['reviewCount'] = len(ratings)
    
    container.replace_item(item=target['id'], body=target)
