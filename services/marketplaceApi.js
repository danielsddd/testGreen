// services/marketplaceApi.js - FIXED PRODUCTION VERSION
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import config from './config';

// Base URL for API requests
const API_BASE_URL = config.API_BASE_URL || 'https://usersfunctions.azurewebsites.net/api';

// Cache for business data to avoid repeated API calls
const businessCache = new Map();
const cacheTimeout = 5 * 60 * 1000; // 5 minutes

/**
 * Set authentication token for API requests
 */
export const setAuthToken = async (token) => {
  try {
    if (token) {
      await AsyncStorage.setItem('googleAuthToken', token);
    } else {
      await AsyncStorage.removeItem('googleAuthToken');
    }
    return true;
  } catch (error) {
    console.error('❌ Error saving auth token:', error);
    return false;
  }
};

/**
 * Helper function to handle API requests with proper error handling
 */
const apiRequest = async (endpoint, options = {}) => {
  try {
    const token = await AsyncStorage.getItem('googleAuthToken');
    const userEmail = await AsyncStorage.getItem('userEmail');
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
    
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = { error: 'Invalid response format' };
    }
    
    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error(`❌ API request failed (${endpoint}):`, error);
    throw error;
  }
};

// ==========================================
// SIMPLIFIED IMAGE PROCESSING
// ==========================================

/**
 * FIXED: Simplified image processing for business products
 */
const processProductImages = (item) => {
  // Simple image collection - no complex processing
  const images = [];
  
  if (item.mainImage) images.push(item.mainImage);
  if (item.image && item.image !== item.mainImage) images.push(item.image);
  if (item.images && Array.isArray(item.images)) {
    item.images.forEach(img => {
      if (img && !images.includes(img)) images.push(img);
    });
  }
  
  // Filter valid URLs only
  const validImages = images.filter(img => 
    img && typeof img === 'string' && (img.startsWith('http') || img.startsWith('data:'))
  );
  
  return {
    mainImage: validImages[0] || null,
    images: validImages,
    hasImages: validImages.length > 0,
  };
};

/**
 * FIXED: Simplified conversion of inventory to marketplace products
 */
const convertInventoryToProducts = (inventory, business, category, search) => {
  return inventory
    .filter(item => {
      // Basic filters only
      if (item.status !== 'active' || (item.quantity || 0) <= 0) return false;
      
      if (category && category !== 'All') {
        if (item.category?.toLowerCase() !== category.toLowerCase()) return false;
      }
      
      if (search) {
        const searchLower = search.toLowerCase();
        const itemName = (item.name || item.common_name || '').toLowerCase();
        const businessName = (business.businessName || business.name || '').toLowerCase();
        
        if (!itemName.includes(searchLower) && !businessName.includes(searchLower)) {
          return false;
        }
      }
      
      return true;
    })
    .map(item => {
      const processedImages = processProductImages(item);
      const businessLocation = business.address || business.location || {};
      
      return {
        id: item.id,
        _id: item.id,
        title: item.name || item.common_name || 'Business Product',
        name: item.name || item.common_name || 'Business Product',
        common_name: item.common_name,
        scientific_name: item.scientific_name || item.scientificName,
        description: item.description || `${item.name || item.common_name} from ${business.businessName || business.name}`,
        price: item.finalPrice || item.price || 0,
        originalPrice: item.price || 0,
        discount: item.discount || 0,
        category: item.category || 'Plants',
        productType: item.productType || 'plant',
        
        // Simplified image handling
        image: processedImages.mainImage,
        mainImage: processedImages.mainImage,
        images: processedImages.images,
        hasImages: processedImages.hasImages,
        
        businessId: business.id || business.email,
        sellerId: business.id || business.email,
        sellerType: 'business',
        isBusinessListing: true,
        inventoryId: item.id,
        
        // Simplified seller info
        seller: {
          _id: business.id || business.email,
          name: business.businessName || business.name || 'Business',
          email: business.email || business.id,
          isBusiness: true,
          businessName: business.businessName || business.name,
          businessType: business.businessType || 'Business',
          rating: business.rating || 0,
          reviewCount: business.reviewCount || 0,
          location: {
            city: businessLocation.city || 'Contact for location',
            address: businessLocation.address || '',
            latitude: businessLocation.latitude,
            longitude: businessLocation.longitude,
          }
        },
        
        // Simplified location
        location: {
          city: businessLocation.city || 'Contact for location',
          latitude: businessLocation.latitude,
          longitude: businessLocation.longitude,
        },
        
        addedAt: item.addedAt || new Date().toISOString(),
        
        stats: {
          views: item.viewCount || 0,
          wishlistCount: 0,
          messageCount: 0
        },
        
        source: 'business_inventory',
      };
    });
};

// ==========================================
// CORE MARKETPLACE FUNCTIONS - SIMPLIFIED
// ==========================================

/**
 * FIXED: Simplified marketplace product loading
 */
export const getAll = async (page = 1, category = null, search = null, options = {}) => {
  console.log('🛒 Loading marketplace...', { page, category, search, sellerType: options.sellerType });
  
  try {
    // Quick seller type counts for UI
    const counts = await getSellerTypeCountsFast();
    
    let products = [];
    let paginationInfo = { page: 1, pages: 1, count: 0 };
    
    if (options.sellerType === 'individual') {
      // Individual products only
      const data = await getIndividualProducts(page, category, search, options);
      products = (data.products || []).map(product => ({
        ...product,
        sellerType: 'individual',
        isBusinessListing: false,
        seller: { ...product.seller, isBusiness: false }
      }));
      paginationInfo = {
        page: data.page || page,
        pages: data.pages || 1,
        count: data.count || products.length
      };
      
    } else if (options.sellerType === 'business') {
      // Business products only
      const businessProducts = await getBusinessProducts(category, search);
      const pageSize = 20;
      const totalItems = businessProducts.length;
      const startIndex = (page - 1) * pageSize;
      products = businessProducts.slice(startIndex, startIndex + pageSize);
      
      paginationInfo = {
        page: page,
        pages: Math.ceil(totalItems / pageSize),
        count: totalItems
      };
      
    } else {
      // All products - load both types
      const [individualData, businessProducts] = await Promise.all([
        getIndividualProducts(page, category, search, options),
        getBusinessProducts(category, search)
      ]);
      
      const individualProducts = (individualData.products || []).map(product => ({
        ...product,
        sellerType: 'individual',
        isBusinessListing: false,
        seller: { ...product.seller, isBusiness: false }
      }));
      
      products = [...individualProducts, ...businessProducts];
      paginationInfo = {
        page: individualData.page || page,
        pages: Math.max(individualData.pages || 1, Math.ceil(products.length / 20)),
        count: products.length
      };
    }
    
    // Apply final filters
    let filteredProducts = products;
    
    // Price filter
    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      filteredProducts = filteredProducts.filter(product => {
        const price = parseFloat(product.price || 0);
        if (options.minPrice !== undefined && price < options.minPrice) return false;
        if (options.maxPrice !== undefined && price > options.maxPrice) return false;
        return true;
      });
    }
    
    // Apply sorting if specified
    if (options.sortBy) {
      filteredProducts = sortProducts(filteredProducts, options.sortBy);
    } else {
      // Default sort by date
      filteredProducts.sort((a, b) => 
        new Date(b.addedAt || b.listedDate || 0) - new Date(a.addedAt || a.listedDate || 0)
      );
    }
    
    console.log(`✅ Returning ${filteredProducts.length} products`);
    
    return {
      products: filteredProducts,
      page: paginationInfo.page,
      pages: paginationInfo.pages,
      count: paginationInfo.count,
      currentPage: page,
      filters: { category, search, ...options },
      sellerTypeCounts: counts
    };
    
  } catch (error) {
    console.error('❌ Marketplace error:', error);
    // Return empty results instead of throwing
    return {
      products: [],
      page: 1,
      pages: 1,
      count: 0,
      currentPage: 1,
      filters: { error: true },
      sellerTypeCounts: { all: 0, individual: 0, business: 0 }
    };
  }
};

/**
 * FAST: Get seller type counts with caching
 */
const getSellerTypeCountsFast = async () => {
  const cacheKey = 'seller_counts';
  const cached = businessCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < cacheTimeout) {
    return cached.data;
  }
  
  try {
    // Get counts in parallel for speed
    const [individualCount, businessCount] = await Promise.all([
      getIndividualProducts(1, null, null, {})
        .then(data => data.count || 0)
        .catch(() => 0),
      getBusinessCountFast()
    ]);
    
    const counts = {
      all: individualCount + businessCount,
      individual: individualCount,
      business: businessCount
    };
    
    // Cache the result
    businessCache.set(cacheKey, {
      data: counts,
      timestamp: Date.now()
    });
    
    return counts;
  } catch (error) {
    return { all: 0, individual: 0, business: 0 };
  }
};

/**
 * FAST: Get business count only
 */
const getBusinessCountFast = async () => {
  const cacheKey = 'business_count';
  const cached = businessCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < cacheTimeout) {
    return cached.data;
  }
  
  try {
    const businesses = await getAllBusinesses();
    let totalCount = 0;
    
    // Process up to 3 businesses in parallel for speed
    const businessPromises = businesses.slice(0, 3).map(async business => {
      try {
        const response = await apiRequest(`marketplace/business-profile/${business.id || business.email}`);
        const inventory = response.business?.inventory || response.inventory || [];
        return inventory.filter(item => item.status === 'active' && (item.quantity || 0) > 0).length;
      } catch (e) {
        return 0;
      }
    });
    
    const counts = await Promise.all(businessPromises);
    totalCount = counts.reduce((sum, count) => sum + count, 0);
    
    // Cache the result
    businessCache.set(cacheKey, {
      data: totalCount,
      timestamp: Date.now()
    });
    
    return totalCount;
  } catch (error) {
    return 0;
  }
};

/**
 * FIXED: Simplified business products loading
 */
const getBusinessProducts = async (category, search) => {
  const cacheKey = `business_products_${category || 'all'}_${search || 'none'}`;
  const cached = businessCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < cacheTimeout) {
    return cached.data;
  }
  
  try {
    // Get businesses first
    const businesses = await getAllBusinesses();
    if (businesses.length === 0) return [];
    
    // Process businesses (limit to 3 for performance)
    const businessPromises = businesses.slice(0, 3).map(async business => {
      try {
        const response = await apiRequest(`marketplace/business-profile/${business.id || business.email}`);
        const businessProfile = response.business || response;
        const inventory = businessProfile.inventory || [];
        
        return convertInventoryToProducts(inventory, businessProfile, category, search);
      } catch (error) {
        console.warn(`Business ${business.id} failed:`, error.message);
        return [];
      }
    });
    
    const businessProductArrays = await Promise.all(businessPromises);
    const allBusinessProducts = businessProductArrays.flat();
    
    // Cache the result
    businessCache.set(cacheKey, {
      data: allBusinessProducts,
      timestamp: Date.now()
    });
    
    return allBusinessProducts;
    
  } catch (error) {
    console.error('❌ Business products failed:', error);
    return [];
  }
};

/**
 * FIXED: Simplified business loading with proper error handling
 */
const getAllBusinesses = async () => {
  const cacheKey = 'all_businesses';
  const cached = businessCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < cacheTimeout) {
    return cached.data;
  }
  
  try {
    const response = await apiRequest('marketplace/businesses');
    const businesses = response.businesses || [];
    
    businessCache.set(cacheKey, {
      data: businesses,
      timestamp: Date.now()
    });
    
    return businesses;
  } catch (error) {
    console.error('❌ Get businesses failed:', error);
    return [];
  }
};

/**
 * Get individual products from regular marketplace
 */
const getIndividualProducts = async (page, category, search, options) => {
  const queryParams = new URLSearchParams();
  
  queryParams.append('page', page);
  if (category && category !== 'All') queryParams.append('category', category);
  if (search) queryParams.append('search', search);
  if (options.minPrice !== undefined) queryParams.append('minPrice', options.minPrice);
  if (options.maxPrice !== undefined) queryParams.append('maxPrice', options.maxPrice);
  if (options.sortBy) queryParams.append('sortBy', options.sortBy);
  
  const endpoint = `marketplace/products?${queryParams.toString()}`;
  return apiRequest(endpoint);
};

/**
 * Sort products helper
 */
const sortProducts = (products, sortBy) => {
  switch (sortBy) {
    case 'recent':
      return products.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    case 'priceAsc':
      return products.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    case 'priceDesc':
      return products.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    default:
      return products;
  }
};

/**
 * Clear cache when needed
 */
export const clearMarketplaceCache = () => {
  businessCache.clear();
  console.log('🧹 Marketplace cache cleared');
};

// ==========================================
// PRODUCT MANAGEMENT FUNCTIONS
// ==========================================

export const getSpecific = async (id) => {
  if (!id) {
    throw new Error('Product ID is required');
  }
  
  const endpoint = `marketplace/products/specific/${id}`;
  return apiRequest(endpoint);
};

export const wishProduct = async (productId) => {
  if (!productId) {
    throw new Error('Product ID is required');
  }
  
  const endpoint = `marketplace/products/wish/${productId}`;
  return apiRequest(endpoint, { method: 'POST' });
};

export const createProduct = async (productData) => {
  const endpoint = 'marketplace/products/create';
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(productData),
  });
};

export const createPlant = async (plantData) => {
  return createProduct(plantData);
};

export const updateProduct = async (productId, productData) => {
  const endpoint = `marketplace/products/${productId}`;
  return apiRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(productData),
  });
};

export const deleteProduct = async (productId) => {
  const endpoint = `marketplace/products/${productId}`;
  return apiRequest(endpoint, { method: 'DELETE' });
};

export const markAsSold = async (productId, data = {}) => {
  const endpoint = `marketplace/products/${productId}/sold`;
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// ==========================================
// USER PROFILE FUNCTIONS
// ==========================================

export const fetchUserProfile = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  const endpoint = `marketplace/users/${userId}`;
  return apiRequest(endpoint);
};

export const fetchBusinessProfile = async (businessId) => {
  const endpoint = `marketplace/business-profile/${businessId}`;
  return apiRequest(endpoint);
};

export const updateUserProfile = async (userId, profileData) => {
  const endpoint = `marketplace/users/${userId}`;
  return apiRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(profileData),
  });
};

export const getUserListings = async (userId, status = 'all') => {
  const endpoint = `marketplace/users/${userId}/listings?status=${status}`;
  return apiRequest(endpoint);
};

export const getUserWishlist = async (userId) => {
  const endpoint = `marketplace/users/${userId}/wishlist`;
  return apiRequest(endpoint);
};

// ==========================================
// IMAGE UPLOAD FUNCTIONS
// ==========================================

export const uploadImage = async (imageData, type = 'plant') => {
  if (!imageData) {
    throw new Error('Image data is required');
  }
  
  const endpoint = 'marketplace/uploadImage';
  
  // Handle different image data formats
  if (typeof imageData === 'string' && imageData.startsWith('data:')) {
    // Base64 data
    return apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({ image: imageData, type }),
    });
  }
  
  // FormData for file uploads
  const formData = new FormData();
  formData.append('file', imageData);
  formData.append('type', type);
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: formData,
    headers: {}, // Don't set Content-Type for FormData
  });
};

// ==========================================
// BUSINESS PURCHASE FUNCTIONS
// ==========================================

export const purchaseBusinessProduct = async (productId, businessId, quantity = 1, customerInfo) => {
  const endpoint = 'business/orders/create';
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      businessId: businessId,
      customerEmail: customerInfo.email,
      customerName: customerInfo.name,
      customerPhone: customerInfo.phone || '',
      items: [{
        id: productId,
        quantity: quantity
      }],
      notes: customerInfo.notes || '',
      communicationPreference: 'messages'
    })
  });
};

// ==========================================
// LOCATION FUNCTIONS
// ==========================================

export const getNearbyProducts = async (latitude, longitude, radius = 10, category = null) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Valid coordinates required');
  }
  
  let queryParams = `lat=${latitude}&lon=${longitude}&radius=${radius}`;
  if (category && category !== 'All') {
    queryParams += `&category=${encodeURIComponent(category)}`;
  }
  
  const endpoint = `marketplace/nearbyProducts?${queryParams}`;
  return apiRequest(endpoint);
};

export const getNearbyBusinesses = async (latitude, longitude, radius = 10, businessType = null) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Valid coordinates required');
  }
  
  let queryParams = `lat=${latitude}&lon=${longitude}&radius=${radius}`;
  if (businessType && businessType !== 'all') {
    queryParams += `&businessType=${encodeURIComponent(businessType)}`;
  }
  
  const endpoint = `marketplace/nearby-businesses?${queryParams}`;
  return apiRequest(endpoint);
};

export const geocodeAddress = async (address) => {
  if (!address) {
    throw new Error('Address is required');
  }
  
  const endpoint = `marketplace/geocode?address=${encodeURIComponent(address)}`;
  return apiRequest(endpoint);
};

export const reverseGeocode = async (latitude, longitude) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Valid coordinates required');
  }
  
  const endpoint = `marketplace/reverseGeocode?lat=${latitude}&lon=${longitude}`;
  return apiRequest(endpoint);
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

export const speechToText = async (audioUrl, language = 'en-US') => {
  if (!audioUrl) {
    throw new Error('Audio URL is required');
  }

  const endpoint = 'marketplace/speechToText';
  const response = await apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({ audioUrl, language }),
  });

  // Clean up transcription text
  const text = response.text || '';
  return text.replace(/[.,!?;:'"()\[\]{}]/g, '').replace(/\s+/g, ' ').trim();
};

export const getAzureMapsKey = async () => {
  const endpoint = 'marketplace/maps-config';
  const data = await apiRequest(endpoint);
  
  if (!data.azureMapsKey) {
    throw new Error('No Azure Maps key returned from server');
  }
  
  return data.azureMapsKey;
};

// ==========================================
// MESSAGING FUNCTIONALITY
// ==========================================

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

export const fetchConversations = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  const endpoint = 'marketplace/messages/getUserConversations';
  return apiRequest(endpoint);
};

export const fetchMessages = async (chatId, userId) => {
  if (!chatId) {
    throw new Error('Chat ID is required');
  }
  
  const endpoint = `marketplace/messages/getMessages/${chatId}`;
  return apiRequest(endpoint);
};

export const sendMessage = async (chatId, message, senderId) => {
  if (!chatId || !message) {
    throw new Error('Chat ID and message are required');
  }
  
  const endpoint = 'marketplace/messages/sendMessage';
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      chatId,
      message,
      senderId,
    }),
  });
};

export const startConversation = async (sellerId, plantId, message, sender) => {
  if (!sellerId || !message || !sender) {
    throw new Error('Seller ID, message, and sender are required');
  }
  
  const endpoint = 'marketplace/messages/createChatRoom';
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      receiver: sellerId,
      plantId,
      message,
      sender,
    }),
  });
};

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

export const fetchReviews = async (targetType, targetId) => {
  if (!targetType || !targetId) {
    throw new Error('Target type and ID are required');
  }
  
  const endpoint = `marketplace/reviews/${targetType}/${targetId}`;
  return apiRequest(endpoint);
};

export const submitReview = async (targetId, targetType, reviewData) => {
  if (!targetId || !targetType || !reviewData) {
    throw new Error('Target ID, type, and review data are required');
  }
  
  if (!reviewData.rating || !reviewData.text) {
    throw new Error('Rating and text are required for review');
  }
  
  const endpoint = `submitreview/${targetType}/${targetId}`;
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(reviewData),
  });
};

export const deleteReview = async (targetType, targetId, reviewId) => {
  if (!targetType || !targetId || !reviewId) {
    throw new Error('Target type, target ID, and review ID are required');
  }
  
  const endpoint = `marketplace/reviews/${targetType}/${targetId}/${reviewId}`;
  return apiRequest(endpoint, { method: 'DELETE' });
};

// ==========================================
// EXPORT ALL FUNCTIONS
// ==========================================

export default {
  getAll,
  getSpecific,
  wishProduct,
  createProduct,
  createPlant,
  updateProduct,
  deleteProduct,
  markAsSold,
  fetchUserProfile,
  fetchBusinessProfile,
  updateUserProfile,
  getUserListings,
  getUserWishlist,
  uploadImage,
  getNearbyProducts,
  getNearbyBusinesses, 
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
  fetchReviews,
  submitReview,
  deleteReview,
  purchaseBusinessProduct,
  setAuthToken,
  clearMarketplaceCache,
  sendTypingIndicator
};