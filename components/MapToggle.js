import React from 'react';
import { View, StyleSheet } from 'react-native';
import ToggleButton from './MapToggle-parts/ToggleButton';

const MapToggle = ({ viewMode, onViewModeChange, style }) => {
  // Function to handle view mode change
  const handleViewChange = (mode) => {
    if (viewMode !== mode) {
      onViewModeChange(mode);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* List view toggles */}
      <View style={styles.viewToggles}>
        <ToggleButton
          isActive={viewMode === 'grid'}
          onPress={() => handleViewChange('grid')}
          icon="grid-view"
          label="Grid"
          accessibilityLabel="Grid View"
        />

        <ToggleButton
          isActive={viewMode === 'list'}
          onPress={() => handleViewChange('list')}
          icon="view-list"
          label="List"
          accessibilityLabel="List View"
        />
      </View>

      {/* Map toggle */}
      <ToggleButton
        isActive={viewMode === 'map'}
        onPress={() => handleViewChange('map')}
        icon="map"
        label="Map"
        accessibilityLabel="Map View"
        style={styles.mapButton}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  viewToggles: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  mapButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
});

export default MapToggle;