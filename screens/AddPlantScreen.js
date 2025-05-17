// screens/AddPlantScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import components
import MarketplaceHeader from '../components/MarketplaceHeader';
import LocationPicker from '../components/LocationPicker';

// Import services
import { createPlant, uploadImage } from '../services/marketplaceApi';

// Categories for the category picker
const CATEGORIES = [
  'Indoor Plants',
  'Outdoor Plants',
  'Succulents',
  'Tropical Plants',
  'Cacti',
  'Flowering Plants',
  'Herbs',
  'Seeds',
  'Cuttings',
  'Gardening Supplies'
];

/**
 * AddPlantScreen component - Screen for adding a new plant listing
 * 
 * @param {Object} props Component props
 * @param {Object} props.navigation Navigation object
 * @param {Object} props.route Route object with params
 */
const AddPlantScreen = ({ navigation, route }) => {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [scientificName, setScientificName] = useState('');
  const [images, setImages] = useState([]);
  const [location, setLocation] = useState(null);
  const [isCategoryPickerVisible, setCategoryPickerVisible] = useState(false);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Request camera/media library permissions on mount
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Needed',
            'Sorry, we need camera roll permissions to upload images'
          );
        }
      }
    })();
  }, []);
  
  // Handle back button press
  const handleBackPress = () => {
    if (hasFormChanges()) {
      Alert.alert(
        'Discard Changes',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Discard', 
            style: 'destructive',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } else {
      navigation.goBack();
    }
  };
  
  // Check if form has changes
  const hasFormChanges = () => {
    return (
      title.trim() !== '' ||
      description.trim() !== '' ||
      price !== '' ||
      scientificName.trim() !== '' ||
      images.length > 0 ||
      location !== null
    );
  };
  
  // Image picker function
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        setImages([...images, selectedImage.uri]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };
  
  // Remove image function
  const removeImage = (index) => {
    const updatedImages = [...images];
    updatedImages.splice(index, 1);
    setImages(updatedImages);
  };
  
  // Handle location change from LocationPicker
  const handleLocationChange = (locationData) => {
    setLocation(locationData);
    setErrors((prev) => ({ ...prev, location: null }));
  };
  
  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (!price) {
      newErrors.price = 'Price is required';
    } else if (isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      newErrors.price = 'Please enter a valid price';
    }
    
    if (!category) {
      newErrors.category = 'Category is required';
    }
    
    if (!location) {
      newErrors.location = 'Location is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Error', 'Please fix the errors in the form');
      return;
    }
    
    setIsLoading(true);
    setUploadProgress(0);
    
    try {
      // Upload images first
      const uploadedImages = [];
      let mainImage = '';
      
      // Upload images one by one
      for (let i = 0; i < images.length; i++) {
        const imageUri = images[i];
        const progressValue = (i / images.length) * 50; // First 50% is for image uploads
        setUploadProgress(progressValue);
        
        try {
          const result = await uploadImage(imageUri, 'plant');
          
          if (result && result.url) {
            uploadedImages.push(result.url);
            
            // Use the first image as the main image
            if (i === 0) {
              mainImage = result.url;
            }
          }
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          // Continue with other images even if one fails
        }
      }
      
      // Set progress to 50% after images are uploaded
      setUploadProgress(50);
      
      // Create the plant data
      const plantData = {
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price),
        category: category,
        location: location || {},
        images: uploadedImages,
        scientificName: scientificName.trim(),
      };
      
      // Add main image if available
      if (mainImage) {
        plantData.image = mainImage;
      }
      
      // Create the plant listing
      const result = await createPlant(plantData);
      
      // Set progress to 100% when done
      setUploadProgress(100);
      
      // Signal marketplace update
      try {
        await AsyncStorage.setItem('MARKETPLACE_UPDATED', Date.now().toString());
      } catch (e) {
        console.warn('Failed to set marketplace update flag:', e);
      }
      
      // Show success message
      Alert.alert(
        'Success',
        'Your plant has been listed successfully!',
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Navigate back with refresh flag
              navigation.navigate('Marketplace', { refresh: true });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error creating plant listing:', error);
      Alert.alert('Error', 'Failed to create plant listing. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Toggle category picker visibility
  const toggleCategoryPicker = () => {
    setCategoryPickerVisible(!isCategoryPickerVisible);
    setErrors((prev) => ({ ...prev, category: null }));
  };
  
  // Select category
  const selectCategory = (selectedCategory) => {
    setCategory(selectedCategory);
    setCategoryPickerVisible(false);
  };
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <MarketplaceHeader
        title="Add Plant"
        showBackButton={true}
        onBackPress={handleBackPress}
        showNotifications={false}
      />
      
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>Plant Information</Text>
        
        {/* Title Input */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Title*</Text>
          <TextInput
            style={[styles.input, errors.title ? styles.inputError : null]}
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              setErrors((prev) => ({ ...prev, title: null }));
            }}
            placeholder="Enter plant title"
            placeholderTextColor="#999"
            maxLength={50}
          />
          {errors.title ? (
            <Text style={styles.errorText}>{errors.title}</Text>
          ) : null}
        </View>
        
        {/* Description Input */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Description*</Text>
          <TextInput
            style={[styles.textArea, errors.description ? styles.inputError : null]}
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              setErrors((prev) => ({ ...prev, description: null }));
            }}
            placeholder="Describe your plant"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          {errors.description ? (
            <Text style={styles.errorText}>{errors.description}</Text>
          ) : null}
        </View>
        
        {/* Price Input */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Price*</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={[styles.priceInput, errors.price ? styles.inputError : null]}
              value={price}
              onChangeText={(text) => {
                const filteredText = text.replace(/[^0-9.]/g, '');
                setPrice(filteredText);
                setErrors((prev) => ({ ...prev, price: null }));
              }}
              placeholder="0.00"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
          </View>
          {errors.price ? (
            <Text style={styles.errorText}>{errors.price}</Text>
          ) : null}
        </View>
        
        {/* Category Selector */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Category*</Text>
          <TouchableOpacity
            style={[styles.categorySelector, errors.category ? styles.inputError : null]}
            onPress={toggleCategoryPicker}
          >
            <Text style={styles.categorySelectorText}>{category || 'Select category'}</Text>
            <MaterialIcons
              name={isCategoryPickerVisible ? 'arrow-drop-up' : 'arrow-drop-down'}
              size={24}
              color="#666"
            />
          </TouchableOpacity>
          {errors.category ? (
            <Text style={styles.errorText}>{errors.category}</Text>
          ) : null}
          
          {/* Category Picker Dropdown */}
          {isCategoryPickerVisible && (
            <View style={styles.categoryDropdown}>
              <ScrollView nestedScrollEnabled={true} style={styles.categoryScrollView}>
                {CATEGORIES.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.categoryOption,
                      category === item && styles.categoryOptionSelected,
                    ]}
                    onPress={() => selectCategory(item)}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        category === item && styles.categoryOptionTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
        
        {/* Scientific Name (Optional) */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Scientific Name (Optional)</Text>
          <TextInput
            style={styles.input}
            value={scientificName}
            onChangeText={setScientificName}
            placeholder="E.g., Monstera Deliciosa"
            placeholderTextColor="#999"
          />
        </View>
        
        {/* Location Picker */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Location*</Text>
          <LocationPicker
            value={location}
            onChange={handleLocationChange}
          />
          {errors.location ? (
            <Text style={styles.errorText}>{errors.location}</Text>
          ) : null}
        </View>
        
        {/* Image Upload Section */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Images</Text>
          <Text style={styles.helperText}>
            Add photos of your plant. The first image will be used as the main image.
          </Text>
          
          <View style={styles.imageContainer}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeImage(index)}
                >
                  <MaterialIcons name="close" size={20} color="#fff" />
                </TouchableOpacity>
                {index === 0 && (
                  <View style={styles.mainImageBadge}>
                    <Text style={styles.mainImageText}>Main</Text>
                  </View>
                )}
              </View>
            ))}
            
            {images.length < 5 && (
              <TouchableOpacity
                style={styles.addImageButton}
                onPress={pickImage}
              >
                <MaterialIcons name="add-photo-alternate" size={32} color="#4CAF50" />
                <Text style={styles.addImageText}>Add Image</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isLoading ? styles.submitButtonDisabled : null]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.submitButtonText}>
                {uploadProgress < 100 ? `Uploading ${Math.round(uploadProgress)}%` : 'Creating...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>List My Plant</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#333',
  },
  inputError: {
    borderColor: '#f44336',
  },
  errorText: {
    color: '#f44336',
    fontSize: 14,
    marginTop: 4,
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#333',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  currencySymbol: {
    paddingLeft: 12,
    fontSize: 18,
    color: '#333',
  },
  priceInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#333',
  },
  categorySelector: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categorySelectorText: {
    fontSize: 16,
    color: '#333',
  },
  categoryDropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  categoryScrollView: {
    maxHeight: 200,
  },
  categoryOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryOptionSelected: {
    backgroundColor: '#e8f5e9',
  },
  categoryOptionText: {
    fontSize: 16,
    color: '#333',
  },
  categoryOptionTextSelected: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  imageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  imageWrapper: {
    width: 100,
    height: 100,
    marginRight: 12,
    marginBottom: 12,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  removeImageButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#f44336',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  mainImageBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  mainImageText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  addImageText: {
    color: '#4CAF50',
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AddPlantScreen;