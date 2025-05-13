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
        
        # Access the marketplace_plants container
        container = get_container("marketplace_plants")
        
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
        
        # Get seller information if available
        if 'sellerId' in plant:
            try:
                users_container = get_container("marketplace_users")
                query = "SELECT c.name, c.avatar, c.rating FROM c WHERE c.id = @id"
                parameters = [{"name": "@id", "value": plant['sellerId']}]
                
                sellers = list(users_container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ))
                
                if sellers:
                    plant['seller'] = sellers[0]
            except Exception as e:
                logging.error(f"Error fetching seller information: {str(e)}")
        
        # Check if there's a scientific name but no care info
        if ('scientific_name' in plant and plant['scientific_name'] and 
            ('careInfo' not in plant or not plant['careInfo'])):
            try:
                # Try to get plant care info from main Plants container
                plants_container = get_main_container("Plants")
                
                care_query = "SELECT * FROM c WHERE c.scientific_name = @scientific_name"
                care_params = [{"name": "@scientific_name", "value": plant['scientific_name']}]
                
                care_plants = list(plants_container.query_items(
                    query=care_query,
                    parameters=care_params,
                    enable_cross_partition_query=True
                ))
                
                if care_plants:
                    care_plant = care_plants[0]
                    plant['careInfo'] = {
                        "water": care_plant.get('water_days', "Regular watering"),
                        "light": care_plant.get('light', "Medium light"),
                        "temperature": care_plant.get('temperature', "Room temperature"),
                        "humidity": care_plant.get('humidity', "Average humidity"),
                        "pets": care_plant.get('pets', "Unknown pet safety"),
                        "difficulty": care_plant.get('difficulty', "Moderate")
                    }
            except Exception as e:
                logging.warning(f"Error fetching plant care info: {str(e)}")
        
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