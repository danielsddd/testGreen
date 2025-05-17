import logging
import json
import azure.functions as func
import math
import traceback
import datetime  # For timestamp in geocoding cache
import requests  # For geocoding API calls
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response, extract_user_id

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function for nearby products processed a request.')
    
    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Get query parameters
        lat = req.params.get('lat')
        lon = req.params.get('lon')
        radius = req.params.get('radius', '10')  # Default radius is 10 km
        category = req.params.get('category')
        sort_by = req.params.get('sortBy', 'distance')  # Default sort by distance
        
        # Validate coordinates
        if not lat or not lon:
            return create_error_response("Latitude and longitude are required", 400)
        
        try:
            lat = float(lat)
            lon = float(lon)
            radius = float(radius)
        except ValueError:
            return create_error_response("Invalid coordinate or radius format", 400)
        
        # Add some debug info
        logging.info(f"Search parameters: lat={lat}, lon={lon}, radius={radius}, category={category}, sortBy={sort_by}")
        
        # Access the marketplace_plants container
        container_name = "marketplace-plants"
        try:
            container = get_container(container_name)
            logging.info(f"Successfully connected to container: {container_name}")
        except Exception as e:
            logging.error(f"Error connecting to container {container_name}: {str(e)}")
            return create_error_response(f"Database error: {str(e)}", 500)
        
        # Get all products with active status
        query = "SELECT * FROM c WHERE c.status = 'active' OR NOT IS_DEFINED(c.status)"
        
        # Add category filter if provided
        if category and category.lower() != 'all':
            query += " AND c.category = @category"
            parameters = [{"name": "@category", "value": category.lower()}]
        else:
            parameters = []
        
        # Execute the query with debugging
        try:
            products = list(container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            logging.info(f"Found {len(products)} products in total")
        except Exception as e:
            logging.error(f"Query error: {str(e)}")
            logging.error(f"Query: {query}")
            logging.error(f"Parameters: {parameters}")
            return create_error_response(f"Query error: {str(e)}", 500)
        
        # Filter products by distance if they have location data
        nearby_products = []
        products_without_location = []
        products_with_incomplete_location = []
        
        for product in products:
            # Skip products with status=deleted
            if product.get('status') == 'deleted':
                continue
                
            # Normalize location data structure
            if 'location' not in product or not product['location']:
                if 'city' in product and product['city']:
                    # Create a location object if only city exists
                    try:
                        # Call geocode service to get coordinates for the city
                        from db_helpers import get_container
                        import requests
                        
                        # Try to use a cached geocode result first
                        city_cache_query = "SELECT * FROM c WHERE c.type = 'geocache' AND c.address = @address"
                        city_cache_params = [{"name": "@address", "value": product['city']}]
                        
                        try:
                            cache_container = get_container("marketplace-cache")
                            cached_results = list(cache_container.query_items(
                                query=city_cache_query,
                                parameters=city_cache_params,
                                enable_cross_partition_query=True
                            ))
                            
                            if cached_results:
                                cache_item = cached_results[0]
                                product['location'] = {
                                    'latitude': cache_item['latitude'],
                                    'longitude': cache_item['longitude'],
                                    'city': product['city']
                                }
                                logging.info(f"Using cached geocode for {product['city']}")
                            else:
                                # No cache, call geocode service
                                geocode_url = f"https://usersfunctions.azurewebsites.net/api/marketplace/geocode?address={product['city']}"
                                geocode_response = requests.get(geocode_url)
                                
                                if geocode_response.status_code == 200:
                                    location_data = geocode_response.json()
                                    product['location'] = {
                                        'latitude': location_data['latitude'],
                                        'longitude': location_data['longitude'],
                                        'city': product['city']
                                    }
                                    
                                    # Cache this result for future use
                                    try:
                                        import uuid
                                        cache_item = {
                                            'id': str(uuid.uuid4()),
                                            'type': 'geocache',
                                            'address': product['city'],
                                            'latitude': location_data['latitude'],
                                            'longitude': location_data['longitude'],
                                            'timestamp': datetime.datetime.utcnow().isoformat()
                                        }
                                        cache_container.create_item(body=cache_item)
                                        logging.info(f"Cached geocode for {product['city']}")
                                    except Exception as cache_err:
                                        logging.warn(f"Failed to cache geocode: {str(cache_err)}")
                                else:
                                    products_without_location.append(product['id'])
                                    continue
                        except Exception as location_err:
                            logging.warn(f"Error handling location: {str(location_err)}")
                            products_without_location.append(product['id'])
                            continue
                    except Exception as geocode_err:
                        logging.warn(f"Failed to geocode city: {str(geocode_err)}")
                        products_without_location.append(product['id'])
                        continue
                else:
                    products_without_location.append(product['id'])
                    continue
            
            # Handle different location formats
            location = product['location']
            
            if isinstance(location, str):
                # If location is a string (e.g. "New York"), try to geocode it
                products_with_incomplete_location.append(product['id'])
                continue
                
            # Expected standard format: location.latitude and location.longitude 
            try:
                product_lat = float(location.get('latitude'))
                product_lon = float(location.get('longitude'))
            except (ValueError, TypeError, AttributeError):
                products_with_incomplete_location.append(product['id'])
                continue
                
            # Calculate distance using Haversine formula
            distance = calculate_distance(lat, lon, product_lat, product_lon)
            
            # Include product if within radius
            if distance <= radius:
                # Add distance to product
                product['distance'] = round(distance, 2)
                nearby_products.append(product)
        
        logging.info(f"Found {len(nearby_products)} nearby products within {radius}km")
        logging.info(f"{len(products_without_location)} products had no location data")
        logging.info(f"{len(products_with_incomplete_location)} products had incomplete location data")
        
        # Sort by distance if requested
        if sort_by == 'distance':
            nearby_products.sort(key=lambda p: p.get('distance', float('inf')))
        elif sort_by == 'distance_desc':
            nearby_products.sort(key=lambda p: p.get('distance', 0), reverse=True)
        
        # Return the nearby products
        return create_success_response({
            "products": nearby_products,
            "count": len(nearby_products),
            "center": {
                "latitude": lat,
                "longitude": lon
            },
            "radius": radius
        })
    
    except Exception as e:
        logging.error(f"Error finding nearby products: {str(e)}")
        logging.error(traceback.format_exc())
        return create_error_response(str(e), 500)