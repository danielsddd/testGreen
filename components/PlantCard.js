// components/PlantCard.js - ENHANCED Business Display
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Alert,
  Platform, Dimensions, ActivityIndicator
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { wishProduct, startConversation, purchaseBusinessProduct } from '../services/marketplaceApi';
import { triggerUpdate, UPDATE_TYPES } from '../services/MarketplaceUpdates';

const { width: screenWidth } = Dimensions.get('window');

const PlantCard = ({ plant, showActions = true, layout = 'grid', onPress, style }) => {
  const navigation = useNavigation();
  const [isFavorite, setIsFavorite] = useState(plant.isFavorite || plant.isWished || false);
  const [isWishLoading, setIsWishLoading] = useState(false);
  const [isMessageLoading, setIsMessageLoading] = useState(false);
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const lastActionTimeRef = useRef(0);

  // ENHANCED: Business information extraction
  const isBusinessProduct = plant.sellerType === 'business' || plant.isBusinessListing;
  const businessInfo = plant.businessInfo || {};
  const sellerInfo = plant.seller || {};
  const locationInfo = plant.location || {};
  const availability = plant.availability || {};

  // ENHANCED: Get business display name
  const getBusinessDisplayName = () => {
    return sellerInfo.businessName || 
           sellerInfo.name || 
           businessInfo.name || 
           'Business';
  };

  // ENHANCED: Get business type with fallback
  const getBusinessType = () => {
    return businessInfo.type || 
           sellerInfo.businessType || 
           availability.businessType || 
           'Business';
  };

  // ENHANCED: Get pickup/location information
  const getLocationDisplay = () => {
    if (isBusinessProduct) {
      // Priority order for business location display
      return locationInfo.displayText || 
             availability.pickupLocation ||
             businessInfo.pickupInfo?.location ||
             locationInfo.formattedAddress ||
             (locationInfo.city && locationInfo.address ? `${locationInfo.address}, ${locationInfo.city}` : '') ||
             locationInfo.city ||
             locationInfo.address ||
             `${getBusinessDisplayName()} - Contact for pickup`;
    } else {
      // Individual seller location
      return locationInfo.city || 
             plant.city || 
             plant.location || 
             'Local pickup';
    }
  };

  // ENHANCED: Check if business is verified
  const isVerified = () => {
    return businessInfo.verified || 
           sellerInfo.isVerified || 
           sellerInfo.verificationStatus === 'verified' ||
           false;
  };

  const debounce = (func, delay) => {
    return (...args) => {
      const now = Date.now();
      if (now - lastActionTimeRef.current >= delay) {
        lastActionTimeRef.current = now;
        func(...args);
      }
    };
  };

  const handleWishToggle = useCallback(debounce(async () => {
    if (isWishLoading) return;
    
    try {
      setIsWishLoading(true);
      const plantId = plant.id || plant._id;
      
      if (!plantId) {
        throw new Error('Plant ID not found');
      }

      const response = await wishProduct(plantId);
      const newWishState = response.isWished;
      
      setIsFavorite(newWishState);
      
      // Store the update for other components
      await AsyncStorage.setItem('WISHLIST_UPDATED', 'true');
      
      // Trigger update for other screens
      triggerUpdate(UPDATE_TYPES.WISHLIST, {
        plantId: plantId,
        isFavorite: newWishState
      });
      
    } catch (error) {
      console.error('Error toggling wishlist:', error);
      Alert.alert('Error', 'Failed to update wishlist. Please try again.');
    } finally {
      setIsWishLoading(false);
    }
  }, 1000), [plant.id, plant._id, isWishLoading]);

  const handleCardPress = () => {
    if (onPress) {
      onPress(plant);
    } else {
      const plantId = plant.id || plant._id;
      if (plantId) {
        navigation.navigate('PlantDetails', { 
          plant: plant,
          plantId: plantId
        });
      }
    }
  };

  const handleMessageSeller = useCallback(debounce(async () => {
    if (isMessageLoading) return;
    
    try {
      setIsMessageLoading(true);
      const userEmail = await AsyncStorage.getItem('userEmail');
      const sellerId = plant.sellerId || plant.seller?._id;
      
      if (!userEmail || !sellerId) {
        Alert.alert('Error', 'Unable to start conversation. Please check your login status.');
        return;
      }

      if (userEmail === sellerId) {
        Alert.alert('Info', 'You cannot message yourself.');
        return;
      }

      const plantId = plant.id || plant._id;
      const initialMessage = isBusinessProduct 
        ? `Hi! I'm interested in your ${plant.title || plant.name}. Is it still available for pickup?`
        : `Hi! I'm interested in your ${plant.title || plant.name}. Is it still available?`;

      const response = await startConversation(
        sellerId,
        plantId,
        initialMessage,
        userEmail
      );

      if (response.success) {
        if (navigation.canNavigate('MainTabs')) {
          navigation.navigate('MainTabs', {
            screen: 'Messages',
            params: {
              chatId: response.messageId,
              refresh: true
            }
          });
        } else {
          navigation.navigate('Messages', {
            chatId: response.messageId,
            refresh: true
          });
        }
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    } finally {
      setIsMessageLoading(false);
    }
  }, 1000), [plant, isMessageLoading, navigation]);

  // ENHANCED: Handle business product ordering
  const handleOrderProduct = useCallback(debounce(async () => {
    if (isOrderLoading || !isBusinessProduct) return;
    
    try {
      setIsOrderLoading(true);
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userName = await AsyncStorage.getItem('userName');
      
      if (!userEmail) {
        Alert.alert('Error', 'Please log in to place an order.');
        return;
      }

      const businessId = plant.businessId || plant.sellerId;
      const productId = plant.inventoryId || plant.id || plant._id;
      
      if (!businessId || !productId) {
        Alert.alert('Error', 'Product information is incomplete.');
        return;
      }

      // Show confirmation dialog with business info
      Alert.alert(
        'Confirm Order',
        `Order ${plant.title || plant.name} from ${getBusinessDisplayName()}?\n\nPrice: $${plant.price}\nPickup: ${getLocationDisplay()}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Place Order',
            onPress: async () => {
              try {
                const orderResponse = await purchaseBusinessProduct(
                  productId,
                  businessId,
                  1, // quantity
                  {
                    email: userEmail,
                    name: userName || 'Customer',
                    phone: '', // Could add phone input later
                    notes: `Order placed through marketplace app`
                  }
                );

                if (orderResponse.success) {
                  Alert.alert(
                    'Order Placed!',
                    `Your order has been placed successfully.\n\nConfirmation: ${orderResponse.confirmationNumber}\n\nThe business will prepare your order for pickup. You'll receive updates via messages.`,
                    [
                      { 
                        text: 'View Messages', 
                        onPress: () => {
                          if (navigation.canNavigate('MainTabs')) {
                            navigation.navigate('MainTabs', { screen: 'Messages' });
                          } else {
                            navigation.navigate('Messages');
                          }
                        }
                      },
                      { text: 'OK' }
                    ]
                  );
                  
                  // Trigger inventory update
                  triggerUpdate(UPDATE_TYPES.INVENTORY, {
                    businessId: businessId,
                    productId: productId
                  });
                }
              } catch (orderError) {
                console.error('Order placement error:', orderError);
                Alert.alert('Order Failed', orderError.message || 'Failed to place order. Please try again.');
              }
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error preparing order:', error);
      Alert.alert('Error', 'Failed to prepare order. Please try again.');
    } finally {
      setIsOrderLoading(false);
    }
  }, 1000), [plant, isBusinessProduct, isOrderLoading, navigation]);

  // ENHANCED: Render business information section
  const renderBusinessInfo = () => {
    if (!isBusinessProduct) return null;

    return (
      <View style={styles.businessInfoContainer}>
        {/* Business Type Badge */}
        <View style={styles.businessTypeBadge}>
          <MaterialIcons name="business" size={10} color="#4CAF50" />
          <Text style={styles.businessTypeText}>
            {getBusinessType()}
          </Text>
        </View>

        {/* Business Name */}
        <Text style={styles.businessName} numberOfLines={1}>
          {getBusinessDisplayName()}
        </Text>

        {/* Verification Badge */}
        {isVerified() && (
          <View style={styles.verifiedBadge}>
            <MaterialIcons name="verified" size={10} color="#2196F3" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}
      </View>
    );
  };

  // ENHANCED: Render location information
  const renderLocationInfo = () => {
    const locationDisplay = getLocationDisplay();
    
    return (
      <View style={styles.locationContainer}>
        <MaterialIcons 
          name={isBusinessProduct ? "store" : "location-on"} 
          size={12} 
          color="#666" 
        />
        <Text style={styles.locationText} numberOfLines={2}>
          {locationDisplay}
        </Text>
      </View>
    );
  };

  // ENHANCED: Render action buttons
  const renderActionButtons = () => {
    if (!showActions) return null;

    return (
      <View style={styles.actionContainer}>
        {/* Wishlist Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.wishButton]}
          onPress={handleWishToggle}
          disabled={isWishLoading}
        >
          {isWishLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons
              name={isFavorite ? "favorite" : "favorite-border"}
              size={18}
              color="#fff"
            />
          )}
        </TouchableOpacity>

        {/* Message Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.messageButton]}
          onPress={handleMessageSeller}
          disabled={isMessageLoading}
        >
          {isMessageLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="message" size={18} color="#fff" />
          )}
        </TouchableOpacity>

        {/* Business Order Button or Individual Contact */}
        {isBusinessProduct ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.orderButton]}
            onPress={handleOrderProduct}
            disabled={isOrderLoading || !availability.inStock}
          >
            {isOrderLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="shopping-cart" size={16} color="#fff" />
                <Text style={styles.orderButtonText}>
                  {availability.inStock ? 'Order' : 'Sold Out'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.contactButton]}
            onPress={handleMessageSeller}
            disabled={isMessageLoading}
          >
            <MaterialIcons name="contact-phone" size={16} color="#fff" />
            <Text style={styles.contactButtonText}>Contact</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Calculate card dimensions based on layout
  const cardWidth = layout === 'grid' 
    ? (screenWidth - 32) / (Platform.OS === 'web' ? 3 : 2) - 8
    : screenWidth - 32;

  const imageHeight = layout === 'grid' ? cardWidth * 0.75 : 120;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { width: cardWidth },
        layout === 'list' && styles.listCard,
        style
      ]}
      onPress={handleCardPress}
      activeOpacity={0.8}
    >
      {/* Product Image */}
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        <Image
          source={{
            uri: plant.mainImage || 
                 (plant.images && plant.images[0]) || 
                 'https://via.placeholder.com/300x200/4CAF50/FFFFFF?text=Plant'
          }}
          style={styles.image}
          defaultSource={{ uri: 'https://via.placeholder.com/300x200/4CAF50/FFFFFF?text=Plant' }}
        />
        
        {/* Price Badge */}
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>
            ${plant.finalPrice || plant.price || '0'}
          </Text>
          {plant.discount > 0 && (
            <Text style={styles.originalPrice}>
              ${plant.originalPrice || plant.price}
            </Text>
          )}
        </View>

        {/* Stock Status for Business Products */}
        {isBusinessProduct && (
          <View style={[
            styles.stockBadge,
            availability.inStock ? styles.inStockBadge : styles.outOfStockBadge
          ]}>
            <Text style={[
              styles.stockText,
              availability.inStock ? styles.inStockText : styles.outOfStockText
            ]}>
              {availability.inStock ? 'In Stock' : 'Sold Out'}
            </Text>
          </View>
        )}
      </View>

      {/* Product Information */}
      <View style={styles.infoContainer}>
        {/* Product Title */}
        <Text style={styles.title} numberOfLines={2}>
          {plant.title || plant.name || 'Unnamed Plant'}
        </Text>

        {/* Business Info or Individual Seller */}
        {isBusinessProduct ? renderBusinessInfo() : (
          <Text style={styles.sellerName} numberOfLines={1}>
            by {sellerInfo.name || 'Plant Enthusiast'}
          </Text>
        )}

        {/* Location Information */}
        {renderLocationInfo()}

        {/* Scientific Name (if available) */}
        {plant.scientific_name && (
          <Text style={styles.scientificName} numberOfLines={1}>
            <Text style={styles.italic}>{plant.scientific_name}</Text>
          </Text>
        )}

        {/* Action Buttons */}
        {renderActionButtons()}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 4,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  listCard: {
    flexDirection: 'row',
    width: '100%',
    marginHorizontal: 0,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  priceBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  originalPrice: {
    color: '#ccc',
    fontSize: 10,
    textDecorationLine: 'line-through',
  },
  stockBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  inStockBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
  },
  outOfStockBadge: {
    backgroundColor: 'rgba(244, 67, 54, 0.9)',
  },
  stockText: {
    fontSize: 10,
    fontWeight: '600',
  },
  inStockText: {
    color: '#fff',
  },
  outOfStockText: {
    color: '#fff',
  },
  infoContainer: {
    padding: 12,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sellerName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  businessInfoContainer: {
    marginBottom: 6,
    gap: 4,
  },
  businessTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
    gap: 2,
  },
  businessTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4CAF50',
    textTransform: 'capitalize',
  },
  businessName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 2,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#2196F3',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 4,
  },
  locationText: {
    fontSize: 11,
    color: '#666',
    flex: 1,
    lineHeight: 14,
  },
  scientificName: {
    fontSize: 10,
    color: '#888',
    marginBottom: 8,
  },
  italic: {
    fontStyle: 'italic',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  actionButton: {
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  wishButton: {
    backgroundColor: '#E91E63',
    width: 32,
  },
  messageButton: {
    backgroundColor: '#2196F3',
    width: 32,
  },
  orderButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  contactButton: {
    backgroundColor: '#FF9800',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  orderButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default PlantCard;