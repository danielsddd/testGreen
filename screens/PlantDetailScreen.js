import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Share,
} from 'react-native';
import { MaterialIcons, FontAwesome, Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';

// Mock API service
const fetchPlantById = async (id) => {
  const plant = SAMPLE_PLANTS.find(plant => plant.id === id);
  return new Promise((resolve) => {
    setTimeout(() => resolve(plant), 500); // Simulating a delay
  });
};

// Sample plant data
const SAMPLE_PLANTS = [
  {
    id: '1',
    name: 'Monstera Deliciosa',
    description: 'Beautiful Swiss Cheese Plant with large fenestrated leaves...',
    price: 29.99,
    images: ['https://via.placeholder.com/400?text=Monstera'],
    sellerName: 'PlantLover123',
    sellerId: 'seller1',
    sellerAvatar: 'https://via.placeholder.com/50?text=User',
    sellerRating: 4.8,
    sellerReviews: 24,
    location: 'Seattle, WA',
    category: 'Indoor Plants',
    listedDate: new Date().toISOString(),
    careInfo: {
      water: 'Once a week',
      light: 'Bright indirect',
      temperature: '65-80°F',
    },
    sellerJoinDate: '2022-03-15T00:00:00Z',
    sellerOtherListings: [
      { id: '2', name: 'Snake Plant', price: 19.99, imageUrl: 'https://via.placeholder.com/150?text=Snake+Plant' },
      { id: '3', name: 'Fiddle Leaf Fig', price: 34.99, imageUrl: 'https://via.placeholder.com/150?text=Fiddle+Leaf' },
    ],
  },
];

const { width } = Dimensions.get('window');

const PlantDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { plantId } = route.params;

  const [plant, setPlant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    loadPlantDetail();
  }, [plantId]);

  const loadPlantDetail = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchPlantById(plantId);

      if (!data) {
        throw new Error('Plant not found');
      }

      setPlant(data);
      setIsFavorite(false); // For now assuming the plant is not in favorites
      setIsLoading(false);
    } catch (err) {
      setError('Failed to load plant details. Please try again later.');
      setIsLoading(false);
      console.error('Error fetching plant details:', err);
    }
  };

  const toggleFavorite = async () => {
    try {
      setIsFavorite(!isFavorite);
    } catch (err) {
      setIsFavorite(!isFavorite); // Revert on error
      Alert.alert('Error', 'Failed to update favorites. Please try again.');
      console.error('Error toggling favorite:', err);
    }
  };

  const handleContactSeller = () => {
    navigation.navigate('Messages', { sellerId: plant.sellerId, plantId: plant.id, plantName: plant.name });
  };

  const handleShareListing = async () => {
    try {
      await Share.share({
        message: `Check out this ${plant.name} on Greener: $${plant.price}`,
        url: `https://greenerapp.com/plants/${plant.id}`,
      });
    } catch (error) {
      Alert.alert('Error', 'Could not share this listing');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading plant details...</Text>
      </View>
    );
  }

  if (error || !plant) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>{error || 'Plant not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadPlantDetail}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const images = plant.images && plant.images.length > 0 ? plant.images : [plant.imageUrl || 'https://via.placeholder.com/400'];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const slideIndex = Math.floor(event.nativeEvent.contentOffset.x / width);
            setActiveImageIndex(slideIndex);
          }}
        >
          {images.map((image, index) => (
            <Image key={index} source={{ uri: image }} style={styles.image} resizeMode="cover" />
          ))}
        </ScrollView>

        {images.length > 1 && (
          <View style={styles.pagination}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[styles.paginationDot, activeImageIndex === index && styles.paginationDotActive]}
              />
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.favoriteButton} onPress={toggleFavorite}>
          <MaterialIcons name={isFavorite ? 'favorite' : 'favorite-border'} size={28} color={isFavorite ? '#f44336' : '#fff'} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareButton} onPress={handleShareListing}>
          <MaterialIcons name="share" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.name}>{plant.name}</Text>
        <Text style={styles.category}>{plant.category}</Text>
        <Text style={styles.price}>${plant.price.toFixed(2)}</Text>

        <View style={styles.statusContainer}>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>Available</Text>
          </View>
          <Text style={styles.listedDate}>
            Listed {plant.listedDate ? new Date(plant.listedDate).toLocaleDateString() : 'recently'}
          </Text>
        </View>

        <View style={styles.locationContainer}>
          <View style={styles.locationHeader}>
            <MaterialIcons name="location-on" size={20} color="#4CAF50" />
            <Text style={styles.locationTitle}>Location</Text>
          </View>
          <Text style={styles.locationText}>{plant.location || 'Local pickup'}</Text>
        </View>

        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{plant.description}</Text>

        <Text style={styles.sectionTitle}>Care Information</Text>
        <View style={styles.careInfoContainer}>
          <View style={styles.careItem}>
            <FontAwesome name="tint" size={24} color="#4CAF50" />
            <Text style={styles.careLabel}>Water</Text>
            <Text style={styles.careValue}>{plant.careInfo?.water || 'Moderate'}</Text>
          </View>
          <View style={styles.careItem}>
            <Ionicons name="sunny" size={24} color="#4CAF50" />
            <Text style={styles.careLabel}>Light</Text>
            <Text style={styles.careValue}>{plant.careInfo?.light || 'Bright indirect'}</Text>
          </View>
          <View style={styles.careItem}>
            <MaterialIcons name="thermostat" size={24} color="#4CAF50" />
            <Text style={styles.careLabel}>Temperature</Text>
            <Text style={styles.careValue}>{plant.careInfo?.temperature || '65-80°F'}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>About the Seller</Text>
        <TouchableOpacity style={styles.sellerContainer} onPress={() => navigation.navigate('SellerProfile', { sellerId: plant.sellerId })}>
          <Image source={{ uri: plant.sellerAvatar || 'https://via.placeholder.com/50' }} style={styles.sellerAvatar} />
          <View style={styles.sellerInfo}>
            <Text style={styles.sellerName}>{plant.sellerName || 'Plant Enthusiast'}</Text>
            <View style={styles.sellerRatingContainer}>
              <MaterialIcons name="star" size={16} color="#FFC107" />
              <Text style={styles.sellerRating}>{plant.sellerRating || '4.8'} ({plant.sellerReviews || '24'} reviews)</Text>
            </View>
            <Text style={styles.sellerMember}>Member since {new Date(plant.sellerJoinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#999" />
        </TouchableOpacity>

        {plant.sellerOtherListings && plant.sellerOtherListings.length > 0 && (
          <View style={styles.otherListingsContainer}>
            <Text style={styles.otherListingsTitle}>More from this seller</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.otherListingsScroll}>
              {plant.sellerOtherListings.map((listing) => (
                <TouchableOpacity key={listing.id} style={styles.otherListingItem} onPress={() => navigation.replace('PlantDetail', { plantId: listing.id })}>
                  <Image source={{ uri: listing.imageUrl }} style={styles.otherListingImage} resizeMode="cover" />
                  <Text style={styles.otherListingName} numberOfLines={1}>{listing.name}</Text>
                  <Text style={styles.otherListingPrice}>${listing.price}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.favoriteActionButton} onPress={toggleFavorite}>
            <MaterialIcons name={isFavorite ? 'favorite' : 'favorite-border'} size={24} color={isFavorite ? '#f44336' : '#4CAF50'} />
            <Text style={styles.actionButtonText}>{isFavorite ? 'Saved' : 'Save'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactButton} onPress={handleContactSeller}>
            <MaterialIcons name="chat" size={24} color="#fff" />
            <Text style={styles.contactButtonText}>Message Seller</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.safetyContainer}>
          <MaterialIcons name="shield" size={20} color="#4CAF50" />
          <Text style={styles.safetyText}>
            <Text style={styles.safetyBold}>Safety Tips: </Text>
            Meet in a public place and inspect the plant before purchasing
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#4CAF50' },
  errorText: { fontSize: 16, color: '#f44336' },
  retryButton: { marginTop: 10, padding: 10, backgroundColor: '#4CAF50', borderRadius: 5 },
  retryText: { color: '#fff' },
  imageContainer: { position: 'relative' },
  image: { width, height: 250 },
  pagination: { position: 'absolute', bottom: 10, flexDirection: 'row', alignSelf: 'center' },
  paginationDot: { width: 8, height: 8, margin: 4, backgroundColor: '#fff', borderRadius: 4 },
  paginationDotActive: { backgroundColor: '#4CAF50' },
  favoriteButton: { position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(0, 0, 0, 0.5)', borderRadius: 50, padding: 10 },
  backButton: { position: 'absolute', top: 20, left: 20, backgroundColor: 'rgba(0, 0, 0, 0.5)', borderRadius: 50, padding: 10 },
  shareButton: { position: 'absolute', top: 20, right: 70, backgroundColor: 'rgba(0, 0, 0, 0.5)', borderRadius: 50, padding: 10 },
  infoContainer: { padding: 16 },
  name: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  category: { fontSize: 16, color: '#777' },
  price: { fontSize: 20, color: '#4CAF50', marginVertical: 10 },
  statusContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  statusPill: { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#a5d6a7', borderRadius: 10 },
  statusText: { fontSize: 14, color: '#fff' },
  listedDate: { fontSize: 14, color: '#999' },
  locationContainer: { marginTop: 16 },
  locationHeader: { flexDirection: 'row', alignItems: 'center' },
  locationTitle: { fontSize: 16, marginLeft: 8 },
  locationText: { fontSize: 14, color: '#555' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 10 },
  description: { fontSize: 14, color: '#333' },
  careInfoContainer: { marginTop: 10 },
  careItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  careLabel: { fontSize: 16, marginLeft: 8 },
  careValue: { fontSize: 14, color: '#777' },
  sellerContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 20, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 10 },
  sellerAvatar: { width: 50, height: 50, borderRadius: 25 },
  sellerInfo: { marginLeft: 10, flex: 1 },
  sellerName: { fontSize: 16, fontWeight: 'bold' },
  sellerRatingContainer: { flexDirection: 'row', alignItems: 'center' },
  sellerRating: { fontSize: 14, marginLeft: 5 },
  sellerMember: { fontSize: 12, color: '#888' },
  otherListingsContainer: { marginTop: 20 },
  otherListingsTitle: { fontSize: 16, fontWeight: 'bold' },
  otherListingsScroll: { marginTop: 10 },
  otherListingItem: { marginRight: 10 },
  otherListingImage: { width: 100, height: 100, borderRadius: 10 },
  otherListingName: { fontSize: 14, marginTop: 5 },
  otherListingPrice: { fontSize: 14, color: '#4CAF50' },
  seeAllButton: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  seeAllText: { fontSize: 14, color: '#4CAF50' },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  favoriteActionButton: { flexDirection: 'row', alignItems: 'center' },
  actionButtonText: { fontSize: 16, color: '#4CAF50', marginLeft: 5 },
  contactButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4CAF50', borderRadius: 5, padding: 10 },
  contactButtonText: { color: '#fff', marginLeft: 5 },
  safetyContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  safetyText: { fontSize: 14, marginLeft: 5 },
  safetyBold: { fontWeight: 'bold' },
});

export default PlantDetailScreen;
