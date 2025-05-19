import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const SuggestionItem = ({ item, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => onPress(item)}
    >
      <MaterialIcons name="place" size={20} color="#4CAF50" style={styles.suggestionIcon} />
      <View style={styles.suggestionTextContainer}>
        <Text style={styles.suggestionText} numberOfLines={1}>
          {item.address?.freeformAddress || 'Address'}
        </Text>
        <Text style={styles.suggestionSubtext} numberOfLines={1}>
          {item.address?.municipality}, {item.address?.country}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  suggestionIcon: {
    marginRight: 12,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
  },
  suggestionSubtext: {
    fontSize: 12,
    color: '#999',
  },
});

export default SuggestionItem;