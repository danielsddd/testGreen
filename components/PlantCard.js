import React, { useState, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import PlantCardBase from './PlantCard-parts/PlantCardBase';
import RatingDisplay from './PlantCard-parts/RatingDisplay';
import LocationDisplay from './PlantCard-parts/LocationDisplay';
import { UserActionButtons } from './PlantCard-parts/ActionButtons';
import { wishProduct } from '../services/marketplaceApi';
import { triggerUpdate, UPDATE_TYPES } from '../services/MarketplaceUpdates';

const PlantCard = ({ plant, showActions = true, layout = 'grid', isOffline = false }) => {
  const navigation = useNavigation();
  const cardRef = useRef(null);
  const [isFavorite, setIsFavorite] = useState(plant.isFavorite || plant.isWished || false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsFavorite(plant.isFavorite || plant.isWished || false);
  }, [plant.isFavorite, plant.isWished]);

  const handlePress = () => {
    navigation.navigate('PlantDetail', { plantId: plant.id || plant._id });
  };

  const handleSellerPress = (e) => {
    e.stopPropagation();
    navigation.navigate('SellerProfile', {
      sellerId: plant.seller?._id || plant.seller?.id || plant.sellerId || 'unknown',
      sellerData: plant.seller || { name: plant.sellerName || 'Unknown Seller' }
    });
  };

  const toggleFavorite = async (e) => {
    e.stopPropagation();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const newFavoriteState = !isFavorite;
      setIsFavorite(newFavoriteState);

      const result = await wishProduct(plant.id || plant._id);
      if (result && 'isWished' in result) {
        setIsFavorite(result.isWished);
      }

      AsyncStorage.setItem('WISHLIST_UPDATED', Date.now().toString())
        .then(() => {
          triggerUpdate(UPDATE_TYPES.WISHLIST, {
            plantId: plant.id || plant._id,
            isFavorite: newFavoriteState,
            timestamp: Date.now()
          }).catch(e => console.warn('Failed to trigger update:', e));
        })
        .catch(err => console.warn('Failed to set wishlist update flag:', err));
    } catch (err) {
      setIsFavorite(isFavorite);
      console.error('Error updating favorites:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = (e) => {
    e.stopPropagation();
    // Share functionality
  };

  const handleContact = (e) => {
    e.stopPropagation();
    const sellerName = plant.seller?.name || 'Plant Seller';
    navigation.navigate('Messages', {
      sellerId: plant.seller?._id || plant.sellerId,
      plantId: plant.id || plant._id,
      plantName: plant.title || plant.name,
      sellerName
    });
  };

  const handleOpenMap = (e) => {
    e.stopPropagation();
    if (!hasLocationCoordinates()) return;
    navigation.navigate('MapView', {
      products: [plant],
      initialLocation: {
        latitude: plant.location.latitude,
        longitude: plant.location.longitude
      }
    });
  };

  const hasLocationCoordinates = () => {
    return (
      plant.location &&
      typeof plant.location === 'object' &&
      plant.location.latitude &&
      plant.location.longitude
    );
  };

  // Enhanced plant object with render functions
  const enhancedPlant = {
    ...plant,
    renderRating: () => <RatingDisplay rating={plant.rating} reviewCount={plant.reviewCount} />,
    renderLocation: (onOpenMap) => (
      <LocationDisplay 
        location={plant.location} 
        city={plant.city} 
        onOpenMap={onOpenMap} 
      />
    ),
    renderSellerRating: () => (
      <RatingDisplay 
        rating={plant.seller?.rating || 0} 
        reviewCount={plant.seller?.totalReviews || 0} 
      />
    ),
  };

  return (
    <PlantCardBase
      plant={enhancedPlant}
      onPress={handlePress}
      onToggleFavorite={toggleFavorite}
      onSellerPress={handleSellerPress}
      onOpenMap={handleOpenMap}
      isFavorite={isFavorite}
      layout={layout}
      isOffline={isOffline}
      showActions={showActions}
      renderActions={
        <UserActionButtons
          onShare={handleShare}
          onContact={handleContact}
          isSubmitting={isSubmitting}
        />
      }
    />
  );
};

export default PlantCard;