// screens/EditProfileScreen.js (fixed imports)
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  ActivityIndicator, // Added missing import
  TouchableOpacity, // Added missing import
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons'; // Added missing import
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import components
import MarketplaceHeader from '../components/MarketplaceHeader';
import LocationPicker from '../components/LocationPicker';

// Import extracted components
import ProfileForm from './EditProfileScreen-parts/ProfileForm';
import AvatarPicker from './EditProfileScreen-parts/AvatarPicker';
import SaveButton from './EditProfileScreen-parts/SaveButton';

// Import services
import { updateUserProfile, fetchUserProfile } from '../services/marketplaceApi';

// Rest of the component remains the same...

const EditProfileScreen = () => {
  const navigation = useNavigation();
  
  // Profile state
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    avatar: '',
    bio: '',
    city: '',
    phone: '',
    languages: '',
    fullAddress: '',
    birthDate: '',
    socialMedia: {
      instagram: '',
      facebook: '',
    },
    location: null,
    joinDate: new Date().toISOString()
  });
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  
  // Load user profile
  useEffect(() => {
    loadUserProfile();
  }, []);
  
  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get email from AsyncStorage
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      if (!userEmail) {
        setError('User not logged in');
        setIsLoading(false);
        return;
      }
      
      // Fetch user profile
      const data = await fetchUserProfile(userEmail);
      
      if (data && data.user) {
        // Update state with user data, preserving defaults for missing fields
        setProfile({
          ...profile,
          ...data.user,
          name: data.user.name || '',
          email: data.user.email || userEmail,
          avatar: data.user.avatar || '',
          bio: data.user.bio || '',
          city: data.user.city || (data.user.location?.city || ''),
          phone: data.user.phone || '',
          languages: data.user.languages || '',
          fullAddress: data.user.fullAddress || '',
          birthDate: data.user.birthDate || '',
          socialMedia: data.user.socialMedia || {
            instagram: '',
            facebook: ''
          },
          joinDate: data.user.joinDate || new Date().toISOString()
        });
      } else {
        // Set default profile with email
        setProfile({
          ...profile,
          email: userEmail,
        });
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile. Please try again later.');
      setIsLoading(false);
    }
  };
  
  // Handle field changes
  const handleChange = (field, value) => {
    if (field.includes('.')) {
      // Handle nested fields like socialMedia.instagram
      const [parent, child] = field.split('.');
      setProfile(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      // Handle regular fields
      setProfile(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };
  
  // Handle location change
  const handleLocationChange = (locationData) => {
    setProfile(prev => ({
      ...prev,
      location: locationData,
      city: locationData.city || prev.city
    }));
  };
  
  // Pick avatar image
  const pickAvatar = async () => {
    try {
      // Request media library permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'We need permission to access your photos');
        return;
      }
      
      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled) {
        // Get selected asset
        const selectedAsset = result.assets?.[0] || { uri: result.uri };
        
        if (selectedAsset?.uri) {
          setProfile(prev => ({
            ...prev,
            avatar: selectedAsset.uri
          }));
          setAvatarChanged(true);
        }
      }
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };
  
  // Save profile changes
  const handleSave = async () => {
    try {
      // Validate required fields
      if (!profile.name.trim()) {
        Alert.alert('Error', 'Name is required');
        return;
      }
      
      setIsSaving(true);
      
      // Prepare data for API
      const profileData = {
        name: profile.name,
        bio: profile.bio,
        city: profile.city,
        phone: profile.phone,
        languages: profile.languages,
        fullAddress: profile.fullAddress,
        birthDate: profile.birthDate,
        socialMedia: profile.socialMedia,
        location: profile.location,
      };
      
      // Upload avatar if changed
      if (avatarChanged && profile.avatar) {
        try {
          // Upload image implementation goes here
          // For now, we'll just use the URI directly
          profileData.avatar = profile.avatar;
        } catch (uploadErr) {
          console.error('Error uploading avatar:', uploadErr);
          Alert.alert('Warning', 'Could not upload avatar, but other profile changes will be saved.');
        }
      }
      
      // Call API to update profile
      await updateUserProfile(profile.email, profileData);
      
      // Success!
      Alert.alert('Success', 'Profile updated successfully');
      
      // Navigate back
      navigation.navigate('Profile', { refresh: true });
    } catch (err) {
      console.error('Error saving profile:', err);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Define form sections
  const publicInfoFields = [
    { name: 'name', label: 'Name', required: true },
    { name: 'email', label: 'Email', disabled: true },
    { name: 'bio', label: 'Bio', multiline: true, placeholder: 'Tell others about yourself...' },
    { name: 'languages', label: 'Languages', placeholder: 'Hebrew, English, Arabic, etc.' },
    // Social media fields moved to public section
    { name: 'socialMedia.instagram', label: 'Instagram', placeholder: 'Your Instagram username' },
    { name: 'socialMedia.facebook', label: 'Facebook', placeholder: 'Your Facebook profile' }
  ];
  
  const privateInfoFields = [
    { name: 'phone', label: 'Phone Number', keyboardType: 'phone-pad', placeholder: 'Your phone number' },
    { name: 'fullAddress', label: 'Full Address', multiline: true, placeholder: 'Your complete address' },
    { name: 'birthDate', label: 'Birth Date', placeholder: 'YYYY-MM-DD' }
  ];
  
  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Edit Profile"
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <MarketplaceHeader
          title="Edit Profile"
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadUserProfile}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <MarketplaceHeader
        title="Edit Profile"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidContainer}
      >
        <ScrollView style={styles.scrollView}>
          <AvatarPicker 
            imageUrl={profile.avatar}
            onPickImage={pickAvatar}
            userName={profile.name}
          />
          
          <ProfileForm 
            title="Public Information"
            subtitle="This information will be visible to other users"
            fields={publicInfoFields}
            values={profile}
            onChangeValue={handleChange}
          />
          
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Location</Text>
            <LocationPicker
              value={profile.location}
              onChange={handleLocationChange}
            />
          </View>
          
          <ProfileForm 
            title="Private Information"
            subtitle="This information is private and not shown to other users"
            fields={privateInfoFields}
            values={profile}
            onChangeValue={handleChange}
          />
          
          <SaveButton 
            onSave={handleSave}
            isSaving={isSaving}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardAvoidContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  formSection: {
    padding: 16,
    borderTopWidth: 8,
    borderTopColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default EditProfileScreen;