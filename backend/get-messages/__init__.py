# get-messages/__init__.py
import logging
import json
import azure.functions as func
from db_helpers import get_container 
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for getting messages processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get chat ID from route parameters
        chat_id = req.route_params.get('chatId')
        
        if not chat_id:
            return create_error_response("Chat ID is required", 400)
        
        # Get user ID to mark messages as read
        user_id = extract_user_id(req) 
        
        if not user_id:
            return create_error_response("User ID is required", 400)
        
        # Access the marketplace-messages container
        messages_container = get_container("marketplace-messages")
        
        # Build the query
        query = "SELECT * FROM c WHERE c.conversationId = @chatId ORDER BY c.timestamp ASC"
        parameters = [{"name": "@chatId", "value": chat_id}]
        
        # Execute query
        messages = list(messages_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        # Mark messages as read if they are not from the current user
        if user_id:
            try:
                conversations_container = get_container("marketplace-conversations")
                conversation = conversations_container.read_item(item=chat_id, partition_key=chat_id)
                
                # Reset unread count for the current user
                if 'unreadCounts' in conversation and user_id in conversation['unreadCounts']:
                    conversation['unreadCounts'][user_id] = 0
                    conversations_container.replace_item(item=chat_id, body=conversation)

                # Mark messages as read if they are not from the current user
                unread_messages = [msg for msg in messages if msg.get('senderId') != user_id and not msg.get('status', {}).get('read', False)]
                
                for msg in unread_messages:
                    if 'status' not in msg:
                        msg['status'] = {}
                    
                    msg['status']['read'] = True
                    msg['status']['readAt'] = datetime.utcnow().isoformat()
                    
                    messages_container.replace_item(item=msg['id'], body=msg)
            except Exception as e:
                logging.warning(f"Error marking messages as read: {str(e)}")
                # Continue even if marking as read fails
        
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
        
        # Return success response
        return create_success_response({
            "messages": formatted_messages,
            "conversation": {
                "id": chat_id
            }
        })
    
    except Exception as e:
        logging.error(f"Error getting messages: {str(e)}")
        return create_error_response(str(e), 500)