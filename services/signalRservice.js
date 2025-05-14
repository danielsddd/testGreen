// Frontend: marketplace/services/SignalRService.js

import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from './config';

class SignalRService {
  constructor() {
    this.connection = null;
    this.connectionPromise = null;
    this.callbacks = {
      onMessageReceived: null,
      onTypingStarted: null,
      onTypingStopped: null,
      onConnectionStateChanged: null,
      onReadReceiptReceived: null
    };
  }

  async initialize() {
    try {
      if (this.connection) {
        return this.connection;
      }

      if (this.connectionPromise) {
        return this.connectionPromise;
      }

      this.connectionPromise = this._createConnection();
      this.connection = await this.connectionPromise;
      this.connectionPromise = null;
      
      return this.connection;
    } catch (error) {
      console.error('Error initializing SignalR connection:', error);
      this.connectionPromise = null;
      throw error;
    }
  }

  async _createConnection() {
    try {
      // Get the user's email from AsyncStorage
      const userEmail = await AsyncStorage.getItem('userEmail');
      
      if (!userEmail) {
        throw new Error('User not authenticated');
      }

      // Create the connection
      const connection = new HubConnectionBuilder()
        .withUrl(`${config.api.baseUrl}/marketplace/signalr?userId=${encodeURIComponent(userEmail)}`)
        .configureLogging(config.isDevelopment ? LogLevel.Information : LogLevel.Error)
        .withAutomaticReconnect([0, 2000, 10000, 30000, null]) // Reconnect intervals (ms)
        .build();

      // Set up connection event handlers
      connection.onclose((error) => {
        console.log('SignalR connection closed', error);
        this._notifyConnectionStateChanged(false);
      });

      connection.onreconnecting((error) => {
        console.log('SignalR reconnecting', error);
        this._notifyConnectionStateChanged(false);
      });

      connection.onreconnected((connectionId) => {
        console.log('SignalR reconnected with ID', connectionId);
        this._notifyConnectionStateChanged(true);
      });

      // Set up message handlers
      connection.on('ReceiveMessage', (message) => {
        if (this.callbacks.onMessageReceived) {
          this.callbacks.onMessageReceived(message);
        }
      });

      connection.on('TypingStarted', (conversationId, userId) => {
        if (this.callbacks.onTypingStarted) {
          this.callbacks.onTypingStarted(conversationId, userId);
        }
      });

      connection.on('TypingStopped', (conversationId, userId) => {
        if (this.callbacks.onTypingStopped) {
          this.callbacks.onTypingStopped(conversationId, userId);
        }
      });

      connection.on('ReadReceipt', (conversationId, userId, timestamp) => {
        if (this.callbacks.onReadReceiptReceived) {
          this.callbacks.onReadReceiptReceived(conversationId, userId, timestamp);
        }
      });

      // Start the connection
      await connection.start();
      console.log('SignalR connected');
      this._notifyConnectionStateChanged(true);

      return connection;
    } catch (error) {
      console.error('Error creating SignalR connection:', error);
      this._notifyConnectionStateChanged(false);
      throw error;
    }
  }

  _notifyConnectionStateChanged(connected) {
    if (this.callbacks.onConnectionStateChanged) {
      this.callbacks.onConnectionStateChanged(connected);
    }
  }

  async disconnect() {
    if (this.connection) {
      try {
        await this.connection.stop();
        this.connection = null;
        console.log('SignalR disconnected');
        this._notifyConnectionStateChanged(false);
      } catch (error) {
        console.error('Error disconnecting SignalR:', error);
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
  }

  onReadReceiptReceived(callback) {
    this.callbacks.onReadReceiptReceived = callback;
  }

  async sendMessage(conversationId, message) {
    try {
      if (!this.connection) {
        await this.initialize();
      }
      await this.connection.invoke('SendMessage', conversationId, message);
    } catch (error) {
      console.error('Error sending message through SignalR:', error);
      throw error;
    }
  }

  async sendTypingIndicator(conversationId, isTyping) {
    try {
      if (!this.connection) {
        await this.initialize();
      }
      
      const method = isTyping ? 'StartTyping' : 'StopTyping';
      await this.connection.invoke(method, conversationId);
    } catch (error) {
      console.error('Error sending typing indicator:', error);
      // Don't throw - typing indicators are non-critical
    }
  }

  async sendReadReceipt(conversationId) {
    try {
      if (!this.connection) {
        await this.initialize();
      }
      await this.connection.invoke('MarkAsRead', conversationId);
    } catch (error) {
      console.error('Error sending read receipt:', error);
      // Don't throw - read receipts are non-critical
    }
  }
}

// Create a singleton instance
const signalRService = new SignalRService();
export default signalRService;