# backend/marketplace/send-message/__init__.py
import logging
import json
import azure.functions as func
from shared.marketplace.db_client import get_container
import uuid
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for sending a message processed a request.')
    
    try:
        # Get request body
        request_body = req.get_json()
        
        # Validate required fields
        if not request_body:
            return func.HttpResponse(
                body=json.dumps({"error": "Request body is required"}),
                mimetype="application/json",
                status_code=400
            )
        
        chat_id = request_body.get('chatId')
        message_text = request_body.get('message')
        sender_id = request_body.get('senderId')
        
        if not chat_id:
            return func.HttpResponse(
                body=json.dumps({"error": "Chat ID is required"}),
                mimetype="application/json",
                status_code=400
            )
        
        if not message_text:
            return func.HttpResponse(
                body=json.dumps({"error": "Message text is required"}),
                mimetype="application/json",
                status_code=400
            )
        
        if not sender_id:
            return func.HttpResponse(
                body=json.dumps({"error": "Sender ID is required"}),
                mimetype="application/json",
                status_code=400
            )
        
        # Get the conversation first to ensure it exists and get the receiver
        conversations_container = get_container("marketplace-conversations")
        
        conversation_query = "SELECT * FROM c WHERE c.id = @id"
        conversation_params = [{"name": "@id", "value": chat_id}]
        
        conversations = list(conversations_container.query_items(
            query=conversation_query,
            parameters=conversation_params,
            enable_cross_partition_query=True
        ))
        
        if not conversations:
            return func.HttpResponse(
                body=json.dumps({"error": "Conversation not found"}),
                mimetype="application/json",
                status_code=404
            )
        
        conversation = conversations[0]
        
        # Check if the sender is a participant in the conversation
        if sender_id not in conversation['participants']:
            return func.HttpResponse(
                body=json.dumps({"error": "Sender is not a participant in this conversation"}),
                mimetype="application/json",
                status_code=403
            )
        
        # Identify the receiver (the other participant)
        receiver_id = next((p for p in conversation['participants'] if p != sender_id), None)
        
        if not receiver_id:
            return func.HttpResponse(
                body=json.dumps({"error": "Could not identify receiver"}),
                mimetype="application/json",
                status_code=400
            )
        
        # Add the message to the messages container
        messages_container = get_container("marketplace-messages")
        
        message_id = str(uuid.uuid4())
        current_time = datetime.utcnow().isoformat()
        
        message = {
            "id": message_id,
            "conversationId": chat_id,
            "senderId": sender_id,
            "text": message_text,
            "timestamp": current_time,
            "status": {
                "delivered": True,
                "read": False,
                "readAt": None
            }
        }
        
        messages_container.create_item(body=message)
        
        # Update the conversation with the last message info
        conversation['lastMessage'] = {
            'text': message_text,
            'senderId': sender_id,
            'timestamp': current_time
        }
        conversation['lastMessageAt'] = current_time
        
        # Increment unread count for the receiver
        if 'unreadCounts' not in conversation:
            conversation['unreadCounts'] = {}
        
        conversation['unreadCounts'][receiver_id] = conversation['unreadCounts'].get(receiver_id, 0) + 1
        
        # Update the conversation
        conversations_container.replace_item(item=conversation['id'], body=conversation)
        
        # If this is a plant listing, update the message count
        if 'plantId' in conversation:
            try:
                plants_container = get_container("marketplace-plants")
                
                plant_query = "SELECT * FROM c WHERE c.id = @id"
                plant_params = [{"name": "@id", "value": conversation['plantId']}]
                
                plants = list(plants_container.query_items(
                    query=plant_query,
                    parameters=plant_params,
                    enable_cross_partition_query=True
                ))
                
                if plants:
                    plant = plants[0]
                    
                    if 'stats' not in plant:
                        plant['stats'] = {}
                    
                    plant['stats']['messageCount'] = plant['stats'].get('messageCount', 0) + 1
                    
                    plants_container.replace_item(item=plant['id'], body=plant)
            except Exception as e:
                logging.warning(f"Failed to update plant message count: {str(e)}")
        
        return func.HttpResponse(
            body=json.dumps({
                "success": True,
                "messageId": message_id,
                "timestamp": current_time,
                "sender": sender_id
            }, default=str),
            mimetype="application/json",
            status_code=201
        )
    
    except Exception as e:
        logging.error(f"Error sending message: {str(e)}")
        return func.HttpResponse(
            body=json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )