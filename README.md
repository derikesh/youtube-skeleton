# youtube-skeleton (workers)

This repository contains the workers / background service for the youtube-skeleton project. It handles tasks such as consuming streams, interacting with MinIO, interacting with Redis, and performing video transcoding.

## What this repo contains

- TypeScript source in `src/`
- Dockerfile for running in a container
- Integration with Redis and MinIO
- Transcoded outputs are written to `transcoded/`

## Quick links

- Frontend: https://github.com/derikesh/youtube-skeleton-frontend
- API: https://github.com/derikesh/youtube-skeleton-api

## Environment

This project reads configuration from a `.env` file. Example values used in development:

```
CONSUMER=rikesh
PORT=3000
```

(You may have additional env vars for Redis / MinIO connection strings.)

## Run (development)

This repo includes a development Docker setup in the `Dockerfile` that uses `ts-node`/`nodemon`.
If you prefer to run locally without Docker:

1. Install dependencies

```bash
npm ci
```

2. Run in dev mode

```bash
npm run dev
```

## Build / Run (production)

Recommended: compile TypeScript and run compiled JS.

```bash
npm run build
npm run serve
```

Or build a production container that runs the compiled `dist/index.js` (multi-stage Dockerfile recommended).

## Notes

- Secrets (API keys, passwords) are not included in this repo. Use environment variables for sensitive data.
- If running in Docker with a host bind mount, make sure `node_modules` is preserved (or install inside the container) so dev tooling like `ts-node` and `nodemon` remain available.

## Contact

For the full stack see the links above. If you need run/debug help for Docker or environment setup, open an issue or drop a message in the main repo.
