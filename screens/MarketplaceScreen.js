import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// Components
import PlantCard from '../components/PlantCard';
import SearchBar from '../components/SearchBar';
import CategoryFilter from '../components/CategoryFilter';
import PriceRange from '../components/PriceRange';

// API Services - Replace with your actual API service
const fetchPlants = async () => {
  // This is just a mock implementation
  // In a real app, you would call your Azure Function here
  return SAMPLE_PLANTS;
};

// Sample plant data for development
const SAMPLE_PLANTS = [
  {
    id: '1',
    name: 'Monstera Deliciosa',
    description: 'Beautiful Swiss Cheese Plant with large fenestrated leaves',
    price: 29.99,
    imageUrl: 'https://via.placeholder.com/150?text=Monstera',
    sellerName: 'PlantLover123',
    sellerId: 'seller1',
    location: { city: 'Seattle' },
    category: 'Indoor Plants',
    listedDate: new Date().toISOString(),
    isFavorite: false
  },
  {
    id: '2',
    name: 'Snake Plant',
    description: 'Low maintenance indoor plant, perfect for beginners',
    price: 19.99,
    imageUrl: 'https://via.placeholder.com/150?text=Snake+Plant',
    sellerName: 'GreenThumb',
    sellerId: 'seller2',
    location: { city: 'Portland' },
    category: 'Indoor Plants',
    listedDate: new Date().toISOString(),
    isFavorite: true
  },
  {
    id: '3',
    name: 'Fiddle Leaf Fig',
    description: 'Trendy houseplant with violin-shaped leaves',
    price: 34.99,
    imageUrl: 'https://via.placeholder.com/150?text=Fiddle+Leaf',
    sellerName: 'PlantPro',
    sellerId: 'seller3',
    location: { city: 'San Francisco' },
    category: 'Indoor Plants',
    listedDate: new Date().toISOString(),
    isFavorite: false
  },
  {
    id: '4',
    name: 'Cactus Collection',
    description: 'Set of 3 small decorative cacti',
    price: 18.99,
    imageUrl: 'https://via.placeholder.com/150?text=Cactus',
    sellerName: 'DesertDreams',
    sellerId: 'seller4',
    location: { city: 'Phoenix' },
    category: 'Cacti',
    listedDate: new Date().toISOString(),
    isFavorite: false
  },
  {
    id: '5',
    name: 'Lavender Plant',
    description: 'Fragrant flowering plant perfect for outdoors',
    price: 15.99,
    imageUrl: 'https://via.placeholder.com/150?text=Lavender',
    sellerName: 'GardenGuru',
    sellerId: 'seller5',
    location: { city: 'Los Angeles' },
    category: 'Outdoor Plants',
    listedDate: new Date().toISOString(),
    isFavorite: false
  },
  {
    id: '6',
    name: 'Rose Bush',
    description: 'Classic red rose bush for your garden',
    price: 22.99,
    imageUrl: 'https://via.placeholder.com/150?text=Rose',
    sellerName: 'FlowerPower',
    sellerId: 'seller6',
    location: { city: 'Chicago' },
    category: 'Flowering Plants',
    listedDate: new Date().toISOString(),
    isFavorite: false
  }
];

const MarketplaceScreen = () => {
  const navigation = useNavigation();
  const [plants, setPlants] = useState([]);
  const [filteredPlants, setFilteredPlants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });
  const [error, setError] = useState(null);

  // Categories for filter
  const categories = [
    'All',
    'Indoor Plants',
    'Outdoor Plants',
    'Succulents',
    'Cacti',
    'Flowering Plants',
    'Herbs',
  ];

  useEffect(() => {
    loadPlants();
  }, []);

  // Apply filters when any filter criteria changes
  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedCategory, priceRange, plants]);

  const loadPlants = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Call Azure Function to get plants
      const data = await fetchPlants();
      setPlants(data);
      
      setIsLoading(false);
    } catch (err) {
      setError('Failed to load plants. Please try again later.');
      setIsLoading(false);
      console.error('Error fetching plants:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPlants();
    setRefreshing(false);
  };

  const applyFilters = () => {
    let results = [...plants];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        (plant) =>
          plant.name.toLowerCase().includes(query) ||
          plant.description.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (selectedCategory && selectedCategory !== 'All') {
      results = results.filter((plant) => plant.category === selectedCategory);
    }

    // Apply price range filter
    results = results.filter(
      (plant) => plant.price >= priceRange.min && plant.price <= priceRange.max
    );

    setFilteredPlants(results);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
  };

  const handlePriceRangeChange = (range) => {
    setPriceRange({ min: range[0], max: range[1] });
  };

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadPlants}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <SearchBar value={searchQuery} onChangeText={handleSearch} />
      
      <CategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onSelect={handleCategorySelect}
      />
      
      <PriceRange
        onPriceChange={handlePriceRangeChange}
      />

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading plants...</Text>
        </View>
      ) : filteredPlants.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="eco" size={48} color="#aaa" />
          <Text style={styles.noResultsText}>
            No plants found matching your criteria
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPlants}
          renderItem={({ item }) => <PlantCard plant={item} />}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}

      {/* Floating action button to add new plant */}
      <TouchableOpacity
        style={styles.fabButton}
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
  listContainer: {
    padding: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  noResultsText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  fabButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
});

export default MarketplaceScreen;