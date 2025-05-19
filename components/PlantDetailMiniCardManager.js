import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import PlantDetailMiniCard from './PlantDetailMiniCard';

/**
 * Component that manages the visibility and animation of the plant detail mini card on the map
 */
const PlantDetailMiniCardManager = ({ 
  selectedPlant, 
  onClose, 
  onViewDetails,
  products = []
}) => {
  const [visiblePlant, setVisiblePlant] = useState(null);
  const [animation] = useState(new Animated.Value(0));
  
  // When selectedPlant changes, find the full plant data and animate
  useEffect(() => {
    if (selectedPlant) {
      // Find the full plant data from products array
      const plantData = products.find(p => 
        (p.id === selectedPlant || p._id === selectedPlant)
      );
      
      if (plantData) {
        setVisiblePlant(plantData);
        // Animate in
        Animated.timing(animation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }).start();
      }
    } else {
      // Animate out
      Animated.timing(animation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start(() => {
        setVisiblePlant(null);
      });
    }
  }, [selectedPlant, products, animation]);
  
  // Handle card close
  const handleClose = () => {
    // Animate out
    Animated.timing(animation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true
    }).start(() => {
      setVisiblePlant(null);
      if (onClose) onClose();
    });
  };
  
  // If no plant data, don't render anything
  if (!visiblePlant) return null;
  
  return (
    <Animated.View 
      style={[
        styles.cardContainer,
        {
          transform: [
            { translateY: animation.interpolate({
              inputRange: [0, 1],
              outputRange: [100, 0]
            }) }
          ],
          opacity: animation
        }
      ]}
    >
      <PlantDetailMiniCard 
        plant={visiblePlant} 
        onClose={handleClose}
        onViewDetails={onViewDetails}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    right: 10,
    zIndex: 999,
  }
});

export default PlantDetailMiniCardManager;