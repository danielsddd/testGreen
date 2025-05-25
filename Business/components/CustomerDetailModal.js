// Business/components/CustomerDetailModal.js
import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
  Platform,
  FlatList,
  Linking,
  Share,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons 
} from '@expo/vector-icons';

/**
 * CustomerDetailModal Component
 * 
 * Displays detailed information about a customer
 * 
 * @param {Object} props Component props
 * @param {boolean} props.visible Controls modal visibility
 * @param {Object} props.customer Customer data object
 * @param {Function} props.onClose Callback when modal is closed
 * @param {Function} props.onContactCustomer Callback to contact customer
 * @param {Function} props.onViewOrders Callback to view customer orders
 * @param {Function} props.onAddNote Callback to add a note to customer
 * @param {string} props.businessId Business identifier
 */
const CustomerDetailModal = ({
  visible = false,
  customer = null,
  onClose = () => {},
  onContactCustomer = () => {},
  onViewOrders = () => {},
  onAddNote = () => {},
  businessId
}) => {
  // State management
  const [showContactMenu, setShowContactMenu] = useState(false);
  
  // Animation refs
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contactMenuAnim = useRef(new Animated.Value(0)).current;
  
  // Entrance/exit animations
  useEffect(() => {
    if (visible && customer) {
      // Entrance animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      // Exit animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [visible, customer, slideAnim, fadeAnim]);

  // Get customer tier based on spending and order count
  const getCustomerTier = useCallback((customer) => {
    if (!customer) return 'new';
    const totalSpent = customer.totalSpent || 0;
    const orderCount = customer.orderCount || 0;
    
    if (totalSpent >= 500 || orderCount >= 10) return 'vip';
    if (totalSpent >= 200 || orderCount >= 5) return 'premium';
    if (orderCount >= 2) return 'regular';
    return 'new';
  }, []);

  // Get tier color for UI elements
  const getTierColor = useCallback((tier) => {
    switch (tier) {
      case 'vip': return '#9C27B0';
      case 'premium': return '#FF9800';
      case 'regular': return '#4CAF50';
      case 'new': return '#2196F3';
      default: return '#757575';
    }
  }, []);

  // Get icon for customer tier
  const getTierIcon = useCallback((tier) => {
    switch (tier) {
      case 'vip': return 'star';
      case 'premium': return 'diamond';
      case 'regular': return 'account-check';
      case 'new': return 'account-plus';
      default: return 'account';
    }
  }, []);

  // Format date for display
  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'Never';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short', 
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  }, []);

  // Calculate average order value
  const getAverageOrderValue = useCallback(() => {
    if (!customer || !customer.orderCount || customer.orderCount === 0) return 0;
    return (customer.totalSpent || 0) / customer.orderCount;
  }, [customer]);

  // Get loyalty status based on order recency
  const getLoyaltyStatus = useCallback(() => {
    if (!customer) return 'Unknown';
    
    const tier = getCustomerTier(customer);
    
    if (!customer.lastOrderDate) return 'New customer';
    
    try {
      const daysSinceLastOrder = customer.lastOrderDate ? 
        Math.floor((new Date() - new Date(customer.lastOrderDate)) / (1000 * 60 * 60 * 24)) : null;
      
      if (!daysSinceLastOrder) return 'New customer';
      if (daysSinceLastOrder <= 7) return 'Very active';
      if (daysSinceLastOrder <= 30) return 'Active';
      if (daysSinceLastOrder <= 90) return 'Inactive';
      return 'Lost customer';
    } catch (error) {
      console.error('Error calculating loyalty status:', error);
      return 'Unknown';
    }
  }, [customer, getCustomerTier]);

  // Handle contact action based on method
  const handleContactAction = useCallback((method) => {
    if (!customer) return;
    
    setShowContactMenu(false);
    
    try {
      switch (method) {
        case 'call':
          if (customer.phone) {
            Linking.openURL(`tel:${customer.phone}`)
              .catch(err => {
                console.error('Error opening phone app:', err);
                Alert.alert('Error', 'Could not open phone app');
              });
          } else {
            Alert.alert('No Phone', 'Customer phone number not available');
          }
          break;
          
        case 'sms':
          if (customer.phone) {
            const message = `Hi ${customer.name}, thank you for being a valued customer at our plant store!`;
            Linking.openURL(`sms:${customer.phone}?body=${encodeURIComponent(message)}`)
              .catch(err => {
                console.error('Error opening SMS app:', err);
                Alert.alert('Error', 'Could not open SMS app');
              });
          } else {
            Alert.alert('No Phone', 'Customer phone number not available');
          }
          break;
          
        case 'email':
          if (customer.email) {
            const subject = 'Thank you for your business!';
            const body = `Hi ${customer.name},\n\nThank you for being a valued customer. We appreciate your business!\n\nBest regards,\nYour Plant Store Team`;
            Linking.openURL(`mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
              .catch(err => {
                console.error('Error opening email app:', err);
                Alert.alert('Error', 'Could not open email app');
              });
          } else {
            Alert.alert('No Email', 'Customer email not available');
          }
          break;
          
        case 'message':
          onContactCustomer(customer, 'message');
          break;
          
        default:
          onContactCustomer(customer, method);
      }
    } catch (error) {
      console.error('Error handling contact action:', error);
      Alert.alert('Error', 'Failed to contact customer');
    }
  }, [customer, onContactCustomer]);

  // Handle viewing all orders
  const handleViewOrders = useCallback(() => {
    if (!customer) return;
    
    try {
      onViewOrders(customer);
    } catch (error) {
      console.error('Error viewing orders:', error);
      Alert.alert('Error', 'Failed to view customer orders');
    }
  }, [customer, onViewOrders]);

  // Handle adding a note
  const handleAddNote = useCallback(() => {
    if (!customer) return;
    
    try {
      onAddNote(customer);
    } catch (error) {
      console.error('Error adding note:', error);
      Alert.alert('Error', 'Failed to add customer note');
    }
  }, [customer, onAddNote]);

  // Share customer information
  const handleShareCustomer = useCallback(async () => {
    if (!customer) return;
    
    try {
      const shareContent = {
        message: `Customer Profile\n\nName: ${customer.name}\nEmail: ${customer.email}\nPhone: ${customer.phone || 'N/A'}\nTotal Orders: ${customer.orderCount || 0}\nTotal Spent: $${(customer.totalSpent || 0).toFixed(2)}\nLast Order: ${formatDate(customer.lastOrderDate)}`,
        title: `Customer Profile: ${customer.name}`
      };
      
      await Share.share(shareContent);
    } catch (error) {
      console.error('Error sharing customer profile:', error);
      Alert.alert('Error', 'Failed to share customer profile');
    }
  }, [customer, formatDate]);

  // Render recent order
  const renderRecentOrder = useCallback(({ item, index }) => (
    <View style={[styles.orderItem, index === 0 && styles.firstOrderItem]}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderNumber}>#{item.confirmationNumber || item.orderId || `Order ${index + 1}`}</Text>
        <Text style={styles.orderDate}>{formatDate(item.orderDate || item.date)}</Text>
      </View>
      
      <View style={styles.orderDetails}>
        <Text style={styles.orderItems}>
          {item.totalQuantity || item.items?.length || 0} items
        </Text>
        <Text style={styles.orderTotal}>${(item.total || 0).toFixed(2)}</Text>
      </View>
      
      <View style={[styles.orderStatus, { backgroundColor: getOrderStatusColor(item.status) }]}>
        <Text style={styles.orderStatusText}>
          {(item.status || 'pending').toUpperCase()}
        </Text>
      </View>
    </View>
  ), [formatDate]);

  // Get color for order status
  const getOrderStatusColor = useCallback((status) => {
    if (!status) return '#757575';
    
    switch (status.toLowerCase()) {
      case 'completed': return '#4CAF50';
      case 'pending': return '#FFA000';
      case 'cancelled': return '#F44336';
      case 'ready': return '#9C27B0';
      case 'confirmed': return '#2196F3';
      default: return '#757575';
    }
  }, []);

  // Key extractor for order list
  const keyExtractor = useCallback((item) => item.orderId || item.id || `order-${Math.random()}`, []);

  // Early return if not visible or no customer
  if (!visible || !customer) return null;

  // Get customer tier data
  const tier = getCustomerTier(customer);
  const tierColor = getTierColor(tier);

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.customerAvatar, { borderColor: tierColor }]}>
                <MaterialIcons name="person" size={32} color={tierColor} />
                <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
                  <MaterialCommunityIcons 
                    name={getTierIcon(tier)} 
                    size={12} 
                    color="#fff" 
                  />
                </View>
              </View>
              
              <View style={styles.customerHeaderInfo}>
                <Text style={styles.customerName}>{customer.name || 'Unknown Customer'}</Text>
                <View style={[styles.tierLabel, { backgroundColor: tierColor }]}>
                  <Text style={styles.tierText}>{tier.toUpperCase()} CUSTOMER</Text>
                </View>
              </View>
            </View>
            
            <TouchableOpacity 
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close customer details"
              accessibilityRole="button"
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contentContainer}
          >
            {/* Contact Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact Information</Text>
              <View style={styles.contactCard}>
                {customer.email && (
                  <View style={styles.contactItem}>
                    <MaterialIcons name="email" size={20} color="#4CAF50" />
                    <Text style={styles.contactText}>{customer.email}</Text>
                    <TouchableOpacity 
                      onPress={() => handleContactAction('email')}
                      style={styles.contactAction}
                      accessibilityLabel="Email customer"
                      accessibilityRole="button"
                      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    >
                      <MaterialIcons name="send" size={16} color="#4CAF50" />
                    </TouchableOpacity>
                  </View>
                )}
                
                {customer.phone && (
                  <View style={styles.contactItem}>
                    <MaterialIcons name="phone" size={20} color="#4CAF50" />
                    <Text style={styles.contactText}>{customer.phone}</Text>
                    <TouchableOpacity 
                      onPress={() => handleContactAction('call')}
                      style={styles.contactAction}
                      accessibilityLabel="Call customer"
                      accessibilityRole="button"
                      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    >
                      <MaterialIcons name="call" size={16} color="#4CAF50" />
                    </TouchableOpacity>
                  </View>
                )}
                
                {/* Customer address if available */}
                {customer.address && (
                  <View style={styles.contactItem}>
                    <MaterialIcons name="location-on" size={20} color="#4CAF50" />
                    <Text style={styles.contactText} numberOfLines={2}>
                      {typeof customer.address === 'string' 
                        ? customer.address 
                        : [
                            customer.address.street,
                            customer.address.city,
                            customer.address.postalCode,
                            customer.address.country
                          ].filter(Boolean).join(', ')
                      }
                    </Text>
                    <TouchableOpacity 
                      onPress={() => {
                        const address = typeof customer.address === 'string'
                          ? customer.address
                          : [
                              customer.address.street,
                              customer.address.city,
                              customer.address.postalCode,
                              customer.address.country
                            ].filter(Boolean).join(', ');
                        
                        const mapsUrl = Platform.select({
                          ios: `maps:0,0?q=${encodeURIComponent(address)}`,
                          android: `geo:0,0?q=${encodeURIComponent(address)}`,
                          default: `https://maps.google.com/maps?q=${encodeURIComponent(address)}`
                        });
                        
                        Linking.openURL(mapsUrl).catch(err => {
                          console.error('Error opening maps:', err);
                          Alert.alert('Error', 'Could not open maps application');
                        });
                      }}
                      style={styles.contactAction}
                      accessibilityLabel="View customer address in maps"
                      accessibilityRole="button"
                      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    >
                      <MaterialIcons name="map" size={16} color="#4CAF50" />
                    </TouchableOpacity>
                  </View>
                )}
                
                <TouchableOpacity 
                  style={styles.contactAllButton}
                  onPress={() => setShowContactMenu(true)}
                  accessibilityLabel="Contact customer"
                  accessibilityRole="button"
                >
                  <MaterialIcons name="contact-phone" size={20} color="#4CAF50" />
                  <Text style={styles.contactAllText}>Contact Customer</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Customer Statistics */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer Statistics</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <MaterialIcons name="shopping-cart" size={24} color="#2196F3" />
                  <Text style={styles.statValue}>{customer.orderCount || 0}</Text>
                  <Text style={styles.statLabel}>Total Orders</Text>
                </View>
                
                <View style={styles.statCard}>
                  <MaterialIcons name="attach-money" size={24} color="#4CAF50" />
                  <Text style={styles.statValue}>${(customer.totalSpent || 0).toFixed(0)}</Text>
                  <Text style={styles.statLabel}>Total Spent</Text>
                </View>
                
                <View style={styles.statCard}>
                  <MaterialIcons name="trending-up" size={24} color="#FF9800" />
                  <Text style={styles.statValue}>${getAverageOrderValue().toFixed(0)}</Text>
                  <Text style={styles.statLabel}>Avg Order</Text>
                </View>
                
                <View style={styles.statCard}>
                  <MaterialIcons name="schedule" size={24} color="#9C27B0" />
                  <Text style={styles.statValue}>{formatDate(customer.lastOrderDate)}</Text>
                  <Text style={styles.statLabel}>Last Order</Text>
                </View>
              </View>
            </View>

            {/* Customer Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer Status</Text>
              <View style={styles.statusCard}>
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Loyalty Status:</Text>
                  <Text style={[styles.statusValue, { color: tierColor }]}>
                    {getLoyaltyStatus()}
                  </Text>
                </View>
                
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Member Since:</Text>
                  <Text style={styles.statusValue}>
                    {formatDate(customer.firstPurchaseDate || customer.joinDate)}
                  </Text>
                </View>
                
                {customer.preferences?.communicationPreference && (
                  <View style={styles.statusItem}>
                    <Text style={styles.statusLabel}>Prefers Contact via:</Text>
                    <Text style={styles.statusValue}>
                      {customer.preferences.communicationPreference.charAt(0).toUpperCase() + 
                       customer.preferences.communicationPreference.slice(1)}
                    </Text>
                  </View>
                )}
                
                {/* Plant preferences if available */}
                {customer.preferences?.plantTypes && customer.preferences.plantTypes.length > 0 && (
                  <View style={styles.statusItem}>
                    <Text style={styles.statusLabel}>Plant Preferences:</Text>
                    <Text style={styles.statusValue}>
                      {customer.preferences.plantTypes.join(', ')}
                    </Text>
                  </View>
                )}
                
                {/* Newsletter subscription status */}
                {customer.isSubscribedToNewsletter !== undefined && (
                  <View style={styles.statusItem}>
                    <Text style={styles.statusLabel}>Newsletter:</Text>
                    <Text style={styles.statusValue}>
                      {customer.isSubscribedToNewsletter ? 'Subscribed' : 'Not subscribed'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Recent Orders */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Orders</Text>
                <TouchableOpacity 
                  onPress={handleViewOrders}
                  style={styles.viewAllButton}
                  accessibilityLabel="View all customer orders"
                  accessibilityRole="button"
                >
                  <Text style={styles.viewAllText}>View All</Text>
                  <MaterialIcons name="arrow-forward" size={16} color="#4CAF50" />
                </TouchableOpacity>
              </View>
              
              {customer.orders && customer.orders.length > 0 ? (
                <FlatList
                  data={customer.orders.slice(0, 3)} // Show last 3 orders
                  renderItem={renderRecentOrder}
                  keyExtractor={keyExtractor}
                  scrollEnabled={false}
                  style={styles.ordersList}
                  ListEmptyComponent={null}
                />
              ) : (
                <View style={styles.emptyOrders}>
                  <MaterialIcons name="shopping-cart" size={48} color="#e0e0e0" />
                  <Text style={styles.emptyOrdersText}>No orders yet</Text>
                </View>
              )}
            </View>

            {/* Customer Notes */}
            {customer.notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <View style={styles.notesCard}>
                  <Text style={styles.notesText}>{customer.notes}</Text>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.primaryAction}
                onPress={handleViewOrders}
                accessibilityLabel="View all customer orders"
                accessibilityRole="button"
              >
                <MaterialIcons name="receipt" size={20} color="#fff" />
                <Text style={styles.primaryActionText}>View All Orders</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.secondaryAction}
                onPress={handleAddNote}
                accessibilityLabel="Add customer note"
                accessibilityRole="button"
              >
                <MaterialIcons name="note-add" size={20} color="#4CAF50" />
                <Text style={styles.secondaryActionText}>Add Note</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Contact Menu */}
          {showContactMenu && (
            <View 
              style={styles.contactMenuOverlay}
              accessibilityLabel="Contact methods menu"
              accessibilityRole="menu"
            >
              <View style={styles.contactMenu}>
                <Text style={styles.contactMenuTitle}>Contact {customer.name}</Text>
                
                {customer.phone && (
                  <>
                    <TouchableOpacity
                      style={styles.contactMenuItem}
                      onPress={() => handleContactAction('call')}
                      accessibilityLabel="Call customer"
                      accessibilityRole="menuitem"
                    >
                      <MaterialIcons name="call" size={20} color="#4CAF50" />
                      <Text style={styles.contactMenuText}>Call</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.contactMenuItem}
                      onPress={() => handleContactAction('sms')}
                      accessibilityLabel="Send SMS to customer"
                      accessibilityRole="menuitem"
                    >
                      <MaterialIcons name="sms" size={20} color="#4CAF50" />
                      <Text style={styles.contactMenuText}>Send SMS</Text>
                    </TouchableOpacity>
                  </>
                )}
                
                <TouchableOpacity
                  style={styles.contactMenuItem}
                  onPress={() => handleContactAction('email')}
                  accessibilityLabel="Email customer"
                  accessibilityRole="menuitem"
                >
                  <MaterialIcons name="email" size={20} color="#4CAF50" />
                  <Text style={styles.contactMenuText}>Send Email</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.contactMenuItem}
                  onPress={() => handleContactAction('message')}
                  accessibilityLabel="Message customer in app"
                  accessibilityRole="menuitem"
                >
                  <MaterialIcons name="chat" size={20} color="#4CAF50" />
                  <Text style={styles.contactMenuText}>Message in App</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.contactMenuItem}
                  onPress={handleShareCustomer}
                  accessibilityLabel="Share customer profile"
                  accessibilityRole="menuitem"
                >
                  <MaterialIcons name="share" size={20} color="#4CAF50" />
                  <Text style={styles.contactMenuText}>Share Profile</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.contactMenuCancel}
                  onPress={() => setShowContactMenu(false)}
                  accessibilityLabel="Cancel"
                  accessibilityRole="button"
                >
                  <Text style={styles.contactMenuCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '95%',
    maxHeight: '90%',
    maxWidth: 500,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 3,
    position: 'relative',
  },
  tierBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  customerHeaderInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  tierLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tierText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentContainer: {
    paddingVertical: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginRight: 4,
  },
  contactCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  contactText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  contactAction: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f0f9f3',
  },
  contactAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9f3',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  contactAllText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 0.48,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statusCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  ordersList: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  orderItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  firstOrderItem: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  orderDate: {
    fontSize: 12,
    color: '#666',
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderItems: {
    fontSize: 12,
    color: '#666',
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4CAF50',
  },
  orderStatus: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  orderStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  emptyOrders: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  emptyOrdersText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  notesCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
  },
  primaryActionText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9f3',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  secondaryActionText: {
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 8,
  },
  contactMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 300,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  contactMenuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  contactMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
  },
  contactMenuText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  contactMenuCancel: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  contactMenuCancelText: {
    fontSize: 14,
    color: '#666',
  },
});

export default memo(CustomerDetailModal);