// screens/ProfileScreen-parts/StatsRow.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const StatsRow = ({ stats = {} }) => {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statBox}>
        <Text style={styles.statValue}>{stats.plantsCount || 0}</Text>
        <Text style={styles.statLabel}>Listings</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={styles.statValue}>{stats.salesCount || 0}</Text>
        <Text style={styles.statLabel}>Sold</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={styles.statValue}>
          {typeof stats.rating === 'number' ? stats.rating.toFixed(1) : '0.0'}
        </Text>
        <Text style={styles.statLabel}>Rating ({stats.reviewsCount || 0})</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    marginHorizontal: 16, 
    marginTop: 8, 
    marginBottom: 12, 
    backgroundColor: '#fff', 
    paddingVertical: 12, 
    borderRadius: 12, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowOffset: { width: 0, height: 1 }, 
    shadowRadius: 3, 
    elevation: 2,
  },
  statBox: { 
    alignItems: 'center', 
    flex: 1 
  },
  statValue: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  statLabel: { 
    fontSize: 12, 
    color: '#888', 
    marginTop: 2 
  },
});

export default StatsRow;