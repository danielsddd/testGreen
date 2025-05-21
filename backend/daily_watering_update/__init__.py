# daily_watering_update/__init__.py
import logging
import azure.functions as func
import datetime
import requests
import os
import json
from azure.cosmos import CosmosClient, PartitionKey

def main(mytimer: func.TimerRequest) -> None:
    utc_timestamp = datetime.datetime.utcnow().replace(
        tzinfo=datetime.timezone.utc).isoformat()
    
    logging.info('Daily watering update function executed at: %s', utc_timestamp)
    
    try:
        # Initialize Cosmos client
        endpoint = os.environ["COSMOSDB__MARKETPLACE_CONNECTION_STRING"]
        key = os.environ["COSMOSDB_KEY"]
        database_id = os.environ["COSMOSDB_MARKETPLACE_DATABASE_NAME"]
        container_id = "inventory"
        
        client = CosmosClient(endpoint, key)
        database = client.get_database_client(database_id)
        container = database.get_container_client(container_id)
        
        # Get all businesses with plants in inventory
        business_query = "SELECT DISTINCT c.businessId FROM c WHERE c.productType = 'plant' AND IS_DEFINED(c.location)"
        businesses = list(container.query_items(
            query=business_query,
            enable_cross_partition_query=True
        ))
        
        for business in businesses:
            business_id = business['businessId']
            
            # Get business location from the first plant with GPS coordinates
            location_query = """
                SELECT TOP 1 c.location.gpsCoordinates FROM c 
                WHERE c.businessId = @businessId 
                AND c.productType = 'plant' 
                AND IS_DEFINED(c.location.gpsCoordinates)
            """
            
            locations = list(container.query_items(
                query=location_query,
                parameters=[{"name": "@businessId", "value": business_id}],
                enable_cross_partition_query=True
            ))
            
            if not locations or 'gpsCoordinates' not in locations[0]:
                logging.warning(f"No GPS coordinates found for business: {business_id}")
                continue
            
            coordinates = locations[0]['gpsCoordinates']
            
            # Check weather for business location
            weather_data = check_weather(coordinates['latitude'], coordinates['longitude'])
            has_rained = did_it_rain(weather_data)
            
            logging.info(f"Weather check for {business_id}: Rain detected: {has_rained}")
            
            # Update all plants for this business
            update_plants_watering_schedule(container, business_id, has_rained)
        
        logging.info("Successfully completed daily watering update")
        
    except Exception as e:
        logging.error(f"Error in daily watering update: {str(e)}")
        raise

def check_weather(lat, lon):
    """Check weather at specific coordinates using OpenWeatherMap API"""
    try:
        api_key = os.environ["OPENWEATHER_API_KEY"]
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}"
        
        response = requests.get(url)
        if response.status_code == 200:
            return response.json()
        else:
            logging.error(f"Error fetching weather data: {response.status_code}")
            return None
    
    except Exception as e:
        logging.error(f"Error checking weather: {str(e)}")
        return None

def did_it_rain(weather_data):
    """Determine if it rained based on weather data"""
    if not weather_data or 'weather' not in weather_data or not weather_data['weather']:
        return False
    
    # Weather condition codes: https://openweathermap.org/weather-conditions
    weather_id = weather_data['weather'][0]['id']
    
    # 2xx: Thunderstorm, 3xx: Drizzle, 5xx: Rain
    return 200 <= weather_id < 600

def update_plants_watering_schedule(container, business_id, has_rained):
    """Update watering schedule for all plants of a business"""
    try:
        # Get all plants for this business
        plants_query = """
            SELECT * FROM c 
            WHERE c.businessId = @businessId 
            AND c.productType = 'plant'
        """
        
        plants = list(container.query_items(
            query=plants_query,
            parameters=[{"name": "@businessId", "value": business_id}],
            enable_cross_partition_query=True
        ))
        
        today = datetime.datetime.now().strftime("%Y-%m-%d")
        updates = []
        
        for plant in plants:
            needs_update = False
            
            # Initialize watering schedule if it doesn't exist
            if 'wateringSchedule' not in plant:
                water_days = plant.get('water_days', 7)  # Default to weekly watering
                plant['wateringSchedule'] = {
                    "waterDays": water_days,
                    "activeWaterDays": water_days,
                    "lastWatered": None,
                    "lastWateringUpdate": today,
                    "needsWatering": False,
                    "weatherAffected": False
                }
                needs_update = True
            
            # If it rained, reset the countdown
            if has_rained:
                plant['wateringSchedule']['activeWaterDays'] = plant['wateringSchedule']['waterDays']
                plant['wateringSchedule']['needsWatering'] = False
                plant['wateringSchedule']['weatherAffected'] = True
                plant['wateringSchedule']['lastWateringUpdate'] = today
                needs_update = True
            
            # Otherwise, decrease activeWaterDays by 1 if not updated today
            elif plant['wateringSchedule'].get('lastWateringUpdate') != today:
                plant['wateringSchedule']['activeWaterDays'] = max(0, plant['wateringSchedule'].get('activeWaterDays', 0) - 1)
                plant['wateringSchedule']['needsWatering'] = plant['wateringSchedule']['activeWaterDays'] <= 0
                plant['wateringSchedule']['weatherAffected'] = False
                plant['wateringSchedule']['lastWateringUpdate'] = today
                needs_update = True
            
            if needs_update:
                updates.append({
                    "id": plant['id'],
                    "businessId": business_id,
                    "wateringSchedule": plant['wateringSchedule']
                })
        
        # Update plants in batches
        BATCH_SIZE = 20
        for i in range(0, len(updates), BATCH_SIZE):
            batch = updates[i:i+BATCH_SIZE]
            for item in batch:
                container.upsert_item({
                    "id": item["id"],
                    "businessId": item["businessId"],
                    "wateringSchedule": item["wateringSchedule"]
                }, partition_key=item["businessId"])
        
        logging.info(f"Updated {len(updates)} plants for business {business_id}")
    
    except Exception as e:
        logging.error(f"Error updating plants for business {business_id}: {str(e)}")
        raise