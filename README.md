## TimeTile — Mood Productivity (vanilla)

A lightweight time-blocking web app that adapts its look and focus based on time of day. This repo contains a single-file front-end (HTML/CSS/JS) with local persistence and a placeholder for optional cloud sync.

Quick links

- App shell: `index.html`
- Styles: `styles/app.css`
- App logic: `scripts/app.js`
- Cloud sync placeholder: `scripts/firebaseConfig.js`

Why this repo

- Fast, zero-build demo you can open in the browser.
- Intent: experiment with time-of-day theming, glassmorphism UI, and quick time-block workflows.

Features included

- Automatic time-of-day theming (Morning/Afternoon/Evening/Night) with smooth transitions.
- Manual override toggle to force a mode.
- Left timeline with preloaded sample schedule and colorizable blocks.
- Interactive block editor modal (name, start/end time, category, color, recurring flag).
- Tasks tied to blocks — plus an `Inbox` for tasks added with no active block.
- Live "Right now / Next" contextual hint.
- Autosave to `localStorage`.

Run (quick)

You don't need Node or a build step. Two quick options:

1) Open directly

- Double-click `index.html` in your file explorer and open it in your browser.

2) Run a quick static server (recommended for module loading and some browsers):

	 - Option A: Python built-in server (if Python is installed)

			 python -m http.server 5173

		 Then open http://localhost:5173 in your browser.

	 - Option B: serve (Node, optional)

			 npm i -g serve
			 serve -l 5173

How theming works

- Morning: 05:00 — 11:59 (bright/energetic)
- Afternoon: 12:00 — 16:59 (balanced)
- Evening: 17:00 — 20:59 (warm/plan & wrap-up)
- Night: 21:00 — 04:59 (dark/minimal)

The UI reads your local time and automatically applies a theme by toggling `data-mode` on the `<body>` element. Toggle "Manual Mode" to prevent automatic switching.

Persistence & cloud

- By default the app autosaves to `localStorage` under the key `mood-prod-v1`.
- `scripts/firebaseConfig.js` contains placeholder functions `initFirebase()` and `signInAndSync()`; to enable cloud sync:
	1. Create a Firebase project and enable Authentication + Firestore or Realtime DB.
	2. Add the Firebase client initialization in `scripts/firebaseConfig.js` and implement `signInAndSync()` to upload/download the `state` object.
	3. Wire conflict handling (last-write / merge) as you prefer.

Developer notes

- The app is intentionally dependency-free (no React/Vite runtime) so it's easy to open and test.
- Main app state is stored in a `state` object inside `scripts/app.js`.
- `window._moodApp` exposes `{ state, saveState }` for debugging and hooking automated sync or import/export.

Cleanup (optional)

If you want the repository to only contain the vanilla app and remove leftover scaffold files (from earlier experiments), it's safe to delete:

- `src/` (React/Vite source)
- `package.json`, `vite.config.ts`, `tsconfig.json`
- `tailwind.config.cjs`, `postcss.config.cjs`

Keep the following files — they are required by the running app:

- `index.html`
- `styles/app.css`
- `scripts/app.js`
- `scripts/firebaseConfig.js` (optional, keep for future cloud sync)

Next recommended improvements (pick one)

- Apply block `color` to timeline block backgrounds (small, quick win).
- Add drag-to-resize and reorder for timeline blocks (higher effort, great UX).
- Add Inbox quick-assign UI so you can move tasks into blocks.
- Implement Firebase auth + sync and export/import JSON backup.

Contributing

- For quick fixes, edit the HTML/CSS/JS directly and test by reloading the page.
- If you'd like me to implement improvements, tell me which item above to pick and I will update the code.

License

- Copy/paste or use as you like. No license file included — tell me if you want an OSS license added (MIT/Apache/etc.).
