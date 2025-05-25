// Business/BusinessScreens/NotificationSettingsScreen.js - FIXED TIME PICKER
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Modal,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getNotificationSettings, updateNotificationSettings } from '../services/notificationPollingApi';

export default function NotificationSettingsScreen({ navigation, route }) {
  const { businessId: routeBusinessId } = route.params || {};
  
  const [businessId, setBusinessId] = useState(routeBusinessId);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState({
    notificationTime: '07:00',
    enableWateringReminders: true,
    enableLowStockAlerts: true,
    enableSuccessNotifications: true,
    pollingInterval: 60,
    status: 'active'
  });
  
  // Time picker state
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date());
  
  // Initialize
  useEffect(() => {
    const initialize = async () => {
      try {
        let id = businessId;
        if (!id) {
          id = await AsyncStorage.getItem('businessId');
          setBusinessId(id);
        }
        
        if (id) {
          await loadSettings(id);
        }
      } catch (error) {
        console.error('Error initializing notification settings:', error);
        Alert.alert('Error', 'Failed to load notification settings');
      } finally {
        setIsLoading(false);
      }
    };
    
    initialize();
  }, [businessId]);
  
  // Load settings
  const loadSettings = async (id) => {
    try {
      const data = await getNotificationSettings(id);
      if (data.settings) {
        const loadedSettings = {
          ...settings,
          ...data.settings
        };
        setSettings(loadedSettings);
        
        // Parse time and set selectedTime
        const timeString = loadedSettings.notificationTime || '07:00';
        const [hours, minutes] = timeString.split(':').map(Number);
        const timeDate = new Date();
        timeDate.setHours(hours, minutes, 0, 0);
        setSelectedTime(timeDate);
        setTempTime(timeDate);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // Use default settings on error
    }
  };
  
  // Save settings
  const saveSettings = async () => {
    setIsSaving(true);
    
    try {
      const result = await updateNotificationSettings({
        ...settings,
        businessId
      });
      
      if (result.success) {
        Alert.alert('✅ Success', 'Notification settings saved successfully!');
        
        // Auto-refresh any parent screens
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('❌ Error', 'Failed to save notification settings');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle time change
  const handleTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    
    if (selectedTime) {
      setTempTime(selectedTime);
      
      if (Platform.OS === 'android') {
        // Apply immediately on Android
        confirmTimeChange(selectedTime);
      }
    }
  };
  
  // Confirm time change (for iOS)
  const confirmTimeChange = (time = tempTime) => {
    const timeString = formatTimeToString(time);
    setSelectedTime(time);
    setSettings(prev => ({
      ...prev,
      notificationTime: timeString
    }));
    setShowTimePicker(false);
  };
  
  // Cancel time change (for iOS)
  const cancelTimeChange = () => {
    setTempTime(selectedTime);
    setShowTimePicker(false);
  };
  
  // Format time to HH:MM string
  const formatTimeToString = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };
  
  // Format time for display
  const formatTime = (timeString) => {
    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      const time = new Date();
      time.setHours(hours, minutes, 0, 0);
      
      return time.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (error) {
      return timeString;
    }
  };
  
  // Handle setting change
  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // Test notifications
  const testNotifications = async () => {
    try {
      Alert.alert(
        '🔔 Test Notification',
        `This is how notifications will appear at ${formatTime(settings.notificationTime)} daily.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error testing notifications:', error);
    }
  };
  
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading notification settings...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Notification Settings</Text>
        
        <TouchableOpacity 
          style={styles.testButton}
          onPress={testNotifications}
        >
          <MaterialIcons name="notifications-active" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Notification Time Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <MaterialIcons name="schedule" size={20} color="#4CAF50" />
            {' '}Daily Reminder Time
          </Text>
          
          <TouchableOpacity 
            style={styles.timeSelector}
            onPress={() => setShowTimePicker(true)}
          >
            <View style={styles.timeSelectorContent}>
              <Text style={styles.timeSelectorLabel}>Notification Time</Text>
              <Text style={styles.timeSelectorValue}>
                {formatTime(settings.notificationTime)}
              </Text>
            </View>
            <MaterialIcons name="access-time" size={24} color="#4CAF50" />
          </TouchableOpacity>
          
          <Text style={styles.sectionDescription}>
            Choose when you want to receive daily watering reminders
          </Text>
        </View>
        
        {/* Notification Types Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <MaterialCommunityIcons name="bell-ring" size={20} color="#4CAF50" />
            {' '}Notification Types
          </Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <View style={styles.settingIcon}>
                <MaterialCommunityIcons name="water" size={24} color="#2196F3" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Watering Reminders</Text>
                <Text style={styles.settingDescription}>
                  Get notified when plants need watering
                </Text>
              </View>
            </View>
            <Switch
              value={settings.enableWateringReminders}
              onValueChange={(value) => handleSettingChange('enableWateringReminders', value)}
              trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
              thumbColor={settings.enableWateringReminders ? '#fff' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <View style={styles.settingIcon}>
                <MaterialIcons name="inventory" size={24} color="#FF9800" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Low Stock Alerts</Text>
                <Text style={styles.settingDescription}>
                  Get notified when inventory is running low
                </Text>
              </View>
            </View>
            <Switch
              value={settings.enableLowStockAlerts}
              onValueChange={(value) => handleSettingChange('enableLowStockAlerts', value)}
              trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
              thumbColor={settings.enableLowStockAlerts ? '#fff' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <View style={styles.settingIcon}>
                <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Success Notifications</Text>
                <Text style={styles.settingDescription}>
                  Get encouraging messages for completed tasks
                </Text>
              </View>
            </View>
            <Switch
              value={settings.enableSuccessNotifications}
              onValueChange={(value) => handleSettingChange('enableSuccessNotifications', value)}
              trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
              thumbColor={settings.enableSuccessNotifications ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>
        
        {/* Polling Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <MaterialIcons name="sync" size={20} color="#4CAF50" />
            {' '}Update Frequency
          </Text>
          
          <View style={styles.pollingOptions}>
            {[30, 60, 120, 300].map((interval) => (
              <TouchableOpacity
                key={interval}
                style={[
                  styles.pollingOption,
                  settings.pollingInterval === interval && styles.selectedPollingOption
                ]}
                onPress={() => handleSettingChange('pollingInterval', interval)}
              >
                <Text style={[
                  styles.pollingOptionText,
                  settings.pollingInterval === interval && styles.selectedPollingOptionText
                ]}>
                  {interval < 60 ? `${interval}s` : `${interval / 60}m`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <Text style={styles.sectionDescription}>
            How often to check for new notifications (shorter intervals use more battery)
          </Text>
        </View>
        
        {/* Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <MaterialIcons name="power-settings-new" size={20} color="#4CAF50" />
            {' '}Notification Status
          </Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <View style={[
                styles.settingIcon,
                { backgroundColor: settings.status === 'active' ? '#e8f5e8' : '#ffebee' }
              ]}>
                <MaterialIcons 
                  name={settings.status === 'active' ? 'notifications-active' : 'notifications-off'} 
                  size={24} 
                  color={settings.status === 'active' ? '#4CAF50' : '#f44336'} 
                />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Enable Notifications</Text>
                <Text style={styles.settingDescription}>
                  {settings.status === 'active' ? 'Notifications are enabled' : 'Notifications are disabled'}
                </Text>
              </View>
            </View>
            <Switch
              value={settings.status === 'active'}
              onValueChange={(value) => handleSettingChange('status', value ? 'active' : 'inactive')}
              trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
              thumbColor={settings.status === 'active' ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>
        
        {/* Info Section */}
        <View style={styles.infoSection}>
          <MaterialIcons name="info" size={20} color="#2196F3" />
          <Text style={styles.infoText}>
            Notifications are checked periodically while the app is open. 
            For best results, keep the app running in the background.
          </Text>
        </View>
      </ScrollView>
      
      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.saveButton, isSaving && styles.savingButton]}
          onPress={saveSettings}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialIcons name="save" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Time Picker Modal */}
      {showTimePicker && (
        <Modal
          transparent={true}
          animationType="slide"
          visible={showTimePicker}
          onRequestClose={cancelTimeChange}
        >
          <View style={styles.timePickerModal}>
            <View style={styles.timePickerContainer}>
              <View style={styles.timePickerHeader}>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={cancelTimeChange}
                >
                  <Text style={styles.timePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <Text style={styles.timePickerTitle}>Set Notification Time</Text>
                
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => confirmTimeChange()}
                >
                  <Text style={styles.timePickerConfirmText}>Done</Text>
                </TouchableOpacity>
              </View>
              
              <DateTimePicker
                value={tempTime}
                mode="time"
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleTimeChange}
                style={styles.dateTimePicker}
              />
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  testButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9f3',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    lineHeight: 18,
  },
  timeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  timeSelectorContent: {
    flex: 1,
  },
  timeSelectorLabel: {
    fontSize: 14,
    color: '#666',
  },
  timeSelectorValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
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
  pollingOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  pollingOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  selectedPollingOption: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  pollingOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  selectedPollingOptionText: {
    color: '#fff',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#1976d2',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 8,
  },
  savingButton: {
    backgroundColor: '#bdbdbd',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  timePickerModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  timePickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  timePickerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  timePickerCancelText: {
    fontSize: 16,
    color: '#666',
  },
  timePickerConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  dateTimePicker: {
    height: 200,
    marginTop: 20,
  },
});