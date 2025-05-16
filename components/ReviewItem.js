// components/ReviewItem.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { deleteReview } from '../services/marketplaceApi';

/**
 * Component to display a single review
 * 
 * @param {Object} props - Component props
 * @param {Object} props.review - Review data
 * @param {Function} props.onDelete - Optional callback when the delete button is pressed
 * @param {string} props.targetType - Type of target ('seller' or 'product')
 * @param {string} props.targetId - ID of the target
 * @param {Function} props.onReviewDeleted - Callback when review is deleted
 */
const ReviewItem = ({ 
  review, 
  onDelete, 
  targetType = 'seller', 
  targetId,
  onReviewDeleted 
}) => {
  // State to track delete operation status
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Note: Make sure your parent sets review.isOwnReview correctly
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
  
  // For debug: log when deleting starts/ends
  useEffect(() => {
    if (isDeleting) {
      console.log(`Deleting review ${review.id}...`);
    } else {
      console.log(`Delete finished for review ${review.id}`);
    }
  }, [isDeleting]);

  // Handle delete with confirmation
  const handleDelete = () => {
    Alert.alert(
      'Delete Review',
      'Are you sure you want to delete this review? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete }
      ]
    );
  };
  
  // Execute delete after confirmation
  const confirmDelete = async () => {
    try {
      setIsDeleting(true);
      
      // Use the API to delete the review
      console.log(`Calling deleteReview API with id=${review.id}, targetType=${targetType}, targetId=${targetId}`);
      const response = await deleteReview(review.id, targetType, targetId);
      
      setIsDeleting(false);
      
      if (response && response.success) {
        // Call the onDelete callback if provided
        if (onDelete) {
          onDelete(review.id);
        }
        
        // Call the onReviewDeleted callback to refresh the reviews list
        if (onReviewDeleted) {
          onReviewDeleted();
        }
        
        // Show success message
        Alert.alert('Success', 'Your review has been deleted.');
      } else {
        throw new Error('Failed to delete review');
      }
    } catch (error) {
      setIsDeleting(false);
      console.error('Error deleting review:', error);
      Alert.alert('Error', 'Failed to delete review. Please try again later.');
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

      {isOwnReview && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#f44336" />
          ) : (
            <>
              <MaterialIcons name="delete" size={16} color="#f44336" />
              <Text style={styles.deleteText}>Delete</Text>
            </>
          )}
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
