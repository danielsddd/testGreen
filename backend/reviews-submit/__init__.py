# reviews-submit/__init__.py
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
        
        # Check if user has already reviewed this target
        reviews_container = get_container("marketplace-reviews")
        
        # Set up query parameters based on target type
        if target_type == 'seller':
            # For seller reviews, we can use the partition key
            query = "SELECT VALUE COUNT(1) FROM c WHERE c.sellerId = @sellerId AND c.userId = @userId"
            parameters = [
                {"name": "@sellerId", "value": target_id},
                {"name": "@userId", "value": user_id}
            ]
            enable_cross_partition = False
        else:
            # For product reviews, we need to use cross-partition query
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
        
        # Create review object
        # IMPORTANT: Always include sellerId for proper partitioning
        review_item = {
            "id": review_id,
            "sellerId": target_id if target_type == 'seller' else "default",  # Default partition for product reviews
            "productId": target_id if target_type == 'product' else None,
            "targetType": target_type,  # Store the target type for clarity
            "userId": user_id,
            "userName": user_name,
            "rating": rating,
            "text": review_data['text'],
            "createdAt": current_time
        }
        
        # Create the review in the database
        reviews_container.create_item(body=review_item)
        
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
        # For seller reviews, we can use the partition key
        query = "SELECT VALUE c.rating FROM c WHERE c.sellerId = @sellerId"
        parameters = [{"name": "@sellerId", "value": target_id}]
        enable_cross_partition = False
    else:
        # For product reviews, we need to use cross-partition query
        query = "SELECT VALUE c.rating FROM c WHERE c.productId = @productId"
        parameters = [{"name": "@productId", "value": target_id}]
        enable_cross_partition = True
    
    ratings = list(reviews_container.query_items(
        query=query,
        parameters=parameters,
        enable_cross_partition_query=enable_cross_partition
    ))
    
    # Calculate average rating
    if not ratings:
        return
    
    average_rating = sum(ratings) / len(ratings)
    
    # Determine which container to update
    container_name = "marketplace-plants" if target_type == "product" else "users"
    container = get_container(container_name)
    
    # Get the target
    query = "SELECT * FROM c WHERE c.id = @id"
    parameters = [{"name": "@id", "value": target_id}]
    
    targets = list(container.query_items(
        query=query,
        parameters=parameters,
        enable_cross_partition_query=True
    ))
    
    if not targets:
        # Try with email as ID for users
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
    
    # Update rating
    if 'stats' not in target:
        target['stats'] = {}
    
    target['stats']['rating'] = average_rating
    target['stats']['reviewCount'] = len(ratings)
    
    # Update the target
    container.replace_item(item=target['id'], body=target)