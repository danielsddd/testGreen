import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function BusinessInventorySetupScreen({ navigation }) {
  const [businessId, setBusinessId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBusinessId();
  }, []);

  const loadBusinessId = async () => {
    try {
      const email = await AsyncStorage.getItem('userEmail');
      const storedBusinessId = await AsyncStorage.getItem('businessId');
      setBusinessId(storedBusinessId || email);
    } catch (error) {
      console.error('Error loading business ID:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPlants = () => {
    navigation.navigate('AddInventoryScreen', { businessId });
  };

  const handleSkipForNow = () => {
    Alert.alert(
      'Skip Inventory Setup',
      'You can add plants to your inventory later from your business dashboard.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Continue', 
          onPress: () => navigation.navigate('BusinessDashboard')
        },
      ]
    );
  };

  const handleFinishSetup = () => {
    Alert.alert(
      'Setup Complete!',
      'Your business account is ready. You can start managing your inventory and serving customers.',
      [
        { 
          text: 'Go to Dashboard', 
          onPress: () => navigation.navigate('BusinessDashboard')
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#216a94" />
          <Text style={styles.loadingText}>Setting up your business...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="store-outline" size={64} color="#216a94" />
          <Text style={styles.title}>Setup Your Inventory</Text>
          <Text style={styles.subtitle}>
            Add plants to your inventory to start selling on the marketplace
          </Text>
        </View>

        <View style={styles.optionsContainer}>
          <TouchableOpacity style={styles.primaryOption} onPress={handleAddPlants}>
            <View style={styles.optionIcon}>
              <MaterialCommunityIcons name="leaf" size={32} color="#fff" />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Add Plants</Text>
              <Text style={styles.optionDescription}>
                Search and add plants from our database to your inventory
              </Text>
            </View>
            <MaterialIcons name="arrow-forward" size={24} color="#216a94" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryOption} onPress={handleSkipForNow}>
            <View style={styles.optionIcon}>
              <MaterialIcons name="schedule" size={28} color="#666" />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.secondaryOptionTitle}>Skip for Now</Text>
              <Text style={styles.optionDescription}>
                You can add inventory items later from your dashboard
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>What you can add:</Text>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="leaf" size={20} color="#4CAF50" />
            <Text style={styles.infoText}>Live plants with care instructions</Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="hammer-wrench" size={20} color="#FF9800" />
            <Text style={styles.infoText}>Gardening tools and accessories</Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="seed" size={20} color="#8BC34A" />
            <Text style={styles.infoText}>Seeds and plant supplies</Text>
          </View>
        </View>
      </ScrollView>

      {/* Finish Setup Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.finishButton} onPress={handleFinishSetup}>
          <MaterialIcons name="check-circle" size={20} color="#fff" />
          <Text style={styles.finishButtonText}>Finish Setup</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  content: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#216a94',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  optionsContainer: {
    marginBottom: 32,
  },
  primaryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#216a94',
    marginBottom: 16,
  },
  secondaryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#216a94',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#216a94',
    marginBottom: 4,
  },
  secondaryOptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  infoSection: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  finishButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});