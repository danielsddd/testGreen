# backend/marketplace/products-specific/__init__.py
import logging
import json
import azure.functions as func
from ..db_client import get_container, get_main_container

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for marketplace specific product processed a request.')
    
    try:
        # Get plant ID from route parameters
        plant_id = req.route_params.get('id')
        
        if not plant_id:
            return func.HttpResponse(
                body=json.dumps({"error": "Plant ID is required"}),
                mimetype="application/json",
                status_code=400
            )
        
        # Get user ID for wishlist status check
        user_id = req.params.get('userId')
        
        # Access the marketplace-plants container
        container = get_container("marketplace-plants")
        
        # Query for the specific plant
        query = "SELECT * FROM c WHERE c.id = @id"
        parameters = [{"name": "@id", "value": plant_id}]
        
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        if not items:
            return func.HttpResponse(
                body=json.dumps({"error": "Plant not found"}),
                mimetype="application/json",
                status_code=404
            )
        
        plant = items[0]
        
        # Check if this item is in the user's wishlist
        if user_id:
            try:
                wishlist_container = get_container("marketplace-wishlists")
                
                wishlist_query = "SELECT * FROM c WHERE c.userId = @userId AND c.plantId = @plantId"
                wishlist_params = [
                    {"name": "@userId", "value": user_id},
                    {"name": "@plantId", "value": plant_id}
                ]
                
                wishlist_items = list(wishlist_container.query_items(
                    query=wishlist_query,
                    parameters=wishlist_params,
                    enable_cross_partition_query=True
                ))
                
                plant['isWished'] = len(wishlist_items) > 0
            except Exception as e:
                logging.warning(f"Error checking wishlist status: {str(e)}")
                plant['isWished'] = False
        
        # Get seller information if available
        if 'sellerId' in plant:
            try:
                users_container = get_container("users")
                query = "SELECT c.id, c.email, c.name, c.avatar, c.stats FROM c WHERE c.id = @id OR c.email = @email"
                parameters = [
                    {"name": "@id", "value": plant['sellerId']},
                    {"name": "@email", "value": plant['sellerId']}
                ]
                
                sellers = list(users_container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ))
                
                if sellers:
                    seller = sellers[0]
                    plant['seller'] = {
                        '_id': seller.get('id') or seller.get('email'),
                        'name': seller.get('name', 'User'),
                        'avatar': seller.get('avatar')
                    }
                    
                    # Add rating if available
                    if 'stats' in seller and 'rating' in seller['stats']:
                        plant['rating'] = seller['stats']['rating']
            except Exception as e:
                logging.error(f"Error fetching seller information: {str(e)}")
        
        # Check if we need to get plant care info from the main Plants container
        if ('scientificName' in plant and plant['scientificName'] and 
            ('careInfo' not in plant or not plant['careInfo'])):
            try:
                # Try to get plant care info from main Plants container
                plants_container = get_main_container("Plants")
                
                care_query = "SELECT * FROM c WHERE c.scientific_name = @scientific_name"
                care_params = [{"name": "@scientific_name", "value": plant['scientificName']}]
                
                care_plants = list(plants_container.query_items(
                    query=care_query,
                    parameters=care_params,
                    enable_cross_partition_query=True
                ))
                
                if care_plants:
                    care_plant = care_plants[0]
                    
                    # Extract care info from the Plant container
                    plant['careInfo'] = {
                        "water": get_water_frequency(care_plant.get('water_days')),
                        "light": care_plant.get('light', "Medium light"),
                        "temperature": get_temperature_range(care_plant.get('temperature')),
                        "humidity": care_plant.get('humidity', "Average humidity"),
                        "difficulty": care_plant.get('difficulty', 5),
                        "pets": get_pet_safety(care_plant.get('pets')),
                    }
                    
                    # Add common problems if available
                    if 'common_problems' in care_plant and isinstance(care_plant['common_problems'], list):
                        plant['careInfo']["common_problems"] = care_plant['common_problems']
            except Exception as e:
                logging.warning(f"Error fetching plant care info: {str(e)}")
        
        # Ensure proper data format for frontend
        format_plant_for_frontend(plant)
        
        return func.HttpResponse(
            body=json.dumps(plant, default=str),
            mimetype="application/json",
            status_code=200
        )
    
    except Exception as e:
        logging.error(f"Error retrieving specific plant: {str(e)}")
        return func.HttpResponse(
            body=json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )

def format_plant_for_frontend(plant):
    """
    Format plant data for frontend consumption
    
    Args:
        plant: Plant data object
    """
    # Ensure there's at least one image URL
    if 'images' not in plant or not plant['images']:
        plant['image'] = None
    else:
        if isinstance(plant['images'], list) and len(plant['images']) > 0:
            plant['image'] = plant['images'][0]
    
    # Ensure location info is accessible
    if 'location' in plant and isinstance(plant['location'], dict):
        if 'city' in plant['location'] and 'city' not in plant:
            plant['city'] = plant['location']['city']
    
    # Map addedAt to listedDate if needed
    if 'addedAt' in plant and 'listedDate' not in plant:
        plant['listedDate'] = plant['addedAt']
        
    # Ensure title exists
    if 'title' not in plant and 'name' in plant:
        plant['title'] = plant['name']
    elif 'name' not in plant and 'title' in plant:
        plant['name'] = plant['title']
    
    # Fill in defaults for any missing fields
    if 'status' not in plant:
        plant['status'] = 'active'
    
    if 'category' not in plant:
        plant['category'] = 'Other'
        
    # Ensure price is formatted correctly (number, not string)
    if 'price' in plant and isinstance(plant['price'], str):
        try:
            plant['price'] = float(plant['price'])
        except:
            pass

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
    if not pet_data:
        return "Unknown pet safety"
        
    if isinstance(pet_data, bool):
        return "Pet safe" if pet_data else "Not pet safe"
    
    return str(pet_data)