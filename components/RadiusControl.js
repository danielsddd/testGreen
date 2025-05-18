import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

/**
 * Enhanced RadiusControl component for setting search radius
 * Includes improved visualization and animation
 * 
 * @param {Object} props Component props
 * @param {number} props.radius Current radius in km
 * @param {Function} props.onRadiusChange Callback when radius changes
 * @param {Function} props.onApply Callback when apply button is pressed
 * @param {Object} props.style Additional styles for the container
 */
const RadiusControl = ({ radius = 10, onRadiusChange, onApply, style }) => {
  const [inputValue, setInputValue] = useState(radius?.toString() || '10');
  const [sliderValue, setSliderValue] = useState(radius || 10);
  const [error, setError] = useState('');
  
  // Animation values
  const [scaleAnim] = useState(new Animated.Value(1));
  const circleSize = useRef(new Animated.Value(50)).current;
  const circleOpacity = useRef(new Animated.Value(0.7)).current;
  
  // Update input when radius prop changes
  useEffect(() => {
    setInputValue(radius?.toString() || '10');
    setSliderValue(radius || 10);
    
    // Animate circle size based on radius
    const size = Math.min(160, 50 + radius * 2);
    Animated.timing(circleSize, {
      toValue: size,
      duration: 300,
      useNativeDriver: false,
    }).start();
    
    // Briefly increase opacity when radius changes
    Animated.sequence([
      Animated.timing(circleOpacity, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(circleOpacity, {
        toValue: 0.7,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  }, [radius, circleSize, circleOpacity]);

  // Animate pulse effect on apply
  const animatePulse = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.05,
        duration: 150,
        useNativeDriver: true
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true
      })
    ]).start();
  };

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
    
    // Animate button
    animatePulse();
    
    // Call callback
    onRadiusChange(value);
    
    if (onApply) {
      onApply(value);
    }
  };

  // Handle input change
  const handleInputChange = (text) => {
    // Filter out non-numeric characters except decimal point
    const filteredText = text.replace(/[^0-9.]/g, '');
    setInputValue(filteredText);
    setError('');
    
    // Update slider if valid number
    const value = parseFloat(filteredText);
    if (!isNaN(value) && value > 0 && value <= 100) {
      setSliderValue(value);
    }
  };
  
  // Handle slider change
  const handleSliderChange = (value) => {
    // Round to 1 decimal place
    const roundedValue = Math.round(value * 10) / 10;
    setSliderValue(roundedValue);
    setInputValue(roundedValue.toString());
    setError('');
  };
  
  // Handle slider complete
  const handleSliderComplete = (value) => {
    // Round to 1 decimal place
    const roundedValue = Math.round(value * 10) / 10;
    
    // Call callback
    onRadiusChange(roundedValue);
    
    if (onApply) {
      onApply(roundedValue);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        <MaterialIcons name="radio-button-checked" size={24} color="#4CAF50" style={styles.radiusIcon} />
        <Text style={styles.headerText}>Search Radius</Text>
      </View>
      
      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={100}
          step={0.5}
          value={sliderValue}
          onValueChange={handleSliderChange}
          onSlidingComplete={handleSliderComplete}
          minimumTrackTintColor="#4CAF50"
          maximumTrackTintColor="#dddddd"
          thumbTintColor="#4CAF50"
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderMinLabel}>1km</Text>
          <Text style={styles.sliderMaxLabel}>100km</Text>
        </View>
      </View>
      
      <View style={styles.radiusInputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={inputValue}
            onChangeText={handleInputChange}
            placeholder="10"
            keyboardType="numeric"
            returnKeyType="done"
            maxLength={5}
            selectTextOnFocus={true}
          />
          <Text style={styles.unitText}>km</Text>
        </View>
        
        <Animated.View style={{
          transform: [{ scale: scaleAnim }]
        }}>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={handleApply}
          >
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <View style={styles.radiusDisplay}>
        <View style={styles.radiusVisual}>
          {/* Concentric circles to visualize radius */}
          <View style={styles.centerDot} />
          <Animated.View 
            style={[
              styles.radiusCircle1,
              {
                width: circleSize,
                height: circleSize,
                borderRadius: circleSize.interpolate({
                  inputRange: [0, 200],
                  outputRange: [0, 100],
                }),
                opacity: circleOpacity,
                transform: [
                  { scale: circleSize.interpolate({
                    inputRange: [50, 160],
                    outputRange: [0.8, 1],
                  })},
                ],
              }
            ]}
          />
        </View>
        <View style={styles.radiusInfo}>
          <Text style={styles.radiusValue}>{sliderValue} km</Text>
          <Text style={styles.helperText}>
            Set radius to find plants nearby
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  radiusIcon: {
    marginRight: 8,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sliderContainer: {
    marginVertical: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  sliderMinLabel: {
    fontSize: 12,
    color: '#666',
  },
  sliderMaxLabel: {
    fontSize: 12,
    color: '#666',
  },
  radiusInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginRight: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    height: 44,
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
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  radiusDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  radiusVisual: {
    position: 'relative',
    width: 80,
    height: 80,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radiusCircle1: {
    position: 'absolute',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  centerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    zIndex: 2,
  },
  radiusInfo: {
    flex: 1,
  },
  radiusValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  helperText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default RadiusControl;