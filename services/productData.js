/**
 * productData.js
 * Service for handling plant product data with Azure Functions
 */

import { Platform } from 'react-native';

// Base URL for Azure Functions
const baseUrl = 'https://usersfunctions.azurewebsites.net/api';

/**
 * Get all products with optional filtering
 * @param {number} page - Page number for pagination
 * @param {string} category - Optional category filter
 * @param {string} query - Optional search query
 * @returns {Promise<Object>} - Products with pagination info
 */
export async function getAll(page = 1, category, query) {
  try {
    let endpoint = `${baseUrl}/products?page=${page}`;

    if (query && query !== '') {
      endpoint += `&search=${encodeURIComponent(query)}`;
    } else if (category && category !== 'all') {
      endpoint = `${baseUrl}/products/${encodeURIComponent(category)}?page=${page}`;
    }

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    return await res.json();
  } catch (error) {
    console.error('Error fetching all products:', error);
    
    // During development, return mock data on error
    if (__DEV__) {
      return getMockProducts(category, query);
    }
    
    throw error;
  }
}

/**
 * Get a specific product by ID
 * @param {string} id - Product ID
 * @returns {Promise<Object>} - Product details
 */
export async function getSpecific(id) {
  try {
    const res = await fetch(`${baseUrl}/products/specific/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    return await res.json();
  } catch (error) {
    console.error(`Error fetching product with ID ${id}:`, error);
    
    // During development, return mock data on error
    if (__DEV__) {
      return getMockProductById(id);
    }
    
    throw error;
  }
}

/**
 * Create a new product
 * @param {Object} product - Product data
 * @returns {Promise<Object>} - Created product result
 */
export async function createProduct(product) {
  try {
    // Handle image upload - convert to base64 if needed
    let productData = { ...product };
    
    if (typeof productData.image === 'string' && !productData.image.startsWith('data:')) {
      productData.image = await getBase64FromUri(productData.image);
    }
    
    const res = await fetch(`${baseUrl}/products/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(productData),
    });

    return await res.json();
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
}

/**
 * Edit an existing product
 * @param {string} id - Product ID
 * @param {Object} product - Updated product data
 * @returns {Promise<Object>} - Edit result
 */
export async function editProduct(id, product) {
  try {
    // Handle image upload if needed
    let productData = { ...product };
    
    if (typeof productData.image === 'string' && !productData.image.startsWith('data:')) {
      productData.image = await getBase64FromUri(productData.image);
    }
    
    const res = await fetch(`${baseUrl}/products/edit/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(productData),
    });

    return await res.json();
  } catch (error) {
    console.error(`Error editing product ${id}:`, error);
    throw error;
  }
}

/**
 * Activate a previously archived product
 * @param {string} id - Product ID
 * @returns {Promise<Object>} - Activation result
 */
export async function activateSell(id) {
  try {
    const res = await fetch(`${baseUrl}/products/enable/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    return await res.json();
  } catch (error) {
    console.error(`Error activating product ${id}:`, error);
    throw error;
  }
}

/**
 * Archive a product (hide from marketplace)
 * @param {string} id - Product ID
 * @returns {Promise<Object>} - Archive result
 */
export async function archiveSell(id) {
  try {
    const res = await fetch(`${baseUrl}/products/archive/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    return await res.json();
  } catch (error) {
    console.error(`Error archiving product ${id}:`, error);
    throw error;
  }
}

/**
 * Add/remove a product to user's wishlist
 * @param {string} id - Product ID
 * @returns {Promise<Object>} - Wishlist update result
 */
export async function wishProduct(id) {
  try {
    const res = await fetch(`${baseUrl}/products/wish/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    return await res.json();
  } catch (error) {
    console.error(`Error toggling wishlist for product ${id}:`, error);
    throw error;
  }
}

// Helper function to convert a local image URI to base64
export async function getBase64FromUri(uri) {
  // Handle platform differences
  if (Platform.OS === 'web') {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw error;
    }
  } else {
    // For React Native (requires additional handling for native platforms)
    // You may need to use expo-file-system or react-native-fs
    try {
      const FileSystem = require('expo-file-system');
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw error;
    }
  }
}

// MOCK DATA IMPLEMENTATION FOR DEVELOPMENT/TESTING
// -------------------------------

// Sample plant data for testing
const MOCK_PLANTS = [
  {
    _id: '1',
    id: '1',
    title: 'Monstera Deliciosa',
    name: 'Monstera Deliciosa',
    description: 'Beautiful Swiss Cheese Plant with large fenestrated leaves. Perfect for adding a tropical feel to your home.',
    price: 29.99,
    image: 'https://via.placeholder.com/150?text=Monstera',
    imageUrl: 'https://via.placeholder.com/150?text=Monstera',
    sellerName: 'PlantLover123',
    sellerId: 'seller1',
    city: 'Seattle',
    location: 'Seattle, WA',
    category: 'indoor',
    addedAt: new Date().toISOString(),
    listedDate: new Date().toISOString(),
    active: true,
    isFavorite: false,
    rating: 4.7
  },
  {
    _id: '2',
    id: '2',
    title: 'Snake Plant',
    name: 'Snake Plant',
    description: 'Low maintenance indoor plant, perfect for beginners. Purifies air and thrives in low light conditions.',
    price: 19.99,
    image: 'https://via.placeholder.com/150?text=Snake+Plant',
    imageUrl: 'https://via.placeholder.com/150?text=Snake+Plant',
    sellerName: 'GreenThumb',
    sellerId: 'seller2',
    city: 'Portland',
    location: 'Portland, OR',
    category: 'indoor',
    addedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    listedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    active: true,
    isFavorite: true,
    rating: 4.5
  },
  {
    _id: '3',
    id: '3',
    title: 'Fiddle Leaf Fig',
    name: 'Fiddle Leaf Fig',
    description: 'Trendy houseplant with violin-shaped leaves. Makes a stunning focal point in any room.',
    price: 34.99,
    image: 'https://via.placeholder.com/150?text=Fiddle+Leaf',
    imageUrl: 'https://via.placeholder.com/150?text=Fiddle+Leaf',
    sellerName: 'PlantPro',
    sellerId: 'seller3',
    city: 'San Francisco',
    location: 'San Francisco, CA',
    category: 'indoor',
    addedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
    listedDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    active: true,
    isFavorite: false,
    rating: 4.2
  },
  {
    _id: '4',
    id: '4',
    title: 'Cactus Collection',
    name: 'Cactus Collection',
    description: 'Set of 3 small decorative cacti. Perfect for windowsills and desks.',
    price: 18.99,
    image: 'https://via.placeholder.com/150?text=Cactus',
    imageUrl: 'https://via.placeholder.com/150?text=Cactus',
    sellerName: 'DesertDreams',
    sellerId: 'seller4',
    city: 'Phoenix',
    location: 'Phoenix, AZ',
    category: 'succulent',
    addedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    listedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    active: true,
    isFavorite: false,
    rating: 4.9
  },
  {
    _id: '5',
    id: '5',
    title: 'Lavender Plant',
    name: 'Lavender Plant',
    description: 'Fragrant flowering plant perfect for outdoors. Attracts butterflies and bees.',
    price: 15.99,
    image: 'https://via.placeholder.com/150?text=Lavender',
    imageUrl: 'https://via.placeholder.com/150?text=Lavender',
    sellerName: 'GardenGuru',
    sellerId: 'seller5',
    city: 'Los Angeles',
    location: 'Los Angeles, CA',
    category: 'outdoor',
    addedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    listedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    active: true,
    isFavorite: false,
    rating: 4.6
  },
  {
    _id: '6',
    id: '6',
    title: 'Rose Bush',
    name: 'Rose Bush',
    description: 'Classic red rose bush for your garden. Highly fragrant blooms throughout summer.',
    price: 22.99,
    image: 'https://via.placeholder.com/150?text=Rose',
    imageUrl: 'https://via.placeholder.com/150?text=Rose',
    sellerName: 'FlowerPower',
    sellerId: 'seller6',
    city: 'Chicago',
    location: 'Chicago, IL',
    category: 'outdoor',
    addedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    listedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    active: true,
    isFavorite: false,
    rating: 4.7
  }
];

// Mock implementation to get products
function getMockProducts(category, query) {
  let filtered = [...MOCK_PLANTS];
  
  // Filter by category
  if (category && category !== 'all') {
    filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }
  
  // Filter by search query
  if (query && query !== '') {
    const lowercaseQuery = query.toLowerCase();
    filtered = filtered.filter(p => 
      p.title?.toLowerCase().includes(lowercaseQuery) || 
      p.description?.toLowerCase().includes(lowercaseQuery) ||
      p.city?.toLowerCase().includes(lowercaseQuery)
    );
  }
  
  return {
    products: filtered,
    pages: 1,
    currentPage: 1,
    count: filtered.length
  };
}

// Mock implementation to get a product by ID
function getMockProductById(id) {
  const product = MOCK_PLANTS.find(p => p._id === id || p.id === id);
  
  if (!product) {
    throw new Error('Product not found');
  }
  
  return product;
}