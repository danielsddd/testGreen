# backend/marketplace/db_init.py
import logging
from azure.cosmos import PartitionKey, exceptions
from .db_client import get_marketplace_db_client

def ensure_marketplace_containers():
    """Ensure all required containers exist in the marketplace database."""
    database = get_marketplace_db_client()
    containers = [
        {
            "id": "marketplace-plants",
            "partition_key": PartitionKey(path="/category"),
            "throughput": 400
        },
        {
            "id": "marketplace-conversations",
            "partition_key": PartitionKey(path="/participants"),
            "throughput": 400
        },
        {
            "id": "marketplace-messages",
            "partition_key": PartitionKey(path="/conversationId"),
            "throughput": 400
        },
        {
            "id": "marketplace-wishlists",
            "partition_key": PartitionKey(path="/userId"),
            "throughput": 400
        },
        {
            "id": "users",
            "partition_key": PartitionKey(path="/id"),
            "throughput": 400
        }
    ]
    
    for container_def in containers:
        try:
            container_id = container_def.pop("id")
            database.create_container_if_not_exists(
                id=container_id,
                **container_def
            )
            logging.info(f"Container {container_id} is ready")
        except exceptions.CosmosHttpResponseError as e:
            logging.error(f"Failed to create container {container_id}: {str(e)}")
            
def initialize_database():
    """Initialize the marketplace database structure."""
    try:
        # Ensure all required containers exist
        ensure_marketplace_containers()
        logging.info("Marketplace database initialization complete")
        return True
    except Exception as e:
        logging.error(f"Failed to initialize marketplace database: {str(e)}")
        raise

def initialize_cosmos_with_retry(max_retries=3):
    """Initialize Cosmos DB with retries in case of transient failures."""
    retry_count = 0
    last_error = None
    
    while retry_count < max_retries:
        try:
            if initialize_database():
                logging.info(f"Successfully initialized database on attempt {retry_count + 1}")
                return True
        except Exception as e:
            last_error = e
            retry_count += 1
            logging.warning(f"Database initialization attempt {retry_count} failed: {str(e)}")
    
    # If we got here, all retries failed
    logging.error(f"Failed to initialize database after {max_retries} attempts. Last error: {str(last_error)}")
    return False