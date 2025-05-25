// Business/components/NotificationManager.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

// Mock service functions until actual implementation is ready
const mockNotificationService = {
  getPendingNotifications: async (businessId) => {
    // Return mock data for now
    return {
      notifications: [
        {
          id: '1',
          title: 'Low Stock Alert',
          message: 'You have 5 items that are running low on stock.',
          type: 'LOW_STOCK_ALERT',
          timestamp: new Date().toISOString(),
          action: 'open_inventory',
          itemCount: 5,
          urgent: true,
        },
        {
          id: '2',
          title: 'Watering Reminder',
          message: 'Don\'t forget to water your plants today!',
          type: 'WATERING_REMINDER',
          timestamp: new Date().toISOString(),
          action: 'open_watering_checklist',
          plantCount: 8,
          urgent: false,
        }
      ],
      hasNotifications: true,
      summary: {
        plantsNeedingWater: 8,
        plantsWateredToday: 3,
        lowStockItems: 5,
        unprocessedOrders: 2
      },
      timestamp: new Date().toISOString()
    };
  },
  
  markNotificationAsRead: async (notificationId, notificationType) => {
    // Mock successful response
    return { success: true };
  },
  
  getCachedNotifications: async () => {
    try {
      const cached = await AsyncStorage.getItem('notifications_cache');
      return cached ? JSON.parse(cached).data : [];
    } catch (error) {
      console.error('Error getting cached notifications:', error);
      return [];
    }
  },
  
  setCachedNotifications: async (notifications) => {
    try {
      const cacheObject = {
        data: notifications,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem('notifications_cache', JSON.stringify(cacheObject));
    } catch (error) {
      console.error('Error caching notifications:', error);
    }
  }
};

// The hook that components will use
export const useNotificationManager = (businessId) => {
  const [notifications, setNotifications] = useState([]);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [notificationSummary, setNotificationSummary] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  
  const pollingRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const lastNotificationCheck = useRef(new Date());
  const navigation = useNavigation();
  
  // Handle new notifications
  const handleNewNotifications = useCallback(async (newNotifications, summary) => {
    try {
      // Get cached notifications to check for duplicates
      const cachedNotifications = await mockNotificationService.getCachedNotifications();
      const cachedIds = cachedNotifications.map(n => n.id);
      
      // Filter out already seen notifications
      const unseenNotifications = newNotifications.filter(n => !cachedIds.includes(n.id));
      
      if (unseenNotifications.length > 0) {
        setNotifications(newNotifications);
        setNotificationSummary(summary);
        setHasNewNotifications(true);
        
        // Show alert for important notifications
        const urgentNotifications = unseenNotifications.filter(n => n.urgent);
        if (urgentNotifications.length > 0) {
          showUrgentNotificationAlert(urgentNotifications[0]);
        } else if (unseenNotifications.length > 0 && Platform.OS !== 'web') {
          // Only show non-urgent notification alerts on mobile
          showNotificationAlert(unseenNotifications[0]);
        }
        
        // Cache notifications
        await mockNotificationService.setCachedNotifications(newNotifications);
      }
    } catch (error) {
      console.error('Error handling new notifications:', error);
    }
  }, []);
  
  // Show urgent notification alert
  const showUrgentNotificationAlert = (notification) => {
    if (Platform.OS === 'web') return; // Skip alerts on web
    
    Alert.alert(
      '🚨 ' + notification.title,
      notification.message,
      [
        {
          text: 'Dismiss',
          style: 'cancel',
          onPress: () => markAsRead(notification.id, notification.type)
        },
        {
          text: 'Take Action',
          style: 'default',
          onPress: () => {
            markAsRead(notification.id, notification.type);
            handleNotificationAction(notification);
          }
        }
      ]
    );
  };
  
  // Show regular notification alert
  const showNotificationAlert = (notification) => {
    if (Platform.OS === 'web') return; // Skip alerts on web
    
    Alert.alert(
      notification.title,
      notification.message,
      [
        {
          text: 'OK',
          onPress: () => markAsRead(notification.id, notification.type)
        },
        {
          text: 'View',
          onPress: () => {
            markAsRead(notification.id, notification.type);
            handleNotificationAction(notification);
          }
        }
      ]
    );
  };
  
  // Handle notification actions
  const handleNotificationAction = (notification) => {
    switch (notification.action) {
      case 'open_watering_checklist':
        navigation.navigate('WateringChecklistScreen', { businessId });
        break;
      case 'open_inventory':
        navigation.navigate('AddInventoryScreen', { 
          businessId, 
          showInventory: true,
          filter: 'lowStock' 
        });
        break;
      default:
        // No specific action
        break;
    }
  };
  
  // Mark notification as read
  const markAsRead = async (notificationId, notificationType) => {
    try {
      await mockNotificationService.markNotificationAsRead(notificationId, notificationType);
      
      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Update cache
      const cachedNotifications = await mockNotificationService.getCachedNotifications();
      const updatedCache = cachedNotifications.filter(n => n.id !== notificationId);
      await mockNotificationService.setCachedNotifications(updatedCache);
      
      // Check if any notifications remain
      if (notifications.length <= 1) {
        setHasNewNotifications(false);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  // Start polling - simulate polling with interval
  const startPolling = useCallback(() => {
    if (pollingRef.current || !businessId) return;
    
    console.log('🔔 Starting notification polling for business:', businessId);
    setIsPolling(true);
    
    // Poll every minute
    pollingRef.current = setInterval(async () => {
      try {
        const businessId = await AsyncStorage.getItem('businessId');
        if (businessId) {
          const data = await mockNotificationService.getPendingNotifications(businessId);
          
          if (data.hasNotifications) {
            handleNewNotifications(data.notifications, data.summary);
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 60000);
    
    // Initial poll
    (async () => {
      try {
        const data = await mockNotificationService.getPendingNotifications(businessId);
        if (data.hasNotifications) {
          handleNewNotifications(data.notifications, data.summary);
        }
      } catch (error) {
        console.error('Initial polling error:', error);
      }
    })();
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [businessId, handleNewNotifications]);
  
  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      console.log('🔕 Stopping notification polling');
      clearInterval(pollingRef.current);
      pollingRef.current = null;
      setIsPolling(false);
    }
  }, []);
  
  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - resume polling
        console.log('📱 App came to foreground, resuming polling');
        startPolling();
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background - stop polling to save battery
        console.log('📱 App went to background, stopping polling');
        stopPolling();
      }
      
      appStateRef.current = nextAppState;
    };
    
    // Only set up app state listener for mobile platforms
    if (Platform.OS !== 'web') {
      const subscription = AppState.addEventListener('change', handleAppStateChange);
      
      return () => {
        subscription?.remove();
      };
    }
  }, [startPolling, stopPolling]);
  
  // Initialize polling
  useEffect(() => {
    if (businessId) {
      startPolling();
    }
    
    return () => {
      stopPolling();
    };
  }, [businessId, startPolling, stopPolling]);
  
  // Clear notifications
  const clearAllNotifications = () => {
    setNotifications([]);
    setHasNewNotifications(false);
    setNotificationSummary(null);
  };
  
  return {
    notifications,
    hasNewNotifications,
    notificationSummary,
    isPolling,
    markAsRead,
    clearAllNotifications,
    startPolling,
    stopPolling
  };
};

// Export a simpler version for direct import
export default useNotificationManager;