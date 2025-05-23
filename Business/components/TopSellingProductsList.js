// Business/components/TopSellingProductsList.js - FIXED VERSION - NO MOCK DATA
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons,
  Ionicons 
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBusinessDashboard } from '../services/businessApi';

export default function TopSellingProductsList({
  businessId,
  refreshing = false,
  onRefresh = () => {},
  timeframe = 'month', // 'week', 'month', 'quarter', 'year'
  onTimeframeChange = () => {},
  onProductPress = () => {},
  limit = 10,
}) {
  // State
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState('quantity'); // 'quantity', 'revenue', 'profit'
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  // Get headers with authentication
  const getHeaders = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userType = await AsyncStorage.getItem('userType');
      const businessIdStored = await AsyncStorage.getItem('businessId');
      
      return {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail || '',
        'X-User-Type': userType || 'business',
        'X-Business-ID': businessIdStored || businessId,
      };
    } catch (error) {
      console.error('Error getting headers:', error);
      return {
        'Content-Type': 'application/json',
      };
    }
  };

  // Load top selling products using multiple API sources - NO MOCK DATA
  const loadTopSellingProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Loading top selling products for business:', businessId);
      
      let productData = [];
      
      try {
        // First try to get analytics data which should have sales information
        const { getBusinessAnalytics } = await import('../services/businessAnalyticsApi');
        const analyticsData = await getBusinessAnalytics(timeframe, 'sales');
        
        if (analyticsData?.data?.sales?.topProducts) {
          productData = analyticsData.data.sales.topProducts;
          console.log('Got top products from analytics:', productData.length);
        } else if (analyticsData?.data?.sales?.productPerformance) {
          productData = analyticsData.data.sales.productPerformance;
          console.log('Got product performance from analytics:', productData.length);
        }
      } catch (analyticsError) {
        console.warn('Analytics API failed, trying orders API:', analyticsError.message);
        
        // Fallback to orders API to build product sales data
        try {
          const { getBusinessOrders } = await import('../services/businessOrderApi');
          const ordersData = await getBusinessOrders(businessId, { status: 'completed' });
          
          const productSales = {};
          
          if (ordersData?.orders) {
            ordersData.orders.forEach(order => {
              if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                  const productId = item.id || item.productId || item.name;
                  if (!productId) return;
                  
                  if (!productSales[productId]) {
                    productSales[productId] = {
                      id: productId,
                      name: item.name || item.title || "Unknown Product",
                      scientific_name: item.scientific_name,
                      productType: item.productType || 'product',
                      totalSold: 0,
                      totalRevenue: 0,
                      averagePrice: 0,
                      growthRate: 0,
                      category: item.category || 'general'
                    };
                  }
                  
                  const quantity = item.quantity || 0;
                  const price = item.price || 0;
                  const revenue = quantity * price;
                  
                  productSales[productId].totalSold += quantity;
                  productSales[productId].totalRevenue += revenue;
                });
              }
            });
            
            // Convert to array and calculate averages
            productData = Object.values(productSales).map(product => {
              product.averagePrice = product.totalSold > 0 ? product.totalRevenue / product.totalSold : 0;
              product.totalProfit = product.totalRevenue * 0.3; // Estimate 30% profit margin
              return product;
            });
            
            console.log('Built product data from orders:', productData.length);
          }
        } catch (ordersError) {
          console.warn('Orders API also failed, trying dashboard fallback:', ordersError.message);
          
          // Last resort: try dashboard API
          const dashboardData = await getBusinessDashboard();
          
          if (dashboardData?.topProducts) {
            productData = dashboardData.topProducts;
            console.log('Got products from dashboard:', productData.length);
          } else if (dashboardData?.recentOrders) {
            // Build from recent orders as before
            const productSales = {};
            
            dashboardData.recentOrders.forEach(order => {
              if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                  const productId = item.id || item.productId || item.name;
                  if (!productId) return;
                  
                  if (!productSales[productId]) {
                    productSales[productId] = {
                      id: productId,
                      name: item.name || item.title || "Unknown Product",
                      scientific_name: item.scientific_name,
                      productType: item.productType || 'product',
                      totalSold: 0,
                      totalRevenue: 0,
                      averagePrice: 0,
                      growthRate: 0
                    };
                  }
                  
                  const quantity = item.quantity || 0;
                  const price = item.price || 0;
                  const revenue = quantity * price;
                  
                  productSales[productId].totalSold += quantity;
                  productSales[productId].totalRevenue += revenue;
                });
              }
            });
            
            productData = Object.values(productSales).map(product => {
              product.averagePrice = product.totalSold > 0 ? product.totalRevenue / product.totalSold : 0;
              return product;
            });
            
            console.log('Built product data from dashboard orders:', productData.length);
          }
        }
      }
      
      // REMOVED MOCK DATA CREATION - If no data, show empty state
      if (!productData || productData.length === 0) {
        console.log('No sales data available - showing empty state');
        setProducts([]);
        setIsLoading(false);
        return;
      }
      
      // Sort products based on sortBy parameter
      let sortedProducts = [...productData];
      switch (sortBy) {
        case 'quantity':
          sortedProducts.sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0));
          break;
        case 'revenue':
          sortedProducts.sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0));
          break;
        case 'profit':
          // Assuming profit is approximately 30% of revenue if not available
          sortedProducts.sort((a, b) => {
            const profitA = a.totalProfit || ((a.totalRevenue || 0) * 0.3);
            const profitB = b.totalProfit || ((b.totalRevenue || 0) * 0.3);
            return profitB - profitA;
          });
          break;
      }
      
      // Limit to requested number of products
      sortedProducts = sortedProducts.slice(0, limit);
      
      setProducts(sortedProducts);
      
      console.log('Top selling products processed:', sortedProducts.length);
      
      // Success animation
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
      
    } catch (error) {
      console.error('Error loading top selling products:', error);
      setError(`Failed to load products: ${error.message}`);
      
      // Set empty products - NO MOCK DATA
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [businessId, timeframe, sortBy, limit]);

  // Initial load
  useEffect(() => {
    if (businessId) {
      loadTopSellingProducts();
    }
  }, [loadTopSellingProducts]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    loadTopSellingProducts();
    onRefresh();
  }, [loadTopSellingProducts, onRefresh]);

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe) => {
    onTimeframeChange(newTimeframe);
  };

  // Handle sort change
  const handleSortChange = (newSortBy) => {
    setSortBy(newSortBy);
  };

  // Handle product press
  const handleProductPress = (product) => {
    setSelectedProduct(product);
    setDetailModalVisible(true);
    onProductPress(product);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  // Format percentage
  const formatPercentage = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  // Get rank badge color
  const getRankBadgeColor = (rank) => {
    switch (rank) {
      case 1: return '#FFD700'; // Gold
      case 2: return '#C0C0C0'; // Silver
      case 3: return '#CD7F32'; // Bronze
      default: return '#4CAF50';
    }
  };

  // Get rank icon
  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return 'trophy';
      case 2: return 'medal';
      case 3: return 'medal-outline';
      default: return 'star';
    }
  };

  // Get sort display value
  const getSortDisplayValue = (product, sortType) => {
    switch (sortType) {
      case 'quantity':
        return `${product.totalSold || 0} sold`;
      case 'revenue':
        return formatCurrency(product.totalRevenue || 0);
      case 'profit':
        return formatCurrency((product.totalProfit || ((product.totalRevenue || 0) * 0.3)));
      default:
        return `${product.totalSold || 0} sold`;
    }
  };

  // Render product item
  const renderProductItem = ({ item, index }) => {
    const rank = index + 1;
    
    return (
      <Animated.View
        style={[
          styles.productCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.productContent}
          onPress={() => handleProductPress(item)}
          activeOpacity={0.7}
        >
          {/* Rank Badge */}
          <View style={[styles.rankBadge, { backgroundColor: getRankBadgeColor(rank) }]}>
            <MaterialCommunityIcons 
              name={getRankIcon(rank)} 
              size={16} 
              color="#fff" 
            />
            <Text style={styles.rankText}>#{rank}</Text>
          </View>
          
          {/* Product Info */}
          <View style={styles.productInfo}>
            <View style={styles.productHeader}>
              <Text style={styles.productName} numberOfLines={1}>
                {item.name || item.common_name || 'Unknown Product'}
              </Text>
              <View style={styles.productTypeIcon}>
                <MaterialCommunityIcons 
                  name={item.productType === 'plant' ? 'leaf' : 'cube-outline'} 
                  size={16} 
                  color="#4CAF50" 
                />
              </View>
            </View>
            
            {item.scientific_name && (
              <Text style={styles.productScientific} numberOfLines={1}>
                {item.scientific_name}
              </Text>
            )}
            
            <View style={styles.productStats}>
              <View style={styles.statItem}>
                <MaterialIcons name="shopping-cart" size={14} color="#666" />
                <Text style={styles.statText}>
                  {item.totalSold || 0} sold
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <MaterialIcons name="attach-money" size={14} color="#666" />
                <Text style={styles.statText}>
                  {formatCurrency(item.totalRevenue || 0)}
                </Text>
              </View>
              
              {item.growthRate !== undefined && (
                <View style={styles.statItem}>
                  <MaterialIcons 
                    name={item.growthRate >= 0 ? "trending-up" : "trending-down"} 
                    size={14} 
                    color={item.growthRate >= 0 ? "#4CAF50" : "#F44336"} 
                  />
                  <Text style={[
                    styles.statText,
                    { color: item.growthRate >= 0 ? "#4CAF50" : "#F44336" }
                  ]}>
                    {formatPercentage(Math.abs(item.growthRate))}
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          {/* Main Metric */}
          <View style={styles.primaryMetric}>
            <Text style={styles.primaryMetricValue}>
              {getSortDisplayValue(item, sortBy)}
            </Text>
            <Text style={styles.primaryMetricLabel}>
              {sortBy === 'quantity' ? 'Total Sold' : 
               sortBy === 'revenue' ? 'Revenue' : 'Profit'}
            </Text>
          </View>
          
          {/* Action Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleProductPress(item)}
          >
            <MaterialIcons name="arrow-forward" size={20} color="#4CAF50" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Render loading state
  if (isLoading && products.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading top products...</Text>
      </View>
    );
  }

  // Render error state
  if (error && products.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorTitle}>Unable to Load Top Products</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <MaterialIcons name="refresh" size={20} color="#fff" />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Controls */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          <MaterialCommunityIcons name="trophy" size={20} color="#4CAF50" />
          {' '}Top Selling Products
        </Text>
        
        {/* Only show controls if we have products */}
        {products.length > 0 && (
          <>
            {/* Timeframe Selector */}
            <View style={styles.controlsRow}>
              <Text style={styles.controlLabel}>Period:</Text>
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
            </View>
            
            {/* Sort Selector */}
            <View style={styles.controlsRow}>
              <Text style={styles.controlLabel}>Sort by:</Text>
              <View style={styles.sortContainer}>
                {[
                  { key: 'quantity', label: 'Quantity', icon: 'inventory' },
                  { key: 'revenue', label: 'Revenue', icon: 'attach-money' },
                  { key: 'profit', label: 'Profit', icon: 'trending-up' },
                ].map((sort) => (
                  <TouchableOpacity
                    key={sort.key}
                    style={[
                      styles.sortButton,
                      sortBy === sort.key && styles.activeSortButton
                    ]}
                    onPress={() => handleSortChange(sort.key)}
                  >
                    <MaterialIcons 
                      name={sort.icon} 
                      size={16} 
                      color={sortBy === sort.key ? '#fff' : '#4CAF50'} 
                    />
                    <Text style={[
                      styles.sortText,
                      sortBy === sort.key && styles.activeSortText
                    ]}>
                      {sort.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}
      </View>

      {/* Products List */}
      <FlatList
        data={products}
        renderItem={renderProductItem}
        keyExtractor={item => item.id || item.name || Math.random().toString()}
        style={styles.productsList}
        contentContainerStyle={styles.productsListContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="chart-line" size={64} color="#e0e0e0" />
            <Text style={styles.emptyTitle}>No Sales Data</Text>
            <Text style={styles.emptyText}>
              Complete some sales to see your top selling products here. 
              Start by adding inventory and processing orders.
            </Text>
            <TouchableOpacity 
              style={styles.emptyActionButton} 
              onPress={() => {
                // Navigate to inventory or orders
                console.log('Navigate to add inventory or create orders');
              }}
            >
              <MaterialIcons name="add-business" size={20} color="#4CAF50" />
              <Text style={styles.emptyActionText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Product Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Product Details</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {selectedProduct && (
              <View style={styles.modalContent}>
                <View style={styles.productDetailHeader}>
                  <View style={styles.productDetailIcon}>
                    <MaterialCommunityIcons 
                      name={selectedProduct.productType === 'plant' ? 'leaf' : 'cube-outline'} 
                      size={32} 
                      color="#4CAF50" 
                    />
                  </View>
                  <View style={styles.productDetailInfo}>
                    <Text style={styles.productDetailName}>
                      {selectedProduct.name || selectedProduct.common_name}
                    </Text>
                    {selectedProduct.scientific_name && (
                      <Text style={styles.productDetailScientific}>
                        {selectedProduct.scientific_name}
                      </Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.detailMetrics}>
                  <View style={styles.detailMetric}>
                    <Text style={styles.detailMetricValue}>
                      {selectedProduct.totalSold || 0}
                    </Text>
                    <Text style={styles.detailMetricLabel}>Units Sold</Text>
                  </View>
                  
                  <View style={styles.detailMetric}>
                    <Text style={styles.detailMetricValue}>
                      {formatCurrency(selectedProduct.totalRevenue || 0)}
                    </Text>
                    <Text style={styles.detailMetricLabel}>Total Revenue</Text>
                  </View>
                  
                  <View style={styles.detailMetric}>
                    <Text style={styles.detailMetricValue}>
                      {formatCurrency(selectedProduct.averagePrice || 0)}
                    </Text>
                    <Text style={styles.detailMetricLabel}>Avg Price</Text>
                  </View>
                  
                  <View style={styles.detailMetric}>
                    <Text style={styles.detailMetricValue}>
                      {formatPercentage(selectedProduct.conversionRate || 0)}
                    </Text>
                    <Text style={styles.detailMetricLabel}>Conversion</Text>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.viewFullDetailsButton}
                  onPress={() => {
                    setDetailModalVisible(false);
                    // Navigate to full product details screen
                    onProductPress(selectedProduct);
                  }}
                >
                  <MaterialIcons name="open-in-new" size={20} color="#fff" />
                  <Text style={styles.viewFullDetailsText}>View Full Details</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
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
    backgroundColor: '#f44336',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlsRow: {
    marginBottom: 12,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  timeframeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  timeframeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  activeTimeframe: {
    backgroundColor: '#4CAF50',
  },
  timeframeText: {
    fontSize: 12,
    color: '#666',
  },
  activeTimeframeText: {
    color: '#fff',
    fontWeight: '600',
  },
  sortContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  activeSortButton: {
    backgroundColor: '#4CAF50',
  },
  sortText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
  },
  activeSortText: {
    color: '#fff',
    fontWeight: '600',
  },
  productsList: {
    maxHeight: 400,
  },
  productsListContent: {
    padding: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  productContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 16,
    marginRight: 12,
  },
  rankText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  productTypeIcon: {
    marginLeft: 8,
  },
  productScientific: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginBottom: 8,
  },
  productStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  primaryMetric: {
    alignItems: 'center',
    marginRight: 12,
  },
  primaryMetricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  primaryMetricLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  emptyActionText: {
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 8,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalContent: {
    padding: 20,
  },
  productDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  productDetailIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f9f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  productDetailInfo: {
    flex: 1,
  },
  productDetailName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  productDetailScientific: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 4,
  },
  detailMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  detailMetric: {
    flex: 0.48,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  detailMetricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  detailMetricLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  viewFullDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
  },
  viewFullDetailsText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
});