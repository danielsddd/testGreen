// Business/components/ProductEditModal.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  MaterialIcons 
} from '@expo/vector-icons';

export default function ProductEditModal({
  visible = false,
  product = null,
  onClose = () => {},
  onSave = () => {},
  businessId
}) {
  // Form state
  const [formData, setFormData] = useState({
    quantity: '',
    price: '',
    minThreshold: '',
    discount: '',
    notes: '',
    status: 'active'
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Animation refs
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  
  // Initialize form data when product changes
  useEffect(() => {
    if (product && visible) {
      const initialData = {
        quantity: product.quantity?.toString() || '',
        price: product.price?.toString() || '',
        minThreshold: product.minThreshold?.toString() || '5',
        discount: product.discount?.toString() || '0',
        notes: product.notes || '',
        status: product.status || 'active'
      };
      
      setFormData(initialData);
      setErrors({});
      setHasChanges(false);
      
      // Entrance animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [product, visible]);

  // Handle form field change
  const handleFieldChange = (field, value) => {
    const newFormData = {
      ...formData,
      [field]: value
    };
    
    setFormData(newFormData);
    setHasChanges(true);
    
    // Clear field error
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
    
    // Real-time validation
    validateField(field, value);
  };

  // Validate individual field
  const validateField = (field, value) => {
    let error = null;
    
    switch (field) {
      case 'quantity':
        const qty = parseInt(value);
        if (value && (isNaN(qty) || qty < 0)) {
          error = 'Quantity must be a valid number';
        } else if (qty > 10000) {
          error = 'Quantity seems very high. Please verify.';
        }
        break;
        
      case 'price':
        const price = parseFloat(value);
        if (value && (isNaN(price) || price < 0)) {
          error = 'Price must be a valid positive number';
        } else if (price > 10000) {
          error = 'Price seems very high. Please verify.';
        }
        break;
        
      case 'minThreshold':
        const threshold = parseInt(value);
        if (value && (isNaN(threshold) || threshold < 0)) {
          error = 'Threshold must be a valid positive number';
        }
        break;
        
      case 'discount':
        const discount = parseFloat(value);
        if (value && (isNaN(discount) || discount < 0 || discount > 100)) {
          error = 'Discount must be between 0 and 100';
        }
        break;
    }
    
    if (error) {
      setErrors(prev => ({
        ...prev,
        [field]: error
      }));
    }
    
    return !error;
  };

  // Validate entire form
  const validateForm = () => {
    const newErrors = {};
    
    // Required fields
    if (!formData.quantity) {
      newErrors.quantity = 'Quantity is required';
    } else {
      const qty = parseInt(formData.quantity);
      if (isNaN(qty) || qty < 0) {
        newErrors.quantity = 'Quantity must be a valid positive number';
      }
    }
    
    if (!formData.price) {
      newErrors.price = 'Price is required';
    } else {
      const price = parseFloat(formData.price);
      if (isNaN(price) || price < 0) {
        newErrors.price = 'Price must be a valid positive number';
      }
    }
    
    // Optional fields validation
    if (formData.minThreshold) {
      const threshold = parseInt(formData.minThreshold);
      if (isNaN(threshold) || threshold < 0) {
        newErrors.minThreshold = 'Threshold must be a valid positive number';
      }
    }
    
    if (formData.discount) {
      const discount = parseFloat(formData.discount);
      if (isNaN(discount) || discount < 0 || discount > 100) {
        newErrors.discount = 'Discount must be between 0 and 100';
      }
    }
    
    setErrors(newErrors);
    
    // Shake animation on validation error
    if (Object.keys(newErrors).length > 0) {
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 100,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(shakeAnim, {
          toValue: -10,
          duration: 100,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
    
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      const updatedData = {
        quantity: parseInt(formData.quantity),
        price: parseFloat(formData.price),
        minThreshold: parseInt(formData.minThreshold) || 5,
        discount: parseFloat(formData.discount) || 0,
        notes: formData.notes.trim(),
        status: formData.status
      };
      
      await onSave(updatedData);
      
      // Success animation and close
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(() => {
        setHasChanges(false);
        onClose();
      });
      
    } catch (error) {
      console.error('Error saving product:', error);
      Alert.alert('Error', `Failed to save changes: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle close with unsaved changes check
  const handleClose = () => {
    if (hasChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to close?',
        [
          {
            text: 'Keep Editing',
            style: 'cancel'
          },
          {
            text: 'Discard Changes',
            style: 'destructive',
            onPress: () => {
              setHasChanges(false);
              Animated.parallel([
                Animated.timing(slideAnim, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: Platform.OS !== 'web',
                }),
                Animated.timing(fadeAnim, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: Platform.OS !== 'web',
                }),
              ]).start(() => {
                onClose();
              });
            }
          }
        ]
      );
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(() => {
        onClose();
      });
    }
  };

  // Calculate final price with discount
  const calculateFinalPrice = () => {
    const price = parseFloat(formData.price) || 0;
    const discount = parseFloat(formData.discount) || 0;
    return price - (price * discount / 100);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'inactive': return '#FF9800';
      case 'discontinued': return '#F44336';
      default: return '#757575';
    }
  };

  if (!visible || !product) return null;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.overlay}
      >
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [
                { 
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [300, 0],
                  })
                },
                { translateX: shakeAnim }
              ],
            }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.productIcon}>
                <MaterialCommunityIcons 
                  name={product.productType === 'plant' ? 'leaf' : 'cube-outline'} 
                  size={24} 
                  color="#4CAF50" 
                />
              </View>
              <View>
                <Text style={styles.headerTitle}>Edit Product</Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {product.name || product.common_name}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          {/* Content */}
          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Basic Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <MaterialIcons name="inventory" size={16} color="#4CAF50" />
                {' '}Stock & Pricing
              </Text>
              
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>
                    Quantity <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, errors.quantity && styles.inputError]}
                    value={formData.quantity}
                    onChangeText={(text) => handleFieldChange('quantity', text)}
                    placeholder="0"
                    keyboardType="numeric"
                    selectTextOnFocus={true}
                  />
                  {errors.quantity && (
                    <Text style={styles.errorText}>
                      <MaterialIcons name="error" size={12} color="#f44336" /> {errors.quantity}
                    </Text>
                  )}
                </View>
                
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>
                    Min. Threshold
                  </Text>
                  <TextInput
                    style={[styles.input, errors.minThreshold && styles.inputError]}
                    value={formData.minThreshold}
                    onChangeText={(text) => handleFieldChange('minThreshold', text)}
                    placeholder="5"
                    keyboardType="numeric"
                    selectTextOnFocus={true}
                  />
                  {errors.minThreshold && (
                    <Text style={styles.errorText}>
                      <MaterialIcons name="error" size={12} color="#f44336" /> {errors.minThreshold}
                    </Text>
                  )}
                </View>
              </View>
              
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>
                    Base Price <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, errors.price && styles.inputError]}
                    value={formData.price}
                    onChangeText={(text) => handleFieldChange('price', text)}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    selectTextOnFocus={true}
                  />
                  {errors.price && (
                    <Text style={styles.errorText}>
                      <MaterialIcons name="error" size={12} color="#f44336" /> {errors.price}
                    </Text>
                  )}
                </View>
                
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>
                    Discount (%)
                  </Text>
                  <TextInput
                    style={[styles.input, errors.discount && styles.inputError]}
                    value={formData.discount}
                    onChangeText={(text) => handleFieldChange('discount', text)}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    selectTextOnFocus={true}
                  />
                  {errors.discount && (
                    <Text style={styles.errorText}>
                      <MaterialIcons name="error" size={12} color="#f44336" /> {errors.discount}
                    </Text>
                  )}
                </View>
              </View>
              
              {/* Price Preview */}
              {formData.price && (
                <View style={styles.pricePreview}>
                  <Text style={styles.pricePreviewLabel}>Final Price:</Text>
                  <View style={styles.pricePreviewValue}>
                    {formData.discount > 0 && (
                      <Text style={styles.originalPrice}>${formData.price}</Text>
                    )}
                    <Text style={styles.finalPrice}>${calculateFinalPrice().toFixed(2)}</Text>
                    {formData.discount > 0 && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>{formData.discount}% OFF</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
            
            {/* Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <MaterialIcons name="toggle-on" size={16} color="#4CAF50" />
                {' '}Product Status
              </Text>
              
              <View style={styles.statusContainer}>
                {['active', 'inactive', 'discontinued'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusOption,
                      formData.status === status && styles.statusOptionActive,
                      { borderColor: getStatusColor(status) }
                    ]}
                    onPress={() => handleFieldChange('status', status)}
                  >
                    <View style={[
                      styles.statusDot,
                      { backgroundColor: getStatusColor(status) }
                    ]} />
                    <Text style={[
                      styles.statusOptionText,
                      formData.status === status && { color: getStatusColor(status) }
                    ]}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <MaterialIcons name="note" size={16} color="#4CAF50" />
                {' '}Additional Notes
              </Text>
              
              <View style={styles.inputGroup}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.notes}
                  onChangeText={(text) => handleFieldChange('notes', text)}
                  placeholder="Add any additional notes about this product..."
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>
            
            {/* Product Info (Read-only) */}
            {product.productType === 'plant' && product.plantInfo && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  <MaterialCommunityIcons name="leaf" size={16} color="#4CAF50" />
                  {' '}Plant Information
                </Text>
                
                <View style={styles.plantInfoGrid}>
                  {product.plantInfo.origin && (
                    <View style={styles.plantInfoItem}>
                      <MaterialCommunityIcons name="earth" size={14} color="#8BC34A" />
                      <Text style={styles.plantInfoLabel}>Origin</Text>
                      <Text style={styles.plantInfoValue}>{product.plantInfo.origin}</Text>
                    </View>
                  )}
                  
                  {product.plantInfo.water_days && (
                    <View style={styles.plantInfoItem}>
                      <MaterialCommunityIcons name="water" size={14} color="#2196F3" />
                      <Text style={styles.plantInfoLabel}>Watering</Text>
                      <Text style={styles.plantInfoValue}>Every {product.plantInfo.water_days} days</Text>
                    </View>
                  )}
                  
                  {product.plantInfo.light && (
                    <View style={styles.plantInfoItem}>
                      <MaterialCommunityIcons name="white-balance-sunny" size={14} color="#FF9800" />
                      <Text style={styles.plantInfoLabel}>Light</Text>
                      <Text style={styles.plantInfoValue}>{product.plantInfo.light}</Text>
                    </View>
                  )}
                  
                  {product.plantInfo.difficulty && (
                    <View style={styles.plantInfoItem}>
                      <MaterialIcons name="bar-chart" size={14} color="#9C27B0" />
                      <Text style={styles.plantInfoLabel}>Difficulty</Text>
                      <Text style={styles.plantInfoValue}>{product.plantInfo.difficulty}/10</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
          
          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.saveButton, 
                (!hasChanges || isLoading) && styles.saveButtonDisabled
              ]}
              onPress={handleSave}
              disabled={!hasChanges || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="save" size={16} color="#fff" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
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
  productIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#f44336',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    color: '#333',
  },
  inputError: {
    borderColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pricePreview: {
    backgroundColor: '#f0f9f3',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pricePreviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  pricePreviewValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  finalPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  discountBadge: {
    backgroundColor: '#f44336',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  discountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statusOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  statusOptionActive: {
    backgroundColor: '#f8f9fa',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  plantInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  plantInfoItem: {
    flex: 0.48,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  plantInfoLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  plantInfoValue: {
    fontSize: 11,
    color: '#333',
    marginTop: 2,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
  },
  saveButtonDisabled: {
    backgroundColor: '#bdbdbd',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
  },
});