import React from 'react';
import { View, StyleSheet } from 'react-native';
import CardHeader from './PlantDetailMiniCard-parts/CardHeader';
import CardDetails from './PlantDetailMiniCard-parts/CardDetails';
import CardFooter from './PlantDetailMiniCard-parts/CardFooter';

/**
 * Mini plant detail card that shows in the map view
 * when a plant pin is clicked, without navigating away
 */
const PlantDetailMiniCard = ({ plant, onClose, onViewDetails }) => {
  if (!plant) return null;

  return (
    <View style={styles.container}>
      <CardHeader onClose={onClose} />
      <CardDetails plant={plant} />
      <CardFooter onViewDetails={onViewDetails} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    position: 'relative',
    margin: 8,
  },
});

export default PlantDetailMiniCard;