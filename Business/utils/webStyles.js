// utils/webStyles.js - Web-Compatible Styles Utility
import { Platform } from 'react-native';

// Convert React Native shadow props to web-compatible boxShadow
export const createWebShadow = (shadowProps) => {
  if (Platform.OS === 'web') {
    const {
      shadowColor = '#000',
      shadowOffset = { width: 0, height: 2 },
      shadowOpacity = 0.1,
      shadowRadius = 4,
      elevation = 0
    } = shadowProps;
    
    // Convert elevation to shadow for web
    if (elevation > 0) {
      return {
        boxShadow: `0 ${elevation}px ${elevation * 2}px rgba(0,0,0,0.15)`
      };
    }
    
    // Convert React Native shadow to CSS boxShadow
    const { width, height } = shadowOffset;
    return {
      boxShadow: `${width}px ${height}px ${shadowRadius}px rgba(0,0,0,${shadowOpacity})`
    };
  }
  
  // Return original props for mobile
  return shadowProps;
};

// Web-compatible animated transforms
export const createWebTransform = (transforms) => {
  if (Platform.OS === 'web') {
    return transforms;
  }
  return { transform: transforms };
};

// Web-compatible pointer events
export const createWebPointerEvents = (pointerEvents) => {
  if (Platform.OS === 'web') {
    return { pointerEvents };
  }
  return { pointerEvents };
};

// Web-compatible user select
export const createWebUserSelect = (userSelect = 'none') => {
  if (Platform.OS === 'web') {
    return {
      userSelect,
      WebkitUserSelect: userSelect,
      MozUserSelect: userSelect,
      msUserSelect: userSelect
    };
  }
  return {};
};

// Web-compatible cursor
export const createWebCursor = (cursor = 'pointer') => {
  if (Platform.OS === 'web') {
    return { cursor };
  }
  return {};
};

// Responsive dimensions for web
export const createWebDimensions = () => {
  if (Platform.OS === 'web') {
    return {
      width: '100%',
      maxWidth: 1200,
      marginHorizontal: 'auto'
    };
  }
  return {};
};

// Web-compatible text selection
export const createWebTextSelection = (selectable = false) => {
  if (Platform.OS === 'web') {
    return {
      ...createWebUserSelect(selectable ? 'text' : 'none'),
      WebkitTouchCallout: 'none',
      WebkitTapHighlightColor: 'transparent'
    };
  }
  return {};
};

// Web-compatible focus styles
export const createWebFocusStyles = (focusColor = '#4CAF50') => {
  if (Platform.OS === 'web') {
    return {
      ':focus': {
        outline: `2px solid ${focusColor}`,
        outlineOffset: 2
      },
      ':focus-visible': {
        outline: `2px solid ${focusColor}`,
        outlineOffset: 2
      }
    };
  }
  return {};
};

// Web-compatible hover styles
export const createWebHoverStyles = (hoverStyles) => {
  if (Platform.OS === 'web') {
    return {
      ':hover': hoverStyles
    };
  }
  return {};
};

// Web responsive breakpoints
export const webBreakpoints = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200
};

// Web media queries
export const createWebMediaQuery = (breakpoint, styles) => {
  if (Platform.OS === 'web') {
    return {
      [`@media (min-width: ${webBreakpoints[breakpoint]}px)`]: styles
    };
  }
  return {};
};

// Web-compatible backdrop filter
export const createWebBackdrop = (blur = 10) => {
  if (Platform.OS === 'web') {
    return {
      backdropFilter: `blur(${blur}px)`,
      WebkitBackdropFilter: `blur(${blur}px)`
    };
  }
  return {};
};

// Web-compatible scrollbar styles
export const createWebScrollbar = () => {
  if (Platform.OS === 'web') {
    return {
      '::-webkit-scrollbar': {
        width: 8
      },
      '::-webkit-scrollbar-track': {
        background: '#f1f1f1',
        borderRadius: 4
      },
      '::-webkit-scrollbar-thumb': {
        background: '#c1c1c1',
        borderRadius: 4
      },
      '::-webkit-scrollbar-thumb:hover': {
        background: '#a1a1a1'
      }
    };
  }
  return {};
};

// Platform-specific styles helper
export const platformStyles = {
  web: (styles) => Platform.OS === 'web' ? styles : {},
  mobile: (styles) => Platform.OS !== 'web' ? styles : {},
  common: (styles) => styles
};

// Web-safe animation configuration
export const webAnimationConfig = {
  useNativeDriver: Platform.OS !== 'web',
  duration: Platform.OS === 'web' ? 300 : 250, // Slightly longer for web
  tension: Platform.OS === 'web' ? 120 : 100,
  friction: Platform.OS === 'web' ? 8 : 7
};

// Web-compatible image handling
export const createWebImageStyles = () => {
  if (Platform.OS === 'web') {
    return {
      objectFit: 'cover',
      objectPosition: 'center'
    };
  }
  return {};
};

// Web form styles
export const createWebFormStyles = () => {
  if (Platform.OS === 'web') {
    return {
      outline: 'none',
      border: '1px solid #e0e0e0',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      fontFamily: 'inherit',
      transition: 'border-color 0.2s ease',
      ':focus': {
        borderColor: '#4CAF50',
        boxShadow: '0 0 0 2px rgba(76, 175, 80, 0.2)'
      }
    };
  }
  return {};
};

export default {
  createWebShadow,
  createWebTransform,
  createWebPointerEvents,
  createWebUserSelect,
  createWebCursor,
  createWebDimensions,
  createWebTextSelection,
  createWebFocusStyles,
  createWebHoverStyles,
  createWebMediaQuery,
  createWebBackdrop,
  createWebScrollbar,
  createWebImageStyles,
  createWebFormStyles,
  platformStyles,
  webAnimationConfig,
  webBreakpoints
};