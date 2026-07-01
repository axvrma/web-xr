# VoxAR Studio

An installable WebXR augmented reality studio that lets you place polished 3D objects in the real world using voice commands. Point your camera at a surface, tap the mic, and say "gray elephant", "blue bird", or "gold rocket" to place objects that persist as you move around.

## Features

- **Surface Detection** - Automatically detects flat surfaces (tables, floors, walls)
- **Voice Commands** - Place objects by speaking color + object combinations
- **Richer 3D Library** - Includes primitives, elephant, animated birds, flock, tree, rocket, and crystal
- **PWA Support** - Manifest, install prompt, service worker caching, bundled Three.js, and native safe-area UI
- **Persistent Objects** - Placed objects stay anchored in world space
- **Real-time Feedback** - Visual reticle shows where objects will be placed
- **Scene Controls** - Clear all placed objects from the UI or by saying "clear"

## Supported Voice Commands

Speak a combination of **color** + **object**:

| Colors | Objects |
|--------|---------|
| red | cube |
| blue | sphere |
| green | cylinder |
| yellow | cone |
| orange | elephant |
| purple | bird |
| white | birds / flock |
| black | tree |
| pink | rocket |
| cyan | crystal |
| teal | |
| gold | |
| silver | |
| gray | |

**Examples:**
- "red cube"
- "blue sphere"
- "gray elephant"
- "blue bird"
- "gold rocket"
- "teal crystal"
- "clear"

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

- **Three.js** (r152) - 3D rendering, bundled for PWA reliability
- **WebXR Device API** - AR session and hit-testing
- **Web Speech API** - Voice recognition
- **Webpack 5** - Bundling and dev server
- **Service Worker + Web App Manifest** - Installable app shell and offline cache

## Project Structure

```
web-xr/
├── src/
│   ├── index.html           # Main HTML with UI overlay
│   ├── index.js             # App logic (WebXR, speech, 3D models)
│   ├── style.css            # UI styling
│   └── pwa/                 # Manifest, service worker, icon
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
| Voice not recognized | Speak clearly, try "gray elephant" or "blue bird" |
| iOS not working | WebXR AR is not supported on iOS Safari |

## License

ISC
