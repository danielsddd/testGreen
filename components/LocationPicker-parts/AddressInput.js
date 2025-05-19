import React from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const AddressInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  isLoading,
  onFocus,
  required = false
}) => {
  return (
    <View style={styles.inputRow}>
      <Text style={styles.fieldLabel}>
        {label} {required && <Text style={styles.requiredAsterisk}>*</Text>}
      </Text>
      <View style={styles.inputContainer}>
        <MaterialIcons name={icon} size={20} color="#4CAF50" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          onFocus={onFocus}
        />
        {isLoading && (
          <ActivityIndicator size="small" color="#4CAF50" style={styles.loadingIndicator} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  inputRow: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  requiredAsterisk: {
    color: '#D32F2F',
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  loadingIndicator: {
    marginLeft: 8,
  },
});

export default AddressInput;