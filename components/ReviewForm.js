import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { submitReview } from '../services/marketplaceApi';

/**
 * Component to submit a review for a seller or product
 * 
 * @param {Object} props - Component props
 * @param {string} props.targetId - ID of the target (seller or product)
 * @param {string} props.targetType - Type of target ('seller' or 'product')
 * @param {boolean} props.isVisible - Whether the form is visible
 * @param {Function} props.onClose - Callback when the form is closed
 * @param {Function} props.onReviewSubmitted - Callback when a review is successfully submitted
 */
const ReviewForm = ({
  targetId,
  targetType = 'seller',
  isVisible,
  onClose,
  onReviewSubmitted
}) => {
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Reset the form to initial state
   */
  const resetForm = () => {
    setRating(5);
    setReviewText('');
    setError(null);
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    try {
      if (!reviewText.trim()) {
        setError('Please enter a review comment');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      const reviewData = {
        rating,
        text: reviewText.trim()
      };

      const result = await submitReview(targetId, targetType, reviewData);

      setIsSubmitting(false);

      if (result.success) {
        resetForm();
        onClose();
        
        // Notify parent component that a review was submitted
        if (onReviewSubmitted) {
          onReviewSubmitted(result.review);
        }
      } else {
        setError('Failed to submit review. Please try again.');
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      setError('An error occurred. Please try again later.');
      setIsSubmitting(false);
    }
  };

  /**
   * Handle cancel button press
   */
  const handleCancel = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Write a Review
            </Text>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.ratingContainer}>
            <Text style={styles.ratingLabel}>Rating:</Text>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.starButton}
                >
                  <MaterialIcons
                    name={star <= rating ? 'star' : 'star-border'}
                    size={36}
                    color="#FFD700"
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={styles.inputLabel}>Your Review:</Text>
          <TextInput
            style={styles.reviewInput}
            placeholder="Share your experience..."
            value={reviewText}
            onChangeText={setReviewText}
            multiline
            maxLength={500}
          />
          
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.submitButton,
                (isSubmitting || !reviewText.trim()) && styles.disabledButton
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || !reviewText.trim()}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Review</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  ratingContainer: {
    marginBottom: 20,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  starButton: {
    padding: 5,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    height: 150,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  errorText: {
    color: '#f44336',
    marginTop: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#A5D6A7',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ReviewForm;