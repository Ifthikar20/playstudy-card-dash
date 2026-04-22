#!/bin/bash
# ============================================================
#  PlayStudy — Quick Setup & Run (Non-Docker)
#  Installs dependencies and starts the dev server directly.
#  Use this if Docker is not available.
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/playstudy-card-dash"

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║   🎓  PlayStudy Quick Setup          ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: Check Node.js ──────────────────────────────────
echo -e "${CYAN}[1/4]${NC} Checking Node.js..."
if ! command -v node &>/dev/null; then
    echo -e "${RED}✗ Node.js not found. Install it from https://nodejs.org${NC}"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "   ${GREEN}✓${NC} Node.js $NODE_VERSION"

# ── Step 2: Fix permissions ───────────────────────────────
echo -e "${CYAN}[2/4]${NC} Fixing permissions..."

# Fix npm cache permissions
if [ -d "$HOME/.npm" ]; then
    chown -R $(whoami) "$HOME/.npm" 2>/dev/null || {
        echo -e "   ${YELLOW}⚠ Cannot fix ~/.npm permissions. Try: sudo chown -R \$(whoami) ~/.npm${NC}"
    }
fi

# Remove ACL-locked node_modules if present
if [ -d "node_modules" ]; then
    # Remove any deny-delete ACL
    chmod -a "user:$(whoami) deny delete" node_modules 2>/dev/null || true
    rm -rf node_modules 2>/dev/null || {
        echo -e "   ${YELLOW}⚠ Cannot remove node_modules. Trying sudo...${NC}"
        sudo rm -rf node_modules 2>/dev/null || {
            echo -e "   ${RED}✗ Cannot remove node_modules. Please remove it manually.${NC}"
            exit 1
        }
    }
fi
echo -e "   ${GREEN}✓${NC} Permissions fixed"

# ── Step 3: Install dependencies ──────────────────────────
echo -e "${CYAN}[3/4]${NC} Installing dependencies..."

# Test network connectivity first
if ! curl -s --connect-timeout 5 https://registry.npmjs.org/ > /dev/null 2>&1; then
    echo -e "   ${RED}✗ Cannot reach npm registry. Check your internet connection.${NC}"
    echo -e "   ${YELLOW}Tip: If on VPN, try disconnecting or check DNS settings.${NC}"
    exit 1
fi

npm install 2>&1 | tail -5

if [ ! -f "node_modules/.bin/vite" ]; then
    echo -e "   ${RED}✗ Installation failed. Retrying with clean cache...${NC}"
    npm cache clean --force 2>/dev/null
    npm install --prefer-online 2>&1 | tail -5
fi

if [ ! -f "node_modules/.bin/vite" ]; then
    echo -e "   ${RED}✗ npm install failed. Check error messages above.${NC}"
    exit 1
fi
echo -e "   ${GREEN}✓${NC} Dependencies installed"

# ── Step 4: Start dev server ─────────────────────────────
echo ""
echo -e "${CYAN}[4/4]${NC} Starting development server..."
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║       ✅  Ready to launch!           ║${NC}"
echo -e "${CYAN}${BOLD}╠══════════════════════════════════════╣${NC}"
echo -e "${CYAN}║${NC}  Frontend: ${GREEN}http://localhost:8080${NC}     ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${YELLOW}Press Ctrl+C to stop${NC}               ${CYAN}║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# Open browser after a delay
(sleep 3 && open "http://localhost:8080/auth" 2>/dev/null) &

npm run dev
