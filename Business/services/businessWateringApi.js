// Business/services/businessWateringApi.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
const DEFAULT_TIMEOUT = 15000;

class ApiError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.response = response;
  }
}

// Helper function to get headers
const getHeaders = async () => {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    const userType = await AsyncStorage.getItem('userType');
    const businessId = await AsyncStorage.getItem('businessId');
    
    return {
      'Content-Type': 'application/json',
      'X-User-Email': userEmail || '',
      'X-User-Type': userType || 'business',
      'X-Business-ID': businessId || '',
    };
  } catch (error) {
    console.error('Error getting headers:', error);
    return {
      'Content-Type': 'application/json',
    };
  }
};

// Helper function to make API calls with retry logic
const apiCall = async (endpoint, options = {}) => {
  const headers = await getHeaders();
  const config = {
    timeout: DEFAULT_TIMEOUT,
    headers,
    ...options,
  };

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`🔗 API Call (attempt ${attempt}): ${endpoint}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);
      
      const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
        ...config,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const responseText = await response.text();
      console.log(`📋 Response Status: ${response.status}`);
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = responseText || errorMessage;
        }
        throw new ApiError(errorMessage, response.status, responseText);
      }
      
      const data = responseText ? JSON.parse(responseText) : {};
      console.log(`✅ API Success: ${endpoint}`, data);
      return data;
      
    } catch (error) {
      lastError = error;
      console.error(`❌ API Error (attempt ${attempt}):`, error.message);
      
      // Don't retry on client errors (4xx)
      if (error.status >= 400 && error.status < 500) {
        break;
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  
  throw lastError;
};

/**
 * Get watering checklist for a business
 */
export const getWateringChecklist = async (businessId, silent = false) => {
  try {
    if (!businessId) {
      throw new Error('Business ID is required');
    }
    
    const data = await apiCall(`business/watering-checklist?businessId=${businessId}`);
    
    return {
      checklist: data.checklist || [],
      totalCount: data.totalCount || 0,
      needsWateringCount: data.needsWateringCount || 0,
      timestamp: data.timestamp || new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting watering checklist:', error);
    if (!silent) {
      throw new Error('Failed to load watering checklist');
    }
    return {
      checklist: [],
      totalCount: 0,
      needsWateringCount: 0,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Mark a plant as watered
 */
export const markPlantAsWatered = async (plantId, method = 'manual', coordinates = null) => {
  try {
    if (!plantId) {
      throw new Error('Plant ID is required');
    }
    
    const businessId = await AsyncStorage.getItem('businessId');
    
    const requestBody = {
      plantId,
      method,
      businessId
    };
    
    if (coordinates) {
      requestBody.coordinates = coordinates;
    }
    
    const data = await apiCall('business/watering-checklist', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });
    
    return data;
  } catch (error) {
    console.error('Error marking plant as watered:', error);
    throw new Error('Failed to mark plant as watered');
  }
};

/**
 * Get optimized watering route
 */
export const getOptimizedWateringRoute = async (businessId) => {
  try {
    if (!businessId) {
      throw new Error('Business ID is required');
    }
    
    const data = await apiCall(`business/optimize-watering-route?businessId=${businessId}`);
    
    return {
      route: data.route || [],
      routeType: data.routeType || 'location',
      totalPlants: data.totalPlants || 0,
      estimatedTime: data.estimatedTime || { minutes: 0, formatted: '0 min' }
    };
  } catch (error) {
    console.error('Error getting optimized route:', error);
    throw new Error('Failed to generate optimized watering route');
  }
};

/**
 * Get weather information for business location
 */
export const getBusinessWeather = async (businessId) => {
  try {
    if (!businessId) {
      throw new Error('Business ID is required');
    }
    
    // Mock weather data for now - replace with actual weather API
    return {
      location: 'Business Location',
      temperature: 22,
      condition: 'Partly Cloudy',
      precipitation: 10
    };
  } catch (error) {
    console.error('Error getting weather:', error);
    return null;
  }
};

/**
 * Generate plant barcode PDF URL
 */
export const getPlantBarcodeUrl = async (plantId, businessId) => {
  try {
    if (!plantId || !businessId) {
      throw new Error('Plant ID and Business ID are required');
    }
    
    const data = await apiCall(`business/generate-plant-barcode?plantId=${plantId}&businessId=${businessId}`);
    
    return data.pdfUrl || null;
  } catch (error) {
    console.error('Error getting barcode URL:', error);
    throw new Error('Failed to generate barcode URL');
  }
};

/**
 * Register for watering notifications
 */
export const registerForWateringNotifications = async (deviceToken, notificationTime) => {
  try {
    if (!deviceToken || !notificationTime) {
      throw new Error('Device token and notification time are required');
    }
    
    const businessId = await AsyncStorage.getItem('businessId');
    
    const data = await apiCall('business/register-notification', {
      method: 'POST',
      body: JSON.stringify({
        businessId,
        deviceToken,
        notificationTime
      })
    });
    
    return data;
  } catch (error) {
    console.error('Error registering for notifications:', error);
    throw new Error('Failed to register for notifications');
  }
};

/**
 * Cache management for offline support
 */
const CACHE_KEY = 'watering_checklist_cache';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

export const getCachedWateringChecklist = async () => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      
      // Check if cache is still valid
      if (Date.now() - timestamp < CACHE_EXPIRY) {
        return data;
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting cached checklist:', error);
    return null;
  }
};

export const setCachedWateringChecklist = async (data) => {
  try {
    const cacheObject = {
      data,
      timestamp: Date.now()
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheObject));
  } catch (error) {
    console.error('Error caching checklist:', error);
  }
};

export const clearWateringCache = async () => {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};