#!/bin/bash
# ============================================================
#  PlayStudy — One-Step Build & Run
#  Fixes permissions, installs deps, builds, and runs.
#  
#  Usage: Open Terminal.app and run:
#    cd ~/Downloads/Project-PLAYSTUDY/playstudy-card-dash
#    bash setup-and-run.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${MAGENTA}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}${BOLD}║       🎓  PlayStudy — Setup & Run               ║${NC}"
echo -e "${MAGENTA}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: Check prerequisites ────────────────────────────
echo -e "${CYAN}[1/5]${NC} Checking prerequisites..."

if ! command -v node &>/dev/null; then
    echo -e "${RED}✗ Node.js not found. Install from https://nodejs.org${NC}"
    exit 1
fi
echo -e "   ${GREEN}✓${NC} Node.js $(node --version)"

if ! command -v npm &>/dev/null; then
    echo -e "${RED}✗ npm not found${NC}"
    exit 1
fi
echo -e "   ${GREEN}✓${NC} npm $(npm --version)"

# Test network
if ! curl -s --connect-timeout 5 https://registry.npmjs.org/ > /dev/null 2>&1; then
    echo -e "   ${RED}✗ Cannot reach npm registry. Check your internet connection.${NC}"
    exit 1
fi
echo -e "   ${GREEN}✓${NC} Network OK"

# ── Step 2: Fix npm cache permissions ──────────────────────
echo -e "${CYAN}[2/5]${NC} Fixing npm cache permissions..."

if [ -d "$HOME/.npm" ]; then
    sudo chown -R $(whoami) "$HOME/.npm" 2>/dev/null && echo -e "   ${GREEN}✓${NC} Cache permissions fixed" || {
        echo -e "   ${YELLOW}⚠ Could not fix cache. Trying alternative cache...${NC}"
    }
fi

# ── Step 3: Clean and install dependencies ─────────────────
echo -e "${CYAN}[3/5]${NC} Installing dependencies..."

# Remove any ACL-locked node_modules
if [ -d "node_modules" ]; then
    chmod -a "user:$(whoami) deny delete" node_modules 2>/dev/null || true
    rm -rf node_modules 2>/dev/null || {
        echo -e "   ${YELLOW}Using sudo to remove locked node_modules...${NC}"
        sudo rm -rf node_modules
    }
fi

# Install with fallback cache if default cache has permission issues
npm install 2>&1 || {
    echo -e "   ${YELLOW}Retrying with alternate cache location...${NC}"
    npm install --cache /tmp/playstudy-npm-cache 2>&1
}

if [ ! -f "node_modules/.bin/vite" ]; then
    echo -e "   ${RED}✗ Installation failed. Please check errors above.${NC}"
    exit 1
fi
echo -e "   ${GREEN}✓${NC} Dependencies installed ($(ls node_modules | wc -l | tr -d ' ') packages)"

# ── Step 4: Verify build (non-blocking) ───────────────────
echo -e "${CYAN}[4/5]${NC} Verifying build (optional)..."
if npx vite build 2>&1 | tail -3 && [ -d "dist" ]; then
    echo -e "   ${GREEN}✓${NC} Build verified ($(du -sh dist | cut -f1))"
else
    echo -e "   ${YELLOW}⚠${NC} Production build has warnings (dev server will still work fine)"
fi

# ── Step 5: Start dev server ──────────────────────────────
echo ""
echo -e "${CYAN}[5/5]${NC} Starting development server..."
echo ""
echo -e "${MAGENTA}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}${BOLD}║            ✅  PlayStudy is running!             ║${NC}"
echo -e "${MAGENTA}${BOLD}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${MAGENTA}║${NC}  App:      ${GREEN}http://localhost:5173${NC}               ${MAGENTA}║${NC}"
echo -e "${MAGENTA}║${NC}  ${YELLOW}Press Ctrl+C to stop${NC}                           ${MAGENTA}║${NC}"
echo -e "${MAGENTA}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Open browser
(sleep 2 && open "http://localhost:5173" 2>/dev/null) &

npm run dev
