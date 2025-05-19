import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import ReviewsStats from './ReviewsStats';

const ReviewsHeaderSection = ({ averageRating = 0, reviewCount = 0, onAddReview }) => {
  return (
    <View style={styles.header}>
      <ReviewsStats averageRating={averageRating} reviewCount={reviewCount} />
      <TouchableOpacity
        style={styles.addButton}
        onPress={onAddReview}
      >
        <MaterialIcons name="add" size={20} color="#fff" />
        <Text style={styles.addButtonText}>Review</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4,
  },
});

export default ReviewsHeaderSection;