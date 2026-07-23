@echo off
cd /d "%~dp0"
echo Starting Prestige Door Estimator...
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install the LTS version from https://nodejs.org/ and then double-click this file again.
  echo.
  pause
  exit /b 1
)
if not exist node_modules (
  echo First run: installing required packages. This can take a minute...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)
echo Building the latest app...
call npm run build
if errorlevel 1 (
  echo App build failed.
  pause
  exit /b 1
)
echo Opening http://localhost:5174
start "" "http://localhost:5174"
echo.
echo Estimator is running. Keep this window open while using it.
echo To stop the app, close this window or press Ctrl+C.
echo.
call npm start
pause
