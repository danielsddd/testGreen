// Business/BusinessScreens/BusinessAnalyticsScreen.js - FIXED & SIMPLIFIED
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

// Conditional chart imports - SIMPLIFIED
let LineChart, BarChart, PieChart;
const isWeb = Platform.OS === 'web';

if (!isWeb) {
  // Only import for mobile
  try {
    const ChartKit = require('react-native-chart-kit');
    LineChart = ChartKit.LineChart;
    BarChart = ChartKit.BarChart;
    PieChart = ChartKit.PieChart;
  } catch (error) {
    console.warn('Chart library not available:', error);
    LineChart = null;
    BarChart = null;
    PieChart = null;
  }
}

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = Math.min(screenWidth - 32, 400);

// Simple chart configuration
const chartConfig = {
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
};

export default function BusinessAnalyticsScreen({ navigation, route }) {
  const { businessId: routeBusinessId } = route.params || {};
  
  // State
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
  
  // Animation refs - SIMPLIFIED
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Auto-refresh refs
  const streamCleanup = useRef(null);

  // Initialize business ID
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

  // Auto-refresh on focus
  useFocusEffect(
    useCallback(() => {
      console.log('📊 Analytics screen focused');
      if (businessId) {
        loadAnalytics();
        setupAutoRefresh();
      }
      
      return () => {
        console.log('📊 Analytics screen unfocused');
        cleanupAutoRefresh();
      };
    }, [businessId, timeframe])
  );

  // Setup auto-refresh
  const setupAutoRefresh = useCallback(() => {
    if (!autoRefreshEnabled || !businessId) return;
    
    cleanupAutoRefresh();
    
    streamCleanup.current = createAnalyticsStream(
      timeframe,
      (data) => {
        console.log('📊 Auto-refresh data received');
        setAnalyticsData(data.data);
        setLastUpdated(new Date().toISOString());
        setError(null);
        
        // Simple pulse animation
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
          }),
        ]).start();
      },
      (error) => {
        console.warn('Auto-refresh error:', error);
      },
      30000 // 30 seconds
    );
  }, [autoRefreshEnabled, businessId, timeframe]);

  // Cleanup auto-refresh
  const cleanupAutoRefresh = useCallback(() => {
    if (streamCleanup.current) {
      streamCleanup.current();
      streamCleanup.current = null;
    }
  }, []);

  // Load analytics
  const loadAnalytics = useCallback(async (showLoading = true) => {
    if (!businessId) return;

    try {
      if (showLoading) {
        setIsLoading(!analyticsData);
        setRefreshing(true);
      }
      setError(null);
      
      console.log('📊 Loading analytics for:', businessId, timeframe);
      
      const data = await getBusinessAnalytics(timeframe, 'all');
      console.log('📊 Analytics loaded successfully');
      
      setAnalyticsData(data.data);
      setLastUpdated(new Date().toISOString());
      
      // Success animation
      if (showLoading) {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: false,
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

  // Fallback data
  const getFallbackData = () => ({
    sales: { 
      totalRevenue: 0, 
      totalOrders: 0, 
      averageOrderValue: 0, 
      trendData: { 
        labels: ['No Data'], 
        datasets: [{ data: [0] }] 
      } 
    },
    inventory: { 
      totalItems: 0, 
      activeItems: 0, 
      lowStockItems: 0, 
      totalValue: 0 
    },
    customers: { 
      totalCustomers: 0, 
      newCustomers: 0, 
      repeatCustomerRate: 0 
    },
    profit: { 
      revenue: 0, 
      expenses: 0, 
      grossProfit: 0, 
      profitMargin: 0 
    }
  });

  // Handle timeframe change
  const handleTimeframeChange = useCallback((newTimeframe) => {
    if (newTimeframe === timeframe) return;
    
    console.log('📊 Changing timeframe to:', newTimeframe);
    setTimeframe(newTimeframe);
  }, [timeframe]);

  // Handle tab change
  const handleTabChange = useCallback((tabKey) => {
    if (tabKey === activeTab) return;
    
    console.log('📊 Changing tab to:', tabKey);
    setActiveTab(tabKey);
  }, [activeTab]);

  // Handle report generation
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
      
      Alert.alert(
        '📊 Report Generated',
        `Your ${reportType} report has been generated.`,
        [
          { 
            text: 'Share', 
            onPress: () => shareReport(report.report, reportType) 
          },
          { text: 'OK' }
        ]
      );
      
      await triggerAutoRefresh('report_generated', { reportType });
      
    } catch (error) {
      console.error('❌ Report error:', error);
      Alert.alert('Error', `Failed to generate report: ${error.message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [isGeneratingReport, timeframe]);

  // Share report
  const shareReport = useCallback(async (report, reportType) => {
    try {
      const reportSummary = createReportSummary(report, reportType);
      
      if (isWeb) {
        Alert.alert('Report Summary', reportSummary);
      } else {
        await Share.share({
          title: `Business ${reportType} Report`,
          message: reportSummary,
        });
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Share Error', 'Unable to share the report');
    }
  }, []);

  // Create report summary
  const createReportSummary = (report, reportType) => {
    const period = `${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Report`;
    
    switch (reportType) {
      case 'sales':
        return `📈 ${period}\nOrders: ${report.salesReport?.summary?.totalOrders || 0}\nRevenue: $${(report.salesReport?.summary?.totalRevenue || 0).toFixed(2)}`;
      case 'inventory':
        return `📦 ${period}\nItems: ${report.inventoryReport?.summary?.totalItems || 0}\nValue: $${(report.inventoryReport?.summary?.totalValue || 0).toFixed(2)}`;
      default:
        return `📊 ${period}\nGenerated: ${new Date().toLocaleDateString()}`;
    }
  };

  // Toggle auto-refresh
  const toggleAutoRefresh = useCallback(() => {
    const newState = !autoRefreshEnabled;
    setAutoRefreshEnabled(newState);
    
    if (newState) {
      setupAutoRefresh();
    } else {
      cleanupAutoRefresh();
    }
  }, [autoRefreshEnabled, setupAutoRefresh, cleanupAutoRefresh]);

  // Process chart data
  const getProcessedChartData = (rawData) => {
    if (!rawData?.trendData?.labels?.length) {
      return {
        labels: ['No Data'],
        datasets: [{ data: [0] }]
      };
    }

    return {
      labels: rawData.trendData.labels.slice(0, 7),
      datasets: [{
        data: (rawData.trendData.datasets?.[0]?.data || [0]).slice(0, 7).map(val => Math.max(0, val || 0))
      }]
    };
  };

  // Simple Chart Component for Web
  const SimpleChart = ({ title, data, type = 'line' }) => (
    <View style={styles.webChart}>
      <Text style={styles.webChartTitle}>{title}</Text>
      <View style={styles.webChartContent}>
        <Text style={styles.webChartData}>
          {type === 'line' && data?.datasets?.[0]?.data && 
            `Data Points: ${data.datasets[0].data.join(', ')}`
          }
        </Text>
        <Text style={styles.webChartNote}>
          📱 Full charts available on mobile app
        </Text>
      </View>
    </View>
  );

  // Render tabs
  const renderTabs = () => (
    <View style={styles.tabsContainer}>
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
        >
          <MaterialIcons name={tab.icon} size={18} color={activeTab === tab.key ? '#4CAF50' : '#999'} />
          <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Render overview
  const renderOverview = () => {
    if (!analyticsData) return renderNoData('overview');
    
    return (
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
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

        {/* Charts */}
        <View style={styles.chartContainer}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Sales Trend - {timeframe}</Text>
          </View>
          
          {/* Mobile Chart */}
          {!isWeb && LineChart && analyticsData.sales ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={getProcessedChartData(analyticsData.sales)}
                width={Math.max(chartWidth, 300)}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                withDots={true}
                withInnerLines={false}
                withOuterLines={true}
                fromZero={true}
              />
            </ScrollView>
          ) : (
            /* Web Fallback */
            <SimpleChart 
              title="Sales Trend" 
              data={getProcessedChartData(analyticsData.sales)} 
              type="line" 
            />
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Reports</Text>
            <TouchableOpacity 
              style={styles.autoRefreshToggle}
              onPress={toggleAutoRefresh}
            >
              <MaterialIcons 
                name={autoRefreshEnabled ? "sync" : "sync-disabled"} 
                size={18} 
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
            >
              <MaterialCommunityIcons name="chart-line" size={20} color="#4CAF50" />
              <Text style={styles.actionText}>Sales Report</Text>
              {isGeneratingReport && <ActivityIndicator size="small" color="#4CAF50" />}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, isGeneratingReport && styles.actionButtonDisabled]}
              onPress={() => handleGenerateReport('inventory')}
              disabled={isGeneratingReport}
            >
              <MaterialCommunityIcons name="package-variant" size={20} color="#2196F3" />
              <Text style={styles.actionText}>Inventory</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, isGeneratingReport && styles.actionButtonDisabled]}
              onPress={() => handleGenerateReport('customers')}
              disabled={isGeneratingReport}
            >
              <MaterialCommunityIcons name="account-group" size={20} color="#FF9800" />
              <Text style={styles.actionText}>Customers</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  // Render sales tab
  const renderSales = () => {
    if (!analyticsData?.sales) return renderNoData('sales');
    
    return (
      <View style={styles.content}>
        <View style={styles.salesMetrics}>
          <View style={styles.metricCard}>
            <MaterialCommunityIcons name="currency-usd" size={28} color="#4CAF50" />
            <Text style={styles.metricValue}>
              ${(analyticsData.sales.totalRevenue || 0).toLocaleString()}
            </Text>
            <Text style={styles.metricLabel}>Total Revenue</Text>
          </View>
          
          <View style={styles.metricCard}>
            <MaterialIcons name="shopping-cart" size={28} color="#2196F3" />
            <Text style={styles.metricValue}>
              {analyticsData.sales.totalOrders || 0}
            </Text>
            <Text style={styles.metricLabel}>Total Orders</Text>
          </View>
        </View>

        {/* Chart */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Revenue Trend</Text>
          {!isWeb && LineChart ? (
            <LineChart
              data={getProcessedChartData(analyticsData.sales)}
              width={chartWidth}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          ) : (
            <SimpleChart 
              title="Revenue" 
              data={getProcessedChartData(analyticsData.sales)} 
            />
          )}
        </View>
      </View>
    );
  };

  // Render inventory tab
  const renderInventory = () => {
    if (!analyticsData?.inventory) return renderNoData('inventory');
    
    return (
      <View style={styles.content}>
        <View style={styles.inventoryMetrics}>
          <View style={styles.metricCard}>
            <MaterialCommunityIcons name="package-variant" size={28} color="#4CAF50" />
            <Text style={styles.metricValue}>
              {analyticsData.inventory.totalItems || 0}
            </Text>
            <Text style={styles.metricLabel}>Total Items</Text>
          </View>
          
          <View style={styles.metricCard}>
            <MaterialIcons name="warning" size={28} color="#FF9800" />
            <Text style={styles.metricValue}>
              {analyticsData.inventory.lowStockItems || 0}
            </Text>
            <Text style={styles.metricLabel}>Low Stock</Text>
          </View>
        </View>
      </View>
    );
  };

  // Render customers tab
  const renderCustomers = () => {
    if (!analyticsData?.customers) return renderNoData('customers');
    
    return (
      <View style={styles.content}>
        <View style={styles.customerMetrics}>
          <View style={styles.metricCard}>
            <MaterialIcons name="people" size={28} color="#2196F3" />
            <Text style={styles.metricValue}>
              {analyticsData.customers.totalCustomers || 0}
            </Text>
            <Text style={styles.metricLabel}>Total Customers</Text>
          </View>
          
          <View style={styles.metricCard}>
            <MaterialIcons name="person-add" size={28} color="#4CAF50" />
            <Text style={styles.metricValue}>
              {analyticsData.customers.newCustomers || 0}
            </Text>
            <Text style={styles.metricLabel}>New This Period</Text>
          </View>
        </View>
      </View>
    );
  };

  // Render no data state
  const renderNoData = (dataType) => (
    <View style={styles.noDataContainer}>
      <MaterialCommunityIcons name="chart-box-outline" size={64} color="#e0e0e0" />
      <Text style={styles.noDataText}>No {dataType} data available</Text>
      <Text style={styles.noDataSubtext}>Data will appear here once you have business activity</Text>
      <TouchableOpacity 
        style={styles.refreshDataButton}
        onPress={() => loadAnalytics(true)}
      >
        <MaterialIcons name="refresh" size={18} color="#4CAF50" />
        <Text style={styles.refreshDataText}>Refresh Data</Text>
      </TouchableOpacity>
    </View>
  );

  // Render tab content
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

  // Loading state
  if (isLoading && !analyticsData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Main render
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
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
        >
          <MaterialIcons name="refresh" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {/* Timeframe Selector */}
      <View style={styles.timeframeContainer}>
        {['week', 'month', 'quarter', 'year'].map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.timeframeButton,
              timeframe === period && styles.activeTimeframe
            ]}
            onPress={() => handleTimeframeChange(period)}
          >
            <Text style={[
              styles.timeframeText,
              timeframe === period && styles.activeTimeframeText
            ]}>
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tabs */}
      {renderTabs()}

      {/* Content */}
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
            <MaterialIcons name="warning" size={18} color="#FF5722" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => loadAnalytics(true)}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {renderTabContent()}
      </ScrollView>

      {/* Status Indicator */}
      {autoRefreshEnabled && (
        <View style={styles.statusIndicator}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Live updates enabled</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

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
  webChart: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
  },
  webChartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  webChartContent: {
    alignItems: 'center',
  },
  webChartData: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  webChartNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
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
    fontSize: 18,
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