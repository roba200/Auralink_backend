/**
 * Email Handler Module
 * 
 * Manages Gmail API integration:
 * - OAuth2 authentication
 * - Fetching unread emails
 * - Email data processing
 */

import { google } from 'googleapis';
import logger from '../utils/logger.js';

class EmailHandler {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.refreshToken = config.refreshToken;
    this.oauth2Client = null;
    
    // Initialize OAuth2 client
    this._initializeOAuth();
  }
  
  /**
   * Initialize the OAuth2 client with credentials
   * @private
   */
  _initializeOAuth() {
    this.oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );
    
    if (this.refreshToken && this.refreshToken.trim() !== '') {
      this.oauth2Client.setCredentials({
        refresh_token: this.refreshToken
      });
      logger.debug('OAuth2 client initialized with refresh token');
    } else {
      logger.warn('OAuth2 client initialized without refresh token - email features will be disabled');
    }
  }
  
  /**
   * Check if email functionality is available (has valid refresh token)
   * @returns {boolean} True if email features are available
   */
  isEmailEnabled() {
    return this.refreshToken && this.refreshToken.trim() !== '';
  }
  
  /**
   * Generate an authorization URL for initial OAuth setup
   * @returns {string} The OAuth authorization URL
   */
  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly'
    ];
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }
  
  /**
   * Exchange the auth code for tokens after OAuth authorization
   * @param {string} code - The authorization code from OAuth callback
   * @returns {Promise<object>} The OAuth tokens
   */
  async getTokensFromCode(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      logger.info('Successfully retrieved OAuth tokens');
      return tokens;
    } catch (error) {
      logger.error('Error exchanging code for tokens:', error);
      throw error;
    }
  }
  
  /**
   * Fetch the last N unread emails from the inbox
   * @param {number} maxResults - Maximum number of emails to fetch (default: 5)
   * @returns {Promise<Array>} Array of email objects
   */
  async fetchUnreadEmails(maxResults = 5) {
    // Skip if email functionality is not configured
    if (!this.isEmailEnabled()) {
      logger.warn('Email fetch skipped - no valid refresh token configured');
      return [];
    }
    
    try {
      // Create Gmail API client
      const gmail = google.gmail({version: 'v1', auth: this.oauth2Client});
      
      // Search for unread messages
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread',
        maxResults: maxResults
      });
      
      if (!res.data.messages || res.data.messages.length === 0) {
        logger.info('No unread emails found');
        return [];
      }
      
      // Get details for each message
      const emails = await Promise.all(
        res.data.messages.map(async (message) => {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'Date']
          });
          
          // Extract headers
          const headers = msg.data.payload.headers;
          const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
          const from = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
          const date = headers.find(h => h.name === 'Date')?.value;
          
          return {
            id: message.id,
            threadId: message.threadId,
            subject,
            from,
            date,
            snippet: msg.data.snippet || '',
            labelIds: msg.data.labelIds || []
          };
        })
      );
      
      logger.info(`Fetched ${emails.length} unread emails`);
      return emails;
      
    } catch (error) {
      logger.error('Error fetching emails:', error);
      
      // Handle specific error cases
      if (error.message && error.message.includes('invalid_grant')) {
        logger.warn('OAuth invalid_grant error - refresh token may be invalid or revoked');
        logger.info('To fix: Visit the auth URL to get a new refresh token: ' + this.getAuthUrl());
        return []; // Return empty array instead of throwing to keep app running
      }
      
      if (error.code === 401 || (error.response && error.response.status === 401)) {
        logger.warn('Authentication error (401) - token may be expired');
        return []; // Return empty array instead of throwing to keep app running
      }
      
      // For other errors, return empty array to keep the app running
      return [];
    }
  }
  
  /**
   * Refresh the OAuth access token
   * @returns {Promise<boolean>} True if token refresh was successful
   */
  async refreshAccessToken() {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      logger.info('Successfully refreshed access token');
      return true;
    } catch (error) {
      logger.error('Error refreshing access token:', error);
      return false;
    }
  }
}

export default EmailHandler;