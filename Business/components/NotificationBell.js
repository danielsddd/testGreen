// Business/components/NotificationBell.js
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const NotificationBell = ({ 
  hasNotifications = false, 
  notificationCount = 0, 
  onPress, 
  style,
  size = 24,
  color = '#216a94'
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Pulse animation for new notifications - Web compatible
  useEffect(() => {
    if (hasNotifications) {
      // For web, we need to avoid native driver
      const config = {
        toValue: 1.2,
        duration: 800,
        useNativeDriver: Platform.OS !== 'web',
      };
      
      const pulseBack = {
        toValue: 1,
        duration: 800,
        useNativeDriver: Platform.OS !== 'web',
      };
      
      // Create the animation sequence
      const pulseSequence = Animated.sequence([
        Animated.timing(pulseAnim, config),
        Animated.timing(pulseAnim, pulseBack)
      ]);
      
      // For web, we'll use a simple interval instead of loop
      if (Platform.OS === 'web') {
        const interval = setInterval(() => {
          pulseSequence.start();
        }, 1600);
        
        return () => clearInterval(interval);
      } else {
        // For native, we can use loop
        const pulse = Animated.loop(pulseSequence);
        pulse.start();
        return () => pulse.stop();
      }
    }
  }, [hasNotifications, pulseAnim]);
  
  return (
    <TouchableOpacity 
      style={[styles.container, style]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Animated.View 
        style={[
          styles.iconContainer,
          // Avoid transform for web to prevent warnings
          Platform.OS !== 'web' && hasNotifications ? { 
            transform: [{ scale: pulseAnim }] 
          } : null
        ]}
      >
        <MaterialIcons 
          name={hasNotifications ? "notifications-active" : "notifications"} 
          size={size} 
          color={hasNotifications ? "#f44336" : color} 
        />
        
        {hasNotifications && notificationCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {notificationCount > 9 ? '9+' : notificationCount}
            </Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#f44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default NotificationBell;