// screens/EditProfileScreen-parts/ProfileForm.js
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

const ProfileForm = ({ 
  title,
  subtitle,
  fields = [],
  values = {},
  onChangeValue,
  isDisabled = false
}) => {
  return (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      
      {fields.map(field => (
        <View key={field.name}>
          <Text style={styles.label}>
            {field.label} {field.required && <Text style={styles.requiredText}>*</Text>}
          </Text>
          <TextInput
            style={[
              styles.input, 
              field.multiline && styles.textArea,
              field.disabled && styles.disabledInput
            ]}
            value={values[field.name]}
            onChangeText={(text) => onChangeValue(field.name, text)}
            placeholder={field.placeholder || ''}
            multiline={field.multiline}
            numberOfLines={field.multiline ? 4 : 1}
            editable={!field.disabled && !isDisabled}
            keyboardType={field.keyboardType || 'default'}
            secureTextEntry={field.secureTextEntry}
            autoCapitalize={field.autoCapitalize}
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  formSection: {
    padding: 16,
    borderTopWidth: 8,
    borderTopColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  requiredText: {
    color: '#f44336',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
    marginBottom: 16,
  },
  disabledInput: {
    backgroundColor: '#eee',
    color: '#999',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
});

export default ProfileForm;