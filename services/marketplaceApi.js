// marketplace/services/marketplaceApi.js
import config from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MOCK_USER, MOCK_PLANTS, getMockProducts, getMockProductById, getMockMessageData } from './mockData';

// API Base URL points to Azure Functions
const API_BASE_URL = config.api.baseUrl;

// AUTH TOKEN HANDLING
let authToken = null;

export const setAuthToken = async (token) => {
  try {
    authToken = token;
    global.googleAuthToken = token;
    await AsyncStorage.setItem('googleAuthToken', token);
    console.log('Auth token set successfully');
    return true;
  } catch (error) {
    console.error('Error setting auth token:', error);
    return false;
  }
};

export const initializeAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('googleAuthToken');
    if (token) {
      authToken = token;
      global.googleAuthToken = token;
      console.log('Auth token initialized from storage');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error initializing auth token:', error);
    return false;
  }
};

// HELPER FUNCTIONS
const apiRequest = async (endpoint, method = 'GET', body = null) => {
  try {
    // Get the user's email from AsyncStorage for request identification
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    const headers = {
      'Content-Type': 'application/json',
    };

    // Add auth token if available
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Add user email for identification if available
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
      
      // Add userId parameter to endpoint if it doesn't already have it
      if (!endpoint.includes('userId=') && !endpoint.includes('email=')) {
        endpoint += endpoint.includes('?') ? `&userId=${encodeURIComponent(userEmail)}` : `?userId=${encodeURIComponent(userEmail)}`;
      }
    }

    const options = {
      method,
      headers,
    };

    if (body) {
      // Add user email to body if not already present and it's a POST/PUT/PATCH
      if (userEmail && body && typeof body === 'object' && !body.userId && !body.email && method !== 'GET') {
        body.userId = userEmail;
      }
      
      options.body = JSON.stringify(body);
    }

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), config.api.timeout);
    });

    const fetchPromise = fetch(`${API_BASE_URL}/${endpoint}`, options);
    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);

    if (config.isDevelopment && !config.features.useRealApi) {
      console.log('Development mode: Using mock data');
      if (endpoint.includes('products') || endpoint.includes('plants')) {
        return getMockProductData(endpoint);
      } else if (endpoint.includes('user')) {
        return { user: MOCK_USER };
      } else if (endpoint.includes('messages')) {
        return getMockMessageData(endpoint);
      } else {
        return { success: true, mockData: true };
      }
    }

    throw error;
  }
};

const getMockProductData = (endpoint) => {
  // Handle different endpoint patterns
  if (endpoint.includes('specific')) {
    const id = endpoint.split('/').pop();
    return getMockProductById(id);
  } else if (endpoint.includes('wish')) {
    // Wishlist toggle endpoint
    return { 
      success: true, 
      isWished: Math.random() > 0.5, // Random toggle
      message: 'Wishlist updated (mock)', 
      status: 'success' 
    };
  } else {
    // Default products endpoint
    const params = new URLSearchParams(endpoint.split('?')[1] || '');
    const category = params.get('category');
    const search = params.get('search');
    return getMockProducts(category, search);
  }
};

// PRODUCT API
export const getAll = async (page = 1, category = null, search = '', filters = {}) => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      return getMockProducts(category, search);
    }

    let endpoint = `marketplace/products?page=${page}`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    if (category && category !== 'All') endpoint += `&category=${encodeURIComponent(category)}`;
    
    // Add any additional filters
    if (filters) {
      if (filters.minPrice) endpoint += `&minPrice=${filters.minPrice}`;
      if (filters.maxPrice) endpoint += `&maxPrice=${filters.maxPrice}`;
      if (filters.sortBy) endpoint += `&sortBy=${filters.sortBy}`;
      if (filters.sortOrder) endpoint += `&sortOrder=${filters.sortOrder}`;
    }

    return await apiRequest(endpoint);
  } catch (error) {
    console.error('Error fetching products:', error);
    return getMockProducts(category, search);
  }
};

export const getSpecific = async (id) => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      return getMockProductById(id);
    }

    return await apiRequest(`marketplace/products/specific/${id}`);
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
    return getMockProductById(id);
  }
};

export const createPlant = async (plantData) => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      // Mock successful creation
      return { 
        success: true, 
        productId: 'mock-' + Date.now(), 
        message: "Plant listing created successfully (mock)" 
      };
    }

    // Get user email for seller attribution
    const userEmail = await AsyncStorage.getItem('userEmail');
    if (userEmail) {
      plantData.sellerId = userEmail;
    }

    return await apiRequest('marketplace/products/create', 'POST', plantData);
  } catch (error) {
    console.error('Error creating plant:', error);
    throw error;
  }
};

export const wishProduct = async (id) => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      // Return mock response
      return { 
        success: true, 
        isWished: Math.random() > 0.5, // Randomly toggle
        message: 'Wishlist toggled (mock)' 
      };
    }
    
    // Get user email for identification
    const userEmail = await AsyncStorage.getItem('userEmail');
    const body = { userId: userEmail };
    
    return await apiRequest(`marketplace/products/wish/${id}`, 'POST', body);
  } catch (error) {
    console.error(`Error toggling wishlist for product ${id}:`, error);
    if (config.isDevelopment) {
      return { success: true, message: 'Wishlist toggled (mock)' };
    }
    throw error;
  }
};

// MESSAGING API
export const fetchConversations = async () => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      return getMockMessageData('getUserConversations');
    }

    // User email is added automatically by apiRequest function
    return await apiRequest(`marketplace/messages/getUserConversations`);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return getMockMessageData('getUserConversations');
  }
};

export const fetchMessages = async (conversationId) => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      return getMockMessageData(`messages/${conversationId}`);
    }

    // User email is added automatically by apiRequest function
    return await apiRequest(`marketplace/messages/getMessages/${conversationId}`);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return getMockMessageData(`messages/${conversationId}`);
  }
};

export const sendMessage = async (chatId, message) => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      return getMockMessageData('sendMessage');
    }

    // Get user email for identification
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    return await apiRequest('marketplace/messages/sendMessage', 'POST', { 
      chatId, 
      message, 
      senderId: userEmail 
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return getMockMessageData('sendMessage');
  }
};

export const startConversation = async (receiver, plantId, message) => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      return getMockMessageData('createChatRoom');
    }

    // Get user email for identification
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    return await apiRequest('marketplace/messages/createChatRoom', 'POST', { 
      receiver, 
      plantId, 
      message,
      sender: userEmail
    });
  } catch (error) {
    console.error('Error starting conversation:', error);
    return getMockMessageData('createChatRoom');
  }
};

// USER API
export const fetchUserProfile = async (userId = null) => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      return { user: MOCK_USER };
    }

    // If no userId provided, use current user
    if (!userId) {
      userId = await AsyncStorage.getItem('userEmail');
    }

    return await apiRequest(`marketplace/users/${encodeURIComponent(userId)}`);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return { user: MOCK_USER };
  }
};

export const updateUserProfile = async (id, userData) => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      return { 
        success: true, 
        user: { ...MOCK_USER, ...userData },
        message: "Profile updated successfully (mock)"
      };
    }

    return await apiRequest(`marketplace/users/${encodeURIComponent(id)}`, 'PATCH', userData);
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// Export the API
export default {
  setAuthToken,
  initializeAuthToken,
  getAll,
  getSpecific,
  createPlant,
  wishProduct,
  fetchConversations,
  sendMessage,
  startConversation,
  fetchMessages,
  fetchUserProfile,
  updateUserProfile
};