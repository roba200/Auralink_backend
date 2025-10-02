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
import fs from 'fs';

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
  // Check for Vercel environment
  const isVercel = process.env.VERCEL === '1';
  
  // Log environment information
  logger.info(`Running in ${process.env.NODE_ENV || 'development'} mode`);
  if (isVercel) {
    logger.info('Detected Vercel environment');
  }
  
  config = loadConfig();
} catch (error) {
  logger.error('Failed to initialize due to configuration error:', error);
  
  // In production, continue even with config errors to allow health checks
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Continuing with default configuration in production');
    config = {
      mqtt: {
        brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883',
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
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY || ''
      },
      gmail: {
        clientId: process.env.GMAIL_CLIENT_ID || '',
        clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
        redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
        refreshToken: process.env.GMAIL_REFRESH_TOKEN || ''
      },
      server: {
        port: parseInt(process.env.PORT || '3000', 10),
        dataFilePath: process.env.DATA_FILE_PATH || './data/sensorData.json'
      }
    };
  } else {
    process.exit(1);
  }
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

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport Google strategy
passport.use(new GoogleStrategy({
  clientID: config.gmail.clientId,
  clientSecret: config.gmail.clientSecret,
  callbackURL: config.gmail.redirectUri,
  passReqToCallback: true
}, (req, accessToken, refreshToken, profile, done) => {
  try {
    // Store tokens and return user profile
    const user = {
      id: profile.id,
      email: profile.emails ? profile.emails[0].value : 'unknown@example.com',
      name: profile.displayName || 'Unknown User',
      accessToken,
      refreshToken
    };
    
    // Log successful authentication
    logger.info(`User authenticated: ${user.email}`);
    
    // In a production app, store these tokens securely
    if (refreshToken) {
      logger.info('Obtained new refresh token - save this to your .env file');
      console.log('\n============= GMAIL REFRESH TOKEN =============');
      console.log(`GMAIL_REFRESH_TOKEN=${refreshToken}`);
      console.log('==============================================\n');
      
      // Update .env file with the new refresh token
      try {
        let envPath = path.join(__dirname, '.env');
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(
          /^GMAIL_REFRESH_TOKEN=.*$/m,
          `GMAIL_REFRESH_TOKEN=${refreshToken}`
        );
        fs.writeFileSync(envPath, envContent, 'utf8');
        logger.info('Successfully updated .env file with new refresh token');
      } catch (fileError) {
        logger.warn('Could not automatically update .env file:', fileError.message);
        logger.warn('Please manually update your .env file with the refresh token shown above');
      }
    } else {
      logger.warn('No refresh token received. Your app may not have offline access or consent prompt settings.');
      logger.warn('Try using the OAuth token generator script: node scripts/get-oauth-token.js');
    }
    
    return done(null, user);
  } catch (error) {
    logger.error('Error in OAuth callback:', error);
    return done(error);
  }
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
    
    // First publish the quote immediately to ensure it reaches the display
    await mqttHandler.publish(config.mqtt.topics.quote, quote);
    logger.info('Published motivational quote');
    
    // Email handling in a separate try-catch to prevent complete function failure
    let emails = [];
    let emailSummary = 'No email data available';
    let priority = 'normal';
    
    try {
      // Check if email functionality is configured
      if (emailHandler.isEmailEnabled()) {
        // Fetch unread emails
        emails = await emailHandler.fetchUnreadEmails(5);
        
        // Summarize emails if any are found
        if (emails.length > 0) {
          emailSummary = await llmHandler.summarizeEmails(emails);
        } else {
          emailSummary = 'No unread emails';
        }
        
        // Determine priority level
        priority = await llmHandler.determinePriority(
          {
            temperature: latestSensorData.temperature,
            humidity: latestSensorData.humidity
          },
          emails
        );
      } else {
        logger.info('Email processing skipped - not configured');
      }
    } catch (emailError) {
      logger.error('Error processing email data:', emailError);
      emailSummary = 'Email processing error';
      // Continue processing - don't let email errors stop everything
    }
    
    // Publish email and priority results
    await mqttHandler.publish(config.mqtt.topics.email, emailSummary);
    await mqttHandler.publish(config.mqtt.topics.priority, priority);
    
    logger.info('Successfully processed sensor data and published results');
    
  } catch (error) {
    logger.error('Error in processSensorData:', error);
    
    // Try to publish an error message via MQTT so the display shows something
    try {
      await mqttHandler.publish(config.mqtt.topics.quote, 'System error: Please check server logs');
    } catch (mqttError) {
      logger.error('Failed to publish error message:', mqttError);
    }
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
    
    // Add API health check endpoints
    app.get('/', (req, res) => {
      res.status(200).send('AuraLink Backend is running!');
    });
    
    app.get('/test-client', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'test-client.html'));
    });
    
    app.get('/api/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        mqtt: mqttHandler.isConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      });
    });
    
    app.get('/api/status', (req, res) => {
      res.status(200).json({
        latestSensorData,
        mqttConnected: mqttHandler.isConnected,
        gmailConnected: !!config.gmail.refreshToken,
        openAiConfigured: !!config.openai.apiKey && config.openai.apiKey !== 'your-openai-api-key'
      });
    });
    
    // Start Express server for OAuth handling
    app.listen(config.server.port, () => {
      logger.info(`Server running on port ${config.server.port}`);
      
      // Check Gmail configuration and log appropriate information
      if (!config.gmail.refreshToken || config.gmail.refreshToken.trim() === '') {
        logger.warn('No Gmail refresh token found or invalid token provided.');
        logger.warn('Email functionality will be disabled.');
        logger.warn('To enable email functionality, authenticate using the URL below:');
        console.log('\n============= GMAIL AUTHENTICATION =============');
        console.log(`Auth URL: ${emailHandler.getAuthUrl()}`);
        console.log('After authenticating, copy the displayed refresh token');
        console.log('and add it to the GMAIL_REFRESH_TOKEN variable in your .env file.');
        console.log('=================================================\n');
      } else {
        logger.info('Gmail refresh token configured - email functionality is enabled');
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