#!/bin/bash
cd "$(dirname "$0")"

echo "Starting Prestige Door Estimator..."
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo "Install the LTS version from https://nodejs.org/ and then double-click this file again."
  echo ""
  read -p "Press Enter to close..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "First run: installing required packages. This can take a minute..."
  npm install
  if [ $? -ne 0 ]; then
    echo "npm install failed."
    read -p "Press Enter to close..."
    exit 1
  fi
fi

echo "Building the latest app..."
npm run build
if [ $? -ne 0 ]; then
  echo "App build failed."
  read -p "Press Enter to close..."
  exit 1
fi

URL="http://localhost:5174"
echo "Opening $URL"
(open "$URL" >/dev/null 2>&1 || true)
echo ""
echo "Estimator is running. Keep this window open while using it."
echo "To stop the app, close this window or press Control+C."
echo ""
npm start
