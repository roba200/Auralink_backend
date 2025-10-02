/**
 * MQTT Handler Module
 * 
 * Manages all MQTT-related functionality including:
 * - Connection to MQTT broker
 * - Subscription to sensor topics
 * - Publishing messages to display topics
 * - Handling connection/disconnection events
 */

import mqtt from 'mqtt';
import logger from '../utils/logger.js';
import dataStore from '../utils/dataStore.js';

class MqttHandler {
  constructor(config) {
    this.mqttClient = null;
    this.broker = config.brokerUrl;
    this.clientId = config.clientId;
    this.username = config.username;
    this.password = config.password;
    this.topicHandlers = new Map();
    this.isConnected = false;
  }

  /**
   * Connect to the MQTT broker
   * @returns {Promise} Resolves when connected, rejects on error
   */
  connect() {
    return new Promise((resolve, reject) => {
      const options = {
        clientId: this.clientId,
        clean: true,
        reconnectPeriod: 5000,
      };

      if (this.username && this.password) {
        options.username = this.username;
        options.password = this.password;
      }

      logger.info(`Connecting to MQTT broker at ${this.broker}`);
      this.mqttClient = mqtt.connect(this.broker, options);

      this.mqttClient.on('connect', () => {
        this.isConnected = true;
        logger.info('Connected to MQTT broker successfully');
        resolve();
      });

      this.mqttClient.on('error', (err) => {
        logger.error('MQTT connection error:', err.message);
        reject(err);
      });

      this.mqttClient.on('offline', () => {
        this.isConnected = false;
        logger.warn('MQTT client is offline');
      });

      this.mqttClient.on('reconnect', () => {
        logger.info('Attempting to reconnect to MQTT broker');
      });

      this.mqttClient.on('message', (topic, message) => {
        const messageStr = message.toString();
        logger.debug(`Received message on topic ${topic}: ${messageStr}`);
        
        try {
          // Call the appropriate handler for this topic
          if (this.topicHandlers.has(topic)) {
            this.topicHandlers.get(topic)(topic, messageStr);
          }
        } catch (error) {
          logger.error(`Error processing message from topic ${topic}:`, error);
        }
      });
    });
  }

  /**
   * Subscribe to a topic and register a handler function
   * @param {string} topic - The MQTT topic to subscribe to
   * @param {function} handler - Function to call when a message arrives on this topic
   * @returns {Promise} Resolves when subscribed successfully
   */
  subscribe(topic, handler) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('MQTT client not connected'));
        return;
      }

      this.mqttClient.subscribe(topic, (err) => {
        if (err) {
          logger.error(`Failed to subscribe to topic ${topic}:`, err);
          reject(err);
          return;
        }
        
        logger.info(`Subscribed to topic: ${topic}`);
        if (handler) {
          this.topicHandlers.set(topic, handler);
        }
        
        resolve();
      });
    });
  }

  /**
   * Publish a message to a topic
   * @param {string} topic - The MQTT topic to publish to
   * @param {string|object} message - The message to publish (objects are stringified)
   * @param {object} options - MQTT publish options
   * @returns {Promise} Resolves when published successfully
   */
  publish(topic, message, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('MQTT client not connected'));
        return;
      }

      // Convert objects to strings
      const messageStr = typeof message === 'object' ? 
        JSON.stringify(message) : message;
      
      this.mqttClient.publish(topic, messageStr, options, (err) => {
        if (err) {
          logger.error(`Failed to publish to topic ${topic}:`, err);
          reject(err);
          return;
        }
        
        logger.debug(`Published message to topic ${topic}: ${messageStr}`);
        resolve();
      });
    });
  }

  /**
   * Disconnect from the MQTT broker
   * @returns {Promise} Resolves when disconnected
   */
  disconnect() {
    return new Promise((resolve) => {
      if (this.mqttClient && this.isConnected) {
        this.mqttClient.end(false, () => {
          logger.info('Disconnected from MQTT broker');
          this.isConnected = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export default MqttHandler;