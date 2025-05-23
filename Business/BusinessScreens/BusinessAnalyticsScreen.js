// Business/BusinessScreens/BusinessAnalyticsScreen.js - FIXED FOR WEB & ANDROID
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
  Alert,
  Dimensions,
  Share,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons 
} from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import REAL API services
import { 
  getBusinessAnalytics, 
  generateBusinessReport, 
  createAnalyticsStream,
  triggerAutoRefresh
} from '../services/businessAnalyticsApi';

// Import existing components
import KPIWidget from '../components/KPIWidget';

// Conditional chart imports for web compatibility
let LineChart, BarChart, PieChart, chartConfig;

if (Platform.OS === 'web') {
  // For web, we'll create simple chart alternatives
  LineChart = ({ data, width, height, style }) => (
    <View style={[{ width, height, backgroundColor: '#f5f5f5', borderRadius: 16, justifyContent: 'center', alignItems: 'center' }, style]}>
      <Text style={{ color: '#666' }}>Chart visualization available on mobile</Text>
    </View>
  );
  BarChart = LineChart;
  PieChart = LineChart;
} else {
  // For mobile, use the actual chart library
  const ChartKit = require('react-native-chart-kit');
  LineChart = ChartKit.LineChart;
  BarChart = ChartKit.BarChart;
  PieChart = ChartKit.PieChart;
}

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = Math.min(screenWidth - 32, 400); // Limit max width for web

// Chart configuration for mobile
const mobileChartConfig = {
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#4CAF50',
  },
  propsForLabels: {
    fontSize: 10,
  },
};

export default function BusinessAnalyticsScreen({ navigation, route }) {
  const { businessId: routeBusinessId } = route.params || {};
  
  // ===== STATE MANAGEMENT =====
  const [businessId, setBusinessId] = useState(routeBusinessId);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // ===== ANIMATION REFS - WITH PLATFORM CHECKS =====
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // ===== AUTO-REFRESH REFS =====
  const streamCleanup = useRef(null);
  const refreshTimer = useRef(null);

  // ===== INITIALIZE BUSINESS ID =====
  useEffect(() => {
    const initBusinessId = async () => {
      if (!businessId) {
        try {
          const email = await AsyncStorage.getItem('userEmail');
          const storedBusinessId = await AsyncStorage.getItem('businessId');
          setBusinessId(storedBusinessId || email);
        } catch (error) {
          console.error('Error getting business ID:', error);
        }
      }
    };
    
    initBusinessId();
  }, []);

  // ===== AUTO-REFRESH ON FOCUS =====
  useFocusEffect(
    useCallback(() => {
      console.log('📊 Analytics screen focused - loading data...');
      if (businessId) {
        loadAnalytics();
        setupAutoRefresh();
      }
      
      return () => {
        console.log('📊 Analytics screen unfocused - cleanup...');
        cleanupAutoRefresh();
      };
    }, [businessId, timeframe, autoRefreshEnabled])
  );

  // ===== SETUP AUTO-REFRESH STREAM =====
  const setupAutoRefresh = useCallback(() => {
    if (!autoRefreshEnabled || !businessId) return;
    
    cleanupAutoRefresh();
    
    // Create analytics stream
    streamCleanup.current = createAnalyticsStream(
      timeframe,
      (data) => {
        console.log('📊 Auto-refresh data received');
        setAnalyticsData(data.data);
        setLastUpdated(new Date().toISOString());
        setError(null);
        
        // Pulse animation for updates - Platform safe
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 200,
            useNativeDriver: Platform.select({ web: false, default: true }),
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: Platform.select({ web: false, default: true }),
          }),
        ]).start();
      },
      (error) => {
        console.warn('Auto-refresh error:', error);
        setError(`Auto-refresh failed: ${error.message}`);
      },
      30000 // 30 seconds
    );
  }, [autoRefreshEnabled, businessId, timeframe]);

  // ===== CLEANUP AUTO-REFRESH =====
  const cleanupAutoRefresh = useCallback(() => {
    if (streamCleanup.current) {
      streamCleanup.current();
      streamCleanup.current = null;
    }
    
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  // ===== LOAD ANALYTICS - FIXED =====
  const loadAnalytics = useCallback(async (showLoading = true) => {
    if (!businessId) {
      console.log('No business ID available');
      return;
    }

    try {
      if (showLoading) {
        setIsLoading(!analyticsData);
        setRefreshing(true);
      }
      setError(null);
      
      console.log('📊 Loading analytics for business:', businessId, 'timeframe:', timeframe);
      
      const data = await getBusinessAnalytics(timeframe, 'all');
      console.log('📊 Analytics data loaded successfully');
      
      setAnalyticsData(data.data);
      setLastUpdated(new Date().toISOString());
      
      // Success animation - Platform safe
      if (showLoading) {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: Platform.select({ web: false, default: true }),
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: Platform.select({ web: false, default: true }),
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: Platform.select({ web: false, default: true }),
          }),
        ]).start();
      }
      
    } catch (error) {
      console.error('❌ Error loading analytics:', error);
      setError(error.message);
      
      if (!analyticsData) {
        setAnalyticsData(getFallbackData());
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [businessId, timeframe, analyticsData]);

  // ===== FALLBACK DATA STRUCTURE =====
  const getFallbackData = () => ({
    sales: { 
      totalRevenue: 0, 
      totalOrders: 0, 
      averageOrderValue: 0, 
      trendData: { 
        labels: ['No Data'], 
        datasets: [{ 
          data: [0],
          color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`
        }] 
      } 
    },
    inventory: { 
      totalItems: 0, 
      activeItems: 0, 
      lowStockItems: 0, 
      totalValue: 0, 
      categoryBreakdown: {} 
    },
    customers: { 
      totalCustomers: 0, 
      newCustomers: 0, 
      customerTiers: {}, 
      repeatCustomerRate: 0 
    },
    profit: { 
      revenue: 0, 
      expenses: 0, 
      grossProfit: 0, 
      profitMargin: 0, 
      expenseBreakdown: {} 
    }
  });

  // ===== HANDLE TIMEFRAME CHANGE - FIXED =====
  const handleTimeframeChange = useCallback((newTimeframe) => {
    if (newTimeframe === timeframe) return;
    
    console.log('📊 Changing timeframe to:', newTimeframe);
    
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 150,
        useNativeDriver: Platform.select({ web: false, default: true }),
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: Platform.select({ web: false, default: true }),
      }),
    ]).start();
    
    setTimeframe(newTimeframe);
  }, [timeframe]);

  // ===== HANDLE TAB CHANGE - FIXED =====
  const handleTabChange = useCallback((tabKey) => {
    if (tabKey === activeTab) return;
    
    console.log('📊 Changing tab to:', tabKey);
    
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.7,
        duration: 100,
        useNativeDriver: Platform.select({ web: false, default: true }),
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: Platform.select({ web: false, default: true }),
      }),
    ]).start();
    
    setActiveTab(tabKey);
  }, [activeTab]);

  // ===== HANDLE REPORT GENERATION - FIXED =====
  const handleGenerateReport = useCallback(async (reportType) => {
    if (isGeneratingReport) return;
    
    console.log('📊 Generating report:', reportType);
    setIsGeneratingReport(true);
    
    try {
      const now = new Date();
      let startDate;
      
      switch (timeframe) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'quarter':
          startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      
      const report = await generateBusinessReport(
        reportType,
        startDate.toISOString(),
        now.toISOString()
      );
      
      // Show report options
      Alert.alert(
        '📊 Report Generated Successfully',
        `Your ${reportType} report has been generated for the selected period.`,
        [
          { 
            text: 'Share Report', 
            onPress: () => shareReport(report.report, reportType) 
          },
          { 
            text: 'OK', 
            style: 'default' 
          }
        ]
      );
      
      // Trigger auto-refresh after generating report
      await triggerAutoRefresh('report_generated', { reportType });
      
    } catch (error) {
      console.error('❌ Report generation error:', error);
      Alert.alert('Error', `Failed to generate report: ${error.message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [isGeneratingReport, timeframe]);

  // ===== SHARE REPORT FUNCTIONALITY - FIXED =====
  const shareReport = useCallback(async (report, reportType) => {
    try {
      const reportSummary = createReportSummary(report, reportType);
      
      if (Platform.OS === 'web') {
        // For web, copy to clipboard
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(reportSummary);
          Alert.alert('Success', 'Report copied to clipboard!');
        } else {
          Alert.alert('Info', 'Sharing is not available on web. Please copy the report manually.');
        }
      } else {
        // For mobile, use Share API
        const shareContent = {
          title: `Business ${reportType} Report`,
          message: reportSummary,
        };
        
        await Share.share(shareContent);
      }
    } catch (error) {
      console.error('Error sharing report:', error);
      Alert.alert('Share Error', 'Unable to share the report. Please try again.');
    }
  }, [timeframe]);

  // ===== CREATE REPORT SUMMARY =====
  const createReportSummary = (report, reportType) => {
    const period = `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Report`;
    
    switch (reportType) {
      case 'sales':
        return `📈 ${period} - Sales Report\n\n` +
               `Total Orders: ${report.salesReport?.summary?.totalOrders || 0}\n` +
               `Total Revenue: $${(report.salesReport?.summary?.totalRevenue || 0).toFixed(2)}\n` +
               `Avg Order Value: $${(report.salesReport?.summary?.averageOrderValue || 0).toFixed(2)}\n\n` +
               `Generated on ${new Date().toLocaleDateString()}`;
      
      case 'inventory':
        return `📦 ${period} - Inventory Report\n\n` +
               `Total Items: ${report.inventoryReport?.summary?.totalItems || 0}\n` +
               `Active Items: ${report.inventoryReport?.summary?.activeItems || 0}\n` +
               `Low Stock Items: ${report.inventoryReport?.summary?.lowStockItems || 0}\n` +
               `Total Value: $${(report.inventoryReport?.summary?.totalValue || 0).toFixed(2)}\n\n` +
               `Generated on ${new Date().toLocaleDateString()}`;
      
      default:
        return `📊 ${period} - Business Summary\n\n` +
               `Generated on ${new Date().toLocaleDateString()}`;
    }
  };

  // ===== TOGGLE AUTO-REFRESH - FIXED =====
  const toggleAutoRefresh = useCallback(() => {
    console.log('📊 Toggling auto-refresh:', !autoRefreshEnabled);
    
    const newState = !autoRefreshEnabled;
    setAutoRefreshEnabled(newState);
    
    if (newState) {
      setupAutoRefresh();
    } else {
      cleanupAutoRefresh();
    }
  }, [autoRefreshEnabled, setupAutoRefresh, cleanupAutoRefresh]);

  // ===== PROCESS CHART DATA - FIXED =====
  const getProcessedChartData = (rawData) => {
    if (!rawData || !rawData.trendData || !rawData.trendData.labels || rawData.trendData.labels.length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{
          data: [0],
          color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`
        }]
      };
    }

    const { labels, datasets } = rawData.trendData;
    
    return {
      labels: labels.slice(0, 10), // Limit labels for better display
      datasets: datasets.map(dataset => ({
        data: (dataset.data || [0]).slice(0, 10).map(val => Math.max(0, val || 0)), // Ensure positive numbers
        color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`
      }))
    };
  };

  // ===== RENDER TABS - FIXED =====
  const renderTabs = () => (
    <Animated.View 
      style={[
        styles.tabsContainer,
        { opacity: fadeAnim }
      ]}
    >
      {[
        { key: 'overview', label: 'Overview', icon: 'dashboard' },
        { key: 'sales', label: 'Sales', icon: 'trending-up' },
        { key: 'inventory', label: 'Inventory', icon: 'inventory' },
        { key: 'customers', label: 'Customers', icon: 'people' },
      ].map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.activeTab]}
          onPress={() => handleTabChange(tab.key)}
          activeOpacity={0.7}
        >
          <MaterialIcons name={tab.icon} size={20} color={activeTab === tab.key ? '#4CAF50' : '#999'} />
          <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );

  // ===== RENDER OVERVIEW TAB - FIXED =====
  const renderOverview = () => {
    if (!analyticsData) return renderNoData('overview');
    
    const animatedStyle = Platform.select({
      web: {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      },
      default: {
        opacity: fadeAnim,
        transform: [
          { translateY: slideAnim },
          { scale: pulseAnim }
        ],
      }
    });
    
    return (
      <Animated.View style={[styles.content, animatedStyle]}>
        {/* KPI Widgets */}
        <View style={styles.kpiGrid}>
          <KPIWidget
            title="Total Revenue"
            value={analyticsData.sales?.totalRevenue || 0}
            icon="cash"
            format="currency"
            color="#4CAF50"
            autoRefresh={autoRefreshEnabled}
            onPress={() => handleTabChange('sales')}
          />
          
          <KPIWidget
            title="Total Orders"
            value={analyticsData.sales?.totalOrders || 0}
            icon="shopping-cart"
            format="number"
            color="#2196F3"
            onPress={() => handleTabChange('sales')}
          />
          
          <KPIWidget
            title="Avg Order Value"
            value={analyticsData.sales?.averageOrderValue || 0}
            icon="attach-money"
            format="currency"
            color="#FF9800"
            onPress={() => handleTabChange('sales')}
          />
          
          <KPIWidget
            title="Total Customers"
            value={analyticsData.customers?.totalCustomers || 0}
            icon="people"
            format="number"
            color="#9C27B0"
            onPress={() => handleTabChange('customers')}
          />
        </View>

        {/* Sales Trend Chart */}
        {analyticsData.sales && Platform.OS !== 'web' && (
          <View style={styles.chartContainer}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Sales Trend - {timeframe}</Text>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={getProcessedChartData(analyticsData.sales)}
                width={Math.max(chartWidth, 300)}
                height={220}
                chartConfig={mobileChartConfig}
                bezier
                style={styles.chart}
                withDots={true}
                withInnerLines={false}
                withOuterLines={true}
                withVerticalLines={false}
                withHorizontalLines={true}
                fromZero={true}
              />
            </ScrollView>
          </View>
        )}

        {/* Alternative for Web - Simple Stats Display */}
        {analyticsData.sales && Platform.OS === 'web' && (
          <View style={styles.chartContainer}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Sales Trend - {timeframe}</Text>
            </View>
            
            <View style={styles.webChartAlternative}>
              <Text style={styles.webChartText}>
                Total Revenue: ${(analyticsData.sales.totalRevenue || 0).toLocaleString()}
              </Text>
              <Text style={styles.webChartText}>
                Orders: {analyticsData.sales.totalOrders || 0}
              </Text>
              <Text style={styles.webChartSubtext}>
                (Chart visualization available on mobile app)
              </Text>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Reports</Text>
            <TouchableOpacity 
              style={styles.autoRefreshToggle}
              onPress={toggleAutoRefresh}
              activeOpacity={0.7}
            >
              <MaterialIcons 
                name={autoRefreshEnabled ? "sync" : "sync-disabled"} 
                size={20} 
                color={autoRefreshEnabled ? "#4CAF50" : "#999"} 
              />
              <Text style={[
                styles.autoRefreshText,
                { color: autoRefreshEnabled ? "#4CAF50" : "#999" }
              ]}>
                Auto-refresh {autoRefreshEnabled ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, isGeneratingReport && styles.actionButtonDisabled]}
              onPress={() => handleGenerateReport('sales')}
              disabled={isGeneratingReport}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="chart-line" size={24} color="#4CAF50" />
              <Text style={styles.actionText}>Sales Report</Text>
              {isGeneratingReport && <ActivityIndicator size="small" color="#4CAF50" style={styles.actionLoader} />}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, isGeneratingReport && styles.actionButtonDisabled]}
              onPress={() => handleGenerateReport('inventory')}
              disabled={isGeneratingReport}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="package-variant" size={24} color="#2196F3" />
              <Text style={styles.actionText}>Inventory Report</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, isGeneratingReport && styles.actionButtonDisabled]}
              onPress={() => handleGenerateReport('customers')}
              disabled={isGeneratingReport}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="account-group" size={24} color="#FF9800" />
              <Text style={styles.actionText}>Customer Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  // ===== RENDER SALES TAB - FIXED =====
  const renderSales = () => {
    if (!analyticsData?.sales) return renderNoData('sales');
    
    return (
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.salesMetrics}>
          <View style={styles.metricCard}>
            <MaterialCommunityIcons name="currency-usd" size={32} color="#4CAF50" />
            <Text style={styles.metricValue}>
              ${(analyticsData.sales.totalRevenue || 0).toLocaleString()}
            </Text>
            <Text style={styles.metricLabel}>Total Revenue</Text>
          </View>
          
          <View style={styles.metricCard}>
            <MaterialCommunityIcons name="cart" size={32} color="#2196F3" />
            <Text style={styles.metricValue}>
              {analyticsData.sales.totalOrders || 0}
            </Text>
            <Text style={styles.metricLabel}>Total Orders</Text>
          </View>
        </View>

        {/* Chart for mobile only */}
        {analyticsData.sales.trendData && Platform.OS !== 'web' && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Revenue Trend</Text>
            <LineChart
              data={getProcessedChartData(analyticsData.sales)}
              width={chartWidth}
              height={220}
              chartConfig={mobileChartConfig}
              bezier
              style={styles.chart}
            />
          </View>
        )}
      </Animated.View>
    );
  };

  // ===== RENDER INVENTORY TAB - FIXED =====
  const renderInventory = () => {
    if (!analyticsData?.inventory) return renderNoData('inventory');
    
    return (
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.inventoryMetrics}>
          <View style={styles.metricCard}>
            <MaterialCommunityIcons name="package-variant" size={32} color="#4CAF50" />
            <Text style={styles.metricValue}>
              {analyticsData.inventory.totalItems || 0}
            </Text>
            <Text style={styles.metricLabel}>Total Items</Text>
          </View>
          
          <View style={styles.metricCard}>
            <MaterialCommunityIcons name="alert" size={32} color="#FF9800" />
            <Text style={styles.metricValue}>
              {analyticsData.inventory.lowStockItems || 0}
            </Text>
            <Text style={styles.metricLabel}>Low Stock</Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  // ===== RENDER CUSTOMERS TAB - FIXED =====
  const renderCustomers = () => {
    if (!analyticsData?.customers) return renderNoData('customers');
    
    return (
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.customerMetrics}>
          <View style={styles.metricCard}>
            <MaterialCommunityIcons name="account-group" size={32} color="#2196F3" />
            <Text style={styles.metricValue}>
              {analyticsData.customers.totalCustomers || 0}
            </Text>
            <Text style={styles.metricLabel}>Total Customers</Text>
          </View>
          
          <View style={styles.metricCard}>
            <MaterialCommunityIcons name="account-plus" size={32} color="#4CAF50" />
            <Text style={styles.metricValue}>
              {analyticsData.customers.newCustomers || 0}
            </Text>
            <Text style={styles.metricLabel}>New This Period</Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  // ===== RENDER NO DATA STATE =====
  const renderNoData = (dataType) => (
    <View style={styles.noDataContainer}>
      <MaterialCommunityIcons name="chart-box-outline" size={64} color="#e0e0e0" />
      <Text style={styles.noDataText}>No {dataType} data available</Text>
      <Text style={styles.noDataSubtext}>Data will appear here once you have business activity</Text>
      <TouchableOpacity 
        style={styles.refreshDataButton}
        onPress={() => loadAnalytics(true)}
        activeOpacity={0.7}
      >
        <MaterialIcons name="refresh" size={20} color="#4CAF50" />
        <Text style={styles.refreshDataText}>Refresh Data</Text>
      </TouchableOpacity>
    </View>
  );

  // ===== RENDER ACTIVE TAB CONTENT - FIXED =====
  const renderTabContent = () => {
    switch (activeTab) {
      case 'sales': 
        return renderSales();
      case 'inventory': 
        return renderInventory();
      case 'customers': 
        return renderCustomers();
      default: 
        return renderOverview();
    }
  };

  // ===== LOADING STATE =====
  if (isLoading && !analyticsData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
          <Text style={styles.loadingSubtext}>Analyzing your business data</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ===== MAIN RENDER =====
  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER WITH WORKING BACK BUTTON */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Business Analytics</Text>
          <Text style={styles.headerSubtitle}>
            {lastUpdated ? 
              `Updated ${new Date(lastUpdated).toLocaleTimeString()}` : 
              'Performance insights'
            }
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={() => loadAnalytics(true)}
          disabled={refreshing}
          activeOpacity={0.7}
        >
          <MaterialIcons name="refresh" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {/* WORKING TIMEFRAME SELECTOR */}
      <Animated.View 
        style={[
          styles.timeframeContainer,
          { opacity: fadeAnim }
        ]}
      >
        {['week', 'month', 'quarter', 'year'].map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.timeframeButton,
              timeframe === period && styles.activeTimeframe
            ]}
            onPress={() => handleTimeframeChange(period)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.timeframeText,
              timeframe === period && styles.activeTimeframeText
            ]}>
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* WORKING TABS */}
      {renderTabs()}

      {/* CONTENT WITH REFRESH */}
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadAnalytics(true)}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorBanner}>
            <MaterialIcons name="warning" size={20} color="#FF5722" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => loadAnalytics(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {renderTabContent()}
      </ScrollView>

      {/* WORKING STATUS INDICATOR */}
      {autoRefreshEnabled && (
        <View style={styles.statusIndicator}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Live updates enabled</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ===== STYLES =====
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  timeframeContainer: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginHorizontal: 4,
    alignItems: 'center',
  },
  activeTimeframe: {
    backgroundColor: '#4CAF50',
  },
  timeframeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTimeframeText: {
    color: '#fff',
    fontWeight: '600',
  },
  tabsContainer: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
  },
  tabText: {
    fontSize: 12,
    color: '#999',
  },
  activeTabText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF5722',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#FF5722',
    marginLeft: 8,
  },
  retryButton: {
    backgroundColor: '#FF5722',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  chart: {
    borderRadius: 12,
  },
  webChartAlternative: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
  },
  webChartText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  webChartSubtext: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 12,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
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
    paddingHorizontal: 20,
  },
  refreshDataButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f3',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  refreshDataText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  quickActions: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  autoRefreshToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  autoRefreshText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    position: 'relative',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionText: {
    fontSize: 12,
    color: '#333',
    marginTop: 8,
    fontWeight: '500',
  },
  actionLoader: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  salesMetrics: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  inventoryMetrics: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  customerMetrics: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});