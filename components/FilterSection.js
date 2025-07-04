// components/FilterSection.js - Enhanced with Business Integration
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
  Animated,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapToggle from './MapToggle';
import PriceRange from './PriceRange';
import SortOptions from './SortOptions';
import MarketplaceFilterToggle from './MarketplaceFilterToggle';

const FilterSection = ({
  sortOption = 'recent',
  onSortChange,
  priceRange = { min: 0, max: 1000 },
  onPriceChange,
  viewMode = 'grid',
  onViewModeChange,
  category,
  onCategoryChange,
  sellerType = 'all', // New prop for business/individual filtering
  onSellerTypeChange, // New prop for handling seller type changes
  activeFilters = [],
  onRemoveFilter,
  onResetFilters,
  businessCounts = { all: 0, individual: 0, business: 0 }, // New prop for counts
}) => {
  // State
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [modalAnimation] = useState(new Animated.Value(0));
  const [localPriceRange, setLocalPriceRange] = useState({
    min: typeof priceRange.min === 'number' ? priceRange.min : 0,
    max: typeof priceRange.max === 'number' ? priceRange.max : 1000
  });
  
  // Ensure price range values are valid numbers
  const safeMinPrice = priceRange && typeof priceRange.min === 'number' ? priceRange.min : 0;
  const safeMaxPrice = priceRange && typeof priceRange.max === 'number' ? priceRange.max : 1000;
  const safePriceRange = { min: safeMinPrice, max: safeMaxPrice };
  
  // Update local price range when props change
  useEffect(() => {
    setLocalPriceRange({
      min: safePriceRange.min,
      max: safePriceRange.max
    });
  }, [safePriceRange.min, safePriceRange.max]);
  
  // Handle price range change
  const handlePriceRangeChange = (range) => {
    if (Array.isArray(range) && range.length === 2) {
      setLocalPriceRange({ 
        min: typeof range[0] === 'number' ? range[0] : 0, 
        max: typeof range[1] === 'number' ? range[1] : 1000 
      });
    }
  };

  // Apply price range when modal is closed
  const applyFilters = () => {
    if (onPriceChange) {
      onPriceChange(localPriceRange);
    }
    hideFilterModal();
  };

  // Handle filter modal animation
  const showFilterModal = () => {
    setFilterModalVisible(true);
    Animated.timing(modalAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const hideFilterModal = () => {
    Animated.timing(modalAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setFilterModalVisible(false);
    });
  };

  // Count active filters (including seller type and price range)
  const activeFilterCount = activeFilters.length + 
    ((safePriceRange.min > 0 || safePriceRange.max < 1000) ? 1 : 0) +
    (sellerType !== 'all' ? 1 : 0);

  // Modal slide-in animation
  const slideAnimation = {
    transform: [
      {
        scale: modalAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1],
        }),
      },
      {
        translateY: modalAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
    opacity: modalAnimation,
  };

  // Modal background opacity animation
  const backdropAnimation = {
    opacity: modalAnimation,
  };

  // Reset all filters including seller type
  const handleResetAllFilters = () => {
    setLocalPriceRange({ min: 0, max: 1000 });
    onPriceChange && onPriceChange({ min: 0, max: 1000 });
    onSellerTypeChange && onSellerTypeChange('all');
    onResetFilters && onResetFilters();
    hideFilterModal();
  };

  return (
    <View style={styles.mainContainer}>
      {/* Business/Individual Filter Toggle */}
      <MarketplaceFilterToggle
        sellerType={sellerType}
        onSellerTypeChange={onSellerTypeChange}
        counts={businessCounts}
      />

      {/* Active Filters Row (conditional) */}
      {activeFilterCount > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.activeFiltersContainer}
          contentContainerStyle={styles.activeFiltersContent}
        >
          {/* Seller Type Filter Pill */}
          {sellerType !== 'all' && (
            <View style={styles.filterPill}>
              <MaterialCommunityIcons 
                name={sellerType === 'business' ? 'store' : 'account'} 
                size={14} 
                color={sellerType === 'business' ? '#FF9800' : '#2196F3'} 
              />
              <Text style={[
                styles.filterPillText,
                { color: sellerType === 'business' ? '#FF9800' : '#2196F3' }
              ]}>
                {sellerType === 'business' ? 'Business Only' : 'Individual Only'}
              </Text>
              <TouchableOpacity 
                onPress={() => onSellerTypeChange && onSellerTypeChange('all')}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <MaterialIcons name="close" size={16} color="#777" />
              </TouchableOpacity>
            </View>
          )}

          {/* Price Range Filter Pill (if active) */}
          {(safePriceRange.min > 0 || safePriceRange.max < 1000) && (
            <View style={styles.filterPill}>
              <MaterialIcons name="attach-money" size={14} color="#4CAF50" />
              <Text style={styles.filterPillText}>
                ${safePriceRange.min} - ${safePriceRange.max}
              </Text>
              <TouchableOpacity 
                onPress={() => onPriceChange && onPriceChange({ min: 0, max: 1000 })}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <MaterialIcons name="close" size={16} color="#777" />
              </TouchableOpacity>
            </View>
          )}
          
          {/* Custom Active Filters */}
          {activeFilters.map((filter, index) => (
            <View key={`filter-${index}-${filter.id || 'unknown'}`} style={styles.filterPill}>
              <Text style={styles.filterPillText}>
                {filter.label}
              </Text>
              <TouchableOpacity 
                onPress={() => onRemoveFilter && onRemoveFilter(filter.id)}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <MaterialIcons name="close" size={16} color="#777" />
              </TouchableOpacity>
            </View>
          ))}
          
          {/* Clear All Button */}
          {activeFilterCount > 1 && (
            <TouchableOpacity 
              style={styles.clearAllButton}
              onPress={handleResetAllFilters}
            >
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
      
      {/* Main Filter Controls Row */}
      <View style={styles.controlsRow}>
        {/* Sort Options - Left side */}
        <View style={styles.sortContainer}>
          <SortOptions 
            selectedOption={sortOption}
            onSelectOption={onSortChange}
          />
        </View>
        
        {/* Filter Button */}
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={showFilterModal}
        >
          <MaterialIcons name="filter-list" size={18} color="#4CAF50" />
          <Text style={styles.filterButtonText}>
            Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </Text>
        </TouchableOpacity>
        
        {/* Empty middle space to push sort left and map toggle right */}
        <View style={styles.spacer} />
        
        {/* View Toggle - Right side */}
        <MapToggle 
          viewMode={viewMode} 
          onViewModeChange={onViewModeChange} 
        />
      </View>
      
      {/* Filter Modal */}
      {filterModalVisible && (
        <Modal
          visible={filterModalVisible}
          transparent={true}
          animationType="none"
          onRequestClose={hideFilterModal}
        >
          <Animated.View 
            style={[styles.modalOverlay, backdropAnimation]}
          >
            <Pressable style={styles.modalBackdrop} onPress={hideFilterModal}>
              <Animated.View 
                style={[styles.modalContent, slideAnimation]}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Filters</Text>
                  <TouchableOpacity 
                    onPress={hideFilterModal}
                    style={styles.closeButton}
                  >
                    <MaterialIcons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>
                
                <ScrollView>
                  {/* Seller Type Filter in Modal */}
                  <View style={styles.modalSection}>
                    <Text style={styles.sectionTitle}>Seller Type</Text>
                    <View style={styles.sellerTypeButtons}>
                      <TouchableOpacity
                        style={[
                          styles.sellerTypeButton,
                          sellerType === 'all' && styles.selectedSellerType
                        ]}
                        onPress={() => onSellerTypeChange && onSellerTypeChange('all')}
                      >
                        <MaterialIcons name="people" size={20} color={sellerType === 'all' ? '#fff' : '#4CAF50'} />
                        <Text style={[
                          styles.sellerTypeText,
                          sellerType === 'all' && styles.selectedSellerTypeText
                        ]}>
                          All ({businessCounts.all})
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[
                          styles.sellerTypeButton,
                          sellerType === 'individual' && styles.selectedSellerType
                        ]}
                        onPress={() => onSellerTypeChange && onSellerTypeChange('individual')}
                      >
                        <MaterialCommunityIcons name="account" size={20} color={sellerType === 'individual' ? '#fff' : '#2196F3'} />
                        <Text style={[
                          styles.sellerTypeText,
                          sellerType === 'individual' && styles.selectedSellerTypeText
                        ]}>
                          Individual ({businessCounts.individual})
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[
                          styles.sellerTypeButton,
                          sellerType === 'business' && styles.selectedSellerType
                        ]}
                        onPress={() => onSellerTypeChange && onSellerTypeChange('business')}
                      >
                        <MaterialCommunityIcons name="store" size={20} color={sellerType === 'business' ? '#fff' : '#FF9800'} />
                        <Text style={[
                          styles.sellerTypeText,
                          sellerType === 'business' && styles.selectedSellerTypeText
                        ]}>
                          Business ({businessCounts.business})
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Price Range in Modal */}
                  <View style={styles.modalSection}>
                    <Text style={styles.sectionTitle}>Price Range</Text>
                    <PriceRange
                      onPriceChange={handlePriceRangeChange}
                      initialMin={localPriceRange.min}
                      initialMax={localPriceRange.max}
                      style={styles.priceRange}
                      hideTitle={true}
                      max={1000}
                    />
                  </View>
                  
                  {/* Action Buttons */}
                  <View style={styles.modalActions}>
                    <TouchableOpacity 
                      style={styles.resetButton}
                      onPress={handleResetAllFilters}
                    >
                      <Text style={styles.resetButtonText}>Reset All</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.applyButton}
                      onPress={applyFilters}
                    >
                      <Text style={styles.applyButtonText}>Apply Filters</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </Animated.View>
            </Pressable>
          </Animated.View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  activeFiltersContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activeFiltersContent: {
    paddingHorizontal: 16,
  },
  filterPill: {
    backgroundColor: '#f0f9f0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0f0e0',
  },
  filterPillText: {
    fontSize: 13,
    color: '#4CAF50',
    marginHorizontal: 6,
    fontWeight: '500',
  },
  clearAllButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  clearAllText: {
    fontSize: 13,
    color: '#f44336',
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sortContainer: {
    // Styles for sort container
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginLeft: 8,
  },
  filterButtonText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 6,
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingBottom: 24,
    width: '90%',
    maxWidth: 360,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  modalSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
    textAlign: 'center',
  },
  sellerTypeButtons: {
    flexDirection: 'column',
    gap: 12,
  },
  sellerTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  selectedSellerType: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  sellerTypeText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    fontWeight: '500',
  },
  selectedSellerTypeText: {
    color: '#fff',
  },
  priceRange: {
    marginTop: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  resetButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  resetButtonText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  applyButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 8,
  },
  applyButtonText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
});

export default FilterSection;