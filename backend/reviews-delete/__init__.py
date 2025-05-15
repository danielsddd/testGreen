# reviews-delete/__init__.py
import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for deleting reviews processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get review ID from route parameters
        review_id = req.route_params.get('reviewId')
        
        if not review_id:
            return create_error_response("Review ID is required", 400)
        
        # Get user ID from request for authorization
        user_id = extract_user_id(req)
        
        if not user_id:
            return create_error_response("User ID is required", 400)
        
        # Access the marketplace-reviews container
        reviews_container = get_container("marketplace-reviews")
        
        # Get the review
        query = "SELECT * FROM c WHERE c.id = @id"
        parameters = [{"name": "@id", "value": review_id}]
        
        reviews = list(reviews_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        if not reviews:
            return create_error_response("Review not found", 404)
        
        review = reviews[0]
        
        # Check if the user is authorized to delete this review
        if review.get('userId') != user_id:
            return create_error_response("You are not authorized to delete this review", 403)
        
        # Delete the review
        reviews_container.delete_item(item=review_id, partition_key=review_id)
        
        # Store target information for rating update
        target_type = 'product' if 'productId' in review else 'seller'
        target_id = review.get('productId' if target_type == 'product' else 'sellerId')
        
        # Update the target's average rating
        if target_id:
            try:
                update_target_rating(target_type, target_id)
            except Exception as e:
                logging.warning(f"Error updating target rating: {str(e)}")
        
        # Return success response
        return create_success_response({
            "success": True,
            "message": "Review deleted successfully"
        })
    
    except Exception as e:
        logging.error(f"Error deleting review: {str(e)}")
        return create_error_response(str(e), 500)

def update_target_rating(target_type, target_id):
    """Update the average rating of a seller or product after review deletion"""
    
    # Get all reviews for the target
    reviews_container = get_container("marketplace-reviews")
    
    query = f"SELECT VALUE c.rating FROM c WHERE c.{target_type}Id = @targetId"
    parameters = [{"name": "@targetId", "value": target_id}]
    
    ratings = list(reviews_container.query_items(
        query=query,
        parameters=parameters,
        enable_cross_partition_query=True
    ))
    
    # Calculate average rating
    average_rating = sum(ratings) / len(ratings) if ratings else 0
    
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