import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// For regular users
export const UserActionButtons = ({ onShare, onContact, isSubmitting }) => (
  <View style={styles.actionButtons}>
    <TouchableOpacity style={styles.actionButton} onPress={onShare}>
      <MaterialIcons name="share" size={14} color="#4CAF50" />
      <Text style={styles.actionText}>Share</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.actionButton} onPress={onContact} disabled={isSubmitting}>
      <MaterialIcons name="chat" size={14} color="#4CAF50" />
      <Text style={[styles.actionText, isSubmitting && styles.disabledText]}>
        Contact
      </Text>
    </TouchableOpacity>
  </View>
);

// For business nursery
export const BusinessActionButtons = ({ onEdit, onManageStock }) => (
  <View style={styles.actionButtons}>
    <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
      <MaterialIcons name="edit" size={14} color="#4CAF50" />
      <Text style={styles.actionText}>Edit</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.actionButton} onPress={onManageStock}>
      <MaterialIcons name="inventory" size={14} color="#4CAF50" />
      <Text style={styles.actionText}>Manage</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
  },
  disabledText: {
    color: '#aaa',
  },
});