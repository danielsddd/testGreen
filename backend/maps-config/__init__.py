# Backend: /backend/maps-config/__init__.py
import logging
import json
import os
import azure.functions as func
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Maps configuration API triggered.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get the user ID from the request
        user_id = extract_user_id(req)
        
        # In a production environment, you might want to validate the user
        # before providing the key. This is a simplified implementation.
        if not user_id:
            return create_error_response("Authentication required", 401)
        
        # Get the Azure Maps key
        azure_maps_key = os.environ.get('AZURE_MAPS_MARKETPLACE_KEY')
        
        if not azure_maps_key:
            logging.error("Azure Maps API key not configured in environment variables")
            return create_error_response("Maps configuration is missing", 500)
        
        # Return the configuration
        response_data = {
            "azureMapsKey": azure_maps_key,
            "region": "il" # Default region code for Israel
        }
        
        return create_success_response(response_data)
    
    except Exception as e:
        logging.error(f"Error retrieving maps configuration: {str(e)}")
        return create_error_response(str(e), 500)