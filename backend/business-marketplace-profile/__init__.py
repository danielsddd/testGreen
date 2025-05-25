# business-marketplace-profile/__init__.py
import logging
import json
import azure.functions as func
from db_helpers import get_marketplace_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business marketplace profile API triggered.')
    
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        business_id = req.route_params.get('businessId')
        
        if not business_id:
            return create_error_response("Business ID is required", 400)
        
        # Access containers
        business_container = get_marketplace_container("business_users")
        inventory_container = get_marketplace_container("inventory")
        reviews_container = get_marketplace_container("marketplace-reviews")
        
        # Get business info
        business_query = "SELECT * FROM c WHERE c.id = @businessId"
        business_params = [{"name": "@businessId", "value": business_id}]
        
        businesses = list(business_container.query_items(
            query=business_query,
            parameters=business_params,
            enable_cross_partition_query=True
        ))
        
        if not businesses:
            return create_error_response("Business not found", 404)
        
        business = businesses[0]
        
        # Get active inventory count
        inventory_query = "SELECT VALUE COUNT(1) FROM c WHERE c.businessId = @businessId AND c.status = 'active' AND c.quantity > 0"
        inventory_params = [{"name": "@businessId", "value": business_id}]
        
        inventory_count = list(inventory_container.query_items(
            query=inventory_query,
            parameters=inventory_params,
            enable_cross_partition_query=True
        ))
        
        # Get business reviews
        reviews_query = "SELECT * FROM c WHERE c.targetId = @businessId AND c.targetType = 'business'"
        reviews_params = [{"name": "@businessId", "value": business_id}]
        
        reviews = list(reviews_container.query_items(
            query=reviews_query,
            parameters=reviews_params,
            enable_cross_partition_query=True
        ))
        
        # Calculate rating
        total_rating = sum(r.get('rating', 0) for r in reviews)
        avg_rating = total_rating / len(reviews) if reviews else 0
        
        # Get active listings for display
        listings_query = "SELECT * FROM c WHERE c.businessId = @businessId AND c.status = 'active' AND c.quantity > 0"
        listings_params = [{"name": "@businessId", "value": business_id}]
        listings = list(inventory_container.query_items(
            query=listings_query,
            parameters=listings_params,
            enable_cross_partition_query=True
        ))
        
        # Transform listings to marketplace format
        marketplace_listings = []
        for item in listings[:10]:  # Limit to 10 for profile display
            marketplace_listings.append({
                'id': f"business_{item['id']}",
                'inventoryId': item['id'],
                'title': item.get('name') or item.get('common_name', 'Unknown Plant'),
                'price': item.get('price', 0),
                'image': item.get('mainImage') or (item.get('images', [None])[0] if item.get('images') else None),
                'quantity': item.get('quantity', 0),
                'isBusinessListing': True
            })
        
        # Build response
        profile_data = {
            "id": business['id'],
            "businessName": business.get('businessName', 'Business'),
            "businessType": business.get('businessType', 'Plant Store'),
            "description": business.get('description', ''),
            "logo": business.get('logo'),
            "email": business.get('email'),
            "phone": business.get('contactPhone'),
            "address": business.get('address'),
            "businessHours": business.get('businessHours', []),
            "socialMedia": business.get('socialMedia', {}),
            "joinDate": business.get('joinDate'),
            "isVerified": business.get('isVerified', False),
            "sellerType": "business",
            "stats": {
                "plantsCount": inventory_count[0] if inventory_count else 0,
                "salesCount": business.get('stats', {}).get('salesCount', 0),
                "rating": avg_rating,
                "reviewCount": len(reviews)
            },
            "listings": marketplace_listings,
            "favorites": []  # Businesses don't have favorites
        }
        
        if req.method == 'PATCH':
            # Update business profile
            try:
                update_data = req.get_json()
                
                # Fields that can be updated
                updatable_fields = [
                    'description', 'logo', 'contactPhone', 
                    'address', 'businessHours', 'socialMedia'
                ]
                
                for field in updatable_fields:
                    if field in update_data:
                        business[field] = update_data[field]
                
                business['updatedAt'] = datetime.utcnow().isoformat()
                
                business_container.replace_item(
                    item=business['id'],
                    body=business
                )
                
                return create_success_response({
                    "message": "Business profile updated successfully",
                    "business": profile_data
                })
                
            except Exception as e:
                logging.error(f"Error updating business profile: {str(e)}")
                return create_error_response(str(e), 500)
        
        return create_success_response({"business": profile_data})
    
    except Exception as e:
        logging.error(f"Error in business marketplace profile: {str(e)}")
        return create_error_response(str(e), 500)