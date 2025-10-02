/**
 * Data Storage Utility
 * 
 * Handles persistent storage of sensor data to:
 * - Store readings in JSON format
 * - Provide data access methods
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import logger from './logger.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DataStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.db = null;
    this._initialize();
  }

  /**
   * Initialize the database
   * @private
   */
  async _initialize() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Create default data
      const defaultData = {
        readings: [],
        lastUpdated: new Date().toISOString()
      };
      
      // Create file if it doesn't exist
      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, JSON.stringify(defaultData));
      }

      // Initialize LowDB with default data
      const adapter = new JSONFile(this.filePath);
      this.db = new Low(adapter, defaultData);
      
      // Read initial data
      await this.db.read();
      
      logger.info(`Data store initialized with file: ${this.filePath}`);
    } catch (error) {
      logger.error('Failed to initialize data store:', error);
      throw error;
    }
  }

  /**
   * Store a new sensor reading
   * @param {object} reading - The sensor reading to store
   * @returns {Promise<void>}
   */
  async storeSensorReading(reading) {
    try {
      if (!this.db) {
        await this._initialize();
      }
      
      // Add timestamp if not present
      if (!reading.timestamp) {
        reading.timestamp = new Date().toISOString();
      }
      
      // Add reading to database
      this.db.data.readings.push(reading);
      this.db.data.lastUpdated = new Date().toISOString();
      
      // Limit the array size to avoid excessive growth
      if (this.db.data.readings.length > 1000) {
        this.db.data.readings = this.db.data.readings.slice(-1000);
      }
      
      // Write to file
      await this.db.write();
      
      logger.debug('Stored new sensor reading:', reading);
    } catch (error) {
      logger.error('Failed to store sensor reading:', error);
      throw error;
    }
  }

  /**
   * Get the latest sensor readings
   * @param {number} count - Number of readings to return
   * @returns {Promise<Array>} Array of recent readings
   */
  async getLatestReadings(count = 1) {
    try {
      if (!this.db) {
        await this._initialize();
      }
      
      const readings = this.db.data.readings;
      return readings.slice(-count);
    } catch (error) {
      logger.error('Failed to get latest readings:', error);
      throw error;
    }
  }

  /**
   * Get the latest reading for a specific sensor type
   * @param {string} sensorType - The type of sensor (e.g., 'temperature', 'humidity')
   * @returns {Promise<object>} The latest reading or null if none found
   */
  async getLatestReadingByType(sensorType) {
    try {
      if (!this.db) {
        await this._initialize();
      }
      
      const readings = this.db.data.readings;
      
      // Find the latest reading of the specified type
      for (let i = readings.length - 1; i >= 0; i--) {
        if (readings[i].type === sensorType) {
          return readings[i];
        }
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to get latest ${sensorType} reading:`, error);
      throw error;
    }
  }

  /**
   * Get readings within a specific time range
   * @param {Date} startTime - Start of time range
   * @param {Date} endTime - End of time range
   * @returns {Promise<Array>} Array of readings within the range
   */
  async getReadingsInTimeRange(startTime, endTime) {
    try {
      if (!this.db) {
        await this._initialize();
      }
      
      const startISO = new Date(startTime).toISOString();
      const endISO = new Date(endTime).toISOString();
      
      return this.db.data.readings.filter(reading => {
        return reading.timestamp >= startISO && reading.timestamp <= endISO;
      });
    } catch (error) {
      logger.error('Failed to get readings in time range:', error);
      throw error;
    }
  }
}

// Create singleton instance
const dataStore = new DataStore(process.env.DATA_FILE_PATH || path.join(__dirname, '../data/sensorData.json'));

export default dataStore;