# create-chat/__init__.py - UPDATED VERSION
import logging
import json
import azure.functions as func
from db_helpers import get_container, get_marketplace_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
import uuid
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for creating chat room processed a request.')
    
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        request_body = req.get_json()
        
        if not request_body:
            return create_error_response("Request body is required", 400)
        
        sender_id = request_body.get('sender')
        receiver_id = request_body.get('receiver')
        plant_id = request_body.get('plantId')
        initial_message = request_body.get('message')
        receiver_type = request_body.get('receiverType', 'individual')  # NEW: individual or business
        
        if not all([sender_id, receiver_id, initial_message]):
            return create_error_response("Sender, receiver, and initial message are required", 400)
        
        # Access containers
        conversations_container = get_container("marketplace-conversations")
        messages_container = get_container("marketplace-messages")
        
        # Create conversation key
        participant_ids = sorted([sender_id, receiver_id])
        participants_key = "|".join(participant_ids)
        
        # Check for existing conversation
        query = "SELECT * FROM c WHERE c.participantsKey = @participantsKey"
        parameters = [{"name": "@participantsKey", "value": participants_key}]
        
        if plant_id:
            query += " AND c.plantId = @plantId"
            parameters.append({"name": "@plantId", "value": plant_id})
        else:
            query += " AND (NOT IS_DEFINED(c.plantId) OR c.plantId = null)"
        
        existing_conversations = list(conversations_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        conversation_id = None
        is_new_conversation = False
        
        if existing_conversations:
            # Update existing conversation
            conversation = existing_conversations[0]
            conversation_id = conversation['id']
            
            conversation['lastMessage'] = {
                'text': initial_message,
                'senderId': sender_id,
                'timestamp': datetime.utcnow().isoformat()
            }
            conversation['lastMessageAt'] = datetime.utcnow().isoformat()
            
            if 'unreadCounts' not in conversation:
                conversation['unreadCounts'] = {}
            
            conversation['unreadCounts'][receiver_id] = conversation['unreadCounts'].get(receiver_id, 0) + 1
            
            # Update conversation
            conversations_container.replace_item(
                item=conversation_id,
                body=conversation,
                partition_key=conversation_id
            )
        else:
            # Create new conversation
            conversation_id = str(uuid.uuid4())
            current_time = datetime.utcnow().isoformat()
            
            new_conversation = {
                "id": conversation_id,
                "participants": [sender_id, receiver_id],
                "participantsKey": participants_key,
                "participantTypes": {  # NEW: Track participant types
                    sender_id: "individual",
                    receiver_id: receiver_type
                },
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
            
            conversations_container.create_item(
                body=new_conversation,
                partition_key=conversation_id
            )
            is_new_conversation = True
        
        # Add message
        message_id = str(uuid.uuid4())
        message = {
            "id": message_id,
            "conversationId": conversation_id,
            "senderId": sender_id,
            "text": initial_message,
            "timestamp": datetime.utcnow().isoformat(),
            "status": {
                "delivered": True,
                "read": False,
                "readAt": None
            }
        }
        
        messages_container.create_item(body=message)
        
        # Get receiver info based on type
        receiver_name = "User"
        if receiver_type == "business":
            business_container = get_marketplace_container("business_users")
            business_query = "SELECT c.businessName FROM c WHERE c.id = @id"
            business_params = [{"name": "@id", "value": receiver_id}]
            
            businesses = list(business_container.query_items(
                query=business_query,
                parameters=business_params,
                enable_cross_partition_query=True
            ))
            
            if businesses:
                receiver_name = businesses[0].get('businessName', 'Business')
        else:
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
                receiver_name = users[0].get('name', 'User')
        
        # Get plant info if applicable
        plant_name = None
        if plant_id:
            # Check if it's a business inventory item
            if plant_id.startswith("business_"):
                inventory_id = plant_id.replace("business_", "")
                inventory_container = get_marketplace_container("inventory")
                
                inventory_query = "SELECT c.name, c.common_name FROM c WHERE c.id = @id"
                inventory_params = [{"name": "@id", "value": inventory_id}]
                
                items = list(inventory_container.query_items(
                    query=inventory_query,
                    parameters=inventory_params,
                    enable_cross_partition_query=True
                ))
                
                if items:
                    plant_name = items[0].get('name') or items[0].get('common_name')
            else:
                plants_container = get_container("marketplace-plants")
                plant_query = "SELECT c.title FROM c WHERE c.id = @id"
                plant_params = [{"name": "@id", "value": plant_id}]
                
                plants = list(plants_container.query_items(
                    query=plant_query,
                    parameters=plant_params,
                    enable_cross_partition_query=True
                ))
                
                if plants:
                    plant_name = plants[0].get('title')
        
        return create_success_response({
            "success": True,
            "messageId": conversation_id,
            "isNewConversation": is_new_conversation,
            "sellerName": receiver_name,
            "sellerType": receiver_type,
            "plantName": plant_name
        })
    
    except Exception as e:
        logging.error(f"Error creating chat room: {str(e)}")
        return create_error_response(str(e), 500)