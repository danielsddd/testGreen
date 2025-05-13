# backend/marketplace/storage_helper.py
import os
import logging
import base64
import uuid
from azure.storage.blob import BlobServiceClient, ContentSettings

# SEARCH_KEY: STORAGE_HELPER_CONFIG
def get_storage_client():
    """Get the Azure Blob Storage client for marketplace images."""
    try:
        connection_string = os.environ.get("STORAGE_ACOUNT_MARKETPLACE_STRING")
        client = BlobServiceClient.from_connection_string(connection_string)
        return client
    except Exception as e:
        logging.error(f"Failed to create storage client: {str(e)}")
        raise

def upload_image(image_data, content_type="image/jpeg"):
    """Upload an image to blob storage and return the URL."""
    try:
        # Get storage client
        client = get_storage_client()
        
        # Get or create container
        container_name = "marketplace-images"
        try:
            container_client = client.get_container_client(container_name)
            if not container_client.exists():
                container_client.create_container(public_access="blob")
        except Exception as e:
            logging.error(f"Error with container: {str(e)}")
            raise
        
        # Generate a unique name for the blob
        blob_name = f"{uuid.uuid4()}.jpg"
        blob_client = container_client.get_blob_client(blob_name)
        
        # Process the image data (base64 or binary)
        if isinstance(image_data, str) and image_data.startswith('data:image'):
            # Handle base64 encoded images from frontend
            header, encoded = image_data.split(",", 1)
            image_bytes = base64.b64decode(encoded)
        elif isinstance(image_data, str):
            # Plain base64 without data URI scheme
            image_bytes = base64.b64decode(image_data)
        else:
            # Assume it's already binary data
            image_bytes = image_data
        
        # Upload the image with content settings
        content_settings = ContentSettings(content_type=content_type)
        blob_client.upload_blob(image_bytes, content_settings=content_settings)
        
        # Return the URL
        return blob_client.url
    
    except Exception as e:
        logging.error(f"Error uploading image: {str(e)}")
        raise