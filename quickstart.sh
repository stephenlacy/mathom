#!/bin/bash

set -e

echo "Checking dependencies..."

if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is not installed. Please install Docker first."
  echo "   Visit: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null; then
  echo "ERROR: Docker Compose is not installed. Please install Docker Compose first."
  echo "   Visit: https://docs.docker.com/compose/install/"
  exit 1
fi

echo "Building Podrift Docker images..."
cd podrift
if [ -f "./build.sh" ]; then
  ./build.sh
else
  echo "WARNING: build.sh not found"
fi
cd ..
echo ""

echo "Starting Docker services..."
docker compose up -d

echo ""
echo "Waiting for services to be ready..."
sleep 5

if docker compose ps | grep -q "dashboard.*running"; then
  echo "Dashboard is running!"
else
  echo "WARNING: Dashboard might not be running properly. Check 'docker compose logs dashboard'"
fi

if docker compose ps | grep -q "postgres.*running"; then
  echo "Database is running!"
else
  echo "WARNING: Database might not be running properly. Check 'docker compose logs postgres'"
fi

echo ""
echo "mathom is ready!"
echo ""
echo "Next steps:"
echo "   1. Open your browser at http://localhost:5050"
echo "   2. Install the CLI: npm install -g mcx"
echo "   3. Authenticate: mcx auth login"
echo "   4. Launch a server: mcx @modelcontextprotocol/server-filesystem"
echo ""
echo "For more information, visit: https://github.com/stephenlacy/mathom"
echo ""
echo "Tip: Run 'docker compose logs -f' to see real-time logs"

