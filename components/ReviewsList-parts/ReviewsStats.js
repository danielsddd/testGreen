import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const ReviewsStats = ({ averageRating = 0, reviewCount = 0 }) => {
  return (
    <View style={styles.statsContainer}>
      <View style={styles.ratingContainer}>
        <Text style={styles.ratingValue}>{averageRating.toFixed(1)}</Text>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map(star => (
            <MaterialIcons
              key={star}
              name={star <= Math.round(averageRating) ? 'star' : 'star-border'}
              size={18}
              color="#FFD700"
            />
          ))}
        </View>
      </View>
      <Text style={styles.reviewCount}>{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  statsContainer: {
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 8,
    color: '#333',
  },
  starsContainer: {
    flexDirection: 'row',
  },
  reviewCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});

export default ReviewsStats;