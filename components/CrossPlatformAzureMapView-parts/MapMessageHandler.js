// Map message handler utility for processing messages across platforms
export const createMapMessageHandler = (
    setIsLoading,
    setMapReady,
    setError,
    setErrorMessage,
    onMapReady,
    onSelectProduct,
    onMapPress
  ) => {
  
    // For web platform
    const handleWebMessage = (event) => {
      if (!event.data) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        console.log('Map message received:', data.type);
        
        processMapMessage(data);
      } catch (err) {
        console.error('Error handling map message:', err);
      }
    };
    
    // For native WebView
    const handleNativeMessage = (e) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        console.log('Mobile WebView message:', data.type);
        
        processMapMessage(data);
      } catch (err) {
        console.error('Error parsing WebView message:', err);
      }
    };
    
    // Common message processing logic
    const processMapMessage = (data) => {
      switch (data.type) {
        case 'MAP_READY':
          setIsLoading(false);
          setMapReady(true);
          onMapReady?.();
          break;
        case 'PIN_CLICKED':
          console.log('Pin clicked:', data.productId);
          onSelectProduct?.(data.productId);
          break;
        case 'MAP_CLICKED':
          onMapPress?.(data.coordinates);
          break;
        case 'MAP_ERROR':
        case 'ERROR':
          console.error('Map error:', data.message || data.error);
          setError(true);
          setErrorMessage(data.message || data.error || 'Unknown error');
          break;
        default:
          // Ignore other messages
      }
    };
    
    return {
      handleWebMessage,
      handleNativeMessage,
      processMapMessage
    };
  };