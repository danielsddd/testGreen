// screens/EditProfileScreen-parts/SaveButton.js
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';

const SaveButton = ({ 
  onSave, 
  isSaving = false, 
  text = 'Save Changes',
  disabled = false
}) => {
  return (
    <TouchableOpacity
      style={[styles.saveButton, (isSaving || disabled) && styles.disabledButton]}
      onPress={onSave}
      disabled={isSaving || disabled}
    >
      {isSaving ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Text style={styles.saveButtonText}>{text}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 40,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.7,
  },
});

export default SaveButton;