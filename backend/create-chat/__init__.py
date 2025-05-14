# create-chat/__init__.py
import logging
import json
import azure.functions as func
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
import uuid
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for creating chat room processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get request body
        request_body = req.get_json()
        
        # Validate required fields
        if not request_body:
            return create_error_response("Request body is required", 400)
        
        sender_id = request_body.get('sender')
        receiver_id = request_body.get('receiver')
        plant_id = request_body.get('plantId')
        initial_message = request_body.get('message')
        
        if not sender_id:
            return create_error_response("Sender ID is required", 400)
        
        if not receiver_id:
            return create_error_response("Receiver ID is required", 400)
        
        if not initial_message:
            return create_error_response("Initial message is required", 400)
        
        # Access the marketplace-conversations container
        conversations_container = get_container("marketplace-conversations")
        
        # Check if a conversation already exists between these users about this plant
        if plant_id:
            query = """
            SELECT * FROM c 
            WHERE ARRAY_CONTAINS(c.participants, @sender) 
            AND ARRAY_CONTAINS(c.participants, @receiver)
            AND c.plantId = @plantId
            """
            parameters = [
                {"name": "@sender", "value": sender_id},
                {"name": "@receiver", "value": receiver_id},
                {"name": "@plantId", "value": plant_id}
            ]
        else:
            query = """
            SELECT * FROM c 
            WHERE ARRAY_CONTAINS(c.participants, @sender) 
            AND ARRAY_CONTAINS(c.participants, @receiver)
            AND NOT IS_DEFINED(c.plantId)
            """
            parameters = [
                {"name": "@sender", "value": sender_id},
                {"name": "@receiver", "value": receiver_id}
            ]
        
        existing_conversations = list(conversations_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        conversation_id = None
        is_new_conversation = False
        
        if existing_conversations:
            # Use the existing conversation
            conversation = existing_conversations[0]
            conversation_id = conversation['id']
            
            # Update the conversation with the new message
            conversation['lastMessage'] = {
                'text': initial_message,
                'senderId': sender_id,
                'timestamp': datetime.utcnow().isoformat()
            }
            conversation['lastMessageAt'] = datetime.utcnow().isoformat()
            
            # Increment unread count for the receiver
            if 'unreadCounts' not in conversation:
                conversation['unreadCounts'] = {}
            
            conversation['unreadCounts'][receiver_id] = conversation['unreadCounts'].get(receiver_id, 0) + 1
            
            # Update the conversation
            conversations_container.replace_item(item=conversation['id'], body=conversation)
        else:
            # Create a new conversation
            conversation_id = str(uuid.uuid4())
            current_time = datetime.utcnow().isoformat()
            
            new_conversation = {
                "id": conversation_id,
                "participants": [sender_id, receiver_id],
                "createdAt": current_time,
                "lastMessageAt": current_time,
                "lastMessage": {
                    "text": initial_message,
                    "senderId": sender_id,
                    "timestamp": current_time
                },
                "unreadCounts": {
                    receiver_id: 1,
                    sender_id: 0
                }
            }
            
            if plant_id:
                new_conversation["plantId"] = plant_id
            
            # Create the conversation
            conversations_container.create_item(body=new_conversation)
            is_new_conversation = True
        
        # Add the message to the messages container
        messages_container = get_container("marketplace-messages")
        
        message_id = str(uuid.uuid4())
        current_time = datetime.utcnow().isoformat()
        
        message = {
            "id": message_id,
            "conversationId": conversation_id,
            "senderId": sender_id,
            "text": initial_message,
            "timestamp": current_time,
            "status": {
                "delivered": True,
                "read": False,
                "readAt": None
            }
        }
        
        messages_container.create_item(body=message)
        
        # Get seller name for response
        seller_name = "User"
        try:
            if is_new_conversation:
                users_container = get_container("users")
                user_query = "SELECT c.name FROM c WHERE c.id = @id OR c.email = @email"
                user_params = [
                    {"name": "@id", "value": receiver_id},
                    {"name": "@email", "value": receiver_id}
                ]
                
                users = list(users_container.query_items(
                    query=user_query,
                    parameters=user_params,
                    enable_cross_partition_query=True
                ))
                
                if users:
                    seller_name = users[0].get('name', 'User')
        except Exception as e:
            logging.warning(f"Error getting seller name: {str(e)}")
            
        # If this is a plant listing, get plant info and update message count
        plant_name = None
        if plant_id:
            try:
                plants_container = get_container("marketplace-plants")
                
                plant_query = "SELECT c.title, c.stats FROM c WHERE c.id = @id"
                plant_params = [{"name": "@id", "value": plant_id}]
                
                plants = list(plants_container.query_items(
                    query=plant_query,
                    parameters=plant_params,
                    enable_cross_partition_query=True
                ))
                
                if plants:
                    plant = plants[0]
                    plant_name = plant.get('title')
                    
                    # Update message count
                    if 'stats' not in plant:
                        plant['stats'] = {}
                    
                    plant['stats']['messageCount'] = plant['stats'].get('messageCount', 0) + 1
                    
                    plants_container.replace_item(item=plant_id, body=plant)
            except Exception as e:
                logging.warning(f"Error updating plant info: {str(e)}")
        
        return create_success_response({
            "success": True,
            "messageId": conversation_id,
            "isNewConversation": is_new_conversation,
            "sellerName": seller_name,
            "plantName": plant_name
        })
    
    except Exception as e:
        logging.error(f"Error creating chat room: {str(e)}")
        return create_error_response(str(e), 500)