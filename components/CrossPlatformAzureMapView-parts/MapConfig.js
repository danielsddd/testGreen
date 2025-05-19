// MapConfig.js - Configuration and utility functions for Azure Maps

export const MAP_STYLES = {
    road: 'road',
    satellite: 'satellite',
    grayscale: 'grayscale',
    dark: 'night',
    light: 'day'
  };
  
  export const DEFAULT_LOCATION = {
    latitude: 32.0853,
    longitude: 34.7818,
    zoom: 10
  };
  
  // SVG icons for map markers
  export const MARKER_ICONS = {
    plant: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><g fill="none"><path fill="#4CAF50" d="M14 0C6.268 0 0 6.268 0 14c0 5.025 2.65 9.428 6.625 11.9L14 36l7.375-10.1C25.35 23.428 28 19.025 28 14 28 6.268 21.732 0 14 0z"/><circle cx="14" cy="14" r="8" fill="#fff"/><path fill="#4CAF50" d="M17.8 10.3c-.316.3-3.9 3.8-3.9 6.5 0 1.545 1.355 2.8 2.9 2.8.5 0 .8-.4.8-.8 0-.4-.3-.8-.8-.8-.7 0-1.3-.6-1.3-1.3 0-1.8 2.684-4.5 2.9-4.7.3-.3.3-.9 0-1.2-.3-.4-.9-.4-1.2 0-.1.1-.2.2-.4.5m-5.6-1.6c-.3-.3-.8-.3-1.1 0-.3.3-.3.8 0 1.1.1.1 2.7 2.7 2.7 5.3 0 .7-.5 1.2-1.2 1.2-.4 0-.8.3-.8.8 0 .4.3.8.8.8 1.5 0 2.8-1.3 2.8-2.8-.1-3.2-3-5.8-3.2-6.4z"/></g></svg>`,
    business: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><g fill="none"><path fill="#3F51B5" d="M14 0C6.268 0 0 6.268 0 14c0 5.025 2.65 9.428 6.625 11.9L14 36l7.375-10.1C25.35 23.428 28 19.025 28 14 28 6.268 21.732 0 14 0z"/><circle cx="14" cy="14" r="8" fill="#fff"/><path fill="#3F51B5" d="M18.5 14.5h-4v4a.5.5 0 01-1 0v-4h-4a.5.5 0 010-1h4v-4a.5.5 0 011 0v4h4a.5.5 0 010 1z"/></g></svg>`,
    userLocation: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#4285f4" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="white"/></svg>`
  };
  
  // Helper functions for formatting data for the map
  export const prepareProductsForMap = (products) => {
    if (!Array.isArray(products) || !products.length) return [];
    
    return products.map(p => ({
      id: p.id || p._id || Math.random().toString(36).slice(2),
      title: p.title || p.name || 'Plant',
      price: typeof p.price === 'number' ? p.price.toFixed(2) : parseFloat(p.price || 0).toFixed(2),
      location: p.location?.city || p.city || 'Unknown location',
      distance: p.distance ? p.distance.toFixed(1) + ' km' : undefined,
      latitude: p.location?.latitude,
      longitude: p.location?.longitude,
      rating: p.rating || 0,
      sellerName: p.seller?.name || p.sellerName || 'Unknown Seller',
      isBusiness: p.seller?.isBusiness || p.isBusiness || false
    }));
  };
  
  export const hasLocationCoordinates = (location) => {
    return (
      location &&
      typeof location === 'object' &&
      typeof location.latitude === 'number' &&
      typeof location.longitude === 'number'
    );
  };