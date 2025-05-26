// Business/components/CustomerSearchBar.js
import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  Platform,
  Keyboard,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * CustomerSearchBar Component
 * 
 * A search input field with animations and filter button for customer searching
 * 
 * @param {Object} props Component props
 * @param {string} props.value Current search text
 * @param {Function} props.onChangeText Callback when text changes
 * @param {string} props.placeholder Placeholder text
 * @param {boolean} props.autoFocus Whether to focus on mount
 * @param {boolean} props.showFilters Whether to show filter button
 * @param {Function} props.onFilterPress Callback when filter button is pressed
 * @param {Object} props.style Additional container styles
 * @param {Function} props.onSubmit Callback when search is submitted
 * @param {boolean} props.disabled Whether the search is disabled
 */
const CustomerSearchBar = ({
  value = '',
  onChangeText = () => {},
  placeholder = 'Search customers...',
  autoFocus = false,
  showFilters = false,
  onFilterPress = () => {},
  style = {},
  onSubmit = null,
  disabled = false
}) => {
  // State
  const [isFocused, setIsFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  
  // Refs
  const inputRef = useRef(null);
  
  // Animation refs
  const focusAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  // Load search history on mount
  useEffect(() => {
    const loadSearchHistory = async () => {
      try {
        const history = await AsyncStorage.getItem('customerSearchHistory');
        if (history) {
          setSearchHistory(JSON.parse(history));
        }
      } catch (error) {
        console.error('Error loading search history:', error);
      }
    };
    
    loadSearchHistory();
  }, []);
  
  // Focus/blur animation handlers
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    
    Animated.parallel([
      Animated.timing(focusAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1.02,
        tension: 300,
        friction: 10,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [focusAnim, scaleAnim]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    
    Animated.parallel([
      Animated.timing(focusAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [focusAnim, scaleAnim]);

  // Handle text clear
  const handleClear = useCallback(() => {
    onChangeText('');
    
    // Focus input after clearing
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    // Bounce animation for clear action
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [onChangeText, scaleAnim]);

  // Handle search submission
  const handleSubmit = useCallback(() => {
    if (!value.trim()) return;
    
    // Save to search history
    const saveHistory = async () => {
      try {
        // Add to the front, remove duplicates, and keep only most recent 10
        const newHistory = [value, ...searchHistory.filter(item => item !== value)].slice(0, 10);
        setSearchHistory(newHistory);
        await AsyncStorage.setItem('customerSearchHistory', JSON.stringify(newHistory));
      } catch (error) {
        console.error('Error saving search history:', error);
      }
    };
    
    saveHistory();
    
    // Dismiss keyboard
    Keyboard.dismiss();
    
    // Call onSubmit if provided
    if (onSubmit) {
      onSubmit(value);
    }
  }, [value, searchHistory, onSubmit]);

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          borderColor: focusAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['#e0e0e0', '#4CAF50'],
          }),
          borderWidth: focusAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 2],
          }),
          transform: [{ scale: scaleAnim }],
        },
        disabled && styles.disabledContainer,
        style
      ]}
      accessible={true}
      accessibilityLabel="Search customers"
      accessibilityHint="Enter text to search for customers"
      accessibilityRole="search"
      accessibilityState={{ disabled }}
    >
      {/* Search Icon */}
      <Animated.View
        style={[
          styles.searchIcon,
          {
            opacity: focusAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.6, 1],
            }),
          }
        ]}
      >
        <MaterialIcons 
          name="search" 
          size={20} 
          color={isFocused ? '#4CAF50' : disabled ? '#ccc' : '#999'} 
        />
      </Animated.View>
      
      {/* Text Input */}
      <TextInput
        ref={inputRef}
        style={[styles.textInput, disabled && styles.disabledInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={disabled ? '#ccc' : '#999'}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoFocus={autoFocus}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!disabled}
        onSubmitEditing={handleSubmit}
        blurOnSubmit={true}
      />
      
      {/* Clear Button */}
      {value.length > 0 && !disabled && (
        <Animated.View
          style={[
            styles.clearButton,
            {
              opacity: focusAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.7, 1],
              }),
            }
          ]}
        >
          <TouchableOpacity 
            onPress={handleClear}
            style={styles.clearTouchable}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessible={true}
            accessibilityLabel="Clear search"
            accessibilityRole="button"
          >
            <MaterialIcons name="clear" size={18} color="#999" />
          </TouchableOpacity>
        </Animated.View>
      )}
      
      {/* Filter Button */}
      {showFilters && !disabled && (
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={onFilterPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible={true}
          accessibilityLabel="Show search filters"
          accessibilityRole="button"
        >
          <MaterialIcons name="filter-list" size={20} color="#999" />
        </TouchableOpacity>
      )}
      
      {/* Focus indicator */}
      {isFocused && !disabled && (
        <Animated.View
          style={[
            styles.focusIndicator,
            {
              opacity: focusAnim,
              transform: [{
                scaleX: focusAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                })
              }],
            }
          ]}
        />
      )}
    </Animated.View>
  );
};

// Ensure AsyncStorage is imported
let AsyncStorage;
try {
  // Dynamic import to handle case when library is not available
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (error) {
  // Create a fallback implementation using local storage if available
  console.warn('@react-native-async-storage/async-storage is not installed. Using memory storage fallback.');
  
  const memoryStorage = {};
  
  AsyncStorage = {
    getItem: async (key) => memoryStorage[key] || null,
    setItem: async (key, value) => { memoryStorage[key] = value; },
    removeItem: async (key) => { delete memoryStorage[key]; },
    clear: async () => { Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]); },
  };
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    position: 'relative',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  disabledContainer: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    opacity: 0.8,
  },
  searchIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0, // Remove default padding on Android
    height: Platform.OS === 'ios' ? 24 : undefined,
  },
  disabledInput: {
    color: '#999',
  },
  clearButton: {
    marginLeft: 8,
  },
  clearTouchable: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButton: {
    marginLeft: 8,
    padding: 4,
  },
  focusIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#4CAF50',
    borderRadius: 1,
  },
});

export default memo(CustomerSearchBar);