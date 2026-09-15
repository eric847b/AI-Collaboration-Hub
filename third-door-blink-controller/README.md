# Third Door — Blink Controller

An Expo React Native app that uses camera-based blink detection to control an
evolving visual generator. Tap to blink, double-tap to evolve, long-press to
mutate. Visual feedback is rendered in real-time via `react-native-reanimated`
and `react-native-svg`.

## Quick Start

```bash
# Fast installation with Bun (recommended)
bun install

# Or use npm (slower but more stable)
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

## Features

- **Camera-based blink detection** — uses `expo-camera` for the camera feed
- **Three interaction gestures** — tap (single blink), double-tap (evolve), long-press (mutate)
- **Animated SVG generator** — `react-native-svg` + `react-native-reanimated` visual feedback
- **Multi-platform** — web, iOS, and Android via Expo
- **Dark theme** — `tamagui` + `@blinkdotnew/mobile-ui` for consistent dark-mode UI
- **State indicator** — status dot shows dormant (red), active (green), or mutating (amber)

## Available Commands

### Development
- `npm run dev` - Start development server for web on port 3000
- `npm run start` - Start development server (shows QR code for mobile)
- `npm run start:web` - Start web development server
- `npm run start:ios` - Start iOS development server
- `npm run start:android` - Start Android development server

### Building
- `npm run build:web` - Build for web production
- `npm run build:ios` - Build for iOS
- `npm run build:android` - Build for Android

### Quality
- `npm run lint` - Run ESLint (via Expo CLI)
- `npm run typecheck` - Run TypeScript compiler to check for type errors

### Package Management (Bun - Fast)
- `bun install` - Install dependencies (fastest)
- `npm run install:fast` - Install with Bun, skip postinstall (very fast)
- `npm run add <package>` - Add package with Bun

### Package Management (npm - Stable)
- `npm install` - Install dependencies (slower but stable)
- `npm run setup` - Run Expo install for native linking

### Utilities
- `npm run doctor` - Check project setup and dependencies
- `npm run upgrade` - Upgrade Expo SDK and dependencies
- `npm run prebuild:clean` - Clean prebuild for native changes

## Project Structure

```
├── app/                   # Expo Router pages (index, _layout, +not-found)
├── components/            # Reusable components (Generator visual)
├── constants/             # Shared constants (animations, platform)
├── hooks/                 # Custom hooks (useFrameworkReady)
├── assets/                # Images, icons, splash screens
├── public/                # Static web assets (_redirects)
├── eas.json               # EAS build configuration
├── app.json               # Expo configuration
├── tsconfig.json          # TypeScript configuration (strict mode)
├── babel.config.js        # Babel config (expo preset + worklets)
└── package.json           # Dependencies and scripts
```

## CI / Quality Gate

- `node-matrix.yml` runs lint, typecheck, and build on Node 24 + 26
- `lockfile-validation.yml` verifies lockfiles for all Node projects
- `multi-os-gate.yml` runs the workspace gate on Windows + Linux

## Architecture Notes

- `@/` path alias maps to the project root
- Expo Router with typed routes enabled (`typedRoutes: true`)
- `react-native-reanimated` worklets plugin configured for animations
- `expo-blur` used for frosted-glass UI overlays
- The `Generator` component renders an animated SVG circuit that responds to
  the system state (`dormant` | `active` | `mutating`) and evolution level (0-3)

## Notes for AI Agents

- **Fast setup**: Use `bun install` then `npm run dev`
- **Stable setup**: Use `npm install` then `npm run dev`
- Use `npm run doctor` to diagnose issues
- Use `npm run setup` instead of `npm run install` for Expo packages
- The project uses Expo Router for navigation
- Web version runs on port 3000 by default
- Bun is 2-10x faster than npm for package installation
- `npm run typecheck` verifies TypeScript compilation without emitting