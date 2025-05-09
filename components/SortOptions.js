import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Sort options component for marketplace with improved styling
 */
const SortOptions = ({ selectedOption = 'recent', onSelectOption }) => {
  const [modalVisible, setModalVisible] = useState(false);

  // Sort options
  const options = [
    { id: 'recent', label: 'Most Recent', icon: 'access-time' },
    { id: 'priceAsc', label: 'Price: Low to High', icon: 'arrow-upward' },
    { id: 'priceDesc', label: 'Price: High to Low', icon: 'arrow-downward' },
    { id: 'popular', label: 'Most Popular', icon: 'trending-up' },
    { id: 'rating', label: 'Highest Rated Seller', icon: 'star-rate' },
  ];

  // Find the current selected option object
  const currentOption = options.find(option => option.id === selectedOption) || options[0];

  const handleSelectOption = (option) => {
    setModalVisible(false);
    if (onSelectOption) {
      onSelectOption(option.id);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.sortButton}
        onPress={() => setModalVisible(true)}
      >
        <MaterialIcons name="sort" size={20} color="#4CAF50" />
        <Text style={styles.sortButtonText}>Sort: {currentOption.label}</Text>
        <MaterialIcons name="arrow-drop-down" size={20} color="#4CAF50" />
      </TouchableOpacity>

      <Modal
        transparent={true}
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort By</Text>
            
            <FlatList
              data={options}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    selectedOption === item.id && styles.selectedOption
                  ]}
                  onPress={() => handleSelectOption(item)}
                >
                  <MaterialIcons
                    name={item.icon}
                    size={20}
                    color={selectedOption === item.id ? '#4CAF50' : '#666'}
                  />
                  <Text
                    style={[
                      styles.optionText,
                      selectedOption === item.id && styles.selectedOptionText
                    ]}
                  >
                    {item.label}
                  </Text>
                  {selectedOption === item.id && (
                    <MaterialIcons name="check" size={18} color="#4CAF50" />
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.optionsList}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // Set width to match the designs in the screenshot
    width: '70%', // Give more space for sort button text
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sortButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginHorizontal: 4,
    // Ensure text doesn't get cut off
    flexShrink: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '80%',
    maxWidth: 320,
    overflow: 'hidden',
    // Add shadow for better visibility
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    textAlign: 'center',
  },
  optionsList: {
    paddingBottom: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedOption: {
    backgroundColor: '#f0f9f0',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  selectedOptionText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
});

export default SortOptions;