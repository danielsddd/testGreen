import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { generateMapHtml } from './MapHtml';
import { MARKER_ICONS } from './MapConfig';

const NativeMap = ({ 
  azureMapsKey, 
  initialRegion, 
  mapStyle, 
  onMapReady,
  onSelectProduct,
  onMapPress,
  setIsError,
  setErrorMessage,
  setIsLoading,
  setMapReady
}) => {
  const webViewRef = useRef(null);

  const handleWebViewMessage = (e) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      console.log('Mobile WebView message:', data.type);
      
      switch (data.type) {
        case 'MAP_READY':
          setIsLoading(false);
          setMapReady(true);
          onMapReady?.();
          break;
        case 'PIN_CLICKED':
          console.log('Pin clicked:', data.productId);
          onSelectProduct?.(data.productId);
          break;
        case 'MAP_CLICKED':
          onMapPress?.(data.coordinates);
          break;
        case 'MAP_ERROR':
        case 'ERROR':
          console.error('Map error:', data.message || data.error);
          setIsError(true);
          setErrorMessage(data.message || data.error || 'Unknown error');
          break;
        default:
          // Ignore other messages
      }
    } catch (err) {
      console.error('Error parsing WebView message:', err);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHtml(azureMapsKey, initialRegion, mapStyle, MARKER_ICONS) }}
        onMessage={handleWebViewMessage}
        onLoadEnd={() => {
          console.log('WebView loaded');
        }}
        onError={(e) => {
          console.error('WebView error:', e.nativeEvent);
          setIsLoading(false);
          setIsError(true);
          setErrorMessage(e.nativeEvent.description || 'WebView error');
        }}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        style={styles.map}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff',
    position: 'relative'
  },
  map: { 
    flex: 1 
  }
});

export default NativeMap;