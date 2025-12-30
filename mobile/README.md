# SillyTavern Mobile

A React Native Expo mobile app that displays SillyTavern in a WebView.

## Prerequisites

- Node.js (>= 18)
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- For Android: Android Studio with Android SDK
- For iOS: Xcode (macOS only)

## Installation

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the App

### Development

Start the Expo development server:
```bash
npm start
```

### Android

Run on Android device/emulator:
```bash
npm run android
```

### iOS

Run on iOS simulator (macOS only):
```bash
npm run ios
```

### Web

Run in web browser:
```bash
npm run web
```

## Configuration

The WebView connects to `http://localhost:6080` by default. You can change this in `App.js`:

```javascript
const webViewUrl = 'http://localhost:6080';
```

## Features

- Full-screen WebView on Android
- Status bar hidden on Android
- JavaScript and DOM storage enabled
- Loading state while page loads
- Origin whitelist for all domains

## Notes

- Make sure the SillyTavern server is running on port 6080 before launching the mobile app
- For Android, the app is configured with `softwareKeyboardLayoutMode: "pan"` to handle keyboard input properly
- The status bar is automatically hidden on Android for a fullscreen experience
