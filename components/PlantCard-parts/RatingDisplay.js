import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

const RatingDisplay = ({ rating, reviewCount }) => {
  // Show "New Product" text for no ratings
  if (!rating || rating === 0) {
    return <Text style={styles.newProductText}>New Product</Text>;
  }

  // Show star rating
  return (
    <View style={styles.ratingContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <FontAwesome
          key={`star-${star}`}
          name={star <= Math.round(rating) ? 'star' : 'star-o'}
          size={14}
          color="#FFD700"
          style={{ marginRight: 2 }}
        />
      ))}
      {reviewCount > 0 && (
        <Text style={styles.reviewCount}>({reviewCount})</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewCount: {
    fontSize: 12,
    color: '#888',
    marginLeft: 4,
  },
  newProductText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 6,
  },
});

export default RatingDisplay;