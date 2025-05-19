import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { getAzureMapsKey, geocodeAddress } from '../services/azureMapsService';
import AddressInput from './LocationPicker-parts/AddressInput';
import SuggestionItem from './LocationPicker-parts/SuggestionItem';
import SelectedLocation from './LocationPicker-parts/SelectedLocation';
import ConfirmButton from './LocationPicker-parts/ConfirmButton';

/**
 * Enhanced LocationPicker component with Azure Maps integration
 * Provides address suggestions as you type
 * 
 * @param {Object} props Component props
 * @param {Object} props.value Current location value
 * @param {Function} props.onChange Called when location changes
 * @param {Object} props.style Additional container styles
 * @param {boolean} props.required Whether location is required
 * @param {boolean} props.showConfirmButton Whether to show confirm button
 */
const LocationPicker = ({
  value,
  onChange,
  style,
  required = false,
  showConfirmButton = true,
}) => {
  // State for address input and suggestions
  const [address, setAddress] = useState(value?.formattedAddress || '');
  const [city, setCity] = useState(value?.city || '');
  const [street, setStreet] = useState(value?.street || '');
  const [houseNumber, setHouseNumber] = useState(value?.houseNumber || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [azureMapsKey, setAzureMapsKey] = useState(null);
  const [isKeyLoading, setIsKeyLoading] = useState(true);
  const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
  
  // Animation values for suggestions panel
  const suggestionsHeight = useRef(new Animated.Value(0)).current;
  const suggestionsOpacity = useRef(new Animated.Value(0)).current;
  
  // Load Azure Maps key
  useEffect(() => {
    const loadAzureMapsKey = async () => {
      try {
        setIsKeyLoading(true);
        const key = await getAzureMapsKey();
        setAzureMapsKey(key);
        setIsKeyLoading(false);
      } catch (err) {
        console.error('Error loading Azure Maps key:', err);
        setError('Could not load location service');
        setIsKeyLoading(false);
      }
    };
    
    loadAzureMapsKey();
  }, []);
  
  // Update internal state when value prop changes
  useEffect(() => {
    if (value) {
      setCity(value.city || '');
      setStreet(value.street || '');
      setHouseNumber(value.houseNumber || '');
      setAddress(value.formattedAddress || '');
    }
  }, [value]);
  
  // Animate suggestions panel
  useEffect(() => {
    if (isSuggestionsVisible && suggestions.length > 0) {
      Animated.parallel([
        Animated.timing(suggestionsHeight, {
          toValue: Math.min(suggestions.length * 60, 250),
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(suggestionsOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(suggestionsHeight, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.timing(suggestionsOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }),
      ]).start(() => {
        if (!isSuggestionsVisible) {
          setSuggestions([]);
        }
      });
    }
  }, [isSuggestionsVisible, suggestions.length, suggestionsHeight, suggestionsOpacity]);
  
  // Fetch address suggestions from Azure Maps
  const fetchSuggestions = async (text) => {
    if (!text || text.length < 3 || !azureMapsKey) {
      setSuggestions([]);
      setIsSuggestionsVisible(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      // Construct search query with Israel country filter
      const query = `${text}, Israel`;
      
      // Direct call to Azure Maps Search API
      const response = await fetch(
        `https://atlas.microsoft.com/search/address/json?` +
        `api-version=1.0&subscription-key=${azureMapsKey}` +
        `&typeahead=true&limit=7&countrySet=IL&language=en-US` +
        `&query=${encodeURIComponent(query)}`
      );
      
      if (!response.ok) {
        throw new Error(`Azure Maps API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Filter for Israel addresses only
      const validResults = data.results?.filter(
        r => r.address?.country === 'Israel' || 
             r.address?.countryCode === 'IL' ||
             r.address?.countrySubdivision === 'Israel'
      ) || [];
      
      setSuggestions(validResults);
      setIsSuggestionsVisible(validResults.length > 0);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setError('Could not load suggestions');
      setSuggestions([]);
      setIsSuggestionsVisible(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle city input change with debounced suggestions
  const handleCityChange = (text) => {
    setCity(text);
    
    // Clear error when user starts typing
    if (error) setError('');
    
    // Debounce suggestions
    clearTimeout(handleCityChange.timer);
    handleCityChange.timer = setTimeout(() => {
      fetchSuggestions(text);
    }, 300);
  };
  
  // Handle street input change
  const handleStreetChange = (text) => {
    setStreet(text);
    
    // If we already have a city, try to get suggestions for street
    if (city) {
      clearTimeout(handleStreetChange.timer);
      handleStreetChange.timer = setTimeout(() => {
        fetchSuggestions(`${text}, ${city}`);
      }, 300);
    }
  };
  
  // Handle house number input
  const handleHouseNumberChange = (text) => {
    // Only allow numbers
    if (/^\d*$/.test(text) || text === '') {
      setHouseNumber(text);
    }
  };
  
  // Handle suggestion selection
  const handleSelectSuggestion = async (item) => {
    const addr = item.address || {};
    
    // Extract address components
    const selectedCity = addr.municipality || addr.localName || '';
    const selectedStreet = addr.streetName || '';
    const selectedHouseNumber = addr.streetNumber || '';
    
    // Update state with selected address
    setCity(selectedCity);
    setStreet(selectedStreet);
    setHouseNumber(selectedHouseNumber);
    setAddress(addr.freeformAddress || `${selectedStreet} ${selectedHouseNumber}, ${selectedCity}, Israel`);
    
    // Close suggestions
    setIsSuggestionsVisible(false);
    
    // Create location object
    const locationData = {
      formattedAddress: addr.freeformAddress || `${selectedStreet} ${selectedHouseNumber}, ${selectedCity}, Israel`,
      city: selectedCity,
      street: selectedStreet,
      houseNumber: selectedHouseNumber,
      latitude: item.position?.lat,
      longitude: item.position?.lon,
      country: 'Israel',
    };
    
    // Call onChange with the new location data
    onChange(locationData);
  };
  
  // Confirm the manually entered address 
  const handleConfirmAddress = async () => {
    if (!city) {
      setError('City is required');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      // Build address string
      const addressString = street 
        ? `${street} ${houseNumber}, ${city}, Israel` 
        : `${city}, Israel`;
        
      // Geocode the address
      const result = await geocodeAddress(addressString);
      
      if (result && result.latitude && result.longitude) {
        const locationData = {
          formattedAddress: result.formattedAddress || addressString,
          city: result.city || city,
          street: result.street || street,
          houseNumber: result.houseNumber || houseNumber,
          latitude: result.latitude,
          longitude: result.longitude,
          country: 'Israel',
        };
        
        setAddress(locationData.formattedAddress);
        onChange(locationData);
      } else {
        setError('Location could not be found');
      }
    } catch (err) {
      console.error('Error geocoding address:', err);
      setError('Failed to confirm location');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render loading indicator while Azure Maps key is loading
  if (isKeyLoading) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.label}>
          Location {required && <Text style={styles.requiredAsterisk}>*</Text>}
        </Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading location service...</Text>
        </View>
      </View>
    );
  }
  
  // If Azure Maps key failed to load, show error
  if (!azureMapsKey) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.label}>
          Location {required && <Text style={styles.requiredAsterisk}>*</Text>}
        </Text>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={24} color="#f44336" />
          <Text style={styles.errorText}>Location service unavailable</Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>
        Location {required && <Text style={styles.requiredAsterisk}>*</Text>}
      </Text>
      
      {/* City Input */}
      <AddressInput
        label="City"
        value={city}
        onChangeText={handleCityChange}
        placeholder="Enter city in Israel"
        icon="location-city"
        isLoading={isLoading}
        required={true}
        onFocus={() => {
          if (city.length >= 3) {
            fetchSuggestions(city);
          }
        }}
      />
      
      {/* Street Input */}
      <AddressInput
        label="Street"
        value={street}
        onChangeText={handleStreetChange}
        placeholder="Enter street name"
        icon="edit-road"
        onFocus={() => {
          if (street.length >= 3 && city) {
            fetchSuggestions(`${street}, ${city}`);
          }
        }}
      />
      
      {/* House Number Input */}
      <AddressInput
        label="House Number (Optional)"
        value={houseNumber}
        onChangeText={handleHouseNumberChange}
        placeholder="Enter house number"
        icon="home"
        keyboardType="numeric"
      />
      
      {/* Suggestions Panel */}
      <Animated.View style={[
        styles.suggestionsContainer,
        {
          height: suggestionsHeight,
          opacity: suggestionsOpacity,
          display: isSuggestionsVisible ? 'flex' : 'none'
        }
      ]}>
        <FlatList
          data={suggestions}
          keyExtractor={(item, index) => `suggestion-${index}-${item.id || ''}`}
          renderItem={({ item }) => (
            <SuggestionItem item={item} onPress={handleSelectSuggestion} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No suggestions found</Text>
            </View>
          }
        />
      </Animated.View>
      
      {/* Error Message */}
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
      
      {/* Selected Location Display */}
      <SelectedLocation address={address} />
      
      {/* Confirm Button */}
      {showConfirmButton && (
        <ConfirmButton
          onPress={handleConfirmAddress}
          isLoading={isLoading}
          disabled={!city}
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
  requiredAsterisk: {
    color: '#f44336',
    fontWeight: 'bold',
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff3f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    color: '#f44336',
    fontSize: 13,
    marginTop: 4,
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 12,
  },
  emptyContainer: {
    padding: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
});

export default LocationPicker;