/**
 * Config Loader
 * 
 * Loads and validates configuration from environment variables
 * providing appropriate defaults when needed
 */

import logger from './logger.js';

/**
 * Validates that required environment variables are present
 * @param {Array<string>} requiredVars - Array of required variable names
 * @throws {Error} If any required variables are missing
 */
function validateRequiredEnvVars(requiredVars) {
  const missing = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Load MQTT configuration from environment
 * @returns {object} MQTT configuration object
 */
function loadMqttConfig() {
  validateRequiredEnvVars(['MQTT_BROKER_URL']);
  
  return {
    brokerUrl: process.env.MQTT_BROKER_URL,
    clientId: process.env.MQTT_CLIENT_ID || `auralink-backend-${Math.random().toString(16).slice(2, 8)}`,
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
    topics: {
      temperature: process.env.MQTT_TOPIC_TEMPERATURE || 'auralink/sensors/temperature',
      humidity: process.env.MQTT_TOPIC_HUMIDITY || 'auralink/sensors/humidity',
      quote: process.env.MQTT_TOPIC_QUOTE || 'auralink/display/quote',
      email: process.env.MQTT_TOPIC_EMAIL || 'auralink/display/email',
      priority: process.env.MQTT_TOPIC_PRIORITY || 'auralink/display/priority'
    }
  };
}

/**
 * Load OpenAI configuration from environment
 * @returns {object} OpenAI configuration object
 */
function loadOpenAiConfig() {
  validateRequiredEnvVars(['OPENAI_API_KEY']);
  
  return {
    apiKey: process.env.OPENAI_API_KEY
  };
}

/**
 * Load Gmail API configuration from environment
 * @returns {object} Gmail API configuration object
 */
function loadGmailConfig() {
  validateRequiredEnvVars([
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REDIRECT_URI'
  ]);
  
  return {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    redirectUri: process.env.GMAIL_REDIRECT_URI,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN || ''
  };
}

/**
 * Load server configuration from environment
 * @returns {object} Server configuration object
 */
function loadServerConfig() {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    dataFilePath: process.env.DATA_FILE_PATH || './data/sensorData.json'
  };
}

/**
 * Load all configuration
 * @returns {object} Complete configuration object
 */
function loadConfig() {
  try {
    const config = {
      mqtt: loadMqttConfig(),
      openai: loadOpenAiConfig(),
      gmail: loadGmailConfig(),
      server: loadServerConfig(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    logger.info('Configuration loaded successfully');
    return config;
  } catch (error) {
    logger.error('Failed to load configuration:', error);
    throw error;
  }
}

export {
  loadConfig,
  validateRequiredEnvVars
};