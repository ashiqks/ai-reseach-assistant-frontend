## AI Research Assistant — Frontend

React + TypeScript frontend for the AI Research Assistant Platform. This app provides the user interface for starting research runs, viewing progress in real time, and browsing past projects.

### Features
- Vite + React 19 + TypeScript
- Tailwind CSS v4 (via `@tailwindcss/vite`)
- React Router with starter routes: `/`, `/dashboard`, `/projects/:id`
- Environment-based API URL (`VITE_API_BASE_URL`)
- Ready for Auth0 SPA integration (to be added)

### Getting started
1) Prerequisites
   - Node.js 20+ (recommended 22+)
   - pnpm 8+

2) Install and run
```bash
pnpm install
pnpm dev
```
The app will start on `http://localhost:5173`.

### Environment variables
Create a `.env` (or `.env.local`) from `.env.example`:
```
VITE_AUTH0_DOMAIN=
VITE_AUTH0_CLIENT_ID=
VITE_API_BASE_URL=http://localhost:8000
```

### Scripts
- `pnpm dev`: start the dev server
- `pnpm build`: type-check and build for production
- `pnpm preview`: preview the production build
- `pnpm lint`: run ESLint

### Project structure
```txt
ai-research-assistant-frontend/
  src/
    App.tsx          # routes and pages
    main.tsx         # entrypoint
    index.css        # Tailwind entry
  vite.config.ts     # Vite + Tailwind plugin
  .env.example       # sample env vars
```

### Roadmap (frontend)
- Auth0 SPA login/logout and protected routes
- Realtime updates UI for research runs (WebSocket)
- Dashboard and project detail polish
- Export to Markdown/PDF (with backend support)
