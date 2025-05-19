// WebMap.js
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { generateMapHtml } from './MapHtml';
import { MARKER_ICONS } from './MapConfig';

const WebMap = ({ 
  azureMapsKey, 
  initialRegion, 
  mapStyle, 
  products,
  onMapReady,
  onSelectProduct,
  onMapPress,
  setIsError,
  setErrorMessage,
  setIsLoading,
  setMapReady
}) => {
  const mapDivRef = useRef(null);
  const iframeRef = useRef(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    if (!mapDivRef.current) return;

    // Check if iframe is loaded and available
    const checkIframeInterval = setInterval(() => {
      const iframe = document.getElementById('azureMapsIframe');
      if (iframe && iframe.contentWindow) {
        setIframeLoaded(true);
        clearInterval(checkIframeInterval);
      }
    }, 100);

    // Clean up interval
    return () => {
      clearInterval(checkIframeInterval);
    };
  }, []);

  // Initialize Azure Maps inside <iframe> once container ready
  useEffect(() => {
    if (!mapDivRef.current) return;

    const handleMsg = (event) => {
      if (!event.data) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        console.log('Map message received:', data.type);
        
        switch (data.type) {
          case 'MAP_READY':
            setIsLoading(false);
            setMapReady(true);
            onMapReady?.();
            if (products?.length) {
              const iframe = document.getElementById('azureMapsIframe');
              if (iframe?.contentWindow?.handleMessage) {
                iframe.contentWindow.handleMessage(
                  JSON.stringify({ type: 'UPDATE_PRODUCTS', products })
                );
              } else {
                console.warn('Iframe not ready for product update');
                // Try again after a short delay
                setTimeout(() => {
                  const iframe = document.getElementById('azureMapsIframe');
                  if (iframe?.contentWindow?.handleMessage) {
                    iframe.contentWindow.handleMessage(
                      JSON.stringify({ type: 'UPDATE_PRODUCTS', products })
                    );
                  }
                }, 500);
              }
            }
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
        console.error('Error handling map message:', err);
      }
    };

    window.addEventListener('message', handleMsg);
    
    // Also listen for the custom event
    const pinClickedHandler = (e) => {
      if (e.detail && e.detail.productId) {
        console.log('Pin clicked (custom event):', e.detail.productId);
        onSelectProduct?.(e.detail.productId);
      }
    };
    
    document.addEventListener('pinclicked', pinClickedHandler);

    return () => {
      window.removeEventListener('message', handleMsg);
      document.removeEventListener('pinclicked', pinClickedHandler);
    };
  }, [
    products, 
    onMapReady, 
    onSelectProduct, 
    onMapPress, 
    setIsError, 
    setErrorMessage,
    setIsLoading,
    setMapReady
  ]);

  return (
    <View style={styles.container} ref={mapDivRef}>
      <iframe
        id="azureMapsIframe"
        ref={iframeRef}
        title="AzureMap"
        srcDoc={generateMapHtml(azureMapsKey, initialRegion, mapStyle, MARKER_ICONS)}
        style={{ width: '100%', height: '100%', border: 'none' }}
        onLoad={() => {
          console.log('Iframe loaded');
          setIframeLoaded(true);
        }}
      />
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

export default WebMap;