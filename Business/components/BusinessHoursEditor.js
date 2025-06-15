import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getWebSafeShadow, colors, spacing, typography, borderRadius } from '../../marketplace/services/theme';

const BusinessHoursEditor = ({ 
  businessHours = {}, 
  onHourChange = () => {}, 
  style = {} 
}) => {
  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  const handleToggleDay = (day, isOpen) => {
    const updatedHours = {
      ...businessHours[day],
      isOpen: isOpen
    };
    
    // Set default times if opening the day
    if (isOpen && (!updatedHours.openTime || !updatedHours.closeTime)) {
      updatedHours.openTime = '09:00';
      updatedHours.closeTime = '17:00';
    }
    
    onHourChange(day, updatedHours);
  };

  const handleTimeChange = (day, field, value) => {
    const formattedTime = formatTimeInput(value);
    onHourChange(day, {
      ...businessHours[day],
      [field]: formattedTime
    });
  };

  const formatTimeInput = (time) => {
    const cleaned = time.replace(/[^\d:]/g, '');
    if (cleaned.length === 2 && !cleaned.includes(':')) {
      return cleaned + ':';
    }
    if (cleaned.length > 5) {
      return cleaned.substring(0, 5);
    }
    return cleaned;
  };

  return (
    <View style={[styles.container, style]}>
      {daysOfWeek.map((day) => {
        const dayHours = businessHours[day] || { isOpen: true, openTime: '09:00', closeTime: '17:00' };
        
        return (
          <View key={day} style={styles.dayContainer}>
            <View style={styles.dayHeader}>
              <Text style={[styles.dayName, !dayHours.isOpen && styles.dayNameClosed]}>
                {day.charAt(0).toUpperCase() + day.slice(1)}
              </Text>
              
              <View style={styles.toggleButtons}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    dayHours.isOpen && styles.toggleButtonActive
                  ]}
                  onPress={() => handleToggleDay(day, true)}
                >
                  <MaterialIcons 
                    name="schedule" 
                    size={14} 
                    color={dayHours.isOpen ? '#fff' : '#4CAF50'} 
                  />
                  <Text style={[
                    styles.toggleText,
                    dayHours.isOpen && styles.toggleTextActive
                  ]}>
                    Open
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    !dayHours.isOpen && styles.toggleButtonActive
                  ]}
                  onPress={() => handleToggleDay(day, false)}
                >
                  <MaterialIcons 
                    name="block" 
                    size={14} 
                    color={!dayHours.isOpen ? '#fff' : '#666'} 
                  />
                  <Text style={[
                    styles.toggleText,
                    !dayHours.isOpen && styles.toggleTextActive
                  ]}>
                    Closed
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {dayHours.isOpen && (
              <View style={styles.timeInputsContainer}>
                <View style={styles.timeInputGroup}>
                  <Text style={styles.timeLabel}>From</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={dayHours.openTime || '09:00'}
                    onChangeText={(time) => handleTimeChange(day, 'openTime', time)}
                    placeholder="09:00"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                  />
                </View>
                
                <MaterialIcons name="arrow-forward" size={16} color="#666" style={styles.arrow} />
                
                <View style={styles.timeInputGroup}>
                  <Text style={styles.timeLabel}>To</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={dayHours.closeTime || '17:00'}
                    onChangeText={(time) => handleTimeChange(day, 'closeTime', time)}
                    placeholder="17:00"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.m,
    padding: spacing.m,
    ...getWebSafeShadow('s'),
  },
  dayContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.lightBorder,
    paddingVertical: spacing.m,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.s,
  },
  dayName: {
    fontSize: typography.size.l,
    fontWeight: typography.weight.semiBold,
    color: colors.text.primary,
    minWidth: 80,
  },
  dayNameClosed: {
    color: colors.text.tertiary,
    textDecorationLine: 'line-through',
  },
  toggleButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.s,
    borderRadius: borderRadius.s,
    borderWidth: 1,
    borderColor: colors.primary.main,
    backgroundColor: 'transparent',
    minWidth: 70,
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary.main,
  },
  toggleText: {
    fontSize: typography.size.s,
    color: colors.primary.main,
    marginLeft: 4,
    fontWeight: typography.weight.medium,
  },
  toggleTextActive: {
    color: colors.accent.white,
  },
  timeInputsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.s,
    paddingLeft: 80, // Align with day name
  },
  timeInputGroup: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: typography.size.s,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: colors.neutral.mediumBorder,
    borderRadius: borderRadius.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.s,
    fontSize: typography.size.m,
    textAlign: 'center',
    backgroundColor: colors.neutral.veryLightBackground,
    minWidth: 60,
    color: colors.text.primary,
  },
  arrow: {
    marginHorizontal: spacing.s,
  },
});

export default BusinessHoursEditor;