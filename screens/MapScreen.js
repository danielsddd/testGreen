import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  FlatList,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';

import MarketplaceHeader from '../components/MarketplaceHeader';
import CrossPlatformAzureMapView from '../components/CrossPlatformAzureMapView';
import MapSearchBox from '../components/MapSearchBox';
import RadiusControl from '../components/RadiusControl';
import PlantCard from '../components/PlantCard';
import { getNearbyProducts, getAzureMapsKey, reverseGeocode } from '../services/marketplaceApi';

const { width, height } = Dimensions.get('window');

/**
 * Enhanced MapScreen component with improved Azure Maps integration
 * Shows plants on a map with search, radius and location features
 */
const MapScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { products = [], initialLocation } = route.params || {};

  // State variables
  const [mapProducts, setMapProducts] = useState(products);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [searchRadius, setSearchRadius] = useState(10);
  const [azureMapsKey, setAzureMapsKey] = useState(null);
  const [isKeyLoading, setIsKeyLoading] = useState(true);
  const [nearbyProducts, setNearbyProducts] = useState([]);
  const [sortOrder, setSortOrder] = useState('nearest'); // 'nearest' or 'farthest'
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'list'
  const [showResults, setShowResults] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [radiusVisible, setRadiusVisible] = useState(true);
  
  // Refs
  const mapRef = useRef(null);
  const listRef = useRef(null);

  // Load Azure Maps key when component mounts
  useEffect(() => {
    const loadMapsKey = async () => {
      try {
        setIsKeyLoading(true);
        const key = await getAzureMapsKey();
        setAzureMapsKey(key);
        setIsKeyLoading(false);
      } catch (err) {
        console.error('Error fetching Azure Maps key:', err);
        setError('Failed to load map configuration. Please try again later.');
        setIsKeyLoading(false);
      }
    };

    loadMapsKey();
  }, []);

  // Initialize map with products if provided
  useFocusEffect(
    useCallback(() => {
      if (products.length > 0) {
        setMapProducts(products);
        // If we have products but no selected location, try to calculate center
        if (products.length > 0 && !selectedLocation) {
          const locationsWithCoords = products.filter(
            p => p.location?.latitude && p.location?.longitude
          );
          
          if (locationsWithCoords.length > 0) {
            // Use first product's location
            setSelectedLocation({
              latitude: locationsWithCoords[0].location.latitude,
              longitude: locationsWithCoords[0].location.longitude,
              city: locationsWithCoords[0].location?.city || locationsWithCoords[0].city || 'Unknown location'
            });
          }
        }
      }
      
      // If initial location is provided, set it and search nearby products
      if (initialLocation?.latitude && initialLocation?.longitude) {
        setSelectedLocation(initialLocation);
        if (products.length === 0) {
          // Only load nearby products if no products were passed in
          loadNearbyProducts(initialLocation, searchRadius);
        }
      }
    }, [products, initialLocation])
  );

  // Handle location selection
  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    if (location?.latitude && location?.longitude) {
      loadNearbyProducts(location, searchRadius);
    }
  };

  // Handle radius change
  const handleRadiusChange = (radius) => {
    setSearchRadius(radius);
  };
  
  // Apply radius change and reload products
  const handleApplyRadius = (radius) => {
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      loadNearbyProducts(selectedLocation, radius);
    }
  };

  // Load nearby products based on location and radius
  const loadNearbyProducts = async (location, radius) => {
    if (!location?.latitude || !location?.longitude) return;

    try {
      setIsLoading(true);
      setError(null);
      setSearchingLocation(true);

      const result = await getNearbyProducts(
        location.latitude,
        location.longitude,
        radius
      );

      if (result && result.products) {
        const products = result.products.map(product => ({
          ...product,
          distance: product.distance || 0
        }));
        
        // Sort products by distance
        const sortedProducts = sortProductsByDistance(products, sortOrder === 'nearest');
        
        setMapProducts(sortedProducts);
        setNearbyProducts(sortedProducts);
        setShowResults(true);
        
        // Show message if no products found
        if (sortedProducts.length === 0) {
          Alert.alert(
            'No Plants Found',
            `No plants found within ${radius}km of this location. Try increasing the search radius.`,
            [{ text: 'OK' }]
          );
        }
      } else {
        setMapProducts([]);
        setNearbyProducts([]);
        setShowResults(true);
      }

      setIsLoading(false);
      setSearchingLocation(false);
    } catch (err) {
      console.error('Error loading nearby products:', err);
      setError('Failed to load products. Please try again.');
      setIsLoading(false);
      setSearchingLocation(false);
    }
  };

  // Handle product selection
  const handleProductSelect = (productId) => {
    // Find selected product
    const product = mapProducts.find(p => p.id === productId || p._id === productId);
    
    if (product) {
      // Set selected product for highlighting
      setSelectedProduct(product);
      
      // Navigate to plant detail
      navigation.navigate('PlantDetail', { plantId: productId });
    }
  };

  // Get current location
  const handleGetCurrentLocation = async () => {
    try {
      setIsLoading(true);
      setSearchingLocation(true);

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
        setIsLoading(false);
        setSearchingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      const { latitude, longitude } = location.coords;

      try {
        // Reverse geocode to get address details
        const addressData = await reverseGeocode(latitude, longitude);

        const locationData = {
          latitude,
          longitude,
          formattedAddress: addressData.formattedAddress,
          city: addressData.city || 'Current Location',
        };

        setSelectedLocation(locationData);
        loadNearbyProducts(locationData, searchRadius);
      } catch (geocodeError) {
        console.error('Geocoding error:', geocodeError);
        // If geocoding fails, still use the coordinates
        const locationData = {
          latitude,
          longitude,
          formattedAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          city: 'Current Location',
        };

        setSelectedLocation(locationData);
        loadNearbyProducts(locationData, searchRadius);
      }
    } catch (err) {
      console.error('Error getting current location:', err);
      Alert.alert('Location Error', 'Could not get your current location. Please try again later.');
      setIsLoading(false);
      setSearchingLocation(false);
    }
  };

  // Toggle sort order
  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'nearest' ? 'farthest' : 'nearest';
    setSortOrder(newOrder);
    
    // Re-sort products
    const sorted = sortProductsByDistance(nearbyProducts, newOrder === 'nearest');
    setMapProducts(sorted);
    setNearbyProducts(sorted);
  };

  // Toggle view mode between map and list
  const toggleViewMode = () => {
    setViewMode(viewMode === 'map' ? 'list' : 'map');
  };

  // Sort products by distance
  const sortProductsByDistance = (productList, ascending = true) => {
    return [...productList].sort((a, b) => {
      const distA = a.distance || 0;
      const distB = b.distance || 0;
      return ascending ? distA - distB : distB - distA;
    });
  };

  // Handle map click
  const handleMapPress = (coordinates) => {
    if (coordinates?.latitude && coordinates?.longitude) {
      setSelectedLocation({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        formattedAddress: `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`,
        city: 'Selected Location',
      });
      
      // Load nearby products with the new location
      loadNearbyProducts(coordinates, searchRadius);
    }
  };

  // Render loading state
  if (isKeyLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Map View"
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          onNotificationsPress={() => navigation.navigate('Messages')}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading map configuration...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title={selectedLocation?.city ? `Plants near ${selectedLocation.city}` : "Map View"}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />

      <View style={styles.mapContainer}>
        {/* Map View */}
        {viewMode === 'map' && (
          <>
            {isLoading && searchingLocation ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loadingText}>Finding plants nearby...</Text>
              </View>
            ) : error ? (
              <View style={styles.centerContainer}>
                <MaterialIcons name="error-outline" size={48} color="#f44336" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => selectedLocation && loadNearbyProducts(selectedLocation, searchRadius)}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <CrossPlatformAzureMapView
                ref={mapRef}
                products={mapProducts}
                onSelectProduct={handleProductSelect}
                initialRegion={
                  selectedLocation
                    ? {
                        latitude: selectedLocation.latitude,
                        longitude: selectedLocation.longitude,
                        zoom: 12,
                      }
                    : undefined
                }
                showControls={true}
                azureMapsKey={azureMapsKey}
                searchRadius={searchRadius}
                onMapPress={handleMapPress}
              />
            )}
          </>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <FlatList
            ref={listRef}
            data={nearbyProducts}
            renderItem={({ item }) => (
              <PlantCard 
                plant={item} 
                showActions={true} 
                layout="list"
              />
            )}
            keyExtractor={(item) => item.id || item._id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              isLoading ? (
                <View style={styles.emptyListContainer}>
                  <ActivityIndicator size="large" color="#4CAF50" />
                  <Text style={styles.loadingText}>Loading plants...</Text>
                </View>
              ) : (
                <View style={styles.emptyListContainer}>
                  <MaterialIcons name="eco" size={48} color="#ccc" />
                  <Text style={styles.emptyListText}>
                    No plants found in this area
                  </Text>
                </View>
              )
            }
          />
        )}

        {/* Search Box */}
        <MapSearchBox 
          onLocationSelect={handleLocationSelect} 
          azureMapsKey={azureMapsKey}
        />

        {/* View Toggle */}
        {showResults && nearbyProducts.length > 0 && (
          <TouchableOpacity
            style={styles.viewToggleButton}
            onPress={toggleViewMode}
          >
            <MaterialIcons 
              name={viewMode === 'map' ? 'view-list' : 'map'} 
              size={22} 
              color="#fff" 
            />
            <Text style={styles.viewToggleText}>
              {viewMode === 'map' ? 'List View' : 'Map View'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Radius Control */}
        {selectedLocation && viewMode === 'map' && radiusVisible && (
          <View style={styles.radiusControlContainer}>
            <RadiusControl
              radius={searchRadius}
              onRadiusChange={handleRadiusChange}
              onApply={handleApplyRadius}
            />

            {/* Sorting and Results Count */}
            {nearbyProducts.length > 0 && (
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsText}>
                  Found {nearbyProducts.length} plants within {searchRadius} km
                </Text>
                <TouchableOpacity
                  style={styles.sortButton}
                  onPress={toggleSortOrder}
                >
                  <MaterialIcons 
                    name={sortOrder === 'nearest' ? 'arrow-upward' : 'arrow-downward'} 
                    size={16} 
                    color="#fff" 
                  />
                  <Text style={styles.sortButtonText}>
                    {sortOrder === 'nearest' ? 'Nearest First' : 'Farthest First'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Hide radius control button */}
            <TouchableOpacity 
              style={styles.hideButton}
              onPress={() => setRadiusVisible(false)}
            >
              <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        )}
        
        {/* Show radius control button when hidden */}
        {selectedLocation && viewMode === 'map' && !radiusVisible && (
          <TouchableOpacity 
            style={styles.showRadiusButton}
            onPress={() => setRadiusVisible(true)}
          >
            <MaterialIcons name="tune" size={20} color="#fff" />
            <Text style={styles.showRadiusText}>Radius: {searchRadius}km</Text>
          </TouchableOpacity>
        )}

        {/* Use Current Location button */}
        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={handleGetCurrentLocation}
          disabled={isLoading}
        >
          {isLoading && !searchingLocation ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="my-location" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  errorText: {
    color: '#f44336',
    textAlign: 'center',
    padding: 20,
    fontSize: 16,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  radiusControlContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxHeight: height * 0.5, // Maximum 50% of screen height
  },
  resultsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 8,
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  sortButtonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
  },
  currentLocationButton: {
    position: 'absolute',
    right: 10,
    bottom: 120,
    backgroundColor: '#4CAF50',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  viewToggleButton: {
    position: 'absolute',
    right: 70,
    bottom: 120,
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  viewToggleText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '500',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 300,
  },
  emptyListText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  hideButton: {
    position: 'absolute',
    top: 0,
    right: 16,
    padding: 5,
  },
  showRadiusButton: {
    position: 'absolute',
    bottom: 70,
    left: 10,
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  showRadiusText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '500',
  },
});

export default MapScreen;