// components/AzureMapView.js - Updated with key fetching
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import CrossPlatformAzureMapView from './CrossPlatformAzureMapView';
import { getAzureMapsKey } from '../services/azureMapsService';

/**
 * AzureMapView — wrapper around CrossPlatformAzureMapView 
 * that works on both web and mobile platforms
 */
const AzureMapView = ({
  products = [],
  onSelectProduct,
  initialRegion = { latitude: 32.0853, longitude: 34.7818, zoom: 10 },
  showControls = true,
  mapStyle = 'road',
  onMapReady,
  azureMapsKey, // optional — will use a fallback
}) => {
  const [key, setKey] = useState(azureMapsKey);
  const [isLoading, setIsLoading] = useState(!azureMapsKey);
  const [error, setError] = useState(null);

  // Fetch the Azure Maps key if not provided
  useEffect(() => {
    if (!azureMapsKey) {
      const fetchKey = async () => {
        try {
          setIsLoading(true);
          const apiKey = await getAzureMapsKey();
          setKey(apiKey);
          setIsLoading(false);
        } catch (err) {
          console.error('Error fetching Azure Maps API key:', err);
          setError('Could not load maps configuration. Please try again later.');
          setIsLoading(false);
        }
      };
      
      fetchKey();
    }
  }, [azureMapsKey]);

  // Show loading spinner while fetching the key
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading map configuration...</Text>
      </View>
    );
  }

  // Show error message if key couldn't be fetched
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>Map Error</Text>
        <Text style={styles.errorDescription}>{error}</Text>
      </View>
    );
  }
  
  return (
    <CrossPlatformAzureMapView
      products={products}
      onSelectProduct={onSelectProduct}
      initialRegion={initialRegion}
      showControls={showControls}
      mapStyle={mapStyle}
      onMapReady={onMapReady}
      azureMapsKey={key}
    />
  );
};

AzureMapView.propTypes = {
  products: PropTypes.arrayOf(PropTypes.object),
  onSelectProduct: PropTypes.func,
  initialRegion: PropTypes.shape({
    latitude: PropTypes.number,
    longitude: PropTypes.number,
    zoom: PropTypes.number,
  }),
  showControls: PropTypes.bool,
  mapStyle: PropTypes.string,
  onMapReady: PropTypes.func,
  azureMapsKey: PropTypes.string,
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#4CAF50',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fafafa',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  errorDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default AzureMapView;