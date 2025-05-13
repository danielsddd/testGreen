# backend/marketplace/products-create/__init__.py
import logging
import json
import azure.functions as func
from ..db_client import get_container
from ..storage_helper import upload_image
import uuid
from datetime import datetime

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
        
        # Check if we should pull care info from the Plants container
        plant_scientific_name = request_body.get('scientificName')
        care_info = {}
        
        if plant_scientific_name:
            try:
                # Try to find the plant in the main Plants container
                plants_container = get_container('Plants')
                
                # Query for the plant by scientific name
                query = "SELECT * FROM c WHERE c.scientific_name = @name"
                parameters = [{"name": "@name", "value": plant_scientific_name}]
                
                plants = list(plants_container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ))
                
                if plants:
                    plant_info = plants[0]
                    
                    # Create formatted care info from Plants container data
                    care_info = {
                        "water": f"Every {plant_info.get('water_days', 7)} days",
                        "light": plant_info.get('light', "Appropriate light"),
                        "temperature": f"{plant_info.get('temperature', {}).get('min', 15)}-{plant_info.get('temperature', {}).get('max', 30)}°C",
                        "humidity": plant_info.get('humidity', "Average humidity"),
                        "difficulty": plant_info.get('difficulty', 5),
                        "pets": plant_info.get('pets', "Unknown"),
                    }
                    
                    # Add common problems if available
                    if 'common_problems' in plant_info and isinstance(plant_info['common_problems'], list):
                        care_info["common_problems"] = plant_info['common_problems']
            except Exception as e:
                logging.warning(f"Failed to get plant care info: {str(e)}")
        
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
        
        # Get seller ID (user email) from the request
        seller_id = request_body.get('sellerId') or request_body.get('email', "unknown@example.com")
        
        # Verify the seller exists in the Users container
        try:
            users_container = get_container('Users')
            
            user_query = "SELECT c.email FROM c WHERE c.email = @email"
            user_params = [{"name": "@email", "value": seller_id}]
            
            users = list(users_container.query_items(
                query=user_query,
                parameters=user_params,
                enable_cross_partition_query=True
            ))
            
            if not users:
                logging.warning(f"Seller with email {seller_id} not found in Users container")
        except Exception as e:
            logging.warning(f"Error verifying seller: {str(e)}")
        
        plant_item = {
            "id": plant_id,
            "title": request_body['title'],
            "description": request_body['description'],
            "price": float(request_body['price']),
            "category": request_body['category'].lower(),
            "scientificName": plant_scientific_name,
            "addedAt": current_time,
            "status": "active",
            "sellerId": seller_id,
            "images": image_urls,
            "location": request_body.get('location', {
                "city": request_body.get('city', 'Unknown location'),
                "coordinates": request_body.get('coordinates', {
                    "latitude": 0,
                    "longitude": 0
                })
            }),
            "stats": {
                "views": 0,
                "wishlistCount": 0,
                "messageCount": 0
            }
        }
        
        # Add care information if available
        if care_info:
            plant_item['careInfo'] = care_info
        elif 'careInstructions' in request_body and request_body['careInstructions']:
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