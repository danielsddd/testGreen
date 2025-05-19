import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const CardFooter = ({ onViewDetails }) => {
  return (
    <TouchableOpacity 
      style={styles.detailsButton}
      onPress={onViewDetails}
    >
      <Text style={styles.detailsButtonText}>View Details</Text>
      <MaterialIcons name="arrow-forward" size={16} color="#4CAF50" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9f0',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginRight: 8,
  },
});

export default CardFooter;