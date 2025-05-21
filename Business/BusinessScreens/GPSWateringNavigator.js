// Business/BusinessScreens/GPSWateringNavigator.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Image,
  Animated,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

// Import services
import { markPlantAsWatered } from '../services/businessWateringApi';

const { width, height } = Dimensions.get('window');

export default function GPSWateringNavigator({ navigation, route }) {
  const { route: plantsRoute, businessId, onPlantWatered } = route.params || {};
  
  // State management
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [routeProgress, setRouteProgress] = useState(0);
  const [navigationStarted, setNavigationStarted] = useState(false);
  const [currentPlant, setCurrentPlant] = useState(null);
  const [distanceToTarget, setDistanceToTarget] = useState(null);
  const [isWatering, setIsWatering] = useState(false);
  
  // Animation refs
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Location tracking
  const locationSubscription = useRef(null);
  
  // Initialize and request permissions
  useEffect(() => {
    const initialize = async () => {
      try {
        // Request location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationPermission(status === 'granted');
        
        if (status !== 'granted') {
          Alert.alert(
            'Permission Denied',
            'GPS navigation requires location permission',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
        
        // Get initial location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
        });
        
        // Start animations
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing GPS navigator:', error);
        Alert.alert(
          'Error',
          'Could not initialize GPS navigation',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    };
    
    initialize();
    
    // Cleanup
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);
  
  // Start tracking when navigation begins
  useEffect(() => {
    if (navigationStarted && locationPermission) {
      // Start location tracking
      const startTracking = async () => {
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 1, // Update every 1 meter
            timeInterval: 1000, // Or every 1 second
          },
          (location) => {
            const newPosition = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy,
            };
            
            setCurrentLocation(newPosition);
            
            // Check distance to current target plant
            if (currentPlant && currentPlant.location && currentPlant