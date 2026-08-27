# StackFox Docker Refresh Utility
# Use this to rebuild images and re-seed the catalog with the latest metadata

Write-Host "🦊 Starting StackFox Refresh (Windows/PS)..." -ForegroundColor Cyan

# 1. Rebuild images (specifically to bundle new catalog data into the client)
Write-Host "🏗️  Rebuilding images..." -ForegroundColor Yellow
docker-compose build --pull

# 2. Restart services
Write-Host "🚀 Restarting heart services..." -ForegroundColor Yellow
docker-compose up -d server client

# 3. Run seeding process (populates ROI, Conflicts, and Requirements)
Write-Host "🌱 Seeding latest catalog metadata..." -ForegroundColor Yellow
docker-compose up seed

Write-Host "✅ Refresh complete!" -ForegroundColor Green
Write-Host "Visit: http://localhost:3000" -ForegroundColor White
