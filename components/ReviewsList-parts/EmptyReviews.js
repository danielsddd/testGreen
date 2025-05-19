import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const EmptyReviews = () => {
  return (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="rate-review" size={48} color="#ccc" />
      <Text style={styles.emptyText}>No reviews yet</Text>
      <Text style={styles.emptySubtext}>Be the first to leave a review!</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default EmptyReviews;