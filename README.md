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

## Gmail OAuth2 Setup

If no refresh token is specified in the `.env` file, the application will output an authentication URL on startup. Open this URL in a browser to authenticate with Gmail and obtain a refresh token.

## License

ISC

## Author

[Your Name]