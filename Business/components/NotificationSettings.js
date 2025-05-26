// Business/components/NotificationSettings.js
import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { registerForWateringNotifications } from '../services/businessWateringApi';

// Import DateTimePicker dynamically to handle case when library is not installed
let DateTimePicker = null;
try {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
} catch (error) {
  console.warn('@react-native-community/datetimepicker is not installed. Time picker will not be available.');
}

/**
 * NotificationSettings Component
 * 
 * Handles notification preferences for watering reminders
 * 
 * @param {Object} props Component props
 * @param {boolean} props.visible Controls modal visibility
 * @param {Function} props.onClose Callback when modal is closed
 */
const NotificationSettings = ({ visible, onClose }) => {
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [notificationTime, setNotificationTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [deviceToken, setDeviceToken] = useState(null);
  const [libraryAvailable, setLibraryAvailable] = useState(!!DateTimePicker);
  
  // Initialize when modal opens
  useEffect(() => {
    if (visible) {
      checkPermissions();
      loadSettings();
    }
  }, [visible]);
  
  // Check notification permissions
  const checkPermissions = useCallback(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      const hasPermission = status === 'granted';
      setHasPermission(hasPermission);
      
      if (!hasPermission) {
        Alert.alert(
          'Notification Permission',
          'You need to enable notifications to receive watering reminders.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Enable', 
              onPress: requestPermissions 
            }
          ]
        );
      }
      
      // Get device token for push notifications
      if (hasPermission) {
        const token = await getDeviceToken();
        setDeviceToken(token);
      }
    } catch (error) {
      console.error('Error checking notification permissions:', error);
    }
  }, []);
  
  // Request notification permissions
  const requestPermissions = useCallback(async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      const newPermission = status === 'granted';
      setHasPermission(newPermission);
      
      if (newPermission) {
        const token = await getDeviceToken();
        setDeviceToken(token);
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
    }
  }, []);
  
  // Get device token
  const getDeviceToken = useCallback(async () => {
    try {
      // Check if we have a stored token
      const storedToken = await AsyncStorage.getItem('devicePushToken');
      if (storedToken) return storedToken;
      
      // Get a new token
      try {
        const { data: token } = await Notifications.getExpoPushTokenAsync({
          projectId: 'your-expo-project-id', // Replace with your actual project ID
        });
        
        // Store the token
        await AsyncStorage.setItem('devicePushToken', token);
        return token;
      } catch (tokenError) {
        console.error('Error getting push token:', tokenError);
        // Fallback to a device identifier if push token fails
        const deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        await AsyncStorage.setItem('devicePushToken', deviceId);
        return deviceId;
      }
    } catch (error) {
      console.error('Error in getDeviceToken:', error);
      return null;
    }
  }, []);
  
  // Load saved settings
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get saved notification settings
      const savedTime = await AsyncStorage.getItem('wateringNotificationTime');
      const savedEnabled = await AsyncStorage.getItem('wateringNotificationsEnabled');
      
      // Set state from saved values
      if (savedTime) {
        const [hours, minutes] = savedTime.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        setNotificationTime(date);
      } else {
        // Default to 7:00 AM
        const defaultTime = new Date();
        defaultTime.setHours(7, 0, 0, 0);
        setNotificationTime(defaultTime);
      }
      
      setEnableNotifications(savedEnabled === 'true');
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Save settings
  const saveSettings = useCallback(async () => {
    if (!hasPermission && enableNotifications) {
      Alert.alert(
        'Permission Required',
        'You need to enable notifications to receive watering reminders.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable', onPress: requestPermissions }
        ]
      );
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Format time as HH:MM
      const hours = notificationTime.getHours().toString().padStart(2, '0');
      const minutes = notificationTime.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;
      
      // Save settings to AsyncStorage
      await AsyncStorage.setItem('wateringNotificationTime', timeString);
      await AsyncStorage.setItem('wateringNotificationsEnabled', enableNotifications.toString());
      
      // Register with backend if enabled
      if (enableNotifications && deviceToken) {
        await registerForWateringNotifications(deviceToken, timeString)
          .catch(error => {
            console.error('Error registering with backend:', error);
            // Continue with local notifications even if backend registration fails
          });
        
        // Schedule local notification as backup
        await scheduleLocalNotification(notificationTime)
          .catch(error => {
            console.error('Error scheduling local notification:', error);
            Alert.alert(
              'Notification Warning',
              'Could not schedule local notifications. You may still receive server notifications.'
            );
          });
      } else if (!enableNotifications) {
        // Cancel local notifications
        await Notifications.cancelAllScheduledNotificationsAsync()
          .catch(error => console.error('Error canceling notifications:', error));
      }
      
      Alert.alert(
        'Settings Saved',
        enableNotifications
          ? `You will receive watering reminders at ${formatTime(notificationTime)}`
          : 'Watering reminders have been disabled'
      );
      
      onClose();
    } catch (error) {
      console.error('Error saving notification settings:', error);
      Alert.alert('Error', 'Failed to save notification settings');
    } finally {
      setIsSaving(false);
    }
  }, [hasPermission, enableNotifications, notificationTime, deviceToken, onClose, requestPermissions]);
  
  // Schedule local notification
  const scheduleLocalNotification = useCallback(async (time) => {
    try {
      // Cancel existing notifications
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      if (!enableNotifications) return;
      
      // Set up notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      
      // Schedule daily notification
      const trigger = {
        hour: time.getHours(),
        minute: time.getMinutes(),
        repeats: true,
      };
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Plant Watering Reminder',
          body: 'Some of your plants need watering today!',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          color: '#4CAF50',
        },
        trigger,
      });
      
      console.log('Local notification scheduled successfully');
    } catch (error) {
      console.error('Error scheduling notification:', error);
      throw error;
    }
  }, [enableNotifications]);
  
  // Handle time picker change
  const handleTimeChange = useCallback((event, selectedTime) => {
    setShowTimePicker(Platform.OS === 'ios');
    
    if (selectedTime) {
      setNotificationTime(selectedTime);
    }
  }, []);
  
  // Send test notification
  const sendTestNotification = useCallback(async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Plant Watering Reminder',
          body: 'This is a test notification for your watering reminders.',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          color: '#4CAF50',
        },
        trigger: null, // Send immediately
      });
      
      Alert.alert('Test Sent', 'A test notification has been sent');
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  }, []);
  
  // Format time for display
  const formatTime = useCallback((date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);
  
  // Render missing library warning
  const renderMissingLibraryWarning = () => (
    <View style={styles.warningContainer}>
      <MaterialIcons name="warning" size={48} color="#FF9800" />
      <Text style={styles.warningTitle}>Missing Library</Text>
      <Text style={styles.warningText}>
        The DateTimePicker library is required for time selection. Please install it with:
      </Text>
      <View style={styles.codeBlock}>
        <Text style={styles.code}>
          expo install @react-native-community/datetimepicker
        </Text>
      </View>
    </View>
  );
  
  if (!visible) return null;
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="close" size={24} color="#333" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Notification Settings</Text>
          
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={saveSettings}
            disabled={isSaving}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#4CAF50" />
            ) : (
              <MaterialIcons name="check" size={24} color="#4CAF50" />
            )}
          </TouchableOpacity>
        </View>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Loading settings...</Text>
          </View>
        ) : !libraryAvailable ? (
          renderMissingLibraryWarning()
        ) : (
          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <MaterialIcons name="notifications" size={20} color="#4CAF50" />
                {' '}Watering Reminders
              </Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Enable Notifications</Text>
                  <Text style={styles.settingDescription}>
                    Get daily reminders when plants need watering
                  </Text>
                </View>
                
                <Switch
                  value={enableNotifications}
                  onValueChange={setEnableNotifications}
                  trackColor={{ false: '#ccc', true: '#a5d6a7' }}
                  thumbColor={enableNotifications ? '#4CAF50' : '#f0f0f0'}
                  ios_backgroundColor="#ccc"
                />
              </View>
              
              <View style={[styles.settingRow, !enableNotifications && styles.disabledSetting]}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Notification Time</Text>
                  <Text style={styles.settingDescription}>
                    Choose when to receive daily reminders
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setShowTimePicker(true)}
                  disabled={!enableNotifications}
                >
                  <Text style={styles.timeButtonText}>
                    {formatTime(notificationTime)}
                  </Text>
                  <MaterialIcons name="access-time" size={18} color="#4CAF50" />
                </TouchableOpacity>
              </View>
              
              {showTimePicker && (
                <View style={styles.timePickerContainer}>
                  <DateTimePicker
                    value={notificationTime}
                    mode="time"
                    is24Hour={false}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleTimeChange}
                    themeVariant="light"
                  />
                  
                  {Platform.OS === 'ios' && (
                    <View style={styles.iosButtons}>
                      <TouchableOpacity
                        style={styles.iosButton}
                        onPress={() => setShowTimePicker(false)}
                      >
                        <Text style={styles.iosButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[styles.iosButton, styles.iosDoneButton]}
                        onPress={() => setShowTimePicker(false)}
                      >
                        <Text style={styles.iosDoneButtonText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
            
            <View style={styles.testSection}>
              <Text style={styles.testTitle}>Test Notifications</Text>
              <Text style={styles.testDescription}>
                Send a test notification to make sure everything is set up correctly.
              </Text>
              
              <TouchableOpacity
                style={[
                  styles.testButton,
                  (!enableNotifications || !hasPermission) && styles.disabledButton
                ]}
                onPress={sendTestNotification}
                disabled={!enableNotifications || !hasPermission}
              >
                <MaterialIcons name="send" size={18} color="#fff" />
                <Text style={styles.testButtonText}>Send Test Notification</Text>
              </TouchableOpacity>
            </View>
            
            {!hasPermission && (
              <View style={styles.permissionWarning}>
                <MaterialIcons name="warning" size={24} color="#FF9800" />
                <Text style={styles.permissionWarningText}>
                  Notification permission is required to receive watering reminders.
                </Text>
                
                <TouchableOpacity
                  style={styles.permissionButton}
                  onPress={requestPermissions}
                >
                  <Text style={styles.permissionButtonText}>
                    Enable Notifications
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>About Notifications</Text>
              <Text style={styles.infoText}>
                Watering reminders will notify you when plants need to be watered based on their schedule. 
                The app checks the weather daily and adjusts watering schedules if it rains.
              </Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    padding: 8,
    borderRadius: 20,
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
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    marginBottom: 8,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  disabledSetting: {
    opacity: 0.5,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f3',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginRight: 8,
  },
  timePickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 16,
    paddingTop: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  iosButtons: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  iosButton: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  iosButtonText: {
    fontSize: 16,
    color: '#666',
  },
  iosDoneButton: {
    backgroundColor: '#f0f9f3',
  },
  iosDoneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  testSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  testTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  testDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    marginBottom: 16,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#bdbdbd',
  },
  testButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  permissionWarning: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    alignItems: 'center',
  },
  permissionWarningText: {
    fontSize: 14,
    color: '#F57C00',
    textAlign: 'center',
    marginVertical: 8,
  },
  permissionButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 32,
    padding: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1B5E20',
    lineHeight: 20,
  },
  warningContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  codeBlock: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    alignSelf: 'stretch',
    marginTop: 8,
  },
  code: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
  },
});

export default memo(NotificationSettings);