import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Platform, Text, ActivityIndicator, FlatList, TouchableOpacity, Image } from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';

const AzureMapView = ({ products, onSelectProduct }) => {
  const webViewRef = useRef(null);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (webViewRef.current && products && products.length > 0) {
      const message = JSON.stringify({ type: 'UPDATE_PRODUCTS', products });
      const timer = setTimeout(() => {
        webViewRef.current?.postMessage(message);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [products]);

  // Web fallback view
  if (Platform.OS === 'web') {
    if (!products || products.length === 0) {
      return (
        <View style={styles.fallbackContainer}>
          <MaterialIcons name="map" size={48} color="#aaa" />
          <Text style={styles.fallbackText}>No plant locations available to display on map.</Text>
        </View>
      );
    }

    return (
      <View style={styles.webMapContainer}>
        <View style={styles.webMapHeader}>
          <MaterialIcons name="map" size={28} color="#4CAF50" />
          <Text style={styles.webMapTitle}>Plant Locations</Text>
        </View>

        <Text style={styles.webMapSubtitle}>
          Interactive map view is currently optimized for mobile.
          Here are the available plants by location:
        </Text>

        <FlatList
          data={groupProductsByLocation(products)}
          keyExtractor={(item) => item.location}
          renderItem={({ item }) => (
            <View style={styles.locationGroup}>
              <View style={styles.locationHeader}>
                <MaterialIcons name="place" size={20} color="#4CAF50" />
                <Text style={styles.locationName}>{item.location}</Text>
                <Text style={styles.locationCount}>
                  {item.products.length} {item.products.length === 1 ? 'Plant' : 'Plants'}
                </Text>
              </View>
              <FlatList
                data={item.products}
                keyExtractor={(product) => product.id || product._id}
                renderItem={({ item: product }) => (
                  <TouchableOpacity
                    style={styles.productItem}
                    onPress={() => onSelectProduct?.(product.id || product._id)}
                  >
                    <Image
                      source={{ uri: product.image || product.imageUrl || 'https://via.placeholder.com/50?text=Plant' }}
                      style={styles.productImage}
                    />
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {product.title || product.name}
                      </Text>
                      <Text style={styles.productPrice}>
                        ${typeof product.price === 'number' ? product.price.toFixed(2) : product.price}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color="#ccc" />
                  </TouchableOpacity>
                )}
                scrollEnabled={false}
              />
            </View>
          )}
        />
      </View>
    );
  }

  // Mobile + Map Error State
  if (!products || products.length === 0) {
    return (
      <View style={styles.fallbackContainer}>
        <MaterialIcons name="map" size={48} color="#aaa" />
        <Text style={styles.fallbackText}>No plant locations available to display on map.</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.fallbackContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>Failed to load map</Text>
        <Text style={styles.errorDetailText}>{errorMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: '...' /* your existing HTML stays */ }}
        style={styles.map}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type === 'MAP_READY') setIsLoading(false);
            else if (message.type === 'PIN_CLICKED') onSelectProduct?.(message.productId);
            else if (message.type === 'ERROR') console.error('WebView error:', message.message);
          } catch (e) {
            console.error('WebView parse error:', e);
          }
        }}
        onError={(e) => {
          setIsError(true);
          setErrorMessage(e.nativeEvent?.description || 'Map failed to load.');
        }}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        startInLoadingState
        scalesPageToFit
      />

      {isLoading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loaderText}>Loading map...</Text>
        </View>
      )}
    </View>
  );
};

// Utility: Group products by location
const groupProductsByLocation = (products) => {
  const grouped = {};
  for (const product of products) {
    let key = product?.location?.city || product?.city || 'Unknown location';
    if (!grouped[key]) grouped[key] = { location: key, products: [] };
    grouped[key].products.push(product);
  }
  return Object.values(grouped).sort((a, b) => a.location.localeCompare(b.location));
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', position: 'relative' },
  map: { flex: 1 },
  fallbackContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  fallbackText: { fontSize: 16, color: '#666', textAlign: 'center', marginTop: 16, maxWidth: 250 },
  errorText: { fontSize: 18, color: '#d32f2f', fontWeight: 'bold', textAlign: 'center', marginTop: 16 },
  errorDetailText: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },
  loaderContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center',
  },
  loaderText: { marginTop: 12, fontSize: 16, color: '#4CAF50' },

  // Web fallback styles
  webMapContainer: { flex: 1, backgroundColor: '#fff', padding: 16 },
  webMapHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  webMapTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginLeft: 12 },
  webMapSubtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  locationGroup: {
    marginBottom: 24, borderWidth: 1, borderColor: '#eee',
    borderRadius: 8, overflow: 'hidden',
  },
  locationHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, backgroundColor: '#f9f9f9',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  locationName: { fontSize: 16, fontWeight: '600', color: '#333', flex: 1, marginLeft: 8 },
  locationCount: { fontSize: 14, color: '#666' },
  productItem: {
    flexDirection: 'row', padding: 12, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  productImage: {
    width: 50, height: 50, borderRadius: 4, backgroundColor: '#f0f0f0',
  },
  productInfo: { flex: 1, marginLeft: 12 },
  productName: { fontSize: 16, color: '#333', marginBottom: 4 },
  productPrice: { fontSize: 14, fontWeight: '600', color: '#4CAF50' },
});

export default AzureMapView;
