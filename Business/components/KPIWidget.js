// Business/components/KPIWidget.js - FIXED VERSION - NO MOCK DATA
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

export default function KPIWidget({
  title,
  value = 0,
  change,
  icon,
  format = 'number',
  color = '#4CAF50',
  trend = 'neutral',
  onPress = () => {},
  autoRefresh = false
}) {
  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Auto-refresh pulse animation
  useEffect(() => {
    if (autoRefresh) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1500,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      
      pulse.start();
      
      return () => pulse.stop();
    }
  }, [autoRefresh, pulseAnim]);

  // Press animation
  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
    
    onPress();
  };

  // Format value based on type
  const formatValue = (val) => {
    if (val === null || val === undefined) return '0';
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'decimal':
        return val.toFixed(2);
      default:
        return val.toLocaleString();
    }
  };

  // Get correct icon name for the icon library
  const getIconComponent = () => {
    // Map of icon names to correct library and name
    const iconMap = {
      'cash': { library: 'MaterialCommunityIcons', name: 'cash' },
      'trending-up': { library: 'MaterialIcons', name: 'trending-up' },
      'shopping-cart': { library: 'MaterialIcons', name: 'shopping-cart' }, // Fixed: Use MaterialIcons
      'cart': { library: 'MaterialCommunityIcons', name: 'cart' },
      'warning': { library: 'MaterialIcons', name: 'warning' }, // Fixed: Use MaterialIcons
      'alert': { library: 'MaterialCommunityIcons', name: 'alert' },
      'inventory': { library: 'MaterialIcons', name: 'inventory' },
      'package': { library: 'MaterialCommunityIcons', name: 'package-variant' },
      'attach-money': { library: 'MaterialIcons', name: 'attach-money' },
      'star': { library: 'MaterialIcons', name: 'star' },
      'people': { library: 'MaterialIcons', name: 'people' },
      'analytics': { library: 'MaterialIcons', name: 'analytics' },
    };
    
    const iconInfo = iconMap[icon] || { library: 'MaterialIcons', name: 'trending-up' };
    const IconComponent = iconInfo.library === 'MaterialIcons' ? MaterialIcons : MaterialCommunityIcons;
    
    return <IconComponent name={iconInfo.name} size={24} color="#fff" />;
  };

  // Get trend color
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return '#4CAF50';
      case 'down': return '#f44336';
      default: return '#666';
    }
  };

  // Get trend icon
  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return 'trending-up';
      case 'down': return 'trending-down';
      default: return 'remove';
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { scale: scaleAnim },
            { scale: pulseAnim }
          ],
          opacity: fadeAnim,
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.widget}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        {/* Icon Container */}
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
          {getIconComponent()}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.value}>{formatValue(value)}</Text>
          
          {change !== undefined && change !== null && (
            <View style={styles.changeContainer}>
              <MaterialIcons 
                name={getTrendIcon()} 
                size={14} 
                color={getTrendColor()} 
              />
              <Text style={[styles.changeText, { color: getTrendColor() }]}>
                {Math.abs(change).toFixed(1)}%
              </Text>
            </View>
          )}
        </View>

        {/* Auto-refresh indicator */}
        {autoRefresh && (
          <View style={styles.refreshIndicator}>
            <MaterialIcons name="sync" size={12} color={color} />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '48%',
    marginBottom: 12,
  },
  widget: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    minHeight: 80,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  refreshIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});