// frontend/marketplace/services/marketplaceApi.js
import config from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MOCK_USER, MOCK_PLANTS, getMockProducts, getMockProductById } from './mockData';

// SEARCH_KEY: MARKETPLACE_API_CONFIG
const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

// HELPER FUNCTIONS
const apiRequest = async (endpoint, method = 'GET', body = null) => {
  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    const options = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 10000);
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
      if (endpoint.includes('marketplace/products')) {
        return getMockProductData(endpoint);
      } else if (endpoint.includes('user')) {
        return { user: MOCK_USER };
      } else {
        return { success: true, mockData: true };
      }
    }

    throw error;
  }
};

const getMockProductData = (endpoint) => {
  if (endpoint.includes('specific')) {
    const id = endpoint.split('/').pop();
    return getMockProductById(id);
  } else {
    return getMockProducts();
  }
};

// PRODUCT API
export const getAll = async (page = 1, category = null, search = '') => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      return getMockProducts(category, search);
    }

    let endpoint = `marketplace/products?page=${page}`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    if (category && category !== 'All') endpoint += `&category=${encodeURIComponent(category)}`;

    return await apiRequest(endpoint);
  } catch (error) {
    console.error('Error fetching products:', error);
    return getMockProducts(category, search);
  }
};

// SEARCH_KEY: MARKETPLACE_GET_SPECIFIC_PRODUCT
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
// SEARCH_KEY: MARKETPLACE_CREATE_PRODUCT
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

    return await apiRequest('marketplace/products/create', 'POST', plantData);
  } catch (error) {
    console.error('Error creating plant:', error);
    throw error;
  }
};
// SEARCH_KEY: MARKETPLACE_WISH_PRODUCT
export const wishProduct = async (id, userId = null) => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      // Return mock response
      return { 
        success: true, 
        isWished: Math.random() > 0.5, // Randomly toggle
        message: 'Wishlist toggled (mock)' 
      };
    }
    return await apiRequest(`marketplace/products/wish/${id}`, 'POST', body);
  } catch (error) {
    console.error(`Error toggling wishlist for product ${id}:`, error);
    if (config.isDevelopment) {
      return { success: true, message: 'Wishlist toggled (mock)' };
    }
    throw error;
  }
};

// SEARCH_KEY: MARKETPLACE_CONVERSATIONS_API
export const fetchConversations = async (email) => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      return [
        {
          id: 'conv1',
          otherUserName: 'PlantLover123',
          otherUserAvatar: 'https://via.placeholder.com/50?text=User1',
          lastMessage: "Hi, is the Monstera still available?",
          lastMessageTimestamp: new Date().toISOString(),
          plantName: "Monstera Deliciosa",
          plantId: "1",
          sellerId: "seller1",
          unreadCount: 2
        },
        {
          id: 'conv2',
          otherUserName: 'GreenThumb',
          otherUserAvatar: 'https://via.placeholder.com/50?text=User2',
          lastMessage: "Thanks for the quick response!",
          lastMessageTimestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          plantName: "Snake Plant",
          plantId: "2",
          sellerId: "seller2",
          unreadCount: 0
        }
      ];
    }

    return await apiRequest(`marketplace/messages/getUserConversations?userId=${encodeURIComponent(email)}`);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    if (config.isDevelopment) {
      return [
        {
          id: 'conv1',
          otherUserName: 'PlantLover123',
          otherUserAvatar: 'https://via.placeholder.com/50?text=User1',
          lastMessage: "Hi, is the Monstera still available?",
          lastMessageTimestamp: new Date().toISOString(),
          plantName: "Monstera Deliciosa",
          plantId: "1",
          sellerId: "seller1",
          unreadCount: 2
        },
        {
          id: 'conv2',
          otherUserName: 'GreenThumb',
          otherUserAvatar: 'https://via.placeholder.com/50?text=User2',
          lastMessage: "Thanks for the quick response!",
          lastMessageTimestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          plantName: "Snake Plant",
          plantId: "2",
          sellerId: "seller2",
          unreadCount: 0
        }
      ];
    }
    throw error;
  }
};

// SEARCH_KEY: MARKETPLACE_SEND_MESSAGE_API
export const sendMessage = async (chatId, message, senderEmail) => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      return { sender: senderEmail };
    }

    return await apiRequest('marketplace/messages/sendMessage', 'POST', { 
      chatId, 
      message, 
      senderId: senderEmail 
    });
  } catch (error) {
    console.error('Error sending message:', error);
    if (config.isDevelopment) {
      return { sender: senderEmail };
    }
    throw error;
  }
};

// SEARCH_KEY: MARKETPLACE_START_CONVERSATION_API
export const startConversation = async (receiver, plantId, message, senderEmail) => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      return { messageId: 'mock-conversation-id' };
    }

    return await apiRequest('marketplace/messages/createChatRoom', 'POST', { 
      receiver, 
      plantId, 
      message,
      sender: senderEmail
    });
  } catch (error) {
    console.error('Error starting conversation:', error);
    if (config.isDevelopment) {
      return { messageId: 'mock-conversation-id' };
    }
    throw error;
  }
};

// SEARCH_KEY: MARKETPLACE_GET_MESSAGES_API
export const fetchMessages = async (conversationId, userEmail) => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      return {
        messages: [
          {
            id: 'msg1',
            text: "Hi, is the Monstera still available?",
            senderId: 'otherUser',
            timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
          },
          {
            id: 'msg2',
            text: "Yes, it's still available!",
            senderId: userEmail,
            timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString()
          },
          {
            id: 'msg3',
            text: "Great! What's the best time to come see it?",
            senderId: 'otherUser',
            timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString()
          },
          {
            id: 'msg4',
            text: "I'm available this weekend, would that work for you?",
            senderId: userEmail,
            timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString()
          }
        ]
      };
    }

    return await apiRequest(`marketplace/messages/getMessages/${conversationId}?userId=${encodeURIComponent(userEmail)}`);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return { messages: [] };
  }
};
// SEARCH_KEY: MARKETPLACE_USER_PROFILE_API
export const fetchUserProfile = async (userId) => {
  try {
    if (config.isDevelopment && !config.features.useRealApi) {
      return { user: MOCK_USER };
    }

    const user = await apiRequest(`marketplace/users/${encodeURIComponent(userId)}`);
    return { user };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return { user: MOCK_USER };
  }
};

// Export the API
export default {
  getAll,
  getSpecific,
  createPlant,
  wishProduct,
  fetchConversations,
  sendMessage,
  startConversation,
  fetchMessages,
  fetchUserProfile,
  // Other API methods will be added in later steps
}