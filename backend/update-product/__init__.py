# Backend: /backend/update-product/__init__.py

import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for updating a product processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get product ID from route parameters
        product_id = req.route_params.get('id')
        
        if not product_id:
            return create_error_response("Product ID is required", 400)
        
        # Get user ID to verify ownership
        user_id = extract_user_id(req)
        
        if not user_id:
            return create_error_response("User ID is required", 400)
        
        # Get update data from request body
        update_data = req.get_json()
        
        if not update_data:
            return create_error_response("Update data is required", 400)
        
        # Access the marketplace-plants container
        container = get_container("marketplace-plants")
        
        # Check if the product exists and is owned by the user
        query = "SELECT * FROM c WHERE c.id = @id"
        parameters = [{"name": "@id", "value": product_id}]
        
        products = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        if not products:
            return create_error_response("Product not found", 404)
        
        product = products[0]
        
        # Verify ownership
        seller_id = product.get('sellerId')
        
        if not seller_id or seller_id != user_id:
            return create_error_response("You don't have permission to update this product", 403)
        
        # Fields that cannot be changed (for safety)
        protected_fields = ['id', 'sellerId', 'addedAt', 'stats', 'status']
        
        # Update fields from the request
        for key, value in update_data.items():
            if key not in protected_fields:
                product[key] = value
        
        # Add an updatedAt timestamp
        product['updatedAt'] = datetime.utcnow().isoformat()
        
        # Update the product
        container.replace_item(item=product_id, body=product)
        
        return create_success_response({
            "success": True,
            "message": "Product successfully updated",
            "product": product
        })
    
    except Exception as e:
        logging.error(f"Error updating product: {str(e)}")
        return create_error_response(str(e), 500)