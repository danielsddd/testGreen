# backend/marketplace/db_client.py
import os
import logging
from azure.cosmos import CosmosClient, PartitionKey

# SEARCH_KEY: DB_CLIENT_CONFIG
def get_marketplace_db_client():
    """Get a connection to the marketplace database."""
    try:
        # Get connection details from environment variables
        connection_string = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
        database_name = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME")
        
        if not connection_string:
            raise ValueError("Missing required environment variable: COSMOSDB__MARKETPLACE_CONNECTION_STRING")
        
        if not database_name:
            raise ValueError("Missing required environment variable: COSMOSDB_MARKETPLACE_DATABASE_NAME")
        
        # Parse the connection string
        params = dict(param.split('=', 1) for param in connection_string.split(';'))
        account_endpoint = params.get('AccountEndpoint')
        account_key = params.get('AccountKey')
        
        # Create the client
        client = CosmosClient(account_endpoint, credential=account_key)
        database = client.get_database_client(database_name)
        
        return database
    except Exception as e:
        logging.error(f"Failed to initialize marketplace database: {str(e)}")
        raise

def get_container(container_name):
    """Get a specific container from the marketplace database."""
    try:
        database = get_marketplace_db_client()
        return database.get_container_client(container_name)
    except Exception as e:
        logging.error(f"Failed to get container {container_name}: {str(e)}")
        raise