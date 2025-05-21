// Business/BusinessScreens/WateringChecklistScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons, MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import services
import { getWateringChecklist, markPlantAsWatered, getOptimizedWateringRoute } from '../services/businessWateringApi';

export default function WateringChecklistScreen({ navigation, route }) {
  // State management
  const [checklist, setChecklist] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businessId, setBusinessId] = useState(null);
  const [error, setError] = useState(null);
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [stats, setStats] = useState({
    totalCount: 0,
    needsWateringCount: 0
  });
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [showOptimizedRoute, setShowOptimizedRoute] = useState(false);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  
  // Auto-refresh timer
  const refreshTimer = useRef(null);
  const autoRefreshInterval = 60000; // 1 minute
  
  // Initialize when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const initialize = async () => {
        try {
          const storedBusinessId = await AsyncStorage.getItem('businessId');
          if (storedBusinessId) {
            setBusinessId(storedBusinessId);
            loadChecklist(storedBusinessId);
            startAutoRefresh(storedBusinessId);
            startEntranceAnimation();
          }
        } catch (error) {
          console.error('Error initializing:', error);
          setError('Failed to initialize checklist');
        }
      };
      
      initialize();
      
      return () => {
        if (refreshTimer.current) {
          clearInterval(refreshTimer.current);
        }
      };
    }, [])
  );
  
  // Animation functions
  const startEntranceAnimation = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };
  
  const startShakeAnimation = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };
  
  // Auto-refresh setup
  const startAutoRefresh = (businessId) => {
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
    }
    
    refreshTimer.current = setInterval(() => {
      if (businessId) {
        loadChecklist(businessId, true); // Silent refresh
      }
    }, autoRefreshInterval);
  };
  
  // Load checklist data
  const loadChecklist = async (businessId, silent = false) => {
    if (!businessId) return;
    
    if (!silent) {
      setIsLoading(true);
      setRefreshing(true);
    }
    
    try {
      const data = await getWateringChecklist(businessId);
      
      setChecklist(data.checklist || []);
      setStats({
        totalCount: data.totalCount || 0,
        needsWateringCount: data.needsWateringCount || 0
      });
      
      // Get optimized route if there are plants needing watering
      if (data.needsWateringCount > 0) {
        try {
          const routeData = await getOptimizedWateringRoute(businessId);
          setOptimizedRoute(routeData);
        } catch (routeError) {
          console.warn('Could not get optimized route:', routeError);
        }
      }
      
      setError(null);
    } catch (error) {
      console.error('Error loading checklist:', error);
      if (!silent) {
        setError('Could not load watering checklist');
        startShakeAnimation();
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
        setRefreshing(false);
      }
    }
  };
  
  // Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    if (businessId) {
      loadChecklist(businessId);
    }
  }, [businessId]);
  
  // Mark plant as watered
  const handleMarkWatered = async (plantId) => {
    try {
      const result = await markPlantAsWatered(plantId, 'manual');
      
      if (result.success) {
        // Update the local state
        setChecklist(prev => prev.map(plant => 
          plant.id === plantId 
            ? { ...plant, needsWatering: false, lastWatered: new Date().toISOString().split('T')[0], completed: true } 
            : plant
        ));
        
        // Update stats
        setStats(prev => ({
          ...prev,
          needsWateringCount: Math.max(0, prev.needsWateringCount - 1)
        }));
        
        // Show success feedback
        Alert.alert('✅ Success', `${result.plant.name} has been watered.`);
        
        // Refresh checklist after a short delay
        setTimeout(() => {
          if (businessId) {
            loadChecklist(businessId, true);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error marking plant as watered:', error);
      Alert.alert('❌ Error', 'Could not mark plant as watered');
      startShakeAnimation();
    }
  };
  
  // Handle opening barcode scanner
  const handleScanBarcode = () => {
    navigation.navigate('BarcodeScannerScreen', {
      onBarcodeScanned: handleBarcodeScanned,
      businessId
    });
  };
  
  // Handle barcode scan result
  const handleBarcodeScanned = (data) => {
    try {
      // Parse barcode data
      const barcodeData = JSON.parse(data);
      
      if (barcodeData.type === 'plant' && barcodeData.id) {
        // Find the plant in the checklist
        const plant = checklist.find(p => p.id === barcodeData.id);
        
        if (plant) {
          // Mark plant as watered
          handleMarkWatered(plant.id);
        } else {
          Alert.alert('⚠️ Plant Not Found', 'This plant is not in your watering checklist');
        }
      } else {
        Alert.alert('⚠️ Invalid Barcode', 'This barcode does not contain valid plant data');
      }
    } catch (error) {
      console.error('Error processing barcode:', error);
      Alert.alert('❌ Invalid Format', 'The scanned barcode is not in a valid format');
    }
  };
  
  // Handle GPS navigation
  const handleGPSNavigation = () => {
    if (optimizedRoute && optimizedRoute.route && optimizedRoute.route.length > 0) {
      navigation.navigate('GPSWateringNavigator', {
        route: optimizedRoute.route,
        businessId,
        onPlantWatered: (plantId) => {
          handleMarkWatered(plantId);
        }
      });
    } else {
      Alert.alert('⚠️ No Route Available', 'Could not generate a watering route. Please make sure your plants have location data.');
    }
  };
  
  // Toggle optimized route view
  const toggleOptimizedRoute = () => {
    setShowOptimizedRoute(!showOptimizedRoute);
  };
  
  // Render loading state
  if (isLoading && checklist.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading watering checklist...</Text>
        </View>
      </View>
    );
  }
  
  // Render error state
  if (error && checklist.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadChecklist(businessId)}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Plant Watering</Text>
          <Text style={styles.headerSubtitle}>
            {stats.needsWateringCount} plants need watering
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.notificationButton}
          onPress={() => navigation.navigate('NotificationSettings')}
        >
          <MaterialIcons name="notifications" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
      
      {/* Weather Card */}
      {weatherInfo && (
        <Animated.View 
          style={[
            styles.weatherCard,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
          <View style={styles.weatherIconContainer}>
            <MaterialCommunityIcons name="weather-cloudy" size={40} color="#2196F3" />
          </View>
          
          <View style={styles.weatherInfo}>
            <Text style={styles.weatherLocation}>{weatherInfo.location}</Text>
            <Text style={styles.weatherTemp}>{weatherInfo.temperature}°C</Text>
            <Text style={styles.weatherCondition}>{weatherInfo.condition}</Text>
          </View>
          
          <View style={styles.precipitation}>
            <MaterialCommunityIcons name="water" size={16} color="#2196F3" />
            <Text style={styles.precipitationText}>
              {weatherInfo.precipitation}% chance of rain
            </Text>
          </View>
        </Animated.View>
      )}
      
      {/* Action Buttons */}
      <Animated.View 
        style={[
          styles.actionButtonsContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleScanBarcode}
        >
          <MaterialCommunityIcons name="barcode-scan" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Scan Barcode</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.actionButton,
            stats.needsWateringCount === 0 && styles.disabledButton
          ]}
          onPress={handleGPSNavigation}
          disabled={stats.needsWateringCount === 0}
        >
          <MaterialIcons name="map" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>GPS Navigation</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.actionButton,
            stats.needsWateringCount === 0 && styles.disabledButton,
            optimizedRoute?.route?.length > 0 && showOptimizedRoute && styles.activeButton
          ]}
          onPress={toggleOptimizedRoute}
          disabled={stats.needsWateringCount === 0 || !optimizedRoute}
        >
          <MaterialIcons name="route" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>
            {showOptimizedRoute ? 'Hide Route' : 'Show Route'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
      
      {/* Optimized Route View */}
      {showOptimizedRoute && optimizedRoute && optimizedRoute.route && (
        <Animated.View 
          style={[
            styles.optimizedRouteContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
          <View style={styles.routeHeader}>
            <Text style={styles.routeTitle}>Optimized Watering Route</Text>
            <Text style={styles.routeSubtitle}>
              {optimizedRoute.totalPlants} plants • {optimizedRoute.estimatedTime.formatted}
            </Text>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.routeSteps}>
              {optimizedRoute.route.map((plant, index) => (
                <View key={plant.id} style={styles.routeStep}>
                  <View style={styles.routeStepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  
                  <View style={styles.routeStepInfo}>
                    <Text style={styles.routeStepName}>{plant.name}</Text>
                    {plant.location && (
                      <Text style={styles.routeStepLocation}>
                        {[
                          plant.location.section && `Section ${plant.location.section}`,
                          plant.location.aisle && `Aisle ${plant.location.aisle}`,
                          plant.location.shelfNumber && `Shelf ${plant.location.shelfNumber}`
                        ].filter(Boolean).join(', ')}
                      </Text>
                    )}
                  </View>
                  
                  {index < optimizedRoute.route.length - 1 && (
                    <View style={styles.routeArrow}>
                      <MaterialIcons name="arrow-forward" size={16} color="#4CAF50" />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
          
          <TouchableOpacity 
            style={styles.startNavigationButton}
            onPress={handleGPSNavigation}
          >
            <MaterialIcons name="navigation" size={20} color="#fff" />
            <Text style={styles.startNavigationText}>Start Navigation</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
      
      {/* Checklist */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
      >
        <Animated.View 
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <Text style={styles.sectionTitle}>Watering Checklist</Text>
          
          {checklist.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="water-off" size={64} color="#e0e0e0" />
              <Text style={styles.emptyText}>No plants need watering</Text>
              <Text style={styles.emptySubtext}>All your plants are properly watered!</Text>
            </View>
          ) : (
            checklist.map((plant) => (
              <Animated.View 
                key={plant.id}
                style={[
                  styles.plantCard,
                  plant.needsWatering && styles.needsWateringCard,
                  plant.completed && styles.completedCard,
                  {
                    transform: [{ scale: scaleAnim }],
                  }
                ]}
              >
                <View style={styles.plantInfo}>
                  <View style={styles.plantIconContainer}>
                    <MaterialCommunityIcons 
                      name="leaf" 
                      size={28} 
                      color={plant.needsWatering ? "#f44336" : "#4CAF50"} 
                    />
                  </View>
                  
                  <View style={styles.plantDetails}>
                    <Text style={styles.plantName}>{plant.name}</Text>
                    {plant.scientificName && (
                      <Text style={styles.scientificName}>{plant.scientificName}</Text>
                    )}
                    <View style={styles.plantMeta}>
                      {plant.needsWatering ? (
                        <View style={styles.needsWateringBadge}>
                          <MaterialCommunityIcons name="water" size={14} color="#fff" />
                          <Text style={styles.needsWateringText}>Needs Watering</Text>
                        </View>
                      ) : (
                        <View style={styles.daysRemainingBadge}>
                          <Text style={styles.daysRemainingText}>
                            {plant.daysRemaining} days remaining
                          </Text>
                        </View>
                      )}
                      
                      {plant.location && plant.location.section && (
                        <View style={styles.locationBadge}>
                          <MaterialIcons name="place" size={12} color="#2196F3" />
                          <Text style={styles.locationText}>
                            {[
                              plant.location.section && `S${plant.location.section}`,
                              plant.location.aisle && `A${plant.location.aisle}`
                            ].filter(Boolean).join('-')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                
                {plant.needsWatering && (
                  <TouchableOpacity 
                    style={styles.waterButton}
                    onPress={() => handleMarkWatered(plant.id)}
                  >
                    <MaterialCommunityIcons name="water" size={20} color="#fff" />
                    <Text style={styles.waterButtonText}>Water</Text>
                  </TouchableOpacity>
                )}
                
                {!plant.needsWatering && (
                  <View style={styles.lastWatered}>
                    <Text style={styles.lastWateredText}>
                      Last watered: {new Date(plant.lastWatered).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </Animated.View>
            ))
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  notificationButton: {
    padding: 8,
  },
  weatherCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  weatherIconContainer: {
    marginRight: 16,
    justifyContent: 'center',
  },
  weatherInfo: {
    flex: 1,
  },
  weatherLocation: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  weatherTemp: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 4,
  },
  weatherCondition: {
    fontSize: 14,
    color: '#666',
  },
  precipitation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  precipitationText: {
    fontSize: 12,
    color: '#2196F3',
    marginLeft: 4,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#bdbdbd',
  },
  activeButton: {
    backgroundColor: '#2196F3',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 12,
  },
  optimizedRouteContainer: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  routeHeader: {
    marginBottom: 12,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  routeSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  routeSteps: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  routeStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  routeStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  routeStepInfo: {
    marginRight: 8,
  },
  routeStepName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  routeStepLocation: {
    fontSize: 12,
    color: '#666',
  },
  routeArrow: {
    marginHorizontal: 8,
  },
  startNavigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  startNavigationText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  plantCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  needsWateringCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  completedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  plantInfo: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  plantIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f9f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  plantDetails: {
    flex: 1,
  },
  plantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  scientificName: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 2,
  },
  plantMeta: {
    flexDirection: 'row',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  needsWateringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f44336',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  needsWateringText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  daysRemainingBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  daysRemainingText: {
    color: '#666',
    fontSize: 12,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  locationText: {
    color: '#2196F3',
    fontSize: 12,
    marginLeft: 4,
  },
  waterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 8,
  },
  waterButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  lastWatered: {
    alignItems: 'center',
  },
  lastWateredText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});