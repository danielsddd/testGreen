import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const SelectedLocation = ({ address }) => {
  if (!address) return null;
  
  return (
    <View style={styles.selectedLocationContainer}>
      <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
      <Text style={styles.selectedLocationText} numberOfLines={2}>
        {address}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  selectedLocationContainer: {
    backgroundColor: '#f0f9f0',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedLocationText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
});

export default SelectedLocation;