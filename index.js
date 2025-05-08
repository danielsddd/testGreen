/**
 * Marketplace Module Main Index
 * 
 * This file exports all marketplace components, screens, and services.
 * It serves as the entry point to the marketplace feature of the Greener app.
 */

// Navigation
export { default as MarketplaceNavigation } from './marketplaceNavigation';

// Screens
export { default as MarketplaceScreen } from './screens/MarketplaceScreen';
export { default as PlantDetailScreen } from './screens/PlantDetailScreen';
export { default as AddPlantScreen } from './screens/AddPlantScreen';
export { default as ProfileScreen } from './screens/ProfileScreen';
export { default as EditProfileScreen } from './screens/EditProfileScreen';
export { default as MessagesScreen } from './screens/MessagesScreen';

// Components
export { default as PlantCard } from './components/PlantCard';
export { default as SearchBar } from './components/SearchBar';
export { default as CategoryFilter } from './components/CategoryFilter';
export { default as PriceRange } from './components/PriceRange';

// Services
export * from './services/marketplaceApi';

/**
 * Integration Guide for Greener App
 * 
 * To integrate the Marketplace feature into the main Greener app:
 * 
 * 1. Import the MarketplaceNavigation into the main app navigation.
 * 2. Add the Marketplace button to the Home screen that navigates to the MarketplaceScreen.
 * 3. Ensure that the global authentication context is accessible to the Marketplace components.
 * 4. Configure the marketplaceApi.js to work with your Azure Functions backend.
 * 
 * Example:
 * 
 * // In your main navigation file
 * import { MarketplaceNavigation } from './marketplace';
 * 
 * // Then add it to your navigation structure
 * <Tab.Screen name="Marketplace" component={MarketplaceNavigation} />
 * 
 * // On your home screen
 * <TouchableOpacity onPress={() => navigation.navigate('Marketplace')}>
 *   <Text>Go to Marketplace</Text>
 * </TouchableOpacity>
 */