// screens/ProfileScreen.js
import React, { useState, useEffect, useCallback } from 'react';
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
  Dimensions,
  FlatList,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

// Import components
import MarketplaceHeader from '../components/MarketplaceHeader';
import PlantCard from '../components/PlantCard';
import RatingStars from '../components/RatingStars';

// Import services
import { fetchUserProfile, getUserListings, getUserWishlist } from '../services/marketplaceApi';
import { checkForUpdate, clearUpdate, UPDATE_TYPES } from '../services/MarketplaceUpdates';

const { width } = Dimensions.get('window');

/**
 * ProfileScreen - User profile screen with enhanced UI and functionality
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
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());

  // Check for updates when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      checkProfileUpdates();
      checkWishlistUpdates();
      
      // Check for global updates
      const checkForGlobalUpdates = async () => {
        const updateTypes = [
          UPDATE_TYPES.PROFILE, 
          UPDATE_TYPES.WISHLIST,
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
          loadUserData();
          setLastRefreshTime(Date.now());
        }
      };
      
      checkForGlobalUpdates();
    }, [lastRefreshTime])
  );

  // Load user data on mount
  useEffect(() => {
    loadUserData();
  }, []);

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

  // Check if wishlist was updated
  const checkWishlistUpdates = async () => {
    try {
      const wishlistUpdated = await AsyncStorage.getItem('FAVORITES_UPDATED') || 
                            await AsyncStorage.getItem('WISHLIST_UPDATED');
      
      if (wishlistUpdated) {
        // Clear flags
        await AsyncStorage.removeItem('FAVORITES_UPDATED');
        await AsyncStorage.removeItem('WISHLIST_UPDATED');
        // Reload wishlist
        loadWishlistData();
      }
    } catch (error) {
      console.warn('Error checking wishlist updates:', error);
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
      if (profileData && profileData.user) {
        setUserProfile(profileData.user);
      } else {
        throw new Error('Failed to load profile data');
      }

      // Load user listings
      await loadListingsData();
      
      // Load user wishlist
      await loadWishlistData();
      
    } catch (error) {
      console.error('Error loading user data:', error);
      setError('Failed to load profile data. Please try again later.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  // Load user listings 
  const loadListingsData = async () => {
    try {
      const listingsData = await getUserListings();
      if (listingsData && listingsData.active) {
        setUserListings(listingsData.active || []);
      }
    } catch (error) {
      console.error('Error loading user listings:', error);
    }
  };
  
  // Load user wishlist
  const loadWishlistData = async () => {
    try {
      const wishlistData = await getUserWishlist();
      if (wishlistData && wishlistData.wishlist) {
        setUserWishlist(wishlistData.wishlist || []);
      }
    } catch (error) {
      console.error('Error loading user wishlist:', error);
    }
  };

  // Handle refresh
  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadUserData();
    setLastRefreshTime(Date.now());
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
  
  // Render item for FlatList
  const renderItem = ({ item }) => (
    <PlantCard 
      plant={item} 
      layout={width > 600 ? 'grid' : 'list'}
    />
  );

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
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={onRefresh} 
            colors={['#4CAF50']} 
            tintColor="#4CAF50" 
          />
        }
      >
        {/* Profile Card with Shadow */}
        <View style={styles.profileCard}>
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
            </View>
          </View>
          
          {/* Stats Section */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{userProfile?.stats?.plantsCount || 0}</Text>
              <Text style={styles.statLabel}>Plants</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{userProfile?.stats?.salesCount || 0}</Text>
              <Text style={styles.statLabel}>Sales</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{userWishlist.length || 0}</Text>
              <Text style={styles.statLabel}>Wishlist</Text>
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
        </View>

        {/* Bio Section if available */}
        {userProfile?.bio && (
          <View style={styles.bioCard}>
            <Text style={styles.bioTitle}>About</Text>
            <Text style={styles.bioText}>{userProfile.bio}</Text>
          </View>
        )}

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
              My Listings ({userListings.length})
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
              Wishlist ({userWishlist.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content based on active tab */}
        <View style={styles.contentContainer}>
          {activeTab === 'listings' ? (
            userListings.length > 0 ? (
              <FlatList
                data={userListings}
                renderItem={renderItem}
                keyExtractor={item => item.id || item._id}
                numColumns={width > 600 ? 2 : 1}
                key={width > 600 ? 'grid' : 'list'}
                scrollEnabled={false} // Disable scrolling as it's inside ScrollView
                contentContainerStyle={styles.listContainer}
              />
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
            )
          ) : (
            userWishlist.length > 0 ? (
              <FlatList
                data={userWishlist}
                renderItem={renderItem}
                keyExtractor={item => item.id || item._id}
                numColumns={width > 600 ? 2 : 1}
                key={width > 600 ? 'grid-wish' : 'list-wish'}
                scrollEnabled={false} // Disable scrolling as it's inside ScrollView
                contentContainerStyle={styles.listContainer}
              />
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
            )
          )}
        </View>
      </ScrollView>
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
    fontWeight: '500',
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
  profileName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
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
  },
  ratingText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
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
    backgroundColor: '#e0e0e0',
    height: '80%',
    alignSelf: 'center',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    padding: 16,
  },
  editProfileButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  editProfileButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  signOutButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginLeft: 8,
  },
  signOutButtonText: {
    color: '#666',
    fontWeight: '600',
    marginLeft: 8,
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
  contentContainer: {
    paddingBottom: 20,
  },
  listContainer: {
    paddingHorizontal: 12,
  },
  emptyStateContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
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
    marginTop: 16,
    marginBottom: 20,
  },
  addPlantButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  addPlantButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  browseButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default ProfileScreen;