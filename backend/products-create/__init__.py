# backend/marketplace/products-create/__init__.py
import logging
import json
import azure.functions as func
from ..db_client import get_container, get_main_container
from shared.marketplace.storage_helper import upload_image
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
        
        # Access the marketplace-plants container
        container = get_container("marketplace-plants")
        
        # Get seller ID (user email) from the request
        seller_id = request_body.get('sellerId') or request_body.get('email')
        
        if not seller_id:
            return func.HttpResponse(
                body=json.dumps({"error": "Seller ID is required"}),
                mimetype="application/json",
                status_code=400
            )
        
        # Verify the seller exists in the Users container or the marketplace users container
        seller_verified = verify_seller(seller_id)
        
        if not seller_verified:
            return func.HttpResponse(
                body=json.dumps({"error": "Seller not found. Please sign in first."}),
                mimetype="application/json",
                status_code=400
            )
        
        # Check if we should pull care info from the Plants container
        plant_scientific_name = request_body.get('scientificName')
        care_info = {}
        
        if plant_scientific_name:
            try:
                # Try to find the plant in the main Plants container
                plants_container = get_main_container('Plants')
                
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
                        "water": get_water_frequency(plant_info.get('water_days')),
                        "light": plant_info.get('light', "Medium light"),
                        "temperature": get_temperature_range(plant_info.get('temperature')),
                        "humidity": plant_info.get('humidity', "Average humidity"),
                        "difficulty": plant_info.get('difficulty', 5),
                        "pets": get_pet_safety(plant_info.get('pets')),
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
                image_url = upload_image(request_body['image'], 'marketplace-plants')
                image_urls.append(image_url)
            except Exception as e:
                logging.error(f"Error uploading main image: {str(e)}")
        
        # Process additional images
        if 'images' in request_body and isinstance(request_body['images'], list):
            for img in request_body['images']:
                try:
                    if img:
                        image_url = upload_image(img, 'marketplace-plants')
                        image_urls.append(image_url)
                except Exception as e:
                    logging.error(f"Error uploading additional image: {str(e)}")
        
        # Ensure we have at least one image
        if not image_urls:
            return func.HttpResponse(
                body=json.dumps({"error": "At least one image is required"}),
                mimetype="application/json",
                status_code=400
            )
        
        # Create plant listing
        plant_id = str(uuid.uuid4())
        current_time = datetime.utcnow().isoformat()
        
        # Prepare location data
        location = prepare_location_data(request_body)
        
        # Format price as a float
        try:
            price = float(request_body['price'])
        except (ValueError, TypeError):
            return func.HttpResponse(
                body=json.dumps({"error": "Price must be a valid number"}),
                mimetype="application/json",
                status_code=400
            )
        
        plant_item = {
            "id": plant_id,
            "title": request_body['title'],
            "description": request_body['description'],
            "price": price,
            "category": request_body['category'].lower(),
            "scientificName": plant_scientific_name,
            "addedAt": current_time,
            "status": "active",
            "sellerId": seller_id,
            "images": image_urls,
            "location": location,
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

def verify_seller(seller_id):
    """
    Verify that the seller exists in either database
    
    Args:
        seller_id: Seller ID (email)
        
    Returns:
        bool: True if seller exists, False otherwise
    """
    try:
        # First check in the marketplace users container
        marketplace_users = get_container("users")
        
        query = "SELECT VALUE COUNT(1) FROM c WHERE c.id = @id OR c.email = @email"
        parameters = [
            {"name": "@id", "value": seller_id},
            {"name": "@email", "value": seller_id}
        ]
        
        results = list(marketplace_users.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        if results and results[0] > 0:
            return True
        
        # If not found, check in the global Users container
        main_users = get_main_container("Users")
        
        query = "SELECT VALUE COUNT(1) FROM c WHERE c.email = @email"
        parameters = [{"name": "@email", "value": seller_id}]
        
        results = list(main_users.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        if results and results[0] > 0:
            # User exists in main database, let's copy to marketplace
            create_marketplace_user_from_main(seller_id)
            return True
            
        return False
    except Exception as e:
        logging.error(f"Error verifying seller: {str(e)}")
        return False

def create_marketplace_user_from_main(email):
    """
    Create a new marketplace user from the main database
    
    Args:
        email: User email
    """
    try:
        # Get user from main database
        main_users = get_main_container("Users")
        
        query = "SELECT * FROM c WHERE c.email = @email"
        parameters = [{"name": "@email", "value": email}]
        
        users = list(main_users.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        if users:
            user = users[0]
            
            # Create new marketplace user
            marketplace_user = {
                "id": user.get('email'),
                "email": user.get('email'),
                "name": user.get('name', 'Greener User'),
                "phoneNumber": user.get('phoneNumber', ''),
                "avatar": user.get('avatar'),
                "bio": user.get('bio', ''),
                "location": user.get('location', ''),
                "joinDate": user.get('joinDate', datetime.utcnow().isoformat()),
                "userType": user.get('userType', 'individual'),
                "stats": {
                    "plantsCount": 0,
                    "salesCount": 0,
                    "rating": 0,
                    "reviewsCount": 0
                }
            }
            
            # Store in marketplace users container
            marketplace_users = get_container("users")
            marketplace_users.create_item(body=marketplace_user)
            
            logging.info(f"Created new marketplace user for {email}")
    except Exception as e:
        logging.error(f"Error creating marketplace user: {str(e)}")

def prepare_location_data(request_body):
    """
    Prepare location data from request body
    
    Args:
        request_body: Request body with location information
        
    Returns:
        dict: Location data
    """
    location = {}
    
    # If there's a location object already
    if 'location' in request_body and isinstance(request_body['location'], dict):
        location = request_body['location']
    else:
        # Otherwise build from individual fields
        location = {
            "city": request_body.get('city', 'Unknown location')
        }
        
        # Add coordinates if available
        if 'latitude' in request_body and 'longitude' in request_body:
            try:
                location["coordinates"] = {
                    "latitude": float(request_body['latitude']),
                    "longitude": float(request_body['longitude'])
                }
            except (ValueError, TypeError):
                pass
    
    # Ensure we have a city
    if 'city' not in location or not location['city']:
        location['city'] = 'Unknown location'
        
    return location

def get_water_frequency(water_days):
    """Convert water_days to human-readable frequency"""
    if water_days is None:
        return "As needed"
        
    if isinstance(water_days, (int, float)):
        if water_days <= 3:
            return "Frequent (every 1-3 days)"
        elif water_days <= 7:
            return "Regular (once a week)"
        elif water_days <= 14:
            return "Moderate (every 1-2 weeks)"
        else:
            return "Infrequent (every 2+ weeks)"
    
    return str(water_days)

def get_temperature_range(temp_data):
    """Convert temperature data to a readable range"""
    if not temp_data or not isinstance(temp_data, dict):
        return "Room temperature (65-80°F)"
        
    min_temp = temp_data.get('min')
    max_temp = temp_data.get('max')
    
    if min_temp is not None and max_temp is not None:
        return f"{min_temp}-{max_temp}°F"
    
    return "Room temperature (65-80°F)"

def get_pet_safety(pet_data):
    """Format pet safety information"""
    if pet_data is None:
        return "Unknown pet safety"
        
    if isinstance(pet_data, bool):
        return "Pet safe" if pet_data else "Not pet safe"
    
    return str(pet_data)