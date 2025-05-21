# send_watering_notifications/__init__.py
import logging
import azure.functions as func
import os
import datetime
import requests
import json
from azure.cosmos import CosmosClient

def main(mytimer: func.TimerRequest) -> None:
    utc_timestamp = datetime.datetime.utcnow().replace(
        tzinfo=datetime.timezone.utc).isoformat()
    
    logging.info('Notification scheduler function triggered at: %s', utc_timestamp)
    
    try:
        # Initialize Cosmos client
        endpoint = os.environ["COSMOSDB__MARKETPLACE_CONNECTION_STRING"]
        key = os.environ["COSMOSDB_KEY"]
        database_id = os.environ["COSMOSDB_MARKETPLACE_DATABASE_NAME"]
        inventory_container_id = "inventory"
        notifications_container_id = "watering_notifications"
        
        client = CosmosClient(endpoint, key)
        database = client.get_database_client(database_id)
        inventory_container = database.get_container_client(inventory_container_id)
        notifications_container = database.get_container_client(notifications_container_id)
        
        # Get current hour for checking notification times
        now = datetime.datetime.utcnow()
        current_hour = now.hour
        current_minute = now.minute
        current_time_string = f"{current_hour:02d}:{current_minute:02d}"
        
        logging.info(f"Checking for notifications scheduled around: {current_time_string}")
        
        # Find all businesses with active notifications around current time
        start_time = get_time_offset(current_hour, current_minute, -30)
        end_time = get_time_offset(current_hour, current_minute, 30)
        
        businesses_query = """
            SELECT DISTINCT c.businessId FROM c 
            WHERE c.status = 'active' 
            AND c.notificationTime BETWEEN @startTime AND @endTime
        """
        
        businesses = list(notifications_container.query_items(
            query=businesses_query,
            parameters=[
                {"name": "@startTime", "value": start_time},
                {"name": "@endTime", "value": end_time}
            ],
            enable_cross_partition_query=True
        ))
        
        for business in businesses:
            business_id = business['businessId']
            process_business_notifications(inventory_container, notifications_container, business_id)
        
        logging.info(f"Completed notification check at {utc_timestamp}")
        
    except Exception as e:
        logging.error(f"Error in notification scheduler: {str(e)}")
        raise

def get_time_offset(hour, minute, offset_minutes):
    """Calculate time with offset minutes"""
    dt = datetime.datetime.utcnow().replace(hour=hour, minute=minute)
    offset_dt = dt + datetime.timedelta(minutes=offset_minutes)
    return f"{offset_dt.hour:02d}:{offset_dt.minute:02d}"

def process_business_notifications(inventory_container, notifications_container, business_id):
    """Process notifications for a specific business"""
    try:
        # Find all plants that need watering for this business
        plants_query = """
            SELECT * FROM c 
            WHERE c.businessId = @businessId 
            AND c.productType = 'plant' 
            AND c.wateringSchedule.needsWatering = true
        """
        
        plants_needing_water = list(inventory_container.query_items(
            query=plants_query,
            parameters=[{"name": "@businessId", "value": business_id}],
            enable_cross_partition_query=True
        ))
        
        if not plants_needing_water:
            logging.info(f"No plants need watering for business: {business_id}")
            return
        
        # Get device tokens for this business
        notifications_query = """
            SELECT * FROM c 
            WHERE c.businessId = @businessId 
            AND c.status = 'active'
        """
        
        notifications = list(notifications_container.query_items(
            query=notifications_query,
            parameters=[{"name": "@businessId", "value": business_id}],
            enable_cross_partition_query=True
        ))
        
        if not notifications:
            logging.info(f"No active notification settings found for business: {business_id}")
            return
        
        # Get unique device tokens
        device_tokens = set()
        for notification in notifications:
            if 'deviceTokens' in notification and notification['deviceTokens']:
                device_tokens.update(notification['deviceTokens'])
        
        if not device_tokens:
            logging.info(f"No device tokens found for business: {business_id}")
            return
        
        # Prepare notification message
        plant_names = [p.get('name') or p.get('common_name') for p in plants_needing_water[:3]]
        
        if len(plants_needing_water) == 1:
            notification_text = f"{plant_names[0]} needs watering today."
        elif len(plants_needing_water) <= 3:
            notification_text = f"{', '.join(plant_names)} need watering today."
        else:
            notification_text = f"{', '.join(plant_names)} and {len(plants_needing_water) - 3} more plants need watering today."
        
        # Send notifications via Azure Notification Hub
        send_notifications(
            business_id=business_id,
            title="🌱 Plant Watering Reminder",
            body=notification_text,
            plant_count=len(plants_needing_water),
            device_tokens=list(device_tokens)
        )
        
        # Update last sent timestamp for notifications
        for notification in notifications:
            notification['lastSent'] = datetime.datetime.utcnow().isoformat()
            notifications_container.upsert_item(notification)
        
        logging.info(f"Sent watering notifications for {len(plants_needing_water)} plants to {len(device_tokens)} devices")
    
    except Exception as e:
        logging.error(f"Error processing notifications for business {business_id}: {str(e)}")
        raise

def send_notifications(business_id, title, body, plant_count, device_tokens):
    """Send notifications via Azure Notification Hub"""
    try:
        # Get connection string and hub name from environment
        connection_string = os.environ["AZURE_NOTIFICATION_HUB_CONNECTION_STRING"]
        hub_name = os.environ["AZURE_NOTIFICATION_HUB_NAME"]
        
        # Prepare notification payload for FCM (Firebase Cloud Messaging)
        notification = {
            "data": {
                "title": title,
                "body": body,
                "type": "WATERING_REMINDER",
                "businessId": business_id,
                "plantCount": str(plant_count),
                "timestamp": datetime.datetime.utcnow().isoformat()
            }
        }
        
        # Create authorization header
        # This is a simplified approach - in production, use Azure SDK or proper SAS token generation
        headers = {
            "Content-Type": "application/json",
            "ServiceBusNotification-Format": "gcm",
            "Authorization": f"SharedAccessSignature {connection_string}"
        }
        
        # Send to each device token
        notification_endpoint = f"https://{hub_name}.servicebus.windows.net/messages/?direct"
        
        for token in device_tokens:
            notification["to"] = token
            payload = json.dumps(notification)
            
            response = requests.post(
                notification_endpoint,
                headers=headers,
                data=payload
            )
            
            if response.status_code == 201:
                logging.info(f"Notification sent to device: {token}")
            else:
                logging.error(f"Error sending notification to device {token}: {response.status_code} - {response.text}")
    
    except Exception as e:
        logging.error(f"Error sending notifications: {str(e)}")
        raise