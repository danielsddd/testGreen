// components/RadiusControl.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * RadiusControl component for setting search radius
 * 
 * @param {Object} props Component props
 * @param {number} props.radius Current radius in km
 * @param {Function} props.onRadiusChange Callback when radius changes
 * @param {Function} props.onApply Callback when apply button is pressed
 * @param {Object} props.style Additional styles for the container
 */
const RadiusControl = ({ radius, onRadiusChange, onApply, style }) => {
  const [inputValue, setInputValue] = useState(radius?.toString() || '10');
  const [error, setError] = useState('');

  // Handle apply button
  const handleApply = () => {
    const value = parseFloat(inputValue);
    
    if (isNaN(value) || value <= 0) {
      setError('Please enter a valid radius');
      return;
    }
    
    if (value > 100) {
      setError('Maximum radius is 100 km');
      return;
    }
    
    setError('');
    onRadiusChange(value);
    
    if (onApply) {
      onApply(value);
    }
  };

  // Handle input change
  const handleInputChange = (text) => {
    setInputValue(text);
    setError('');
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.radiusInputContainer}>
        <MaterialIcons name="radio-button-checked" size={22} color="#4CAF50" style={styles.radiusIcon} />
        
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={inputValue}
            onChangeText={handleInputChange}
            placeholder="10"
            keyboardType="numeric"
            returnKeyType="done"
            maxLength={3}
            selectTextOnFocus={true}
          />
          <Text style={styles.unitText}>km</Text>
        </View>
        
        <TouchableOpacity
          style={styles.applyButton}
          onPress={handleApply}
        >
          <Text style={styles.applyButtonText}>Apply</Text>
        </TouchableOpacity>
      </View>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <Text style={styles.helperText}>
        Set radius to find plants nearby
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  radiusInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radiusIcon: {
    marginRight: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 8,
    backgroundColor: '#f9f9f9',
    height: 40,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 16,
    color: '#333',
  },
  unitText: {
    marginLeft: 4,
    fontSize: 16,
    color: '#666',
  },
  applyButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginLeft: 8,
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4,
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default RadiusControl;