// MarketplaceNavigation.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Fix import paths - use absolute or correct relative paths
// If your screens are in a 'screens' folder at the same level as this file:
import MarketplaceScreen from './screens/MarketplaceScreen';
import PlantDetailScreen from './screens/PlantDetailScreen';
import AddPlantScreen from './screens/AddPlantScreen';
import ProfileScreen from './screens/ProfileScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import MessagesScreen from './screens/MessagesScreen';
import SellerProfileScreen from './screens/SellerProfileScreen';

const Stack = createNativeStackNavigator();

const MarketplaceNavigation = () => {
  return (
    <Stack.Navigator
      initialRouteName="Marketplace"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#fff' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen 
        name="Marketplace" 
        component={MarketplaceScreen}
      />
      
      <Stack.Screen 
        name="PlantDetail" 
        component={PlantDetailScreen}
      />
      
      <Stack.Screen 
        name="AddPlant" 
        component={AddPlantScreen}
      />
      
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen}
      />
      
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen}
      />
      
      <Stack.Screen 
        name="Messages" 
        component={MessagesScreen}
      />
      
      <Stack.Screen 
        name="SellerProfile" 
        component={SellerProfileScreen}
      />
    </Stack.Navigator>
  );
};

export default MarketplaceNavigation;