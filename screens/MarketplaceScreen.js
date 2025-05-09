import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

// Import all components from the index file
import {
  PlantCard,
  SearchBar,
  CategoryFilter,
  PriceRange,
  SortOptions,
  MarketplaceHeader // Add this line
} from '../components';

// Import services
import { getAll } from '../services/productData';

const MarketplaceScreen = () => {
  const navigation = useNavigation();
  
  // State
  const [plants, setPlants] = useState([]);
  const [filteredPlants, setFilteredPlants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });
  const [sortOption, setSortOption] = useState('recent');
  const [page, setPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [error, setError] = useState(null);
  const [isMapView, setIsMapView] = useState(false);
  
  // Load plants when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Reset filters when navigating back to screen
      loadPlants(1, true);
    }, [])
  );

  // Apply filters when any filter criteria changes
  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedCategory, priceRange, plants, sortOption]);

  // Function to load plants from API
  const loadPlants = async (pageNum = 1, resetData = false) => {
    if (!hasMorePages && pageNum > 1 && !resetData) return;
    
    try {
      setError(null);
      
      if (pageNum === 1) {
        setIsLoading(true);
      }
      
      // Get plants from API
      const data = await getAll(
        pageNum, 
        selectedCategory === 'All' ? null : selectedCategory, 
        searchQuery
      );
      
      // Update state with new data
      if (data && data.products) {
        if (resetData) {
          setPlants(data.products);
        } else {
          setPlants(prevPlants => [...prevPlants, ...data.products]);
        }
        
        setPage(pageNum);
        setHasMorePages(data.pages > pageNum);
      }
      
      setIsLoading(false);
      setIsRefreshing(false);
    } catch (err) {
      console.error('Error loading plants:', err);
      setError('Failed to load plants. Please try again.');
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadPlants(1, true);
  };

  // Apply all filters to the plants data
  const applyFilters = () => {
    if (!plants.length) return;
    
    let results = [...plants];
    
    // Apply category filter if not "All"
    if (selectedCategory !== 'All') {
      results = results.filter(plant => 
        plant.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    
    // Apply price range filter
    results = results.filter(
      plant => plant.price >= priceRange.min && plant.price <= priceRange.max
    );
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        plant =>
          plant.name?.toLowerCase().includes(query) ||
          plant.title?.toLowerCase().includes(query) ||
          plant.description?.toLowerCase().includes(query) ||
          plant.city?.toLowerCase().includes(query) ||
          plant.location?.toLowerCase?.().includes(query) ||
          plant.category?.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    results = sortPlants(results, sortOption);
    
    // Update filtered plants
    setFilteredPlants(results);
  };

  // Sort plants based on selected option
  const sortPlants = (plantsToSort, option) => {
    switch (option) {
      case 'recent':
        return [...plantsToSort].sort((a, b) => {
          const dateA = new Date(a.addedAt || a.listedDate || 0);
          const dateB = new Date(b.addedAt || b.listedDate || 0);
          return dateB - dateA; // Most recent first
        });
      case 'priceAsc':
        return [...plantsToSort].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      case 'priceDesc':
        return [...plantsToSort].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      case 'popular':
        return [...plantsToSort].sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
      case 'rating':
        return [...plantsToSort].sort((a, b) => (b.rating || 0) - (a.rating || 0));
      default:
        return plantsToSort;
    }
  };

  // Handle search
  const handleSearch = (query) => {
    setSearchQuery(query);
    // Reset to page 1 when search changes
    if (query !== searchQuery) {
      loadPlants(1, true); 
    }
  };

  // Handle category selection
  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    // Reset to page 1 when category changes
    if (categoryId !== selectedCategory) {
      loadPlants(1, true);
    }
  };

  // Handle price range change
  const handlePriceRangeChange = (range) => {
    setPriceRange({ min: range[0], max: range[1] });
  };

  // Handle sort option change
  const handleSortChange = (option) => {
    setSortOption(option);
  };

  // Handle load more
  const handleLoadMore = () => {
    if (!isLoading && hasMorePages) {
      loadPlants(page + 1);
    }
  };

  // Toggle between list and map view
  const toggleMapView = () => {
    setIsMapView(!isMapView);
  };

  // Render list empty component
  const renderEmptyList = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading plants...</Text>
        </View>
      );
    }
    
    if (error) {
      return (
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadPlants(1, true)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="eco" size={48} color="#aaa" />
        <Text style={styles.noResultsText}>No plants found matching your criteria</Text>
        <TouchableOpacity 
          style={styles.resetButton}
          onPress={() => {
            setSearchQuery('');
            setSelectedCategory('All');
            setPriceRange({ min: 0, max: 1000 });
            loadPlants(1, true);
          }}
        >
          <Text style={styles.resetButtonText}>Reset Filters</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render footer for infinite scrolling
  const renderFooter = () => {
    if (!isLoading || !hasMorePages) return null;
    
    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" color="#4CAF50" />
        <Text style={styles.footerText}>Loading more plants...</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <MarketplaceHeader 
        showBackButton={false}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />

      {/* Search Bar */}
      <SearchBar 
        value={searchQuery} 
        onChangeText={handleSearch}
        onSubmit={() => loadPlants(1, true)}
        style={styles.searchBarContainer}
      />
      
      {/* Filter Section */}
      <View style={styles.filterContainer}>
        {/* Category Filter */}
        <CategoryFilter
          selectedCategory={selectedCategory}
          onSelect={handleCategorySelect}
        />
        
        {/* Filter options row */}
        <View style={styles.filterOptions}>
          {/* Sort Options */}
          <SortOptions 
            selectedOption={sortOption}
            onSelectOption={handleSortChange}
          />
          
          {/* Price Range Filter */}
          <PriceRange
            onPriceChange={handlePriceRangeChange}
            initialMin={priceRange.min}
            initialMax={priceRange.max}
            style={styles.priceRangeContainer}
          />
        </View>
      </View>

      {/* Plant List or Map View */}
      {isMapView ? (
        // Map View
        <View style={styles.mapContainer}>
          {/* Azure Map integration */}
        </View>
      ) : (
        // List View
        <FlatList
          data={filteredPlants}
          renderItem={({ item }) => <PlantCard plant={item} />}
          keyExtractor={(item) => item.id?.toString() || item._id?.toString()}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyList}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={["#4CAF50"]}
              tintColor="#4CAF50"
            />
          }
        />
      )}
      
      {/* Add Plant Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddPlant')}
      >
        <MaterialIcons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchBarContainer: {
    alignItems: 'center',
    paddingTop: 16,
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  priceRangeContainer: {
    width: '60%',
    marginBottom: 0,
  },
  listContainer: {
    paddingHorizontal: 8,
    paddingBottom: 80,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 300,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 16,
  },
  noResultsText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 10,
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  resetButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  resetButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  footerText: {
    marginLeft: 8,
    color: '#666',
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});

export default MarketplaceScreen;