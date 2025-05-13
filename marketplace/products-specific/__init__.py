# backend/marketplace/products-specific/__init__.py
import logging
import json
import azure.functions as func
from ..db_client import get_container

# SEARCH_KEY: MARKETPLACE_PRODUCT_DETAIL_CONFIG
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
        container = get_container('marketplace_plants')
        
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
                users_container = get_container('marketplace_users')
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