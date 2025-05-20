import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { searchPlants, createInventoryItem } from '../services/businessApi';

export default function AddInventoryScreen({ navigation, route }) {
  const { businessId } = route.params || {};
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Inventory form data
  const [formData, setFormData] = useState({
    quantity: '',
    price: '',
    minThreshold: '5',
    discount: '0',
    notes: '',
  });
  
  const [errors, setErrors] = useState({});

  // Search plants with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.length >= 2) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSearch = async (query) => {
    if (!query || query.length < 2) return;
    
    setIsSearching(true);
    try {
      const results = await searchPlants(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Search Error', 'Failed to search plants. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPlant = (plant) => {
    setSelectedPlant(plant);
    setSearchResults([]);
    setSearchQuery(plant.common_name);
  };

  const handleInputChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value,
    });
    
    // Clear error when field is changed
    if (errors[field]) {
      setErrors({
        ...errors,
        [field]: null,
      });
    }
  };

  const formatTemperature = (tempObj) => {
    if (!tempObj || typeof tempObj !== 'object') return 'Average room temperature';
    if (tempObj.min && tempObj.max) {
      return `${tempObj.min}°C - ${tempObj.max}°C`;
    }
    return 'Average room temperature';
  };

  const formatWaterDays = (days) => {
    if (typeof days === 'number') {
      return `Every ${days} days`;
    }
    return days || 'Every 7-10 days';
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!selectedPlant) {
      newErrors.plant = 'Please select a plant from the search results';
    }
    
    if (!formData.quantity || isNaN(formData.quantity) || parseInt(formData.quantity) <= 0) {
      newErrors.quantity = 'Please enter a valid quantity';
    }
    
    if (!formData.price || isNaN(formData.price) || parseFloat(formData.price) <= 0) {
      newErrors.price = 'Please enter a valid price';
    }
    
    if (formData.minThreshold && (isNaN(formData.minThreshold) || parseInt(formData.minThreshold) < 0)) {
      newErrors.minThreshold = 'Minimum threshold must be a number >= 0';
    }
    
    if (formData.discount && (isNaN(formData.discount) || parseFloat(formData.discount) < 0 || parseFloat(formData.discount) > 100)) {
      newErrors.discount = 'Discount must be between 0 and 100';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      const inventoryItem = {
        productType: 'plant',
        plantData: {
          id: selectedPlant.id,
          common_name: selectedPlant.common_name,
          scientific_name: selectedPlant.scientific_name,
          origin: selectedPlant.origin,
          water_days: selectedPlant.water_days,
          light: selectedPlant.light,
          humidity: selectedPlant.humidity,
          temperature: selectedPlant.temperature,
          pets: selectedPlant.pets,
          difficulty: selectedPlant.difficulty,
          repot: selectedPlant.repot,
          feed: selectedPlant.feed,
          common_problems: selectedPlant.common_problems,
        },
        quantity: parseInt(formData.quantity),
        price: parseFloat(formData.price),
        minThreshold: parseInt(formData.minThreshold) || 5,
        discount: parseFloat(formData.discount) || 0,
        notes: formData.notes,
        status: 'active',
      };
      
      await createInventoryItem(inventoryItem);
      
      Alert.alert(
        'Success',
        'Plant added to inventory successfully!',
        [
          {
            text: 'Add Another',
            onPress: () => {
              setSelectedPlant(null);
              setSearchQuery('');
              setFormData({
                quantity: '',
                price: '',
                minThreshold: '5',
                discount: '0',
                notes: '',
              });
            },
          },
          {
            text: 'Done',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to add plant to inventory. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderSearchResult = ({ item }) => (
    <TouchableOpacity 
      style={styles.searchResultItem} 
      onPress={() => handleSelectPlant(item)}
    >
      <View style={styles.searchResultContent}>
        <Text style={styles.searchResultName}>{item.common_name}</Text>
        <Text style={styles.searchResultScientific}>{item.scientific_name}</Text>
        <Text style={styles.searchResultDetails}>
          {item.light} • {formatWaterDays(item.water_days)} • Difficulty: {item.difficulty}/10
        </Text>
      </View>
      <MaterialIcons name="add" size={24} color="#216a94" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardAvoid}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="#216a94" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Plant to Inventory</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content}>
          {/* Plant Search */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Search Plants</Text>
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by common or scientific name"
                autoCapitalize="none"
              />
              {isSearching && (
                <ActivityIndicator size="small" color="#216a94" style={styles.searchLoader} />
              )}
            </View>
            {errors.plant && <Text style={styles.errorText}>{errors.plant}</Text>}
          </View>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Search Results ({searchResults.length})</Text>
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.id}
                style={styles.searchResults}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Selected Plant */}
          {selectedPlant && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Selected Plant</Text>
              <View style={styles.selectedPlantCard}>
                <View style={styles.selectedPlantHeader}>
                  <MaterialCommunityIcons name="leaf" size={24} color="#4CAF50" />
                  <View style={styles.selectedPlantInfo}>
                    <Text style={styles.selectedPlantName}>{selectedPlant.common_name}</Text>
                    <Text style={styles.selectedPlantScientific}>{selectedPlant.scientific_name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedPlant(null)}>
                    <MaterialIcons name="close" size={20} color="#999" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.plantDetails}>
                  <View style={styles.plantDetailRow}>
                    <Text style={styles.plantDetailLabel}>Origin:</Text>
                    <Text style={styles.plantDetailValue}>{selectedPlant.origin}</Text>
                  </View>
                  <View style={styles.plantDetailRow}>
                    <Text style={styles.plantDetailLabel}>Watering:</Text>
                    <Text style={styles.plantDetailValue}>{formatWaterDays(selectedPlant.water_days)}</Text>
                  </View>
                  <View style={styles.plantDetailRow}>
                    <Text style={styles.plantDetailLabel}>Light:</Text>
                    <Text style={styles.plantDetailValue}>{selectedPlant.light}</Text>
                  </View>
                  <View style={styles.plantDetailRow}>
                    <Text style={styles.plantDetailLabel}>Temperature:</Text>
                    <Text style={styles.plantDetailValue}>{formatTemperature(selectedPlant.temperature)}</Text>
                  </View>
                  <View style={styles.plantDetailRow}>
                    <Text style={styles.plantDetailLabel}>Difficulty:</Text>
                    <Text style={styles.plantDetailValue}>{selectedPlant.difficulty}/10</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Inventory Details */}
          {selectedPlant && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Inventory Details</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Quantity in Stock <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={[styles.input, errors.quantity && styles.inputError]}
                  value={formData.quantity}
                  onChangeText={(text) => handleInputChange('quantity', text)}
                  placeholder="Enter quantity"
                  keyboardType="numeric"
                />
                {errors.quantity && <Text style={styles.errorText}>{errors.quantity}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Price per Plant ($) <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={[styles.input, errors.price && styles.inputError]}
                  value={formData.price}
                  onChangeText={(text) => handleInputChange('price', text)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
                {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Min. Threshold</Text>
                  <TextInput
                    style={[styles.input, errors.minThreshold && styles.inputError]}
                    value={formData.minThreshold}
                    onChangeText={(text) => handleInputChange('minThreshold', text)}
                    placeholder="5"
                    keyboardType="numeric"
                  />
                  {errors.minThreshold && <Text style={styles.errorText}>{errors.minThreshold}</Text>}
                </View>

                <View style={styles.halfInput}>
                  <Text style={styles.label}>Discount (%)</Text>
                  <TextInput
                    style={[styles.input, errors.discount && styles.inputError]}
                    value={formData.discount}
                    onChangeText={(text) => handleInputChange('discount', text)}
                    placeholder="0"
                    keyboardType="decimal-pad"
                  />
                  {errors.discount && <Text style={styles.errorText}>{errors.discount}</Text>}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.notes}
                  onChangeText={(text) => handleInputChange('notes', text)}
                  placeholder="Additional notes about this inventory item"
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Save Button */}
        {selectedPlant && (
          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} 
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="check" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Add to Inventory</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#216a94',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  searchIcon: {
    marginLeft: 12,
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  searchLoader: {
    marginRight: 12,
  },
  searchResults: {
    maxHeight: 300,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  searchResultScientific: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 2,
  },
  searchResultDetails: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  selectedPlantCard: {
    backgroundColor: '#f0f9f3',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    padding: 16,
  },
  selectedPlantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectedPlantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  selectedPlantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedPlantScientific: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 2,
  },
  plantDetails: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 6,
    padding: 12,
  },
  plantDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  plantDetailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  plantDetailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  required: {
    color: '#e53935',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  inputError: {
    borderColor: '#e53935',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    flex: 0.48,
  },
  errorText: {
    color: '#e53935',
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  saveButton: {
    backgroundColor: '#216a94',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#999',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});