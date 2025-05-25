// Business/services/notificationPollingApi.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
const DEFAULT_TIMEOUT = 10000;

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

// Helper function to make API calls
const apiCall = async (endpoint, options = {}) => {
  const headers = await getHeaders();
  const config = {
    timeout: DEFAULT_TIMEOUT,
    headers,
    ...options,
  };

  try {
    console.log(`🔔 Notification API Call: ${endpoint}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);
    
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      ...config,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const responseText = await response.text();
    console.log(`📋 Notification Response Status: ${response.status}`);
    
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
    console.log(`✅ Notification API Success: ${endpoint}`, data);
    return data;
    
  } catch (error) {
    console.error(`❌ Notification API Error:`, error.message);
    throw error;
  }
};

/**
 * Get pending notifications for a business
 */
export const getPendingNotifications = async (businessId) => {
  try {
    if (!businessId) {
      throw new Error('Business ID is required');
    }
    
    const data = await apiCall(`business/pending-notifications?businessId=${businessId}`);
    
    return {
      notifications: data.notifications || [],
      hasNotifications: data.hasNotifications || false,
      summary: data.summary || {
        plantsNeedingWater: 0,
        plantsWateredToday: 0,
        lowStockItems: 0
      },
      timestamp: data.timestamp || new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting pending notifications:', error);
    return {
      notifications: [],
      hasNotifications: false,
      summary: {
        plantsNeedingWater: 0,
        plantsWateredToday: 0,
        lowStockItems: 0
      },
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (notificationId, notificationType) => {
  try {
    if (!notificationId) {
      throw new Error('Notification ID is required');
    }
    
    const businessId = await AsyncStorage.getItem('businessId');
    
    const data = await apiCall('business/mark-notification-read', {
      method: 'POST',
      body: JSON.stringify({
        businessId,
        notificationId,
        notificationType
      })
    });
    
    return data;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw new Error('Failed to mark notification as read');
  }
};

/**
 * Get notification settings for a business
 */
export const getNotificationSettings = async (businessId) => {
  try {
    if (!businessId) {
      throw new Error('Business ID is required');
    }
    
    const data = await apiCall(`business/notification-settings?businessId=${businessId}`);
    
    return {
      settings: data.settings || {
        notificationTime: '07:00',
        enableWateringReminders: true,
        enableLowStockAlerts: true,
        enableSuccessNotifications: true,
        pollingInterval: 60,
        status: 'active'
      }
    };
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return {
      settings: {
        notificationTime: '07:00',
        enableWateringReminders: true,
        enableLowStockAlerts: true,
        enableSuccessNotifications: true,
        pollingInterval: 60,
        status: 'active'
      }
    };
  }
};

/**
 * Update notification settings
 */
export const updateNotificationSettings = async (settings) => {
  try {
    if (!settings) {
      throw new Error('Settings are required');
    }
    
    const data = await apiCall('business/notification-settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
    
    return data;
  } catch (error) {
    console.error('Error updating notification settings:', error);
    throw new Error('Failed to update notification settings');
  }
};

/**
 * Start notification polling
 */
export const startNotificationPolling = (onNewNotifications, interval = 60000) => {
  let pollingTimer = null;
  let isPolling = false;
  
  const poll = async () => {
    if (isPolling) return;
    
    try {
      isPolling = true;
      const businessId = await AsyncStorage.getItem('businessId');
      
      if (businessId) {
        const data = await getPendingNotifications(businessId);
        
        if (data.hasNotifications && onNewNotifications) {
          onNewNotifications(data.notifications, data.summary);
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    } finally {
      isPolling = false;
    }
  };
  
  // Start polling
  pollingTimer = setInterval(poll, interval);
  
  // Initial poll
  poll();
  
  // Return cleanup function
  return () => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  };
};

/**
 * Cache management for notifications
 */
const CACHE_KEY = 'notifications_cache';
const CACHE_EXPIRY = 2 * 60 * 1000; // 2 minutes

export const getCachedNotifications = async () => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      
      // Check if cache is still valid
      if (Date.now() - timestamp < CACHE_EXPIRY) {
        return data;
      }
    }
    return [];
  } catch (error) {
    console.error('Error getting cached notifications:', error);
    return [];
  }
};

export const setCachedNotifications = async (notifications) => {
  try {
    const cacheObject = {
      data: notifications,
      timestamp: Date.now()
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheObject));
  } catch (error) {
    console.error('Error caching notifications:', error);
  }
};

export const clearNotificationCache = async () => {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('Error clearing notification cache:', error);
  }
};