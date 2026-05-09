# Jira Migration Audit — Atlassian Forge App

## Overview

This is an Atlassian Forge app that installs inside **Jira Cloud** and audits your **Jira DC/Server** instance for migration readiness.

## Prerequisites

1. **Atlassian Developer Account** — free at https://developer.atlassian.com
2. **Forge CLI** installed:
   ```bash
   npm install -g @forge/cli
   ```
3. **A Jira Cloud site** (free trial at https://www.atlassian.com/try/cloud/signup)
4. **Node.js 18+**

## Setup & Deployment

### Step 1 — Log in to Forge

```bash
forge login
```

Enter your Atlassian account email and API token (generate one at https://id.atlassian.com/manage-profile/security/api-tokens).

### Step 2 — Register the app

```bash
cd artifacts/jira-forge-app
forge register
```

This assigns a real app ID and updates `manifest.yml` automatically.

### Step 3 — Build the frontend

```bash
cd static/hello-world
npm install
npm run build
cd ../..
```

### Step 4 — Deploy to Forge

```bash
forge deploy
```

### Step 5 — Install on your Jira Cloud site

```bash
forge install
```

Select your Jira Cloud site when prompted.

### Step 6 — Open the app in Jira

1. Go to your Jira Cloud site
2. Click **Apps** in the top navigation
3. Select **Jira Migration Audit**
4. Enter your DC/Server URL and credentials
5. Click **Run Full Audit**

---

## Development (Tunnel mode)

For live development with hot reload:

```bash
# Terminal 1: Build frontend in watch mode
cd static/hello-world && npm run build -- --watch

# Terminal 2: Run Forge tunnel
cd ../.. && forge tunnel
```

---

## Publishing to Atlassian Marketplace

1. Go to https://marketplace.atlassian.com/manage
2. Create a new listing
3. Set pricing (free, paid, or freemium)
4. Upload screenshots and write a description
5. Submit for Atlassian review (takes 1–4 weeks)

For more info: https://developer.atlassian.com/platform/marketplace/
