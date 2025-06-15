// FIXED LocationPicker - Real GPS + Azure Maps Search API + Fixed Timestamp
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Modal,
  Dimensions,
  Linking
} from 'react-native';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../services/theme';
import { getAzureMapsKey, geocodeAddress, reverseGeocode } from '../services/azureMapsService';
import CrossPlatformAzureMapView from './CrossPlatformAzureMapView';
// Import ToastMessage component
import ToastMessage from './ToastMessage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const LocationPicker = ({ 
  value, 
  onChange, 
  placeholder = "Enter your business address",
  autoCloseOnConfirm = true,
  showToastFeedback = true 
}) => {
  const [showMap, setShowMap] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 32.0853, // Default to Tel Aviv
    longitude: 34.7818,
    zoom: 10,
  });
  const [selectedLocation, setSelectedLocation] = useState(value || null);
  const mapRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Manual address entry fields
  const [manualAddress, setManualAddress] = useState({
    city: '',
    street: '',
    streetNumber: '',
    postalCode: ''
  });
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  // Azure Maps integration state
  const [azureMapsKey, setAzureMapsKey] = useState(null);
  const [isKeyLoading, setIsKeyLoading] = useState(true);

  // NEW: State for street suggestions
  const [streetSuggestions, setStreetSuggestions] = useState([]);
  const [showStreetSuggestions, setShowStreetSuggestions] = useState(false);
  const streetSearchTimeoutRef = useRef(null);

  // Add toast state for feedback messages
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info'
  });

  // Show toast message
  const showToast = (message, type = 'info') => {
    if (showToastFeedback) {
      setToast({
        visible: true,
        message,
        type
      });
    }
  };

  // Hide toast message
  const hideToast = () => {
    setToast(prev => ({
      ...prev,
      visible: false
    }));
  };

  // Load Azure Maps key
  useEffect(() => {
    const loadAzureMapsKey = async () => {
      try {
        const key = await getAzureMapsKey();
        setAzureMapsKey(key);
        console.log('✅ Azure Maps key loaded successfully');
      } catch (err) {
        console.warn('⚠️ Azure Maps key failed to load:', err);
      } finally {
        setIsKeyLoading(false);
      }
    };
    
    loadAzureMapsKey();
  }, []);

  useEffect(() => {
    if (value) {
      setSelectedLocation(value);
      setSearchText(value.formattedAddress || '');
      if (value.latitude && value.longitude) {
        setMapRegion({
          latitude: value.latitude,
          longitude: value.longitude,
          zoom: 14,
        });
      }
    }
  }, [value]);

  // FIXED: Real GPS location with proper browser geolocation and timestamp handling
  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      console.log('🎯 Getting REAL GPS location...');

      // Check if running on web - use browser geolocation API
      if (Platform.OS === 'web') {
        if (!navigator.geolocation) {
          throw new Error('Geolocation is not supported by this browser');
        }

        console.log('🌐 Using browser geolocation API...');
        
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: true,
              timeout: 30000,
              maximumAge: 0
            }
          );
        });

        const { latitude, longitude, accuracy } = position.coords;
        const timestamp = position.timestamp || Date.now();
        
        console.log(`✅ Browser GPS location acquired!`);
        console.log(`📍 Coordinates: ${latitude}, ${longitude}`);
        console.log(`🎯 Accuracy: ${accuracy ? `±${accuracy.toFixed(1)}m` : 'Unknown'}`);
        
        await processGPSLocation(latitude, longitude, accuracy, timestamp);
        
      } else {
        // Mobile app - use Expo Location
        console.log('📱 Using mobile device GPS...');
        
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Location Permission Required',
            'Please enable location access to get your current location.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() }
            ]
          );
          return;
        }

        const highAccuracyOptions = {
          accuracy: Location.Accuracy.BestForNavigation,
          timeout: 30000,
          maximumAge: 0,
        };

        const location = await Location.getCurrentPositionAsync(highAccuracyOptions);
        const { latitude, longitude, accuracy, timestamp } = location.coords;
        
        console.log(`✅ Mobile GPS location acquired!`);
        console.log(`📍 Coordinates: ${latitude}, ${longitude}`);
        console.log(`🎯 Accuracy: ${accuracy ? `±${accuracy.toFixed(1)}m` : 'Unknown'}`);
        
        await processGPSLocation(latitude, longitude, accuracy, timestamp);
      }
      
    } catch (error) {
      console.error(`❌ GPS location error:`, error);
      
      let errorMessage = 'Unable to get your current location.';
      
      if (error.code === 1) { // PERMISSION_DENIED
        errorMessage = 'Location access denied. Please allow location access and try again.';
      } else if (error.code === 2) { // POSITION_UNAVAILABLE
        errorMessage = 'Location information unavailable. Please check your GPS settings.';
      } else if (error.code === 3) { // TIMEOUT
        errorMessage = 'Location request timed out. Please try again.';
      }
      
      Alert.alert('Location Error', errorMessage);
    } finally {
      setLocationLoading(false);
    }
  };

  // FIXED: Process GPS location with proper timestamp handling
  const processGPSLocation = async (latitude, longitude, accuracy, timestamp) => {
    try {
      // FIXED: Proper timestamp handling - ensure it's a valid number
      const locationTimestamp = typeof timestamp === 'number' && timestamp > 0 ? timestamp : Date.now();
      const locationDate = new Date(locationTimestamp);
      
      // Validate the date
      if (isNaN(locationDate.getTime())) {
        console.warn('⚠️ Invalid timestamp, using current time');
        const now = Date.now();
        const validDate = new Date(now);
        console.log(`⏰ Using timestamp: ${validDate.toLocaleString()}`);
      } else {
        console.log(`⏰ GPS timestamp: ${locationDate.toLocaleString()}`);
      }

      // Verify location freshness
      const locationAge = Date.now() - locationTimestamp;
      if (locationAge > 60000) {
        console.warn('⚠️ Location might be cached (older than 1 minute)');
      } else {
        console.log('✅ Fresh GPS location confirmed!');
      }

      // Use backend reverse geocoding to get address
      let addressData;
      try {
        console.log('🗺️ Converting GPS coordinates to address...');
        addressData = await reverseGeocode(latitude, longitude);
        console.log('✅ Address resolved from GPS location');
      } catch (error) {
        console.error('❌ Reverse geocoding failed:', error);
        
        // Fallback with coordinates only
        addressData = {
          latitude,
          longitude,
          formattedAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          city: 'GPS Location',
          country: 'Israel',
          timestamp: new Date(locationTimestamp).toISOString(),
          accuracy: accuracy ? `±${accuracy.toFixed(1)}m` : 'Unknown'
        };
      }

      // Add GPS metadata
      addressData.isGPSLocation = true;
      addressData.locationTimestamp = locationTimestamp;
      addressData.locationAccuracy = accuracy;
      addressData.locationAge = Date.now() - locationTimestamp;

      setSelectedLocation(addressData);
      setSearchText(addressData.formattedAddress);
      setCurrentLocation({ 
        latitude, 
        longitude, 
        timestamp: locationTimestamp, 
        accuracy,
        isGPS: true 
      });
      
      // Update map region to GPS location
      setMapRegion({
        latitude,
        longitude,
        zoom: 16,
      });
      
      onChange(addressData);
      
      console.log(`🎯 GPS location successfully set!`);
      
    } catch (error) {
      console.error('❌ Error processing GPS location:', error);
      throw error;
    }
  };

  // ENHANCED: Azure Maps city search instead of hardcoded list
  const searchCities = async (query) => {
    if (!query || query.length < 2) {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
      return;
    }

    try {
      if (!azureMapsKey) {
        console.warn('⚠️ Azure Maps key not available for city search');
        return;
      }

      console.log('🔍 Searching Israeli cities with Azure Maps:', query);
      
      // Use Azure Maps Search API directly for city suggestions
      const response = await fetch(
        `https://atlas.microsoft.com/search/address/json?` +
        `api-version=1.0&subscription-key=${azureMapsKey}` +
        `&typeahead=true&limit=8&countrySet=IL&language=en-US` +
        `&entityType=Municipality&query=${encodeURIComponent(query + ', Israel')}`
      );

      if (response.ok) {
        const data = await response.json();
        const cities = data.results?.map(result => ({
          name: result.address?.municipality || result.address?.freeformAddress,
          formattedAddress: result.address?.freeformAddress
        })).filter(city => city.name) || [];

        setCitySuggestions(cities.slice(0, 8));
        setShowCitySuggestions(cities.length > 0);
        console.log(`✅ Found ${cities.length} cities`);
      } else {
        console.warn('⚠️ Azure Maps city search failed:', response.status);
      }
    } catch (error) {
      console.warn('⚠️ City search error:', error);
    }
  };

  // ENHANCED: Filter cities using Azure Maps
  const filterCities = (text) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchCities(text);
    }, 300);
  };

  // ENHANCED: Azure Maps street search within selected city
  const searchStreets = async (streetQuery, cityName) => {
    if (!streetQuery || streetQuery.length < 2 || !cityName) {
      setStreetSuggestions([]);
      setShowStreetSuggestions(false);
      return;
    }

    try {
      if (!azureMapsKey) {
        console.warn('⚠️ Azure Maps key not available for street search');
        return;
      }

      console.log(`🔍 Searching streets in ${cityName} with Azure Maps:`, streetQuery);
      
      // Use Azure Maps Search API for street-level suggestions within specific city
      const searchQuery = `${streetQuery}, ${cityName}, Israel`;
      const response = await fetch(
        `https://atlas.microsoft.com/search/address/json?` +
        `api-version=1.0&subscription-key=${azureMapsKey}` +
        `&typeahead=true&limit=8&countrySet=IL&language=en-US` +
        `&entityType=Address,Street&query=${encodeURIComponent(searchQuery)}`
      );

      if (response.ok) {
        const data = await response.json();
        const streets = data.results?.map(result => ({
          streetName: result.address?.streetName,
          streetNumber: result.address?.streetNumber,
          formattedAddress: result.address?.freeformAddress,
          municipality: result.address?.municipality,
          coordinates: result.position ? {
            latitude: result.position.lat,
            longitude: result.position.lon
          } : null
        })).filter(street => street.streetName) || [];

        setStreetSuggestions(streets.slice(0, 8));
        setShowStreetSuggestions(streets.length > 0);
        console.log(`✅ Found ${streets.length} streets in ${cityName}`);
      } else {
        console.warn('⚠️ Azure Maps street search failed:', response.status);
        setStreetSuggestions([]);
        setShowStreetSuggestions(false);
      }
    } catch (error) {
      console.warn('⚠️ Street search error:', error);
      setStreetSuggestions([]);
      setShowStreetSuggestions(false);
    }
  };

  // ENHANCED: Filter streets using Azure Maps within selected city
  const filterStreets = (text) => {
    if (streetSearchTimeoutRef.current) {
      clearTimeout(streetSearchTimeoutRef.current);
    }
    
    streetSearchTimeoutRef.current = setTimeout(() => {
      searchStreets(text, manualAddress.city);
    }, 300);
  };

  // Search for locations with Azure Maps suggestions
  const searchLocation = async (text) => {
    if (!text || text.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Searching locations with Azure Maps:', text);
      
      if (!azureMapsKey) {
        console.log('🔄 Falling back to backend geocoding...');
        // Fallback to backend
        const result = await geocodeAddress(text);
        if (result) {
          setSuggestions([{
            latitude: result.latitude,
            longitude: result.longitude,
            formattedAddress: result.formattedAddress,
            city: result.city,
            street: result.street,
            country: result.country || 'Israel'
          }]);
          setShowSuggestions(true);
        }
        return;
      }

      // Use Azure Maps Search API directly for better suggestions
      const searchQuery = text.toLowerCase().includes('israel') ? text : `${text}, Israel`;
      const response = await fetch(
        `https://atlas.microsoft.com/search/address/json?` +
        `api-version=1.0&subscription-key=${azureMapsKey}` +
        `&typeahead=true&limit=5&countrySet=IL&language=en-US` +
        `&query=${encodeURIComponent(searchQuery)}`
      );

      if (response.ok) {
        const data = await response.json();
        const locations = data.results?.map(result => ({
          latitude: result.position?.lat,
          longitude: result.position?.lon,
          formattedAddress: result.address?.freeformAddress,
          city: result.address?.municipality || result.address?.localName,
          street: result.address?.streetName,
          country: result.address?.country || 'Israel'
        })).filter(loc => loc.latitude && loc.longitude) || [];

        setSuggestions(locations);
        setShowSuggestions(locations.length > 0);
        console.log(`✅ Found ${locations.length} location suggestions`);
      } else {
        console.log('🔄 Azure Maps direct search failed, using backend...');
        // Fallback to backend
        const result = await geocodeAddress(text);
        if (result) {
          setSuggestions([result]);
          setShowSuggestions(true);
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Location search failed:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  };

  // ENHANCED: Validate house number format (Israeli standards)
  const validateHouseNumber = (houseNumber) => {
    if (!houseNumber.trim()) return true; // Optional field
    
    // Israeli house number patterns: 123, 123A, 123/5, 123-125, 123א (Hebrew letters)
    const israeliHousePattern = /^[0-9]+([A-Za-z\u0590-\u05FF]?|\/[0-9]+|-[0-9]+)?$/;
    return israeliHousePattern.test(houseNumber.trim());
  };

  // ENHANCED: Format house number input
  const formatHouseNumber = (text) => {
    // Remove invalid characters but keep numbers, letters, /, -
    return text.replace(/[^0-9A-Za-z\u0590-\u05FF\/-]/g, '');
  };

  // Debounced search for automated suggestions
  const handleSearchTextChange = (text) => {
    setSearchText(text);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchLocation(text);
    }, 500);
  };

  // Select a suggestion from dropdown
  const selectSuggestion = (suggestion) => {
    const locationData = {
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      city: suggestion.city || '',
      street: suggestion.street || '',
      formattedAddress: suggestion.formattedAddress,
      country: suggestion.country || 'Israel',
    };
    
    setSelectedLocation(locationData);
    setSearchText(suggestion.formattedAddress);
    setShowSuggestions(false);
    setSuggestions([]);
    onChange(locationData);
    
    // Update map region
    setMapRegion({
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      zoom: 14,
    });
  };

  // Handle map location selection using your backend
  const handleLocationSelect = async (location) => {
    try {
      setLoading(true);
      
      console.log('🗺️ Using backend reverse geocoding for map selection');
      const addressData = await reverseGeocode(location.latitude, location.longitude);
      
      if (addressData) {
        setSelectedLocation(addressData);
        setSearchText(addressData.formattedAddress);
        onChange(addressData);
        console.log('✅ Map location selected successfully');
      }
    } catch (error) {
      console.error('❌ Map location select error:', error);
      
      // Fallback to coordinates
      const fallbackData = {
        latitude: location.latitude,
        longitude: location.longitude,
        formattedAddress: `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
        city: 'Selected Location',
        country: 'Israel'
      };
      
      setSelectedLocation(fallbackData);
      setSearchText(fallbackData.formattedAddress);
      onChange(fallbackData);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Handle manual address entry
  const handleManualAddressSubmit = async () => {
    const { city, street, streetNumber } = manualAddress;
    
    if (!city.trim()) {
      Alert.alert('Missing Information', 'Please enter a city');
      return;
    }
    
    try {
      setLoading(true);
      
      // Construct full address for geocoding
      let fullAddress = city.trim();
      if (street.trim()) {
        fullAddress += `, ${street.trim()}`;
        if (streetNumber.trim()) {
          fullAddress += ` ${streetNumber.trim()}`;
        }
      }
      fullAddress += ', Israel'; // Ensure it's in Israel
      
      console.log('🏠 Geocoding manual address:', fullAddress);
      
      // Use your backend geocoding
      const result = await geocodeAddress(fullAddress);
      
      if (result) {
        // Add manual entry flag
        result.isManualEntry = true;
        result.manualAddress = manualAddress;
        
        setSelectedLocation(result);
        setSearchText(result.formattedAddress);
        onChange(result);
        setShowManualEntry(false);
        
        // Clear manual form
        setManualAddress({
          city: '',
          street: '',
          streetNumber: '',
          postalCode: ''
        });
        
        console.log('✅ Manual address geocoded successfully');
        Alert.alert('Success', 'Address found and set successfully!');
      } else {
        Alert.alert('Address Not Found', 'Could not find this address. Please check the details and try again.');
      }
      
    } catch (error) {
      console.error('❌ Manual address error:', error);
      Alert.alert(
        'Geocoding Error', 
        'Unable to find this address. Please check the spelling and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Render loading indicator while Azure Maps key is loading
  if (isKeyLoading) {
    return (
      <View style={[styles.container]}>
        <Text style={styles.label}>Location</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading location service...</Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Search Input with automated suggestions */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={handleSearchTextChange}
          placeholder={placeholder}
          placeholderTextColor="#999"
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            // Delay hiding suggestions to allow selection
            setTimeout(() => setShowSuggestions(false), 200);
          }}
        />
        {loading && (
          <ActivityIndicator size="small" color="#216a94" style={styles.loadingIcon} />
        )}
      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionButtonsContainer}>
        {/* Current Location Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.currentLocationButton]}
          onPress={getCurrentLocation}
          disabled={locationLoading}
        >
          {locationLoading ? (
            <ActivityIndicator size="small" color="#216a94" />
          ) : (
            <>
              <MaterialIcons name="my-location" size={16} color="#216a94" />
              <Text style={styles.actionButtonText}>Current</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Manual Entry Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.manualEntryButton]}
          onPress={() => setShowManualEntry(true)}
        >
          <MaterialIcons name="edit-location" size={16} color="#FF6B35" />
          <Text style={[styles.actionButtonText, { color: '#FF6B35' }]}>Manual</Text>
        </TouchableOpacity>

        {/* Show Map Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.mapButton]}
          onPress={() => setShowMap(true)}
        >
          <MaterialIcons name="map" size={16} color="#4CAF50" />
          <Text style={[styles.actionButtonText, { color: '#4CAF50' }]}>Map</Text>
        </TouchableOpacity>
      </View>

      {/* Automated Address Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView style={styles.suggestionsList} keyboardShouldPersistTaps="handled">
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionItem}
                onPress={() => selectSuggestion(suggestion)}
              >
                <MaterialIcons name="location-on" size={20} color="#666" />
                <View style={styles.suggestionTextContainer}>
                  <Text style={styles.suggestionText}>{suggestion.formattedAddress}</Text>
                  {suggestion.city && (
                    <Text style={styles.suggestionSubtext}>{suggestion.city}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Selected Location Display */}
      {selectedLocation && (
        <View style={styles.selectedLocationContainer}>
          <MaterialIcons name="location-on" size={16} color="#4CAF50" />
          <View style={styles.selectedLocationTextContainer}>
            <Text style={styles.selectedLocationText} numberOfLines={2}>
              {selectedLocation.formattedAddress}
            </Text>
            {selectedLocation.latitude && selectedLocation.longitude && (
              <Text style={styles.coordinatesText}>
                {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
              </Text>
            )}
            {selectedLocation.isGPSLocation && (
              <Text style={styles.gpsLocationBadge}>📍 GPS Location</Text>
            )}
            {selectedLocation.isLiveLocation && (
              <Text style={styles.liveLocationBadge}>📍 Live Location</Text>
            )}
            {selectedLocation.isManualEntry && (
              <Text style={styles.manualEntryBadge}>✏️ Manual Entry</Text>
            )}
          </View>
        </View>
      )}

      {/* NEW: Manual Address Entry Modal */}
      <Modal
        visible={showManualEntry}
        animationType="slide"
        onRequestClose={() => setShowManualEntry(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Enter Address Manually</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowManualEntry(false)}
            >
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            {/* City Input with Azure Maps Autocomplete */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>City *</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  value={manualAddress.city}
                  onChangeText={(text) => {
                    setManualAddress({ ...manualAddress, city: text });
                    filterCities(text);
                  }}
                  placeholder="Start typing Israeli city name..."
                  placeholderTextColor="#999"
                  onFocus={() => {
                    if (citySuggestions.length > 0) {
                      setShowCitySuggestions(true);
                    }
                  }}
                />
              </View>
              
              {/* Azure Maps City Suggestions */}
              {showCitySuggestions && citySuggestions.length > 0 && (
                <View style={styles.citySuggestionsContainer}>
                  <ScrollView style={styles.citySuggestionsList} keyboardShouldPersistTaps="handled">
                    {citySuggestions.map((city, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.citySuggestionItem}
                        onPress={() => {
                          setManualAddress({ ...manualAddress, city: city.name });
                          setShowCitySuggestions(false);
                        }}
                      >
                        <MaterialIcons name="location-city" size={18} color="#666" />
                        <View style={styles.citySuggestionTextContainer}>
                          <Text style={styles.citySuggestionText}>{city.name}</Text>
                          {city.formattedAddress && city.formattedAddress !== city.name && (
                            <Text style={styles.citySuggestionSubtext}>{city.formattedAddress}</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* ENHANCED Street Input with Azure Maps Autocomplete */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Street Name</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  value={manualAddress.street}
                  onChangeText={(text) => {
                    setManualAddress({ ...manualAddress, street: text });
                    // Only search streets if city is selected
                    if (manualAddress.city.trim()) {
                      filterStreets(text);
                    }
                  }}
                  placeholder={manualAddress.city ? `Enter street name in ${manualAddress.city}...` : "Select a city first"}
                  placeholderTextColor="#999"
                  editable={!!manualAddress.city.trim()}
                  onFocus={() => {
                    if (streetSuggestions.length > 0) {
                      setShowStreetSuggestions(true);
                    }
                  }}
                />
              </View>
              
              {/* Azure Maps Street Suggestions */}
              {showStreetSuggestions && streetSuggestions.length > 0 && (
                <View style={styles.streetSuggestionsContainer}>
                  <ScrollView style={styles.streetSuggestionsList} keyboardShouldPersistTaps="handled">
                    {streetSuggestions.map((street, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.streetSuggestionItem}
                        onPress={() => {
                          setManualAddress({ 
                            ...manualAddress, 
                            street: street.streetName,
                            // If street has a specific number, suggest it
                            ...(street.streetNumber && { streetNumber: street.streetNumber })
                          });
                          setShowStreetSuggestions(false);
                        }}
                      >
                        <MaterialIcons name="add-road" size={18} color="#666" />
                        <View style={styles.streetSuggestionTextContainer}>
                          <Text style={styles.streetSuggestionText}>{street.streetName}</Text>
                          {street.streetNumber && (
                            <Text style={styles.streetSuggestionSubtext}>
                              Suggested number: {street.streetNumber}
                            </Text>
                          )}
                          {street.municipality && street.municipality !== manualAddress.city && (
                            <Text style={styles.streetSuggestionSubtext}>
                              {street.municipality}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              
              {!manualAddress.city.trim() && (
                <Text style={styles.inputHelpText}>
                  ℹ️ Please select a city first to search for streets
                </Text>
              )}
            </View>

            {/* ENHANCED Street Number Input with Validation */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                House Number{' '}
                <Text style={styles.optionalText}>(Optional)</Text>
              </Text>
              <View style={[
                styles.inputContainer,
                manualAddress.streetNumber && !validateHouseNumber(manualAddress.streetNumber) && styles.inputError
              ]}>
                <TextInput
                  style={styles.textInput}
                  value={manualAddress.streetNumber}
                  onChangeText={(text) => {
                    const formatted = formatHouseNumber(text);
                    setManualAddress({ ...manualAddress, streetNumber: formatted });
                  }}
                  placeholder="e.g., 123, 123A, 123/5, 123-125"
                  placeholderTextColor="#999"
                  keyboardType="default"
                />
              </View>
              
              {manualAddress.streetNumber && !validateHouseNumber(manualAddress.streetNumber) && (
                <Text style={styles.errorText}>
                  ⚠️ Invalid house number format. Use: 123, 123A, 123/5, or 123-125
                </Text>
              )}
              
              <Text style={styles.inputHelpText}>
                💡 Supports Israeli formats: 123, 123A, 123/5, 123-125, 123א
              </Text>
            </View>

            {/* Postal Code Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Postal Code</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  value={manualAddress.postalCode}
                  onChangeText={(text) => setManualAddress({ ...manualAddress, postalCode: text })}
                  placeholder="Enter postal code (optional)"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={styles.helperText}>
              * Required field. We'll verify this address with Azure Maps to ensure it's a real Israeli location.
            </Text>
          </ScrollView>

          {/* Submit Button */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.submitButton, (!manualAddress.city.trim()) && styles.submitButtonDisabled]}
              onPress={handleManualAddressSubmit}
              disabled={!manualAddress.city.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="check" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Find & Set Address</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Azure Maps Modal */}
      <Modal
        visible={showMap}
        animationType="slide"
        onRequestClose={() => setShowMap(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Location</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowMap(false)}
            >
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Azure Maps for all platforms */}
          <CrossPlatformAzureMapView
            ref={mapRef}
            region={{
              latitude: mapRegion.latitude,
              longitude: mapRegion.longitude,
              zoom: mapRegion.zoom,
            }}
            markers={[
              ...(selectedLocation ? [{
                id: 'selected',
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
                title: 'Selected Location',
                description: selectedLocation.formattedAddress,
              }] : []),
              ...(currentLocation ? [{
                id: 'current',
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                title: 'Your Location',
                description: 'You are here',
              }] : []),
            ]}
            onMarkerPress={(marker) => {
              console.log('Map marker pressed:', marker);
            }}
            onLocationSelect={handleLocationSelect}
            style={styles.map}
            interactive={true}
            azureMapsKey={azureMapsKey}
          />

          {/* Map Controls */}
          <View style={styles.mapControls}>
            <TouchableOpacity
              style={styles.mapControlButton}
              onPress={getCurrentLocation}
              disabled={locationLoading}
            >
              <MaterialIcons name="my-location" size={24} color="#216a94" />
            </TouchableOpacity>
          </View>

          {/* Confirm Button */}
          {selectedLocation && (
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => {
                // Show success feedback
                showToast('Location confirmed successfully!', 'success');
                
                // If auto-close is enabled, close the map after showing feedback
                if (autoCloseOnConfirm) {
                  setTimeout(() => {
                    setShowMap(false);
                  }, 1500);
                } else {
                  // Just close immediately if auto-close is disabled
                  setShowMap(false);
                }
              }}
            >
              <MaterialIcons name="check" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.confirmButtonText}>Confirm Location</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>

      {/* Toast Message Component */}
      {toast.visible && (
        <ToastMessage
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 16,
    ...Platform.select({
      web: { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      }
    })
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    fontSize: 16,
    color: '#333',
    ...Platform.select({
      web: { 
        outlineWidth: 0,
        outlineStyle: 'none',
        outlineColor: 'transparent'
      },
      default: {}
    })
  },
  loadingIcon: {
    marginLeft: 8,
  },
  // NEW: Action buttons layout
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
  },
  currentLocationButton: {
    backgroundColor: '#f0f9f0',
    borderColor: '#4CAF50',
  },
  manualEntryButton: {
    backgroundColor: '#fff5f0',
    borderColor: '#FF6B35',
  },
  mapButton: {
    backgroundColor: '#f0f9f0',
    borderColor: '#4CAF50',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
    color: '#216a94',
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: -8,
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1000,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }),
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    ...Platform.select({
      web: { boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
        elevation: 1,
      }
    })
  },
  suggestionTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  suggestionSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  selectedLocationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f9f0',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  selectedLocationTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  selectedLocationText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  coordinatesText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  liveLocationBadge: {
    fontSize: 11,
    color: '#4CAF50',
    marginTop: 4,
    fontWeight: '600',
  },
  manualEntryBadge: {
    fontSize: 11,
    color: '#FF6B35',
    marginTop: 4,
    fontWeight: '600',
  },
  gpsLocationBadge: {
    fontSize: 11,
    color: '#2196F3',
    marginTop: 4,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  // NEW: Manual entry modal styles
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  textInput: {
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    fontSize: 16,
    color: '#333',
    ...Platform.select({
      web: { 
        outlineWidth: 0,
        outlineStyle: 'none',
        outlineColor: 'transparent'
      },
      default: {}
    })
  },
  citySuggestionsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 8,
    overflow: 'hidden',
    maxHeight: 150,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }),
  },
  citySuggestionsList: {
    flex: 1,
  },
  citySuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  citySuggestionTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  citySuggestionText: {
    fontSize: 14,
    color: '#333',
  },
  citySuggestionSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  streetSuggestionsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 8,
    overflow: 'hidden',
    maxHeight: 150,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }),
  },
  streetSuggestionsList: {
    flex: 1,
  },
  streetSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  streetSuggestionTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  streetSuggestionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  streetSuggestionSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  helperText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 18,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0px 2px 8px rgba(76, 175, 80, 0.3)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
      }
    })
  },
  submitButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  map: {
    flex: 1,
    margin: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mapControls: {
    position: 'absolute',
    top: 80,
    right: 26,
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 10,
  },
  mapControlButton: {
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 12,
    marginBottom: 8,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    }),
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  inputHelpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },
  inputError: {
    borderColor: '#FF3B30',
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
    fontWeight: '500',
  },
  optionalText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    fontWeight: '400',
  },
  modal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    ...Platform.select({
      web: { boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.15)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 10,
      }
    })
  },
});

export default LocationPicker;