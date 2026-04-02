# BTC Things

A collection of Bitcoin-related data visualization tools built with Astro.

## Pages

- `/` - Home
- `/debase` - Currency debasement chart
- `/dca` - Dollar cost averaging calculator
- `/satsukashii` - Big Mac price in satoshis
- `/all-the-money` - Money supply visualization
- `/sem-melhores` - Brazilian news headlines

## Local Development

Using Bun (recommended):
```bash
bun install
bun run dev
```

Or with npm:
```bash
npm install
npm run dev
```

## Build

```bash
bun run build
bun run preview  # preview production build
```

## Updating Data

Datasets are updated via scripts in `scripts/`:

```bash
# Update all datasets (CPI, metals, crypto prices)
bash scripts/update.sh

# Recompute satsukashii prices
bun run scripts/compute-satsukashii.ts

# Or do both + rebuild
bash update-and-rebuild.sh

# With deploy
bash update-and-rebuild.sh --deploy
```

### Prerequisites for data updates

- Docker (for CPI and metals updaters)
- Python 3.12+
- Bun (recommended) or Node.js 20+

## Deploy to VPS

### First-time setup

1. Copy `nginx.conf.example` to your nginx sites-available
2. Set environment variables:

```bash
export SSH_KEY_PATH=~/.ssh/id_rsa
export VPS_USER=deploy
export VPS_HOST=your-server.com
export VPS_PATH=/var/www/btc-things
```

3. Build and deploy:

```bash
bun run build
bash deploy.sh
```

### Using Docker for builds

With Node:
```bash
docker build -f Dockerfile.build -o type=local,dest=./dist .
```

With Bun:
```bash
docker build -f Dockerfile.bun -o type=local,dest=./dist .
```

### Daily auto-updates via cron

```bash
bash cron.sh install
```

This runs daily at 6 AM UTC: updates datasets, rebuilds site, and deploys.

## Architecture

- **Astro** static site generator
- **D3.js** for charts
- **Python** (Docker) for data fetching scripts
- **Nginx** for serving
