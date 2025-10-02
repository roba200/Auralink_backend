/**
 * Gmail OAuth Token Generator Script
 * 
 * This script helps you generate a valid OAuth refresh token for Gmail API access.
 * It sets up a temporary server to handle the OAuth callback and extracts the token.
 */

import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get configuration from environment or use defaults
const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
const port = process.env.PORT || 3000;
const redirectUri = `http://localhost:${port}/auth/google/callback`;
const envFilePath = path.join(__dirname, '..', '.env');

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  clientId,
  clientSecret,
  redirectUri
);

// Generate auth URL
const scopes = [
  'https://www.googleapis.com/auth/gmail.readonly'
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  // Force to always get a refresh token
  prompt: 'consent'
});

console.log('\n===== Gmail OAuth Token Generator =====');
console.log('\nStep 1: Open the following URL in your browser:');
console.log('\n' + authUrl);
console.log('\nStep 2: Log in with your Google account and authorize the application');
console.log('\nStep 3: You will be redirected to a page showing the refresh token');
console.log('\nWaiting for authorization...');

// Create a simple server to handle the OAuth callback
const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname || '';
    
    // Handle OAuth callback
    if (pathname === '/auth/google/callback') {
      const code = parsedUrl.query.code;
      
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Error: No authorization code received</h1>');
        return;
      }
      
      try {
        // Exchange authorization code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        const refreshToken = tokens.refresh_token;
        
        if (!refreshToken) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <h1>No refresh token received</h1>
            <p>This can happen if your Google account has already authorized this application.</p>
            <p>Try again with a different Google account or revoke access for this application in your <a href="https://myaccount.google.com/permissions" target="_blank">Google Account Permissions</a>.</p>
          `);
          return;
        }
        
        // Update .env file with the new refresh token
        try {
          let envContent = fs.readFileSync(envFilePath, 'utf8');
          envContent = envContent.replace(
            /^GMAIL_REFRESH_TOKEN=.*$/m,
            `GMAIL_REFRESH_TOKEN=${refreshToken}`
          );
          fs.writeFileSync(envFilePath, envContent, 'utf8');
          
          console.log('\n✅ Successfully obtained refresh token and updated .env file!');
        } catch (fileError) {
          console.error('\n⚠️ Error updating .env file:', fileError);
          console.log('\nManually add this to your .env file:');
          console.log(`GMAIL_REFRESH_TOKEN=${refreshToken}`);
        }
        
        // Respond to the user
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <h1>Authentication Successful!</h1>
          <p>Your refresh token has been saved to the .env file.</p>
          <p>You can close this window and restart your application.</p>
          <script>
            setTimeout(() => {
              window.close();
            }, 5000);
          </script>
        `);
        
        // Close the server after a delay
        setTimeout(() => {
          server.close(() => {
            console.log('\nToken server closed. You can now restart your main application.');
            process.exit(0);
          });
        }, 2000);
        
      } catch (tokenError) {
        console.error('\n⚠️ Error exchanging code for tokens:', tokenError);
        
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`
          <h1>Authentication Error</h1>
          <p>Failed to exchange authorization code for tokens.</p>
          <pre>${tokenError.toString()}</pre>
        `);
      }
    } else {
      // Handle other routes
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  } catch (error) {
    console.error('\n⚠️ Server error:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error');
  }
});

// Start the server
server.listen(port, () => {
  console.log(`\nOAuth callback server listening on port ${port}`);
});