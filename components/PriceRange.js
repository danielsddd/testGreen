import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Price range component with reduced width (20%) as requested
 */
const PriceRange = ({ 
  minValue = 0, 
  maxValue = 1000, 
  initialMin = 0, 
  initialMax = 1000, 
  onPriceChange,
  style
}) => {
  const [minPrice, setMinPrice] = useState(initialMin);
  const [maxPrice, setMaxPrice] = useState(initialMax);

  // Handle changes in min price
  const handleMinChange = (value) => {
    const newMinPrice = Math.min(value, maxPrice);
    setMinPrice(newMinPrice);
    if (onPriceChange) onPriceChange([newMinPrice, maxPrice]);
  };

  // Handle changes in max price
  const handleMaxChange = (value) => {
    const newMaxPrice = Math.max(value, minPrice);
    setMaxPrice(newMaxPrice);
    if (onPriceChange) onPriceChange([minPrice, newMaxPrice]);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        <MaterialIcons name="attach-money" size={18} color="#4CAF50" />
        <Text style={styles.title}>Price</Text>
      </View>
      
      <View style={styles.rangeRow}>
        <Text style={styles.priceValue}>${minPrice.toFixed(0)}</Text>
        <Text style={styles.priceDash}>-</Text>
        <Text style={styles.priceValue}>${maxPrice.toFixed(0)}</Text>
      </View>
      
      <View style={styles.slidersContainer}>
        <Slider
          value={minPrice}
          minimumValue={minValue}
          maximumValue={maxValue}
          onValueChange={handleMinChange}
          style={styles.slider}
          minimumTrackTintColor="#cce7cc"
          maximumTrackTintColor="#e0e0e0"
          thumbTintColor="#4CAF50"
        />
        
        <Slider
          value={maxPrice}
          minimumValue={minValue}
          maximumValue={maxValue}
          onValueChange={handleMaxChange}
          style={styles.slider}
          minimumTrackTintColor="#4CAF50"
          maximumTrackTintColor="#e0e0e0"
          thumbTintColor="#4CAF50"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    width: '20%', // Reduced to 20% as requested
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 4,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  priceDash: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginHorizontal: 8,
  },
  slidersContainer: {
    marginTop: 6,
  },
  slider: {
    width: '100%',
    height: 30,
    ...Platform.select({
      ios: {
        marginBottom: 0,
      },
      android: {
        marginVertical: -5,
      },
    }),
  },
});

export default PriceRange;