# reviews-get/__init__.py
import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for fetching reviews processed a request.')
    
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
        
        # Get user ID from request for identifying own reviews
        current_user_id = extract_user_id(req)
        
        # Access the marketplace-reviews container
        reviews_container = get_container("marketplace-reviews")
        
        # Query for reviews of the target
        query = f"SELECT * FROM c WHERE c.{target_type}Id = @targetId ORDER BY c.createdAt DESC"
        parameters = [{"name": "@targetId", "value": target_id}]
        
        reviews = list(reviews_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        # Mark reviews by the current user
        if current_user_id:
            for review in reviews:
                review['isOwnReview'] = review.get('userId') == current_user_id
        
        # Calculate average rating
        total_rating = sum(review.get('rating', 0) for review in reviews)
        average_rating = total_rating / len(reviews) if reviews else 0
        
        # Return the reviews
        return create_success_response({
            "reviews": reviews,
            "averageRating": round(average_rating, 1),
            "count": len(reviews)
        })
    
    except Exception as e:
        logging.error(f"Error retrieving reviews: {str(e)}")
        return create_error_response(str(e), 500)