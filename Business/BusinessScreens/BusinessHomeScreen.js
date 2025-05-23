// Business/BusinessScreens/BusinessHomeScreen.js - FIXED VERSION - NO MOCK DATA
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons, 
  FontAwesome,
  Ionicons 
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

// Import Business Components
import KPIWidget from '../components/KPIWidget';
import BusinessDashboardCharts from '../components/BusinessDashboardCharts';
import LowStockBanner from '../components/LowStockBanner';
import TopSellingProductsList from '../components/TopSellingProductsList';
import OrderDetailModal from '../components/OrderDetailModal';
import NotificationBell from '../components/NotificationBell';
import { useNotificationManager } from '../components/NotificationManager';

// Import API services
import { getBusinessDashboard } from '../services/businessApi';

export default function BusinessHomeScreen({ navigation }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [businessId, setBusinessId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  // Notification manager
  const {
    hasNewNotifications,
    notifications,
    clearAllNotifications
  } = useNotificationManager(businessId, navigation);
  
  // Load dashboard data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  // Initialize business ID
  useEffect(() => {
    const initializeBusinessId = async () => {
      try {
        const email = await AsyncStorage.getItem('userEmail');
        const storedBusinessId = await AsyncStorage.getItem('businessId');
        const id = storedBusinessId || email;
        setBusinessId(id);
      } catch (error) {
        console.error('Error getting business ID:', error);
      }
    };
    
    initializeBusinessId();
  }, []);
  
  const loadDashboardData = async () => {
    if (refreshing) return; // Prevent duplicate calls
    
    setIsLoading(!dashboardData); // Only show loading on first load
    setError(null);
    setRefreshing(true);
    
    try {
      console.log('Loading dashboard data...');
      const data = await getBusinessDashboard();
      console.log('Dashboard data loaded:', data);
      
      setDashboardData(data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Could not load dashboard data. Please try again.');
      
      // NO MOCK/FALLBACK DATA - just set empty state
      if (!dashboardData) {
        setDashboardData(null);
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };
  
  const onRefresh = () => {
    loadDashboardData();
  };
  
  // Navigation handlers with descriptive labels
  const handleAddProduct = () => {
    navigation.navigate('AddInventoryScreen', { businessId });
  };
  
  const handleInventory = () => {
    navigation.navigate('AddInventoryScreen', { 
      businessId,
      showInventory: true
    });
  };
  
  const handleOrders = () => {
    navigation.navigate('BusinessOrdersScreen', { businessId });
  };
  
  const handleCustomers = () => {
    navigation.navigate('CustomerListScreen', { businessId });
  };

  const handleSettings = () => {
    navigation.navigate('BusinessSettingsScreen');
  };

  const handleProfile = () => {
    navigation.navigate('BusinessProfileScreen');
  };

  const handleAnalytics = () => {
    navigation.navigate('BusinessAnalyticsScreen', { businessId });
  };

  const handleWateringChecklist = () => {
    navigation.navigate('WateringChecklistScreen', { businessId });
  };

  // Order management handlers
  const handleOrderPress = (order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      console.log('Updating order status:', orderId, newStatus);
      await loadDashboardData();
      setShowOrderModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  // Low stock management
  const handleManageStock = () => {
    navigation.navigate('AddInventoryScreen', { 
      businessId,
      showInventory: true,
      filter: 'lowStock' 
    });
  };

  const handleRestock = (item) => {
    navigation.navigate('EditProductScreen', { 
      productId: item.id,
      businessId,
      focusField: 'quantity'
    });
  };

  if (isLoading && !dashboardData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#216a94" />
          <Text style={styles.loadingText}>Loading your business dashboard...</Text>
          <Text style={styles.loadingSubtext}>Getting your business data ready</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  if (error && !dashboardData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#c62828" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={loadDashboardData}
          >
            <MaterialIcons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Use actual data or show empty states - NO MOCK DATA
  const data = dashboardData || {
    businessInfo: {
      businessName: 'Your Business',
      businessType: 'Plant Business',
      businessLogo: null,
      email: businessId || 'business@example.com',
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
  };
  
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Enhanced Header with Labels */}
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <Image 
            source={data.businessInfo.businessLogo ? 
              { uri: data.businessInfo.businessLogo } : 
              require('../../assets/business-placeholder.png')
            } 
            style={styles.logo}
          />
          <View style={styles.businessInfo}>
            <Text style={styles.businessName} numberOfLines={1}>
              {data.businessInfo.businessName}
            </Text>
            <Text style={styles.welcomeText}>Welcome back!</Text>
            {data.businessInfo.rating > 0 && (
              <View style={styles.ratingContainer}>
                <MaterialIcons name="star" size={14} color="#FFC107" />
                <Text style={styles.ratingText}>
                  {data.businessInfo.rating.toFixed(1)} ({data.businessInfo.reviewCount} reviews)
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.headerActions}>
          <NotificationBell
            hasNotifications={hasNewNotifications}
            notificationCount={notifications.length}
            onPress={() => navigation.navigate('NotificationCenterScreen', { businessId })}
          />
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={handleAnalytics}
          >
            <MaterialIcons name="analytics" size={20} color="#216a94" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={handleSettings}
          >
            <MaterialIcons name="settings" size={20} color="#216a94" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView 
        style={styles.scrollView} 
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#216a94']}
            tintColor="#216a94"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Low Stock Banner */}
        {data.lowStockDetails && data.lowStockDetails.length > 0 && (
          <LowStockBanner
            lowStockItems={data.lowStockDetails}
            onManageStock={handleManageStock}
            onRestock={handleRestock}
            autoRefresh={true}
          />
        )}

        {/* Business Overview Section */}
        <View style={styles.overviewSection}>
          <Text style={styles.sectionTitle}>Business Overview</Text>
          <Text style={styles.sectionSubtitle}>
            Your business performance at a glance
          </Text>
          
          {/* Enhanced KPI Widgets */}
          <View style={styles.kpiContainer}>
            <KPIWidget
              title="Total Revenue"
              value={data.metrics.totalSales}
              change={data.metrics.revenueGrowth}
              icon="cash"
              format="currency"
              color="#216a94"
              onPress={handleAnalytics}
            />
            
            <KPIWidget
              title="Today's Sales"
              value={data.metrics.salesToday}
              change={data.metrics.dailyGrowth}
              icon="trending-up"
              format="currency"
              color="#4CAF50"
              onPress={handleAnalytics}
            />
            
            <KPIWidget
              title="New Orders"
              value={data.metrics.newOrders}
              change={data.metrics.orderGrowth}
              icon="shopping-cart"
              format="number"
              color="#FF9800"
              onPress={handleOrders}
              trend={data.metrics.newOrders > 0 ? 'up' : 'neutral'}
            />
            
            <KPIWidget
              title="Low Stock Items"
              value={data.metrics.lowStockItems}
              change={data.metrics.stockChange}
              icon="warning"
              format="number"
              color={data.metrics.lowStockItems > 0 ? "#F44336" : "#9E9E9E"}
              onPress={handleInventory}
              trend={data.metrics.lowStockItems > 0 ? 'down' : 'neutral'}
            />
          </View>

          {/* Business Statistics Cards */}
          <View style={styles.statsSection}>
            <Text style={styles.subsectionTitle}>Business Statistics</Text>
            <View style={styles.statsGrid}>
              <TouchableOpacity style={styles.statCard} onPress={handleInventory}>
                <MaterialCommunityIcons name="package-variant" size={24} color="#2196F3" />
                <Text style={styles.statValue}>{data.metrics.totalInventory}</Text>
                <Text style={styles.statLabel}>Total Inventory Items</Text>
                <Text style={styles.statSubtext}>
                  {data.metrics.activeInventory} currently active
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.statCard} onPress={handleOrders}>
                <MaterialCommunityIcons name="receipt" size={24} color="#9C27B0" />
                <Text style={styles.statValue}>{data.metrics.totalOrders}</Text>
                <Text style={styles.statLabel}>Total Orders</Text>
                <Text style={styles.statSubtext}>
                  All time order count
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.statCard} onPress={handleAnalytics}>
                <MaterialCommunityIcons name="cash" size={24} color="#FF5722" />
                <Text style={styles.statValue}>${(data.metrics.inventoryValue || 0).toFixed(0)}</Text>
                <Text style={styles.statLabel}>Inventory Value</Text>
                <Text style={styles.statSubtext}>
                  Total asset value
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.statCard} onPress={handleCustomers}>
                <MaterialIcons name="people" size={24} color="#607D8B" />
                <Text style={styles.statValue}>{data.metrics.totalCustomers || 0}</Text>
                <Text style={styles.statLabel}>Total Customers</Text>
                <Text style={styles.statSubtext}>
                  Customer base size
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        {/* Charts Dashboard */}
        <BusinessDashboardCharts
          salesData={data.chartData?.sales || { labels: [], values: [], total: 0, average: 0 }}
          ordersData={data.chartData?.orders || { pending: 0, confirmed: 0, ready: 0, completed: 0, total: 0 }}
          inventoryData={data.chartData?.inventory || { inStock: 0, lowStock: 0, outOfStock: 0 }}
          onRefresh={loadDashboardData}
          autoRefresh={true}
        />
        
        {/* Quick Actions Section with Labels */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Text style={styles.sectionSubtitle}>
            Common tasks and management tools
          </Text>
          
          <View style={styles.actionGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={handleAddProduct}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#4CAF50' }]}>
                <MaterialIcons name="add" size={28} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Add New Product</Text>
              <Text style={styles.actionDescription}>
                Add plants or products to your inventory
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={handleInventory}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#2196F3' }]}>
                <MaterialIcons name="inventory" size={28} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Manage Inventory</Text>
              <Text style={styles.actionDescription}>
                View and update your product inventory
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={handleOrders}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#FF9800' }]}>
                <MaterialIcons name="receipt" size={28} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>View Orders</Text>
              <Text style={styles.actionDescription}>
                Check pending and completed orders
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={handleWateringChecklist}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#9C27B0' }]}>
                <MaterialCommunityIcons name="water" size={28} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Plant Watering</Text>
              <Text style={styles.actionDescription}>
                Check which plants need watering
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Top Selling Products - Only show if there's actual data */}
        {data.topProducts && data.topProducts.length > 0 && (
          <TopSellingProductsList
            businessId={businessId}
            timeframe="month"
            onProductPress={(product) => navigation.navigate('BusinessProductDetailScreen', { 
              productId: product.id, 
              businessId 
            })}
            limit={5}
          />
        )}
        
        {/* Recent Orders Section */}
        <View style={styles.ordersSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <TouchableOpacity 
              style={styles.viewAllButton} 
              onPress={handleOrders}
            >
              <Text style={styles.viewAllText}>View All Orders</Text>
              <MaterialIcons name="arrow-forward" size={16} color="#216a94" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.ordersContainer}>
            {data.recentOrders && data.recentOrders.length > 0 ? (
              data.recentOrders.slice(0, 3).map((order) => (
                <TouchableOpacity 
                  key={order.id} 
                  style={styles.orderItem}
                  onPress={() => handleOrderPress(order)}
                >
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderConfirmation}>#{order.confirmationNumber}</Text>
                    <View style={[styles.statusPill, { backgroundColor: getStatusColor(order.status) }]}>
                      <Text style={styles.statusText}>{order.status}</Text>
                    </View>
                  </View>
                  <View style={styles.orderDetails}>
                    <Text style={styles.orderCustomer}>{order.customerName}</Text>
                    <Text style={styles.orderDate}>
                      {order.date ? new Date(order.date).toLocaleDateString() : 'Recent'}
                    </Text>
                  </View>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderTotal}>${order.total.toFixed(2)}</Text>
                    <Text style={styles.orderItems}>
                      {order.items?.length || 0} items
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyOrdersState}>
                <MaterialIcons name="receipt" size={48} color="#e0e0e0" />
                <Text style={styles.emptyStateTitle}>No Recent Orders</Text>
                <Text style={styles.emptyStateText}>
                  Orders from customers will appear here. Start by setting up your inventory and sharing your business with customers.
                </Text>
                <TouchableOpacity 
                  style={styles.getStartedButton} 
                  onPress={handleAddProduct}
                >
                  <MaterialIcons name="add-business" size={20} color="#216a94" />
                  <Text style={styles.getStartedText}>Add Your First Product</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Business Information Card */}
        <View style={styles.businessInfoSection}>
          <Text style={styles.sectionTitle}>Business Information</Text>
          <View style={styles.businessCard}>
            <View style={styles.businessCardHeader}>
              <MaterialCommunityIcons name="store" size={24} color="#216a94" />
              <Text style={styles.businessCardTitle}>Your Business Details</Text>
            </View>
            <View style={styles.businessCardContent}>
              <View style={styles.businessInfoRow}>
                <Text style={styles.businessInfoLabel}>Business Type:</Text>
                <Text style={styles.businessInfoValue}>{data.businessInfo.businessType}</Text>
              </View>
              <View style={styles.businessInfoRow}>
                <Text style={styles.businessInfoLabel}>Email:</Text>
                <Text style={styles.businessInfoValue}>{data.businessInfo.email}</Text>
              </View>
              {data.businessInfo.joinDate && (
                <View style={styles.businessInfoRow}>
                  <Text style={styles.businessInfoLabel}>Member Since:</Text>
                  <Text style={styles.businessInfoValue}>
                    {new Date(data.businessInfo.joinDate).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long' 
                    })}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity 
              style={styles.editBusinessButton} 
              onPress={handleProfile}
            >
              <MaterialIcons name="edit" size={16} color="#216a94" />
              <Text style={styles.editBusinessText}>Edit Business Information</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Order Detail Modal */}
      <OrderDetailModal
        visible={showOrderModal}
        order={selectedOrder}
        onClose={() => setShowOrderModal(false)}
        onUpdateStatus={handleUpdateOrderStatus}
        businessInfo={data.businessInfo}
      />
    </SafeAreaView>
  );

  // Helper function for status colors
  function getStatusColor(status) {
    switch (status) {
      case 'pending': return '#FFA000';
      case 'confirmed': return '#2196F3';
      case 'ready': return '#9C27B0';
      case 'completed': return '#4CAF50';
      case 'cancelled': return '#F44336';
      default: return '#757575';
    }
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    color: '#216a94',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingSubtext: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
    margin: 10,
    fontSize: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#216a94',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eee',
  },
  businessInfo: {
    marginLeft: 12,
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#216a94',
  },
  welcomeText: {
    fontSize: 12,
    color: '#757575',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f0f8ff',
  },
  scrollView: {
    flex: 1,
  },
  // Section Styles
  overviewSection: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 20,
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  // Stats Section
  statsSection: {
    marginTop: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  statSubtext: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    textAlign: 'center',
  },
  // Quick Actions Section
  quickActionsSection: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  // Orders Section
  ordersSection: {
    backgroundColor: '#fff',
    margin: 16,
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
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f8ff',
  },
  viewAllText: {
    color: '#216a94',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  ordersContainer: {
    gap: 12,
  },
  orderItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderConfirmation: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
statusText: {
  color: '#fff',
  fontSize: 12,
  fontWeight: 'bold',
},
orderDetails: {
  marginBottom: 8,
},
orderCustomer: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#333',
},
orderDate: {
  fontSize: 12,
  color: '#666',
  marginTop: 2,
},
orderInfo: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
orderTotal: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#4CAF50',
},
orderItems: {
  fontSize: 12,
  color: '#666',
},
emptyState: {
  alignItems: 'center',
  paddingVertical: 40,
  backgroundColor: '#fff',
  borderRadius: 12,
  marginBottom: 12,
},
emptyStateText: {
  fontSize: 16,
  color: '#666',
  marginTop: 12,
},
emptyStateSubtext: {
  fontSize: 12,
  color: '#999',
  marginTop: 4,
  textAlign: 'center',
},
createOrderButton: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#f0f8ff',
  paddingVertical: 8,
  paddingHorizontal: 16,
  borderRadius: 20,
  marginTop: 12,
  borderWidth: 1,
  borderColor: '#216a94',
},
createOrderText: {
  color: '#216a94',
  fontSize: 14,
  fontWeight: '600',
  marginLeft: 4,
},
businessCard: {
  backgroundColor: '#fff',
  marginHorizontal: 16,
  marginBottom: 24,
  borderRadius: 12,
  padding: 16,
  elevation: 1,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
},
businessCardHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 12,
},
businessCardTitle: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#216a94',
  marginLeft: 8,
},
businessCardContent: {
  marginBottom: 12,
},
businessCardItem: {
  fontSize: 14,
  color: '#555',
  marginBottom: 4,
},
businessCardLabel: {
  fontWeight: '600',
  color: '#333',
},
editBusinessButton: {
  flexDirection: 'row',
  alignItems: 'center',
  alignSelf: 'flex-start',
  paddingVertical: 6,
  paddingHorizontal: 12,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#216a94',
  backgroundColor: '#f0f8ff',
},
editBusinessText: {
  fontSize: 12,
  color: '#216a94',
  marginLeft: 4,
  fontWeight: '600',
},
bottomNav: {
  flexDirection: 'row',
  backgroundColor: '#fff',
  paddingVertical: 8,
  borderTopWidth: 1,
  borderTopColor: '#eee',
  elevation: 8,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: -2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
},
navItem: {
  flex: 1,
  alignItems: 'center',
  paddingVertical: 8,
},
activeNavItem: {
  borderTopWidth: 2,
  borderTopColor: '#216a94',
},
navText: {
  fontSize: 12,
  color: '#757575',
  marginTop: 4,
},
activeNavText: {
  color: '#216a94',
  fontWeight: 'bold',
},
});