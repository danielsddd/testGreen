// services/marketplaceApi.js - ENHANCED VERSION (All Functions Preserved + Auto-Refresh)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import config from './config';

// Base URL for API requests
const API_BASE_URL = config.API_BASE_URL || 'https://usersfunctions.azurewebsites.net/api';

// Enhanced error handling
class ApiError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.response = response;
  }
}

/**
 * Helper function to handle API requests with proper error handling and retry logic
 * @param {string} endpoint - API endpoint to call
 * @param {Object} options - Fetch options
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<Object>} - Response data
 */
const apiRequest = async (endpoint, options = {}, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Get authentication token and user email
      const token = await AsyncStorage.getItem('googleAuthToken');
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      // Default headers with authentication
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };
      
      // Add authentication headers if available
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      if (userEmail) {
        headers['X-User-Email'] = userEmail;
      }
      
      // Full URL with endpoint
      const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
      
      console.log(`🚀 API Request (attempt ${attempt}): ${url}`);
      
      // Make the request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Parse response
      let data;
      try {
        const responseText = await response.text();
        data = responseText ? JSON.parse(responseText) : {};
        console.log(`📋 API Response (${response.status}):`, Object.keys(data));
      } catch (e) {
        console.warn('Error parsing JSON response:', e);
        data = { error: 'Invalid response format' };
      }
      
      // Check for errors
      if (!response.ok) {
        const errorMessage = data.error || data.message || `Request failed with status ${response.status}`;
        console.error(`❌ API Error (${endpoint}):`, errorMessage);
        throw new ApiError(errorMessage, response.status, data);
      }
      
      console.log(`✅ API Success (${endpoint})`);
      return data;
      
    } catch (error) {
      console.error(`❌ API Attempt ${attempt} failed (${endpoint}):`, error.message);
      
      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error;
      }
      
      if (attempt === retries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`⏱️ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Trigger auto-refresh after data changes
 */
const triggerAutoRefresh = async (eventType, data = {}) => {
  try {
    console.log('🔄 Triggering auto-refresh after:', eventType);
    
    // Clear relevant caches based on event type
    const cachesToClear = [];
    
    switch (eventType) {
      case 'product_created':
      case 'product_updated':
      case 'product_deleted':
        cachesToClear.push('cached_products', 'cached_user_listings', 'cached_nearby_products');
        break;
      case 'wishlist_updated':
        cachesToClear.push('cached_wishlist', 'cached_products');
        break;
      case 'review_submitted':
      case 'review_deleted':
        cachesToClear.push('cached_reviews');
        break;
      case 'profile_updated':
        cachesToClear.push('cached_profile');
        break;
      case 'message_sent':
        cachesToClear.push('cached_conversations', 'cached_messages');
        break;
      default:
        cachesToClear.push('cached_products');
    }
    
    // Clear caches
    if (cachesToClear.length > 0) {
      await AsyncStorage.multiRemove(cachesToClear);
    }
    
    console.log('✅ Auto-refresh completed');
    return true;
  } catch (error) {
    console.error('❌ Auto-refresh error:', error);
    return false;
  }
};

/**
 * Get all marketplace products with filtering and pagination
 * @param {number} page - Page number
 * @param {string} category - Category filter
 * @param {string} search - Search query
 * @param {Object} options - Additional options (minPrice, maxPrice, sortBy)
 * @returns {Promise<Object>} - Response with products array and pagination info
 */
export const getAll = async (page = 1, category = null, search = null, options = {}) => {
  const queryParams = new URLSearchParams();
  
  // Add pagination
  queryParams.append('page', page);
  
  // Add category filter if provided
  if (category) {
    queryParams.append('category', category);
  }
  
  // Add search query if provided
  if (search) {
    queryParams.append('search', search);
  }
  
  // Add price range filters if provided
  if (options.minPrice !== undefined) {
    queryParams.append('minPrice', options.minPrice);
  }
  if (options.maxPrice !== undefined) {
    queryParams.append('maxPrice', options.maxPrice);
  }
  
  // Add sort option if provided
  if (options.sortBy) {
    queryParams.append('sortBy', options.sortBy);
  }
  
  // Add seller type filter if provided
  if (options.sellerType) {
    queryParams.append('sellerType', options.sellerType);
  }
  
  // Build endpoint with query params
  const endpoint = `marketplace/products?${queryParams.toString()}`;
  
  try {
    const response = await apiRequest(endpoint);
    
    // Cache the response for offline access
    if (page === 1 && !search && !category) {
      try {
        await AsyncStorage.setItem('cached_products', JSON.stringify({
          data: response,
          timestamp: Date.now()
        }));
      } catch (cacheError) {
        console.warn('⚠️ Failed to cache products:', cacheError);
      }
    }
    
    return response;
  } catch (error) {
    // Try to return cached data on error
    if (page === 1 && !search && !category) {
      try {
        const cached = await AsyncStorage.getItem('cached_products');
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const isStale = Date.now() - timestamp > 300000; // 5 minutes
          
          if (!isStale) {
            console.log('📱 Returning cached products');
            return { ...data, fromCache: true };
          }
        }
      } catch (cacheError) {
        console.warn('⚠️ Failed to load cached products:', cacheError);
      }
    }
    
    throw error;
  }
};

/**
 * Get specific product details by ID
 * @param {string} id - Product ID
 * @returns {Promise<Object>} - Product details
 */
export const getSpecific = async (id) => {
  if (!id) {
    throw new Error('Product ID is required');
  }
  
  const endpoint = `marketplace/products/specific/${id}`;
  
  return apiRequest(endpoint);
};

/**
 * Add or remove product from wishlist
 * @param {string} productId - Product ID to toggle
 * @returns {Promise<Object>} - Response with updated wishlist status
 */
export const wishProduct = async (productId) => {
  if (!productId) {
    throw new Error('Product ID is required');
  }
  
  const endpoint = `marketplace/products/wish/${productId}`;
  
  try {
    const response = await apiRequest(endpoint, {
      method: 'POST',
    });
    
    // Trigger auto-refresh after wishlist update
    await triggerAutoRefresh('wishlist_updated', { productId });
    
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Create new product listing
 * @param {Object} productData - Product data to create
 * @returns {Promise<Object>} - Response with created product info
 */
export const createProduct = async (productData) => {
  const endpoint = 'marketplace/products/create';
  
  try {
    const response = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(productData),
    });
    
    // Trigger auto-refresh after product creation
    await triggerAutoRefresh('product_created', { productData });
    
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Update existing product
 * @param {string} productId - Product ID to update
 * @param {Object} productData - Updated product data
 * @returns {Promise<Object>} - Response with updated product
 */
export const updateProduct = async (productId, productData) => {
  const endpoint = `marketplace/products/${productId}`;
  
  try {
    const response = await apiRequest(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(productData),
    });
    
    // Trigger auto-refresh after product update
    await triggerAutoRefresh('product_updated', { productId, productData });
    
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete product
 * @param {string} productId - Product ID to delete
 * @returns {Promise<Object>} - Response with deletion status
 */
export const deleteProduct = async (productId) => {
  const endpoint = `marketplace/products/${productId}`;
  
  try {
    const response = await apiRequest(endpoint, {
      method: 'DELETE',
    });
    
    // Trigger auto-refresh after product deletion
    await triggerAutoRefresh('product_deleted', { productId });
    
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Mark product as sold
 * @param {string} productId - Product ID to mark as sold
 * @param {Object} data - Optional data with buyer info
 * @returns {Promise<Object>} - Response with updated status
 */
export const markAsSold = async (productId, data = {}) => {
  const endpoint = `marketplace/products/${productId}/sold`;
  
  try {
    const response = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    // Trigger auto-refresh after marking as sold
    await triggerAutoRefresh('product_updated', { productId, status: 'sold' });
    
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Get user profile by ID
 * @param {string} userId - User ID to fetch
 * @returns {Promise<Object>} - User profile data
 */
export const fetchUserProfile = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  const endpoint = `marketplace/users/${userId}`;
  
  try {
    const response = await apiRequest(endpoint);
    
    // Cache profile data
    try {
      await AsyncStorage.setItem(`cached_profile_${userId}`, JSON.stringify({
        data: response,
        timestamp: Date.now()
      }));
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache profile:', cacheError);
    }
    
    return response;
  } catch (error) {
    // Try to return cached profile on error
    try {
      const cached = await AsyncStorage.getItem(`cached_profile_${userId}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isStale = Date.now() - timestamp > 600000; // 10 minutes
        
        if (!isStale) {
          console.log('📱 Returning cached profile');
          return { ...data, fromCache: true };
        }
      }
    } catch (cacheError) {
      console.warn('⚠️ Failed to load cached profile:', cacheError);
    }
    
    throw error;
  }
};

/**
 * Update user profile
 * @param {string} userId - User ID to update
 * @param {Object} profileData - Updated profile data
 * @returns {Promise<Object>} - Response with updated profile
 */
export const updateUserProfile = async (userId, profileData) => {
  const endpoint = `marketplace/users/${userId}`;
  
  try {
    const response = await apiRequest(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    });
    
    // Trigger auto-refresh after profile update
    await triggerAutoRefresh('profile_updated', { userId, profileData });
    
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Get user's listings
 * @param {string} userId - User ID
 * @param {string} status - Filter by status (active, sold, all)
 * @returns {Promise<Object>} - Response with user's listings
 */
export const getUserListings = async (userId, status = 'all') => {
  const endpoint = `marketplace/users/${userId}/listings?status=${status}`;
  
  try {
    const response = await apiRequest(endpoint);
    
    // Cache user listings
    if (status === 'all') {
      try {
        await AsyncStorage.setItem(`cached_user_listings_${userId}`, JSON.stringify({
          data: response,
          timestamp: Date.now()
        }));
      } catch (cacheError) {
        console.warn('⚠️ Failed to cache listings:', cacheError);
      }
    }
    
    return response;
  } catch (error) {
    // Try to return cached listings on error
    if (status === 'all') {
      try {
        const cached = await AsyncStorage.getItem(`cached_user_listings_${userId}`);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const isStale = Date.now() - timestamp > 300000; // 5 minutes
          
          if (!isStale) {
            console.log('📱 Returning cached listings');
            return { ...data, fromCache: true };
          }
        }
      } catch (cacheError) {
        console.warn('⚠️ Failed to load cached listings:', cacheError);
      }
    }
    
    throw error;
  }
};

/**
 * Get user's wishlist
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Response with user's wishlist
 */
export const getUserWishlist = async (userId) => {
  const endpoint = `marketplace/users/${userId}/wishlist`;
  
  try {
    const response = await apiRequest(endpoint);
    
    // Cache wishlist data
    try {
      await AsyncStorage.setItem(`cached_wishlist_${userId}`, JSON.stringify({
        data: response,
        timestamp: Date.now()
      }));
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache wishlist:', cacheError);
    }
    
    return response;
  } catch (error) {
    // Try to return cached wishlist on error
    try {
      const cached = await AsyncStorage.getItem(`cached_wishlist_${userId}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isStale = Date.now() - timestamp > 300000; // 5 minutes
        
        if (!isStale) {
          console.log('📱 Returning cached wishlist');
          return { ...data, fromCache: true };
        }
      }
    } catch (cacheError) {
      console.warn('⚠️ Failed to load cached wishlist:', cacheError);
    }
    
    throw error;
  }
};

/**
 * Upload an image and get URL
 * @param {string|Blob} imageData - Image data (URI or Blob)
 * @param {string} type - Image type (plant, user, etc.)
 * @returns {Promise<Object>} - Response with image URL
 */
export const uploadImage = async (imageData, type = 'plant') => {
  if (!imageData) {
    throw new Error('Image data is required');
  }
  
  const endpoint = 'marketplace/uploadImage';
  
  // Handle different image formats based on platform
  if (Platform.OS === 'web') {
    if (imageData instanceof Blob) {
      // For web with Blob/File
      const formData = new FormData();
      formData.append('file', imageData);
      formData.append('type', type);
      
      return apiRequest(endpoint, {
        method: 'POST',
        body: formData,
        headers: {}, // Let browser set content-type with boundary
      });
    } else if (imageData.startsWith('data:')) {
      // For web with data URI
      return apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ image: imageData, type }),
      });
    }
  }
  
  // For React Native with local URI
  // Create form data for file upload
  const formData = new FormData();
  formData.append('file', {
    uri: imageData,
    type: 'image/jpeg',
    name: 'upload.jpg',
  });
  formData.append('type', type);
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

/**
 * Get nearby products
 */
export const getNearbyProducts = async (latitude, longitude, radius = 10, category = null) => {
  try {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Valid coordinates required');
    }
    
    let queryParams = `lat=${latitude}&lon=${longitude}&radius=${radius}`;
    if (category && category !== 'All') {
      queryParams += `&category=${encodeURIComponent(category)}`;
    }
    
    const endpoint = `marketplace/nearbyProducts?${queryParams}`;
    const response = await apiRequest(endpoint);
    
    // Cache nearby products
    try {
      await AsyncStorage.setItem('cached_nearby_products', JSON.stringify({
        data: response,
        location: { latitude, longitude, radius },
        timestamp: Date.now()
      }));
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache nearby products:', cacheError);
    }
    
    return response;
  } catch (error) {
    // Try to return cached nearby products on error
    try {
      const cached = await AsyncStorage.getItem('cached_nearby_products');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isStale = Date.now() - timestamp > 300000; // 5 minutes
        
        if (!isStale) {
          console.log('📱 Returning cached nearby products');
          return { ...data, fromCache: true };
        }
      }
    } catch (cacheError) {
      console.warn('⚠️ Failed to load cached nearby products:', cacheError);
    }
    
    throw error;
  }
};

/**
 * Geocode address
 */
export const geocodeAddress = async (address) => {
  try {
    if (!address) {
      throw new Error('Address is required');
    }
    
    const endpoint = `marketplace/geocode?address=${encodeURIComponent(address)}`;
    return await apiRequest(endpoint);
  } catch (error) {
    console.error('Error geocoding address:', error);
    throw error;
  }
};

/**
 * Reverse geocode coordinates
 */
export const reverseGeocode = async (latitude, longitude) => {
  try {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Valid coordinates required');
    }
    
    const endpoint = `marketplace/reverseGeocode?lat=${latitude}&lon=${longitude}`;
    return await apiRequest(endpoint);
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    throw error;
  }
};

/**
 * Speech to text conversion
 */
export const speechToText = async (audioUrl, language = 'en-US') => {
  if (!audioUrl) {
    throw new Error('Audio URL is required');
  }

  const endpoint = 'marketplace/speechToText';

  try {
    const response = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({ audioUrl, language }),
    });

    const text = response.text;

    // Clean up the transcription text
    const cleanupTranscriptionText = (text) => {
      return typeof text === 'string'
        ? text.replace(/[.,!?;:'"()\[\]{}]/g, '').replace(/\s+/g, ' ').trim()
        : '';
    };

    return cleanupTranscriptionText(text);
  } catch (error) {
    console.error('Error in speechToText:', error);
    throw error;
  }
};

/**
 * Get Azure Maps key
 */
export const getAzureMapsKey = async () => {
  try {
    const endpoint = 'marketplace/maps-config';
    const data = await apiRequest(endpoint);
    
    if (!data.azureMapsKey) {
      throw new Error('No Azure Maps key returned from server');
    }
    
    return data.azureMapsKey;
  } catch (error) {
    console.error('Error getting Azure Maps key:', error);
    throw error;
  }
};

// ==========================================
// MESSAGING FUNCTIONALITY
// ==========================================

/**
 * Get SignalR negotiate token for real-time messaging
 * @returns {Promise<Object>} - SignalR connection info
 */
export const getNegotiateToken = async () => {
  const userEmail = await AsyncStorage.getItem('userEmail');
  
  if (!userEmail) {
    throw new Error('User email is required for messaging');
  }
  
  const endpoint = 'marketplace/signalr-negotiate';
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({ userId: userEmail }),
  });
};

/**
 * Get user conversations (chat rooms)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - List of conversations
 */
export const fetchConversations = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  const endpoint = 'marketplace/messages/getUserConversations';
  
  try {
    const response = await apiRequest(endpoint);
    
    // Cache conversations
    try {
      await AsyncStorage.setItem(`cached_conversations_${userId}`, JSON.stringify({
        data: response,
        timestamp: Date.now()
      }));
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache conversations:', cacheError);
    }
    
    return response;
  } catch (error) {
    // Try to return cached conversations on error
    try {
      const cached = await AsyncStorage.getItem(`cached_conversations_${userId}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isStale = Date.now() - timestamp > 60000; // 1 minute
        
        if (!isStale) {
          console.log('📱 Returning cached conversations');
          return data;
        }
      }
    } catch (cacheError) {
      console.warn('⚠️ Failed to load cached conversations:', cacheError);
    }
    
    throw error;
  }
};

/**
 * Get messages for a specific conversation
 * @param {string} chatId - Conversation ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Response with messages
 */
export const fetchMessages = async (chatId, userId) => {
  if (!chatId) {
    throw new Error('Chat ID is required');
  }
  
  const endpoint = `marketplace/messages/getMessages/${chatId}`;
  
  try {
    const response = await apiRequest(endpoint);
    
    // Cache messages
    try {
      await AsyncStorage.setItem(`cached_messages_${chatId}`, JSON.stringify({
        data: response,
        timestamp: Date.now()
      }));
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache messages:', cacheError);
    }
    
    return response;
  } catch (error) {
    // Try to return cached messages on error
    try {
      const cached = await AsyncStorage.getItem(`cached_messages_${chatId}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isStale = Date.now() - timestamp > 30000; // 30 seconds
        
        if (!isStale) {
          console.log('📱 Returning cached messages');
          return data;
        }
      }
    } catch (cacheError) {
      console.warn('⚠️ Failed to load cached messages:', cacheError);
    }
    
    throw error;
  }
};

/**
 * Send a message in an existing conversation
 * @param {string} chatId - Conversation ID
 * @param {string} message - Message text
 * @param {string} senderId - Sender ID
 * @returns {Promise<Object>} - Response with sent message info
 */
export const sendMessage = async (chatId, message, senderId) => {
  if (!chatId || !message) {
    throw new Error('Chat ID and message are required');
  }
  
  const endpoint = 'marketplace/messages/sendMessage';
  
  try {
    const response = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        message,
        senderId,
      }),
    });
    
    // Trigger auto-refresh after sending message
    await triggerAutoRefresh('message_sent', { chatId, message });
    
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Start a new conversation
 * @param {string} sellerId - Seller ID
 * @param {string} plantId - Plant ID
 * @param {string} message - Initial message
 * @param {string} sender - Sender ID (current user)
 * @returns {Promise<Object>} - Response with new conversation info
 */
export const startConversation = async (sellerId, plantId, message, sender) => {
  if (!sellerId || !message || !sender) {
    throw new Error('Seller ID, message, and sender are required');
  }
  
  const endpoint = 'marketplace/messages/createChatRoom';
  
  try {
    const response = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        receiver: sellerId,
        plantId,
        message,
        sender,
      }),
    });
    
    // Trigger auto-refresh after starting conversation
    await triggerAutoRefresh('message_sent', { sellerId, plantId });
    
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Mark messages as read
 * @param {string} conversationId - Conversation ID
 * @param {Array} messageIds - Optional specific message IDs to mark as read
 * @returns {Promise<Object>} - Response with updated read status
 */
export const markMessagesAsRead = async (conversationId, messageIds = []) => {
  if (!conversationId) {
    throw new Error('Conversation ID is required');
  }
  
  const endpoint = 'marketplace/messages/markAsRead';
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      conversationId,
      messageIds,
    }),
  });
};

/**
 * Send typing indicator to other user
 * @param {string} conversationId - Conversation ID
 * @param {boolean} isTyping - Whether user is typing
 * @returns {Promise<Object>} - Response with status
 */
export const sendTypingIndicator = async (conversationId, isTyping) => {
  if (!conversationId) {
    throw new Error('Conversation ID is required');
  }
  
  const endpoint = 'marketplace/messages/typing';
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      conversationId,
      isTyping,
    }),
  });
};

// ==========================================
// REVIEWS FUNCTIONALITY
// ==========================================

/**
 * Fetch reviews for a seller or product
 * @param {string} targetType - Target type ('seller' or 'product')
 * @param {string} targetId - Target ID
 * @returns {Promise<Object>} - Response with reviews
 */
export const fetchReviews = async (targetType, targetId) => {
  if (!targetType || !targetId) {
    throw new Error('Target type and ID are required');
  }
  
  const endpoint = `marketplace/reviews/${targetType}/${targetId}`;
  
  try {
    const response = await apiRequest(endpoint);
    
    // Cache reviews
    try {
      await AsyncStorage.setItem(`cached_reviews_${targetType}_${targetId}`, JSON.stringify({
        data: response,
        timestamp: Date.now()
      }));
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache reviews:', cacheError);
    }
    
    return response;
  } catch (error) {
    // Try to return cached reviews on error
    try {
      const cached = await AsyncStorage.getItem(`cached_reviews_${targetType}_${targetId}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isStale = Date.now() - timestamp > 600000; // 10 minutes
        
        if (!isStale) {
          console.log('📱 Returning cached reviews');
          return data;
        }
      }
    } catch (cacheError) {
      console.warn('⚠️ Failed to load cached reviews:', cacheError);
    }
    
    throw error;
  }
};

/**
 * Submit a review for a seller or product
 * @param {string} targetId - Target ID
 * @param {string} targetType - Target type ('seller' or 'product')
 * @param {Object} reviewData - Review data {rating, text}
 * @returns {Promise<Object>} - Response with submitted review
 */
export const submitReview = async (targetId, targetType, reviewData) => {
  if (!targetId || !targetType || !reviewData) {
    throw new Error('Target ID, type, and review data are required');
  }
  
  if (!reviewData.rating || !reviewData.text) {
    throw new Error('Rating and text are required for review');
  }
  
  const endpoint = `submitreview/${targetType}/${targetId}`;
  
  try {
    const response = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(reviewData),
    });
    
    // Trigger auto-refresh after submitting review
    await triggerAutoRefresh('review_submitted', { targetId, targetType, reviewData });
    
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete a review
 * @param {string} targetType - Target type ('seller' or 'product')
 * @param {string} targetId - Target ID
 * @param {string} reviewId - Review ID to delete
 * @returns {Promise<Object>} - Response with deletion status
 */
export const deleteReview = async (targetType, targetId, reviewId) => {
  if (!targetType || !targetId || !reviewId) {
    throw new Error('Target type, target ID, and review ID are required');
  }
  
  const endpoint = `marketplace/reviews/${targetType}/${targetId}/${reviewId}`;
  
  try {
    const response = await apiRequest(endpoint, {
      method: 'DELETE',
    });
    
    // Trigger auto-refresh after deleting review
    await triggerAutoRefresh('review_deleted', { targetId, targetType, reviewId });
    
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Clear all marketplace cache
 */
export const clearMarketplaceCache = async () => {
  try {
    console.log('🧹 Clearing marketplace cache...');
    
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => 
      key.startsWith('cached_products') || 
      key.startsWith('cached_profile_') ||
      key.startsWith('cached_user_listings_') ||
      key.startsWith('cached_wishlist_') ||
      key.startsWith('cached_conversations_') ||
      key.startsWith('cached_messages_') ||
      key.startsWith('cached_reviews_') ||
      key.startsWith('cached_nearby_products')
    );
    
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`✅ Cleared ${cacheKeys.length} cached items`);
    }
    
    return { success: true, clearedItems: cacheKeys.length };
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    return { success: false, error: error.message };
  }
};

// Export all functions
export default {
  getAll,
  getSpecific,
  wishProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  markAsSold,
  fetchUserProfile,
  updateUserProfile,
  getUserListings,
  getUserWishlist,
  uploadImage,
  getNearbyProducts,
  geocodeAddress,
  reverseGeocode,
  speechToText,
  getAzureMapsKey,
  getNegotiateToken,
  fetchConversations,
  fetchMessages,
  sendMessage,
  startConversation,
  markMessagesAsRead,
  sendTypingIndicator,
  fetchReviews,
  submitReview,
  deleteReview,
  clearMarketplaceCache,
  triggerAutoRefresh,
};