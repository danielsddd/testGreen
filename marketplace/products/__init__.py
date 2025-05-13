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
        page = int(req.params.get('page', 1))
        page_size = int(req.params.get('pageSize', 20))
        
        # Access the marketplace_plants container
        container = get_container("marketplace_plants")
        
        # Build the query
        query_parts = ["SELECT * FROM c WHERE 1=1"]
        parameters = []
        
        # Add filters
        if category and category.lower() != 'all':
            query_parts.append("AND LOWER(c.category) = @category")
            parameters.append({"name": "@category", "value": category.lower()})
        
        if search:
            query_parts.append("AND (CONTAINS(LOWER(c.title), @search) OR CONTAINS(LOWER(c.description), @search))")
            parameters.append({"name": "@search", "value": search.lower()})
        
        if min_price:
            query_parts.append("AND c.price >= @minPrice")
            parameters.append({"name": "@minPrice", "value": float(min_price)})
        
        if max_price:
            query_parts.append("AND c.price <= @maxPrice")
            parameters.append({"name": "@maxPrice", "value": float(max_price)})
        
        # Add sorting
        query_parts.append("ORDER BY c.addedAt DESC")
        
        # Combine query
        query = " ".join(query_parts)
        
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
        
        # Format response
        response = {
            "products": page_items,
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