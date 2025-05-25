// Business/components/NotificationList.js
import React, { memo, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

/**
 * Individual notification item component
 */
const NotificationItem = memo(({ notification, onPress, onDismiss }) => {
  // Get appropriate icon based on notification type
  const getIconInfo = useCallback((type) => {
    switch (type) {
      case 'WATERING_REMINDER':
        return { name: 'water-outline', color: '#2196F3', library: 'MaterialCommunityIcons' };
      case 'LOW_STOCK_ALERT':
        return { name: 'package-variant-closed-alert', color: '#FF9800', library: 'MaterialCommunityIcons' };
      case 'WATERING_SUCCESS':
        return { name: 'check-circle-outline', color: '#4CAF50', library: 'MaterialIcons' };
      case 'ORDER_RECEIVED':
        return { name: 'shopping-outline', color: '#9C27B0', library: 'MaterialCommunityIcons' };
      case 'SYSTEM_UPDATE':
        return { name: 'system-update', color: '#607D8B', library: 'MaterialIcons' };
      default:
        return { name: 'bell-outline', color: '#216a94', library: 'MaterialCommunityIcons' };
    }
  }, []);
  
  // Format timestamp relative to current time
  const formatTimestamp = useCallback((timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / 60000);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h ago`;
    }
    if (diffInMinutes < 10080) { // 7 days
      const days = Math.floor(diffInMinutes / 1440);
      return `${days}d ago`;
    }
    
    // Format as date if older than a week
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined
    });
  }, []);
  
  // Get icon component based on library
  const iconInfo = getIconInfo(notification.type);
  const IconComponent = iconInfo.library === 'MaterialIcons' ? MaterialIcons : MaterialCommunityIcons;
  
  // Handle press with error handling
  const handlePress = useCallback(() => {
    try {
      onPress?.(notification);
    } catch (error) {
      console.error('Error handling notification press:', error);
    }
  }, [notification, onPress]);
  
  // Handle dismiss with error handling
  const handleDismiss = useCallback(() => {
    try {
      onDismiss?.(notification);
    } catch (error) {
      console.error('Error handling notification dismiss:', error);
    }
  }, [notification, onDismiss]);
  
  return (
    <TouchableOpacity 
      style={[
        styles.notificationItem,
        notification.urgent && styles.urgentNotification,
        notification.read && styles.readNotification
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityLabel={`${notification.title}. ${notification.message}`}
      accessibilityHint="Double tap to view notification details"
      accessibilityRole="button"
    >
      <View style={[
        styles.notificationIcon,
        { backgroundColor: `${iconInfo.color}10` } // 10% opacity version of the color
      ]}>
        <IconComponent name={iconInfo.name} size={24} color={iconInfo.color} />
      </View>
      
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.notificationTime}>
            {formatTimestamp(notification.timestamp)}
          </Text>
        </View>
        
        <Text style={styles.notificationMessage} numberOfLines={2}>
          {notification.message}
        </Text>
        
        {/* Show plant count if available */}
        {notification.plantCount > 0 && (
          <View style={styles.notificationMeta}>
            <MaterialCommunityIcons name="leaf" size={14} color="#4CAF50" />
            <Text style={styles.metaText}>
              {notification.plantCount} plant{notification.plantCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
        
        {/* Show item count if available */}
        {notification.itemCount > 0 && (
          <View style={styles.notificationMeta}>
            <MaterialIcons name="inventory" size={14} color="#FF9800" />
            <Text style={styles.metaText}>
              {notification.itemCount} item{notification.itemCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>
      
      <TouchableOpacity 
        style={styles.dismissButton}
        onPress={handleDismiss}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        accessible={true}
        accessibilityLabel="Dismiss notification"
        accessibilityRole="button"
      >
        <MaterialIcons name="close" size={20} color="#999" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

/**
 * NotificationList Component
 * 
 * Displays a list of notifications with support for dismissing individual items
 * 
 * @param {Object} props Component props
 * @param {Array} props.notifications Array of notification objects
 * @param {Function} props.onNotificationPress Callback when notification is pressed
 * @param {Function} props.onNotificationDismiss Callback when notification is dismissed
 * @param {string} props.emptyMessage Message to display when no notifications
 * @param {Object} props.style Additional container styles
 * @param {boolean} props.isLoading Loading state indicator
 * @param {Function} props.onRefresh Pull to refresh callback
 * @param {boolean} props.refreshing Pull to refresh state
 */
const NotificationList = ({
  notifications = [],
  onNotificationPress,
  onNotificationDismiss,
  emptyMessage = "No notifications",
  style,
  isLoading = false,
  onRefresh,
  refreshing = false
}) => {
  // Handle notification press
  const handleNotificationPress = useCallback((notification) => {
    if (onNotificationPress) {
      onNotificationPress(notification);
    }
  }, [onNotificationPress]);
  
  // Handle notification dismiss with confirmation
  const handleNotificationDismiss = useCallback((notification) => {
    Alert.alert(
      'Dismiss Notification',
      'Are you sure you want to dismiss this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Dismiss', 
          style: 'destructive',
          onPress: () => {
            if (onNotificationDismiss) {
              onNotificationDismiss(notification);
            }
          }
        }
      ],
      { cancelable: true }
    );
  }, [onNotificationDismiss]);
  
  // Optimize rendering with useCallback
  const renderNotification = useCallback(({ item }) => (
    <NotificationItem
      notification={item}
      onPress={handleNotificationPress}
      onDismiss={handleNotificationDismiss}
    />
  ), [handleNotificationPress, handleNotificationDismiss]);
  
  // Extract keys from notification items
  const keyExtractor = useCallback((item) => item.id.toString(), []);
  
  // Empty state component
  const renderEmptyState = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyState}>
        <MaterialIcons name="notifications-none" size={48} color="#e0e0e0" />
        <Text style={styles.emptyStateText}>{emptyMessage}</Text>
      </View>
    );
  }, [isLoading, emptyMessage]);
  
  // List item separator component
  const ItemSeparatorComponent = useCallback(() => (
    <View style={styles.separator} />
  ), []);
  
  // Compute content container style based on notification count
  const contentContainerStyle = useMemo(() => 
    notifications.length === 0 ? styles.emptyContainer : styles.listContent, 
    [notifications.length]
  );
  
  return (
    <View style={[styles.container, style]}>
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={contentContainerStyle}
        ItemSeparatorComponent={ItemSeparatorComponent}
        onRefresh={onRefresh}
        refreshing={refreshing}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={Platform.OS !== 'web'}
        accessibilityLabel="Notifications list"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  notificationItem: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  urgentNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
    backgroundColor: '#fff5f5',
  },
  readNotification: {
    opacity: 0.8,
    backgroundColor: '#fafafa',
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
    marginRight: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
    minWidth: 50,
    textAlign: 'right',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 4,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  separator: {
    height: 1,
    backgroundColor: 'transparent',
  },
});

export default memo(NotificationList);