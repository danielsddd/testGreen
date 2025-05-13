# backend/marketplace/db_client.py
import os
import logging
from azure.cosmos import CosmosClient, PartitionKey

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
        # Get container name from environment variables or use default
        env_container_name = os.environ.get(f"COSMOS_CONTAINER_{container_name.upper()}")
        actual_container_name = env_container_name or container_name
        
        database = get_marketplace_db_client()
        return database.get_container_client(actual_container_name)
    except Exception as e:
        logging.error(f"Failed to get container {container_name}: {str(e)}")
        raise

def get_main_db_client():
    """Get a connection to the main Greener database."""
    try:
        # Get connection details from environment variables
        cosmos_uri = os.environ.get("COSMOS_URI")
        cosmos_key = os.environ.get("COSMOS_KEY")
        
        if not cosmos_uri or not cosmos_key:
            raise ValueError("Missing required environment variables for main database")
        
        # Create the client
        client = CosmosClient(cosmos_uri, credential=cosmos_key)
        database = client.get_database_client("GreenerDB")
        
        return database
    except Exception as e:
        logging.error(f"Failed to initialize main database: {str(e)}")
        raise

def get_main_container(container_name):
    """Get a specific container from the main Greener database."""
    try:
        database = get_main_db_client()
        return database.get_container_client(container_name)
    except Exception as e:
        logging.error(f"Failed to get main container {container_name}: {str(e)}")
        raise