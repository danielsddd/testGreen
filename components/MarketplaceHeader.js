import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

/**
 * Improved header component for all Marketplace screens
 * Matches the design shown in screenshots with correct styling
 */
const MarketplaceHeader = ({
  title = 'PlantMarket',
  showBackButton = true,
  showNotifications = true,
  onNotificationsPress,
}) => {
  const navigation = useNavigation();

  return (
    <View style={styles.background}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#4CAF50"
        translucent={true}
      />
      <View style={styles.headerContent}>
        {showBackButton && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}

        <Text style={styles.title}>{title}</Text>

        {showNotifications && (
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={onNotificationsPress || (() => navigation.navigate('Messages'))}
          >
            <MaterialIcons name="notifications" size={24} color="#fff" />
            {/* Notification badge - can be conditionally shown */}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>2</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  background: {
    height: 80, // Reduced height to match the screenshot
    width: '100%',
    backgroundColor: '#4CAF50', // Matched color from screenshot
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 25,
  },
  backButton: {
    padding: 8,
    // Ensure the back button is visible
    opacity: 1,
  },
  title: {
    fontSize: 22, // Adjusted size to match screenshot
    fontWeight: 'bold',
    color: '#fff',
    // Removed text shadow to match flatter design in screenshot
  },
  notificationButton: {
    padding: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    right: 3,
    top: 3,
    backgroundColor: '#ff4757',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});

export default MarketplaceHeader;