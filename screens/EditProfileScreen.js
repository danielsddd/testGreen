// screens/EditProfileScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
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
import { updateUserProfile, uploadImage } from '../services/marketplaceApi';

/**
 * EditProfileScreen - Edit user profile information
 */
const EditProfileScreen = ({ navigation, route }) => {
  // Get user profile from route params
  const userProfile = route.params?.userProfile;
  
  // State
  const [name, setName] = useState(userProfile?.name || '');
  const [avatar, setAvatar] = useState(userProfile?.avatar || null);
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [location, setLocation] = useState(userProfile?.location || null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [newAvatarUri, setNewAvatarUri] = useState(null);
  
  // Request camera permissions on mount
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Needed',
            'Sorry, we need camera roll permissions to upload profile photos'
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
      name !== (userProfile?.name || '') ||
      bio !== (userProfile?.bio || '') ||
      newAvatarUri !== null ||
      JSON.stringify(location) !== JSON.stringify(userProfile?.location || null)
    );
  };
  
  // Pick avatar image
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        setNewAvatarUri(selectedImage.uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };
  
  // Handle location change from LocationPicker
  const handleLocationChange = (locationData) => {
    setLocation(locationData);
    setErrors((prev) => ({ ...prev, location: null }));
  };
  
  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!name.trim()) {
      newErrors.name = 'Name is required';
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
    
    try {
      // Get user email
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      if (!userEmail) {
        Alert.alert('Error', 'You need to be logged in to update your profile.');
        setIsLoading(false);
        return;
      }
      
      // Upload new avatar if selected
      let avatarUrl = avatar;
      
      if (newAvatarUri) {
        try {
          const result = await uploadImage(newAvatarUri, 'avatar');
          
          if (result && result.url) {
            avatarUrl = result.url;
          }
        } catch (uploadError) {
          console.error('Error uploading avatar:', uploadError);
          Alert.alert('Warning', 'Failed to upload new avatar, but will continue updating other profile information.');
        }
      }
      
      // Create updated profile data
      const updatedProfile = {
        name: name.trim(),
        bio: bio.trim(),
        location: location || {},
      };
      
      // Add avatar if available
      if (avatarUrl) {
        updatedProfile.avatar = avatarUrl;
      }
      
      // Update user profile
      const result = await updateUserProfile(userEmail, updatedProfile);
      
      // Signal profile update to ProfileScreen
      try {
        await AsyncStorage.setItem('PROFILE_UPDATED', Date.now().toString());
      } catch (e) {
        console.warn('Failed to set profile update flag:', e);
      }
      
      // Show success message
      Alert.alert(
        'Success',
        'Your profile has been updated successfully!',
        [
          { 
            text: 'OK', 
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <MarketplaceHeader
        title="Edit Profile"
        showBackButton={true}
        onBackPress={handleBackPress}
        showNotifications={false}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar Section */}
        <View style={styles.avatarContainer}>
          {newAvatarUri ? (
            <Image
              source={{ uri: newAvatarUri }}
              style={styles.avatarImage}
            />
          ) : avatar ? (
            <Image
              source={{ uri: avatar }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.defaultAvatar}>
              <Text style={styles.avatarInitial}>
                {name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          
          <TouchableOpacity
            style={styles.changeAvatarButton}
            onPress={pickImage}
          >
            <MaterialIcons name="photo-camera" size={18} color="#fff" />
            <Text style={styles.changeAvatarText}>Change Photo</Text>
          </TouchableOpacity>
        </View>
        
        {/* Form Fields */}
        <View style={styles.formContainer}>
          {/* Name Input */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Name*</Text>
            <TextInput
              style={[styles.input, errors.name ? styles.inputError : null]}
              value={name}
              onChangeText={(text) => {
                setName(text);
                setErrors((prev) => ({ ...prev, name: null }));
              }}
              placeholder="Your name"
              placeholderTextColor="#999"
            />
            {errors.name ? (
              <Text style={styles.errorText}>{errors.name}</Text>
            ) : null}
          </View>
          
          {/* Bio Input */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={styles.textArea}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell others about yourself"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
          
          {/* Location Picker */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Location</Text>
            <LocationPicker
              value={location}
              onChange={handleLocationChange}
            />
          </View>
          
          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.saveButton, isLoading ? styles.saveButtonDisabled : null]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  contentContainer: {
    padding: 16,
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
  },
  defaultAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
  },
  changeAvatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 16,
  },
  changeAvatarText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
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
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EditProfileScreen;