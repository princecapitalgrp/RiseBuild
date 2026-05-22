#!/bin/bash
# sync-test: 2026-05-22T12:01 — remove this line after verifying sync

# Ensure the generated directory exists
mkdir -p ios/build/generated/ios

# Run the xcodebuild command
xcodebuild -workspace ios/risebysolis.xcworkspace -scheme risebysolis -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Pro Max' -derivedDataPath ios/build
