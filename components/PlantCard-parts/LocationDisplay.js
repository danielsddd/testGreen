import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const LocationDisplay = ({ location, city, onOpenMap }) => {
  const getLocationText = () => {
    if (typeof location === 'string') {
      return location;
    } else if (location && typeof location === 'object') {
      if (location.city) return location.city;
      if (location.latitude && location.longitude) {
        return `Location: ${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`;
      }
      return 'Local pickup';
    } else if (city) {
      return city;
    }
    return 'Local pickup';
  };

  const hasLocationCoordinates = () => {
    return (
      location &&
      typeof location === 'object' &&
      location.latitude &&
      location.longitude
    );
  };

  return (
    <View style={styles.locationRow}>
      <MaterialIcons name="location-on" size={12} color="#666" />
      <Text style={styles.locationText} numberOfLines={1}>{getLocationText()}</Text>
      {hasLocationCoordinates() && (
        <TouchableOpacity style={styles.mapButton} onPress={onOpenMap}>
          <MaterialIcons name="map" size={16} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },
  mapButton: {
    backgroundColor: '#388E3C',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginLeft: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
      },
      android: {
        elevation: 1,
      },
    }),
  },
});

export default LocationDisplay;