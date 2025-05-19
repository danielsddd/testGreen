// MapUtilities.js
import { Platform } from 'react-native';

export const sendMapMessage = (webViewRef, message) => {
  const messageString = JSON.stringify(message);
  
  try {
    if (Platform.OS === 'web') {
      const iframe = document.getElementById('azureMapsIframe');
      if (iframe?.contentWindow?.handleMessage) {
        iframe.contentWindow.handleMessage(messageString);
      } else {
        // Don't log warning for initial setup - it's expected that iframe might not be ready immediately
        const isInitialSetup = message.type === 'DRAW_RADIUS' || message.type === 'SHOW_MY_LOCATION';
        if (!isInitialSetup) {
          console.warn('Iframe or handleMessage not available');
        }
        
        // Queue the message to try again after a short delay
        setTimeout(() => {
          const iframe = document.getElementById('azureMapsIframe');
          if (iframe?.contentWindow?.handleMessage) {
            iframe.contentWindow.handleMessage(messageString);
          } 
        }, 1000);
      }
    } else if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `try { window.handleMessage(${JSON.stringify(messageString)}); } catch(e) { console.error('Error handling message:', e); } true;`
      );
    }
  } catch (error) {
    console.warn('Error sending map message:', error);
  }
};

export const updateMarkers = (webViewRef, products, mapReady) => {
  if (!mapReady || !products?.length) return;
  
  console.log('Sending products to map:', products.length);
  sendMapMessage(webViewRef, { type: 'UPDATE_PRODUCTS', products });
};

export const drawSearchRadius = (webViewRef, center, radiusKm, mapReady) => {
  if (!mapReady || !center) return;
  
  console.log(`Drawing radius circle: ${radiusKm}km at [${center.latitude}, ${center.longitude}]`);
  sendMapMessage(webViewRef, {
    type: 'DRAW_RADIUS',
    latitude: center.latitude,
    longitude: center.longitude,
    radius: radiusKm || 10 // Default to 10km if not specified
  });
};

export const showUserLocation = (webViewRef, location, mapReady) => {
  if (!mapReady || !location?.latitude || !location?.longitude) return;
  
  console.log(`Showing user location at: ${location.latitude}, ${location.longitude}`);
  sendMapMessage(webViewRef, {
    type: 'SHOW_MY_LOCATION',
    latitude: location.latitude,
    longitude: location.longitude
  });
};