// Business/components/BusinessDashboardCharts.js - WEB & MOBILE COMPATIBLE
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

// Import universal charts
import {
  UniversalLineChart,
  UniversalBarChart,
  UniversalPieChart,
  UniversalMultiLineChart,
  ChartWrapper
} from './WebCompatibleCharts';

// Import web utilities
import { 
  createWebShadow, 
  createWebCursor, 
  webAnimationConfig,
  platformStyles
} from '../utils/webStyles';

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 32;
const isWeb = Platform.OS === 'web';

export default function BusinessDashboardCharts({
  salesData = {},
  inventoryData = {},
  ordersData = {},
  onRefresh = () => {},
  autoRefresh = true,
  refreshInterval = 60000
}) {
  const [activeChart, setActiveChart] = useState('sales');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Animation refs - Web compatible
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const refreshAnim = useRef(new Animated.Value(0)).current;
  
  // Auto-refresh timer
  const refreshTimer = useRef(null);

  useEffect(() => {
    // Entrance animation - Web compatible
    Animated.stagger(200, [
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: webAnimationConfig.duration,
        useNativeDriver: webAnimationConfig.useNativeDriver,
      }),
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: webAnimationConfig.duration,
        useNativeDriver: webAnimationConfig.useNativeDriver,
      }),
    ]).start();

    // Auto-refresh setup
    if (autoRefresh) {
      refreshTimer.current = setInterval(() => {
        handleAutoRefresh();
      }, refreshInterval);
    }

    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, [autoRefresh]);

  const handleAutoRefresh = async () => {
    setIsRefreshing(true);
    
    // Refresh animation - Web compatible
    Animated.sequence([
      Animated.timing(refreshAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: webAnimationConfig.useNativeDriver,
      }),
      Animated.timing(refreshAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: webAnimationConfig.useNativeDriver,
      }),
    ]).start();
    
    try {
      await onRefresh();
    } catch (error) {
      console.error('Auto-refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleChartChange = (chartType) => {
    if (chartType === activeChart) return;
    
    // Slide animation for chart change - Web compatible
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: webAnimationConfig.useNativeDriver,
      }),
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: webAnimationConfig.useNativeDriver,
      }),
    ]).start();
    
    setActiveChart(chartType);
  };

  // Process sales data for charts
  const getSalesChartData = () => {
    const labels = salesData.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const values = (salesData.values || [0, 0, 0, 0, 0, 0, 0]).map(value => 
      isNaN(value) || !isFinite(value) ? 0 : Math.max(0, value)
    );

    return {
      labels,
      datasets: [{
        data: values,
        color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
        strokeWidth: 3,
      }],
    };
  };

  // Process orders data for charts
  const getOrdersChartData = () => {
    const labels = ['Pending', 'Confirmed', 'Ready', 'Completed'];
    const data = [
      Math.max(0, ordersData.pending || 0),
      Math.max(0, ordersData.confirmed || 0),
      Math.max(0, ordersData.ready || 0),
      Math.max(0, ordersData.completed || 0),
    ];

    return {
      labels,
      datasets: [{ data }],
    };
  };

  // Process inventory data for pie chart
  const getInventoryPieData = () => {
    return [
      {
        name: 'In Stock',
        population: Math.max(0, inventoryData.inStock || 0),
        color: '#4CAF50',
        legendFontColor: '#333',
        legendFontSize: 12,
      },
      {
        name: 'Low Stock',
        population: Math.max(0, inventoryData.lowStock || 0),
        color: '#FF9800',
        legendFontColor: '#333',
        legendFontSize: 12,
      },
      {
        name: 'Out of Stock',
        population: Math.max(0, inventoryData.outOfStock || 0),
        color: '#F44336',
        legendFontColor: '#333',
        legendFontSize: 12,
      },
    ].filter(item => item.population > 0);
  };

  const renderChart = () => {
    const hasData = (chartType) => {
      switch (chartType) {
        case 'sales':
          return getSalesChartData().datasets[0].data.some(val => val > 0);
        case 'orders':
          return getOrdersChartData().datasets[0].data.some(val => val > 0);
        case 'inventory':
          return getInventoryPieData().length > 0;
        default:
          return false;
      }
    };

    const renderNoDataState = (title) => (
      <View style={styles.noDataContainer}>
        <MaterialCommunityIcons name="chart-line" size={64} color="#e0e0e0" />
        <Text style={styles.noDataText}>No data available</Text>
        <Text style={styles.noDataSubtext}>Data will appear here as your business grows</Text>
      </View>
    );

    switch (activeChart) {
      case 'sales':
        if (!hasData('sales')) {
          return renderNoDataState('Sales This Week');
        }
        return (
          <ChartWrapper>
            <UniversalLineChart
              data={getSalesChartData()}
              width={isWeb ? undefined : chartWidth}
              height={220}
              title="Sales This Week"
              yAxisLabel="$"
              showGrid={true}
              showTooltip={true}
            />
            <View style={styles.chartInsights}>
              <Text style={styles.insightText}>
                📈 Total: ${salesData.total || 0} | Avg: ${salesData.average || 0}/day
              </Text>
            </View>
          </ChartWrapper>
        );
        
      case 'orders':
        if (!hasData('orders')) {
          return renderNoDataState('Orders by Status');
        }
        return (
          <ChartWrapper>
            <UniversalBarChart
              data={getOrdersChartData()}
              width={isWeb ? undefined : chartWidth}
              height={220}
              title="Orders by Status"
              showGrid={true}
              showTooltip={true}
            />
            <View style={styles.chartInsights}>
              <Text style={styles.insightText}>
                📦 Total: {ordersData.total || 0} orders | Active: {(ordersData.pending || 0) + (ordersData.confirmed || 0) + (ordersData.ready || 0)}
              </Text>
            </View>
          </ChartWrapper>
        );
        
      case 'inventory':
        if (!hasData('inventory')) {
          return renderNoDataState('Inventory Status');
        }
        return (
          <ChartWrapper>
            <UniversalPieChart
              data={getInventoryPieData()}
              width={isWeb ? undefined : chartWidth}
              height={220}
              title="Inventory Status"
              showLegend={true}
            />
            <View style={styles.chartInsights}>
              <Text style={styles.insightText}>
                📊 Total Items: {(inventoryData.inStock || 0) + (inventoryData.lowStock || 0) + (inventoryData.outOfStock || 0)}
              </Text>
            </View>
          </ChartWrapper>
        );
        
      default:
        return renderNoDataState('Chart');
    }
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          ...(!isWeb && {
            transform: [{ scale: slideAnim }],
          })
        }
      ]}
    >
      {/* Chart Navigation */}
      <View style={styles.chartTabs}>
        {[
          { key: 'sales', label: 'Sales', icon: 'trending-up' },
          { key: 'orders', label: 'Orders', icon: 'receipt' },
          { key: 'inventory', label: 'Stock', icon: 'inventory' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.chartTab,
              activeChart === tab.key && styles.activeChartTab,
            ]}
            onPress={() => handleChartChange(tab.key)}
          >
            <MaterialIcons 
              name={tab.icon} 
              size={20} 
              color={activeChart === tab.key ? '#4CAF50' : '#999'} 
            />
            <Text
              style={[
                styles.chartTabText,
                activeChart === tab.key && styles.activeChartTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
        
        {/* Refresh Indicator */}
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleAutoRefresh}
          disabled={isRefreshing}
        >
          <Animated.View
            style={isWeb ? {} : {
              transform: [{
                rotate: refreshAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                })
              }]
            }}
          >
            <MaterialIcons 
              name="refresh" 
              size={20} 
              color={isRefreshing ? '#4CAF50' : '#999'} 
            />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Chart Content */}
      <Animated.View
        style={[
          styles.chartContent,
          {
            opacity: slideAnim,
            ...(!isWeb && {
              transform: [{
                translateX: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                })
              }]
            })
          }
        ]}
      >
        {renderChart()}
      </Animated.View>
      
      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <View style={styles.autoRefreshIndicator}>
          <MaterialCommunityIcons name="sync" size={12} color="#4CAF50" />
          <Text style={styles.autoRefreshText}>Auto-refreshing every {refreshInterval / 1000}s</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    ...createWebShadow({
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
    ...platformStyles.web({
      maxWidth: 800,
      alignSelf: 'center',
    }),
  },
  chartTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingHorizontal: 16,
    ...platformStyles.web({
      flexWrap: 'wrap',
    }),
  },
  chartTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
    ...createWebCursor('pointer'),
    ...platformStyles.web({
      minWidth: 120,
      flex: 'none',
    }),
  },
  activeChartTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
  },
  chartTabText: {
    fontSize: 14,
    color: '#999',
    ...platformStyles.web({
      fontSize: 16,
    }),
  },
  activeChartTabText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  refreshButton: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...createWebCursor('pointer'),
  },
  chartContent: {
    padding: 16,
    ...platformStyles.web({
      minHeight: 300,
    }),
  },
  chartInsights: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    width: '100%',
  },
  insightText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noDataText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  autoRefreshIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#f0f9f3',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  autoRefreshText: {
    fontSize: 10,
    color: '#4CAF50',
    marginLeft: 4,
  },
});