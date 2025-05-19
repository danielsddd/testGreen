import React from 'react';
import { FlatList, View, Text, StyleSheet, Animated } from 'react-native';
import SuggestionItem from './SuggestionItem';

const SuggestionsList = ({
  visible,
  suggestions,
  onSelectSuggestion,
  height,
  opacity
}) => {
  if (!visible) return null;

  return (
    <Animated.View style={[
      styles.suggestionsContainer,
      {
        height,
        opacity
      }
    ]}>
      <FlatList
        data={suggestions}
        keyExtractor={(item, index) => `suggestion-${index}-${item.id || ''}`}
        renderItem={({ item }) => (
          <SuggestionItem item={item} onPress={onSelectSuggestion} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No suggestions found</Text>
          </View>
        }
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 12,
  },
  emptyContainer: {
    padding: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
});

export default SuggestionsList;