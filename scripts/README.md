# Google OAuth Setup for AuraLink Backend

This folder contains scripts to help you set up Google OAuth authentication for Gmail access.

## Getting a Valid Gmail Refresh Token

Follow these steps to get a proper Gmail refresh token:

1. **Run the OAuth token script**:
   ```
   node scripts/get-oauth-token.js
   ```

2. **Open the provided URL** in your browser. It will look something like:
   ```
   https://accounts.google.com/o/oauth2/v2/auth?...
   ```

3. **Log in with your Google account** and authorize the requested permissions.

4. **Wait for the callback** to be processed. The script will automatically:
   - Receive the authorization code
   - Exchange it for a refresh token
   - Update your `.env` file with the new token
   - Show a success message

5. **Restart your application**:
   ```
   npm start
   ```

## Troubleshooting

### If you don't see a refresh token

If you authorize successfully but don't get a refresh token, it's likely because:

1. You've already authorized this application with the same Google account
2. Your OAuth configuration isn't requesting offline access correctly

Solutions:
- Try a different Google account
- Revoke access for this application in your [Google Account Permissions](https://myaccount.google.com/permissions)
- Make sure the OAuth flow includes `access_type=offline` and `prompt=consent` parameters

### Invalid Client ID

If you get "invalid_client" errors, your OAuth client ID or secret may be incorrect or the application may not be properly configured in the Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to your project
3. Go to "APIs & Services" > "Credentials"
4. Edit your OAuth client
5. Make sure "http://localhost:3000/auth/google/callback" is added as an authorized redirect URI
6. Update your client ID and secret in the `.env` file

## Google Cloud Console Setup

If you need to create a new OAuth client:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Library"
4. Search for and enable the "Gmail API"
5. Go to "APIs & Services" > "Credentials"
6. Click "Create Credentials" and select "OAuth client ID"
7. Configure the OAuth consent screen (external or internal)
8. For application type, choose "Web application"
9. Add "http://localhost:3000/auth/google/callback" as an authorized redirect URI
10. Copy the client ID and client secret to your `.env` file