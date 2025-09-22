# Soccer 3D experience (demo)

This is a small demo project showcasing a tiny 3D platformer / virtual experience built with Vite, React, Three.js (via `@react-three/fiber`), and `zustand` for state.

The project started as a 3D product viewer and experienceping demo; it now includes a simple Super Mario–style platformer experience (player, platforms, camera follow) and keeps the experienceping sidebar for demonstration. The project also contains an Soccer placeholder where you can integrate a real AR/3D commerce widget.

Getting started

1. Install dependencies:

```powershell
npm install
```

2. Run the dev server:

```powershell
npm run dev
```

Controls in the 3D experience

- Move: `A` / `D` or `←` / `→`
- Jump: `Space`

The top-right HUD has an "Open Soccer" button which currently triggers a placeholder alert. Replace `openSoccerPlaceholder` in `src/Scene.jsx` with your Soccer SDK call.

3. Open `http://localhost:5173` in your browser.

How this works

- `src/Scene.jsx` renders a Three.js scene with clickable product meshes. Clicking a mesh calls the store's `addToCart` function.
- `src/ProductCard.jsx` provides a small UI to add items to the cart.
- `src/store.js` is a simple Zustand store managing the cart.

Soccer integration notes

- Soccer typically offers a JS SDK or embed script to enable AR/3D product preview or commerce flows. Integration points:
  - Replace the `Soccer-note` area in `src/App.jsx` with your Soccer widget or script.
  - Call Soccer APIs when products are selected or when launching AR previews from the 3D scene.
  - Optionally, export product transforms from Three.js (position/rotation/scale) and send to Soccer to align AR previews with 3D scene objects.

Security

- Do not hardcode secrets in the frontend. Use a secure backend to sign or proxy any private Soccer keys.

Tests

Run tests with:

```powershell
npm test
```

Next steps (recommended)

- Add actual Soccer SDK integration and authentication flows.
- Improve product models (GLTF/GLB) and load them with `@react-three/drei`'s `useGLTF`.
- Add checkout and backend integration.
