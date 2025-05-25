import azure.functions as func
import json
import logging
import os
from datetime import datetime, timedelta
from azure.cosmos import CosmosClient, exceptions
from typing import Dict, Any, List

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Business reports function processed a request.')
    
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email, X-Business-ID',
        'Content-Type': 'application/json'
    }
    
    # Handle preflight OPTIONS request
    if req.method == 'OPTIONS':
        return func.HttpResponse('', status_code=200, headers=headers)
    
    try:
        # Initialize Cosmos DB client
        cosmos_connection = os.environ.get('COSMOSDB__MARKETPLACE_CONNECTION_STRING')
        if not cosmos_connection:
            raise ValueError("COSMOSDB__MARKETPLACE_CONNECTION_STRING not found")
        
        # Parse connection string
        connection_parts = cosmos_connection.split(';')
        endpoint = next(part.replace('AccountEndpoint=', '') for part in connection_parts if 'AccountEndpoint' in part)
        key = next(part.replace('AccountKey=', '') for part in connection_parts if 'AccountKey' in part)
        
        client = CosmosClient(endpoint, key)
        database_name = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'greener-marketplace-db')
        database = client.get_database_client(database_name)
        
        # Get parameters
        business_id = req.headers.get('x-business-id') or req.headers.get('x-user-email')
        report_type = req.params.get('type', 'summary')  # sales, inventory, customers, summary
        start_date = req.params.get('startDate')
        end_date = req.params.get('endDate')
        format_type = req.params.get('format', 'json')
        
        if not business_id:
            return func.HttpResponse(
                json.dumps({'error': 'Business ID is required'}),
                status_code=400,
                headers=headers
            )
        
        # Parse dates
        if start_date:
            start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        else:
            start_date = datetime.utcnow() - timedelta(days=30)
            
        if end_date:
            end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        else:
            end_date = datetime.utcnow()
        
        # Generate report based on type
        if report_type == 'sales':
            report_data = generate_sales_report(database, business_id, start_date, end_date)
        elif report_type == 'inventory':
            report_data = generate_inventory_report(database, business_id, start_date, end_date)
        elif report_type == 'customers':
            report_data = generate_customers_report(database, business_id, start_date, end_date)
        else:  # summary
            report_data = generate_summary_report(database, business_id, start_date, end_date)
        
        response_data = {
            'success': True,
            'report': report_data,
            'metadata': {
                'businessId': business_id,
                'reportType': report_type,
                'startDate': start_date.isoformat(),
                'endDate': end_date.isoformat(),
                'generatedAt': datetime.utcnow().isoformat(),
                'format': format_type
            }
        }
        
        return func.HttpResponse(
            json.dumps(response_data, default=str),
            status_code=200,
            headers=headers
        )
        
    except Exception as e:
        logging.error(f'Business reports error: {str(e)}')
        return func.HttpResponse(
            json.dumps({'error': f'Report generation error: {str(e)}'}),
            status_code=500,
            headers=headers
        )

def generate_sales_report(database, business_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    """Generate detailed sales report"""
    try:
        orders_container = database.get_container_client('orders')
        
        # Query for all orders in date range
        query = """
        SELECT * FROM c 
        WHERE c.businessId = @business_id 
        AND c.orderDate >= @start_date 
        AND c.orderDate <= @end_date
        """
        
        orders = list(orders_container.query_items(
            query=query,
            parameters=[
                {'name': '@business_id', 'value': business_id},
                {'name': '@start_date', 'value': start_date.isoformat()},
                {'name': '@end_date', 'value': end_date.isoformat()}
            ],
            enable_cross_partition_query=True
        ))
        
        # Calculate sales metrics
        total_orders = len(orders)
        completed_orders = [o for o in orders if o.get('status') == 'completed']
        total_revenue = sum(order.get('total', 0) for order in completed_orders)
        average_order_value = total_revenue / len(completed_orders) if completed_orders else 0
        
        # Daily sales breakdown
        daily_sales = {}
        for order in completed_orders:
            order_date = datetime.fromisoformat(order['orderDate'].replace('Z', '+00:00')).date()
            day_str = order_date.isoformat()
            
            if day_str not in daily_sales:
                daily_sales[day_str] = {'orders': 0, 'revenue': 0}
            
            daily_sales[day_str]['orders'] += 1
            daily_sales[day_str]['revenue'] += order.get('total', 0)
        
        # Top selling products
        product_sales = {}
        for order in completed_orders:
            for item in order.get('items', []):
                product_id = item.get('productId', item.get('id', 'unknown'))
                product_name = item.get('name', 'Unknown Product')
                quantity = item.get('quantity', 0)
                revenue = item.get('price', 0) * quantity
                
                if product_id not in product_sales:
                    product_sales[product_id] = {
                        'name': product_name,
                        'totalSold': 0,
                        'totalRevenue': 0
                    }
                
                product_sales[product_id]['totalSold'] += quantity
                product_sales[product_id]['totalRevenue'] += revenue
        
        # Sort top products by revenue
        top_products = sorted(product_sales.values(), key=lambda x: x['totalRevenue'], reverse=True)[:10]
        
        # Status breakdown
        status_counts = {}
        for order in orders:
            status = order.get('status', 'unknown')
            status_counts[status] = status_counts.get(status, 0) + 1
        
        return {
            'salesReport': {
                'summary': {
                    'totalOrders': total_orders,
                    'completedOrders': len(completed_orders),
                    'totalRevenue': total_revenue,
                    'averageOrderValue': average_order_value,
                    'completionRate': (len(completed_orders) / total_orders * 100) if total_orders > 0 else 0
                },
                'dailySales': daily_sales,
                'topProducts': top_products,
                'statusBreakdown': status_counts
            }
        }
        
    except Exception as e:
        logging.error(f'Sales report error: {str(e)}')
        return {
            'salesReport': {
                'summary': {
                    'totalOrders': 0,
                    'completedOrders': 0,
                    'totalRevenue': 0,
                    'averageOrderValue': 0,
                    'completionRate': 0
                },
                'dailySales': {},
                'topProducts': [],
                'statusBreakdown': {}
            }
        }

def generate_inventory_report(database, business_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    """Generate detailed inventory report"""
    try:
        inventory_container = database.get_container_client('inventory')
        
        # Query all inventory items
        query = "SELECT * FROM c WHERE c.businessId = @business_id"
        inventory_items = list(inventory_container.query_items(
            query=query,
            parameters=[{'name': '@business_id', 'value': business_id}],
            enable_cross_partition_query=True
        ))
        
        # Calculate inventory metrics
        total_items = len(inventory_items)
        active_items = len([item for item in inventory_items if item.get('status') == 'active'])
        sold_out_items = len([item for item in inventory_items if item.get('quantity', 0) == 0])
        low_stock_items = len([
            item for item in inventory_items 
            if 0 < item.get('quantity', 0) <= item.get('minThreshold', 5) and item.get('status') == 'active'
        ])
        
        total_value = sum(
            item.get('price', 0) * item.get('quantity', 0) 
            for item in inventory_items
        )
        
        # Category breakdown
        category_breakdown = {}
        for item in inventory_items:
            category = item.get('category') or item.get('productType', 'Other')
            if category not in category_breakdown:
                category_breakdown[category] = {
                    'count': 0, 
                    'value': 0, 
                    'soldOut': 0, 
                    'lowStock': 0
                }
            
            category_breakdown[category]['count'] += 1
            category_breakdown[category]['value'] += item.get('price', 0) * item.get('quantity', 0)
            
            if item.get('quantity', 0) == 0:
                category_breakdown[category]['soldOut'] += 1
            elif item.get('quantity', 0) <= item.get('minThreshold', 5):
                category_breakdown[category]['lowStock'] += 1
        
        # Status breakdown
        status_breakdown = {
            'active': active_items,
            'soldOut': sold_out_items,
            'lowStock': low_stock_items,
            'inactive': len([item for item in inventory_items if item.get('status') == 'inactive'])
        }
        
        return {
            'inventoryReport': {
                'summary': {
                    'totalItems': total_items,
                    'activeItems': active_items,
                    'soldOutItems': sold_out_items,
                    'lowStockItems': low_stock_items,
                    'totalValue': total_value,
                    'avgItemValue': total_value / total_items if total_items > 0 else 0
                },
                'categoryBreakdown': category_breakdown,
                'statusBreakdown': status_breakdown,
                'itemDetails': inventory_items[:50]  # First 50 items for details
            }
        }
        
    except Exception as e:
        logging.error(f'Inventory report error: {str(e)}')
        return {
            'inventoryReport': {
                'summary': {
                    'totalItems': 0,
                    'activeItems': 0,
                    'soldOutItems': 0,
                    'lowStockItems': 0,
                    'totalValue': 0,
                    'avgItemValue': 0
                },
                'categoryBreakdown': {},
                'statusBreakdown': {},
                'itemDetails': []
            }
        }

def generate_customers_report(database, business_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    """Generate detailed customers report"""
    try:
        customers_container = database.get_container_client('business_customers')
        
        # Query all customers
        query = "SELECT * FROM c WHERE c.businessId = @business_id"
        customers = list(customers_container.query_items(
            query=query,
            parameters=[{'name': '@business_id', 'value': business_id}],
            enable_cross_partition_query=True
        ))
        
        total_customers = len(customers)
        
        # Customer tiers
        customer_tiers = {
            'vip': len([c for c in customers if c.get('totalSpent', 0) >= 500 or c.get('orderCount', 0) >= 10]),
            'premium': len([c for c in customers if c.get('totalSpent', 0) >= 200 or c.get('orderCount', 0) >= 5]),
            'regular': len([c for c in customers if c.get('orderCount', 0) >= 2]),
            'new': len([c for c in customers if c.get('orderCount', 0) < 2])
        }
        
        # Customer activity
        total_spent = sum(c.get('totalSpent', 0) for c in customers)
        total_orders = sum(c.get('orderCount', 0) for c in customers)
        avg_order_value = total_spent / total_orders if total_orders > 0 else 0
        
        # New customers in period
        new_customers = 0
        for customer in customers:
            join_date = customer.get('firstPurchaseDate') or customer.get('joinDate')
            if join_date:
                customer_date = datetime.fromisoformat(join_date.replace('Z', '+00:00'))
                if start_date <= customer_date <= end_date:
                    new_customers += 1
        
        # Top customers by spending
        top_customers = sorted(customers, key=lambda x: x.get('totalSpent', 0), reverse=True)[:10]
        
        return {
            'customersReport': {
                'summary': {
                    'totalCustomers': total_customers,
                    'newCustomers': new_customers,
                    'totalSpent': total_spent,
                    'totalOrders': total_orders,
                    'averageOrderValue': avg_order_value,
                    'averageSpentPerCustomer': total_spent / total_customers if total_customers > 0 else 0
                },
                'customerTiers': customer_tiers,
                'topCustomers': [{
                    'name': c.get('name', 'Unknown'),
                    'email': c.get('email', ''),
                    'totalSpent': c.get('totalSpent', 0),
                    'orderCount': c.get('orderCount', 0)
                } for c in top_customers]
            }
        }
        
    except Exception as e:
        logging.error(f'Customers report error: {str(e)}')
        return {
            'customersReport': {
                'summary': {
                    'totalCustomers': 0,
                    'newCustomers': 0,
                    'totalSpent': 0,
                    'totalOrders': 0,
                    'averageOrderValue': 0,
                    'averageSpentPerCustomer': 0
                },
                'customerTiers': {'vip': 0, 'premium': 0, 'regular': 0, 'new': 0},
                'topCustomers': []
            }
        }

def generate_summary_report(database, business_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    """Generate comprehensive summary report"""
    try:
        # Get all report data
        sales_report = generate_sales_report(database, business_id, start_date, end_date)
        inventory_report = generate_inventory_report(database, business_id, start_date, end_date)
        customers_report = generate_customers_report(database, business_id, start_date, end_date)
        
        # Create summary metrics
        summary = {
            'businessOverview': {
                'totalRevenue': sales_report['salesReport']['summary']['totalRevenue'],
                'totalOrders': sales_report['salesReport']['summary']['totalOrders'],
                'totalCustomers': customers_report['customersReport']['summary']['totalCustomers'],
                'totalInventoryItems': inventory_report['inventoryReport']['summary']['totalItems'],
                'inventoryValue': inventory_report['inventoryReport']['summary']['totalValue'],
                'averageOrderValue': sales_report['salesReport']['summary']['averageOrderValue']
            },
            'keyMetrics': {
                'orderCompletionRate': sales_report['salesReport']['summary']['completionRate'],
                'soldOutItems': inventory_report['inventoryReport']['summary']['soldOutItems'],
                'lowStockItems': inventory_report['inventoryReport']['summary']['lowStockItems'],
                'newCustomers': customers_report['customersReport']['summary']['newCustomers'],
                'customerRetention': 0  # Would need more data to calculate properly
            }
        }
        
        return {
            'summaryReport': summary,
            **sales_report,
            **inventory_report,
            **customers_report
        }
        
    except Exception as e:
        logging.error(f'Summary report error: {str(e)}')
        return {
            'summaryReport': {
                'businessOverview': {
                    'totalRevenue': 0,
                    'totalOrders': 0,
                    'totalCustomers': 0,
                    'totalInventoryItems': 0,
                    'inventoryValue': 0,
                    'averageOrderValue': 0
                },
                'keyMetrics': {
                    'orderCompletionRate': 0,
                    'soldOutItems': 0,
                    'lowStockItems': 0,
                    'newCustomers': 0,
                    'customerRetention': 0
                }
            }
        }