// screens/SellerProfileScreen.js
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import components
import MarketplaceHeader from '../components/MarketplaceHeader';
import PlantCard from '../components/PlantCard';
import RatingStars from '../components/RatingStars';

// Import services
import { fetchUserProfile } from '../services/marketplaceApi';

/**
 * SellerProfileScreen - View a seller's profile
 */
const SellerProfileScreen = ({ navigation, route }) => {
  // Get seller ID from params
  const sellerId = route.params?.sellerId;
  
  // State
  const [sellerData, setSellerData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTab, setCurrentTab] = useState('active');

  // Load seller data on mount
  useEffect(() => {
    if (!sellerId) {
      setError('Seller ID is missing');
      setIsLoading(false);
      return;
    }
    
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
    }
  };

  // Start a conversation with the seller
  const startConversation = async () => {
    try {
      // Check if user is logged in
      const userEmail = await AsyncStorage.getItem('userEmail');
      
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
        screen: 'Conversation',
        params: { 
          receiver: sellerId,
          receiverName: sellerData?.name || 'Seller',
          receiverAvatar: sellerData?.avatar
        }
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
      
      <ScrollView style={styles.scrollView}>
        {/* Seller Profile Header */}
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
                size={16} 
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
        <TouchableOpacity
          style={styles.contactButton}
          onPress={startConversation}
        >
          <MaterialIcons name="chat" size={18} color="#fff" />
          <Text style={styles.contactButtonText}>Message Seller</Text>
        </TouchableOpacity>
        
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
              activeListings.map(listing => (
                <PlantCard key={listing.id} plant={listing} />
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateText}>No active listings</Text>
              </View>
            )
          ) : (
            soldListings.length > 0 ? (
              soldListings.map(listing => (
                <PlantCard key={listing.id} plant={listing} />
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateText}>No sold items</Text>
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
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  joinDateText: {
    fontSize: 12,
    color: '#999',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    marginTop: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
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
  },
  contactButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    margin: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 8,
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
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#4CAF50',
  },
  listingsContainer: {
    padding: 16,
  },
  emptyStateContainer: {
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default SellerProfileScreen;