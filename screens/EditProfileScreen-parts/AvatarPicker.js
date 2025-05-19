// screens/EditProfileScreen-parts/AvatarPicker.js
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const AvatarPicker = ({ 
  imageUrl, 
  onPickImage,
  userName = 'User'
}) => {
  // Generate default avatar URL from name
  const getDefaultAvatarUrl = () => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(userName.substring(0, 1))}&background=4CAF50&color=fff&size=256`;
  };
  
  return (
    <View style={styles.avatarSection}>
      <Image
        source={{ uri: imageUrl || getDefaultAvatarUrl() }}
        style={styles.avatar}
      />
      <TouchableOpacity style={styles.changeAvatarButton} onPress={onPickImage}>
        <MaterialIcons name="photo-camera" size={18} color="#fff" />
        <Text style={styles.changeAvatarText}>Change Photo</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  avatarSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#eee',
  },
  changeAvatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 10,
  },
  changeAvatarText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
});

export default AvatarPicker;