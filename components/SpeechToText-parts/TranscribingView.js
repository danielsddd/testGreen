import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

const TranscribingView = ({ status }) => {
  return (
    <View style={styles.transcribingContainer}>
      <ActivityIndicator size="small" color="#4CAF50" />
      <Text style={styles.transcribingText} numberOfLines={1}>{status}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  transcribingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transcribingText: {
    marginLeft: 4,
    fontSize: 10,
    color: '#4CAF50',
    maxWidth: 60,
  },
});

export default TranscribingView;