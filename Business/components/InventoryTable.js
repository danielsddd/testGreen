// Business/components/InventoryTable.js
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
  Platform,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons, 
} from '@expo/vector-icons';

// Import components
import ProductEditModal from './ProductEditModal';
import LowStockBanner from './LowStockBanner';

export default function InventoryTable({ 
  inventory = [], 
  isLoading = false,
  onRefresh = () => {},
  onEditProduct = () => {},
  onDeleteProduct = () => {},
  onUpdateStock = () => {},
  onProductPress = () => {},
  refreshing = false,
  businessId 
}) {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [quickEditModalVisible, setQuickEditModalVisible] = useState(false);
  const [quickEditStock, setQuickEditStock] = useState('');
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  // Filter and sort inventory
  const filteredInventory = inventory
    .filter(item => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const name = (item.name || item.common_name || '').toLowerCase();
        const scientific = (item.scientific_name || '').toLowerCase();
        if (!name.includes(query) && !scientific.includes(query)) {
          return false;
        }
      }
      
      // Status filter
      if (filterStatus !== 'all') {
        if (filterStatus === 'low-stock') {
          return (item.quantity || 0) <= (item.minThreshold || 5) && (item.quantity || 0) > 0;
        }
        if (filterStatus === 'sold-out') {
          return (item.quantity || 0) === 0;
        }
        return item.status === filterStatus;
      }
      
      return true;
    })
    .sort((a, b) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'name':
          valueA = (a.name || a.common_name || '').toLowerCase();
          valueB = (b.name || b.common_name || '').toLowerCase();
          break;
        case 'quantity':
          valueA = a.quantity || 0;
          valueB = b.quantity || 0;
          break;
        case 'price':
          valueA = a.finalPrice || a.price || 0;
          valueB = b.finalPrice || b.price || 0;
          break;
        case 'status':
          valueA = a.status || 'active';
          valueB = b.status || 'active';
          break;
        case 'updated':
          valueA = new Date(a.lastUpdated || a.dateAdded || 0);
          valueB = new Date(b.lastUpdated || b.dateAdded || 0);
          break;
        default:
          return 0;
      }
      
      if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  // Get low stock items for banner
  const lowStockItems = inventory.filter(item => 
    (item.quantity || 0) <= (item.minThreshold || 5) && 
    (item.quantity || 0) > 0 && 
    item.status === 'active'
  );

  // Get sold out items
  const soldOutItems = inventory.filter(item => 
    (item.quantity || 0) === 0 && item.status === 'active'
  );

  // Get stock status and color
  const getStockStatus = (item) => {
    const quantity = item.quantity || 0;
    const minThreshold = item.minThreshold || 5;
    
    if (quantity === 0) {
      return { status: 'sold-out', color: '#F44336', text: 'Sold Out' };
    } else if (quantity <= minThreshold) {
      return { status: 'low-stock', color: '#FF9800', text: 'Low Stock' };
    } else {
      return { status: 'in-stock', color: '#4CAF50', text: 'In Stock' };
    }
  };

  // Handle sort
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    
    // Animate sort change - skip on web
    if (Platform.OS !== 'web') {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.7,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  // Handle edit product
  const handleEditPress = (product) => {
    setSelectedProduct(product);
    setEditModalVisible(true);
  };

  // Handle quick stock edit
  const handleQuickStockEdit = (product) => {
    setSelectedProduct(product);
    setQuickEditStock((product.quantity || 0).toString());
    setQuickEditModalVisible(true);
  };

  // Handle quick stock update
  const handleQuickStockUpdate = async () => {
    const newStock = parseInt(quickEditStock);
    
    if (isNaN(newStock) || newStock < 0) {
      Alert.alert('Invalid Stock', 'Please enter a valid stock quantity');
      return;
    }
    
    try {
      await onUpdateStock(selectedProduct.id, newStock);
      setQuickEditModalVisible(false);
      setSelectedProduct(null);
      setQuickEditStock('');
      
      // Success feedback - skip on web
      if (Platform.OS !== 'web') {
        Animated.sequence([
          Animated.timing(slideAnim, {
            toValue: 10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: -10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();
      }
      
    } catch (error) {
      Alert.alert('Error', `Failed to update stock: ${error.message}`);
    }
  };

  // Handle delete with confirmation
  const handleDeletePress = (product) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product.name || product.common_name}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteProduct(product.id)
        }
      ]
    );
  };

  // Toggle bulk action mode
  const toggleBulkActionMode = () => {
    setBulkActionMode(!bulkActionMode);
    setSelectedItems(new Set());
  };

  // Toggle item selection
  const toggleItemSelection = (itemId) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  // Bulk actions
  const handleBulkAction = (action) => {
    if (selectedItems.size === 0) {
      Alert.alert('No Items Selected', 'Please select items first');
      return;
    }
    
    const selectedProducts = filteredInventory.filter(item => selectedItems.has(item.id));
    
    switch (action) {
      case 'delete':
        Alert.alert(
          'Delete Selected Items',
          `Are you sure you want to delete ${selectedItems.size} items?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                selectedProducts.forEach(product => onDeleteProduct(product.id));
                setBulkActionMode(false);
                setSelectedItems(new Set());
              }
            }
          ]
        );
        break;
      case 'activate':
        selectedProducts.forEach(product => 
          onEditProduct(product.id, { status: 'active' })
        );
        setBulkActionMode(false);
        setSelectedItems(new Set());
        break;
      case 'deactivate':
        selectedProducts.forEach(product => 
          onEditProduct(product.id, { status: 'inactive' })
        );
        setBulkActionMode(false);
        setSelectedItems(new Set());
        break;
      case 'restock':
        // Show restock modal for selected items
        Alert.alert(
          'Bulk Restock',
          'Set quantity for selected items',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Restock',
              onPress: () => {
                // You can implement bulk restock modal here
                selectedProducts.forEach(product => {
                  onUpdateStock(product.id, 10); // Default restock to 10
                });
                setBulkActionMode(false);
                setSelectedItems(new Set());
              }
            }
          ]
        );
        break;
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'inactive': return '#FF9800';
      case 'discontinued': return '#F44336';
      default: return '#757575';
    }
  };

  // Get sort icon
  const getSortIcon = (field) => {
    if (sortBy !== field) return 'sort';
    return sortOrder === 'asc' ? 'keyboard-arrow-up' : 'keyboard-arrow-down';
  };

  // Render inventory item with animation safety
  const renderInventoryItem = ({ item, index }) => {
    const stockInfo = getStockStatus(item);
    
    const ItemComponent = Platform.OS === 'web' ? View : Animated.View;
    
    return (
      <ItemComponent
        style={[
          styles.tableRow,
          Platform.OS !== 'web' ? {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          } : {},
          index % 2 === 0 && styles.evenRow,
          selectedItems.has(item.id) && styles.selectedRow,
          stockInfo.status === 'sold-out' && styles.soldOutRow,
        ]}
      >
        {bulkActionMode && (
          <TouchableOpacity 
            style={styles.tableCell}
            onPress={() => toggleItemSelection(item.id)}
          >
            <MaterialIcons 
              name={selectedItems.has(item.id) ? 'check-box' : 'check-box-outline-blank'} 
              size={20} 
              color="#4CAF50" 
            />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.tableCell, styles.nameCell]}
          onPress={() => onProductPress(item)}
        >
          <View style={styles.productInfo}>
            <View style={styles.productIcon}>
              <MaterialCommunityIcons 
                name={item.productType === 'plant' ? 'leaf' : 'cube-outline'} 
                size={20} 
                color={stockInfo.status === 'sold-out' ? '#F44336' : '#4CAF50'} 
              />
            </View>
            <View style={styles.productDetails}>
              <Text style={[
                styles.productName, 
                stockInfo.status === 'sold-out' && styles.soldOutText
              ]} numberOfLines={1}>
                {item.name || item.common_name || 'Unknown Product'}
              </Text>
              {item.scientific_name && (
                <Text style={[
                  styles.productScientific,
                  stockInfo.status === 'sold-out' && styles.soldOutText
                ]} numberOfLines={1}>
                  {item.scientific_name}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.tableCell}
          onPress={() => handleQuickStockEdit(item)}
        >
          <View style={styles.stockContainer}>
            <Text style={[
              styles.stockText,
              { color: stockInfo.color },
              stockInfo.status === 'sold-out' && styles.soldOutText
            ]}>
              {item.quantity || 0}
            </Text>
            <View style={[styles.stockBadge, { backgroundColor: stockInfo.color }]}>
              <Text style={styles.stockBadgeText}>{stockInfo.text}</Text>
            </View>
          </View>
        </TouchableOpacity>
        
        <View style={styles.tableCell}>
          <Text style={[
            styles.priceText,
            stockInfo.status === 'sold-out' && styles.soldOutText
          ]}>
            ${(item.finalPrice || item.price || 0).toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.tableCell}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>
              {(item.status || 'active').charAt(0).toUpperCase() + (item.status || 'active').slice(1)}
            </Text>
          </View>
        </View>
        
        <View style={styles.tableCell}>
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleEditPress(item)}
            >
              <MaterialIcons name="edit" size={16} color="#2196F3" />
            </TouchableOpacity>
            
            {stockInfo.status === 'sold-out' && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.restockButton]}
                onPress={() => handleQuickStockEdit(item)}
              >
                <MaterialIcons name="add" size={16} color="#4CAF50" />
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleDeletePress(item)}
            >
              <MaterialIcons name="delete" size={16} color="#f44336" />
            </TouchableOpacity>
          </View>
        </View>
      </ItemComponent>
    );
  };

  // Render empty state for inventory
  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading inventory...</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="package-variant-closed" size={48} color="#e0e0e0" />
        <Text style={styles.emptyText}>
          {searchQuery || filterStatus !== 'all' 
            ? 'No products match your filters' 
            : 'No products in inventory yet'
          }
        </Text>
        {searchQuery || filterStatus !== 'all' ? (
          <TouchableOpacity 
            onPress={() => {
              setSearchQuery('');
              setFilterStatus('all');
            }}
          >
            <Text style={styles.clearFiltersText}>Clear filters</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Low Stock Banner */}
      {lowStockItems.length > 0 && (
        <LowStockBanner 
          lowStockItems={lowStockItems}
          onManageStock={() => {/* Handle navigate to stock management */}}
        />
      )}
      
      {/* Sold Out Banner */}
      {soldOutItems.length > 0 && (
        <View style={styles.soldOutBanner}>
          <View style={styles.bannerContent}>
            <View style={styles.bannerIcon}>
              <MaterialIcons name="block" size={24} color="#F44336" />
            </View>
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle}>Sold Out Items</Text>
              <Text style={styles.bannerSubtitle}>
                {soldOutItems.length} item{soldOutItems.length !== 1 ? 's' : ''} need restocking
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.bannerAction}
              onPress={() => setFilterStatus('sold-out')}
            >
              <Text style={styles.bannerActionText}>View</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Filters and Controls */}
      <View style={styles.controlsContainer}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color="#4CAF50" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search products..."
            placeholderTextColor="#999"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="clear" size={20} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>
        
        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          {[
            { key: 'all', label: 'All', count: inventory.length },
            { key: 'active', label: 'Active', count: inventory.filter(i => i.status === 'active').length },
            { key: 'sold-out', label: 'Sold Out', count: soldOutItems.length },
            { key: 'low-stock', label: 'Low Stock', count: lowStockItems.length },
            { key: 'inactive', label: 'Inactive', count: inventory.filter(i => i.status === 'inactive').length },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterTab,
                filterStatus === filter.key && styles.activeFilterTab,
                filter.key === 'sold-out' && styles.soldOutTab,
              ]}
              onPress={() => setFilterStatus(filter.key)}
            >
              <Text style={[
                styles.filterTabText,
                filterStatus === filter.key && styles.activeFilterTabText,
                filter.key === 'sold-out' && filterStatus === filter.key && styles.soldOutTabText,
              ]}>
                {filter.label} ({filter.count})
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Bulk Actions */}
        <View style={styles.bulkActionsContainer}>
          <TouchableOpacity 
            style={[styles.bulkActionButton, bulkActionMode && styles.activeBulkButton]}
            onPress={toggleBulkActionMode}
          >
            <MaterialIcons 
              name={bulkActionMode ? "close" : "checklist"} 
              size={16} 
              color={bulkActionMode ? "#fff" : "#4CAF50"} 
            />
            <Text style={[
              styles.bulkActionText,
              bulkActionMode && styles.activeBulkText
            ]}>
              {bulkActionMode ? 'Cancel' : 'Bulk Edit'}
            </Text>
          </TouchableOpacity>
          
          {bulkActionMode && selectedItems.size > 0 && (
            <View style={styles.bulkActions}>
              <TouchableOpacity 
                style={styles.bulkAction}
                onPress={() => handleBulkAction('activate')}
              >
                <MaterialIcons name="visibility" size={16} color="#4CAF50" />
                <Text style={styles.bulkActionLabel}>Activate</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.bulkAction}
                onPress={() => handleBulkAction('restock')}
              >
                <MaterialIcons name="add" size={16} color="#4CAF50" />
                <Text style={styles.bulkActionLabel}>Restock</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.bulkAction}
                onPress={() => handleBulkAction('deactivate')}
              >
                <MaterialIcons name="visibility-off" size={16} color="#FF9800" />
                <Text style={styles.bulkActionLabel}>Deactivate</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.bulkAction}
                onPress={() => handleBulkAction('delete')}
              >
                <MaterialIcons name="delete" size={16} color="#f44336" />
                <Text style={styles.bulkActionLabel}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
      
      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          Showing {filteredInventory.length} of {inventory.length} products
        </Text>
        {bulkActionMode && selectedItems.size > 0 && (
          <Text style={styles.selectedText}>
            {selectedItems.size} selected
          </Text>
        )}
      </View>
      
      {/* Table */}
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          {bulkActionMode && (
            <TouchableOpacity 
              style={styles.headerCell}
              onPress={() => {
                if (selectedItems.size === filteredInventory.length) {
                  setSelectedItems(new Set());
                } else {
                  setSelectedItems(new Set(filteredInventory.map(item => item.id)));
                }
              }}
            >
              <MaterialIcons 
                name={selectedItems.size === filteredInventory.length ? 'check-box' : 'check-box-outline-blank'} 
                size={20} 
                color="#4CAF50" 
              />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[styles.headerCell, styles.nameCell]} 
            onPress={() => handleSort('name')}
          >
            <Text style={styles.headerText}>Product</Text>
            <MaterialIcons name={getSortIcon('name')} size={16} color="#666" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerCell} 
            onPress={() => handleSort('quantity')}
          >
            <Text style={styles.headerText}>Stock</Text>
            <MaterialIcons name={getSortIcon('quantity')} size={16} color="#666" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerCell} 
            onPress={() => handleSort('price')}
          >
            <Text style={styles.headerText}>Price</Text>
            <MaterialIcons name={getSortIcon('price')} size={16} color="#666" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerCell} 
            onPress={() => handleSort('status')}
          >
            <Text style={styles.headerText}>Status</Text>
            <MaterialIcons name={getSortIcon('status')} size={16} color="#666" />
          </TouchableOpacity>
          
          <View style={styles.headerCell}>
            <Text style={styles.headerText}>Actions</Text>
          </View>
        </View>
        
        <FlatList
          data={filteredInventory}
          renderItem={renderInventoryItem}
          keyExtractor={item => item.id}
          style={styles.tableList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#4CAF50']}
              tintColor="#4CAF50"
            />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      </View>
      
      {/* Product Edit Modal */}
      <ProductEditModal
        visible={editModalVisible}
        product={selectedProduct}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedProduct(null);
        }}
        onSave={(updatedProduct) => {
          onEditProduct(selectedProduct.id, updatedProduct);
          setEditModalVisible(false);
          setSelectedProduct(null);
        }}
        businessId={businessId}
      />
      
      {/* Quick Stock Edit Modal */}
      <Modal
        visible={quickEditModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setQuickEditModalVisible(false)}
      >
        <View style={styles.quickEditOverlay}>
          <View style={styles.quickEditModal}>
            <Text style={styles.quickEditTitle}>
              {selectedProduct && (selectedProduct.quantity || 0) === 0 ? 'Restock Item' : 'Update Stock'}
            </Text>
            <Text style={styles.quickEditProduct}>
              {selectedProduct?.name || selectedProduct?.common_name}
            </Text>
            
            <TextInput
              style={styles.quickEditInput}
              value={quickEditStock}
              onChangeText={setQuickEditStock}
              placeholder="Enter new stock quantity"
              keyboardType="numeric"
              autoFocus={true}
            />
            
            <View style={styles.quickEditActions}>
              <TouchableOpacity 
                style={styles.quickEditCancel}
                onPress={() => setQuickEditModalVisible(false)}
              >
                <Text style={styles.quickEditCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.quickEditSave}
                onPress={handleQuickStockUpdate}
              >
                <Text style={styles.quickEditSaveText}>
                  {selectedProduct && (selectedProduct.quantity || 0) === 0 ? 'Restock' : 'Update'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  // Sold Out Banner
  soldOutBanner: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#ffebee',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
    ...(Platform.OS !== 'web' ? {
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    } : {
      borderWidth: 1,
      borderColor: '#ffcdd2',
    }),
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F44336',
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  bannerAction: {
    backgroundColor: '#F44336',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  bannerActionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  // Sold Out Styles
  soldOutRow: {
    backgroundColor: '#ffebee',
    opacity: 0.8,
  },
  soldOutText: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  soldOutTab: {
    backgroundColor: '#ffebee',
    borderColor: '#F44336',
  },
  soldOutTabText: {
    color: '#F44336',
  },
  // Stock Container
  stockContainer: {
    alignItems: 'center',
    gap: 4,
  },
  stockText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  // Actions
  restockButton: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  controlsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
    paddingVertical: Platform.OS === 'ios' ? 8 : 0,
  },
  filterTabs: {
    flexDirection: 'row',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
    marginBottom: 8,
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
  bulkActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  bulkActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
    backgroundColor: '#fff',
  },
  activeBulkButton: {
    backgroundColor: '#4CAF50',
  },
  bulkActionText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
  },
  activeBulkText: {
    color: '#fff',
  },
  bulkActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  bulkAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  bulkActionLabel: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
  resultsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
  },
  resultsText: {
    fontSize: 12,
    color: '#666',
  },
  selectedText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  tableContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  nameCell: {
    flex: 2,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  tableList: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  evenRow: {
    backgroundColor: '#fafafa',
  },
  selectedRow: {
    backgroundColor: '#e8f5e8',
  },
  tableCell: {
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f9f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  productScientific: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#666',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  clearFiltersText: {
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 12,
  },
  // Quick Edit Modal
  quickEditOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickEditModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  quickEditTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  quickEditProduct: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  quickEditInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  quickEditActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickEditCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  quickEditCancelText: {
    fontSize: 16,
    color: '#666',
  },
  quickEditSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  quickEditSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});