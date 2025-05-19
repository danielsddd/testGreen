import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const CardHeader = ({ onClose }) => {
  return (
    <TouchableOpacity 
      style={styles.closeButton}
      onPress={onClose}
      hitSlop={{ top: 20, right: 20, bottom: 20, left: 20 }}
    >
      <MaterialIcons name="close" size={20} color="#666" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    padding: 8,
  },
});

export default CardHeader;