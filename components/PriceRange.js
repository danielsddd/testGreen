import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Slider from '@react-native-community/slider';

// Custom slider styles for web platform
if (Platform.OS === 'web') {
  // Inject custom CSS for range inputs on web
  const style = document.createElement('style');
  style.textContent = `
    input[type=range] {
      -webkit-appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: #e0e0e0;
      outline: none;
    }
    
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #4CAF50;
      cursor: pointer;
    }
    
    input[type=range]::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #4CAF50;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Cross-platform price range slider component
 * @param {Object} props - Component props
 * @param {number} props.minValue - Minimum possible value
 * @param {number} props.maxValue - Maximum possible value
 * @param {number} props.initialMin - Initial minimum value
 * @param {number} props.initialMax - Initial maximum value
 * @param {Function} props.onValueChange - Function called when values change
 */
const PriceRange = ({ 
  minValue = 0, 
  maxValue = 1000, 
  initialMin = 0, 
  initialMax = 1000, 
  onValueChange 
}) => {
  const [minPrice, setMinPrice] = useState(initialMin);
  const [maxPrice, setMaxPrice] = useState(initialMax);

  // Update component when props change
  useEffect(() => {
    setMinPrice(initialMin);
    setMaxPrice(initialMax);
  }, [initialMin, initialMax]);

  // Handle minimum price change
  const handleMinChange = (value) => {
    // Ensure min value doesn't exceed max value
    const newMinPrice = Math.min(value, maxPrice);
    setMinPrice(newMinPrice);
    
    if (onValueChange) {
      onValueChange([newMinPrice, maxPrice]);
    }
  };

  // Handle maximum price change
  const handleMaxChange = (value) => {
    // Ensure max value isn't less than min value
    const newMaxPrice = Math.max(value, minPrice);
    setMaxPrice(newMaxPrice);
    
    if (onValueChange) {
      onValueChange([minPrice, newMaxPrice]);
    }
  };

  // Render platform-specific slider
  const renderSlider = (props) => {
    if (Platform.OS === 'web') {
      // Web version uses HTML input range
      return (
        <input
          type="range"
          min={props.minimumValue}
          max={props.maximumValue}
          step={props.step}
          value={props.value}
          onChange={(e) => props.onValueChange(parseFloat(e.target.value))}
          style={{
            width: '100%',
            height: 40,
            outline: 'none',
          }}
        />
      );
    } else {
      // Native platforms use @react-native-community/slider
      return (
        <Slider
          {...props}
          style={styles.slider}
        />
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Price Range</Text>
      
      <View style={styles.priceLabels}>
        <Text style={styles.priceValue}>${minPrice.toFixed(0)}</Text>
        <Text style={styles.priceValue}>${maxPrice.toFixed(0)}</Text>
      </View>
      
      <View style={styles.sliderContainer}>
        <Text style={styles.sliderLabel}>Minimum Price</Text>
        {renderSlider({
          minimumValue: minValue,
          maximumValue: maxValue,
          step: 10,
          value: minPrice,
          onValueChange: handleMinChange,
          minimumTrackTintColor: '#A5D6A7',
          maximumTrackTintColor: '#E0E0E0',
          thumbTintColor: '#4CAF50',
        })}
      </View>
      
      <View style={styles.sliderContainer}>
        <Text style={styles.sliderLabel}>Maximum Price</Text>
        {renderSlider({
          minimumValue: minValue,
          maximumValue: maxValue,
          step: 10,
          value: maxPrice,
          onValueChange: handleMaxChange,
          minimumTrackTintColor: '#A5D6A7',
          maximumTrackTintColor: '#E0E0E0',
          thumbTintColor: '#4CAF50',
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 12,
  },
  priceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4CAF50',
  },
  sliderContainer: {
    marginVertical: 8,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
});

export default PriceRange;