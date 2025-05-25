# marketplace-products/__init__.py - UPDATED VERSION
import logging
import json
import azure.functions as func
from db_helpers import get_container, get_marketplace_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for marketplace products processed a request.')
    
    if req.method == 'OPTIONS':
        return handle_options_request()
    
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
        user_id = req.params.get('userId')
        
        # NEW: Product source filter (all, individual, business)
        product_source = req.params.get('productSource', 'all')
        
        # Access containers
        plants_container = get_container("marketplace-plants")
        inventory_container = get_marketplace_container("inventory")
        users_container = get_marketplace_container("users")
        business_users_container = get_marketplace_container("business_users")
        
        all_products = []
        
        # Fetch individual products if needed
        if product_source in ['all', 'individual']:
            # Build query for individual products
            query_parts = ["SELECT * FROM c WHERE 1=1"]
            parameters = []
            param_index = 0
            
            def get_param_name():
                nonlocal param_index
                param_name = f"@p{param_index}"
                param_index += 1
                return param_name
            
            # Add filters
            if category and category.lower() != 'all':
                param_name = get_param_name()
                query_parts.append(f"AND c.category = {param_name}")
                parameters.append({"name": param_name, "value": category})
            
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
            
            # Only show active listings
            param_name = get_param_name()
            query_parts.append(f"AND (c.status = {param_name} OR (NOT IS_DEFINED(c.status)))")
            parameters.append({"name": param_name, "value": "active"})
            
            # Exclude business listings
            query_parts.append("AND (NOT IS_DEFINED(c.isBusinessListing) OR c.isBusinessListing = false)")
            
            query = " ".join(query_parts)
            
            individual_products = list(plants_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            
            # Add product source identifier
            for product in individual_products:
                product['productSource'] = 'individual'
                product['isBusinessListing'] = False
            
            all_products.extend(individual_products)
        
        # Fetch business inventory if needed
        if product_source in ['all', 'business']:
            # Query active business inventory
            business_query = "SELECT * FROM c WHERE c.status = 'active' AND c.quantity > 0"
            business_params = []
            
            if search:
                business_query += " AND (CONTAINS(LOWER(c.name), @search) OR CONTAINS(LOWER(c.common_name), @search) OR CONTAINS(LOWER(c.description), @search))"
                business_params.append({"name": "@search", "value": search.lower()})
            
            if min_price:
                business_query += " AND c.price >= @minPrice"
                business_params.append({"name": "@minPrice", "value": float(min_price)})
            
            if max_price:
                business_query += " AND c.price <= @maxPrice"
                business_params.append({"name": "@maxPrice", "value": float(max_price)})
            
            business_inventory = list(inventory_container.query_items(
                query=business_query,
                parameters=business_params,
                enable_cross_partition_query=True
            ))
            
            # Transform business inventory to marketplace format
            for item in business_inventory:
                # Get business info
                business_info = None
                try:
                    business_query = "SELECT * FROM c WHERE c.id = @businessId"
                    business_params = [{"name": "@businessId", "value": item['businessId']}]
                    
                    businesses = list(business_users_container.query_items(
                        query=business_query,
                        parameters=business_params,
                        enable_cross_partition_query=True
                    ))
                    
                    if businesses:
                        business_info = businesses[0]
                except Exception as e:
                    logging.warning(f"Error getting business info: {str(e)}")
                
                # Transform to marketplace product format
                marketplace_product = {
                    'id': f"business_{item['id']}",
                    'inventoryId': item['id'],
                    'title': item.get('name') or item.get('common_name', 'Unknown Plant'),
                    'description': item.get('description', ''),
                    'price': item.get('price', 0),
                    'images': item.get('images', []),
                    'image': item.get('mainImage') or (item.get('images', [None])[0] if item.get('images') else None),
                    'category': item.get('category', 'Other'),
                    'sellerId': item['businessId'],
                    'sellerType': 'business',
                    'isBusinessListing': True,
                    'productSource': 'business',
                    'quantity': item.get('quantity', 0),
                    'addedAt': item.get('dateAdded', datetime.utcnow().isoformat()),
                    'status': 'active',
                    'seller': {
                        'id': item['businessId'],
                        '_id': item['businessId'],
                        'name': business_info.get('businessName', 'Business') if business_info else 'Business',
                        'email': business_info.get('email', item['businessId']) if business_info else item['businessId'],
                        'type': 'business',
                        'rating': business_info.get('rating', 0) if business_info else 0,
                        'isVerified': business_info.get('isVerified', False) if business_info else False,
                        'businessInfo': {
                            'businessName': business_info.get('businessName') if business_info else None,
                            'businessType': business_info.get('businessType') if business_info else None,
                            'address': business_info.get('address') if business_info else None,
                            'phone': business_info.get('contactPhone') if business_info else None
                        }
                    },
                    'plantInfo': {
                        'common_name': item.get('common_name'),
                        'scientific_name': item.get('scientificName'),
                        'water_days': item.get('wateringSchedule', {}).get('waterDays'),
                        'light': item.get('plantInfo', {}).get('light'),
                        'temperature': item.get('plantInfo', {}).get('temperature'),
                        'humidity': item.get('plantInfo', {}).get('humidity')
                    }
                }
                
                all_products.append(marketplace_product)
        
        # Sort all products
        sort_field_map = {
            'recent': lambda x: x.get('addedAt', ''),
            'price': lambda x: x.get('price', 0),
            'title': lambda x: x.get('title', '').lower(),
            'addedAt': lambda x: x.get('addedAt', '')
        }
        
        sort_key = sort_field_map.get(sort_by, sort_field_map['addedAt'])
        reverse = sort_order.lower() == 'desc'
        
        all_products.sort(key=sort_key, reverse=reverse)
        
        # Calculate pagination
        total_count = len(all_products)
        total_pages = (total_count + page_size - 1) // page_size
        
        # Slice for current page
        start_idx = (page - 1) * page_size
        end_idx = min(start_idx + page_size, total_count)
        page_products = all_products[start_idx:end_idx]
        
        # Add wishlist status if user is logged in
        if user_id:
            wishlist_container = get_container("marketplace-wishlists")
            wishlist_query = "SELECT * FROM c WHERE c.userId = @userId"
            wishlist_params = [{"name": "@userId", "value": user_id}]
            
            wishlist_items = list(wishlist_container.query_items(
                query=wishlist_query,
                parameters=wishlist_params,
                enable_cross_partition_query=True
            ))
            
            wished_plant_ids = [item['plantId'] for item in wishlist_items]
            
            for product in page_products:
                # Handle both individual and business product IDs
                product_id = product.get('inventoryId') if product.get('isBusinessListing') else product['id']
                product['isWished'] = product_id in wished_plant_ids
        
        # Format response
        response_data = {
            "products": page_products,
            "page": page,
            "pages": total_pages,
            "count": total_count,
            "currentPage": page,
            "filters": {
                "productSource": product_source,
                "availableSources": ["all", "individual", "business"]
            }
        }
        
        return create_success_response(response_data)
    
    except Exception as e:
        logging.error(f"Error retrieving marketplace products: {str(e)}")
        return create_error_response(str(e), 500)