// Business/BusinessScreens/BarcodeScannerScreen.js - FIXED VERSION
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import services
import { 
  markPlantAsWatered,
  getWateringChecklist,
  setCachedWateringChecklist,
  getCachedWateringChecklist
} from '../services/businessWateringApi';

const { width, height } = Dimensions.get('window');
const SCAN_AREA_SIZE = 250;

export default function BarcodeScannerScreen({ navigation, route }) {
  const { onBarcodeScanned, businessId, mode = 'general' } = route.params || {};
  
  // State management
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [flashMode, setFlashMode] = useState('off');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [wateringMode, setWateringMode] = useState(mode === 'watering');
  
  // Animation refs
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const frameOpacity = useRef(new Animated.Value(0.5)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  
  // Request camera permission
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
        
        if (status === 'granted') {
          // Start scanner animations
          startScanAnimation();
        }
      } catch (error) {
        console.error('Error requesting camera permission:', error);
        setHasPermission(false);
      } finally {
        setIsLoading(false);
      }
    })();
    
    return () => {
      // Cleanup animations
      scanLineAnim.stopAnimation();
      frameOpacity.stopAnimation();
    };
  }, []);
  
  // Start scan animation
  const startScanAnimation = () => {
    // Breathing effect on the frame
    Animated.loop(
      Animated.sequence([
        Animated.timing(frameOpacity, {
          toValue: 0.8,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(frameOpacity, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Scanning line animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: SCAN_AREA_SIZE,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Success animation
  const playSuccessAnimation = () => {
    Animated.sequence([
      Animated.timing(successAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(successAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };
  
  // Handle barcode scan using expo-camera
  const handleBarcodeScanned = async ({ type, data }) => {
    if (scanned || isProcessing) return;
    
    console.log('🔍 Barcode scanned:', { type, data });
    
    // Vibrate to indicate successful scan
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    setScanned(true);
    setIsProcessing(true);
    
    try {
      // Parse barcode data
      let plantData = null;
      
      try {
        // Try to parse as JSON first (QR codes)
        plantData = JSON.parse(data);
        
        // Validate plant barcode format
        if (plantData.type !== 'plant' || !plantData.id) {
          throw new Error('Invalid plant barcode format');
        }
      } catch (parseError) {
        // Handle plain text barcodes (PLT-XXX format)
        if (data.startsWith('PLT-') || data.toLowerCase().includes('plant')) {
          plantData = {
            type: 'plant',
            id: data.replace('PLT-', ''),
            barcode: data,
            name: 'Scanned Plant'
          };
        } else {
          throw new Error('Not a valid plant barcode');
        }
      }
      
      console.log('🌱 Parsed plant data:', plantData);
      
      // Store scanned data
      setScannedData(plantData);
      
      // Play success animation
      playSuccessAnimation();
      
      // Handle different scan modes
      if (wateringMode) {
        await handleWateringScan(plantData);
      } else {
        // General scan mode - show result modal
        setShowResultModal(true);
      }
      
    } catch (error) {
      console.error('❌ Error processing barcode:', error);
      
      Alert.alert(
        'Invalid Barcode',
        error.message || 'The scanned code is not a valid plant barcode.',
        [
          {
            text: 'Scan Again',
            onPress: () => {
              setScanned(false);
              setIsProcessing(false);
              setScannedData(null);
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          }
        ]
      );
    }
  };

  // Handle watering mode scan
  const handleWateringScan = async (plantData) => {
    try {
      console.log('💧 Processing watering scan for plant:', plantData.id);
      
      // Get current location if available
      let coordinates = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          coordinates = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          };
        }
      } catch (locationError) {
        console.warn('Could not get location:', locationError);
      }
      
      // Mark plant as watered via API
      await markPlantAsWatered(plantData.id, 'barcode', coordinates);
      
      // Show success feedback
      Alert.alert(
        '✅ Success!',
        `${plantData.name || 'Plant'} has been marked as watered.`,
        [
          {
            text: 'Continue Scanning',
            onPress: () => {
              setScanned(false);
              setIsProcessing(false);
              setScannedData(null);
            },
          },
          {
            text: 'Finish',
            onPress: () => {
              // Trigger refresh of watering checklist
              navigation.navigate('WateringChecklistScreen', { 
                businessId, 
                refreshNeeded: true 
              });
            },
          }
        ]
      );
      
      // Update cached watering checklist
      try {
        const cachedChecklist = await getCachedWateringChecklist();
        if (cachedChecklist && cachedChecklist.checklist) {
          const updatedChecklist = cachedChecklist.checklist.map(item => 
            item.id === plantData.id 
              ? { ...item, needsWatering: false, lastWatered: new Date().toISOString() }
              : item
          );
          await setCachedWateringChecklist({
            ...cachedChecklist,
            checklist: updatedChecklist
          });
        }
      } catch (cacheError) {
        console.warn('Failed to update cache:', cacheError);
      }
      
    } catch (error) {
      console.error('❌ Error marking plant as watered:', error);
      
      Alert.alert(
        'Error',
        `Failed to mark plant as watered: ${error.message}`,
        [
          {
            text: 'Try Again',
            onPress: () => handleWateringScan(plantData),
          },
          {
            text: 'Skip',
            style: 'cancel',
            onPress: () => {
              setScanned(false);
              setIsProcessing(false);
              setScannedData(null);
            },
          }
        ]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle general scan result
  const handleGeneralScanResult = () => {
    if (onBarcodeScanned && scannedData) {
      onBarcodeScanned(JSON.stringify(scannedData));
      navigation.goBack();
    } else {
      // Navigate to plant details or inventory
      navigation.navigate('BusinessInventoryScreen', {
        businessId,
        searchQuery: scannedData?.name || scannedData?.barcode
      });
    }
  };
  
  // Toggle flash mode
  const toggleFlash = () => {
    setFlashMode(flashMode === 'off' ? 'on' : 'off');
  };

  // Toggle scanning mode
  const toggleMode = () => {
    setWateringMode(!wateringMode);
    setScanned(false);
    setIsProcessing(false);
    setScannedData(null);
  };
  
  // Handle permission states
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.permissionText}>Requesting camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.permissionContainer}>
          <MaterialIcons name="no-photography" size={64} color="#f44336" />
          <Text style={styles.warningText}>Camera permission is required to scan barcodes.</Text>
          <TouchableOpacity 
            style={styles.permissionButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.permissionButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent={true} />
      
      <CameraView
        style={styles.camera}
        facing="back"
        flash={flashMode}
        barcodeScannerSettings={{
          barcodeTypes: [
            'qr',
            'pdf417',
            'aztec',
            'ean13',
            'ean8',
            'code39',
            'code93',
            'code128',
            'code39mod43',
            'datamatrix',
            'interleaved2of5',
            'itf14',
            'upc_e',
            'upc_a',
          ],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      >
        <SafeAreaView style={styles.overlay}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {wateringMode ? 'Scan for Watering' : 'Scan Plant Barcode'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {wateringMode ? 'Mark plants as watered' : 'Identify plants'}
              </Text>
            </View>
            
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.modeButton}
                onPress={toggleMode}
              >
                <MaterialCommunityIcons 
                  name={wateringMode ? "water" : "barcode-scan"} 
                  size={20} 
                  color="#fff" 
                />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.flashButton}
                onPress={toggleFlash}
              >
                <MaterialIcons 
                  name={flashMode === 'off' ? "flash-off" : "flash-on"} 
                  size={24} 
                  color="#fff" 
                />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.scanArea}>
            {/* Scan window */}
            <Animated.View 
              style={[
                styles.scanFrame,
                { opacity: frameOpacity }
              ]}
            />
            
            {/* Scan corners */}
            <View style={[styles.cornerTL, styles.corner]} />
            <View style={[styles.cornerTR, styles.corner]} />
            <View style={[styles.cornerBL, styles.corner]} />
            <View style={[styles.cornerBR, styles.corner]} />
            
            {/* Moving scan line */}
            <Animated.View 
              style={[
                styles.scanLine,
                {
                  transform: [{ translateY: scanLineAnim }],
                }
              ]}
            />
            
            {/* Success indicator */}
            <Animated.View 
              style={[
                styles.successIndicator,
                {
                  opacity: successAnim,
                  transform: [{ scale: successAnim }],
                }
              ]}
            >
              <MaterialIcons name="check-circle" size={80} color="#4CAF50" />
            </Animated.View>
          </View>
          
          <View style={styles.footer}>
            <Text style={styles.instructionText}>
              {wateringMode 
                ? 'Scan plant QR codes to mark them as watered'
                : 'Position the plant QR code or barcode within the frame'
              }
            </Text>
            
            {isProcessing && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="small" color="#4CAF50" />
                <Text style={styles.processingText}>
                  {wateringMode ? 'Marking as watered...' : 'Processing scan...'}
                </Text>
              </View>
            )}
            
            {scanned && !isProcessing && (
              <TouchableOpacity 
                style={styles.scanAgainButton}
                onPress={() => {
                  setScanned(false);
                  setScannedData(null);
                }}
              >
                <MaterialCommunityIcons name="barcode-scan" size={20} color="#fff" />
                <Text style={styles.scanAgainButtonText}>Scan Again</Text>
              </TouchableOpacity>
            )}
            
            <View style={styles.instructionDetails}>
              <Text style={styles.instructionDetail}>
                • Point camera at plant barcode
              </Text>
              <Text style={styles.instructionDetail}>
                • Keep steady and well-lit
              </Text>
              <Text style={styles.instructionDetail}>
                • QR codes and barcodes supported
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </CameraView>

      {/* Result Modal */}
      <Modal
        visible={showResultModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowResultModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Plant Scanned</Text>
              <TouchableOpacity onPress={() => setShowResultModal(false)}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {scannedData && (
              <ScrollView style={styles.modalContent}>
                <View style={styles.plantInfo}>
                  <View style={styles.plantIcon}>
                    <MaterialCommunityIcons name="leaf" size={32} color="#4CAF50" />
                  </View>
                  
                  <View style={styles.plantDetails}>
                    <Text style={styles.plantName}>
                      {scannedData.name || 'Unknown Plant'}
                    </Text>
                    
                    {scannedData.scientific_name && (
                      <Text style={styles.plantScientific}>
                        {scannedData.scientific_name}
                      </Text>
                    )}
                    
                    <Text style={styles.plantId}>
                      ID: {scannedData.id}
                    </Text>
                    
                    {scannedData.barcode && (
                      <Text style={styles.plantBarcode}>
                        Barcode: {scannedData.barcode}
                      </Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.actionButtons}>
                  <TouchableOpacity 
                    style={styles.primaryButton}
                    onPress={handleGeneralScanResult}
                  >
                    <MaterialIcons name="open-in-new" size={20} color="#fff" />
                    <Text style={styles.primaryButtonText}>View Details</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.secondaryButton}
                    onPress={() => {
                      setShowResultModal(false);
                      setScanned(false);
                      setScannedData(null);
                    }}
                  >
                    <MaterialCommunityIcons name="barcode-scan" size={20} color="#4CAF50" />
                    <Text style={styles.secondaryButtonText}>Scan Another</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 40,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
  },
  flashButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  scanFrame: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#4CAF50',
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: 'absolute',
    height: 2,
    width: '100%',
    backgroundColor: '#4CAF50',
    top: 0,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  successIndicator: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  processingText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  instructionDetails: {
    marginTop: 16,
    alignItems: 'flex-start',
  },
  instructionDetail: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 4,
  },
  scanAgainButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  scanAgainButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  warningText: {
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalContent: {
    padding: 20,
  },
  plantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  plantIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f9f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  plantDetails: {
    flex: 1,
  },
  plantName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  plantScientific: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginBottom: 4,
  },
  plantId: {
    fontSize: 14,
    color: '#4CAF50',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 2,
  },
  plantBarcode: {
    fontSize: 12,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  actionButtons: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9f3',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  secondaryButtonText: {
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 8,
  },
});