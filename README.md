# AuraLink Backend

A Node.js backend for the AuraLink project that integrates MQTT, OpenAI, and Gmail APIs to create a smart home IoT backend.

## Features

- **MQTT Integration**: Connects to an MQTT broker to receive sensor data from ESP32 devices
- **OpenAI Integration**: Generates literature-style motivational quotes based on indoor conditions
- **Gmail API**: Summarizes unread emails for display on IoT devices
- **Priority System**: Determines environment and notification priority (normal/warning/urgent)

## Project Structure

```
AuraLink Backend/
├── config/           # Configuration files
├── data/             # Data storage for sensor readings
├── handlers/         # Module handlers
│   ├── emailHandler.js  # Gmail API integration
│   ├── llmHandler.js    # OpenAI integration
│   └── mqttHandler.js   # MQTT broker communication
├── logs/             # Application logs
├── models/           # Data models
├── utils/            # Utility functions
│   ├── configLoader.js  # Environment configuration
│   ├── dataStore.js     # Data persistence
│   └── logger.js        # Logging functionality
├── .env              # Environment variables (create from .env.example)
├── .env.example      # Example environment file
├── index.js          # Main application entry point
└── package.json      # Project dependencies
```

## Prerequisites

- Node.js v18+ (ES Modules support)
- MQTT broker (e.g., HiveMQ Cloud)
- OpenAI API key
- Gmail API credentials (OAuth2)

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file from the `.env.example`:

```bash
cp .env.example .env
```

4. Update the `.env` file with your credentials:
   - MQTT broker details
   - OpenAI API key
   - Gmail OAuth credentials

## Usage

Start the application:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## MQTT Topics

### Subscribe to (from ESP32):
- `auralink/sensors/temperature`: Temperature readings
- `auralink/sensors/humidity`: Humidity readings

### Publish to (for ESP32 display):
- `auralink/display/quote`: Generated literary quote
- `auralink/display/email`: Email summary
- `auralink/display/priority`: Priority level (normal/warning/urgent)

## Vercel Deployment and Testing

### Environment Variables
When deploying to Vercel, make sure to set up all environment variables from your `.env` file in the Vercel project settings:

1. Go to your Vercel dashboard → Your Project → Settings → Environment Variables
2. Add all the variables from your `.env` file

### Testing Your Deployment

1. **Basic Connectivity Check**:
   - Open `https://your-vercel-app-url.vercel.app/` in a browser
   - You should see "AuraLink Backend is running!"

2. **Health Check Endpoint**:
   - Visit `https://your-vercel-app-url.vercel.app/api/health`
   - You should see a JSON response with status information

3. **Current Status Check**:
   - Visit `https://your-vercel-app-url.vercel.app/api/status`
   - This shows current sensor data and connection statuses

4. **Built-in Test Client**:
   - Visit `https://your-vercel-app-url.vercel.app/test-client`
   - This provides a user-friendly interface to:
     - Connect to your MQTT broker
     - Send simulated sensor data (temperature and humidity)
     - See the generated quotes, email summaries, and priority levels
     - Check the backend status
   - Perfect for testing your deployment without needing ESP32 hardware!

5. **Manual MQTT Connection Testing**:
   - Use an MQTT client like MQTT Explorer or MQTTLens
   - Connect to your MQTT broker (same one configured in the backend)
   - Publish a test message to the temperature topic:
     ```
     Topic: auralink/sensors/temperature
     Message: 22.5
     ```
   - Publish a test message to the humidity topic:
     ```
     Topic: auralink/sensors/humidity  
     Message: 45.2
     ```
   - Subscribe to display topics to see responses:
     ```
     auralink/display/quote
     auralink/display/email
     auralink/display/priority
     ```

## Gmail OAuth2 Setup

If no refresh token is specified in the `.env` file, the application will output an authentication URL on startup. Open this URL in a browser to authenticate with Gmail and obtain a refresh token.

## License

ISC

## Author

[Your Name]