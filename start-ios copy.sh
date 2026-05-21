#!/bin/bash
# Start the Rise by Solis app on iOS Simulator
cd "$(dirname "$0")"
echo "Starting Expo for iOS..."
npx expo start --ios
