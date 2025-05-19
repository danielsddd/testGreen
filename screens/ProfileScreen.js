// screens/ProfileScreen.js (refactored)
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, FlatList, TouchableOpacity, SafeAreaView, ScrollView, StyleSheet
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import components
import MarketplaceHeader from '../components/MarketplaceHeader';
import PlantCard from '../components/PlantCard';
import ReviewsList from '../components/ReviewsList';

// Import extracted components
import ProfileHeader from './ProfileScreen-parts/ProfileHeader';
import StatsRow from './ProfileScreen-parts/StatsRow';
import ProfileTabs from './ProfileScreen-parts/ProfileTabs';
import EmptyState from './ProfileScreen-parts/EmptyState';
import LoadingError from './ProfileScreen-parts/LoadingError';

// Import services
import { fetchUserProfile } from '../services/marketplaceApi';
import { checkForUpdate, clearUpdate, UPDATE_TYPES, addUpdateListener, removeUpdateListener } from '../services/MarketplaceUpdates';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('myPlants');
  const [ratingData, setRatingData] = useState({ average: 0, count: 0 });
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // Set up update listener
  useEffect(() => {
    const listenerId = 'profile-screen';
    const handleUpdate = (updateType, data) => {
      console.log(`[ProfileScreen] Received update: ${updateType}`, data);
      if ([UPDATE_TYPES.PROFILE, UPDATE_TYPES.WISHLIST, UPDATE_TYPES.PRODUCT, UPDATE_TYPES.REVIEW].includes(updateType)) {
        loadUserProfile();
      }
    };
    addUpdateListener(listenerId, handleUpdate);
    return () => {
      removeUpdateListener(listenerId);
    };
  }, []);

  // Enhanced focus effect to check for updates and refresh
  useFocusEffect(
    useCallback(() => {
      loadUserProfile();
      
      const checkUpdates = async () => {
        try {
          // Check various update flags directly
          const wishlistUpdated = await AsyncStorage.getItem('WISHLIST_UPDATED');
          const favoritesUpdated = await AsyncStorage.getItem('FAVORITES_UPDATED');
          const profileUpdated = await AsyncStorage.getItem('PROFILE_UPDATED');
          const reviewUpdated = await AsyncStorage.getItem('REVIEW_UPDATED');
          const productUpdated = await AsyncStorage.getItem('PRODUCT_UPDATED');
          
          const needsRefresh = wishlistUpdated || favoritesUpdated || 
                              profileUpdated || reviewUpdated || 
                              productUpdated || route.params?.refresh;
          
          if (needsRefresh) {
            // Clear all update flags
            await Promise.all([
              AsyncStorage.removeItem('WISHLIST_UPDATED'),
              AsyncStorage.removeItem('FAVORITES_UPDATED'),
              AsyncStorage.removeItem('PROFILE_UPDATED'),
              AsyncStorage.removeItem('REVIEW_UPDATED'),
              AsyncStorage.removeItem('PRODUCT_UPDATED')
            ]);
            
            // Reload user profile
            await loadUserProfile();
            setLastUpdateTime(Date.now());
            
            // Clear refresh param if present
            if (route.params?.refresh) {
              navigation.setParams({ refresh: undefined });
            }
          }
        } catch (error) {
          console.error('[ProfileScreen] Error checking for updates:', error);
        }
      };
      
      checkUpdates();
    }, [navigation, route.params?.refresh])
  );

  // Load user profile data
  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (!userEmail) {
        throw new Error('User email not found in storage');
      }
      
      const data = await fetchUserProfile(userEmail);
      
      if (data && data.user) {
        setUser(data.user);
        
        // Normalize listings data to ensure consistent structure
        if (data.user.listings) {
          data.user.listings.forEach(listing => {
            if (!listing.seller) {
              listing.seller = {
                name: data.user.name,
                _id: data.user.id || data.user.email,
                email: data.user.email,
                avatar: data.user.avatar
              };
            }
          });
        }
      } else {
        throw new Error('User data not found in API response');
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('[ProfileScreen] Error loading profile:', err);
      setError('Failed to load profile. Please try again later.');
      setIsLoading(false);
    }
  };

  // Handle review data updates
  const handleReviewsLoaded = (data) => {
    if (data && typeof data === 'object') {
      setRatingData({
        average: data.averageRating || 0,
        count: data.count || 0
      });
    }
  };

  // Render plant list
  const renderPlantList = (plants) => (
    <FlatList
      data={plants}
      renderItem={({ item }) => <PlantCard plant={item} showActions={false} />}
      keyExtractor={item => item.id || item._id || `plant-${Math.random()}`}
      numColumns={2}
      contentContainerStyle={styles.plantGrid}
    />
  );

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'myPlants': {
        const activePlants = user.listings?.filter(plant => plant.status === 'active') || [];
        return activePlants.length ? renderPlantList(activePlants) : 
          <EmptyState 
            icon="eco" 
            message="You don't have any active listings" 
            buttonText="Add a Plant" 
            onButtonPress={() => navigation.navigate('AddPlant')} 
          />;
      }
      case 'favorites': {
        return user.favorites?.length ? renderPlantList(user.favorites) :
          <EmptyState 
            icon="favorite-border" 
            message="You don't have any saved plants" 
            buttonText="Browse Plants" 
            onButtonPress={() => navigation.navigate('MarketplaceHome')} 
          />;
      }
      case 'sold': {
        const soldPlants = user.listings?.filter(plant => plant.status === 'sold') || [];
        return soldPlants.length ? renderPlantList(soldPlants) :
          <EmptyState icon="local-offer" message="You haven't sold any plants yet" />;
      }
      case 'reviews': {
        return (
          <ReviewsList
            targetType="seller"
            targetId={user.email || user.id}
            onReviewsLoaded={handleReviewsLoaded}
            autoLoad={true}
          />
        );
      }
      default:
        return null;
    }
  };

  // Loading and error states
  if (isLoading && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader title="My Profile" showBackButton onBackPress={() => navigation.goBack()} onNotificationsPress={() => navigation.navigate('Messages')} />
        <LoadingError isLoading={true} />
      </SafeAreaView>
    );
  }

  if (error && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader title="My Profile" showBackButton onBackPress={() => navigation.goBack()} onNotificationsPress={() => navigation.navigate('Messages')} />
        <LoadingError error={error} onRetry={loadUserProfile} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader 
        title="My Profile" 
        showBackButton 
        onBackPress={() => navigation.goBack()} 
        onNotificationsPress={() => navigation.navigate('Messages')} 
      />
      <ScrollView>
        <ProfileHeader 
          user={user} 
          onEditProfile={() => navigation.navigate('EditProfile')} 
        />
        
        <StatsRow 
          stats={{
            plantsCount: user.stats?.plantsCount || 0,
            salesCount: user.stats?.salesCount || 0,
            rating: ratingData.average > 0 ? ratingData.average : (user.stats?.rating || 0),
            reviewsCount: ratingData.count || 0
          }} 
        />
        
        <ProfileTabs 
          activeTab={activeTab} 
          onTabPress={setActiveTab} 
        />
        
        <View style={styles.tabContent}>
          {renderTabContent()}
        </View>
      </ScrollView>
      
      <TouchableOpacity 
        style={styles.addPlantButton} 
        onPress={() => navigation.navigate('AddPlant')}
        accessible={true}
        accessibilityLabel="Add a new plant"
        accessibilityRole="button"
      >
        <MaterialIcons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5' 
  },
  tabContent: { 
    flex: 1, 
    padding: 8,
    minHeight: 300,
  },
  plantGrid: { 
    paddingBottom: 80 
  },
  addPlantButton: {
    position: 'absolute', 
    bottom: 16, 
    right: 16, 
    backgroundColor: '#4CAF50',
    borderRadius: 30, 
    padding: 16, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 4,
  },
});

export default ProfileScreen;