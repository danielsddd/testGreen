// Business/components/CustomerList.js
import React, { useState, useRef, useCallback, useEffect, memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons 
} from '@expo/vector-icons';

// Import components
import CustomerDetailModal from './CustomerDetailModal';
import CustomerSearchBar from './CustomerSearchBar';

/**
 * CustomerList Component
 * 
 * Displays a list of business customers with filtering, sorting, and search capabilities
 * 
 * @param {Object} props Component props
 * @param {Array} props.customers Array of customer objects
 * @param {boolean} props.isLoading Loading state indicator
 * @param {boolean} props.refreshing Pull to refresh state
 * @param {Function} props.onRefresh Pull to refresh callback
 * @param {Function} props.onCustomerPress Callback when customer is pressed
 * @param {Function} props.onContactCustomer Callback to contact customer
 * @param {Function} props.onViewOrders Callback to view customer orders
 * @param {string} props.businessId Business identifier
 */
const CustomerList = ({
  customers = [],
  isLoading = false,
  refreshing = false,
  onRefresh = () => {},
  onCustomerPress = () => {},
  onContactCustomer = () => {},
  onViewOrders = () => {},
  businessId
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('lastOrder');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterBy, setFilterBy] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  // Filter and sort customers - memoized to prevent recalculating on every render
  const filteredCustomers = useMemo(() => {
    // First apply search query and filter
    const filtered = customers.filter(customer => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const name = (customer.name || '').toLowerCase();
        const email = (customer.email || '').toLowerCase();
        const phone = (customer.phone || '').toLowerCase();
        
        if (!name.includes(query) && !email.includes(query) && !phone.includes(query)) {
          return false;
        }
      }
      
      // Activity filter
      const now = new Date();
      const lastOrderDate = customer.lastOrderDate ? new Date(customer.lastOrderDate) : null;
      const daysSinceLastOrder = lastOrderDate ? 
        Math.floor((now - lastOrderDate) / (1000 * 60 * 60 * 24)) : Infinity;
      
      switch (filterBy) {
        case 'recent':
          return daysSinceLastOrder <= 30;
        case 'regular':
          return (customer.orderCount || 0) >= 3;
        case 'vip':
          return (customer.totalSpent || 0) >= 200;
        case 'inactive':
          return daysSinceLastOrder > 90;
        default:
          return true;
      }
    });
    
    // Then sort the filtered results
    return [...filtered].sort((a, b) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'name':
          valueA = (a.name || '').toLowerCase();
          valueB = (b.name || '').toLowerCase();
          break;
        case 'orderCount':
          valueA = a.orderCount || 0;
          valueB = b.orderCount || 0;
          break;
        case 'totalSpent':
          valueA = a.totalSpent || 0;
          valueB = b.totalSpent || 0;
          break;
        case 'lastOrder':
          valueA = a.lastOrderDate ? new Date(a.lastOrderDate) : new Date(0);
          valueB = b.lastOrderDate ? new Date(b.lastOrderDate) : new Date(0);
          break;
        default:
          return 0;
      }
      
      if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [customers, searchQuery, filterBy, sortBy, sortOrder]);

  // Handle sort
  const handleSort = useCallback((field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    
    // Animate sort change
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.7,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [sortBy, sortOrder, fadeAnim]);

  // Handle customer detail view
  const handleCustomerPress = useCallback((customer) => {
    setSelectedCustomer(customer);
    setDetailModalVisible(true);
    onCustomerPress(customer);
  }, [onCustomerPress]);

  // Handle contact customer
  const handleContactCustomer = useCallback((customer, method = 'auto') => {
    if (method === 'auto') {
      // Show contact options
      const options = [];
      
      if (customer.phone) {
        options.push({
          text: '📱 Call',
          onPress: () => onContactCustomer(customer, 'call')
        });
        options.push({
          text: '💬 SMS',
          onPress: () => onContactCustomer(customer, 'sms')
        });
      }
      
      if (customer.email) {
        options.push({
          text: '📧 Email',
          onPress: () => onContactCustomer(customer, 'email')
        });
      }
      
      options.push({
        text: '💬 Message',
        onPress: () => onContactCustomer(customer, 'message')
      });
      
      options.push({ text: 'Cancel', style: 'cancel' });
      
      Alert.alert(
        `Contact ${customer.name}`,
        'Choose contact method',
        options,
        { cancelable: true }
      );
    } else {
      onContactCustomer(customer, method);
    }
  }, [onContactCustomer]);

  // Get customer tier
  const getCustomerTier = useCallback((customer) => {
    if (!customer) return 'new';
    
    const totalSpent = customer.totalSpent || 0;
    const orderCount = customer.orderCount || 0;
    
    if (totalSpent >= 500 || orderCount >= 10) return 'vip';
    if (totalSpent >= 200 || orderCount >= 5) return 'premium';
    if (orderCount >= 2) return 'regular';
    return 'new';
  }, []);

  // Get tier color
  const getTierColor = useCallback((tier) => {
    switch (tier) {
      case 'vip': return '#9C27B0';
      case 'premium': return '#FF9800';
      case 'regular': return '#4CAF50';
      case 'new': return '#2196F3';
      default: return '#757575';
    }
  }, []);

  // Get tier icon
  const getTierIcon = useCallback((tier) => {
    switch (tier) {
      case 'vip': return 'star';
      case 'premium': return 'diamond';
      case 'regular': return 'account-check';
      case 'new': return 'account-plus';
      default: return 'account';
    }
  }, []);

  // Format last order date
  const formatLastOrder = useCallback((dateString) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }, []);

  // Get sort icon
  const getSortIcon = useCallback((field) => {
    if (sortBy !== field) return 'sort';
    return sortOrder === 'asc' ? 'keyboard-arrow-up' : 'keyboard-arrow-down';
  }, [sortBy, sortOrder]);

  // Memoize filter counts to avoid recalculation
  const filterCounts = useMemo(() => {
    const now = new Date();
    
    return {
      all: customers.length,
      recent: customers.filter(c => {
        const days = c.lastOrderDate ? 
          Math.floor((now - new Date(c.lastOrderDate)) / (1000 * 60 * 60 * 24)) : Infinity;
        return days <= 30;
      }).length,
      regular: customers.filter(c => (c.orderCount || 0) >= 3).length,
      vip: customers.filter(c => (c.totalSpent || 0) >= 200).length,
    };
  }, [customers]);

  // Render customer item - extracted as separate memoized component
  const CustomerItem = memo(({ item, index, onPress, onContact, onViewOrders }) => {
    const tier = getCustomerTier(item);
    const tierColor = getTierColor(tier);
    
    return (
      <Animated.View
        style={[
          styles.customerCard,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.customerContent}
          onPress={() => onPress(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Customer ${item.name || 'Unknown'}`}
          accessibilityHint="Double tap to view customer details"
        >
          {/* Customer Avatar */}
          <View style={[styles.customerAvatar, { borderColor: tierColor }]}>
            <MaterialIcons name="person" size={28} color={tierColor} />
            <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
              <MaterialCommunityIcons 
                name={getTierIcon(tier)} 
                size={10} 
                color="#fff" 
              />
            </View>
          </View>
          
          {/* Customer Info */}
          <View style={styles.customerInfo}>
            <View style={styles.customerHeader}>
              <Text style={styles.customerName} numberOfLines={1}>
                {item.name || 'Unknown Customer'}
              </Text>
              <View style={[styles.tierLabel, { backgroundColor: tierColor }]}>
                <Text style={styles.tierText}>
                  {tier.toUpperCase()}
                </Text>
              </View>
            </View>
            
            <Text style={styles.customerEmail} numberOfLines={1}>
              {item.email || 'No email'}
            </Text>
            
            {item.phone && (
              <Text style={styles.customerPhone} numberOfLines={1}>
                {item.phone}
              </Text>
            )}
            
            <View style={styles.customerStats}>
              <View style={styles.statItem}>
                <MaterialIcons name="shopping-cart" size={14} color="#666" />
                <Text style={styles.statText}>
                  {item.orderCount || 0} orders
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <MaterialIcons name="attach-money" size={14} color="#666" />
                <Text style={styles.statText}>
                  ${(item.totalSpent || 0).toFixed(0)} spent
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <MaterialIcons name="schedule" size={14} color="#666" />
                <Text style={styles.statText}>
                  {formatLastOrder(item.lastOrderDate)}
                </Text>
              </View>
            </View>
          </View>
          
          {/* Actions */}
          <View style={styles.customerActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => onContact(item)}
              accessibilityRole="button"
              accessibilityLabel={`Contact ${item.name}`}
            >
              <MaterialIcons name="phone" size={18} color="#4CAF50" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => onViewOrders(item)}
              accessibilityRole="button"
              accessibilityLabel={`View orders for ${item.name}`}
            >
              <MaterialIcons name="receipt" size={18} color="#2196F3" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  });

  // Keyextractor for FlatList
  const keyExtractor = useCallback(item => item.id || item.email, []);

  // Item separator component
  const ItemSeparatorComponent = useCallback(() => <View style={styles.separator} />, []);

  // Handle search
  const handleSearch = useCallback((text) => {
    setSearchQuery(text);
  }, []);

  // Render header
  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      {/* Search Bar */}
      <CustomerSearchBar
        value={searchQuery}
        onChangeText={handleSearch}
        placeholder="Search customers by name, email, or phone..."
        showFilters={true}
        onFilterPress={() => {
          // Could add additional filter dialog here
        }}
      />
      
      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {[
          { key: 'all', label: 'All', count: filterCounts.all },
          { key: 'recent', label: 'Recent', count: filterCounts.recent },
          { key: 'regular', label: 'Regular', count: filterCounts.regular },
          { key: 'vip', label: 'VIP', count: filterCounts.vip },
        ].map(filter => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterTab,
              filterBy === filter.key && styles.activeFilterTab
            ]}
            onPress={() => setFilterBy(filter.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: filterBy === filter.key }}
            accessibilityLabel={`${filter.label} customers: ${filter.count}`}
          >
            <Text style={[
              styles.filterTabText,
              filterBy === filter.key && styles.activeFilterTabText
            ]}>
              {filter.label} ({filter.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <View style={styles.sortOptions}>
          {[
            { key: 'lastOrder', label: 'Last Order' },
            { key: 'totalSpent', label: 'Total Spent' },
            { key: 'orderCount', label: 'Order Count' },
            { key: 'name', label: 'Name' },
          ].map(sort => (
            <TouchableOpacity
              key={sort.key}
              style={[
                styles.sortOption,
                sortBy === sort.key && styles.activeSortOption
              ]}
              onPress={() => handleSort(sort.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: sortBy === sort.key }}
              accessibilityLabel={`Sort by ${sort.label}, currently ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
            >
              <Text style={[
                styles.sortOptionText,
                sortBy === sort.key && styles.activeSortOptionText
              ]}>
                {sort.label}
              </Text>
              <MaterialIcons 
                name={getSortIcon(sort.key)} 
                size={14} 
                color={sortBy === sort.key ? "#4CAF50" : "#757575"} 
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {filteredCustomers.length} of {customers.length} customers
        </Text>
      </View>
    </View>
  ), [
    searchQuery, 
    filterBy, 
    handleSearch, 
    filterCounts, 
    sortBy, 
    sortOrder, 
    getSortIcon, 
    handleSort,
    filteredCustomers.length,
    customers.length
  ]);

  // Render empty state
  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="account-group-outline" size={64} color="#e0e0e0" />
      <Text style={styles.emptyTitle}>
        {searchQuery || filterBy !== 'all' 
          ? 'No customers match your filters' 
          : 'No customers yet'
        }
      </Text>
      <Text style={styles.emptyText}>
        {searchQuery || filterBy !== 'all'
          ? 'Try adjusting your search or filters'
          : 'Customers will appear here after their first order'
        }
      </Text>
      {(searchQuery || filterBy !== 'all') && (
        <TouchableOpacity 
          style={styles.clearFiltersButton}
          onPress={() => {
            setSearchQuery('');
            setFilterBy('all');
          }}
          accessibilityRole="button"
          accessibilityLabel="Clear all filters"
        >
          <Text style={styles.clearFiltersText}>Clear Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [searchQuery, filterBy]);

  // Render loading state
  const renderLoading = useCallback(() => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#4CAF50" />
      <Text style={styles.loadingText}>Loading customers...</Text>
    </View>
  ), []);

  // Render item function
  const renderItem = useCallback(({ item, index }) => (
    <CustomerItem 
      item={item} 
      index={index} 
      onPress={handleCustomerPress}
      onContact={handleContactCustomer}
      onViewOrders={onViewOrders}
    />
  ), [handleCustomerPress, handleContactCustomer, onViewOrders]);

  // If loading and no customers yet, show loading screen
  if (isLoading && customers.length === 0) {
    return renderLoading();
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredCustomers}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
        contentContainerStyle={filteredCustomers.length === 0 ? styles.emptyListContent : styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={ItemSeparatorComponent}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={Platform.OS !== 'web'}
      />
      
      {/* Customer Detail Modal */}
      <CustomerDetailModal
        visible={detailModalVisible}
        customer={selectedCustomer}
        onClose={() => {
          setDetailModalVisible(false);
          setSelectedCustomer(null);
        }}
        onContactCustomer={handleContactCustomer}
        onViewOrders={onViewOrders}
        businessId={businessId}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterTabs: {
    flexDirection: 'row',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  activeFilterTab: {
    backgroundColor: '#4CAF50',
  },
  filterTabText: {
    fontSize: 12,
    color: '#666',
  },
  activeFilterTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  sortContainer: {
    marginBottom: 16,
  },
  sortLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  sortOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  activeSortOption: {
    backgroundColor: '#f0f9f3',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  sortOptionText: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  activeSortOptionText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  resultsContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  resultsText: {
    fontSize: 12,
    color: '#666',
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  customerCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  customerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  customerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    position: 'relative',
  },
  tierBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  customerInfo: {
    flex: 1,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  tierLabel: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tierText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  customerEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  customerStats: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
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
  customerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: 'transparent',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  clearFiltersButton: {
    marginTop: 20,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  clearFiltersText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default memo(CustomerList);