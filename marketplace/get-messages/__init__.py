# backend/marketplace/get-messages/__init__.py
import logging
import json
import azure.functions as func
from ..db_client import get_container
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for getting messages processed a request.')
    
    try:
        # Get chat ID from route parameters
        chat_id = req.route_params.get('chatId')
        
        if not chat_id:
            return func.HttpResponse(
                body=json.dumps({"error": "Chat ID is required"}),
                mimetype="application/json",
                status_code=400
            )
        
        # Get user ID to mark messages as read
        user_id = req.params.get('userId') 
        
        if not user_id:
            return func.HttpResponse(
                body=json.dumps({"error": "User ID is required"}),
                mimetype="application/json",
                status_code=400
            )
        
        # Get pagination parameters
        before = req.params.get('before')  # Timestamp for pagination
        limit = int(req.params.get('limit', 50))
        
        # Access the marketplace-messages container
        messages_container = get_container("marketplace-messages")
        
        # Build the query
        query_parts = ["SELECT * FROM c WHERE c.conversationId = @chatId"]
        parameters = [{"name": "@chatId", "value": chat_id}]
        
        if before:
            query_parts.append("AND c.timestamp < @before")
            parameters.append({"name": "@before", "value": before})
        
        # Add ordering
        query_parts.append("ORDER BY c.timestamp DESC")
        
        # Combine query
        query = " ".join(query_parts)
        
        # Execute query with pagination
        messages = list(messages_container.query_items(
            query=query,
            parameters=parameters,
            max_item_count=limit,
            enable_cross_partition_query=True
        ))
        
        # Check if user is participant in this conversation
        conversations_container = get_container("marketplace-conversations")
        
        participant_query = "SELECT * FROM c WHERE c.id = @id AND ARRAY_CONTAINS(c.participants, @userId)"
        participant_params = [
            {"name": "@id", "value": chat_id},
            {"name": "@userId", "value": user_id}
        ]
        
        conversation = list(conversations_container.query_items(
            query=participant_query,
            parameters=participant_params,
            enable_cross_partition_query=True
        ))
        
        if not conversation:
            return func.HttpResponse(
                body=json.dumps({"error": "User is not a participant in this conversation"}),
                mimetype="application/json",
                status_code=403
            )
        
        # Format the response
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                "id": msg.get('id'),
                "senderId": msg.get('senderId'),
                "text": msg.get('text'),
                "timestamp": msg.get('timestamp'),
                "status": msg.get('status', {})
            })
        
        # Sort by timestamp (oldest first)
        formatted_messages.sort(key=lambda m: m.get('timestamp', ''))
        
        # If this is the current user, mark messages as read
        try:
            conversation = conversation[0]
            
            # Reset unread count for this user
            if 'unreadCounts' in conversation and user_id in conversation['unreadCounts']:
                conversation['unreadCounts'][user_id] = 0
                
                # Update the conversation
                conversations_container.replace_item(item=conversation['id'], body=conversation)
            
            # Mark messages from other users as read
            other_user_id = next((p for p in conversation['participants'] if p != user_id), None)
            
            if other_user_id:
                unread_query = """
                SELECT * FROM c 
                WHERE c.conversationId = @chatId 
                AND c.senderId = @otherUserId 
                AND (NOT IS_DEFINED(c.status.read) OR c.status.read = false)
                """
                unread_params = [
                    {"name": "@chatId", "value": chat_id},
                    {"name": "@otherUserId", "value": other_user_id}
                ]
                
                unread_messages = list(messages_container.query_items(
                    query=unread_query,
                    parameters=unread_params,
                    enable_cross_partition_query=True
                ))
                
                current_time = datetime.utcnow().isoformat()
                
                for msg in unread_messages:
                    if 'status' not in msg:
                        msg['status'] = {}
                    
                    msg['status']['read'] = True
                    msg['status']['readAt'] = current_time
                    
                    # Update the message
                    messages_container.replace_item(item=msg['id'], body=msg)
        except Exception as e:
            logging.warning(f"Failed to mark messages as read: {str(e)}")
        
        return func.HttpResponse(
            body=json.dumps({
                "messages": formatted_messages,
                "conversation": {
                    "id": chat_id,
                    "participants": conversation.get('participants', [])
                }
            }, default=str),
            mimetype="application/json",
            status_code=200
        )
    
    except Exception as e:
        logging.error(f"Error getting messages: {str(e)}")
        return func.HttpResponse(
            body=json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )