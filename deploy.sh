#!/bin/bash
echo "Starting deployment process..."
echo "0. Building the application..."
npm run build
echo "1. Checking login status..."
# npx firebase login
echo "2. Deploying to production..."
npx firebase deploy --project bel-air-habitat
echo "Done! Your site should be live."
