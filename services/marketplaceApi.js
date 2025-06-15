// services/marketplaceApi.js - FIXED: Removed duplicate fetchBusinessProfile definition
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import config from './config';
import syncBridge, { addBusinessProfileSync, addInventorySync, invalidateMarketplaceCache } from './BusinessMarketplaceSyncBridge';

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
 * FIXED: Enhanced API request function with proper error handling and retry logic
 */
const apiRequest = async (endpoint, options = {}, retries = 3) => {
  try {
    const token = await AsyncStorage.getItem('googleAuthToken');
    const userEmail = await AsyncStorage.getItem('userEmail');
    const userType = await AsyncStorage.getItem('userType');
    const businessId = await AsyncStorage.getItem('businessId');
    
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
    
    if (userType) {
      headers['X-User-Type'] = userType;
    }
    
    if (businessId) {
      headers['X-Business-ID'] = businessId;
    }
    
    const url = `${API_BASE_URL}/${endpoint.replace(/^\//, '')}`;
    console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
    
    // FIXED: Add retry logic with exponential backoff
    let lastError;
    const retries = 2;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          timeout: 15000,
          ...options,
          headers,
        });
        
        let data;
        try {
          // FIXED: Always check response.ok before parsing JSON
          if (!response.ok) {
            console.error(`❌ API Error ${response.status}:`, response.statusText);
            
            // Try to get error details if response has content
            const textResponse = await response.text();
            let errorData = { error: `Request failed with status ${response.status}` };
            
            if (textResponse) {
              try {
                errorData = JSON.parse(textResponse);
              } catch (parseError) {
                errorData = { error: textResponse };
              }
            }
            
            // Don't retry on client errors (4xx), only on server errors (5xx) or network issues
            if (response.status >= 400 && response.status < 500 && attempt === 1) {
              throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
            }
            
            lastError = new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
          } else {
            // Only parse JSON if response is OK
            const textResponse = await response.text();
            data = textResponse ? JSON.parse(textResponse) : {};
            console.log(`✅ API Success: ${endpoint}`);
            return data;
          }
        } catch (parseError) {
          console.error('❌ JSON parse error:', parseError);
          // If we can't parse the response, treat it as an error
          lastError = new Error('Invalid response format from server');
        }
        
        lastError = new Error(data.error || data.message || `Request failed with status ${response.status}`);
        
        // If this is not a server error, don't retry
        if (response.status < 500) {
          throw lastError;
        }
        
      } catch (error) {
        lastError = error;
        
        // Don't retry on client-side errors
        if (error.name === 'TypeError' || error.message.includes('network') || attempt === retries) {
          break;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  } catch (error) {
    console.error(`❌ API request failed (${endpoint}):`, error);
    throw error;
  }
};

// ==========================================
// ENHANCED PRODUCT CONVERSION FUNCTIONS
// ==========================================

/**
 * Calculate distance between two coordinates using Haversine formula
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * FIXED: Main function to get all marketplace products with enhanced filtering
 */
export const getAll = async (category = 'All', search = '', location = null) => {
  const cacheKey = `marketplace_${category}_${search}_${location?.city || 'all'}`;
  
  try {
    // Check cache first
    const cached = businessCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTimeout) {
      console.log('📱 Using cached marketplace data');
      return cached.data;
    }

    console.log('🔄 Fetching marketplace products...');
    
    // Get all businesses and their inventories
    const businesses = await getAllBusinesses();
    let allProducts = [];
    
    // Process business products
    for (const business of businesses) {
      try {
        if (!business.id && !business.email) continue;
        
        const inventoryResponse = await fetchBusinessInventory(business.id || business.email);
        const inventory = inventoryResponse.inventory || [];
        
        const businessProducts = convertInventoryToProducts(inventory, business, category, search);
        allProducts = allProducts.concat(businessProducts);
      } catch (businessError) {
        console.warn(`⚠️ Failed to fetch inventory for business ${business.name}:`, businessError);
        continue;
      }
    }
    
    // Fetch individual listings
    try {
      const individualResponse = await apiRequest('marketplace/individual-listings');
      const individualProducts = processIndividualProducts(individualResponse.products || []);
      allProducts = allProducts.concat(individualProducts);
    } catch (individualError) {
      console.warn('⚠️ Failed to fetch individual listings:', individualError);
    }
    
    // Apply location filter if provided
    if (location && location.latitude && location.longitude) {
      allProducts = allProducts.filter(product => {
        if (!product.location?.latitude || !product.location?.longitude) return true;
        
        const distance = calculateDistance(
          location.latitude, location.longitude,
          product.location.latitude, product.location.longitude
        );
        
        return distance <= (location.radius || 50); // Default 50km radius
      });
    }
    
    // Sort by relevance and date
    allProducts.sort((a, b) => {
      // Prioritize products with images
      if (a.hasImages && !b.hasImages) return -1;
      if (!a.hasImages && b.hasImages) return 1;
      
      // Then by date (newest first)
      const dateA = new Date(a.addedAt || a.updatedAt);
      const dateB = new Date(b.addedAt || b.updatedAt);
      return dateB - dateA;
    });
    
    // Cache the results
    businessCache.set(cacheKey, {
      data: allProducts,
      timestamp: Date.now()
    });
    
    console.log(`✅ Loaded ${allProducts.length} marketplace products`);
    return allProducts;
    
  } catch (error) {
    console.error('❌ Failed to fetch marketplace products:', error);
    
    // Return cached data if available, even if stale
    const cached = businessCache.get(cacheKey);
    if (cached) {
      console.log('📱 Using stale cached data due to error');
      return cached.data;
    }
    
    return [];
  }
};

/**
 * FIXED: Get specific product by ID
 */
export const getSpecific = async (productId) => {
  if (!productId) {
    throw new Error('Product ID is required');
  }
  
  try {
    // Try business inventory first
    const businesses = await getAllBusinesses();
    
    for (const business of businesses) {
      try {
        const inventoryResponse = await fetchBusinessInventory(business.id || business.email);
        const inventory = inventoryResponse.inventory || [];
        
        const product = inventory.find(item => item.id === productId);
        if (product) {
          const businessProducts = convertInventoryToProducts([product], business);
          return businessProducts[0];
        }
      } catch (error) {
        continue;
      }
    }
    
    // Try individual listings
    const endpoint = `marketplace/products/${productId}`;
    const response = await apiRequest(endpoint);
    
    if (response.product) {
      const processedProducts = processIndividualProducts([response.product]);
      return processedProducts[0];
    }
    
    throw new Error('Product not found');
    
  } catch (error) {
    console.error('❌ Failed to fetch specific product:', error);
    throw error;
  }
};

/**
 * FIXED: Add product to wishlist
 */
export const wishProduct = async (productId, userId) => {
  if (!productId || !userId) {
    throw new Error('Product ID and User ID are required');
  }
  
  const endpoint = 'marketplace/wishlist/add';
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({ productId, userId }),
  });
};

/**
 * FIXED: Create new product listing
 */
export const createProduct = async (productData) => {
  if (!productData) {
    throw new Error('Product data is required');
  }
  
  const endpoint = 'marketplace/products';
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(productData),
  });
};

/**
 * FIXED: Create new plant listing (alias for createProduct)
 */
export const createPlant = async (plantData) => {
  return createProduct(plantData);
};

/**
 * FIXED: Update existing product
 */
export const updateProduct = async (productId, productData) => {
  if (!productId || !productData) {
    throw new Error('Product ID and data are required');
  }
  
  const endpoint = `marketplace/products/${productId}`;
  return apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(productData),
  });
};

/**
 * FIXED: Delete product
 */
export const deleteProduct = async (productId) => {
  if (!productId) {
    throw new Error('Product ID is required');
  }
  
  const endpoint = `marketplace/products/${productId}`;
  return apiRequest(endpoint, {
    method: 'DELETE',
  });
};

/**
 * FIXED: Mark product as sold
 */
export const markAsSold = async (productId) => {
  if (!productId) {
    throw new Error('Product ID is required');
  }
  
  const endpoint = `marketplace/products/${productId}/sold`;
  return apiRequest(endpoint, {
    method: 'PATCH',
  });
};

/**
 * FIXED: Clear marketplace cache
 */
export const clearMarketplaceCache = () => {
  businessCache.clear();
  console.log('🧹 Marketplace cache cleared');
};

// ==========================================
// RESTORED: ENHANCED IMAGE PROCESSING FUNCTIONS
// ==========================================

/**
 * RESTORED: Process business product images for marketplace display with enhanced handling
 */
const processBusinessProductImages = (item, business) => {
  // Collect all possible image sources
  const allImageSources = [];
  
  // Primary image sources
  if (item.mainImage) allImageSources.push(item.mainImage);
  if (item.image && item.image !== item.mainImage) allImageSources.push(item.image);
  
  // Additional images
  if (item.images && Array.isArray(item.images)) {
    item.images.forEach(img => {
      if (img && !allImageSources.includes(img)) {
        allImageSources.push(img);
      }
    });
  }
  
  // Alternative image field names
  if (item.imageUrls && Array.isArray(item.imageUrls)) {
    item.imageUrls.forEach(img => {
      if (img && !allImageSources.includes(img)) {
        allImageSources.push(img);
      }
    });
  }
  
  // Business-specific image processing
  if (item.productImages && Array.isArray(item.productImages)) {
    item.productImages.forEach(img => {
      if (img && !allImageSources.includes(img)) {
        allImageSources.push(img);
      }
    });
  }
  
  // Filter valid images
  const validImages = allImageSources.filter(img => {
    if (!img || typeof img !== 'string') return false;
    
    // Check for valid URL formats
    if (img.startsWith('http://') || img.startsWith('https://')) {
      return true;
    }
    
    // Check for data URLs
    if (img.startsWith('data:image/')) {
      return true;
    }
    
    // Check for relative paths that might be valid
    if (img.startsWith('/') || img.startsWith('./') || img.startsWith('../')) {
      return true;
    }
    
    return false;
  });
  
  return {
    mainImage: validImages[0] || null,
    images: validImages,
    hasImages: validImages.length > 0,
    imageCount: validImages.length,
    allSources: allImageSources, // Keep for debugging
  };
};

/**
 * RESTORED: Enhanced product image processing for individual listings
 */
const processIndividualProductImages = (product) => {
  const images = [];
  
  // Primary image
  if (product.image) images.push(product.image);
  if (product.mainImage && product.mainImage !== product.image) images.push(product.mainImage);
  
  // Additional images
  if (product.images && Array.isArray(product.images)) {
    product.images.forEach(img => {
      if (img && !images.includes(img)) images.push(img);
    });
  }
  
  // Validate and filter images
  const validImages = images.filter(img => 
    img && typeof img === 'string' && 
    (img.startsWith('http') || img.startsWith('data:') || img.startsWith('/'))
  );
  
  return {
    mainImage: validImages[0] || null,
    images: validImages,
    hasImages: validImages.length > 0,
  };
};

/**
 * RESTORED: Generate fallback image based on product category
 */
const generateFallbackImage = (product, business) => {
  const category = product.category || product.productType || 'general';
  const businessName = business?.businessName || business?.name || 'Business';
  
  // You could implement a service that generates placeholder images here
  // For now, return a standard placeholder
  return `https://via.placeholder.com/300x200/4CAF50/white?text=${encodeURIComponent(category)}`;
};

/**
 * RESTORED: Simplified image processing for business products (backward compatibility)
 */
const processProductImages = (item) => {
  const images = [];
  
  if (item.mainImage) images.push(item.mainImage);
  if (item.image && item.image !== item.mainImage) images.push(item.image);
  if (item.images && Array.isArray(item.images)) {
    item.images.forEach(img => {
      if (img && !images.includes(img)) images.push(img);
    });
  }
  if (item.imageUrls && Array.isArray(item.imageUrls)) {
    item.imageUrls.forEach(img => {
      if (img && !images.includes(img)) images.push(img);
    });
  }
  
  const validImages = images.filter(img => 
    img && typeof img === 'string' && (img.startsWith('http') || img.startsWith('data:'))
  );
  
  return {
    mainImage: validImages[0] || null,
    images: validImages,
    hasImages: validImages.length > 0,
  };
};

// ==========================================
// RESTORED: ENHANCED PRODUCT CONVERSION FUNCTIONS
// ==========================================

/**
 * RESTORED: Convert inventory items to marketplace products with enhanced features
 */
const convertInventoryToProducts = (inventory, business, category, search) => {
  if (!Array.isArray(inventory)) {
    console.warn('⚠️ Inventory is not an array:', inventory);
    return [];
  }

  return inventory
    .filter(item => {
      // Basic filters
      if (item.status !== 'active' || (item.quantity || 0) <= 0) return false;
      
      // Category filter - enhanced matching
      if (category && category !== 'All' && category !== 'all') {
        const itemCategory = item.category || item.productType || '';
        const categoryVariations = [
          category.toLowerCase(),
          category.toLowerCase().replace(/s$/, ''), // Remove plural
          category.toLowerCase() + 's', // Add plural
        ];
        
        if (!categoryVariations.some(cat => itemCategory.toLowerCase().includes(cat))) {
          return false;
        }
      }
      
      // Enhanced search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const searchableFields = [
          item.name || '',
          item.common_name || '',
          item.description || '',
          item.notes || '',
          business.businessName || '',
          business.name || '',
          item.category || '',
          item.productType || '',
        ];
        
        const searchableText = searchableFields.join(' ').toLowerCase();
        
        // Split search terms and check if all are present
        const searchTerms = searchLower.split(' ').filter(term => term.length > 0);
        if (!searchTerms.every(term => searchableText.includes(term))) {
          return false;
        }
      }
      
      return true;
    })
    .map(item => {
      const processedImages = processBusinessProductImages(item, business);
      const businessLocation = business.address || business.location || {};
      
      return {
        id: item.id,
        _id: item.id,
        title: item.name || item.common_name || 'Business Product',
        name: item.name || item.common_name || 'Business Product',
        common_name: item.common_name,
        scientific_name: item.scientific_name || item.scientificName,
        description: item.description || item.notes || `${item.name || item.common_name} from ${business.businessName || business.name}`,
        price: item.finalPrice || item.price || 0,
        originalPrice: item.price || 0,
        discount: item.discount || 0,
        category: item.category || item.productType || 'Plants',
        productType: item.productType || 'plant',
        
        // Enhanced image handling
        image: processedImages.mainImage || generateFallbackImage(item, business),
        mainImage: processedImages.mainImage,
        images: processedImages.images,
        hasImages: processedImages.hasImages,
        imageCount: processedImages.imageCount,
        
        // Business info
        businessId: business.id || business.email,
        sellerId: business.id || business.email,
        sellerType: 'business',
        isBusinessListing: true,
        inventoryId: item.id,
        
        // Enhanced seller info
        seller: {
          _id: business.id || business.email,
          id: business.id || business.email,
          name: business.businessName || business.name || 'Business',
          email: business.email || business.id,
          isBusiness: true,
          businessName: business.businessName || business.name,
          businessType: business.businessType || 'Business',
          rating: business.rating || 0,
          reviewCount: business.reviewCount || 0,
          description: business.description || '',
          phone: business.phone || '',
          website: business.website || '',
          socialMedia: business.socialMedia || {},
          verified: business.verified || false,
          location: {
            city: businessLocation.city || 'Contact for location',
            address: businessLocation.address || '',
            latitude: businessLocation.latitude,
            longitude: businessLocation.longitude,
          }
        },
        
        // Enhanced location
        location: {
          city: businessLocation.city || 'Contact for location',
          state: businessLocation.state || '',
          country: businessLocation.country || '',
          latitude: businessLocation.latitude,
          longitude: businessLocation.longitude,
          formattedAddress: businessLocation.formattedAddress || businessLocation.address || '',
        },
        
        // Enhanced product details
        specifications: {
          size: item.size || '',
          weight: item.weight || '',
          dimensions: item.dimensions || '',
          material: item.material || '',
          color: item.color || '',
          condition: item.condition || 'new',
          warranty: item.warranty || '',
        },
        
        // Enhanced inventory details
        inventory: {
          quantity: item.quantity || 0,
          minThreshold: item.minThreshold || 5,
          maxQuantity: item.maxQuantity || item.quantity || 1,
          restockDate: item.restockDate || '',
          supplier: item.supplier || '',
        },
        
        // Enhanced pricing
        pricing: {
          basePrice: item.price || 0,
          finalPrice: item.finalPrice || item.price || 0,
          discount: item.discount || 0,
          currency: item.currency || 'ILS',
          negotiable: item.negotiable || false,
          bulkPricing: item.bulkPricing || [],
        },
        
        addedAt: item.addedAt || item.dateAdded || new Date().toISOString(),
        updatedAt: item.updatedAt || item.lastUpdated || new Date().toISOString(),
        status: 'active',
        
        // Enhanced stats
        stats: {
          views: item.viewCount || 0,
          wishlistCount: item.wishlistCount || 0,
          messageCount: item.messageCount || 0,
          purchaseCount: item.purchaseCount || 0,
          rating: item.rating || 0,
          reviewCount: item.reviewCount || 0,
        },
        
        // Enhanced tags and metadata
        tags: item.tags || [],
        keywords: item.keywords || [],
        features: item.features || [],
        benefits: item.benefits || [],
        
        source: 'business_inventory',
        platform: 'greener',
        lastSync: new Date().toISOString(),
      };
    });
};

/**
 * RESTORED: Enhanced individual product processing
 */
const processIndividualProducts = (products) => {
  if (!Array.isArray(products)) {
    console.warn('⚠️ Products is not an array:', products);
    return [];
  }

  return products.map(product => {
    const processedImages = processIndividualProductImages(product);
    
    return {
      ...product,
      // Enhanced image handling
      image: processedImages.mainImage,
      mainImage: processedImages.mainImage,
      images: processedImages.images,
      hasImages: processedImages.hasImages,
      
      // Ensure consistent seller info
      sellerType: 'individual',
      isBusinessListing: false,
      seller: {
        ...product.seller,
        isBusiness: false,
      },
      
      // Enhanced location formatting
      location: {
        ...product.location,
        formattedAddress: product.location?.address || product.location?.city || '',
      },
      
      // Enhanced stats
      stats: {
        views: product.views || 0,
        wishlistCount: product.wishlistCount || 0,
        messageCount: product.messageCount || 0,
        ...product.stats,
      },
      
      source: 'individual_listing',
      platform: 'greener',
      lastSync: new Date().toISOString(),
    };
  });
};

/**
 * FIXED: Get all businesses with correct endpoint
 */
const getAllBusinesses = async () => {
  const cacheKey = 'all_businesses';
  const cached = businessCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < cacheTimeout) {
    console.log('📱 Using cached businesses data');
    return cached.data;
  }
  
  try {
    // FIXED: Use the correct endpoint that matches backend function name
    const response = await apiRequest('get-all-businesses');
    const businesses = response.businesses || response.data || [];
    
    businessCache.set(cacheKey, {
      data: businesses,
      timestamp: Date.now()
    });
    
    console.log(`✅ Loaded ${businesses.length} businesses`);
    return businesses;
  } catch (error) {
    console.error('❌ Get businesses failed:', error);
    
    // Return cached data if available, even if stale
    if (cached) {
      console.log('📱 Using stale cached businesses data due to error');
      return cached.data;
    }
    
    return [];
  }
};

/**
 * FIXED: Marketplace API with standardized business product integration
 */
export const fetchBusinessProfile = async (businessId) => {
  if (!businessId) {
    throw new Error('Business ID is required');
  }
  
  // Check unified cache first
  try {
    const unifiedCache = await AsyncStorage.getItem('unified_business_profile');
    if (unifiedCache) {
      const cached = JSON.parse(unifiedCache);
      if (Date.now() - cached.timestamp < 300000) { // 5 minutes
        console.log('📱 Using unified cached business profile');
        return { success: true, business: cached.data };
      }
    }
  } catch (cacheError) {
    console.warn('Cache read error:', cacheError);
  }
  
  // FIXED: Use the correct endpoint that matches the backend route
  const endpoint = `business-profile`;
  
  try {
    const result = await apiRequest(endpoint);
    
    // Update unified cache
    await AsyncStorage.setItem('unified_business_profile', JSON.stringify({
      data: result.business || result.profile,
      timestamp: Date.now(),
      source: 'marketplace'
    }));

    return result;
  } catch (error) {
    console.error('Fetch business profile failed:', error);
    throw error;
  }
};

/**
 * FIXED: Get business inventory with correct endpoint
 */
export const fetchBusinessInventory = async (businessId) => {
  if (!businessId) {
    throw new Error('Business ID is required');
  }
  
  // Check unified cache first
  try {
    const unifiedCache = await AsyncStorage.getItem('unified_business_inventory');
    if (unifiedCache) {
      const cached = JSON.parse(unifiedCache);
      if (Date.now() - cached.timestamp < 180000 && cached.businessId === businessId) { // 3 minutes
        console.log('📱 Using unified cached business inventory');
        return { success: true, inventory: cached.data };
      }
    }
  } catch (cacheError) {
    console.warn('Cache read error:', cacheError);
  }
  
  // FIXED: Use the correct endpoint that matches the backend route: marketplace/business/{businessId}/inventory
  const endpoint = `marketplace/business/${encodeURIComponent(businessId)}/inventory`;
  
  try {
    const result = await apiRequest(endpoint);
    
    // Update unified cache
    await AsyncStorage.setItem('unified_business_inventory', JSON.stringify({
      data: result.inventory || result.items,
      businessId,
      timestamp: Date.now(),
      source: 'marketplace'
    }));

    return result;
  } catch (error) {
    console.error('Fetch business inventory failed:', error);
    throw error;
  }
};

/**
 * FIXED: Update user profile with sync bridge integration
 */
export const updateUserProfile = async (userId, userData) => {
  const endpoint = `user-profile/${userId}`;
  
  try {
    const result = await apiRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });

    // FIXED: Trigger sync bridge for profile updates
    if (userData.isBusiness || userData.userType === 'business') {
      await addBusinessProfileSync(userData, 'marketplace');
    }

    // Clear related caches
    await invalidateMarketplaceCache([
      `user_profile_${userId}`,
      `seller_profile_${userId}`,
      'marketplace_plants'
    ]);

    return result;
  } catch (error) {
    console.error('Update user profile failed:', error);
    throw error;
  }
};

export const fetchUserProfile = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  const endpoint = `marketplace/users/${userId}`;
  return apiRequest(endpoint);
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
  
  if (typeof imageData === 'string' && imageData.startsWith('data:')) {
    return apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({ image: imageData, type }),
    });
  }
  
  const formData = new FormData();
  formData.append('file', imageData);
  formData.append('type', type);
  
  return apiRequest(endpoint, {
    method: 'POST',
    body: formData,
    headers: {},
  });
};

// ==========================================
// BUSINESS PURCHASE FUNCTIONS
// ==========================================

export const purchaseBusinessProduct = async (productId, businessId, quantity = 1, customerInfo) => {
  // CRITICAL FIX: Use correct backend function name
  const endpoint = 'business-order-create';
  
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

// ==========================================
// AZURE MAPS INTEGRATION (FIXED ENDPOINTS)
// ==========================================

export const getAzureMapsKey = async () => {
  // FIXED: Use the enhanced Azure Maps service
  const { getAzureMapsKey } = await import('./azureMapsService');
  return getAzureMapsKey();
};

export const geocodeAddress = async (address) => {
  if (!address || typeof address !== 'string') {
    throw new Error('Valid address required');
  }
  
  // FIXED: Use the enhanced Azure Maps service
  const { geocodeAddress } = await import('./azureMapsService');
  return geocodeAddress(address);
};

export const reverseGeocode = async (latitude, longitude) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Valid coordinates required');
  }
  
  // FIXED: Use the enhanced Azure Maps service
  const { reverseGeocode } = await import('./azureMapsService');
  return reverseGeocode(latitude, longitude);
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

  const text = response.text || '';
  return text.replace(/[.,!?;:'"()\[\]{}]/g, '').replace(/\s+/g, ' ').trim();
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

/**
 * Send an order-related message (auto chat for order events)
 * If a conversation exists, sends a message. Otherwise, starts a new conversation.
 * @param {string} recipientId - The user or business to message
 * @param {string} message - The message text
 * @param {string} senderId - The sender's user id/email
 * @param {object} [context] - Optional context (e.g. orderId, confirmationNumber)
 * @returns {Promise<object>} - Result of sending/starting conversation
 */
export const sendOrderMessage = async (recipientId, message, senderId, context = {}) => {
  if (!recipientId || !message || !senderId) throw new Error('recipientId, message, and senderId are required');
  // Try to find an existing conversation
  try {
    // Fetch all conversations for sender
    const conversations = await fetchConversations(senderId);
    let conversation = null;
    if (Array.isArray(conversations)) {
      conversation = conversations.find(
        conv => (conv.sellerId === recipientId || conv.otherUserEmail === recipientId || conv.otherUserId === recipientId)
      );
    }
    if (conversation) {
      // Send message in existing conversation
      return await sendMessage(conversation.id, message, senderId);
    } else {
      // Start new conversation
      return await startConversation(recipientId, context?.orderId || null, message, senderId);
    }
  } catch (err) {
    // Fallback: try to start conversation
    return await startConversation(recipientId, context?.orderId || null, message, senderId);
  }
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
  sendTypingIndicator,
  sendOrderMessage
};