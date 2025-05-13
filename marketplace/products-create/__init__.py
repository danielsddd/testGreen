# backend/marketplace/products-create/__init__.py
import logging
import json
import azure.functions as func
from ..db_client import get_container
from ..storage_helper import upload_image
import uuid
from datetime import datetime

# SEARCH_KEY: MARKETPLACE_CREATE_PRODUCT_CONFIG
def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for creating marketplace products processed a request.')
    
    try:
        # Get request body
        request_body = req.get_json()
        
        # Validate required fields
        required_fields = ['title', 'price', 'category', 'description']
        missing_fields = [field for field in required_fields if field not in request_body]
        
        if missing_fields:
            return func.HttpResponse(
                body=json.dumps({"error": f"Missing required fields: {', '.join(missing_fields)}"}),
                mimetype="application/json",
                status_code=400
            )
        
        # Access the marketplace_plants container
        container = get_container('marketplace_plants')
        
        # Process images
        image_urls = []
        
        # Process main image
        if 'image' in request_body and request_body['image']:
            try:
                image_url = upload_image(request_body['image'])
                image_urls.append(image_url)
            except Exception as e:
                logging.error(f"Error uploading main image: {str(e)}")
        
        # Process additional images
        if 'images' in request_body and isinstance(request_body['images'], list):
            for img in request_body['images']:
                try:
                    if img:
                        image_url = upload_image(img)
                        image_urls.append(image_url)
                except Exception as e:
                    logging.error(f"Error uploading additional image: {str(e)}")
        
        # Create plant listing
        plant_id = str(uuid.uuid4())
        current_time = datetime.utcnow().isoformat()
        
        plant_item = {
            "id": plant_id,
            "title": request_body['title'],
            "description": request_body['description'],
            "price": float(request_body['price']),
            "category": request_body['category'].lower(),
            "addedAt": current_time,
            "status": "active",
            "sellerId": request_body.get('sellerId') or "email@example.com",  # Replace with actual user ID later
            "images": image_urls,
            "location": request_body.get('location', {
                "city": request_body.get('city', 'Unknown location'),
                "coordinates": request_body.get('coordinates', {
                    "latitude": 0,
                    "longitude": 0
                })
            }),
            "careInfo": request_body.get('careInfo', {
                "water": "As needed",
                "light": "Appropriate light",
                "temperature": "Room temperature"
            }),
            "stats": {
                "views": 0,
                "wishlistCount": 0,
                "messageCount": 0
            }
        }
        
        # Add care instructions if provided
        if 'careInstructions' in request_body and request_body['careInstructions']:
            plant_item['careInfo'] = {
                "water": request_body.get('careInfo', {}).get('water', "As needed"),
                "light": request_body.get('careInfo', {}).get('light', "Appropriate light"),
                "temperature": request_body.get('careInfo', {}).get('temperature', "Room temperature"),
                "instructions": request_body['careInstructions']
            }
        
        # Create the item in the database
        container.create_item(body=plant_item)
        
        return func.HttpResponse(
            body=json.dumps({
                "success": True,
                "productId": plant_id,
                "message": "Plant listing created successfully"
            }),
            mimetype="application/json",
            status_code=201
        )
    
    except Exception as e:
        logging.error(f"Error creating plant listing: {str(e)}")
        return func.HttpResponse(
            body=json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )