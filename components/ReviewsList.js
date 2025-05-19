import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReviewItem from './ReviewItem';
import { fetchReviews } from '../services/marketplaceApi';
import ReviewsHeaderSection from './ReviewsList-parts/ReviewsHeaderSection';
import EmptyReviews from './ReviewsList-parts/EmptyReviews';
import LoadingState from './ReviewsList-parts/LoadingState';
import ErrorState from './ReviewsList-parts/ErrorState';

/**
 * Component to display a list of reviews
 * 
 * @param {Object} props - Component props
 * @param {string} props.targetType - Type of the review target ('seller' or 'product')
 * @param {string} props.targetId - ID of the review target
 * @param {Function} props.onAddReview - Callback when the add review button is pressed
 * @param {Function} props.onReviewsLoaded - Callback when reviews are loaded, passing the average rating
 * @param {boolean} props.autoLoad - Whether to load reviews automatically (default: true)
 */
const ReviewsList = ({
  targetType,
  targetId,
  onAddReview,
  onReviewsLoaded,
  autoLoad = true,
}) => {
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);

  // Load current user on mount
  useEffect(() => {
    const getUser = async () => {
      try {
        const email = await AsyncStorage.getItem('userEmail');
        setCurrentUser(email);
      } catch (err) {
        console.error('Error getting user email:', err);
      }
    };
    
    getUser();
  }, []);

  // Load reviews when component mounts or when the target changes
  useEffect(() => {
    if (autoLoad && targetId && targetType) {
      console.log(`Auto-loading reviews for ${targetType} ${targetId}`);
      loadReviews();
    }
  }, [targetId, targetType, autoLoad]);

  /**
   * Load reviews from the API with improved debugging
   */
  const loadReviews = async () => {
    if (!targetId || !targetType) {
      setError('Missing target information');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`[REVIEWSLIST] Fetching reviews for ${targetType} ${targetId}...`);
      const data = await fetchReviews(targetType, targetId);
      console.log(`[REVIEWSLIST] Reviews fetch response:`, data);

      if (data) {
        // Get current user to determine which reviews can be deleted
        const userEmail = await AsyncStorage.getItem('userEmail');
        
        // Mark reviews owned by the current user
        const processedReviews = (data.reviews || []).map(review => ({
          ...review,
          isOwnReview: review.userId === userEmail
        }));
        
        setReviews(processedReviews);
        setAverageRating(data.averageRating || 0);
        setReviewCount(data.count || 0);
        
        console.log(`[REVIEWSLIST] Loaded ${processedReviews.length} reviews with average rating ${data.averageRating || 0}`);
        console.log(`[REVIEWSLIST] Current user: ${userEmail}`);

        // Notify parent component that reviews are loaded
        if (onReviewsLoaded) {
          onReviewsLoaded({
            averageRating: data.averageRating || 0,
            count: data.count || 0
          });
        }
      } else {
        console.warn('[REVIEWSLIST] Review data is undefined or null');
      }

      setIsLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.error('[REVIEWSLIST] Error loading reviews:', err);
      setError(`Failed to load reviews: ${err.message}`);
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = () => {
    setRefreshing(true);
    loadReviews();
  };

  /**
   * Handle review deletion and update average rating
   */
  const handleDeleteReview = (reviewId) => {
    console.log(`[REVIEWSLIST] Handling delete for review ${reviewId}`);
    
    // Find the review being deleted
    const deletedReview = reviews.find(r => r.id === reviewId);
    
    // Remove the review from the local state
    const updatedReviews = reviews.filter(r => r.id !== reviewId);
    setReviews(updatedReviews);
    
    // Update count
    const newCount = Math.max(0, reviewCount - 1);
    setReviewCount(newCount);
    
    // Recalculate average rating
    let newAverage = 0;
    if (updatedReviews.length > 0) {
      const totalRating = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
      newAverage = totalRating / updatedReviews.length;
    } 
    // If there are no more reviews, the average is 0
    setAverageRating(newAverage);
    
    // Notify parent component of updated ratings
    if (onReviewsLoaded) {
      onReviewsLoaded({
        averageRating: newAverage,
        count: newCount
      });
    }
  };

  // If loading and not refreshing
  if (isLoading && !refreshing && reviews.length === 0) {
    return <LoadingState />;
  }

  // If error and not refreshing
  if (error && !refreshing && reviews.length === 0) {
    return (
      <ErrorState 
        error={error} 
        targetType={targetType} 
        targetId={targetId} 
        onRetry={loadReviews} 
      />
    );
  }

  console.log(`[REVIEWSLIST] Rendering with targetType=${targetType}, targetId=${targetId}`);

  return (
    <View style={styles.container}>
      <ReviewsHeaderSection 
        averageRating={averageRating}
        reviewCount={reviewCount}
        onAddReview={onAddReview}
      />

      <FlatList
        data={reviews}
        renderItem={({ item }) => {
          console.log(`[REVIEWSLIST] Rendering review item: ${item.id}, isOwnReview=${item.isOwnReview}`);
          return (
            <ReviewItem 
              review={item} 
              targetType={targetType}
              targetId={targetId}
              onDelete={handleDeleteReview}
              onReviewDeleted={loadReviews}
            />
          );
        }}
        keyExtractor={item => item.id || `review-${item.userId}-${Date.now()}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyReviews />}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContent: {
    flexGrow: 1,
    padding: 16,
  },
});

export default ReviewsList;