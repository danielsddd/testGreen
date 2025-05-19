import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const ToggleButton = ({ 
  isActive, 
  onPress, 
  icon, 
  label, 
  accessibilityLabel 
}) => {
  return (
    <TouchableOpacity
      style={[styles.toggleButton, isActive && styles.activeToggle]}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <MaterialIcons 
        name={icon} 
        size={20} 
        color={isActive ? '#4CAF50' : '#999'} 
      />
      <Text style={[
        styles.toggleText, 
        isActive && styles.activeToggleText
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
  },
  activeToggle: {
    backgroundColor: '#e6f7e6',
  },
  toggleText: {
    fontSize: 14,
    color: '#999',
    marginLeft: 6,
  },
  activeToggleText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
});

export default ToggleButton;