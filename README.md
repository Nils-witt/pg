# pg — elevation profile explorer

Small web + Python backend project for generating elevation profiles and visualizing maps.

This repository contains a lightweight frontend (Vite + TypeScript) and a Python backend (Flask) that computes elevation profiles from geospatial tile data. A proxy (nginx) is used in front of the services when running with Docker Compose.

## Repository layout

- `frontend/` — Vite + TypeScript single-page app. See `frontend/package.json` for scripts.
- `server/` — Flask app and elevation profile code. See `server/requirements.txt` and `server/app.py`.
- `proxy/` — `nginx.conf` used by the `proxy` service in the Compose setups.
- `compose.yaml` — Docker Compose file that builds the local `frontend` and `server` images and runs `proxy`.
- `compose-ghcr.yaml` — Docker Compose file that references prebuilt images hosted on GHCR.

## Prerequisites

- Node.js (recommended latest LTS), npm or yarn — for the frontend
- Python 3.13 (the Docker image uses `python:3.13-slim`) — for local backend dev
- pip and virtualenv (or venv) for Python dependency management
- Docker & Docker Compose (for containerized runs)

## Quickstart — Docker Compose (local build)

This will build the `frontend` and `server` images from the repository and start the `proxy`, `frontend` and `app` services.

```bash
# from project root
docker compose -f compose.yaml up --build
```

The `proxy` service exposes port 80 on the host. The nginx configuration in `proxy/nginx.conf` proxies requests to the frontend and backend containers.

## Quickstart — Docker Compose (GHCR images)

If you prefer to use prebuilt images published to GHCR, run:

```bash
docker compose -f compose-ghcr.yaml up
```

## Local development

Frontend

```bash
cd frontend
# install dependencies (npm example)
npm install
# start Vite dev server
npm run dev
```

The frontend dev server runs on Vite's default port (usually 5173). Open the URL printed by Vite in your browser.

Backend (Python / Flask)

```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# run the Flask app (debug mode)
python app.py
```

When run this way the Flask app uses `port=5001` (see `server/app.py`) and will be reachable at `http://localhost:5001/`.

Notes about Dockerfile: the server Dockerfile installs system dependencies (GDAL dev headers, build-essential) then pip installs the requirements and runs the app with Gunicorn. The container exposes port 8000; however the compose files rely on the nginx proxy for routing, so you usually do not need to expose the app directly.

## API (simple example)

The backend exposes a single endpoint (root) that accepts four query parameters and returns an elevation profile. Parameters:

- `latitude1`, `longitude1` — first coordinate (lat/lon)
- `latitude2`, `longitude2` — second coordinate (lat/lon)

Example request (if using the proxy on port 80):

```bash
curl "http://localhost/?latitude1=52.0&longitude1=13.0&latitude2=52.1&longitude2=13.1"
```

If you're running the Flask app directly (debug server), point at port 5001:

```bash
curl "http://localhost:5001/?latitude1=52.0&longitude1=13.0&latitude2=52.1&longitude2=13.1"
```

## Data

- The compose files mount `./dgm1_tiff_kacheln` to `/dgm1_tiff_kacheln` in the app container. Place your elevation tiles there.
- The project also contains `data/scenes/` and various meshes/textures used by the frontend.

## Build & CI notes

- Frontend build: `cd frontend && npm run build` — this runs `tsc && vite build` as defined in `frontend/package.json`.
- Server packaging: the Dockerfile installs `requirements.txt` and runs via Gunicorn in the container.

## Troubleshooting

- If you see errors installing `rasterio` or GDAL-related Python packages locally, ensure system GDAL headers are installed (on Debian/Ubuntu install `libgdal-dev`) or use the provided Docker container which has these dependencies installed.
- If the frontend does not reach the backend when running with Docker Compose, check `proxy/nginx.conf` and that the compose stack is healthy (`docker compose ps`).


# Copyright
Copyright [2025] [Nils Witt]

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
