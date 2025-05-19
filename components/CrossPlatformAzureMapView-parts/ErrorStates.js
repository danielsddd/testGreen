import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export const KeyMissingError = () => (
  <View style={styles.errorContainer}>
    <MaterialIcons name="error-outline" size={48} color="#f44336" />
    <Text style={styles.errorText}>Azure Maps API Key Missing</Text>
    <Text style={styles.errorDescription}>
      Could not load map configuration. Please try again later.
    </Text>
  </View>
);

export const LoadingState = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#4CAF50" />
    <Text style={styles.loadingText}>Loading map…</Text>
  </View>
);

export const GeneralError = ({ message }) => (
  <View style={styles.errorContainer}>
    <MaterialIcons name="error-outline" size={48} color="#f44336" />
    <Text style={styles.errorText}>Map failed to load</Text>
    {message ? (
      <Text style={styles.errorDescription}>{message}</Text>
    ) : null}
  </View>
);

export const EmptyState = () => (
  <View style={styles.emptyContainer}>
    <MaterialIcons name="location-off" size={48} color="#aaa" />
    <Text style={styles.emptyText}>No plants with location data</Text>
  </View>
);

const styles = StyleSheet.create({
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { 
    marginTop: 10, 
    color: '#4CAF50', 
    fontSize: 16 
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fafafa',
  },
  errorText: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#333', 
    marginTop: 12 
  },
  errorDescription: { 
    fontSize: 14, 
    color: '#666', 
    textAlign: 'center', 
    marginTop: 8 
  },
  emptyContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  emptyText: { 
    fontSize: 16, 
    color: '#666', 
    marginTop: 12 
  },
});