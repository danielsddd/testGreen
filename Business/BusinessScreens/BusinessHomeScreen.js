// Business/BusinessScreens/BusinessHomeScreen.js - COMPLETE WEB & MOBILE COMPATIBLE
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
  Alert,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons 
} from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import API services
import { getBusinessDashboard } from '../services/businessApi';
import { triggerAutoRefresh } from '../services/businessAnalyticsApi';

// Import components
import KPIWidget from '../components/KPIWidget';
import BusinessDashboardCharts from '../components/BusinessDashboardCharts';
import LowStockBanner from '../components/LowStockBanner';
import TopSellingProductsList from '../components/TopSellingProductsList';
import NotificationBell from '../components/NotificationBell';
import { useNotificationManager } from '../components/NotificationManager';

const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// Web-compatible animation config
const webAnimationConfig = {
  duration: 300,
  useNativeDriver: Platform.select({ web: false, default: true }),
  tension: 100,
  friction: 8,
};

// Web-compatible styles helper
const createWebShadow = (mobileStyle) => {
  if (Platform.OS === 'web') {
    return {
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    };
  }
  return mobileStyle;
};

const createWebCursor = (cursor = 'pointer') => {
  if (Platform.OS === 'web') {
    return { cursor };
  }
  return {};
};

export default function BusinessHomeScreen({ navigation, route }) {
  const { businessId: routeBusinessId } = route?.params || {};
  
  // ===== STATE MANAGEMENT =====
  const [businessId, setBusinessId] = useState(routeBusinessId);
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  
  // ===== ANIMATION REFS - WEB COMPATIBLE =====
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  
  // ===== AUTO-REFRESH TIMER =====
  const refreshTimer = useRef(null);

  // ===== NOTIFICATION MANAGER =====
  const {
    notifications,
    hasNewNotifications,
    markAsRead,
    clearAllNotifications
  } = useNotificationManager(businessId, navigation);

  // ===== INITIALIZE BUSINESS ID =====
  useEffect(() => {
    const initBusinessId = async () => {
      if (!businessId) {
        try {
          const email = await AsyncStorage.getItem('userEmail');
          const storedBusinessId = await AsyncStorage.getItem('businessId');
          const finalBusinessId = storedBusinessId || email;
          console.log('🏢 Initialized business ID:', finalBusinessId);
          setBusinessId(finalBusinessId);
        } catch (error) {
          console.error('❌ Error getting business ID:', error);
        }
      }
    };
    
    initBusinessId();
  }, []);

  // ===== LOAD DASHBOARD DATA =====
  const loadDashboard = useCallback(async (showLoading = true) => {
    if (!businessId) {
      console.log('⚠️ No business ID available');
      return;
    }

    try {
      if (showLoading) {
        setIsLoading(!dashboardData);
        setRefreshing(true);
      }
      setError(null);

      console.log('📊 Loading dashboard data for business:', businessId);
      const data = await getBusinessDashboard();
      console.log('✅ Dashboard data loaded:', data);
      
      setDashboardData(data);
      setLastUpdated(new Date().toISOString());
      
      // Trigger auto-refresh for other components
      await triggerAutoRefresh('dashboard_loaded', { businessId });
      
      // Success animation - Web compatible
      if (showLoading) {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: webAnimationConfig.duration,
            useNativeDriver: webAnimationConfig.useNativeDriver,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: webAnimationConfig.duration,
            useNativeDriver: webAnimationConfig.useNativeDriver,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: webAnimationConfig.tension,
            friction: webAnimationConfig.friction,
            useNativeDriver: webAnimationConfig.useNativeDriver,
          }),
        ]).start();
      }
      
    } catch (error) {
      console.error('❌ Error loading dashboard:', error);
      setError(error.message);
      
      // Show fallback data structure (NO MOCK DATA)
      if (!dashboardData) {
        setDashboardData(getEmptyDashboardStructure());
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [businessId, dashboardData]);

  // ===== EMPTY DASHBOARD STRUCTURE (NO MOCK DATA) =====
  const getEmptyDashboardStructure = () => ({
    businessInfo: {
      businessName: 'Your Business',
      businessType: 'Plant Store',
      email: businessId,
      rating: 0,
      reviewCount: 0
    },
    metrics: {
      totalSales: 0,
      salesToday: 0,
      newOrders: 0,
      lowStockItems: 0,
      totalInventory: 0,
      activeInventory: 0,
      totalOrders: 0,
      inventoryValue: 0
    },
    topProducts: [],
    recentOrders: [],
    lowStockDetails: [],
    chartData: {
      sales: { labels: [], values: [], total: 0, average: 0 },
      orders: { pending: 0, confirmed: 0, ready: 0, completed: 0, total: 0 },
      inventory: { inStock: 0, lowStock: 0, outOfStock: 0 }
    }
  });

  // ===== AUTO-REFRESH SETUP =====
  useEffect(() => {
    if (autoRefreshEnabled && businessId) {
      refreshTimer.current = setInterval(() => {
        console.log('🔄 Auto-refreshing dashboard...');
        loadDashboard(false); // Silent refresh
      }, 60000); // 1 minute
      
      return () => {
        if (refreshTimer.current) {
          clearInterval(refreshTimer.current);
          refreshTimer.current = null;
        }
      };
    }
  }, [autoRefreshEnabled, businessId, loadDashboard]);

  // ===== FOCUS EFFECT =====
  useFocusEffect(
    useCallback(() => {
      console.log('🏠 Business Home focused - loading dashboard...');
      if (businessId) {
        loadDashboard();
      }
      
      return () => {
        console.log('🏠 Business Home unfocused');
      };
    }, [businessId, loadDashboard])
  );

  // ===== NAVIGATION HANDLERS =====
  const handleNavigateToAnalytics = () => {
    navigation.navigate('BusinessAnalyticsScreen', { businessId });
  };

  const handleNavigateToInventory = () => {
    navigation.navigate('AddInventoryScreen', { businessId, showInventory: true });
  };

  const handleNavigateToOrders = () => {
    navigation.navigate('BusinessOrdersScreen', { businessId });
  };

  const handleNavigateToCustomers = () => {
    navigation.navigate('CustomerListScreen', { businessId });
  };

  const handleNavigateToWatering = () => {
    navigation.navigate('WateringChecklistScreen', { businessId });
  };

  const handleNotificationPress = () => {
    navigation.navigate('NotificationCenterScreen', { businessId });
  };

  const handleNavigateToProfile = () => {
    navigation.navigate('BusinessProfileScreen', { businessId });
  };

  // ===== TOGGLE AUTO-REFRESH =====
  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
  };

  // ===== RENDER BUSINESS HEADER =====
  const renderBusinessHeader = () => {
    const { businessInfo } = dashboardData || {};
    
    return (
      <View style={styles.businessHeader}>
        <View style={styles.businessInfo}>
          <Text style={styles.businessName}>
            {businessInfo?.businessName || 'Your Business'}
          </Text>
          <Text style={styles.businessType}>
            {businessInfo?.businessType || 'Plant Store'}
          </Text>
          <Text style={styles.lastUpdated}>
            Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Just now'}
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          <NotificationBell
            hasNotifications={hasNewNotifications}
            notificationCount={notifications.length}
            onPress={handleNotificationPress}
          />
          
          <TouchableOpacity 
            style={[styles.autoRefreshToggle, createWebCursor()]}
            onPress={toggleAutoRefresh}
            activeOpacity={0.7}
          >
            <MaterialIcons 
              name={autoRefreshEnabled ? "sync" : "sync-disabled"} 
              size={20} 
              color={autoRefreshEnabled ? "#4CAF50" : "#999"} 
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ===== RENDER KPI WIDGETS =====
  const renderKPIWidgets = () => {
    const { metrics } = dashboardData || {};
    
    return (
      <View style={styles.kpiContainer}>
        <KPIWidget
          title="Total Revenue"
          value={metrics?.totalSales || 0}
          icon="cash"
          format="currency"
          color="#4CAF50"
          autoRefresh={autoRefreshEnabled}
          onPress={handleNavigateToAnalytics}
        />
        
        <KPIWidget
          title="New Orders"
          value={metrics?.newOrders || 0}
          icon="shopping-cart"
          format="number"
          color="#2196F3"
          onPress={handleNavigateToOrders}
        />
        
        <KPIWidget
          title="Low Stock Items"
          value={metrics?.lowStockItems || 0}
          icon="warning"
          format="number"
          color="#FF9800"
          trend={metrics?.lowStockItems > 0 ? 'down' : 'neutral'}
          onPress={handleNavigateToInventory}
        />
        
        <KPIWidget
          title="Total Inventory"
          value={metrics?.totalInventory || 0}
          icon="inventory"
          format="number"
          color="#9C27B0"
          onPress={handleNavigateToInventory}
        />
      </View>
    );
  };

  // ===== RENDER QUICK ACTIONS =====
  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <Text style={styles.sectionSubtitle}>
        Common tasks and management tools
      </Text>
      
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity 
          style={[styles.quickAction, createWebCursor()]}
          onPress={handleNavigateToInventory}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="package-variant" size={24} color="#4CAF50" />
          <Text style={styles.quickActionText}>Manage Inventory</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickAction, createWebCursor()]}
          onPress={handleNavigateToOrders}
          activeOpacity={0.7}
        >
          <MaterialIcons name="receipt" size={24} color="#2196F3" />
          <Text style={styles.quickActionText}>View Orders</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickAction, createWebCursor()]}
          onPress={handleNavigateToCustomers}
          activeOpacity={0.7}
        >
          <MaterialIcons name="people" size={24} color="#FF9800" />
          <Text style={styles.quickActionText}>Customers</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickAction, createWebCursor()]}
          onPress={handleNavigateToWatering}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="water" size={24} color="#00BCD4" />
          <Text style={styles.quickActionText}>Plant Care</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickAction, createWebCursor()]}
          onPress={handleNavigateToAnalytics}
          activeOpacity={0.7}
        >
          <MaterialIcons name="analytics" size={24} color="#9C27B0" />
          <Text style={styles.quickActionText}>Analytics</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickAction, createWebCursor()]}
          onPress={handleNavigateToProfile}
          activeOpacity={0.7}
        >
          <MaterialIcons name="business" size={24} color="#607D8B" />
          <Text style={styles.quickActionText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ===== RENDER EMPTY STATE =====
  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <MaterialCommunityIcons name="store-outline" size={64} color="#e0e0e0" />
      <Text style={styles.emptyStateTitle}>Welcome to Your Business Dashboard</Text>
      <Text style={styles.emptyStateText}>
        Get started by adding products to your inventory and setting up your business profile.
      </Text>
      <TouchableOpacity 
        style={[styles.getStartedButton, createWebCursor()]}
        onPress={handleNavigateToInventory}
        activeOpacity={0.7}
      >
        <MaterialIcons name="add-business" size={20} color="#4CAF50" />
        <Text style={styles.getStartedText}>Add Your First Product</Text>
      </TouchableOpacity>
    </View>
  );

  // ===== RENDER DASHBOARD CONTENT =====
  const renderDashboardContent = () => {
    if (!dashboardData) return renderEmptyState();
    
    const { businessInfo, metrics, topProducts, recentOrders, lowStockDetails, chartData } = dashboardData;
    
    // Check if we have any meaningful data
    const hasData = (metrics?.totalInventory > 0) || (recentOrders?.length > 0) || (topProducts?.length > 0);
    
    return (
      <Animated.View 
        style={[
          styles.dashboardContent,
          {
            opacity: fadeAnim,
            ...(!isWeb && {
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ]
            })
          }
        ]}
      >
        {/* Business Header */}
        {renderBusinessHeader()}

        {/* KPI Widgets */}
        {renderKPIWidgets()}

        {/* Low Stock Banner - Only show if there are low stock items */}
        {lowStockDetails && lowStockDetails.length > 0 && (
          <LowStockBanner 
            lowStockItems={lowStockDetails}
            onManageStock={handleNavigateToInventory}
          />
        )}

        {/* Dashboard Charts - Only show if we have data */}
        {hasData && (
          <BusinessDashboardCharts
            salesData={chartData?.sales || { labels: [], values: [], total: 0, average: 0 }}
            inventoryData={chartData?.inventory || { inStock: 0, lowStock: 0, outOfStock: 0 }}
            ordersData={chartData?.orders || { pending: 0, confirmed: 0, ready: 0, completed: 0, total: 0 }}
            onRefresh={loadDashboard}
            autoRefresh={autoRefreshEnabled}
          />
        )}

        {/* Top Products - Only show if there are products */}
        {topProducts && topProducts.length > 0 && (
          <TopSellingProductsList
            businessId={businessId}
            onRefresh={loadDashboard}
            onProductPress={(product) => {
              navigation.navigate('BusinessProductDetailScreen', { 
                businessId, 
                productId: product.id 
              });
            }}
          />
        )}

        {/* Quick Actions - Always show */}
        {renderQuickActions()}

        {/* Empty state for new businesses */}
        {!hasData && (
          <View style={styles.gettingStartedSection}>
            <Text style={styles.sectionTitle}>Getting Started</Text>
            <Text style={styles.sectionSubtitle}>
              Set up your business to start seeing data here
            </Text>
            
            <View style={styles.onboardingSteps}>
              <View style={styles.onboardingStep}>
                <View style={[styles.stepNumber, { backgroundColor: '#4CAF50' }]}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Add Products</Text>
                  <Text style={styles.stepDescription}>
                    Start by adding plants and products to your inventory
                  </Text>
                </View>
                <TouchableOpacity 
                  style={[styles.stepAction, createWebCursor()]}
                  onPress={handleNavigateToInventory}
                >
                  <MaterialIcons name="arrow-forward" size={16} color="#4CAF50" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.onboardingStep}>
                <View style={[styles.stepNumber, { backgroundColor: '#2196F3' }]}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Complete Profile</Text>
                  <Text style={styles.stepDescription}>
                    Set up your business information and contact details
                  </Text>
                </View>
                <TouchableOpacity 
                  style={[styles.stepAction, createWebCursor()]}
                  onPress={handleNavigateToProfile}
                >
                  <MaterialIcons name="arrow-forward" size={16} color="#2196F3" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.onboardingStep}>
                <View style={[styles.stepNumber, { backgroundColor: '#FF9800' }]}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Start Selling</Text>
                  <Text style={styles.stepDescription}>
                    Begin processing orders and managing customers
                  </Text>
                </View>
                <TouchableOpacity 
                  style={[styles.stepAction, createWebCursor()]}
                  onPress={handleNavigateToOrders}
                >
                  <MaterialIcons name="arrow-forward" size={16} color="#FF9800" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Animated.View>
    );
  };

  // ===== LOADING STATE =====
  if (isLoading && !dashboardData) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading your dashboard...</Text>
          <Text style={styles.loadingSubtext}>Getting your business insights ready</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ===== ERROR STATE =====
  if (error && !dashboardData) {
    return (
      <SafeAreaView style={[styles.container, styles.errorContainer]}>
        <View style={styles.errorContent}>
          <MaterialIcons name="error-outline" size={64} color="#f44336" />
          <Text style={styles.errorTitle}>Unable to Load Dashboard</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={[styles.retryButton, createWebCursor()]}
            onPress={() => loadDashboard(true)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ===== MAIN RENDER =====
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboard(true)}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
        showsVerticalScrollIndicator={!isWeb}
      >
        {renderDashboardContent()}
      </ScrollView>
      
      {/* Auto-refresh Status */}
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
    ...(isWeb && {
      maxWidth: 1200,
      alignSelf: 'center',
    }),
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
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
    textAlign: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContent: {
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  dashboardContent: {
    flex: 1,
  },
  businessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    ...createWebShadow({
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    }),
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  businessType: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  autoRefreshToggle: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
    ...(isWeb && {
      justifyContent: 'center',
    }),
  },
  quickActionsContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    ...createWebShadow({
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    ...(isWeb && {
      justifyContent: 'center',
    }),
  },
  quickAction: {
    flex: 1,
    minWidth: 120,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    ...(isWeb && {
      flex: 'none',
      minWidth: 140,
    }),
  },
  quickActionText: {
    fontSize: 12,
    color: '#333',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    ...createWebShadow({
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    }),
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  getStartedText: {
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 8,
  },
  gettingStartedSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    ...createWebShadow({
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    }),
  },
  onboardingSteps: {
    gap: 16,
  },
  onboardingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  stepAction: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    ...createWebShadow({
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    }),
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