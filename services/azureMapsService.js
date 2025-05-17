// azure maps service
const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
export async function getAzureMapsKey() {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    const authToken = global.googleAuthToken || await AsyncStorage.getItem('googleAuthToken');
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) { headers['Authorization'] = `Bearer ${authToken}`; }
    if (userEmail) { headers['X-User-Email'] = userEmail; }
    const response = await fetch(`${API_BASE_URL}/marketplace/maps-config`, { method: 'GET', headers });
    if (!response.ok) { throw new Error(`Failed to get maps configuration: ${response.status}`); }
    const data = await response.json();
    if (!data || !data.azureMapsKey) { throw new Error('Invalid response: Maps API key not found'); }
    return data.azureMapsKey;
  } catch (error) {
    console.error('Error getting Azure Maps API key:', error);
    throw error;
  }
}
export async function geocodeAddress(address) {
  try {
    if (!address || address === 'Unknown location' || address.length < 3) {
      throw new Error('Invalid address for geocoding');
    }
    const cacheKey = `geocode_${address.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    try {
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) { return JSON.parse(cachedData); }
    } catch (e) { console.warn('Failed to check geocode cache:', e); }
    const userEmail = await AsyncStorage.getItem('userEmail');
    const authToken = global.googleAuthToken || await AsyncStorage.getItem('googleAuthToken');
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) { headers['Authorization'] = `Bearer ${authToken}`; }
    if (userEmail) { headers['X-User-Email'] = userEmail; }
    const response = await fetch(`${API_BASE_URL}/marketplace/geocode?address=${encodeURIComponent(address)}`, { method: 'GET', headers });
    if (!response.ok) { throw new Error(`Geocoding failed with status: ${response.status}`); }
    const data = await response.json();
    if (!data?.latitude || !data?.longitude) { throw new Error('No coordinates returned from geocoding service'); }
    try { await AsyncStorage.setItem(cacheKey, JSON.stringify(data)); } 
    catch (e) { console.warn('Failed to cache geocode result:', e); }
    return data;
  } catch (error) {
    console.error('Error geocoding address:', error);
    throw error;
  }
}
export async function getProductsWithLocation(options = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (options.category) queryParams.append('category', options.category);
    if (options.minPrice) queryParams.append('minPrice', options.minPrice);
    if (options.maxPrice) queryParams.append('maxPrice', options.maxPrice);
    queryParams.append('withLocation', 'true');
    const userEmail = await AsyncStorage.getItem('userEmail');
    const authToken = global.googleAuthToken || await AsyncStorage.getItem('googleAuthToken');
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) { headers['Authorization'] = `Bearer ${authToken}`; }
    if (userEmail) { headers['X-User-Email'] = userEmail; }
    const response = await fetch(`${API_BASE_URL}/productsWithLocation?${queryParams.toString()}`, { method: 'GET', headers });
    if (!response.ok) { throw new Error(`Failed to get products with location: ${response.status}`); }
    const data = await response.json();
    if (!data || !Array.isArray(data.products)) { throw new Error('Invalid response format from productsWithLocation endpoint'); }
    return data.products;
  } catch (error) {
    console.error('Error getting products with location:', error);
    throw error;
  }
}
export async function reverseGeocode(latitude, longitude) {
  try {
    const userEmail = await AsyncStorage.getItem('userEmail');
    const authToken = global.googleAuthToken || await AsyncStorage.getItem('googleAuthToken');
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) { headers['Authorization'] = `Bearer ${authToken}`; }
    if (userEmail) { headers['X-User-Email'] = userEmail; }
    const response = await fetch(`${API_BASE_URL}/reverseGeocode?lat=${latitude}&lon=${longitude}`, { method: 'GET', headers });
    if (!response.ok) { throw new Error(`Reverse geocoding failed: ${response.status}`); }
    const data = await response.json();
    if (!data?.address) { throw new Error('No address returned from reverse geocoding'); }
    return data.address;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    throw error;
  }
}
export async function getNearbyProducts(latitude, longitude, radius = 10, category = null, sortBy = 'distance') {
  try {
    let endpoint = `${API_BASE_URL}/marketplace/nearbyProducts?lat=${latitude}&lon=${longitude}&radius=${radius}`;
    if (category && category !== 'All') { endpoint += `&category=${encodeURIComponent(category)}`; }
    if (sortBy) { endpoint += `&sortBy=${encodeURIComponent(sortBy)}`; }
    const userEmail = await AsyncStorage.getItem('userEmail');
    const authToken = global.googleAuthToken || await AsyncStorage.getItem('googleAuthToken');
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) { headers['Authorization'] = `Bearer ${authToken}`; }
    if (userEmail) { headers['X-User-Email'] = userEmail; }
    console.log(`Fetching nearby products with URL: ${endpoint}`);
    const response = await fetch(endpoint, { method: 'GET', headers });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get nearby products: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    console.log(`Got nearby products response with ${data?.products?.length || 0} products`);
    if (!data?.products || !Array.isArray(data.products)) { throw new Error('Invalid response format from nearbyProducts'); }
    return data;
  } catch (error) {
    console.error('Error getting nearby products:', error);
    throw error;
  }
}
export default {
  geocodeAddress,
  getProductsWithLocation,
  reverseGeocode,
  getNearbyProducts,
  getAzureMapsKey
};