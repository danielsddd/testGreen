import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  TouchableOpacity 
} from 'react-native';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { wishProduct } from '../services/productData';

const PlantCard = ({ plant, showActions = true }) => {
  const navigation = useNavigation();
  const [isFavorite, setIsFavorite] = useState(plant.isFavorite || false);

  const handleViewDetails = () => {
    navigation.navigate('PlantDetail', { 
      plantId: plant.id || plant._id,
      category: plant.category
    });
  };

  const handleToggleFavorite = async () => {
    try {
      // Toggle state immediately for better UI experience
      setIsFavorite(!isFavorite);
      
      // Call the API to update wishlist status
      await wishProduct(plant.id || plant._id);
    } catch (error) {
      // Revert state if the API call fails
      setIsFavorite(isFavorite);
      console.error('Failed to update wishlist:', error);
    }
  };

  const handleStartChat = () => {
    navigation.navigate('Messages', { 
      sellerId: plant.sellerId || plant.seller?.id,
      plantId: plant.id || plant._id,
      plantName: plant.name || plant.title
    });
  };

  // Format location display
  const getLocationText = () => {
    if (typeof plant.location === 'string') {
      return plant.location;
    } else if (plant.location && typeof plant.location === 'object') {
      return plant.location.city || 'Local pickup';
    } else if (plant.city) {
      return plant.city;
    }
    return 'Local pickup';
  };

  // Format price display
  const formatPrice = () => {
    const price = parseFloat(plant.price);
    return isNaN(price) ? '0.00' : price.toFixed(2);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={handleViewDetails}
    >
      <Image
        source={{ 
          uri: plant.imageUrl || plant.image || 'https://via.placeholder.com/150?text=Plant' 
        }}
        style={styles.image}
        resizeMode="cover"
      />
      
      {/* Location pill */}
      <View style={styles.locationPill}>
        <MaterialIcons name="location-on" size={12} color="#fff" />
        <Text style={styles.locationText} numberOfLines={1}>
          {getLocationText()}
        </Text>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {plant.name || plant.title}
        </Text>
        <Text style={styles.category} numberOfLines={1}>
          {plant.category}
        </Text>
        <Text style={styles.price}>${formatPrice()}</Text>
        
        <View style={styles.sellerInfo}>
          <Text style={styles.sellerName} numberOfLines={1}>
            {plant.sellerName || plant.seller?.name || 'Plant Seller'}
          </Text>
          <Text style={styles.listingDate}>
            {plant.listedDate ? new Date(plant.listedDate).toLocaleDateString() : 
             plant.addedAt ? new Date(plant.addedAt).toLocaleDateString() : 
             'Recently listed'}
          </Text>
        </View>
        
        {/* Display rating if available */}
        {plant.rating && (
          <View style={styles.ratingContainer}>
            <FontAwesome name="star" size={14} color="#FFD700" />
            <Text style={styles.ratingText}>
              {typeof plant.rating === 'number' ? plant.rating.toFixed(1) : plant.rating}
            </Text>
          </View>
        )}
        
        {showActions && (
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleToggleFavorite}
            >
              <MaterialIcons 
                name={isFavorite ? "favorite" : "favorite-border"} 
                size={24} 
                color={isFavorite ? "#f44336" : "#4CAF50"} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleStartChat}
            >
              <MaterialIcons name="chat" size={24} color="#4CAF50" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '46%', // Adjust width to fit 2 columns with margins
  },
  image: {
    height: 150,
    width: '100%',
  },
  locationPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  locationText: {
    color: '#fff',
    fontSize: 10,
    marginLeft: 3,
    maxWidth: 90,
  },
  infoContainer: {
    padding: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  category: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  sellerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sellerName: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  listingDate: {
    fontSize: 10,
    color: '#999',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#888',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    padding: 6,
  },
});

export default PlantCard;