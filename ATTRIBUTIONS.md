# Attributions and Credits

**OmniPitch 3D Soccer Experience**

This document provides detailed attribution for all third-party assets, libraries, and resources used in the development of this game.

---

## Table of Contents

1. [Software Libraries](#software-libraries)
2. [3D Models and Assets](#3d-models-and-assets)
3. [Audio Assets](#audio-assets)
4. [Textures and Images](#textures-and-images)
5. [Fonts](#fonts)
6. [Development Tools](#development-tools)
7. [Special Thanks](#special-thanks)

---

## Software Libraries

### Core Framework

#### React

- **Version:** 19.x
- **License:** MIT
- **Copyright:** Meta Platforms, Inc. and affiliates
- **Repository:** https://github.com/facebook/react
- **Usage:** UI framework for game interface

#### React Three Fiber

- **Package:** @react-three/fiber
- **Version:** 9.x
- **License:** MIT
- **Copyright:** Paul Henschel and contributors
- **Repository:** https://github.com/pmndrs/react-three-fiber
- **Usage:** React renderer for Three.js

#### React Three Drei

- **Package:** @react-three/drei
- **Version:** 10.x
- **License:** MIT
- **Copyright:** Paul Henschel and contributors
- **Repository:** https://github.com/pmndrs/drei
- **Usage:** Useful helpers for React Three Fiber

#### Three.js

- **Version:** 0.182.x
- **License:** MIT
- **Copyright:** 2010-2024 Three.js Authors
- **Repository:** https://github.com/mrdoob/three.js
- **Usage:** 3D graphics library

### Networking and Multiplayer

#### Colyseus

- **Version:** 0.16.x
- **License:** MIT
- **Copyright:** Endel Dreyer
- **Repository:** https://github.com/colyseus/colyseus
- **Usage:** Multiplayer game server framework

#### Colyseus Schema

- **Package:** @colyseus/schema
- **Version:** 3.x
- **License:** MIT
- **Copyright:** Endel Dreyer
- **Repository:** https://github.com/colyseus/schema
- **Usage:** Schema-based binary serialization

#### Socket.IO

- **Version:** 4.x
- **License:** MIT
- **Copyright:** Automattic
- **Repository:** https://github.com/socketio/socket.io
- **Usage:** Real-time bidirectional event-based communication

### Physics

#### Rapier

- **Package:** @dimforge/rapier3d-compat
- **Version:** 0.19.x
- **License:** Apache 2.0
- **Copyright:** 2020 Sébastien Crozet
- **Repository:** https://github.com/dimforge/rapier
- **Usage:** 3D physics engine

#### Cannon-es

- **Version:** 0.20.x
- **License:** MIT
- **Copyright:** 2015-2021 Stefan Hedman
- **Repository:** https://github.com/pmndrs/cannon-es
- **Usage:** Physics engine (compatibility)

### State Management

#### Zustand

- **Version:** 5.x
- **License:** MIT
- **Copyright:** 2019 Paul Henschel
- **Repository:** https://github.com/pmndrs/zustand
- **Usage:** State management for React

### Build Tools

#### Vite

- **Version:** 7.x
- **License:** MIT
- **Copyright:** 2019-present, Yuxi (Evan) You and Vite contributors
- **Repository:** https://github.com/vitejs/vite
- **Usage:** Build tool and development server

#### Vite PWA Plugin

- **Package:** vite-plugin-pwa
- **Version:** 1.x
- **License:** MIT
- **Repository:** https://github.com/vite-pwa/vite-plugin-pwa
- **Usage:** Progressive Web App support

### Server Framework

#### Express.js

- **Version:** 5.x
- **License:** MIT
- **Copyright:**
  - 2009-2014 TJ Holowaychuk
  - 2013-2014 Roman Shtylman
  - 2014-2015 Douglas Christopher Wilson
- **Repository:** https://github.com/expressjs/express
- **Usage:** Web server framework

### Testing

#### Vitest

- **Version:** 4.x
- **License:** MIT
- **Copyright:** 2021-Present Vitest Team
- **Repository:** https://github.com/vitest-dev/vitest
- **Usage:** Testing framework

#### Testing Library

- **Packages:** @testing-library/react, @testing-library/jest-dom
- **License:** MIT
- **Repository:** https://github.com/testing-library
- **Usage:** React component testing

---

## 3D Models and Assets

### Character Models

#### Cat Model

- **File:** `/models/cat.glb`
- **Source:** Sketchfab
- **License:** CC-BY (verify specific model)
- **Note:** Please verify the specific license for the cat model used

#### Low Poly Car Model

- **File:** `/models/low_poly_car.glb`
- **Source:** Sketchfab
- **License:** CC-BY (verify specific model)
- **Note:** Please verify the specific license for the car model used

### Game Objects

#### Soccer Ball

- **File:** `/models/soccer_ball.glb`
- **Source:** Sketchfab or similar platform
- **License:** CC-BY or Royalty-Free
- **Note:** Verify specific license

#### Soccer Goal

- **File:** `/models/soccer_goal.glb`
- **Source:** Original or third-party
- **License:** Verify

### Environment Maps

The following map assets are included in the game. **Important:** Map names referencing popular franchises (Minecraft, Gravity Falls, etc.) are used for descriptive purposes only.

#### Maps in `/public/maps_1/`

| File                         | Descriptive Name | Source      | License Status |
| ---------------------------- | ---------------- | ----------- | -------------- |
| `oceanfloor.glb`             | Ocean Floor      | Third-party | Verify license |
| `city_at_night.glb`          | City At Night    | Third-party | Verify license |
| `cloud_station.glb`          | Cloud Station    | Third-party | Verify license |
| `creek_falls_world_maps.glb` | Creek Falls      | Third-party | Verify license |
| `gravity_falls.glb`          | Gravity Falls    | Third-party | Verify license |

#### Maps in `/public/maps_2/`

| File                           | Descriptive Name | Source      | License Status |
| ------------------------------ | ---------------- | ----------- | -------------- |
| `minecraft_world.glb`          | Minecraft World  | Third-party | Verify license |
| `moon_-_mare_moscoviense.glb`  | Moon Base        | Third-party | Verify license |
| `ship_in_clouds.glb`           | Ship in Clouds   | Third-party | Verify license |
| `stylized_desert_skybox_2.glb` | Desert Skybox    | Third-party | Verify license |

#### Maps in `/public/maps_3/`

| File                                     | Descriptive Name | Source      | License Status |
| ---------------------------------------- | ---------------- | ----------- | -------------- |
| `soccer_stadium_draco.glb`               | Soccer Stadium   | Third-party | Verify license |
| `tropical_island.glb`                    | Tropical Island  | Third-party | Verify license |
| `world_1-1.glb`                          | World 1-1        | Third-party | Verify license |
| `japanese_town/source/japanese_town.glb` | Japanese Town    | Third-party | Verify license |

### 360° Video

#### Al-Aqsa 360° Video

- **File:** `/models/al_aqsa_360.mp4`
- **Source:** Verify source and license
- **Usage:** 360° video player demonstration

### Sphere Model

#### 360 Sphere

- **File:** `/360_sphere.glb`
- **Source:** Generated or third-party
- **License:** Verify

---

## Audio Assets

### Sound Effects

| File                          | Description       | Source | License |
| ----------------------------- | ----------------- | ------ | ------- |
| `/sounds/kick.wav`            | Kick sound effect | Verify | Verify  |
| `/sounds/jump.mp3`            | Jump sound effect | Verify | Verify  |
| `/sounds/powerup.mp3`         | Power-up sound    | Verify | Verify  |
| `/sounds/endgame.mp3`         | End game sound    | Verify | Verify  |
| `/sounds/pop.mp3`             | Pop/UI sound      | Verify | Verify  |
| `/sounds/countdown-ready.mp3` | Countdown ready   | Verify | Verify  |
| `/sounds/countdown-beep.mp3`  | Countdown beep    | Verify | Verify  |
| `/sounds/countdown-go.mp3`    | Countdown go      | Verify | Verify  |

### Music

| File                            | Description        | Source | License |
| ------------------------------- | ------------------ | ------ | ------- |
| `/sounds/bg-music.mp3`          | Background music   | Verify | Verify  |
| `/winner-game-sound-404167.mp3` | Winner celebration | Verify | Verify  |

### Ambient Sounds

| File                   | Description       | Source | License |
| ---------------------- | ----------------- | ------ | ------- |
| `/sounds/rainloop.mp3` | Rain ambient loop | Verify | Verify  |

---

## Textures and Images

### UI Assets

| File                    | Description      | Source          |
| ----------------------- | ---------------- | --------------- |
| `/logo.png`             | Game logo        | OmniPitch Games |
| `/favicon.ico`          | Favicon          | OmniPitch Games |
| `/apple-touch-icon.png` | Apple touch icon | OmniPitch Games |
| `/pwa-192x192.png`      | PWA icon (192px) | OmniPitch Games |
| `/pwa-512x512.png`      | PWA icon (512px) | OmniPitch Games |
| `/tuto.png`             | Tutorial image   | OmniPitch Games |

### Map Textures

#### Japanese Town Textures

Located in `/public/maps_3/japaneses-town/textures/`:

- `gltf_embedded_0.png` through `gltf_embedded_32.png`
- **Note:** These are embedded textures from the GLB file

### Screenshots/Placeholders

Located in `/public/placeholders/`:

- Various screenshot files (Screenshots-\*.png)
- `alaqsa.jfif`
- **Source:** Game screenshots or placeholder images

---

## Fonts

The game uses system fonts:

- **Primary:** Inter, Segoe UI, Arial (sans-serif)
- **Fallback:** System default sans-serif

---

## Development Tools

### Build and Development

- **Node.js:** JavaScript runtime
- **npm:** Package manager
- **Vite:** Build tool

### Version Control

- **Git:** Version control system

### Code Quality

- **ESLint:** JavaScript linting (if configured)
- **Prettier:** Code formatting (if configured)

---

## Special Thanks

OmniPitch Games extends gratitude to:

- The **React Three Fiber** community for excellent 3D React integration
- The **Colyseus** team for robust multiplayer networking
- The **Three.js** community for 3D graphics excellence
- All **open source contributors** whose libraries make this game possible

---

## Action Items for Developers

### Immediate Actions Required:

1. **Verify 3D Model Licenses**
   - Check each `.glb` file source and license
   - Ensure CC-BY attributions are displayed if required
   - Replace any assets with unclear licensing

2. **Verify Audio Asset Licenses**
   - Confirm all sound effects are properly licensed
   - Ensure music tracks have appropriate licenses
   - Document any royalty-free asset sources

3. **Trademark Review**
   - Consider renaming maps that reference trademarked properties:
     - "Minecraft World" → "Block World" or "Voxel World"
     - "Gravity Falls" → "Mystery Forest" or "Pine Woods"
     - "World 1-1" → "Retro World" or "Classic Stage"
   - Add disclaimer that these are descriptive names only

4. **License Compliance**
   - Ensure all MIT-licensed dependencies have attribution
   - Include Apache 2.0 license text for Rapier
   - Maintain NOTICE file accuracy

---

## Contact for Attribution Corrections

If you believe any attribution is incorrect or missing, please contact:

**OmniPitch Games**

- Email: hentertrabelsi@gmail.com

---

**Last Updated:** January 2026  
**Copyright (c) 2026 OmniPitch Games. All Rights Reserved.**
