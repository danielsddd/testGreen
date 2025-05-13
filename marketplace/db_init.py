# backend/marketplace/db_init.py
import logging
from azure.cosmos import PartitionKey, exceptions
from .db_client import get_marketplace_db_client

# SEARCH_KEY: DB_INIT_CONFIG
def ensure_marketplace_containers():
    """Ensure all required containers exist in the marketplace database."""
    database = get_marketplace_db_client()
    containers = [
        {
            "id": "marketplace_plants",
            "partition_key": PartitionKey(path="/category")
        },
        {
            "id": "marketplace_users",
            "partition_key": PartitionKey(path="/id")
        },
        {
            "id": "marketplace_wishlists",
            "partition_key": PartitionKey(path="/userId")
        },
        {
            "id": "marketplace_conversations",
            "partition_key": PartitionKey(path="/participants")
        },
        {
            "id": "marketplace_messages",
            "partition_key": PartitionKey(path="/conversationId")
        }
    ]
    
    for container_def in containers:
        try:
            database.create_container_if_not_exists(
                id=container_def["id"],
                partition_key=container_def["partition_key"],
                offer_throughput=400  # Minimum throughput
            )
            logging.info(f"Container {container_def['id']} is ready")
        except exceptions.CosmosHttpResponseError as e:
            logging.error(f"Failed to create container {container_def['id']}: {str(e)}")