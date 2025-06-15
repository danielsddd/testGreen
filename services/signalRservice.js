// Frontend SignalR Implementation for Real-time Messaging
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from './config';

class SignalRService {
  constructor() {
    this.connection = null;
    this.connectionPromise = null;
    this.reconnectInterval = null;
    this.connectionState = { 
      isConnected: false, 
      isConnecting: false, 
      lastError: null,
      isServerAvailable: true,
      offlineMode: false
    };
    this.callbacks = { 
      onMessageReceived: null, 
      onTypingStarted: null, 
      onTypingStopped: null, 
      onConnectionStateChanged: null, 
      onReadReceiptReceived: null 
    };
    this.maxReconnectAttempts = 3; // Reduced for less spam
    this.reconnectAttempts = 0;
    this.isDisposed = false;
    this.lastHealthCheck = 0;
    this.healthCheckInterval = 120000; // Check every 2 minutes instead of 1
    this.silentMode = false; // Add silent mode to reduce console spam
  }

  async initialize() {
    if (this.isDisposed || this.connection) return this.connection;
    if (this.connectionPromise) return this.connectionPromise;

    // FIXED: Check if we're in signup flow and skip SignalR initialization
    const userEmail = await AsyncStorage.getItem('userEmail');
    const isInApp = await AsyncStorage.getItem('isBusinessUser') || await AsyncStorage.getItem('userName');
    
    if (!userEmail || !isInApp) {
      console.log('📶 SignalR: User not fully registered yet, skipping initialization');
      this.connectionState.isServerAvailable = false;
      this.connectionState.offlineMode = true;
      this._notifyConnectionStateChanged();
      return null;
    }

    // Check if server is available first (with reduced frequency)
    const isServerAvailable = await this._checkServerAvailability();
    if (!isServerAvailable) {
      if (!this.silentMode) {
        console.log('📶 SignalR server not available, running in offline mode');
        this.silentMode = true; // Enable silent mode after first warning
      }
      this.connectionState.isServerAvailable = false;
      this.connectionState.offlineMode = true;
      this._notifyConnectionStateChanged();
      return null;
    }

    this.connectionState.isConnecting = true;
    this._notifyConnectionStateChanged();

    try {
      this.connectionPromise = this._createConnection();
      this.connection = await this.connectionPromise;
      this.connectionPromise = null;

      this.connectionState.isConnected = true;
      this.connectionState.isConnecting = false;
      this.connectionState.lastError = null;
      this.connectionState.isServerAvailable = true;
      this.connectionState.offlineMode = false;
      this.reconnectAttempts = 0;
      this.silentMode = false; // Reset silent mode on successful connection
      this._notifyConnectionStateChanged();

      return this.connection;
    } catch (error) {
      if (!this.silentMode) {
        console.log('📶 SignalR initialization failed, continuing in offline mode');
        this.silentMode = true;
      }
      this.connectionState.isConnecting = false;
      this.connectionState.offlineMode = true;
      this.connectionState.lastError = error.message;
      this._notifyConnectionStateChanged();
      return null;
    }
  }

  async _checkServerAvailability() {
    try {
      // Don't spam server checks
      const now = Date.now();
      if (now - this.lastHealthCheck < this.healthCheckInterval) {
        return this.connectionState.isServerAvailable;
      }
      this.lastHealthCheck = now;

      const userEmail = await AsyncStorage.getItem('userEmail');
      const isInApp = await AsyncStorage.getItem('isBusinessUser') || await AsyncStorage.getItem('userName');
      
      // FIXED: Skip server check during signup flow
      if (!userEmail || !isInApp) {
        if (!this.silentMode) {
          console.log('📶 SignalR Service: User not fully registered yet, skipping server check');
          this.silentMode = true;
        }
        return false;
      }

      const negotiateEndpoint = `${config.api.baseUrl}/marketplace/signalr-negotiate`;
      
      // Quick health check with shorter timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5 second timeout
      
      const response = await fetch(negotiateEndpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: userEmail }),
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      // Silently handle - don't spam console
      return false;
    }
  }

  async _createConnection() {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (!userEmail) throw new Error('User not authenticated');

      const negotiateEndpoint = `${config.api.baseUrl}/marketplace/signalr-negotiate`;

      this.connection = new HubConnectionBuilder()
        .withUrl(negotiateEndpoint, {
          skipNegotiation: false,
          transport: 1 | 2 | 4, // WebSockets, ServerSentEvents, LongPolling
        })
        .configureLogging(LogLevel.Error) // Only show errors, not info
        .withAutomaticReconnect([2000, 5000, 10000]) // Reduced frequency
        .build();

      this.connection.onreconnecting(() => {
        this.connectionState.isConnected = false;
        this.connectionState.isConnecting = true;
        this.connectionState.lastError = 'Reconnecting';
        this._notifyConnectionStateChanged();
      });

      this.connection.onreconnected((connectionId) => {
        if (!this.silentMode) {
          console.log('📶 SignalR reconnected');
        }
        this.connectionState.isConnected = true;
        this.connectionState.isConnecting = false;
        this.connectionState.lastError = null;
        this.connectionState.isServerAvailable = true;
        this.connectionState.offlineMode = false;
        this.reconnectAttempts = 0;
        this._notifyConnectionStateChanged();
        this._stopReconnection();
      });

      this.connection.onclose((error) => {
        this.connectionState.isConnected = false;
        this.connectionState.lastError = error ? error.message : 'Connection closed';
        this._notifyConnectionStateChanged();
        
        // Don't spam reconnection attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this._startReconnection();
        } else {
          if (!this.silentMode) {
            console.log('📶 SignalR offline mode - max reconnection attempts reached');
            this.silentMode = true;
          }
          this.connectionState.isServerAvailable = false;
          this.connectionState.offlineMode = true;
        }
      });

      this._registerMessageHandlers(this.connection);
      await this.connection.start();
      
      if (!this.silentMode) {
        console.log('📶 SignalR connected successfully');
      }
      
      await this.connection.invoke('JoinUserGroup', userEmail);

      return this.connection;
    } catch (error) {
      // Don't spam console with errors
      throw error;
    }
  }

  _registerMessageHandlers(connection) {
    connection.on('ReceiveMessage', (message) => {
      if (this.callbacks.onMessageReceived) {
        this.callbacks.onMessageReceived(message);
      }
    });
    
    connection.on('UserTyping', (conversationId, userId) => {
      if (this.callbacks.onTypingStarted) {
        this.callbacks.onTypingStarted(conversationId, userId);
      }
    });
    
    connection.on('UserStoppedTyping', (conversationId, userId) => {
      if (this.callbacks.onTypingStopped) {
        this.callbacks.onTypingStopped(conversationId, userId);
      }
    });
    
    connection.on('MessageRead', (conversationId, userId, messageIds, timestamp) => {
      if (this.callbacks.onReadReceiptReceived) {
        this.callbacks.onReadReceiptReceived(conversationId, userId, messageIds, timestamp);
      }
    });
  }

  _startReconnection() {
    this._stopReconnection();
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.connectionState.isServerAvailable = false;
      this.connectionState.offlineMode = true;
      this._notifyConnectionStateChanged();
      return;
    }

    // Use exponential backoff for reconnection with longer delays
    const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    this.reconnectInterval = setTimeout(async () => {
      if (!this.connectionState.isConnected && !this.connectionState.isConnecting && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        
        try {
          this.connectionState.isConnecting = true;
          this._notifyConnectionStateChanged();
          
          this.connection = await this._createConnection();
          this.connectionState.isConnected = true;
          this.connectionState.isConnecting = false;
          this.connectionState.lastError = null;
          this.connectionState.isServerAvailable = true;
          this.connectionState.offlineMode = false;
          this._notifyConnectionStateChanged();
          this._stopReconnection();
        } catch (error) {
          this.connectionState.isConnecting = false;
          this.connectionState.lastError = error.message;
          this._notifyConnectionStateChanged();
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            if (!this.silentMode) {
              console.log('📶 SignalR entering offline mode');
              this.silentMode = true;
            }
            this.connectionState.isServerAvailable = false;
            this.connectionState.offlineMode = true;
            this._stopReconnection();
          } else {
            // Schedule next attempt
            this._startReconnection();
          }
        }
      }
    }, delay);
  }

  _stopReconnection() {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  _notifyConnectionStateChanged() {
    if (this.callbacks.onConnectionStateChanged) {
      this.callbacks.onConnectionStateChanged(this.connectionState);
    }
  }

  async disconnect() {
    this._stopReconnection();
    if (this.connection) {
      try {
        await this.connection.stop();
        this.connection = null;
        this.connectionState.isConnected = false;
        this.connectionState.isConnecting = false;
        this._notifyConnectionStateChanged();
      } catch (error) {
        // Silently handle disconnect errors
      }
    }
  }

  onMessageReceived(callback) {
    this.callbacks.onMessageReceived = callback;
  }

  onTypingStarted(callback) {
    this.callbacks.onTypingStarted = callback;
  }

  onTypingStopped(callback) {
    this.callbacks.onTypingStopped = callback;
  }

  onConnectionStateChanged(callback) {
    this.callbacks.onConnectionStateChanged = callback;
    if (callback) {
      callback({
        isConnected: this.connectionState.isConnected,
        isConnecting: this.connectionState.isConnecting,
        lastError: this.connectionState.lastError
      });
    }
  }

  onReadReceiptReceived(callback) {
    this.callbacks.onReadReceiptReceived = callback;
  }

  async sendMessage(conversationId, message) {
    try {
      // If SignalR is not available, fall back to HTTP API
      if (!this.connectionState.isServerAvailable || (!this.connection && !this.connectionState.isConnected)) {
        return false; // Let the calling code handle HTTP fallback
      }

      if (!this.connection || !this.connectionState.isConnected) {
        await this.initialize();
      }

      if (!this.connection) {
        return false; // SignalR not available
      }

      await this.connection.invoke('SendMessage', conversationId, message);
      return true;
    } catch (error) {
      // Silently fail and let calling code handle fallback
      return false;
    }
  }

  async sendTypingIndicator(conversationId, isTyping) {
    try {
      if (!this.connectionState.isServerAvailable || !this.connection || !this.connectionState.isConnected) {
        return false; // Gracefully fail for typing indicators
      }

      const method = isTyping ? 'StartTyping' : 'StopTyping';
      await this.connection.invoke(method, conversationId);
      return true;
    } catch (error) {
      return false; // Silently fail for typing indicators
    }
  }

  async sendReadReceipt(conversationId, messageIds = []) {
    try {
      if (!this.connectionState.isServerAvailable || !this.connection || !this.connectionState.isConnected) {
        return false; // Gracefully fail for read receipts
      }

      await this.connection.invoke('MarkMessagesAsRead', conversationId, messageIds);
      return true;
    } catch (error) {
      return false; // Silently fail for read receipts
    }
  }

  getConnectionState() {
    return { ...this.connectionState };
  }

  isOfflineMode() {
    return this.connectionState.offlineMode;
  }

  dispose() {
    this.isDisposed = true;
    this._stopReconnection();
    if (this.connection) {
      this.connection.stop();
      this.connection = null;
    }
  }
}

const signalRService = new SignalRService();

// FIXED: Add function to initialize SignalR after successful business signup
export const initializeSignalRAfterSignup = async (userEmail) => {
  try {
    console.log('🔄 Initializing SignalR after successful business signup for:', userEmail);
    
    // Reset any previous connection state
    if (signalRService.connection) {
      await signalRService.disconnect();
    }
    
    // Reset the silent mode and connection state for fresh start
    signalRService.silentMode = false;
    signalRService.reconnectAttempts = 0;
    signalRService.connectionState = {
      isConnected: false,
      isConnecting: false,
      lastError: null,
      isServerAvailable: true,
      offlineMode: false
    };
    
    // Give a small delay to ensure user data is fully propagated
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify user data is in storage
    const storedEmail = await AsyncStorage.getItem('userEmail');
    const isBusinessUser = await AsyncStorage.getItem('isBusinessUser');
    const userName = await AsyncStorage.getItem('userName');
    
    if (storedEmail && (isBusinessUser || userName)) {
      console.log('✅ User data confirmed in storage, initializing SignalR...');
      
      // Force initialization now that user exists
      const connection = await signalRService.initialize();
      if (connection) {
        console.log('✅ SignalR initialized successfully after business signup');
        return true;
      } else {
        console.log('⚠️ SignalR initialization returned null (offline mode)');
        return false;
      }
    } else {
      console.warn('⚠️ User data not found in storage, SignalR initialization skipped');
      return false;
    }
  } catch (error) {
    console.warn('⚠️ SignalR post-signup initialization failed:', error.message);
    return false;
  }
};

export default signalRService;