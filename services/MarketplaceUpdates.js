// services/MarketplaceUpdates.js - Enhanced Auto-Refresh Service
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Update event types
export const UPDATE_TYPES = {
  WISHLIST: 'WISHLIST_UPDATED',
  PRODUCT: 'PRODUCT_UPDATED',
  PROFILE: 'PROFILE_UPDATED',
  REVIEW: 'REVIEW_UPDATED',
  MESSAGE: 'MESSAGE_UPDATED',
  INVENTORY: 'INVENTORY_UPDATED',
  ORDER: 'ORDER_UPDATED',
  BUSINESS_PROFILE: 'BUSINESS_PROFILE_UPDATED',
  DASHBOARD: 'DASHBOARD_UPDATED',
  SETTINGS: 'SETTINGS_UPDATED',
  CUSTOMER: 'CUSTOMER_UPDATED',
  WATERING: 'WATERING_UPDATED',
  NOTIFICATION: 'NOTIFICATION_UPDATED'
};

// Storage keys for different update types
const STORAGE_KEYS = {
  [UPDATE_TYPES.WISHLIST]: 'marketplace_wishlist_update',
  [UPDATE_TYPES.PRODUCT]: 'marketplace_product_update',
  [UPDATE_TYPES.PROFILE]: 'marketplace_profile_update',
  [UPDATE_TYPES.REVIEW]: 'marketplace_review_update',
  [UPDATE_TYPES.MESSAGE]: 'marketplace_message_update',
  [UPDATE_TYPES.INVENTORY]: 'business_inventory_update',
  [UPDATE_TYPES.ORDER]: 'business_order_update',
  [UPDATE_TYPES.BUSINESS_PROFILE]: 'business_profile_update',
  [UPDATE_TYPES.DASHBOARD]: 'business_dashboard_update',
  [UPDATE_TYPES.SETTINGS]: 'business_settings_update',
  [UPDATE_TYPES.CUSTOMER]: 'business_customer_update',
  [UPDATE_TYPES.WATERING]: 'business_watering_update',
  [UPDATE_TYPES.NOTIFICATION]: 'business_notification_update'
};

// Event listeners map for cleanup
const listeners = new Map();
const updateListeners = new Map();

/**
 * Enhanced trigger update with retry mechanism and validation
 * @param {string} updateType - Type of update from UPDATE_TYPES
 * @param {Object} data - Update data
 * @param {Object} options - Options like silent, retry
 * @returns {Promise<boolean>} Success status
 */
export const triggerUpdate = async (updateType, data = {}, options = {}) => {
  const { silent = false, retry = true } = options;
  
  try {
    // Validate update type
    if (!Object.values(UPDATE_TYPES).includes(updateType)) {
      console.warn(`[MarketplaceUpdates] Invalid update type: ${updateType}`);
      return false;
    }
    
    const updateInfo = {
      timestamp: Date.now(),
      type: updateType,
      source: Platform.OS,
      ...data
    };
    
    // Store update info
    const storageKey = STORAGE_KEYS[updateType] || updateType;
    await AsyncStorage.setItem(storageKey, JSON.stringify(updateInfo));
    
    // Web-specific cross-tab communication
    if (Platform.OS === 'web') {
      try {
        // Set localStorage for cross-tab detection
        window.localStorage.setItem(`${storageKey}_EVENT`, JSON.stringify(updateInfo));
        
        // Dispatch custom event
        const customEvent = new CustomEvent('MARKETPLACE_UPDATE', {
          detail: { type: updateType, data: updateInfo }
        });
        window.dispatchEvent(customEvent);
        
        // Broadcast channel for better cross-tab communication
        if (window.BroadcastChannel) {
          const channel = new BroadcastChannel('greener_updates');
          channel.postMessage({ type: updateType, data: updateInfo });
          channel.close();
        }
      } catch (webError) {
        console.warn('[MarketplaceUpdates] Web event dispatch failed:', webError);
      }
    }
    
    // Notify registered listeners
    notifyUpdateListeners(updateType, updateInfo);
    
    if (!silent) {
      console.log(`[MarketplaceUpdates] ✅ Triggered ${updateType} update:`, updateInfo);
    }
    
    return true;
  } catch (error) {
    console.error(`[MarketplaceUpdates] ❌ Error triggering ${updateType} update:`, error);
    
    // Retry once on failure
    if (retry) {
      console.log(`[MarketplaceUpdates] 🔄 Retrying ${updateType} update...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return triggerUpdate(updateType, data, { ...options, retry: false });
    }
    
    return false;
  }
};

/**
 * Enhanced check for updates with comparison logic
 * @param {string} updateType - Type of update to check
 * @param {number} since - Timestamp to check since (default: 0)
 * @param {boolean} includeData - Whether to return update data
 * @returns {Promise<boolean|Object>} Update status or data
 */
export const checkForUpdate = async (updateType, since = 0, includeData = false) => {
  try {
    if (!Object.values(UPDATE_TYPES).includes(updateType)) {
      console.warn(`[MarketplaceUpdates] Invalid update type for check: ${updateType}`);
      return false;
    }
    
    const storageKey = STORAGE_KEYS[updateType] || updateType;
    const storedUpdate = await AsyncStorage.getItem(storageKey);
    
    if (!storedUpdate) {
      return includeData ? null : false;
    }
    
    const updateInfo = JSON.parse(storedUpdate);
    const hasUpdate = updateInfo.timestamp > since;
    
    if (includeData && hasUpdate) {
      return updateInfo;
    }
    
    return hasUpdate;
  } catch (error) {
    console.error(`[MarketplaceUpdates] ❌ Error checking ${updateType} update:`, error);
    return includeData ? null : false;
  }
};

/**
 * Get the latest update timestamp for a type
 * @param {string} updateType - Type of update
 * @returns {Promise<number|null>} Timestamp or null
 */
export const getLastUpdateTimestamp = async (updateType) => {
  try {
    const updateInfo = await checkForUpdate(updateType, 0, true);
    return updateInfo ? updateInfo.timestamp : null;
  } catch (error) {
    console.error(`[MarketplaceUpdates] Error getting timestamp for ${updateType}:`, error);
    return null;
  }
};

/**
 * Enhanced clear update with validation
 * @param {string} updateType - Type of update to clear
 * @returns {Promise<boolean>} Success status
 */
export const clearUpdate = async (updateType) => {
  try {
    if (!Object.values(UPDATE_TYPES).includes(updateType)) {
      console.warn(`[MarketplaceUpdates] Invalid update type for clear: ${updateType}`);
      return false;
    }
    
    const storageKey = STORAGE_KEYS[updateType] || updateType;
    await AsyncStorage.removeItem(storageKey);
    
    // Clear web localStorage as well
    if (Platform.OS === 'web') {
      try {
        window.localStorage.removeItem(`${storageKey}_EVENT`);
      } catch (webError) {
        console.warn('[MarketplaceUpdates] Web storage clear failed:', webError);
      }
    }
    
    console.log(`[MarketplaceUpdates] ✅ Cleared ${updateType} update`);
    return true;
  } catch (error) {
    console.error(`[MarketplaceUpdates] ❌ Error clearing ${updateType} update:`, error);
    return false;
  }
};

/**
 * Clear all updates (useful for logout or reset)
 * @returns {Promise<boolean>} Success status
 */
export const clearAllUpdates = async () => {
  try {
    const clearPromises = Object.values(UPDATE_TYPES).map(updateType => 
      clearUpdate(updateType).catch(error => {
        console.warn(`Failed to clear ${updateType}:`, error);
        return false;
      })
    );
    
    const results = await Promise.all(clearPromises);
    const allSuccessful = results.every(result => result === true);
    
    console.log(`[MarketplaceUpdates] ${allSuccessful ? '✅' : '⚠️'} Cleared all updates`);
    return allSuccessful;
  } catch (error) {
    console.error('[MarketplaceUpdates] Error clearing all updates:', error);
    return false;
  }
};

/**
 * Register listener for specific update types
 * @param {string} id - Unique listener ID
 * @param {string|Array} updateTypes - Update type(s) to listen for
 * @param {Function} callback - Callback function
 */
export const addUpdateListener = (id, updateTypes, callback) => {
  if (typeof callback !== 'function') {
    console.warn('[MarketplaceUpdates] Callback must be a function');
    return;
  }
  
  const types = Array.isArray(updateTypes) ? updateTypes : [updateTypes];
  
  // Validate update types
  const validTypes = types.filter(type => Object.values(UPDATE_TYPES).includes(type));
  if (validTypes.length === 0) {
    console.warn('[MarketplaceUpdates] No valid update types provided');
    return;
  }
  
  // Store listener info
  updateListeners.set(id, {
    types: validTypes,
    callback,
    addedAt: Date.now()
  });
  
  // Web-specific event listener
  if (Platform.OS === 'web') {
    const handleUpdate = (event) => {
      if (event.detail && validTypes.includes(event.detail.type)) {
        callback(event.detail.type, event.detail.data);
      }
    };
    
    listeners.set(id, handleUpdate);
    window.addEventListener('MARKETPLACE_UPDATE', handleUpdate);
    
    // Also listen to broadcast channel
    if (window.BroadcastChannel) {
      try {
        const channel = new BroadcastChannel('greener_updates');
        const channelListener = (event) => {
          if (event.data && validTypes.includes(event.data.type)) {
            callback(event.data.type, event.data.data);
          }
        };
        
        channel.addEventListener('message', channelListener);
        listeners.set(`${id}_broadcast`, { channel, listener: channelListener });
      } catch (channelError) {
        console.warn('[MarketplaceUpdates] BroadcastChannel setup failed:', channelError);
      }
    }
  }
  
  console.log(`[MarketplaceUpdates] ✅ Added listener ${id} for types:`, validTypes);
};

/**
 * Remove update listener
 * @param {string} id - Listener ID to remove
 */
export const removeUpdateListener = (id) => {
  // Remove from update listeners
  if (updateListeners.has(id)) {
    updateListeners.delete(id);
  }
  
  // Web-specific cleanup
  if (Platform.OS === 'web') {
    // Remove window event listener
    const listener = listeners.get(id);
    if (listener) {
      window.removeEventListener('MARKETPLACE_UPDATE', listener);
      listeners.delete(id);
    }
    
    // Remove broadcast channel listener
    const broadcastData = listeners.get(`${id}_broadcast`);
    if (broadcastData && broadcastData.channel) {
      try {
        broadcastData.channel.removeEventListener('message', broadcastData.listener);
        broadcastData.channel.close();
        listeners.delete(`${id}_broadcast`);
      } catch (channelError) {
        console.warn('[MarketplaceUpdates] BroadcastChannel cleanup failed:', channelError);
      }
    }
  }
  
  console.log(`[MarketplaceUpdates] ✅ Removed listener ${id}`);
};

/**
 * Notify all registered update listeners
 * @param {string} updateType - Type of update
 * @param {Object} data - Update data
 */
const notifyUpdateListeners = (updateType, data) => {
  updateListeners.forEach((listenerInfo, id) => {
    if (listenerInfo.types.includes(updateType)) {
      try {
        listenerInfo.callback(updateType, data);
      } catch (callbackError) {
        console.error(`[MarketplaceUpdates] Listener ${id} callback error:`, callbackError);
      }
    }
  });
};

/**
 * Get update statistics for debugging
 * @returns {Promise<Object>} Update statistics
 */
export const getUpdateStats = async () => {
  try {
    const stats = {
      totalListeners: updateListeners.size,
      listenerBreakdown: {},
      recentUpdates: {},
      timestamp: Date.now()
    };
    
    // Count listeners by type
    updateListeners.forEach((listenerInfo, id) => {
      listenerInfo.types.forEach(type => {
        if (!stats.listenerBreakdown[type]) {
          stats.listenerBreakdown[type] = 0;
        }
        stats.listenerBreakdown[type]++;
      });
    });
    
    // Get recent update timestamps
    for (const updateType of Object.values(UPDATE_TYPES)) {
      const timestamp = await getLastUpdateTimestamp(updateType);
      if (timestamp) {
        stats.recentUpdates[updateType] = {
          timestamp,
          timeAgo: Date.now() - timestamp
        };
      }
    }
    
    return stats;
  } catch (error) {
    console.error('[MarketplaceUpdates] Error getting stats:', error);
    return {
      totalListeners: 0,
      listenerBreakdown: {},
      recentUpdates: {},
      error: error.message,
      timestamp: Date.now()
    };
  }
};

/**
 * Batch trigger multiple updates
 * @param {Array} updates - Array of {type, data} objects
 * @param {Object} options - Global options
 * @returns {Promise<Object>} Results summary
 */
export const batchTriggerUpdates = async (updates, options = {}) => {
  try {
    const results = {
      successful: 0,
      failed: 0,
      errors: [],
      timestamp: Date.now()
    };
    
    const updatePromises = updates.map(async ({ type, data = {} }) => {
      try {
        const success = await triggerUpdate(type, data, { ...options, silent: true });
        if (success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push({ type, error: 'Trigger failed' });
        }
        return success;
      } catch (error) {
        results.failed++;
        results.errors.push({ type, error: error.message });
        return false;
      }
    });
    
    await Promise.all(updatePromises);
    
    console.log(`[MarketplaceUpdates] Batch update complete:`, results);
    return results;
  } catch (error) {
    console.error('[MarketplaceUpdates] Batch update error:', error);
    return {
      successful: 0,
      failed: updates.length,
      errors: [{ error: error.message }],
      timestamp: Date.now()
    };
  }
};

/**
 * Auto-refresh helper for components
 * @param {Array} updateTypes - Update types to watch
 * @param {Function} refreshCallback - Function to call on updates
 * @param {Object} options - Options like debounce, immediate
 * @returns {Function} Cleanup function
 */
export const useAutoRefresh = (updateTypes, refreshCallback, options = {}) => {
  const { debounce = 1000, immediate = false } = options;
  const listenerId = `auto_refresh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  let debounceTimer = null;
  
  const debouncedRefresh = (...args) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(() => {
      refreshCallback(...args);
      debounceTimer = null;
    }, debounce);
  };
  
  // Add listener
  addUpdateListener(listenerId, updateTypes, debouncedRefresh);
  
  // Immediate refresh if requested
  if (immediate) {
    refreshCallback();
  }
  
  // Return cleanup function
  return () => {
    removeUpdateListener(listenerId);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  };
};

// Cleanup function for app shutdown
export const cleanup = () => {
  // Remove all listeners
  listeners.forEach((listener, id) => {
    removeUpdateListener(id);
  });
  
  updateListeners.clear();
  listeners.clear();
  
  console.log('[MarketplaceUpdates] ✅ Cleanup completed');
};

// Export for convenience
export default {
  UPDATE_TYPES,
  triggerUpdate,
  checkForUpdate,
  getLastUpdateTimestamp,
  clearUpdate,
  clearAllUpdates,
  addUpdateListener,
  removeUpdateListener,
  getUpdateStats,
  batchTriggerUpdates,
  useAutoRefresh,
  cleanup
};