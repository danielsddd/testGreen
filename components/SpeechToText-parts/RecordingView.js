import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const RecordingView = ({ pulseAnim, recordingDuration }) => {
  return (
    <View style={styles.recordingContainer}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <MaterialIcons name="mic" size={22} color="#f44336" />
      </Animated.View>
      <Text style={styles.recordingText}>{recordingDuration}s</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#f44336',
  },
});

export default RecordingView;