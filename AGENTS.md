# AGENTS.md — hive-oss-frontend

- This module packages the Vue SPA as a static-resource JAR consumed by `hive-oss`. Editable source is `frontend-app/src`; never edit `target/` output or `node_modules/`.
- The app uses Vue 3, TypeScript, Vue Router hash routes, Pinia, Element Plus, and Vite. Read `README.md` for setup and `API.md` for frontend/backend contracts; broader API notes are in `hive-oss/docs/`.
- Keep route definitions in `frontend-app/src/router/index.ts`, API wrappers in `src/api/`, state and polling in `src/stores/`, and shared UI styles in `src/styles/cloud-ops.css`.
- From `frontend-app`, use `npm ci`, `npm run dev`, `npm run typecheck`, and `npm run build`. Always run `npm run typecheck` after TypeScript changes. Dev server port is 3000 and Vite proxies `/setup` and `/api` to port 8080.
- Maven packaging from this module stages source under `target/`, installs Node 20.19.0/npm 10.8.2, runs `npm ci` and builds static files into `target/generated-resources/static`; these are generated outputs.
- Preserve API/state contracts: `all` differs from `ungrouped`; file removal is selection-based through `POST /api/categories/{category}/files:mark-delete`; follow-up refreshes use `files:batch-get`; long-running file polling must clean up when routes change. See the root AGENTS file for additional gotchas and smoke-test expectations.
