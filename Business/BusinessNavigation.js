// Business/BusinessNavigation.js
import React, { memo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform } from 'react-native';

// Import Business Screens
import BusinessWelcomeScreen from './BusinessScreens/BusinessWelcomeScreen';
import BusinessSignUpScreen from './BusinessScreens/BusinessSignUpScreen';
import BusinessSignInScreen from './BusinessScreens/BusinessSignInScreen';
import BusinessInventoryScreen from './BusinessScreens/BusinessInventoryScreen';
import BusinessHomeScreen from './BusinessScreens/BusinessHomeScreen';
import BusinessProfileScreen from './BusinessScreens/BusinessProfileScreen';
import BusinessOrdersScreen from './BusinessScreens/BusinessOrdersScreen';
import AddInventoryScreen from './BusinessScreens/AddInventoryScreen';
import BusinessAnalyticsScreen from './BusinessScreens/BusinessAnalyticsScreen';
import CustomerListScreen from './BusinessScreens/CustomerListScreen';
import WateringChecklistScreen from './BusinessScreens/WateringChecklistScreen';
import BarcodeScannerScreen from './BusinessScreens/BarcodeScannerScreen';
import GPSWateringNavigator from './BusinessScreens/GPSWateringNavigator';
import NotificationCenterScreen from './BusinessScreens/NotificationCenterScreen';
import NotificationSettingsScreen from './BusinessScreens/NotificationSettingsScreen';

// Import Components (if they have their own screens)
import NotificationSettings from './components/NotificationSettings';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * Business Tabs Navigator
 * 
 * Bottom tab navigation for the main business app screens
 */
const BusinessTabs = memo(() => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          let IconComponent = MaterialIcons;

          switch (route.name) {
            case 'BusinessDashboard':
              iconName = 'dashboard';
              break;
            case 'BusinessInventory':
              iconName = 'inventory';
              break;
            case 'BusinessOrders':
              iconName = 'receipt';
              break;
            case 'BusinessProfile':
              iconName = 'person';
              break;
            case 'WateringChecklist':
              iconName = 'water-outline';
              IconComponent = MaterialCommunityIcons;
              break;
            default:
              iconName = 'help-outline';
          }

          return <IconComponent name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#216a94',
        tabBarInactiveTintColor: '#757575',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#eee',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tab.Screen 
        name="BusinessDashboard" 
        component={BusinessHomeScreen}
        options={{ 
          title: 'Dashboard',
          tabBarAccessibilityLabel: "Business Dashboard"
        }}
      />
      <Tab.Screen 
        name="BusinessInventory" 
        component={BusinessInventoryScreen}
        options={{ 
          title: 'Inventory',
          tabBarAccessibilityLabel: "Business Inventory"
        }}
      />
      <Tab.Screen 
        name="WateringChecklist" 
        component={WateringChecklistScreen}
        options={{ 
          title: 'Watering',
          tabBarAccessibilityLabel: "Plant Watering Checklist"
        }}
      />
      <Tab.Screen 
        name="BusinessOrders" 
        component={BusinessOrdersScreen}
        options={{ 
          title: 'Orders',
          tabBarAccessibilityLabel: "Business Orders"
        }}
      />
      <Tab.Screen 
        name="BusinessProfile" 
        component={BusinessProfileScreen}
        options={{ 
          title: 'Profile',
          tabBarAccessibilityLabel: "Business Profile"
        }}
      />
    </Tab.Navigator>
  );
});

/**
 * Main Business Stack Navigator
 * 
 * Root navigation for the business section of the app
 */
const BusinessNavigation = () => {
  return (
    <Stack.Navigator
      initialRouteName="BusinessWelcomeScreen"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
        contentStyle: { backgroundColor: '#fff' },
        // Default screen transitions
        animationTypeForReplace: 'push',
        ...(Platform.OS === 'android' && {
          animation: 'slide_from_right',
          statusBarTranslucent: true,
        }),
      }}
    >
      {/* Auth Flow */}
      <Stack.Screen 
        name="BusinessWelcomeScreen" 
        component={BusinessWelcomeScreen} 
        options={{ title: 'Welcome' }}
      />
      <Stack.Screen 
        name="BusinessSignUpScreen" 
        component={BusinessSignUpScreen}
        options={{ title: 'Sign Up' }}
      />
      <Stack.Screen 
        name="BusinessSignInScreen" 
        component={BusinessSignInScreen}
        options={{ title: 'Sign In' }}
      />
      
      {/* Setup Flow */}
      <Stack.Screen 
        name="BusinessInventorySetupScreen" 
        component={BusinessInventoryScreen}
        options={{ title: 'Setup Inventory' }}
        initialParams={{ setupMode: true }}
      />
      
      {/* Main App Flow - Tab Navigator */}
      <Stack.Screen 
        name="BusinessTabs" 
        component={BusinessTabs}
        options={{ title: 'Business App' }}
      />
      
      {/* Individual Screens */}
      <Stack.Screen 
        name="BusinessProfileScreen" 
        component={BusinessProfileScreen}
        options={{ title: 'Business Profile' }}
      />
      <Stack.Screen 
        name="BusinessOrdersScreen" 
        component={BusinessOrdersScreen}
        options={{ title: 'Orders' }}
      />
      <Stack.Screen 
        name="BusinessAnalyticsScreen" 
        component={BusinessAnalyticsScreen} 
        options={{ title: 'Analytics' }} 
      />
      <Stack.Screen 
        name="CustomerListScreen" 
        component={CustomerListScreen}
        options={{ title: 'Customers' }}
      />
      
      {/* Inventory Management Screens */}
      <Stack.Screen 
        name="AddInventoryScreen" 
        component={AddInventoryScreen}
        options={{ title: 'Add Product' }}
      />
      <Stack.Screen 
        name="InventoryScreen" 
        component={BusinessInventoryScreen}
        options={{ title: 'Inventory' }}
      />
      <Stack.Screen 
        name="EditProductScreen" 
        component={AddInventoryScreen}
        options={{ title: 'Edit Product' }}
        initialParams={{ editMode: true }}
      />
      
      {/* Watering & Plant Care Screens */}
      <Stack.Screen 
        name="WateringChecklistScreen" 
        component={WateringChecklistScreen}
        options={{ title: 'Watering Checklist' }}
      />
      <Stack.Screen 
        name="BarcodeScannerScreen" 
        component={BarcodeScannerScreen}
        options={{ 
          title: 'Scan Barcode',
          // Present as modal on iOS
          ...(Platform.OS === 'ios' && {
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }),
        }}
      />
      <Stack.Screen 
        name="GPSWateringNavigator" 
        component={GPSWateringNavigator}
        options={{ title: 'GPS Navigation' }}
      />
      
      {/* Notification Screens */}
      <Stack.Screen 
        name="NotificationCenterScreen" 
        component={NotificationCenterScreen}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen 
        name="NotificationSettingsScreen" 
        component={NotificationSettingsScreen}
        options={{ title: 'Notification Settings' }}
      />
      <Stack.Screen 
        name="NotificationSettings" 
        component={NotificationSettings} 
        options={{ 
          title: 'Notification Settings',
          // Present as modal on iOS
          ...(Platform.OS === 'ios' && {
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }),
        }}
      />
      
      {/* Additional Screens */}
      <Stack.Screen 
        name="BusinessSettingsScreen" 
        component={BusinessProfileScreen}
        options={{ title: 'Settings' }}
        initialParams={{ settingsMode: true }}
      />
      <Stack.Screen 
        name="CreateOrderScreen" 
        component={BusinessOrdersScreen}
        options={{ title: 'Create Order' }}
        initialParams={{ createMode: true }}
      />
      <Stack.Screen 
        name="BusinessProductDetailScreen" 
        component={AddInventoryScreen}
        options={{ title: 'Product Details' }}
        initialParams={{ detailMode: true }}
      />
    </Stack.Navigator>
  );
};

export default BusinessNavigation;