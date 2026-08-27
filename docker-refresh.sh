#!/bin/bash

# StackFox Docker Refresh Script
# Use this to rebuild images and re-seed the catalog with the latest metadata

echo "🦊 Starting StackFox Refresh..."

# 1. Rebuild images (especially client to bundle new catalog data)
echo "🏗️  Rebuilding images..."
docker compose build

# 2. Restart services
echo "🚀 Restarting services..."
docker compose up -d server client

# 3. Run seeding process to populate the DB with devkit metadata
echo "🌱 Seeding catalog metadata (ROI, Conflicts, Requirements)..."
docker compose up seed

echo "✅ Refresh complete! Visit http://localhost:3000 to see your new professional sales dashboard."
