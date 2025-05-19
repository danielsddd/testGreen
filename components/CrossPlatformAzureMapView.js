import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { getAzureMapsKey } from '../services/azureMapsService';
import { DEFAULT_LOCATION, MAP_STYLES, prepareProductsForMap } from './CrossPlatformAzureMapView-parts/MapConfig';
import { KeyMissingError, LoadingState, GeneralError } from './CrossPlatformAzureMapView-parts/ErrorStates';
import WebMap from './CrossPlatformAzureMapView-parts/WebMap';
import NativeMap from './CrossPlatformAzureMapView-parts/NativeMap';
import { updateMarkers, drawSearchRadius, showUserLocation } from './CrossPlatformAzureMapView-parts/MapUtilities';

/**
 * Enhanced Cross-platform Azure Map component
 * Works on both web and mobile platforms
 * Improved pin visualization and circle radius display
 */
const CrossPlatformAzureMapView = ({
  products = [],
  onSelectProduct,
  initialRegion = DEFAULT_LOCATION,
  showControls = true,
  mapStyle = MAP_STYLES.road,
  onMapReady,
  searchRadius,
  onMapPress,
  azureMapsKey: providedKey = null, // Allow direct key prop but fall back to service
  useCustomPin = false,
  showMyLocation = false,
  myLocation = null
}) => {
  const webViewRef = useRef(null);
  
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [azureMapsKey, setAzureMapsKey] = useState(providedKey);
  const [isKeyLoading, setIsKeyLoading] = useState(!providedKey);

  // Load Azure Maps key if not provided as prop
  useEffect(() => {
    if (providedKey) {
      setAzureMapsKey(providedKey);
      setIsKeyLoading(false);
      return;
    }
    
    const loadKey = async () => {
      try {
        setIsKeyLoading(true);
        const key = await getAzureMapsKey();
        console.log(`Azure Maps key loaded successfully`);
        setAzureMapsKey(key);
        setIsKeyLoading(false);
      } catch (err) {
        console.error('Error loading Azure Maps key:', err);
        setIsError(true);
        setErrorMessage('Failed to load map configuration. Please try again later.');
        setIsKeyLoading(false);
      }
    };
    
    loadKey();
  }, [providedKey]);

  // Effect to draw search radius when it changes
  useEffect(() => {
    if (mapReady && searchRadius) {
      // Add a small delay to ensure the iframe is fully initialized
      const timer = setTimeout(() => {
        drawSearchRadius(
          webViewRef,
          initialRegion,
          searchRadius,
          mapReady
        );
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [searchRadius, mapReady, initialRegion]);
  
  

  // Effect to show user's current location
  useEffect(() => {
    if (mapReady && showMyLocation && myLocation) {
      // Add a small delay to ensure the iframe is fully initialized
      const timer = setTimeout(() => {
        showUserLocation(
          webViewRef,
          myLocation,
          mapReady
        );
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [myLocation, showMyLocation, mapReady]);

  // Send marker updates after first MAP_READY
  useEffect(() => {
    if (mapReady && products?.length) {
      const formattedProducts = prepareProductsForMap(products);
      updateMarkers(webViewRef, formattedProducts, mapReady);
    }
  }, [products, mapReady]);

  // If Azure Maps key is missing, show error
  if (!azureMapsKey) {
    return <KeyMissingError />;
  }
  
  // If error occurred, show error state
  if (isError) {
    return <GeneralError message={errorMessage} />;
  }

  // Render platform-specific map
  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <WebMap
          azureMapsKey={azureMapsKey}
          initialRegion={initialRegion}
          mapStyle={mapStyle}
          products={products}
          onMapReady={onMapReady}
          onSelectProduct={onSelectProduct}
          onMapPress={onMapPress}
          setIsError={setIsError}
          setErrorMessage={setErrorMessage}
          setIsLoading={setIsLoading}
          setMapReady={setMapReady}
          webViewRef={webViewRef}
        />
      ) : (
        <NativeMap
          azureMapsKey={azureMapsKey}
          initialRegion={initialRegion}
          mapStyle={mapStyle}
          onMapReady={onMapReady}
          onSelectProduct={onSelectProduct}
          onMapPress={onMapPress}
          setIsError={setIsError}
          setErrorMessage={setErrorMessage}
          setIsLoading={setIsLoading}
          setMapReady={setMapReady}
          webViewRef={webViewRef}
        />
      )}
      
      {isLoading && <LoadingState />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff',
    position: 'relative'
  }
});

export default CrossPlatformAzureMapView;