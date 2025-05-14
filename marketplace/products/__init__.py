# backend/marketplace/products/__init__.py
import logging
import json
import azure.functions as func
from ..db_client import get_container
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for marketplace products processed a request.')
    
    try:
        # Get query parameters
        category = req.params.get('category')
        search = req.params.get('search')
        min_price = req.params.get('minPrice')
        max_price = req.params.get('maxPrice')
        sort_by = req.params.get('sortBy', 'addedAt')
        sort_order = req.params.get('sortOrder', 'desc')
        page = int(req.params.get('page', 1))
        page_size = int(req.params.get('pageSize', 20))
        user_id = req.params.get('userId')  # For wishlist status
        
        # Access the marketplace-plants container
        container = get_container("marketplace-plants")
        
        # Build the query
        query_parts = ["SELECT * FROM c WHERE 1=1"]
        parameters = []
        param_index = 0
        
        # Function to get the next parameter name
        def get_param_name():
            nonlocal param_index
            param_name = f"@p{param_index}"
            param_index += 1
            return param_name
        
        # Add filters
        if category and category.lower() != 'all':
            param_name = get_param_name()
            query_parts.append(f"AND LOWER(c.category) = {param_name}")
            parameters.append({"name": param_name, "value": category.lower()})
        
        if search:
            param_name = get_param_name()
            query_parts.append(f"AND (CONTAINS(LOWER(c.title), {param_name}) OR CONTAINS(LOWER(c.description), {param_name}))")
            parameters.append({"name": param_name, "value": search.lower()})
        
        if min_price:
            param_name = get_param_name()
            query_parts.append(f"AND c.price >= {param_name}")
            parameters.append({"name": param_name, "value": float(min_price)})
        
        if max_price:
            param_name = get_param_name()
            query_parts.append(f"AND c.price <= {param_name}")
            parameters.append({"name": param_name, "value": float(max_price)})
        
        # Only show active listings by default
        param_name = get_param_name()
        query_parts.append(f"AND (c.status = {param_name} OR c.status IS NULL)")
        parameters.append({"name": param_name, "value": "active"})
        
        # Determine sort field
        sort_field_map = {
            'recent': 'c.addedAt',
            'price': 'c.price',
            'rating': 'c.seller.rating',
            'title': 'c.title',
            'addedAt': 'c.addedAt'
        }
        sort_field = sort_field_map.get(sort_by, 'c.addedAt')
        
        # Add sorting
        sort_direction = "DESC" if sort_order.lower() == 'desc' else "ASC"
        query_parts.append(f"ORDER BY {sort_field} {sort_direction}")
        
        # Combine query
        query = " ".join(query_parts)
        
        logging.info(f"Query: {query}")
        logging.info(f"Parameters: {parameters}")
        
        # Execute query
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        # Calculate pagination
        total_count = len(items)
        total_pages = (total_count + page_size - 1) // page_size
        
        # Slice the results for the requested page
        start_idx = (page - 1) * page_size
        end_idx = min(start_idx + page_size, total_count)
        page_items = items[start_idx:end_idx]
        
        # Enrich with seller and wishlist info
        enriched_items = enrich_plant_items(page_items, user_id)
        
        # Format response
        response = {
            "products": enriched_items,
            "page": page,
            "pages": total_pages,
            "count": total_count,
            "currentPage": page
        }
        
        return func.HttpResponse(
            body=json.dumps(response, default=str),
            mimetype="application/json",
            status_code=200
        )
    
    except Exception as e:
        logging.error(f"Error retrieving marketplace products: {str(e)}")
        return func.HttpResponse(
            body=json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )

def enrich_plant_items(items, user_id=None):
    """
    Enrich plant items with seller info and wishlist status
    
    Args:
        items: List of plant items
        user_id: Optional user ID to check wishlist status
        
    Returns:
        List of enriched plant items
    """
    try:
        # Get seller IDs from items
        seller_ids = list(set(item.get('sellerId') for item in items if 'sellerId' in item))
        
        # Get seller info for all items at once
        seller_info = {}
        if seller_ids:
            try:
                users_container = get_container("users")
                
                for seller_id in seller_ids:
                    query = "SELECT c.id, c.email, c.name, c.avatar, c.stats.rating FROM c WHERE c.id = @id OR c.email = @email"
                    parameters = [
                        {"name": "@id", "value": seller_id},
                        {"name": "@email", "value": seller_id}
                    ]
                    
                    sellers = list(users_container.query_items(
                        query=query,
                        parameters=parameters,
                        enable_cross_partition_query=True
                    ))
                    
                    if sellers:
                        seller_info[seller_id] = sellers[0]
            except Exception as e:
                logging.warning(f"Error fetching seller information: {str(e)}")
        
        # Get wishlist status if user_id provided
        wishlist_status = {}
        if user_id:
            try:
                wishlist_container = get_container("marketplace-wishlists")
                
                # Get all wishlist items for the user
                query = "SELECT c.plantId FROM c WHERE c.userId = @userId"
                parameters = [{"name": "@userId", "value": user_id}]
                
                wishlist_items = list(wishlist_container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ))
                
                # Create a set of plant IDs in wishlist for faster lookup
                wishlist_plant_ids = set(item['plantId'] for item in wishlist_items)
                
                # Set wishlist status for each plant ID
                for plant_id in wishlist_plant_ids:
                    wishlist_status[plant_id] = True
            except Exception as e:
                logging.warning(f"Error fetching wishlist status: {str(e)}")
        
        # Enrich items with seller info and wishlist status
        for item in items:
            # Add seller info
            seller_id = item.get('sellerId')
            if seller_id and seller_id in seller_info:
                seller = seller_info[seller_id]
                item['seller'] = {
                    'name': seller.get('name', 'User'),
                    '_id': seller.get('id') or seller.get('email'),
                    'avatar': seller.get('avatar')
                }
                
                # Add rating if available
                if 'stats' in seller and 'rating' in seller['stats']:
                    item['rating'] = seller['stats']['rating']
            
            # Add wishlist status
            item_id = item.get('id')
            if item_id in wishlist_status:
                item['isFavorite'] = wishlist_status[item_id]
            else:
                item['isFavorite'] = False
            
            # Ensure there's at least one image URL
            if 'images' not in item or not item['images']:
                item['image'] = None
            else:
                if isinstance(item['images'], list) and len(item['images']) > 0:
                    item['image'] = item['images'][0]
                    
            # Ensure city is available
            if 'location' in item and isinstance(item['location'], dict):
                if 'city' in item['location']:
                    item['city'] = item['location']['city']
            
            # Ensure category is set
            if 'category' not in item:
                item['category'] = "Other"
                
            # Map addedAt to listedDate if needed
            if 'addedAt' in item and 'listedDate' not in item:
                item['listedDate'] = item['addedAt']
                
            # Ensure title exists
            if 'title' not in item and 'name' in item:
                item['title'] = item['name']
                
        return items
    except Exception as e:
        logging.error(f"Error enriching plant items: {str(e)}")
        return items