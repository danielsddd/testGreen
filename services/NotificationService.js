// services/NotificationService.js - Marketplace Notification Management
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const NOTIFICATION_KEYS = {
  SETTINGS: '@GreenerApp:notificationSettings',
  HISTORY: '@GreenerApp:notificationHistory',
  TOKENS: '@GreenerApp:deviceTokens',
  QUEUE: '@GreenerApp:notificationQueue'
};

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class NotificationService {
  constructor() {
    this.deviceToken = null;
    this.isInitialized = false;
    this.notificationQueue = [];
    this.settings = {
      enabled: true,
      soundEnabled: true,
      vibrationEnabled: true,
      showPreviews: true,
      categories: {
        messages: { enabled: true, sound: 'default' },
        wishlist: { enabled: true, sound: 'default' },
        orders: { enabled: true, sound: 'default' },
        reviews: { enabled: true, sound: 'default' },
        general: { enabled: true, sound: 'default' }
      }
    };
    this.listeners = new Map();
  }

  /**
   * Initialize notification service
   */
  async initialize() {
    try {
      console.log('🔔 Initializing Notification Service...');
      
      // Load settings
      await this.loadSettings();
      
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      
      if (status !== 'granted') {
        console.warn('⚠️ Notification permissions not granted');
        return false;
      }

      // Get device token
      if (Platform.OS !== 'web') {
        const token = await Notifications.getExpoPushTokenAsync();
        this.deviceToken = token.data;
        console.log('📱 Device token obtained:', this.deviceToken?.substring(0, 20) + '...');
        
        // Save token
        await this.saveDeviceToken(this.deviceToken);
      }

      // Setup notification listeners
      this.setupNotificationListeners();
      
      // Process queued notifications
      await this.processNotificationQueue();
      
      this.isInitialized = true;
      console.log('✅ Notification Service initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Error initializing notification service:', error);
      return false;
    }
  }

  /**
   * Setup notification listeners
   */
  setupNotificationListeners() {
    // Notification received while app is in foreground
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('🔔 Notification received:', notification);
      this.handleNotificationReceived(notification);
    });

    // Notification tapped/clicked
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👆 Notification tapped:', response);
      this.handleNotificationTapped(response);
    });
  }

  /**
   * Handle notification received in foreground
   */
  async handleNotificationReceived(notification) {
    try {
      // Save to history
      await this.saveNotificationToHistory(notification);

      // Notify listeners
      this.notifyListeners('received', notification);

      // Handle specific notification types
      await this.handleSpecificNotification(notification);
    } catch (error) {
      console.error('❌ Error handling received notification:', error);
    }
  }

  /**
   * Handle notification tapped
   */
  async handleNotificationTapped(response) {
    try {
      const notification = response.notification;
      const actionIdentifier = response.actionIdentifier;

      // Save interaction to history
      await this.saveNotificationInteraction(notification, actionIdentifier);

      // Notify listeners
      this.notifyListeners('tapped', { notification, actionIdentifier });

      // Handle navigation based on notification data
      await this.handleNotificationNavigation(notification);
    } catch (error) {
      console.error('❌ Error handling notification tap:', error);
    }
  }

  /**
   * Handle specific notification types
   */
  async handleSpecificNotification(notification) {
    const { data } = notification.request.content;
    
    switch (data?.type) {
      case 'message':
        await this.handleMessageNotification(data);
        break;
      case 'order':
        await this.handleOrderNotification(data);
        break;
      case 'wishlist':
        await this.handleWishlistNotification(data);
        break;
      case 'review':
        await this.handleReviewNotification(data);
        break;
      default:
        console.log('ℹ️ Generic notification handling');
    }
  }

  /**
   * Handle message notifications
   */
  async handleMessageNotification(data) {
    try {
      // Update message cache
      const cacheKey = `cached_conversations_${data.userId}`;
      await AsyncStorage.removeItem(cacheKey);
      
      // Update badge count
      if (data.unreadCount) {
        await this.updateBadgeCount(data.unreadCount);
      }
      
      console.log('💬 Message notification handled');
    } catch (error) {
      console.error('❌ Error handling message notification:', error);
    }
  }

  /**
   * Handle order notifications
   */
  async handleOrderNotification(data) {
    try {
      // Clear order cache
      await AsyncStorage.removeItem('cached_orders');
      
      console.log('📦 Order notification handled');
    } catch (error) {
      console.error('❌ Error handling order notification:', error);
    }
  }

  /**
   * Send local notification
   */
  async sendLocalNotification(title, body, data = {}, options = {}) {
    try {
      if (!this.settings.enabled) {
        console.log('🔕 Notifications disabled, skipping local notification');
        return null;
      }

      const notificationContent = {
        title,
        body,
        data: {
          timestamp: Date.now(),
          ...data
        },
        sound: this.settings.soundEnabled ? (options.sound || 'default') : false,
        ...options
      };

      const identifier = await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: options.trigger || null, // null = immediate
      });

      console.log('📨 Local notification sent:', identifier);
      return identifier;
    } catch (error) {
      console.error('❌ Error sending local notification:', error);
      return null;
    }
  }

  /**
   * Send push notification via server
   */
  async sendPushNotification(userId, title, body, data = {}, options = {}) {
    try {
      if (!this.deviceToken) {
        console.warn('⚠️ No device token available for push notification');
        return false;
      }

      // This would typically call your backend API
      const response = await fetch('https://usersfunctions.azurewebsites.net/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': await AsyncStorage.getItem('userEmail')
        },
        body: JSON.stringify({
          to: userId,
          title,
          body,
          data,
          options
        })
      });

      if (response.ok) {
        console.log('📤 Push notification sent successfully');
        return true;
      } else {
        console.error('❌ Failed to send push notification:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Error sending push notification:', error);
      return false;
    }
  }

  /**
   * Schedule notification
   */
  async scheduleNotification(title, body, trigger, data = {}, options = {}) {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            scheduled: true,
            scheduledAt: Date.now(),
            ...data
          },
          sound: this.settings.soundEnabled ? (options.sound || 'default') : false,
        },
        trigger,
      });

      console.log('⏰ Notification scheduled:', identifier);
      return identifier;
    } catch (error) {
      console.error('❌ Error scheduling notification:', error);
      return null;
    }
  }

  /**
   * Cancel notification
   */
  async cancelNotification(identifier) {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      console.log('🚫 Notification cancelled:', identifier);
      return true;
    } catch (error) {
      console.error('❌ Error cancelling notification:', error);
      return false;
    }
  }

  /**
   * Get notification settings
   */
  async getSettings() {
    return { ...this.settings };
  }

  /**
   * Update notification settings
   */
  async updateSettings(newSettings) {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await AsyncStorage.setItem(NOTIFICATION_KEYS.SETTINGS, JSON.stringify(this.settings));
      
      console.log('⚙️ Notification settings updated');
      return true;
    } catch (error) {
      console.error('❌ Error updating notification settings:', error);
      return false;
    }
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_KEYS.SETTINGS);
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
        console.log('⚙️ Notification settings loaded');
      }
    } catch (error) {
      console.error('❌ Error loading notification settings:', error);
    }
  }

  /**
   * Save notification to history
   */
  async saveNotificationToHistory(notification) {
    try {
      const history = await this.getNotificationHistory();
      const historyEntry = {
        id: notification.request.identifier,
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data,
        receivedAt: Date.now(),
        read: false
      };

      history.unshift(historyEntry);
      
      // Keep only last 100 notifications
      if (history.length > 100) {
        history.splice(100);
      }

      await AsyncStorage.setItem(NOTIFICATION_KEYS.HISTORY, JSON.stringify(history));
    } catch (error) {
      console.error('❌ Error saving notification to history:', error);
    }
  }

  /**
   * Get notification history
   */
  async getNotificationHistory() {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_KEYS.HISTORY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Error getting notification history:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId) {
    try {
      const history = await this.getNotificationHistory();
      const notification = history.find(n => n.id === notificationId);
      
      if (notification) {
        notification.read = true;
        notification.readAt = Date.now();
        await AsyncStorage.setItem(NOTIFICATION_KEYS.HISTORY, JSON.stringify(history));
        
        console.log('👁️ Notification marked as read:', notificationId);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      return false;
    }
  }

  /**
   * Clear notification history
   */
  async clearNotificationHistory() {
    try {
      await AsyncStorage.removeItem(NOTIFICATION_KEYS.HISTORY);
      console.log('🧹 Notification history cleared');
      return true;
    } catch (error) {
      console.error('❌ Error clearing notification history:', error);
      return false;
    }
  }

  /**
   * Update badge count
   */
  async updateBadgeCount(count) {
    try {
      if (Platform.OS === 'ios') {
        await Notifications.setBadgeCountAsync(count);
        console.log('📱 Badge count updated:', count);
      }
      return true;
    } catch (error) {
      console.error('❌ Error updating badge count:', error);
      return false;
    }
  }

  /**
   * Save device token
   */
  async saveDeviceToken(token) {
    try {
      const tokens = await this.getDeviceTokens();
      const newToken = {
        token,
        platform: Platform.OS,
        addedAt: Date.now(),
        active: true
      };

      // Remove old tokens for this platform
      const filteredTokens = tokens.filter(t => t.platform !== Platform.OS);
      filteredTokens.push(newToken);

      await AsyncStorage.setItem(NOTIFICATION_KEYS.TOKENS, JSON.stringify(filteredTokens));
      console.log('💾 Device token saved');
    } catch (error) {
      console.error('❌ Error saving device token:', error);
    }
  }

  /**
   * Get device tokens
   */
  async getDeviceTokens() {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_KEYS.TOKENS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Error getting device tokens:', error);
      return [];
    }
  }

  /**
   * Register listener
   */
  addListener(id, callback) {
    this.listeners.set(id, callback);
    console.log(`👂 Notification listener added: ${id}`);
    
    return () => {
      this.listeners.delete(id);
      console.log(`👂 Notification listener removed: ${id}`);
    };
  }

  /**
   * Notify all listeners
   */
  notifyListeners(type, data) {
    this.listeners.forEach((callback, id) => {
      try {
        callback(type, data);
      } catch (error) {
        console.error(`❌ Error in notification listener ${id}:`, error);
      }
    });
  }

  /**
   * Process notification queue
   */
  async processNotificationQueue() {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_KEYS.QUEUE);
      if (stored) {
        this.notificationQueue = JSON.parse(stored);
        
        console.log(`📋 Processing ${this.notificationQueue.length} queued notifications...`);
        
        for (const queuedNotification of this.notificationQueue) {
          try {
            await this.sendLocalNotification(
              queuedNotification.title,
              queuedNotification.body,
              queuedNotification.data,
              queuedNotification.options
            );
          } catch (error) {
            console.error('❌ Error processing queued notification:', error);
          }
        }
        
        // Clear queue
        this.notificationQueue = [];
        await AsyncStorage.removeItem(NOTIFICATION_KEYS.QUEUE);
        
        console.log('✅ Notification queue processed');
      }
    } catch (error) {
      console.error('❌ Error processing notification queue:', error);
    }
  }

  /**
   * Queue notification for later processing
   */
  async queueNotification(title, body, data = {}, options = {}) {
    try {
      const queuedNotification = {
        title,
        body,
        data,
        options,
        queuedAt: Date.now()
      };

      this.notificationQueue.push(queuedNotification);
      await AsyncStorage.setItem(NOTIFICATION_KEYS.QUEUE, JSON.stringify(this.notificationQueue));
      
      console.log('📥 Notification queued for later processing');
      return true;
    } catch (error) {
      console.error('❌ Error queueing notification:', error);
      return false;
    }
  }

  /**
   * Handle notification navigation
   */
  async handleNotificationNavigation(notification) {
    const { data } = notification.request.content;
    
    // This would typically integrate with your navigation system
    console.log('🧭 Handling notification navigation:', data?.type);
    
    // Notify listeners for navigation handling
    this.notifyListeners('navigate', { data });
  }

  /**
   * Save notification interaction
   */
  async saveNotificationInteraction(notification, action) {
    try {
      const interaction = {
        notificationId: notification.request.identifier,
        action,
        timestamp: Date.now(),
        data: notification.request.content.data
      };

      const interactions = await AsyncStorage.getItem('@GreenerApp:notificationInteractions');
      const interactionHistory = interactions ? JSON.parse(interactions) : [];
      
      interactionHistory.unshift(interaction);
      
      // Keep only last 50 interactions
      if (interactionHistory.length > 50) {
        interactionHistory.splice(50);
      }

      await AsyncStorage.setItem('@GreenerApp:notificationInteractions', JSON.stringify(interactionHistory));
      console.log('💾 Notification interaction saved');
    } catch (error) {
      console.error('❌ Error saving notification interaction:', error);
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStatistics() {
    try {
      const history = await this.getNotificationHistory();
      const interactions = await AsyncStorage.getItem('@GreenerApp:notificationInteractions');
      const interactionHistory = interactions ? JSON.parse(interactions) : [];

      const stats = {
        totalReceived: history.length,
        totalRead: history.filter(n => n.read).length,
        totalInteractions: interactionHistory.length,
        byType: {},
        recentActivity: history.slice(0, 10)
      };

      // Count by type
      history.forEach(notification => {
        const type = notification.data?.type || 'general';
        stats.byType[type] = (stats.byType[type] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('❌ Error getting notification statistics:', error);
      return null;
    }
  }
}

// Create and export singleton instance
const notificationService = new NotificationService();

export default notificationService;

// Export individual functions for convenience
export const {
  initialize,
  sendLocalNotification,
  sendPushNotification,
  scheduleNotification,
  cancelNotification,
  getSettings,
  updateSettings,
  getNotificationHistory,
  markNotificationAsRead,
  clearNotificationHistory,
  updateBadgeCount,
  addListener,
  queueNotification,
  getNotificationStatistics
} = notificationService;