/**
 * AuraLink Backend - Main Server
 * 
 * Integrates:
 * - MQTT communication with ESP32 sensors
 * - OpenAI for generating literature-style motivational quotes
 * - Gmail API for fetching and summarizing emails
 * 
 * Provides a complete IoT backend solution for the AuraLink project
 */

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Import required modules
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import handlers and utilities
import MqttHandler from './handlers/mqttHandler.js';
import LlmHandler from './handlers/llmHandler.js';
import EmailHandler from './handlers/emailHandler.js';
import logger from './utils/logger.js';
import dataStore from './utils/dataStore.js';
import { loadConfig } from './utils/configLoader.js';

// Global variables for sensor data
let latestSensorData = {
  temperature: null,
  humidity: null,
  timestamp: null
};

// Load configuration
let config;
try {
  config = loadConfig();
} catch (error) {
  logger.error('Failed to initialize due to configuration error:', error);
  process.exit(1);
}

// Initialize handlers
const mqttHandler = new MqttHandler(config.mqtt);
const llmHandler = new LlmHandler(config.openai.apiKey);
const emailHandler = new EmailHandler(config.gmail);

// Initialize Express app for OAuth2 callback handling
const app = express();

// Configure session
app.use(session({
  secret: 'auralink-secret',
  resave: false,
  saveUninitialized: true
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport Google strategy
passport.use(new GoogleStrategy({
  clientID: config.gmail.clientId,
  clientSecret: config.gmail.clientSecret,
  callbackURL: config.gmail.redirectUri
}, (accessToken, refreshToken, profile, done) => {
  // Store tokens and return user profile
  const user = {
    id: profile.id,
    email: profile.emails[0].value,
    name: profile.displayName,
    accessToken,
    refreshToken
  };
  
  // Log successful authentication
  logger.info(`User authenticated: ${user.email}`);
  
  // In a production app, store these tokens securely
  if (refreshToken) {
    logger.info('Obtained new refresh token - save this to your .env file');
    console.log(`GMAIL_REFRESH_TOKEN=${refreshToken}`);
  }
  
  return done(null, user);
}));

// Passport session serialization
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

/**
 * MQTT sensor data handler
 * @param {string} topic - MQTT topic
 * @param {string} message - Message content
 */
async function handleSensorData(topic, message) {
  try {
    // Parse message - handle both object and plain value formats
    let sensorValue;
    let data;
    
    try {
      // Try to parse as JSON object
      data = JSON.parse(message);
      sensorValue = data.value !== undefined ? data.value : parseFloat(message);
    } catch (err) {
      // If parsing fails, treat as plain value
      sensorValue = parseFloat(message);
      data = { value: sensorValue };
    }
    
    const topicParts = topic.split('/');
    const sensorType = topicParts[topicParts.length - 1]; // last segment of topic
    
    // Add timestamp and type
    const reading = {
      value: sensorValue,
      type: sensorType,
      timestamp: new Date().toISOString(),
      ...data
    };
    
    // Store reading
    await dataStore.storeSensorReading(reading);
    
    // Update latest sensor data
    if (sensorType === 'temperature') {
      latestSensorData.temperature = sensorValue;
      latestSensorData.timestamp = reading.timestamp;
    } else if (sensorType === 'humidity') {
      latestSensorData.humidity = sensorValue;
      latestSensorData.timestamp = reading.timestamp;
    }
    
    // Log reading
    logger.info(`Received ${sensorType} reading: ${sensorValue}`);
    
    // Process sensor data
    await processSensorData();
    
  } catch (error) {
    logger.error('Error processing sensor data:', error);
  }
}

/**
 * Process sensor data, generate quote, and fetch emails
 */
async function processSensorData() {
  // Only proceed if we have both temperature and humidity readings
  if (latestSensorData.temperature === null || latestSensorData.humidity === null) {
    return;
  }
  
  try {
    // Generate motivational quote based on conditions
    const quote = await llmHandler.generateQuote({
      temperature: latestSensorData.temperature,
      humidity: latestSensorData.humidity
    });
    
    // Fetch unread emails
    const emails = await emailHandler.fetchUnreadEmails(5);
    
    // Summarize emails if any are found
    const emailSummary = await llmHandler.summarizeEmails(emails);
    
    // Determine priority level
    const priority = await llmHandler.determinePriority(
      {
        temperature: latestSensorData.temperature,
        humidity: latestSensorData.humidity
      },
      emails
    );
    
    // Publish results back to MQTT topics
    await mqttHandler.publish(config.mqtt.topics.quote, quote);
    await mqttHandler.publish(config.mqtt.topics.email, emailSummary);
    await mqttHandler.publish(config.mqtt.topics.priority, priority);
    
    logger.info('Successfully processed sensor data and published results');
    
  } catch (error) {
    logger.error('Error in processSensorData:', error);
  }
}

/**
 * Initialize the application
 */
async function initialize() {
  try {
    // Connect to MQTT broker
    await mqttHandler.connect();
    
    // Subscribe to sensor topics
    await mqttHandler.subscribe(config.mqtt.topics.temperature, handleSensorData);
    await mqttHandler.subscribe(config.mqtt.topics.humidity, handleSensorData);
    
    logger.info('Subscribed to sensor topics successfully');
    
    // Setup Express routes for OAuth2
    app.get('/auth/google',
      passport.authenticate('google', { 
        scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.readonly'],
        accessType: 'offline',
        prompt: 'consent'
      })
    );
    
    app.get('/auth/google/callback', 
      passport.authenticate('google', { failureRedirect: '/auth/failed' }),
      (req, res) => {
        // Successful authentication
        res.send('Authentication successful! You can close this window.');
      }
    );
    
    app.get('/auth/failed', (req, res) => {
      res.status(401).send('Authentication failed');
    });
    
    // Start Express server for OAuth handling
    app.listen(config.server.port, () => {
      logger.info(`Server running on port ${config.server.port}`);
      
      // If no refresh token is present, log the auth URL
      if (!config.gmail.refreshToken) {
        logger.warn('No Gmail refresh token found. Please authenticate using the URL below:');
        console.log(`Auth URL: ${emailHandler.getAuthUrl()}`);
      }
    });
    
  } catch (error) {
    logger.error('Failed to initialize:', error);
    process.exit(1);
  }
}

// Handle application shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully');
  await mqttHandler.disconnect();
  process.exit(0);
});

// Initialize the application
initialize();