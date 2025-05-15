import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Component to display a single review
 * 
 * @param {Object} props - Component props
 * @param {Object} props.review - Review data
 * @param {Function} props.onDelete - Optional callback when the delete button is pressed
 */
const ReviewItem = ({ review, onDelete }) => {
  // Check if the review is by the current user
  const isOwnReview = review.isOwnReview || false;

  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return '';
      }
      
      // Format the date
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.userName}>{review.userName || 'Anonymous'}</Text>
          <Text style={styles.date}>{formatDate(review.createdAt)}</Text>
        </View>
        
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5].map(star => (
            <MaterialIcons
              key={star}
              name={star <= review.rating ? 'star' : 'star-border'}
              size={16}
              color="#FFD700"
            />
          ))}
        </View>
      </View>
      
      <Text style={styles.reviewText}>{review.text}</Text>

      {isOwnReview && onDelete && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(review.id)}
        >
          <MaterialIcons name="delete" size={16} color="#f44336" />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  date: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
  },
  reviewText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 12,
    padding: 4,
  },
  deleteText: {
    color: '#f44336',
    marginLeft: 4,
    fontSize: 14,
  },
});

export default ReviewItem;