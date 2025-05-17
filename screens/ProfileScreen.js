// screens/ProfileScreen.js - Updated with RatingStars
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import components
import MarketplaceHeader from '../components/MarketplaceHeader';
import PlantCard from '../components/PlantCard';
import RatingStars from '../components/RatingStars';

// Import services
import { fetchUserProfile, getUserListings, getUserWishlist } from '../services/marketplaceApi';

/**
 * ProfileScreen - User profile screen
 */
const ProfileScreen = ({ navigation }) => {
  // State
  const [userProfile, setUserProfile] = useState(null);
  const [userListings, setUserListings] = useState([]);
  const [userWishlist, setUserWishlist] = useState([]);
  const [activeTab, setActiveTab] = useState('listings');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Load user data on mount
  useEffect(() => {
    loadUserData();

    // Listen for profile updates
    const unsubscribe = navigation.addListener('focus', () => {
      checkProfileUpdates();
    });

    return unsubscribe;
  }, [navigation]);

  // Check if profile was updated
  const checkProfileUpdates = async () => {
    try {
      const profileUpdated = await AsyncStorage.getItem('PROFILE_UPDATED');
      if (profileUpdated) {
        // Clear the flag
        await AsyncStorage.removeItem('PROFILE_UPDATED');
        // Reload data
        loadUserData();
      }
    } catch (error) {
      console.warn('Error checking profile updates:', error);
    }
  };

  // Load user data from API
  const loadUserData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get user email
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      if (!userEmail) {
        setError('You need to be logged in to view your profile.');
        setIsLoading(false);
        return;
      }

      // Load user profile
      const profileData = await fetchUserProfile(userEmail);
      setUserProfile(profileData.user);

      // Load user listings
      const listingsData = await getUserListings();
      setUserListings(listingsData.active || []);

      // Load user wishlist
      const wishlistData = await getUserWishlist();
      setUserWishlist(wishlistData.wishlist || []);
    } catch (error) {
      console.error('Error loading user data:', error);
      setError('Failed to load profile data. Please try again later.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Handle refresh
  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadUserData();
  };

  // Navigate to edit profile
  const handleEditProfile = () => {
    navigation.navigate('EditProfile', { userProfile });
  };

  // Sign out
  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear authentication data
              await AsyncStorage.removeItem('userEmail');
              await AsyncStorage.removeItem('googleAuthToken');
              
              // Navigate to authentication screen or reload app
              // This will depend on your app structure
              Alert.alert('Signed Out', 'You have been signed out successfully.');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Loading state
  if (isLoading && !userProfile) {
    return (
      <View style={styles.container}>
        <MarketplaceHeader
          title="Profile"
          showBackButton={false}
          showNotifications={false}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error && !userProfile) {
    return (
      <View style={styles.container}>
        <MarketplaceHeader
          title="Profile"
          showBackButton={false}
          showNotifications={false}
        />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadUserData}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Calculate user location display
  const userLocation = userProfile?.location?.city || 
                      (userProfile?.location?.formattedAddress ? 
                        userProfile.location.formattedAddress.split(',')[0] : 
                        'Unknown location');

  // Get user rating and review count
  const userRating = userProfile?.stats?.rating || 0;
  const reviewCount = userProfile?.stats?.reviewCount || 0;

  return (
    <View style={styles.container}>
      <MarketplaceHeader
        title="Profile"
        showBackButton={false}
        showNotifications={false}
      />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.profileImageContainer}>
            {userProfile?.avatar ? (
              <Image
                source={{ uri: userProfile.avatar }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.defaultAvatar}>
                <Text style={styles.avatarInitial}>
                  {userProfile?.name?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userProfile?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{userProfile?.email || ''}</Text>
            
            {/* Display Location */}
            <View style={styles.locationContainer}>
              <MaterialIcons name="location-on" size={16} color="#666" />
              <Text style={styles.locationText}>{userLocation}</Text>
            </View>
            
            {/* Rating with Stars */}
            <View style={styles.ratingContainer}>
              <RatingStars 
                rating={userRating} 
                size={16} 
                color="#FFD700"
              />
              <Text style={styles.ratingText}>
                {userRating.toFixed(1)}
                {reviewCount > 0 && ` (${reviewCount})`}
              </Text>
            </View>
            
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{userProfile?.stats?.plantsCount || 0}</Text>
                <Text style={styles.statLabel}>Plants</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{userProfile?.stats?.salesCount || 0}</Text>
                <Text style={styles.statLabel}>Sales</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={handleEditProfile}
          >
            <MaterialIcons name="edit" size={18} color="#fff" />
            <Text style={styles.editProfileButtonText}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <MaterialIcons name="logout" size={18} color="#666" />
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'listings' && styles.activeTabButton,
            ]}
            onPress={() => setActiveTab('listings')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'listings' && styles.activeTabText,
              ]}
            >
              My Listings
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'wishlist' && styles.activeTabButton,
            ]}
            onPress={() => setActiveTab('wishlist')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'wishlist' && styles.activeTabText,
              ]}
            >
              Wishlist
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content based on active tab */}
        {activeTab === 'listings' ? (
          <View style={styles.contentContainer}>
            {userListings.length > 0 ? (
              userListings.map((plant) => (
                <PlantCard key={plant.id} plant={plant} />
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <MaterialCommunityIcons name="leaf-off" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>
                  You don't have any listings yet
                </Text>
                <TouchableOpacity
                  style={styles.addPlantButton}
                  onPress={() => navigation.navigate('AddPlant')}
                >
                  <Text style={styles.addPlantButtonText}>Add a Plant</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.contentContainer}>
            {userWishlist.length > 0 ? (
              userWishlist.map((plant) => (
                <PlantCard key={plant.id} plant={plant} />
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <MaterialIcons name="favorite-border" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>
                  Your wishlist is empty
                </Text>
                <TouchableOpacity
                  style={styles.browseButton}
                  onPress={() => navigation.navigate('MarketplaceHome')}
                >
                  <Text style={styles.browseButtonText}>Browse Plants</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  profileHeader: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
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
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  statItem: {
    alignItems: 'center',
    marginRight: 24,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#e0e0e0',
    marginRight: 24,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  editProfileButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 4,
    marginRight: 8,
  },
  editProfileButtonText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 8,
  },
  signOutButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    marginLeft: 8,
  },
  signOutButtonText: {
    color: '#666',
    fontWeight: '500',
    marginLeft: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: '#4CAF50',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#4CAF50',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyStateContainer: {
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  addPlantButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  addPlantButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  browseButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  browseButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
});

export default ProfileScreen;