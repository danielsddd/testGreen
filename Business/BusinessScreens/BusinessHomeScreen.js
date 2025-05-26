// Business/BusinessScreens/BusinessHomeScreen.js - FIXED COMPLETE VERSION
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
  MaterialIcons,
  Ionicons 
} from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import API services
import { getBusinessDashboard } from '../services/businessApi';
import { getBusinessInventory } from '../services/businessApi';
import { getBusinessOrders } from '../services/businessOrderApi';
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

// Web-compatible animation config (defined in file)
const webAnimationConfig = {
  duration: 300,
  useNativeDriver: Platform.select({ web: false, default: true }),
  tension: 100,
  friction: 8,
};

// Web-compatible styles helper (defined in file)
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
  const [inventoryData, setInventoryData] = useState(null);
  const [ordersData, setOrdersData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [inventoryStats, setInventoryStats] = useState({
    inStock: 0,
    lowStock: 0,
    outOfStock: 0
  });
  
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

  // ===== LOAD ALL DATA =====
  const loadAllData = useCallback(async (showLoading = true) => {
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

      console.log('📊 Loading all business data for:', businessId);
      
      // Load dashboard data
      const [dashData, invData, orderData] = await Promise.all([
        getBusinessDashboard(),
        getBusinessInventory(businessId),
        getBusinessOrders(businessId, { limit: 5, status: 'all' })
      ]);
      
      console.log('✅ All data loaded successfully');
      
      setDashboardData(dashData);
      setInventoryData(invData);
      setOrdersData(orderData);
      setLastUpdated(new Date().toISOString());
      
      // Calculate inventory stats
      if (invData?.inventory) {
        const stats = {
          inStock: invData.inventory.filter(item => 
            item.status === 'active' && (item.quantity || 0) > (item.minThreshold || 5)
          ).length,
          lowStock: invData.inventory.filter(item => 
            item.status === 'active' && (item.quantity || 0) > 0 && (item.quantity || 0) <= (item.minThreshold || 5)
          ).length,
          outOfStock: invData.inventory.filter(item => 
            item.status === 'active' && (item.quantity || 0) === 0
          ).length
        };
        setInventoryStats(stats);
      }
      
      // Trigger auto-refresh for other components
      await triggerAutoRefresh('dashboard_loaded', { businessId });
      
      // Success animation
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
      console.error('❌ Error loading data:', error);
      setError(error.message);
      
      // Show empty structure if no data
      if (!dashboardData) {
        setDashboardData(getEmptyDashboardStructure());
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [businessId, dashboardData]);

  // ===== EMPTY DASHBOARD STRUCTURE =====
  const getEmptyDashboardStructure = () => ({
    businessInfo: {
      businessName: 'Your Business',
      businessType: 'Plant Store',
      email: businessId,
      rating: 0,
      reviewCount: 0,
      address: null,
      phone: null
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
        loadAllData(false); // Silent refresh
      }, 60000); // 1 minute
      
      return () => {
        if (refreshTimer.current) {
          clearInterval(refreshTimer.current);
          refreshTimer.current = null;
        }
      };
    }
  }, [autoRefreshEnabled, businessId, loadAllData]);

  // ===== FOCUS EFFECT =====
  useFocusEffect(
    useCallback(() => {
      console.log('🏠 Business Home focused - loading data...');
      if (businessId) {
        loadAllData();
      }
      
      return () => {
        console.log('🏠 Business Home unfocused');
      };
    }, [businessId, loadAllData])
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

  const handleOrderPress = (order) => {
    navigation.navigate('BusinessOrdersScreen', { businessId, selectedOrderId: order.id });
  };

  // ===== TOGGLE AUTO-REFRESH =====
  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
  };

  // ===== RENDER BUSINESS INFO CARD =====
  const renderBusinessInfoCard = () => {
    const { businessInfo } = dashboardData || {};
    
    return (
      <View style={styles.businessInfoCard}>
        {/* Business Avatar */}
        <View style={styles.businessAvatar}>
          <MaterialIcons name="store" size={40} color="#4CAF50" />
        </View>
        
        {/* Business Details */}
        <View style={styles.businessDetails}>
          <Text style={styles.businessName}>
            {businessInfo?.businessName || 'Your Business'}
          </Text>
          <Text style={styles.businessType}>
            {businessInfo?.businessType || 'Plant Store'}
          </Text>
          
          {/* Contact Info */}
          <View style={styles.contactInfo}>
            {businessInfo?.email && (
              <View style={styles.contactItem}>
                <MaterialIcons name="email" size={14} color="#666" />
                <Text style={styles.contactText} numberOfLines={1}>
                  {businessInfo.email}
                </Text>
              </View>
            )}
            
            {businessInfo?.phone && (
              <View style={styles.contactItem}>
                <MaterialIcons name="phone" size={14} color="#666" />
                <Text style={styles.contactText}>
                  {businessInfo.phone}
                </Text>
              </View>
            )}
            
            {businessInfo?.address && (
              <View style={styles.contactItem}>
                <MaterialIcons name="location-on" size={14} color="#666" />
                <Text style={styles.contactText} numberOfLines={1}>
                  {businessInfo.address.street || businessInfo.address}
                </Text>
              </View>
            )}
          </View>
          
          {/* Rating */}
          {businessInfo?.rating > 0 && (
            <View style={styles.ratingContainer}>
              <MaterialIcons name="star" size={16} color="#FFD700" />
              <Text style={styles.ratingText}>
                {businessInfo.rating.toFixed(1)} ({businessInfo.reviewCount} reviews)
              </Text>
            </View>
          )}
        </View>
        
        {/* Header Actions */}
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
          
          <TouchableOpacity 
            style={[styles.profileButton, createWebCursor()]}
            onPress={handleNavigateToProfile}
            activeOpacity={0.7}
          >
            <MaterialIcons name="settings" size={20} color="#666" />
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
          trend={metrics?.salesTrend || 'neutral'}
          change={metrics?.salesGrowth}
          autoRefresh={autoRefreshEnabled}
          onPress={handleNavigateToAnalytics}
        />
        
        <KPIWidget
          title="New Orders"
          value={metrics?.newOrders || 0}
          icon="shopping-cart"
          format="number"
          color="#2196F3"
          trend={metrics?.newOrders > 0 ? 'up' : 'neutral'}
          onPress={handleNavigateToOrders}
        />
        
        <KPIWidget
          title="Low Stock Items"
          value={inventoryStats.lowStock || 0}
          icon="warning"
          format="number"
          color="#FF9800"
          trend={inventoryStats.lowStock > 0 ? 'down' : 'neutral'}
          onPress={handleNavigateToInventory}
        />
        
        <KPIWidget
          title="Total Inventory"
          value={inventoryData?.inventory?.length || 0}
          icon="inventory"
          format="number"
          color="#9C27B0"
          onPress={handleNavigateToInventory}
        />
      </View>
    );
  };

  // ===== RENDER RECENT ORDERS =====
  const renderRecentOrders = () => {
    const recentOrders = ordersData?.orders?.slice(0, 5) || [];
    
    if (recentOrders.length === 0) {
      return (
        <View style={styles.recentOrdersContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <MaterialIcons name="receipt" size={20} color="#2196F3" />
              <Text style={styles.sectionTitle}>Recent Orders</Text>
            </View>
            <TouchableOpacity 
              onPress={handleNavigateToOrders}
              style={createWebCursor()}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.emptyOrdersState}>
            <MaterialIcons name="receipt-long" size={48} color="#e0e0e0" />
            <Text style={styles.emptyText}>No orders yet</Text>
            <Text style={styles.emptySubtext}>
              Orders will appear here as customers purchase
            </Text>
          </View>
        </View>
      );
    }
    
    return (
      <View style={styles.recentOrdersContainer}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <MaterialIcons name="receipt" size={20} color="#2196F3" />
            <Text style={styles.sectionTitle}>Recent Orders</Text>
          </View>
          <TouchableOpacity 
            onPress={handleNavigateToOrders}
            style={createWebCursor()}
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        
        {recentOrders.map((order, index) => (
          <TouchableOpacity
            key={order.id || index}
            style={[styles.orderItem, createWebCursor()]}
            onPress={() => handleOrderPress(order)}
            activeOpacity={0.7}
          >
            <View style={styles.orderLeft}>
              <View style={[styles.orderStatus, { backgroundColor: getOrderStatusColor(order.status) }]}>
                <MaterialIcons name={getOrderStatusIcon(order.status)} size={16} color="#fff" />
              </View>
              <View style={styles.orderInfo}>
                <Text style={styles.orderNumber}>#{order.confirmationNumber || order.id}</Text>
                <Text style={styles.orderCustomer} numberOfLines={1}>
                  {order.customerName || 'Unknown Customer'}
                </Text>
                <Text style={styles.orderTime}>{getTimeAgo(order.orderDate)}</Text>
              </View>
            </View>
            
            <View style={styles.orderRight}>
              <Text style={styles.orderAmount}>${(order.total || 0).toFixed(2)}</Text>
              <Text style={styles.orderItems}>
                {order.items?.length || 0} items
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // ===== RENDER QUICK ACTIONS =====
  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity 
          style={[styles.quickAction, createWebCursor()]}
          onPress={handleNavigateToInventory}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#e8f5e9' }]}>
            <MaterialCommunityIcons name="package-variant" size={24} color="#4CAF50" />
          </View>
          <Text style={styles.quickActionText}>Add Product</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickAction, createWebCursor()]}
          onPress={handleNavigateToOrders}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#e3f2fd' }]}>
            <MaterialIcons name="receipt" size={24} color="#2196F3" />
          </View>
          <Text style={styles.quickActionText}>Orders</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickAction, createWebCursor()]}
          onPress={handleNavigateToCustomers}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#fff3e0' }]}>
            <MaterialIcons name="people" size={24} color="#FF9800" />
          </View>
          <Text style={styles.quickActionText}>Customers</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickAction, createWebCursor()]}
          onPress={handleNavigateToWatering}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#e0f7fa' }]}>
            <MaterialCommunityIcons name="water" size={24} color="#00BCD4" />
          </View>
          <Text style={styles.quickActionText}>Plant Care</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickAction, createWebCursor()]}
          onPress={handleNavigateToAnalytics}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#f3e5f5' }]}>
            <MaterialIcons name="analytics" size={24} color="#9C27B0" />
          </View>
          <Text style={styles.quickActionText}>Analytics</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickAction, createWebCursor()]}
          onPress={handleNavigateToProfile}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#eceff1' }]}>
            <MaterialIcons name="business" size={24} color="#607D8B" />
          </View>
          <Text style={styles.quickActionText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ===== HELPER FUNCTIONS =====
  const getOrderStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FFA000';
      case 'confirmed': return '#2196F3';
      case 'ready': return '#9C27B0';
      case 'completed': return '#4CAF50';
      case 'cancelled': return '#F44336';
      default: return '#757575';
    }
  };

  const getOrderStatusIcon = (status) => {
    switch (status) {
      case 'pending': return 'hourglass-empty';
      case 'confirmed': return 'check-circle-outline';
      case 'ready': return 'shopping-bag';
      case 'completed': return 'check-circle';
      case 'cancelled': return 'cancel';
      default: return 'help-outline';
    }
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return 'Unknown time';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // ===== RENDER DASHBOARD CONTENT =====
  const renderDashboardContent = () => {
    const hasData = (inventoryData?.inventory?.length > 0) || 
                   (ordersData?.orders?.length > 0) || 
                   (dashboardData?.topProducts?.length > 0);
    
    // Calculate chart data with actual inventory stats
    const chartData = {
      sales: dashboardData?.chartData?.sales || { labels: [], values: [], total: 0, average: 0 },
      inventory: inventoryStats,
      orders: dashboardData?.chartData?.orders || { 
        pending: 0, 
        confirmed: 0, 
        ready: 0, 
        completed: 0, 
        total: 0 
      }
    };
    
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
        {/* Business Info Card */}
        {renderBusinessInfoCard()}

        {/* KPI Widgets */}
        {renderKPIWidgets()}

        {/* Low Stock Banner */}
        {inventoryStats.lowStock > 0 && (
          <LowStockBanner 
            lowStockItems={inventoryData?.inventory?.filter(item => 
              item.status === 'active' && 
              (item.quantity || 0) > 0 && 
              (item.quantity || 0) <= (item.minThreshold || 5)
            ) || []}
            onManageStock={handleNavigateToInventory}
          />
        )}

        {/* Dashboard Charts */}
        <BusinessDashboardCharts
          salesData={chartData.sales}
          inventoryData={chartData.inventory}
          ordersData={chartData.orders}
          onRefresh={loadAllData}
          autoRefresh={autoRefreshEnabled}
        />

        {/* Recent Orders */}
        {renderRecentOrders()}

        {/* Top Products */}
        {dashboardData?.topProducts && dashboardData.topProducts.length > 0 && (
          <TopSellingProductsList
            businessId={businessId}
            onRefresh={loadAllData}
            onProductPress={(product) => {
              navigation.navigate('BusinessProductDetailScreen', { 
                businessId, 
                productId: product.id 
              });
            }}
            limit={5}
          />
        )}

        {/* Quick Actions */}
        {renderQuickActions()}

        {/* Getting Started for new businesses */}
        {!hasData && (
          <View style={styles.gettingStartedSection}>
            <Text style={styles.sectionTitle}>Getting Started</Text>
            
            <TouchableOpacity 
              style={[styles.getStartedCard, createWebCursor()]}
              onPress={handleNavigateToInventory}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="numeric-1-circle" size={32} color="#4CAF50" />
              <View style={styles.getStartedContent}>
                <Text style={styles.getStartedTitle}>Add Your First Product</Text>
                <Text style={styles.getStartedText}>
                  Start by adding plants and products to your inventory
                </Text>
              </View>
              <MaterialIcons name="arrow-forward" size={20} color="#4CAF50" />
            </TouchableOpacity>
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
            onPress={() => loadAllData(true)}
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
            onRefresh={() => loadAllData(true)}
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
          <Text style={styles.statusText}>Live updates</Text>
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
      width: '100%',
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
  // Business Info Card
  businessInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    ...createWebShadow({
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
  },
  businessAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  businessDetails: {
    flex: 1,
  },
  businessName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  businessType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  contactInfo: {
    gap: 4,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoRefreshToggle: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  profileButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  // KPI Widgets
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  // Recent Orders
  recentOrdersContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    ...createWebShadow({
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  viewAllText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  orderStatus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  orderCustomer: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  orderTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  orderItems: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  emptyOrdersState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  // Quick Actions
  quickActionsContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    ...createWebShadow({
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  quickAction: {
    flex: 1,
    minWidth: 100,
    alignItems: 'center',
    gap: 8,
    ...(isWeb && {
      flex: 'none',
      width: '30%',
      minWidth: 120,
    }),
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
  },
  // Getting Started
  gettingStartedSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    ...createWebShadow({
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
  },
  getStartedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f0f9f3',
    borderRadius: 12,
    marginTop: 16,
    gap: 16,
  },
  getStartedContent: {
    flex: 1,
  },
  getStartedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  getStartedText: {
    fontSize: 14,
    color: '#666',
  },
  // Status Indicator
  statusIndicator: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    ...createWebShadow({
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    }),
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});