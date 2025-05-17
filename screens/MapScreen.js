// screens/MapScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import MarketplaceHeader from '../components/MarketplaceHeader';
import CrossPlatformAzureMapView from '../components/CrossPlatformAzureMapView';
import MapSearchBox from '../components/MapSearchBox';
import RadiusControl from '../components/RadiusControl';
import { getNearbyProducts } from '../services/marketplaceApi';

const MapScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { products = [], initialLocation } = route.params || {};
  
  const [mapProducts, setMapProducts] = useState(products);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [searchRadius, setSearchRadius] = useState(10);
  
  useEffect(() => {
    if (products.length > 0) {
      setMapProducts(products);
    }
  }, [products]);
  
  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    if (location?.latitude && location?.longitude) {
      loadNearbyProducts(location, searchRadius);
    }
  };
  
  const handleRadiusChange = (radius) => {
    setSearchRadius(radius);
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      loadNearbyProducts(selectedLocation, radius);
    }
  };
  
  const loadNearbyProducts = async (location, radius) => {
    if (!location?.latitude || !location?.longitude) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await getNearbyProducts(
        location.latitude,
        location.longitude,
        radius
      );
      
      if (result && result.products) {
        setMapProducts(result.products);
      } else {
        setMapProducts([]);
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading nearby products:', err);
      setError('Failed to load products. Please try again.');
      setIsLoading(false);
    }
  };
  
  const handleProductSelect = (productId) => {
    navigation.navigate('PlantDetail', { plantId: productId });
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title="Map View"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        onNotificationsPress={() => navigation.navigate('Messages')}
      />
      
      <View style={styles.mapContainer}>
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <CrossPlatformAzureMapView
            products={mapProducts}
            onSelectProduct={handleProductSelect}
            initialRegion={
              selectedLocation
                ? {
                    latitude: selectedLocation.latitude,
                    longitude: selectedLocation.longitude,
                    zoom: 12
                  }
                : undefined
            }
            showControls={true}
          />
        )}
        
        <MapSearchBox onLocationSelect={handleLocationSelect} />
        
        {selectedLocation && (
          <View style={styles.radiusControlContainer}>
            <RadiusControl
              radius={searchRadius}
              onRadiusChange={handleRadiusChange}
              onApply={(radius) => handleRadiusChange(radius)}
            />
          </View>
        )}
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
  },
  radiusControlContainer: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    right: 10,
  },
});

export default MapScreen;