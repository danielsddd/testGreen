import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const CardDetails = ({ plant }) => {
  // Format price as currency
  const formatPrice = (price) => {
    if (typeof price === 'number') {
      return price.toFixed(2);
    } else if (typeof price === 'string') {
      const parsedPrice = parseFloat(price);
      return isNaN(parsedPrice) ? '0.00' : parsedPrice.toFixed(2);
    }
    return '0.00';
  };
  
  // Calculate distance text
  const getDistanceText = () => {
    if (plant.distance) {
      return `${plant.distance.toFixed(1)} km away`;
    }
    return null;
  };

  // Get image source
  const getImageSource = () => {
    const imageUrl = plant.image || plant.imageUrl || (plant.images && plant.images.length > 0 ? plant.images[0] : null);
    return { uri: imageUrl || 'https://via.placeholder.com/100?text=Plant' };
  };

  // Render rating - based on availability
  const renderRating = () => {
    if (!plant.rating || plant.rating === 0) {
      return <Text style={styles.newProductText}>New Product</Text>;
    }
    
    return (
      <View style={styles.ratingContainer}>
        <MaterialIcons name="star" size={14} color="#FFD700" />
        <Text style={styles.ratingText}>
          {typeof plant.rating === 'number' ? plant.rating.toFixed(1) : plant.rating}
          {plant.reviewCount ? ` (${plant.reviewCount})` : ''}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.contentContainer}>
      <Image 
        source={getImageSource()} 
        style={styles.image}
        defaultSource={require('../../../assets/plant-placeholder.png')}
      />
      
      <View style={styles.detailsContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {plant.title || plant.name || 'Plant'}
        </Text>
        
        <Text style={styles.price}>${formatPrice(plant.price)}</Text>
        
        {renderRating()}
        
        <View style={styles.locationContainer}>
          <MaterialIcons name="place" size={14} color="#666" />
          <Text style={styles.locationText} numberOfLines={1}>
            {plant.location?.city || plant.city || 'Unknown location'}
          </Text>
        </View>
        
        {getDistanceText() && (
          <Text style={styles.distanceText}>{getDistanceText()}</Text>
        )}
        
        <Text style={styles.sellerText} numberOfLines={1}>
          Seller: {plant.seller?.name || plant.sellerName || 'Unknown seller'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  detailsContainer: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row', 
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
  },
  newProductText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  distanceText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  sellerText: {
    fontSize: 12,
    color: '#666',
  },
});

export default CardDetails;