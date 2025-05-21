// Business/services/businessWateringApi.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';

/**
 * Get watering checklist for a business
 * @param {string} businessId 
 * @returns {Promise<Array>}
 */
export const getWateringChecklist = async (businessId) => {
  try {
    if (!businessId) {
      businessId = await AsyncStorage.getItem('businessId');
    }
    
    const response = await fetch(`${API_BASE_URL}/business/watering-checklist?businessId=${businessId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': await AsyncStorage.getItem('userEmail'),
        'X-User-Type': 'business',
        'X-Business-ID': businessId
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching watering checklist:', error);
    throw error;
  }
};

/**
 * Mark a plant as watered
 * @param {string} plantId 
 * @param {string} method - 'manual', 'barcode', or 'gps'
 * @param {Object} coordinates - optional GPS coordinates
 * @returns {Promise<Object>}
 */
export const markPlantAsWatered = async (plantId, method = 'manual', coordinates = null) => {
  try {
    const businessId = await AsyncStorage.getItem('businessId');
    
    const response = await fetch(`${API_BASE_URL}/business/watering-checklist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': await AsyncStorage.getItem('userEmail'),
        'X-User-Type': 'business',
        'X-Business-ID': businessId
      },
      body: JSON.stringify({
        businessId,
        plantId,
        method,
        coordinates
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error marking plant as watered:', error);
    throw error;
  }
};

/**
 * Get optimized watering route
 * @param {string} businessId 
 * @returns {Promise<Object>}
 */
export const getOptimizedWateringRoute = async (businessId) => {
  try {
    if (!businessId) {
      businessId = await AsyncStorage.getItem('businessId');
    }
    
    const response = await fetch(`${API_BASE_URL}/business/optimize-watering-route?businessId=${businessId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': await AsyncStorage.getItem('userEmail'),
        'X-User-Type': 'business',
        'X-Business-ID': businessId
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching optimized watering route:', error);
    throw error;
  }
};

/**
 * Get plant barcode PDF URL
 * @param {string} plantId 
 * @param {string} businessId 
 * @returns {string} URL to download barcode PDF
 */
export const getPlantBarcodeUrl = (plantId, businessId) => {
  return `${API_BASE_URL}/business/generate-barcode?businessId=${businessId}&plantId=${plantId}`;
};

/**
 * Register device for watering notifications
 * @param {string} deviceToken 
 * @param {string} notificationTime - Format: HH:MM (24-hour)
 * @returns {Promise<Object>}
 */
export const registerForWateringNotifications = async (deviceToken, notificationTime = '07:00') => {
  try {
    const businessId = await AsyncStorage.getItem('businessId');
    
    // This would be a separate function in a real implementation
    // For now, we'll just return a mock response
    console.log(`Registered device ${deviceToken} for watering notifications at ${notificationTime}`);
    
    return {
      success: true,
      message: `Notifications will be sent at ${notificationTime}`,
      businessId,
      notificationTime
    };
  } catch (error) {
    console.error('Error registering for watering notifications:', error);
    throw error;
  }
};