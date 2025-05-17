// screens/SellerProfileScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Alert,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

// Import components
import MarketplaceHeader from '../components/MarketplaceHeader';
import PlantCard from '../components/PlantCard';
import RatingStars from '../components/RatingStars';
import ReviewsList from '../components/ReviewsList';
import ReviewForm from '../components/ReviewForm';

// Import services
import { fetchUserProfile } from '../services/marketplaceApi';
import { checkForUpdate, clearUpdate, UPDATE_TYPES } from '../services/MarketplaceUpdates';

const { width } = Dimensions.get('window');

/**
 * SellerProfileScreen - View a seller's profile with enhanced UI and reviews
 */
const SellerProfileScreen = ({ navigation, route }) => {
  // Get seller ID from params
  const sellerId = route.params?.sellerId;
  
  // State
  const [sellerData, setSellerData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTab, setCurrentTab] = useState('active');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());

  // Check for updates when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Check for global updates
      const checkForGlobalUpdates = async () => {
        const updateTypes = [
          UPDATE_TYPES.REVIEW,
          UPDATE_TYPES.PRODUCT
        ];
        
        let needsRefresh = false;
        
        for (const updateType of updateTypes) {
          const hasUpdate = await checkForUpdate(updateType, lastRefreshTime);
          if (hasUpdate) {
            needsRefresh = true;
            await clearUpdate(updateType);
          }
        }
        
        if (needsRefresh) {
          loadSellerData();
          setLastRefreshTime(Date.now());
        }
      };
      
      checkForGlobalUpdates();
    }, [lastRefreshTime])
  );

  // Load seller data on mount
  useEffect(() => {
    if (!sellerId) {
      setError('Seller ID is missing');
      setIsLoading(false);
      return;
    }
    
    // Get user email for comparison
    AsyncStorage.getItem('userEmail').then(email => {
      if (email) {
        setUserEmail(email);
      }
    });
    
    loadSellerData();
  }, [sellerId]);

  // Load seller data from API
  const loadSellerData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetchUserProfile(sellerId);
      
      if (response && response.user) {
        setSellerData(response.user);
      } else {
        setError('Failed to load seller profile');
      }
    } catch (error) {
      console.error('Error loading seller data:', error);
      setError('Failed to load seller profile. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Handle refresh
  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadSellerData();
    setLastRefreshTime(Date.now());
  };

  // Start a conversation with the seller
  const startConversation = async () => {
    try {
      // Check if user is logged in
      if (!userEmail) {
        Alert.alert('Sign In Required', 'Please sign in to message sellers.');
        return;
      }
      
      // Don't allow messaging yourself
      if (userEmail === sellerId) {
        Alert.alert('Error', 'You cannot message yourself.');
        return;
      }
      
      // Navigate to Messages tab with seller info
      navigation.navigate('Messages', { 
        sellerId: sellerId,
        sellerName: sellerData?.name || 'Seller',
        sellerAvatar: sellerData?.avatar
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    }
  };

  // Handle back button press
  const handleBackPress = () => {
    navigation.goBack();
  };
  
  // Handle review submitted
  const handleReviewSubmitted = () => {
    // Refresh seller data to update rating
    loadSellerData();
  };
  
  // Render plant item
  const renderPlantItem = ({ item }) => (
    <PlantCard 
      plant={item} 
      layout={width > 600 ? 'grid' : 'list'} 
    />
  );

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <MarketplaceHeader
          title="Seller Profile"
          showBackButton={true}
          onBackPress={handleBackPress}
          showNotifications={false}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading seller profile...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <MarketplaceHeader
          title="Seller Profile"
          showBackButton={true}
          onBackPress={handleBackPress}
          showNotifications={false}
        />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadSellerData}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Calculate seller location display
  const sellerLocation = sellerData?.location?.city || 
                        (sellerData?.location?.formattedAddress ? 
                          sellerData.location.formattedAddress.split(',')[0] : 
                          'Unknown location');

  // Get active and sold listings
  const activeListings = sellerData?.listings?.filter(listing => 
    listing.status === 'active' || !listing.status
  ) || [];
  
  const soldListings = sellerData?.listings?.filter(listing => 
    listing.status === 'sold'
  ) || [];

  return (
    <View style={styles.container}>
      <MarketplaceHeader
        title="Seller Profile"
        showBackButton={true}
        onBackPress={handleBackPress}
        showNotifications={false}
      />
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={onRefresh} 
            colors={['#4CAF50']} 
            tintColor="#4CAF50" 
          />
        }
      >
        {/* Seller Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileImageContainer}>
              {sellerData?.avatar ? (
                <Image
                  source={{ uri: sellerData.avatar }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.defaultAvatar}>
                  <Text style={styles.avatarInitial}>
                    {sellerData?.name?.charAt(0)?.toUpperCase() || 'S'}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.profileInfo}>
              <Text style={styles.sellerName}>{sellerData?.name || 'Seller'}</Text>
              
              {/* Seller Rating */}
              <View style={styles.ratingContainer}>
                <RatingStars 
                  rating={sellerData?.stats?.rating || 0} 
                  size={18} 
                  color="#FFD700"
                />
                <Text style={styles.ratingText}>
                  {sellerData?.stats?.rating ? sellerData.stats.rating.toFixed(1) : '0.0'}
                  {sellerData?.stats?.reviewCount ? ` (${sellerData.stats.reviewCount})` : ''}
                </Text>
              </View>
              
              {/* Seller Location */}
              <View style={styles.locationContainer}>
                <MaterialIcons name="location-on" size={16} color="#666" />
                <Text style={styles.locationText}>{sellerLocation}</Text>
              </View>
              
              {/* Seller Join Date */}
              {sellerData?.joinDate && (
                <Text style={styles.joinDateText}>
                  Member since {new Date(sellerData.joinDate).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
          
          {/* Seller Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{sellerData?.stats?.plantsCount || 0}</Text>
              <Text style={styles.statLabel}>Plants</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{sellerData?.stats?.salesCount || 0}</Text>
              <Text style={styles.statLabel}>Sales</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {sellerData?.stats?.responseRate ? `${sellerData.stats.responseRate}%` : 'N/A'}
              </Text>
              <Text style={styles.statLabel}>Response</Text>
            </View>
          </View>
          
          {/* Contact Button */}
          {userEmail !== sellerId && (
            <TouchableOpacity
              style={styles.contactButton}
              onPress={startConversation}
            >
              <MaterialIcons name="chat" size={18} color="#fff" />
              <Text style={styles.contactButtonText}>Message Seller</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Seller Bio if available */}
        {sellerData?.bio && (
          <View style={styles.bioCard}>
            <Text style={styles.bioTitle}>About</Text>
            <Text style={styles.bioText}>{sellerData.bio}</Text>
          </View>
        )}
        
        {/* Reviews Section */}
        <View style={styles.reviewsCard}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.reviewsTitle}>Reviews</Text>
            {userEmail && userEmail !== sellerId && (
              <TouchableOpacity
                style={styles.writeReviewButton}
                onPress={() => setShowReviewForm(true)}
              >
                <MaterialIcons name="rate-review" size={16} color="#4CAF50" />
                <Text style={styles.writeReviewText}>Write a Review</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <ReviewsList
            targetType="seller"
            targetId={sellerId}
            onAddReview={() => setShowReviewForm(true)}
            onReviewsLoaded={(data) => {
              // Update seller stats if available
              if (data && sellerData) {
                setSellerData({
                  ...sellerData,
                  stats: {
                    ...sellerData.stats,
                    rating: data.averageRating,
                    reviewCount: data.count
                  }
                });
              }
            }}
          />
        </View>

        {/* Listings Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              currentTab === 'active' && styles.activeTabButton,
            ]}
            onPress={() => setCurrentTab('active')}
          >
            <Text
              style={[
                styles.tabText,
                currentTab === 'active' && styles.activeTabText,
              ]}
            >
              Active Listings ({activeListings.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tabButton,
              currentTab === 'sold' && styles.activeTabButton,
            ]}
            onPress={() => setCurrentTab('sold')}
          >
            <Text
              style={[
                styles.tabText,
                currentTab === 'sold' && styles.activeTabText,
              ]}
            >
              Sold Items ({soldListings.length})
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Listings Content */}
        <View style={styles.listingsContainer}>
          {currentTab === 'active' ? (
            activeListings.length > 0 ? (
              <FlatList
                data={activeListings}
                renderItem={renderPlantItem}
                keyExtractor={item => item.id || item._id}
                numColumns={width > 600 ? 2 : 1}
                key={width > 600 ? 'grid' : 'list'}
                scrollEnabled={false}
                contentContainerStyle={styles.listContent}
              />
            ) : (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateText}>No active listings</Text>
              </View>
            )
          ) : (
            soldListings.length > 0 ? (
              <FlatList
                data={soldListings}
                renderItem={renderPlantItem}
                keyExtractor={item => item.id || item._id}
                numColumns={width > 600 ? 2 : 1}
                key={width > 600 ? 'grid-sold' : 'list-sold'}
                scrollEnabled={false}
                contentContainerStyle={styles.listContent}
              />
            ) : (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateText}>No sold items</Text>
              </View>
            )
          )}
        </View>
      </ScrollView>
      
      {/* Review Form Modal */}
      <ReviewForm
        isVisible={showReviewForm}
        targetType="seller"
        targetId={sellerId}
        onClose={() => setShowReviewForm(false)}
        onReviewSubmitted={handleReviewSubmitted}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  profileCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  profileHeader: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileImageContainer: {
    marginRight: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
  },
  defaultAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  sellerName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingText: {
    marginLeft: 8,
    fontSize: 15,
    color: '#666',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  joinDateText: {
    fontSize: 13,
    color: '#888',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#e0e0e0',
    alignSelf: 'center',
  },
  contactButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    margin: 16,
    paddingVertical: 14,
    borderRadius: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  bioCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  bioTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  reviewsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  writeReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  writeReviewText: {
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  activeTabButton: {
    backgroundColor: '#f0f9f0',
    borderBottomWidth: 3,
    borderBottomColor: '#4CAF50',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  listingsContainer: {
    marginBottom: 20,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  emptyStateContainer: {
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default SellerProfileScreen;