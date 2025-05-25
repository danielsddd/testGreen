// services/signalRservice.js - COMPLETE ENHANCED VERSION
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from './config';

class SignalRService {
  constructor() {
    this.connection = null;
    this.connectionPromise = null;
    this.reconnectInterval = null;
    this.heartbeatInterval = null;
    this.connectionState = { 
      isConnected: false, 
      isConnecting: false, 
      lastError: null,
      connectionId: null,
      lastConnectedAt: null,
      reconnectAttempts: 0,
      maxReconnectAttempts: 10
    };
    this.callbacks = { 
      onMessageReceived: null, 
      onTypingStarted: null, 
      onTypingStopped: null, 
      onConnectionStateChanged: null, 
      onReadReceiptReceived: null,
      onError: null
    };
    this.messageQueue = [];
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('🔌 Initializing enhanced SignalR connection...');
      
      if (this.connection && this.connectionState.isConnected) {
        console.log('✅ SignalR already connected');
        return this.connection;
      }
      
      if (this.connectionPromise) {
        console.log('⏳ SignalR connection in progress, waiting...');
        return this.connectionPromise;
      }

      this.connectionState.isConnecting = true;
      this.connectionState.reconnectAttempts++;
      this._notifyConnectionStateChanged();

      this.connectionPromise = this._createConnection();
      this.connection = await this.connectionPromise;
      this.connectionPromise = null;

      this.connectionState.isConnected = true;
      this.connectionState.isConnecting = false;
      this.connectionState.lastError = null;
      this.connectionState.connectionId = this.connection.connectionId;
      this.connectionState.lastConnectedAt = Date.now();
      this.connectionState.reconnectAttempts = 0;
      this.isInitialized = true;
      
      this._notifyConnectionStateChanged();
      this._startHeartbeat();
      await this._processMessageQueue();

      console.log('✅ Enhanced SignalR connection established');
      return this.connection;
    } catch (error) {
      console.error('❌ Error initializing SignalR connection:', error);
      this.connectionPromise = null;
     
      this.connectionState.isConnected = false;
      this.connectionState.isConnecting = false;
      this.connectionState.lastError = error.message;
      this.connectionState.connectionId = null;
      this._notifyConnectionStateChanged();
      
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
      
      this._startReconnection();
      throw error;
    }
  }

  async _createConnection() {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      if (!userEmail) {
        throw new Error('User not authenticated - email required for SignalR');
      }

      console.log('🔌 Creating SignalR connection for user:', userEmail);
      
      const negotiateEndpoint = `${config.api.baseUrl}/marketplace/signalr-negotiate?userId=${encodeURIComponent(userEmail)}`;
      
      const connection = new HubConnectionBuilder()
        .withUrl(negotiateEndpoint, {
          withCredentials: false,
          transport: 1, // WebSockets preferred
          timeout: 30000,
          headers: {
            'X-User-Email': userEmail
          }
        })
        .configureLogging(config.isDevelopment ? LogLevel.Information : LogLevel.Warning)
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            // Exponential backoff with jitter
            const delay = Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
            const jitter = Math.random() * 1000;
            return delay + jitter;
          }
        })
        .build();

      // Enhanced connection event handlers
      connection.onclose((error) => {
        console.log('🔌 SignalR connection closed', error?.message || 'Unknown reason');
        this.connectionState.isConnected = false;
        this.connectionState.connectionId = null;
        this.connectionState.lastError = error ? error.message : 'Connection closed';
        this._notifyConnectionStateChanged();
        this._stopHeartbeat();
        
        if (this.connectionState.reconnectAttempts < this.connectionState.maxReconnectAttempts) {
          this._startReconnection();
        } else {
          console.error('❌ Max reconnection attempts reached, giving up');
          if (this.callbacks.onError) {
            this.callbacks.onError(new Error('Max reconnection attempts reached'));
          }
        }
      });

      connection.onreconnecting((error) => {
        console.log('🔄 SignalR reconnecting...', error?.message);
        this.connectionState.isConnected = false;
        this.connectionState.isConnecting = true;
        this.connectionState.lastError = error ? error.message : 'Reconnecting';
        this.connectionState.reconnectAttempts++;
        this._notifyConnectionStateChanged();
        this._stopHeartbeat();
      });

      connection.onreconnected((connectionId) => {
        console.log('✅ SignalR reconnected with ID:', connectionId);
        this.connectionState.isConnected = true;
        this.connectionState.isConnecting = false;
        this.connectionState.lastError = null;
        this.connectionState.connectionId = connectionId;
        this.connectionState.lastConnectedAt = Date.now();
        this._notifyConnectionStateChanged();
        this._stopReconnection();
        this._startHeartbeat();
        this._processMessageQueue();
        
        // Rejoin user group after reconnection
        this._rejoinUserGroup();
      });

      this._registerMessageHandlers(connection);

      console.log('🚀 Starting SignalR connection...');
      await connection.start();
      
      console.log('✅ SignalR connection started, joining user group...');
      await connection.invoke('JoinUserGroup', userEmail);
      
      console.log('🎉 SignalR fully initialized and ready');
      return connection;
    } catch (error) {
      console.error('❌ Error creating SignalR connection:', error);
      throw error;
    }
  }

  _registerMessageHandlers(connection) {
    console.log('📝 Registering enhanced message handlers...');

    connection.on('ReceiveMessage', (message) => {
      console.log('📨 SignalR message received:', {
        messageId: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        timestamp: message.timestamp
      });
      
      if (this.callbacks.onMessageReceived) {
        this.callbacks.onMessageReceived(message);
      }
    });

    connection.on('UserTyping', (conversationId, userId) => {
      console.log('⌨️ User typing:', { conversationId, userId });
      if (this.callbacks.onTypingStarted) {
        this.callbacks.onTypingStarted(conversationId, userId);
      }
    });

    connection.on('UserStoppedTyping', (conversationId, userId) => {
      console.log('⌨️ User stopped typing:', { conversationId, userId });
      if (this.callbacks.onTypingStopped) {
        this.callbacks.onTypingStopped(conversationId, userId);
      }
    });

    connection.on('MessageRead', (conversationId, userId, messageIds, timestamp) => {
      console.log('👁️ Message read receipt:', { 
        conversationId, 
        userId, 
        messageCount: messageIds?.length,
        timestamp 
      });
      if (this.callbacks.onReadReceiptReceived) {
        this.callbacks.onReadReceiptReceived(conversationId, userId, messageIds, timestamp);
      }
    });

    // Enhanced error handling
    connection.on('Error', (error) => {
      console.error('❌ SignalR server error:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
    });

    // Connection quality monitoring
    connection.on('Ping', () => {
      console.log('🏓 SignalR ping received');
    });

    connection.on('ConnectionSlow', () => {
      console.warn('🐌 SignalR connection is slow');
      this.connectionState.lastError = 'Connection is slow';
      this._notifyConnectionStateChanged();
    });
  }

  _startReconnection() {
    this._stopReconnection();
    
    if (this.connectionState.reconnectAttempts >= this.connectionState.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached, stopping reconnection');
      return;
    }

    this.reconnectInterval = setInterval(async () => {
      if (!this.connectionState.isConnected && !this.connectionState.isConnecting) {
        console.log(`🔄 Attempting to reconnect SignalR... (attempt ${this.connectionState.reconnectAttempts + 1}/${this.connectionState.maxReconnectAttempts})`);
        try {
          this.connectionState.isConnecting = true;
          this._notifyConnectionStateChanged();
          
          this.connection = await this._createConnection();
          
          this.connectionState.isConnected = true;
          this.connectionState.isConnecting = false;
          this.connectionState.lastError = null;
          this.connectionState.reconnectAttempts = 0;
          this._notifyConnectionStateChanged();
          this._stopReconnection();
          
          console.log('✅ SignalR reconnection successful');
        } catch (error) {
          console.error('❌ Reconnection attempt failed:', error);
          this.connectionState.isConnecting = false;
          this.connectionState.lastError = error.message;
          this.connectionState.reconnectAttempts++;
          this._notifyConnectionStateChanged();
          
          if (this.connectionState.reconnectAttempts >= this.connectionState.maxReconnectAttempts) {
            this._stopReconnection();
            if (this.callbacks.onError) {
              this.callbacks.onError(new Error('Max reconnection attempts reached'));
            }
          }
        }
      }
    }, 5000 + (this.connectionState.reconnectAttempts * 2000)); // Progressive delay
  }

  _stopReconnection() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
      console.log('🛑 SignalR reconnection stopped');
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    
    this.heartbeatInterval = setInterval(async () => {
      if (this.connection && this.connectionState.isConnected) {
        try {
          await this.connection.invoke('Ping');
          console.log('💓 SignalR heartbeat sent');
        } catch (error) {
          console.error('❌ Heartbeat failed:', error);
          this.connectionState.lastError = 'Heartbeat failed';
          this._notifyConnectionStateChanged();
        }
      }
    }, 30000); // 30 seconds
  }

  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('💔 SignalR heartbeat stopped');
    }
  }

  async _rejoinUserGroup() {
    try {
      if (this.connection && this.connectionState.isConnected) {
        const userEmail = await AsyncStorage.getItem('userEmail');
        if (userEmail) {
          await this.connection.invoke('JoinUserGroup', userEmail);
          console.log('✅ Rejoined user group after reconnection');
        }
      }
    } catch (error) {
      console.error('❌ Failed to rejoin user group:', error);
    }
  }

  async _processMessageQueue() {
    if (this.messageQueue.length === 0) return;
    
    console.log(`📤 Processing ${this.messageQueue.length} queued messages...`);
    
    const messagesToProcess = [...this.messageQueue];
    this.messageQueue = [];
    
    for (const queuedMessage of messagesToProcess) {
      try {
        await this._sendQueuedMessage(queuedMessage);
      } catch (error) {
        console.error('❌ Failed to send queued message:', error);
        // Re-queue the message for later
        this.messageQueue.push(queuedMessage);
      }
    }
    
    console.log(`✅ Message queue processed, ${this.messageQueue.length} messages remain`);
  }

  async _sendQueuedMessage(queuedMessage) {
    const { method, args } = queuedMessage;
    
    if (this.connection && this.connectionState.isConnected) {
      await this.connection.invoke(method, ...args);
      console.log(`✅ Queued message sent: ${method}`);
    } else {
      throw new Error('Connection not available');
    }
  }

  _notifyConnectionStateChanged() {
    if (this.callbacks.onConnectionStateChanged) {
      this.callbacks.onConnectionStateChanged({
        isConnected: this.connectionState.isConnected,
        isConnecting: this.connectionState.isConnecting,
        lastError: this.connectionState.lastError,
        connectionId: this.connectionState.connectionId,
        lastConnectedAt: this.connectionState.lastConnectedAt,
        reconnectAttempts: this.connectionState.reconnectAttempts,
        maxReconnectAttempts: this.connectionState.maxReconnectAttempts
      });
    }
  }

  async disconnect() {
    console.log('🔌 Disconnecting SignalR...');
    
    this._stopReconnection();
    this._stopHeartbeat();
    
    if (this.connection) {
      try {
        await this.connection.stop();
        this.connection = null;
        console.log('✅ SignalR disconnected gracefully');
      } catch (error) {
        console.error('❌ Error disconnecting SignalR:', error);
      }
    }
    
    this.connectionState.isConnected = false;
    this.connectionState.isConnecting = false;
    this.connectionState.connectionId = null;
    this.isInitialized = false;
    this._notifyConnectionStateChanged();
  }

  // Enhanced callback registration
  onMessageReceived(callback) {
    this.callbacks.onMessageReceived = callback;
    console.log('📨 Message received callback registered');
  }

  onTypingStarted(callback) {
    this.callbacks.onTypingStarted = callback;
    console.log('⌨️ Typing started callback registered');
  }

  onTypingStopped(callback) {
    this.callbacks.onTypingStopped = callback;
    console.log('⌨️ Typing stopped callback registered');
  }

  onConnectionStateChanged(callback) {
    this.callbacks.onConnectionStateChanged = callback;
    console.log('🔌 Connection state changed callback registered');
    
    // Immediately notify with current state
    if (callback) {
      callback({
        isConnected: this.connectionState.isConnected,
        isConnecting: this.connectionState.isConnecting,
        lastError: this.connectionState.lastError,
        connectionId: this.connectionState.connectionId,
        lastConnectedAt: this.connectionState.lastConnectedAt,
        reconnectAttempts: this.connectionState.reconnectAttempts,
        maxReconnectAttempts: this.connectionState.maxReconnectAttempts
      });
    }
  }

  onReadReceiptReceived(callback) {
    this.callbacks.onReadReceiptReceived = callback;
    console.log('👁️ Read receipt callback registered');
  }

  onError(callback) {
    this.callbacks.onError = callback;
    console.log('❌ Error callback registered');
  }

  // Enhanced message sending with queueing
  async sendMessage(conversationId, message) {
    try {
      console.log('📤 Sending message via SignalR:', { conversationId, messageLength: message.length });
      
      if (!this.connection || !this.connectionState.isConnected) {
        console.log('📥 Connection not ready, queueing message...');
        this.messageQueue.push({
          method: 'SendMessage',
          args: [conversationId, message],
          timestamp: Date.now()
        });
        
        // Try to initialize connection
        await this.initialize();
        return true;
      }
      
      await this.connection.invoke('SendMessage', conversationId, message);
      console.log('✅ Message sent successfully via SignalR');
      return true;
    } catch (error) {
      console.error('❌ Error sending message through SignalR:', error);
      
      // Queue the message for retry
      this.messageQueue.push({
        method: 'SendMessage',
        args: [conversationId, message],
        timestamp: Date.now(),
        retryCount: 1
      });
      
      if (!this.connectionState.isConnected && !this.connectionState.isConnecting) {
        this._startReconnection();
      }
      
      throw error;
    }
  }

  async sendTypingIndicator(conversationId, isTyping) {
    try {
      console.log('⌨️ Sending typing indicator via SignalR:', { conversationId, isTyping });
      
      if (!this.connection || !this.connectionState.isConnected) {
        console.log('📥 Connection not ready, queueing typing indicator...');
        this.messageQueue.push({
          method: isTyping ? 'StartTyping' : 'StopTyping',
          args: [conversationId],
          timestamp: Date.now()
        });
        
        await this.initialize();
        return true;
      }
      
      const method = isTyping ? 'StartTyping' : 'StopTyping';
      await this.connection.invoke(method, conversationId);
      console.log(`✅ Typing indicator sent: ${method}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending typing indicator:', error);
      return false;
    }
  }

  async sendReadReceipt(conversationId, messageIds = []) {
    try {
      console.log('👁️ Sending read receipt via SignalR:', { conversationId, messageCount: messageIds.length });
      
      if (!this.connection || !this.connectionState.isConnected) {
        console.log('📥 Connection not ready, queueing read receipt...');
        this.messageQueue.push({
          method: 'MarkMessagesAsRead',
          args: [conversationId, messageIds],
          timestamp: Date.now()
        });
        
        await this.initialize();
        return true;
      }
      
      await this.connection.invoke('MarkMessagesAsRead', conversationId, messageIds);
      console.log('✅ Read receipt sent successfully');
      return true;
    } catch (error) {
      console.error('❌ Error sending read receipt:', error);
      return false;
    }
  }

  // Enhanced connection state management
  getConnectionState() {
    return { 
      ...this.connectionState,
      queuedMessages: this.messageQueue.length,
      isInitialized: this.isInitialized,
      uptime: this.connectionState.lastConnectedAt ? 
        Date.now() - this.connectionState.lastConnectedAt : 0
    };
  }

  // Force reconnection
  async forceReconnect() {
    console.log('🔄 Forcing SignalR reconnection...');
    
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch (error) {
        console.warn('⚠️ Error stopping connection during force reconnect:', error);
      }
    }
    
    this.connection = null;
    this.connectionState.isConnected = false;
    this.connectionState.isConnecting = false;
    this.connectionState.reconnectAttempts = 0;
    
    return await this.initialize();
  }

  // Health check
  async checkHealth() {
    try {
      if (!this.connection || !this.connectionState.isConnected) {
        return { healthy: false, reason: 'Not connected' };
      }
      
      await this.connection.invoke('Ping');
      
      return { 
        healthy: true, 
        connectionId: this.connectionState.connectionId,
        uptime: Date.now() - this.connectionState.lastConnectedAt,
        queuedMessages: this.messageQueue.length
      };
    } catch (error) {
      console.error('❌ SignalR health check failed:', error);
      return { healthy: false, reason: error.message };
    }
  }

  // Clear message queue
  clearMessageQueue() {
    const clearedCount = this.messageQueue.length;
    this.messageQueue = [];
    console.log(`🧹 Cleared ${clearedCount} queued messages`);
    return clearedCount;
  }

  // Get queue statistics
  getQueueStats() {
    const now = Date.now();
    const stats = {
      total: this.messageQueue.length,
      byMethod: {},
      oldestMessage: null,
      averageAge: 0
    };
    
    let totalAge = 0;
    
    this.messageQueue.forEach(msg => {
      // Count by method
      stats.byMethod[msg.method] = (stats.byMethod[msg.method] || 0) + 1;
      
      // Track oldest message
      if (!stats.oldestMessage || msg.timestamp < stats.oldestMessage.timestamp) {
        stats.oldestMessage = msg;
      }
      
      // Calculate age
      totalAge += (now - msg.timestamp);
    });
    
    if (this.messageQueue.length > 0) {
      stats.averageAge = totalAge / this.messageQueue.length;
    }
    
    return stats;
  }
}

const signalRService = new SignalRService();
export default signalRService;