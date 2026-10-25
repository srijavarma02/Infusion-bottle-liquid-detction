# Smart Saline Monitoring System

A Flask-based saline monitoring backend with a React + Vite frontend. It provides live weight tracking, remaining percentage, flow analytics, time remaining prediction, IV blockage detection, CSV logging, and Telegram mobile notifications.

## Features

- ESP32 serial weight monitoring (HX711)
- Real-time dashboard (Flask-SocketIO)
- Remaining % calculation with configurable full bottle weight
- Low-saline alerting with audio + Telegram notifications
- Flow rate analytics + time remaining prediction
- IV blockage detection with alerts
- Drip mode validation (Slow / Normal / Fast)
- CSV data logging every 5 seconds
- Log viewer with download
- Telegram mobile notifications

## Project Structure

```
saline_monitor/
  app.py
  analytics.py
  blockage_detector.py
  flow_monitor.py
  patient_manager.py
  data_logger.py
  telegram_notifier.py
  config.py
  requirements.txt
  index.html
  package.json
  vite.config.js
  src/
    components/
    pages/
    styles/
    App.jsx
    main.jsx
  templates/
    index.html
  logs/
    saline_log.csv
```

## Requirements

- Python 3.9+
- Windows COM port access for ESP32

Install Python dependencies:

```
pip install -r requirements.txt
```

Install frontend dependencies:

```
npm install
```

## Telegram Setup

Edit `saline_monitor/config.py` and add your bot token + chat ID:

```
TELEGRAM_BOT_TOKEN = "YOUR_BOT_TOKEN"
TELEGRAM_CHAT_ID = "YOUR_CHAT_ID"
```

## Running

Frontend development server:

```
npm run dev
```

Production frontend build:

```
npm run build
```

Backend:

```
python app.py
```

By default, the app now starts in web-only mode so it can run without serial or camera hardware attached.

To enable hardware monitoring:

```powershell
$env:ENABLE_SERIAL="1"
$env:ENABLE_CAMERA="1"
python app.py
```

Recommended for your current setup:

```powershell
.\start_backend.ps1
```

Or just double-click:

```text
start_backend.bat
```

This launcher:
- enables serial by default
- uses `COM3` and `115200` by default
- starts the backend from the project folder
- leaves camera disabled unless you set `ENABLE_CAMERA=1`

Open:

```
http://localhost:5000
```

Logs:

```
http://localhost:5000/logs
```

The Flask app serves the built React frontend from `dist/` when it exists. The homepage uses demo data, and the React `/logs` page shows live backend data.

## Serial Configuration

Default port: `COM3`
Default baud: `115200`

Override if needed (PowerShell):

```
$env:SERIAL_PORT="COM5"
$env:BAUD_RATE="115200"
.\start_backend.ps1
```

## Notes

- The system is configured for a single load cell (Bed 1).
- Alerts are rate-limited and reset when conditions clear.
- Telegram notifications fire on low saline, blockage, flow abnormal, and bottle replacement.

## Troubleshooting

- Ensure the ESP32 is connected and sending `Weight: <value> g`.
- Verify COM port in Device Manager.
- If Telegram messages do not arrive, verify bot token and chat ID in `config.py`.

## License

Internal use / academic project.
