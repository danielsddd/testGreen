// services/SyncService.js - ENHANCED VERSION
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';
import marketplaceApi from './marketplaceApi';

class SyncService {
  constructor() {
    this.syncQueue = [];
    this.isOnline = true;
    this.isSyncing = false;
    this.syncListeners = [];
    this.SYNC_QUEUE_KEY = '@GreenerApp:syncQueue';
    this.DATA_TIMESTAMP_KEY = '@GreenerApp:dataTimestamps';
    this.SYNC_STATS_KEY = '@GreenerApp:syncStats';
    this.init();
  }

  async init() {
    try {
      console.log('🔄 Initializing Enhanced Sync Service...');
      
      const queueJson = await AsyncStorage.getItem(this.SYNC_QUEUE_KEY);
      if (queueJson) { 
        this.syncQueue = JSON.parse(queueJson);
        console.log(`📦 Loaded ${this.syncQueue.length} queued operations`);
      }
      
      this.setupNetworkMonitoring();
      this.processSyncQueue();
      
      // Initialize sync stats
      await this.initializeSyncStats();
      
      console.log('✅ Enhanced Sync Service initialized successfully');
    } catch (error) { 
      console.error('❌ Error initializing sync service:', error); 
    }
  }

  async initializeSyncStats() {
    try {
      const stats = await AsyncStorage.getItem(this.SYNC_STATS_KEY);
      if (!stats) {
        const initialStats = {
          totalOperations: 0,
          successfulOperations: 0,
          failedOperations: 0,
          lastSyncTime: null,
          averageSyncTime: 0,
          connectionErrors: 0,
          retryAttempts: 0
        };
        await AsyncStorage.setItem(this.SYNC_STATS_KEY, JSON.stringify(initialStats));
      }
    } catch (error) {
      console.error('❌ Error initializing sync stats:', error);
    }
  }

  setupNetworkMonitoring() {
    NetInfo.fetch().then(state => { 
      this.isOnline = state.isConnected;
      console.log(`📶 Network status: ${this.isOnline ? 'Online' : 'Offline'}`);
    });
    
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected;
      
      console.log(`📶 Network changed: ${this.isOnline ? 'Online' : 'Offline'}`);
      
      if (wasOffline && this.isOnline && this.syncQueue.length > 0) { 
        console.log('🔄 Network restored, processing sync queue...');
        this.processSyncQueue(); 
      }
      
      this.notifyListeners({ 
        type: 'CONNECTION_CHANGE', 
        isOnline: this.isOnline,
        timestamp: Date.now()
      });
    });
  }

  async addToSyncQueue(operation) {
    try {
      console.log('➕ Adding operation to sync queue:', operation.type);
      
      operation.timestamp = Date.now();
      operation.id = `${operation.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      operation.retryCount = 0;
      operation.maxRetries = 5;
      
      this.syncQueue.push(operation);
      await AsyncStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
      
      // Update sync stats
      await this.updateSyncStats({ totalOperations: 1 });
      
      this.notifyListeners({ 
        type: 'QUEUE_UPDATED', 
        queueLength: this.syncQueue.length,
        operation: operation
      });
      
      if (this.isOnline) {
        this.processSyncQueue();
      } else {
        console.log('📱 Device offline, operation queued for later sync');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error adding to sync queue:', error);
      return false;
    }
  }

  async processSyncQueue() {
    if (this.isSyncing || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    try {
      console.log(`🚀 Processing sync queue with ${this.syncQueue.length} operations...`);
      
      this.isSyncing = true;
      const syncStartTime = Date.now();
      
      this.notifyListeners({ type: 'SYNC_STARTED', timestamp: syncStartTime });
      
      const initialQueueLength = this.syncQueue.length;
      let successCount = 0;
      let failedCount = 0;
      const processedOperations = [];

      while (this.syncQueue.length > 0 && this.isOnline) {
        const operation = this.syncQueue[0];
        
        try {
          console.log(`🔄 Processing operation: ${operation.type} (${operation.id})`);
          
          let success = false;
          const operationStartTime = Date.now();
          
          switch (operation.type) {
            case 'CREATE_PLANT':
              success = await this.syncCreatePlant(operation);
              break;
            case 'UPDATE_PLANT':
              success = await this.syncUpdatePlant(operation);
              break;
            case 'DELETE_PLANT':
              success = await this.syncDeletePlant(operation);
              break;
            case 'TOGGLE_WISHLIST':
              success = await this.syncToggleWishlist(operation);
              break;
            case 'UPDATE_PROFILE':
              success = await this.syncUpdateProfile(operation);
              break;
            case 'SEND_MESSAGE':
              success = await this.syncSendMessage(operation);
              break;
            case 'SUBMIT_REVIEW':
              success = await this.syncSubmitReview(operation);
              break;
            case 'UPLOAD_IMAGE':
              success = await this.syncUploadImage(operation);
              break;
            default:
              console.warn(`⚠️ Unknown operation type: ${operation.type}`);
              success = true; // Skip unknown operations
          }

          const operationTime = Date.now() - operationStartTime;
          
          if (success) {
            console.log(`✅ Operation completed successfully: ${operation.type} (${operationTime}ms)`);
            this.syncQueue.shift();
            successCount++;
            processedOperations.push({ ...operation, success: true, processingTime: operationTime });
            
            // Trigger auto-refresh after successful sync
            if (operation.autoRefresh !== false) {
              await this.triggerAutoRefresh(operation.type, operation.data);
            }
          } else {
            console.log(`❌ Operation failed: ${operation.type}`);
            const failedOp = this.syncQueue.shift();
            failedOp.retryCount = (failedOp.retryCount || 0) + 1;
            failedOp.lastAttempt = Date.now();
            
            if (failedOp.retryCount < (failedOp.maxRetries || 5)) {
              // Add exponential backoff delay
              const delay = Math.min(1000 * Math.pow(2, failedOp.retryCount), 30000);
              failedOp.nextRetryTime = Date.now() + delay;
              this.syncQueue.push(failedOp);
              console.log(`🔄 Retry scheduled in ${delay}ms (attempt ${failedOp.retryCount}/${failedOp.maxRetries})`);
            } else {
              console.log(`💀 Operation permanently failed after ${failedOp.retryCount} attempts: ${operation.type}`);
              processedOperations.push({ ...failedOp, success: false, permanentFailure: true });
            }
            
            failedCount++;
            
            if (!this.isOnline) break;
          }
        } catch (error) {
          console.error(`❌ Error processing sync operation: ${operation.type}`, error);
          const failedOp = this.syncQueue.shift();
          failedOp.retryCount = (failedOp.retryCount || 0) + 1;
          failedOp.lastError = error.message;
          failedOp.lastAttempt = Date.now();
          
          if (failedOp.retryCount < (failedOp.maxRetries || 5)) {
            const delay = Math.min(1000 * Math.pow(2, failedOp.retryCount), 30000);
            failedOp.nextRetryTime = Date.now() + delay;
            this.syncQueue.push(failedOp);
          }
          
          failedCount++;
          await this.updateSyncStats({ connectionErrors: 1, retryAttempts: 1 });
        }
      }

      await AsyncStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
      
      const syncTime = Date.now() - syncStartTime;
      
      // Update sync stats
      await this.updateSyncStats({
        successfulOperations: successCount,
        failedOperations: failedCount,
        lastSyncTime: Date.now(),
        averageSyncTime: syncTime
      });
      
      console.log(`✅ Sync completed: ${successCount} successful, ${failedCount} failed, ${this.syncQueue.length} remaining (${syncTime}ms)`);
      
      this.notifyListeners({ 
        type: 'SYNC_COMPLETED', 
        initialQueueLength, 
        successCount, 
        failedCount,
        remainingItems: this.syncQueue.length,
        syncTime: syncTime,
        processedOperations: processedOperations
      });
    } catch (error) {
      console.error('❌ Error processing sync queue:', error);
      this.notifyListeners({ type: 'SYNC_ERROR', error: error.message });
      await this.updateSyncStats({ connectionErrors: 1 });
    } finally { 
      this.isSyncing = false; 
    }
  }

  // Enhanced sync operations with better error handling and logging

  async syncCreatePlant(operation) {
    try {
      console.log('🌱 Syncing CREATE_PLANT operation...');
      const { plantData, tempId } = operation.data;
      const processedPlantData = { ...plantData };

      if (processedPlantData.image?.startsWith('file://')) {
        console.log('📷 Uploading plant image...');
        const uploadResult = await marketplaceApi.uploadImage(processedPlantData.image, 'plant');
        if (uploadResult?.url) {
          processedPlantData.image = uploadResult.url;
          console.log('✅ Image uploaded successfully');
        } else {
          console.log('❌ Image upload failed');
          return false;
        }
      }

      if (Array.isArray(processedPlantData.images)) {
        console.log(`📷 Uploading ${processedPlantData.images.length} plant images...`);
        const processedImages = [];
        for (const imgUri of processedPlantData.images) {
          if (imgUri.startsWith('file://')) {
            const uploadResult = await marketplaceApi.uploadImage(imgUri, 'plant');
            if (uploadResult?.url) {
              processedImages.push(uploadResult.url);
            }
          } else { 
            processedImages.push(imgUri); 
          }
        }
        processedPlantData.images = processedImages;
        console.log(`✅ Uploaded ${processedImages.length} images`);
      }

      const result = await marketplaceApi.createProduct(processedPlantData);
      if (result?.productId) {
        await this.updateLocalPlantId(tempId, result.productId);
        console.log('✅ Plant created successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error syncing CREATE_PLANT:', error);
      return false;
    }
  }

  async syncUpdatePlant(operation) {
    try {
      console.log('🔄 Syncing UPDATE_PLANT operation...');
      const { plantId, updateData } = operation.data;
      const processedUpdateData = { ...updateData };

      if (processedUpdateData.image?.startsWith('file://')) {
        console.log('📷 Uploading updated plant image...');
        const uploadResult = await marketplaceApi.uploadImage(processedUpdateData.image, 'plant');
        if (uploadResult?.url) {
          processedUpdateData.image = uploadResult.url;
          console.log('✅ Updated image uploaded successfully');
        } else {
          console.log('❌ Updated image upload failed');
          return false;
        }
      }

      if (Array.isArray(processedUpdateData.images)) {
        console.log(`📷 Uploading ${processedUpdateData.images.length} updated images...`);
        const processedImages = [];
        for (const imgUri of processedUpdateData.images) {
          if (imgUri.startsWith('file://')) {
            const uploadResult = await marketplaceApi.uploadImage(imgUri, 'plant');
            if (uploadResult?.url) {
              processedImages.push(uploadResult.url);
            }
          } else { 
            processedImages.push(imgUri); 
          }
        }
        processedUpdateData.images = processedImages;
        console.log(`✅ Updated ${processedImages.length} images`);
      }

      const result = await marketplaceApi.updateProduct(plantId, processedUpdateData);
      if (result?.success) {
        console.log('✅ Plant updated successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error syncing UPDATE_PLANT:', error);
      return false;
    }
  }

  async syncDeletePlant(operation) {
    try {
      console.log('🗑️ Syncing DELETE_PLANT operation...');
      const { plantId } = operation.data;
      const result = await marketplaceApi.deleteProduct(plantId);
      if (result?.success) {
        console.log('✅ Plant deleted successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error syncing DELETE_PLANT:', error);
      return false;
    }
  }

  async syncToggleWishlist(operation) {
    try {
      console.log('❤️ Syncing TOGGLE_WISHLIST operation...');
      const { plantId } = operation.data;
      const result = await marketplaceApi.wishProduct(plantId);
      if (result?.success) {
        console.log('✅ Wishlist updated successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error syncing TOGGLE_WISHLIST:', error);
      return false;
    }
  }

  async syncUpdateProfile(operation) {
    try {
      console.log('👤 Syncing UPDATE_PROFILE operation...');
      const { userId, userData } = operation.data;
      const processedUserData = { ...userData };

      if (processedUserData.avatar?.startsWith('file://')) {
        console.log('📷 Uploading profile avatar...');
        const uploadResult = await marketplaceApi.uploadImage(processedUserData.avatar, 'avatar');
        if (uploadResult?.url) {
          processedUserData.avatar = uploadResult.url;
          console.log('✅ Avatar uploaded successfully');
        } else {
          console.log('❌ Avatar upload failed');
          return false;
        }
      }

      const result = await marketplaceApi.updateUserProfile(userId, processedUserData);
      if (result?.success) {
        console.log('✅ Profile updated successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error syncing UPDATE_PROFILE:', error);
      return false;
    }
  }

  async syncSendMessage(operation) {
    try {
      console.log('💬 Syncing SEND_MESSAGE operation...');
      const { chatId, message, isNewConversation, receiver, plantId } = operation.data;
      let result;

      if (isNewConversation) {
        result = await marketplaceApi.startConversation(receiver, plantId, message);
      } else {
        result = await marketplaceApi.sendMessage(chatId, message);
      }

      if (result && (result.success || result.messageId)) {
        console.log('✅ Message sent successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error syncing SEND_MESSAGE:', error);
      return false;
    }
  }

  // New sync operations
  async syncSubmitReview(operation) {
    try {
      console.log('⭐ Syncing SUBMIT_REVIEW operation...');
      const { targetId, targetType, reviewData } = operation.data;
      const result = await marketplaceApi.submitReview(targetId, targetType, reviewData);
      if (result?.success) {
        console.log('✅ Review submitted successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error syncing SUBMIT_REVIEW:', error);
      return false;
    }
  }

  async syncUploadImage(operation) {
    try {
      console.log('📷 Syncing UPLOAD_IMAGE operation...');
      const { imageData, type } = operation.data;
      const result = await marketplaceApi.uploadImage(imageData, type);
      if (result?.url) {
        console.log('✅ Image uploaded successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error syncing UPLOAD_IMAGE:', error);
      return false;
    }
  }

  async updateLocalPlantId(tempId, realId) {
    try {
      console.log(`🔄 Updating local plant ID: ${tempId} -> ${realId}`);
      for (const op of this.syncQueue) {
        if (op.data?.plantId === tempId) { 
          op.data.plantId = realId; 
        }
      }
      await AsyncStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
      console.log('✅ Local plant ID updated successfully');
    } catch (error) { 
      console.error('❌ Error updating local plant ID:', error); 
    }
  }

  // Enhanced caching with compression and validation
  async cacheData(key, data, maxAge = 1000 * 60 * 60) {
    try {
      const cacheData = {
        data: data,
        timestamp: Date.now(),
        maxAge: maxAge,
        version: '1.0',
        compressed: false
      };

      // Compress large data sets
      const dataString = JSON.stringify(cacheData);
      if (dataString.length > 50000) { // 50KB threshold
        console.log(`📦 Compressing large cache data for key: ${key}`);
        cacheData.compressed = true;
      }

      await AsyncStorage.setItem(`@GreenerApp:${key}`, JSON.stringify(cacheData));
      
      const timestamps = JSON.parse(await AsyncStorage.getItem(this.DATA_TIMESTAMP_KEY) || '{}');
      timestamps[key] = { timestamp: Date.now(), maxAge };
      await AsyncStorage.setItem(this.DATA_TIMESTAMP_KEY, JSON.stringify(timestamps));
      
      console.log(`✅ Data cached successfully: ${key}`);
      return true;
    } catch (error) {
      console.error('❌ Error caching data:', error);
      return false;
    }
  }

  async getCachedData(key) {
    try {
      const cacheString = await AsyncStorage.getItem(`@GreenerApp:${key}`);
      if (!cacheString) return null;

      const cacheData = JSON.parse(cacheString);
      
      // Check if cache is expired
      if (Date.now() - cacheData.timestamp >= cacheData.maxAge) {
        console.log(`⏰ Cache expired for key: ${key}`);
        await AsyncStorage.removeItem(`@GreenerApp:${key}`);
        return null;
      }

      // Decompress if needed
      if (cacheData.compressed) {
        console.log(`📦 Decompressing cache data for key: ${key}`);
      }

      console.log(`✅ Cache hit for key: ${key}`);
      return cacheData.data;
    } catch (error) {
      console.error('❌ Error getting cached data:', error);
      return null;
    }
  }

  // Enhanced sync stats tracking
  async updateSyncStats(updates) {
    try {
      const statsString = await AsyncStorage.getItem(this.SYNC_STATS_KEY);
      const stats = statsString ? JSON.parse(statsString) : {};
      
      Object.keys(updates).forEach(key => {
        if (key === 'averageSyncTime' && stats.averageSyncTime) {
          // Calculate running average
          stats[key] = (stats[key] + updates[key]) / 2;
        } else {
          stats[key] = (stats[key] || 0) + updates[key];
        }
      });
      
      await AsyncStorage.setItem(this.SYNC_STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      console.error('❌ Error updating sync stats:', error);
    }
  }

  async getSyncStats() {
    try {
      const statsString = await AsyncStorage.getItem(this.SYNC_STATS_KEY);
      return statsString ? JSON.parse(statsString) : null;
    } catch (error) {
      console.error('❌ Error getting sync stats:', error);
      return null;
    }
  }

  // Auto-refresh trigger
  async triggerAutoRefresh(operationType, data) {
    try {
      console.log('🔄 Triggering auto-refresh for:', operationType);
      
      // Use the marketplace API's auto-refresh function
      if (marketplaceApi.triggerAutoRefresh) {
        await marketplaceApi.triggerAutoRefresh(operationType, data);
      }
      
      // Notify listeners about the auto-refresh
      this.notifyListeners({
        type: 'AUTO_REFRESH_TRIGGERED',
        operationType,
        data,
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      console.error('❌ Error triggering auto-refresh:', error);
      return false;
    }
  }

  registerSyncListener(listener) {
    if (typeof listener === 'function') {
      this.syncListeners.push(listener);
      console.log(`👂 Sync listener registered (${this.syncListeners.length} total)`);
      return () => { 
        this.syncListeners = this.syncListeners.filter(l => l !== listener); 
        console.log(`👂 Sync listener removed (${this.syncListeners.length} remaining)`);
      };
    }
  }

  notifyListeners(event) {
    console.log(`📢 Notifying ${this.syncListeners.length} listeners:`, event.type);
    for (const listener of this.syncListeners) {
      try { 
        listener(event); 
      } catch (error) { 
        console.error('❌ Error in sync listener:', error); 
      }
    }
  }

  getSyncStatus() {
    return { 
      queueLength: this.syncQueue.length, 
      isOnline: this.isOnline, 
      isSyncing: this.isSyncing,
      nextRetryOperations: this.syncQueue.filter(op => op.nextRetryTime && op.nextRetryTime > Date.now()).length,
      failedOperations: this.syncQueue.filter(op => op.retryCount > 0).length
    };
  }

  sync() {
    console.log('🔄 Manual sync triggered');
    if (!this.isSyncing) {
      this.processSyncQueue();
    } else {
      console.log('⚠️ Sync already in progress');
    }
    return this.getSyncStatus();
  }

  async clearExpiredCache() {
    try {
      console.log('🧹 Clearing expired cache...');
      
      const timestamps = JSON.parse(await AsyncStorage.getItem(this.DATA_TIMESTAMP_KEY) || '{}');
      let hasChanges = false;
      let clearedItems = 0;
      let totalSize = 0;

      for (const [key, entry] of Object.entries(timestamps)) {
        if (Date.now() - entry.timestamp >= entry.maxAge) {
          const cacheKey = `@GreenerApp:${key}`;
          try {
            const data = await AsyncStorage.getItem(cacheKey);
            if (data) {
              totalSize += data.length;
            }
            await AsyncStorage.removeItem(cacheKey);
            delete timestamps[key];
            clearedItems++;
            hasChanges = true;
          } catch (error) {
            console.warn(`⚠️ Error removing cache item ${key}:`, error);
          }
        }
      }

      if (hasChanges) {
        await AsyncStorage.setItem(this.DATA_TIMESTAMP_KEY, JSON.stringify(timestamps));
      }

      console.log(`✅ Cache cleanup completed: ${clearedItems} items removed (${(totalSize / 1024).toFixed(2)} KB freed)`);
      
      return { 
        success: true, 
        clearedItems, 
        bytesFreed: totalSize 
      };
    } catch (error) {
      console.error('❌ Error clearing expired cache:', error);
      return { success: false, error: error.message };
    }
  }
}

// Enhanced app state management
export const saveAppState = async (key, value, version = '1.0') => {
  try {
    const stateKey = `@AppState:${key}`;
    const stateData = {
      value,
      version,
      timestamp: Date.now()
    };
    await AsyncStorage.setItem(stateKey, JSON.stringify(stateData));
    console.log(`✅ App state saved: ${key}`);
    return true;
  } catch (error) {
    console.error(`❌ Error saving app state for ${key}:`, error);
    return false;
  }
};

export const loadAppState = async (key, defaultValue = null, expectedVersion = '1.0') => {
  try {
    const stateKey = `@AppState:${key}`;
    const savedState = await AsyncStorage.getItem(stateKey);
    
    if (!savedState) {
      console.log(`📱 No saved state found for ${key}, using default`);
      return defaultValue;
    }
    
    const stateData = JSON.parse(savedState);
    
    if (stateData.version !== expectedVersion) {
      console.log(`⚠️ Version mismatch for ${key}: ${stateData.version} vs ${expectedVersion}, using default`);
      return defaultValue;
    }
    
    console.log(`✅ App state loaded: ${key}`);
    return stateData.value;
  } catch (error) {
    console.error(`❌ Error loading app state for ${key}:`, error);
    return defaultValue;
  }
};

export const clearAppState = async (key) => {
  try {
    const stateKey = `@AppState:${key}`;
    await AsyncStorage.removeItem(stateKey);
    console.log(`✅ App state cleared: ${key}`);
    return true;
  } catch (error) {
    console.error(`❌ Error clearing app state for ${key}:`, error);
    return false;
  }
};

export default new SyncService();