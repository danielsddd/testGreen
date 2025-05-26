// Business/services/businessOrderApi.js - COMPLETE VERSION (All Functions Preserved)
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

// Helper function to get headers with authentication
const getHeaders = async () => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    const businessId = await AsyncStorage.getItem('businessId');
    const authToken = await AsyncStorage.getItem('authToken');
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    if (businessId) {
      headers['X-Business-ID'] = businessId;
    }
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    return headers;
  } catch (error) {
    console.error('Error getting headers:', error);
    return {
      'Content-Type': 'application/json',
    };
  }
};

// Enhanced response handler
const handleResponse = async (response, context = 'API Request') => {
  console.log(`${context} - Response Status:`, response.status);
  
  let responseText;
  try {
    responseText = await response.text();
    console.log(`${context} - Response Text:`, responseText);
  } catch (textError) {
    console.error(`${context} - Error reading response text:`, textError);
    throw new Error(`Failed to read response: ${textError.message}`);
  }
  
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = JSON.parse(responseText);
      errorMessage = errorData.error || errorData.message || errorMessage;
      console.error(`${context} - Error Details:`, errorData);
    } catch (parseError) {
      console.error(`${context} - Error parsing error response:`, parseError);
      errorMessage = responseText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  
  try {
    const jsonData = JSON.parse(responseText);
    console.log(`${context} - Parsed JSON:`, jsonData);
    return jsonData;
  } catch (parseError) {
    console.log(`${context} - Response is not JSON, returning as text`);
    return { success: true, data: responseText };
  }
};

/**
 * Create a new order for pickup with correct route
 * @param {Object} orderData Order data
 * @returns {Promise<Object>} Created order response
 */
export const createOrder = async (orderData) => {
  if (!orderData) {
    throw new Error('Order data is required');
  }
  
  // Validate required fields
  const requiredFields = ['businessId', 'customerEmail', 'customerName', 'items'];
  const missingFields = requiredFields.filter(field => !orderData[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  if (!orderData.items || orderData.items.length === 0) {
    throw new Error('Order must contain at least one item');
  }
  
  try {
    console.log('Creating order:', orderData);
    const headers = await getHeaders();
    
    // Enhanced order data with defaults
    const enhancedOrderData = {
      ...orderData,
      orderDate: new Date().toISOString(),
      status: 'pending',
      fulfillmentType: 'pickup',
      notes: orderData.notes || '',
      communicationPreference: orderData.communicationPreference || 'messages'
    };
    
    const url = `${API_BASE_URL}/business/orders/create`;
    console.log('Create Order URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(enhancedOrderData),
    });
    
    const data = await handleResponse(response, 'Create Order');
    
    console.log('Order created successfully:', data);
    return data;
  } catch (error) {
    console.error('Error creating order:', error);
    throw new Error(`Failed to create order: ${error.message}`);
  }
};

/**
 * Get orders for business with correct route
 * @param {string} businessId Business ID
 * @param {Object} options Filter options
 * @returns {Promise<Object>} Orders data with pagination and summary
 */
export const getBusinessOrders = async (businessId, options = {}) => {
  if (!businessId) {
    throw new Error('Business ID is required');
  }
  
  try {
    console.log('Getting business orders for:', businessId, 'with options:', options);
    const headers = await getHeaders();
    
    const queryParams = new URLSearchParams();
    queryParams.append('businessId', businessId);
    
    if (options.status && options.status !== 'all') {
      queryParams.append('status', options.status);
    }
    
    if (options.limit) {
      queryParams.append('limit', options.limit);
    }
    
    if (options.offset) {
      queryParams.append('offset', options.offset);
    }
    
    if (options.startDate) {
      queryParams.append('startDate', options.startDate);
    }
    
    if (options.endDate) {
      queryParams.append('endDate', options.endDate);
    }
    
    const url = `${API_BASE_URL}/business/orders?${queryParams.toString()}`;
    console.log('Get Orders URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    const data = await handleResponse(response, 'Get Business Orders');
    
    // Handle different response formats and ensure consistent structure
    let orders = [];
    
    if (data.orders && Array.isArray(data.orders)) {
      orders = data.orders;
    } else if (Array.isArray(data)) {
      orders = data;
    } else if (data.data && Array.isArray(data.data)) {
      orders = data.data;
    }
    
    // Enhanced order processing
    const processedOrders = orders.map(order => ({
      ...order,
      itemCount: order.items ? order.items.length : 0,
      totalQuantity: order.items ? order.items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0,
      isPickupReady: order.status === 'ready',
      timeAgo: getTimeAgo(order.orderDate || order.createdAt),
      isUrgent: order.status === 'pending' && 
        (Date.now() - new Date(order.orderDate || order.createdAt)) > 24 * 60 * 60 * 1000
    }));
    
    // Enhanced summary calculations
    const summary = {
      totalOrders: processedOrders.length,
      statusCounts: processedOrders.reduce((counts, order) => {
        counts[order.status] = (counts[order.status] || 0) + 1;
        return counts;
      }, {}),
      pendingCount: processedOrders.filter(o => o.status === 'pending').length,
      readyCount: processedOrders.filter(o => o.status === 'ready').length,
      completedCount: processedOrders.filter(o => o.status === 'completed').length,
      todayOrders: processedOrders.filter(o => {
        const orderDate = new Date(o.orderDate || o.createdAt);
        const today = new Date();
        return orderDate.toDateString() === today.toDateString();
      }).length,
      totalRevenue: processedOrders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.total || 0), 0),
      averageOrderValue: processedOrders.length > 0 ? 
        processedOrders.reduce((sum, o) => sum + (o.total || 0), 0) / processedOrders.length : 0
    };
    
    const result = {
      success: true,
      businessId: data.businessId || businessId,
      orders: processedOrders,
      pagination: data.pagination || {
        limit: options.limit || 50,
        offset: options.offset || 0,
        total: processedOrders.length,
        hasMore: false
      },
      summary: { ...data.summary, ...summary },
      filters: data.filters || {}
    };
    
    console.log(`Business orders loaded: ${result.orders.length} orders`);
    return result;
  } catch (error) {
    console.error('Error getting business orders:', error);
    
    // Return empty structure instead of throwing for order listing
    if (error.message.includes('404') || error.message.includes('not found')) {
      console.log('No orders found, returning empty structure');
      return {
        success: true,
        businessId: businessId,
        orders: [],
        pagination: {
          limit: options.limit || 50,
          offset: options.offset || 0,
          total: 0,
          hasMore: false
        },
        summary: {
          totalOrders: 0,
          statusCounts: {},
          pendingCount: 0,
          readyCount: 0,
          completedCount: 0,
          todayOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0
        },
        filters: {}
      };
    }
    
    throw new Error(`Failed to get orders: ${error.message}`);
  }
};

/**
 * Update order status with correct route
 * @param {string} orderId Order ID to update
 * @param {string} newStatus New status
 * @param {string} notes Optional notes
 * @returns {Promise<Object>} Updated order
 */
export const updateOrderStatus = async (orderId, newStatus, notes = '') => {
  if (!orderId) {
    throw new Error('Order ID is required');
  }
  
  if (!newStatus) {
    throw new Error('New status is required');
  }
  
  try {
    console.log('Updating order status:', orderId, 'to', newStatus);
    const headers = await getHeaders();
    
    const updateData = {
      orderId,
      status: newStatus,
      notes,
      updatedAt: new Date().toISOString(),
      staffAssigned: headers['X-User-Email'] || 'system'
    };
    
    const url = `${API_BASE_URL}/business/orders`;
    console.log('Update Order Status URL:', url);
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updateData),
    });
    
    const data = await handleResponse(response, 'Update Order Status');
    
    console.log('Order status updated successfully:', data);
    return data;
  } catch (error) {
    console.error('Error updating order status:', error);
    throw new Error(`Failed to update order status: ${error.message}`);
  }
};

/**
 * Get customers for business with correct route
 * @param {string} businessId Business ID
 * @returns {Promise<Array>} Array of customers
 */
export const getBusinessCustomers = async (businessId) => {
  if (!businessId) {
    throw new Error('Business ID is required');
  }
  
  try {
    console.log('Getting business customers for:', businessId);
    const headers = await getHeaders();
    
    const url = `${API_BASE_URL}/business/customers`;
    console.log('Get Customers URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    const data = await handleResponse(response, 'Get Business Customers');
    
    // Handle different response formats
    let customers = [];
    
    if (data.customers && Array.isArray(data.customers)) {
      customers = data.customers;
    } else if (Array.isArray(data)) {
      customers = data;
    } else if (data.data && Array.isArray(data.data)) {
      customers = data.data;
    }
    
    // Enhanced customer processing
    const processedCustomers = customers.map(customer => ({
      ...customer,
      totalSpent: customer.totalSpent || 0,
      orderCount: customer.orderCount || (customer.orders ? customer.orders.length : 0),
      lastOrderDate: customer.lastOrderDate || (customer.orders && customer.orders.length > 0 ? 
        customer.orders[customer.orders.length - 1].date : null),
      customerSince: customer.firstPurchaseDate || customer.createdAt,
      isActiveCustomer: customer.lastOrderDate ? 
        (Date.now() - new Date(customer.lastOrderDate)) < (90 * 24 * 60 * 60 * 1000) : false, // 90 days
      averageOrderValue: customer.orderCount > 0 ? (customer.totalSpent / customer.orderCount) : 0
    }));
    
    console.log(`Business customers loaded: ${processedCustomers.length} customers`);
    return processedCustomers;
  } catch (error) {
    console.error('Error getting business customers:', error);
    
    // Return empty array instead of throwing for customer listing
    if (error.message.includes('404') || error.message.includes('not found')) {
      console.log('No customers found, returning empty array');
      return [];
    }
    
    throw new Error(`Failed to get customers: ${error.message}`);
  }
};

/**
 * Create or update customer record with correct route
 * @param {Object} customerData Customer data
 * @returns {Promise<Object>} Customer record
 */
export const createOrUpdateCustomer = async (customerData) => {
  if (!customerData || !customerData.email || !customerData.name) {
    throw new Error('Customer email and name are required');
  }
  
  try {
    console.log('Creating/updating customer:', customerData);
    const headers = await getHeaders();
    
    // Enhanced customer data with defaults
    const enhancedCustomerData = {
      ...customerData,
      createdAt: customerData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSubscribedToNewsletter: customerData.isSubscribedToNewsletter || false,
      tags: customerData.tags || [],
      notes: customerData.notes || '',
      preferences: customerData.preferences || {}
    };
    
    const url = `${API_BASE_URL}/business/customers`;
    console.log('Create/Update Customer URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(enhancedCustomerData),
    });
    
    const data = await handleResponse(response, 'Create/Update Customer');
    
    console.log('Customer created/updated successfully:', data);
    return data;
  } catch (error) {
    console.error('Error creating/updating customer:', error);
    throw new Error(`Failed to create/update customer: ${error.message}`);
  }
};

/**
 * Get order details by ID
 * @param {string} orderId Order ID
 * @returns {Promise<Object>} Order details
 */
export const getOrderDetails = async (orderId) => {
  if (!orderId) {
    throw new Error('Order ID is required');
  }
  
  try {
    console.log('Getting order details for:', orderId);
    const headers = await getHeaders();
    
    const url = `${API_BASE_URL}/business/orders/${encodeURIComponent(orderId)}`;
    console.log('Get Order Details URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    const data = await handleResponse(response, 'Get Order Details');
    
    // Enhanced order details processing
    const enhancedOrder = {
      ...data,
      itemCount: data.items ? data.items.length : 0,
      totalQuantity: data.items ? data.items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0,
      isPickupReady: data.status === 'ready',
      timeAgo: getTimeAgo(data.orderDate || data.createdAt),
      statusHistory: data.statusHistory || [],
      canCancel: data.status === 'pending',
      canMarkReady: data.status === 'confirmed',
      canComplete: data.status === 'ready'
    };
    
    console.log('Order details loaded successfully');
    return enhancedOrder;
  } catch (error) {
    console.error('Error getting order details:', error);
    throw new Error(`Failed to get order details: ${error.message}`);
  }
};

/**
 * Cancel an order
 * @param {string} orderId Order ID to cancel
 * @param {string} reason Cancellation reason
 * @returns {Promise<Object>} Cancellation result
 */
export const cancelOrder = async (orderId, reason = '') => {
  if (!orderId) {
    throw new Error('Order ID is required');
  }
  
  try {
    console.log('Cancelling order:', orderId, 'Reason:', reason);
    const headers = await getHeaders();
    
    const cancelData = {
      orderId,
      status: 'cancelled',
      notes: reason,
      cancelledAt: new Date().toISOString(),
      cancelledBy: headers['X-User-Email'] || 'system'
    };
    
    const url = `${API_BASE_URL}/business/orders`;
    console.log('Cancel Order URL:', url);
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(cancelData),
    });
    
    const data = await handleResponse(response, 'Cancel Order');
    
    console.log('Order cancelled successfully');
    return data;
  } catch (error) {
    console.error('Error cancelling order:', error);
    throw new Error(`Failed to cancel order: ${error.message}`);
  }
};

/**
 * Get order statistics
 * @param {string} businessId Business ID
 * @param {Object} options Options for date range
 * @returns {Promise<Object>} Order statistics
 */
export const getOrderStatistics = async (businessId, options = {}) => {
  if (!businessId) {
    throw new Error('Business ID is required');
  }
  
  try {
    console.log('Getting order statistics for:', businessId);
    
    // Get all orders and calculate statistics
    const ordersData = await getBusinessOrders(businessId, options);
    const orders = ordersData.orders || [];
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const stats = {
      total: {
        orders: orders.length,
        revenue: orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + (o.total || 0), 0),
        averageOrderValue: orders.length > 0 ? orders.reduce((sum, o) => sum + (o.total || 0), 0) / orders.length : 0
      },
      today: {
        orders: orders.filter(o => new Date(o.orderDate || o.createdAt) >= todayStart).length,
        revenue: orders
          .filter(o => new Date(o.orderDate || o.createdAt) >= todayStart && o.status === 'completed')
          .reduce((sum, o) => sum + (o.total || 0), 0)
      },
      week: {
        orders: orders.filter(o => new Date(o.orderDate || o.createdAt) >= weekStart).length,
        revenue: orders
          .filter(o => new Date(o.orderDate || o.createdAt) >= weekStart && o.status === 'completed')
          .reduce((sum, o) => sum + (o.total || 0), 0)
      },
      month: {
        orders: orders.filter(o => new Date(o.orderDate || o.createdAt) >= monthStart).length,
        revenue: orders
          .filter(o => new Date(o.orderDate || o.createdAt) >= monthStart && o.status === 'completed')
          .reduce((sum, o) => sum + (o.total || 0), 0)
      },
      byStatus: ordersData.summary?.statusCounts || {},
      topProducts: getTopProducts(orders),
      recentActivity: orders
        .sort((a, b) => new Date(b.orderDate || b.createdAt) - new Date(a.orderDate || a.createdAt))
        .slice(0, 10)
    };
    
    console.log('Order statistics calculated successfully');
    return stats;
  } catch (error) {
    console.error('Error getting order statistics:', error);
    throw new Error(`Failed to get order statistics: ${error.message}`);
  }
};

/**
 * Mark order as ready for pickup
 * @param {string} orderId Order ID
 * @param {string} notes Optional notes
 * @returns {Promise<Object>} Updated order
 */
export const markOrderReady = async (orderId, notes = '') => {
  return await updateOrderStatus(orderId, 'ready', notes);
};

/**
 * Complete an order (customer picked up)
 * @param {string} orderId Order ID
 * @param {string} notes Optional notes
 * @returns {Promise<Object>} Updated order
 */
export const completeOrder = async (orderId, notes = '') => {
  return await updateOrderStatus(orderId, 'completed', notes);
};

/**
 * Confirm an order (business accepted)
 * @param {string} orderId Order ID
 * @param {string} notes Optional notes
 * @returns {Promise<Object>} Updated order
 */
export const confirmOrder = async (orderId, notes = '') => {
  return await updateOrderStatus(orderId, 'confirmed', notes);
};

/**
 * Search orders by criteria
 * @param {string} businessId Business ID
 * @param {Object} searchCriteria Search criteria
 * @returns {Promise<Array>} Matching orders
 */
export const searchOrders = async (businessId, searchCriteria = {}) => {
  try {
    console.log('Searching orders for:', businessId, 'with criteria:', searchCriteria);
    
    // Use getBusinessOrders with search filters
    const options = {
      ...searchCriteria,
      limit: searchCriteria.limit || 50
    };
    
    const ordersData = await getBusinessOrders(businessId, options);
    
    let filteredOrders = ordersData.orders || [];
    
    // Additional client-side filtering if needed
    if (searchCriteria.customerName) {
      const searchTerm = searchCriteria.customerName.toLowerCase();
      filteredOrders = filteredOrders.filter(order =>
        order.customerName?.toLowerCase().includes(searchTerm)
      );
    }
    
    if (searchCriteria.confirmationNumber) {
      filteredOrders = filteredOrders.filter(order =>
        order.confirmationNumber?.includes(searchCriteria.confirmationNumber)
      );
    }
    
    if (searchCriteria.minTotal) {
      filteredOrders = filteredOrders.filter(order =>
        (order.total || 0) >= searchCriteria.minTotal
      );
    }
    
    if (searchCriteria.maxTotal) {
      filteredOrders = filteredOrders.filter(order =>
        (order.total || 0) <= searchCriteria.maxTotal
      );
    }
    
    return {
      success: true,
      orders: filteredOrders,
      totalFound: filteredOrders.length,
      searchCriteria: searchCriteria
    };
  } catch (error) {
    console.error('Error searching orders:', error);
    throw new Error(`Failed to search orders: ${error.message}`);
  }
};

/**
 * Get orders by date range
 * @param {string} businessId Business ID
 * @param {string} startDate Start date
 * @param {string} endDate End date
 * @returns {Promise<Object>} Orders within date range
 */
export const getOrdersByDateRange = async (businessId, startDate, endDate) => {
  try {
    console.log('Getting orders by date range:', { businessId, startDate, endDate });
    
    const options = {
      startDate,
      endDate,
      limit: 1000 // Large limit for date range queries
    };
    
    return await getBusinessOrders(businessId, options);
  } catch (error) {
    console.error('Error getting orders by date range:', error);
    throw new Error(`Failed to get orders by date range: ${error.message}`);
  }
};

/**
 * Export orders data
 * @param {string} businessId Business ID
 * @param {Object} options Export options
 * @returns {Promise<Object>} Export result
 */
export const exportOrders = async (businessId, options = {}) => {
  try {
    console.log('Exporting orders for:', businessId, 'with options:', options);
    const headers = await getHeaders();
    
    const queryParams = new URLSearchParams();
    queryParams.append('businessId', businessId);
    queryParams.append('export', 'true');
    
    if (options.format) queryParams.append('format', options.format);
    if (options.startDate) queryParams.append('startDate', options.startDate);
    if (options.endDate) queryParams.append('endDate', options.endDate);
    if (options.status) queryParams.append('status', options.status);
    
    const url = `${API_BASE_URL}/business/orders?${queryParams.toString()}`;
    console.log('Export Orders URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    const data = await handleResponse(response, 'Export Orders');
    
    console.log('Orders exported successfully');
    return {
      success: true,
      exportData: data,
      format: options.format || 'json',
      exportedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error exporting orders:', error);
    throw new Error(`Failed to export orders: ${error.message}`);
  }
};

// Utility Functions
const getTimeAgo = (dateString) => {
  if (!dateString) return 'Unknown';
  
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const getTopProducts = (orders) => {
  const productCounts = {};
  
  orders.forEach(order => {
    if (order.items) {
      order.items.forEach(item => {
        const key = item.name || item.productId;
        if (key) {
          productCounts[key] = (productCounts[key] || 0) + (item.quantity || 1);
        }
      });
    }
  });
  
  return Object.entries(productCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
};

// Export all functions
export default {
  createOrder,
  getBusinessOrders,
  updateOrderStatus,
  getBusinessCustomers,
  createOrUpdateCustomer,
  getOrderDetails,
  cancelOrder,
  getOrderStatistics,
  markOrderReady,
  completeOrder,
  confirmOrder,
  searchOrders,
  getOrdersByDateRange,
  exportOrders,
};