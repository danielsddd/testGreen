// Business/components/KPIWidget.js
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
  title = '',
  value = 0,
  change = 0,
  icon = 'chart-line',
  color = '#4CAF50',
  format = 'number', // 'number', 'currency', 'percentage'
  subtitle = '',
  onPress = null,
  trend = 'up', // 'up', 'down', 'neutral'
  isLoading = false,
  autoRefresh = true
}) {
  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  
  // Previous value for animation
  const prevValue = useRef(value);

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, []);

  useEffect(() => {
    // Value change animation
    if (prevValue.current !== value) {
      // Highlight animation when value changes
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
      
      // Animated counter
      Animated.timing(countAnim, {
        toValue: value,
        duration: 1000,
        useNativeDriver: false,
      }).start();
      
      prevValue.current = value;
    }
  }, [value]);

  const handlePress = () => {
    if (!onPress) return;
    
    // Press animation
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

  const formatValue = (val) => {
    if (isLoading) return '...';
    
    switch (format) {
      case 'currency':
        return `$${Number(val).toLocaleString()}`;
      case 'percentage':
        return `${Number(val).toFixed(1)}%`;
      default:
        return Number(val).toLocaleString();
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return 'trending-up';
      case 'down':
        return 'trending-down';
      default:
        return 'trending-flat';
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return '#4CAF50';
      case 'down':
        return '#F44336';
      default:
        return '#999';
    }
  };

  const Component = onPress ? TouchableOpacity : View;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            { translateY: slideAnim },
          ],
        }
      ]}
    >
      <Component
        style={styles.touchable}
        onPress={onPress ? handlePress : undefined}
        activeOpacity={onPress ? 0.8 : 1}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
              <MaterialCommunityIcons name={icon} size={24} color={color} />
            </View>
            
            {autoRefresh && (
              <View style={styles.refreshIndicator}>
                <MaterialIcons name="sync" size={12} color="#4CAF50" />
              </View>
            )}
          </View>
          
          {/* Value */}
          <Animated.View
            style={[
              styles.valueContainer,
              {
                transform: [{ scale: pulseAnim }],
              }
            ]}
          >
            <Animated.Text 
              style={[styles.value, { color }]}
            >
              {formatValue(value)}
            </Animated.Text>
            
            {change !== 0 && (
              <View style={styles.changeContainer}>
                <MaterialIcons 
                  name={getTrendIcon()} 
                  size={16} 
                  color={getTrendColor()} 
                />
                <Text style={[styles.change, { color: getTrendColor() }]}>
                  {Math.abs(change)}%
                </Text>
              </View>
            )}
          </Animated.View>
          
          {/* Title */}
          <Text style={styles.title}>{title}</Text>
          
          {/* Subtitle */}
          {subtitle && (
            <Text style={styles.subtitle}>{subtitle}</Text>
          )}
          
          {/* Loading Indicator */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <Animated.View
                style={{
                  transform: [{
                    rotate: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    })
                  }]
                }}
              >
                <MaterialIcons name="refresh" size={20} color={color} />
              </Animated.View>
            </View>
          )}
        </View>
      </Component>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 6,
  },
  touchable: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    minHeight: 120,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  change: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
});