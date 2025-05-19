import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';

const PlantCardBase = ({
  plant,
  onPress,
  onToggleFavorite,
  onSellerPress,
  onOpenMap,
  isFavorite,
  layout = 'grid',
  isOffline = false,
  showActions = true,
  renderActions
}) => {
  const isList = layout === 'list';

  const formatDate = (dateString) => {
    if (!dateString) return 'Recently';
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return 'Recently';
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isList && styles.listCard,
        isOffline && styles.offlineCard,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.imageContainer, isList && styles.listImageContainer]}>
        <Image
          source={{ uri: plant.image || plant.imageUrl || 'https://via.placeholder.com/150?text=Plant' }}
          style={isList ? styles.listImage : styles.image}
          resizeMode="contain"
        />
        {isOffline && (
          <View style={styles.offlineIndicator}>
            <MaterialIcons name="cloud-off" size={12} color="#fff" />
          </View>
        )}
        <TouchableOpacity style={styles.favoriteButton} onPress={onToggleFavorite}>
          <MaterialIcons
            name={isFavorite ? 'favorite' : 'favorite-border'}
            size={18}
            color={isFavorite ? '#f44336' : '#fff'}
          />
        </TouchableOpacity>
      </View>

      <View style={isList ? styles.listInfoContainer : styles.infoContainer}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, isList && styles.listName]} numberOfLines={isList ? 2 : 1}>
            {plant.title || plant.name}
          </Text>
          <Text style={styles.price}>${parseFloat(plant.price).toFixed(2)}</Text>
        </View>

        {/* Render slots for custom components */}
        {plant.renderRating && plant.renderRating()}

        {plant.renderLocation && plant.renderLocation(onOpenMap)}

        {!isList && <Text style={styles.category} numberOfLines={1}>{plant.category}</Text>}

        <View style={styles.sellerRow}>
          <TouchableOpacity onPress={onSellerPress} style={styles.sellerInfoContainer}>
            <Text style={styles.sellerName} numberOfLines={1}>
              {plant.seller?.name || plant.sellerName || 'Unknown Seller'}
            </Text>
            {plant.renderSellerRating && plant.renderSellerRating()}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.date}>
            {formatDate(plant.addedAt || plant.listedDate)}
          </Text>
          {showActions && renderActions}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
    card: {
      backgroundColor: '#fff',
      borderRadius: 8,
      margin: 8,
      overflow: 'hidden',
      flex: 1,
      maxWidth: Platform.OS === 'web' ? '31%' : '47%',
      ...(Platform.OS === 'web'
        ? { boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }
        : Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
            },
            android: {
              elevation: 2,
            },
          })),
    },
    listCard: {
      flexDirection: 'row',
      maxWidth: '100%',
      height: 130,
    },
    offlineCard: {
      opacity: 0.9,
      ...(Platform.OS === 'android' ? { elevation: 1 } : {}),
    },
    imageContainer: {
      position: 'relative',
    },
    listImageContainer: {
      width: 130,
    },
    image: {
      height: 180,
      width: '100%',
      backgroundColor: '#f0f0f0',
    },
    listImage: {
      height: 130,
      width: 130,
      backgroundColor: '#f0f0f0',
    },
    offlineIndicator: {
      position: 'absolute',
      bottom: 8,
      left: 8,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 12,
      padding: 4,
    },
    favoriteButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.4)',
      borderRadius: 16,
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoContainer: {
      padding: 12,
    },
    listInfoContainer: {
      flex: 1,
      padding: 12,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 4,
    },
    name: {
      fontSize: 16,
      fontWeight: 'bold',
      flex: 1,
      marginRight: 8,
      color: '#333',
    },
    listName: {
      fontSize: 17,
    },
    price: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#4CAF50',
    },
    productRatingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    reviewCount: {
      fontSize: 12,
      color: '#888',
      marginLeft: 4,
    },
    newProductText: {
      fontSize: 12,
      color: '#888',
      fontStyle: 'italic',
      marginBottom: 6,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    locationText: {
      fontSize: 12,
      color: '#666',
      marginLeft: 4,
      flex: 1,
    },
    mapButton: {
      backgroundColor: '#388E3C',
      borderRadius: 6,
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginLeft: 8,
      ...Platform.select({
        web: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
        },
        android: {
          elevation: 1,
        },
      }),
    },
    category: {
      fontSize: 14,
      color: '#666',
      marginBottom: 8,
    },
    sellerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    sellerInfoContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    sellerName: {
      fontSize: 12,
      color: '#666',
      fontWeight: '500',
    },
    sellerRatingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sellerRatingText: {
      marginLeft: 4,
      fontSize: 12,
      color: '#888',
    },
    newSellerText: {
      fontSize: 12,
      color: '#888',
      fontStyle: 'italic',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    date: {
      fontSize: 12,
      color: '#999',
    },
    actionButtons: {
      flexDirection: 'row',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f0f9f0',
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 4,
      marginLeft: 8,
    },
    actionText: {
      fontSize: 12,
      color: '#4CAF50',
      marginLeft: 4,
    },
    disabledText: {
      color: '#aaa',
    },
  });
  
export default PlantCardBase;