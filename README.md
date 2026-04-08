# Voice AR Object Placer

A WebXR augmented reality app that lets you place 3D objects in the real world using voice commands. Point your camera at a surface, tap the mic, and say "red cube" or "blue sphere" to place objects that persist as you move around.

## Features

- **Surface Detection** - Automatically detects flat surfaces (tables, floors, walls)
- **Voice Commands** - Place objects by speaking color + shape combinations
- **Persistent Objects** - Placed objects stay anchored in world space
- **Real-time Feedback** - Visual reticle shows where objects will be placed

## Supported Voice Commands

Speak a combination of **color** + **shape**:

| Colors | Shapes |
|--------|--------|
| red | cube |
| blue | sphere |
| green | cylinder |
| yellow | cone |
| orange | |
| purple | |
| white | |
| black | |
| pink | |
| cyan | |

**Examples:**
- "red cube"
- "blue sphere"
- "green cylinder"
- "yellow cone"

## Requirements

### Device Requirements
- **Android phone** with ARCore support (most phones from 2018+)
- **Chrome browser** version 81 or later
- **Google Play Services for AR** installed

### Network Requirements
- Must be served over **HTTPS** (or localhost for development)
- Same WiFi network for local development testing

### Not Supported
- iOS Safari (Apple has not implemented WebXR AR)
- Desktop browsers
- Non-Chrome mobile browsers

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm start
```

This starts a development server with HTTPS enabled at:
- Local: `https://localhost:8084/`
- Network: `https://<your-ip>:8084/`

### Production Build

```bash
npm run build
```

Output is generated in the `dist/` folder.

## Testing on Android

1. **Start the dev server** on your computer:
   ```bash
   npm start
   ```

2. **Get the network URL** from the terminal output (e.g., `https://192.168.x.x:8084/`)

3. **On your Android phone:**
   - Open Chrome browser
   - Navigate to the HTTPS URL
   - Accept the security warning (tap "Advanced" → "Proceed")
   - Allow camera and microphone permissions
   - Tap "Start AR"

4. **Using the app:**
   - Point camera at a flat surface
   - Wait for the green reticle to appear
   - Tap the mic button
   - Say a command like "red cube"
   - The object appears on the surface!

## Tech Stack

- **Three.js** (r152) - 3D rendering
- **WebXR Device API** - AR session and hit-testing
- **Web Speech API** - Voice recognition
- **Webpack 5** - Bundling and dev server

## Project Structure

```
web-xr/
├── src/
│   ├── index.html    # Main HTML with UI overlay
│   ├── index.js      # App logic (WebXR, speech, 3D)
│   └── style.css     # UI styling
├── webpack.config.js # Build configuration
└── package.json      # Dependencies
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Input                           │
│  ┌─────────────┐                    ┌──────────────┐   │
│  │  Mic Button │                    │ Camera Feed  │   │
│  └──────┬──────┘                    └──────┬───────┘   │
│         │                                  │           │
│         ▼                                  ▼           │
│  ┌─────────────┐                    ┌──────────────┐   │
│  │ Web Speech  │                    │   WebXR      │   │
│  │    API      │                    │  Hit Test    │   │
│  └──────┬──────┘                    └──────┬───────┘   │
│         │                                  │           │
│         ▼                                  ▼           │
│  ┌─────────────┐                    ┌──────────────┐   │
│  │  Command    │                    │   Reticle    │   │
│  │   Parser    │                    │  Placement   │   │
│  └──────┬──────┘                    └──────────────┘   │
│         │                                              │
│         ▼                                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Three.js Scene                      │   │
│  │         (3D objects + AR overlay)                │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "WebXR API not available" | Use Chrome browser on Android |
| "Immersive AR not supported" | Install Google Play Services for AR from Play Store |
| "Page must be loaded over HTTPS" | Use the `https://` URL, not `http://` |
| Security certificate warning | Tap "Advanced" → "Proceed" (safe for local dev) |
| No reticle appearing | Point camera at a well-lit flat surface |
| Voice not recognized | Speak clearly, try "red cube" or "blue sphere" |
| iOS not working | WebXR AR is not supported on iOS Safari |

## License

ISC
