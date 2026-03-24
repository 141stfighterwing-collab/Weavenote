#!/bin/bash
# =============================================================================
# Weavenote Smart Installer - One-Click Installation with Auto-Fix
# =============================================================================
# Features:
# - Real-time progress display with percentage
# - Background Docker build process
# - Comprehensive error logging
# - Auto-fix for common issues
# - Dependency checking and installation
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
LOG_FILE="weavenote-install.log"
MAX_RETRIES=3

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

print_header() {
    echo -e "\n${CYAN}============================================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}============================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}  [OK] $1${NC}"
}

print_error() {
    echo -e "${RED}  [ERROR] $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}  [WARN] $1${NC}"
}

print_progress() {
    echo -e "${WHITE}  [..] $1${NC}"
}

log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# =============================================================================
# PROGRESS DISPLAY
# =============================================================================

show_progress() {
    local current=$1
    local total=$2
    local message=$3
    local percent=$((current * 100 / total))
    local filled=$((percent / 2))
    local empty=$((50 - filled))

    printf "\r  ["
    printf "%${filled}s" | tr ' ' '█'
    printf "%${empty}s" | tr ' ' '░'
    printf "] %3d%% - %s" "$percent" "$message"
}

# =============================================================================
# DEPENDENCY CHECKING
# =============================================================================

check_dependencies() {
    print_header "Checking Dependencies"

    local all_ok=true

    # Check Docker
    if command -v docker &> /dev/null; then
        print_success "Docker is installed"
    else
        print_error "Docker not found"
        echo -e "  Install from: ${BLUE}https://docs.docker.com/get-docker/${NC}"
        all_ok=false
    fi

    # Check Docker Compose
    if docker compose version &> /dev/null || command -v docker-compose &> /dev/null; then
        print_success "Docker Compose is installed"
    else
        print_error "Docker Compose not found"
        all_ok=false
    fi

    # Check if Docker is running
    if ! docker info &> /dev/null; then
        print_warning "Docker daemon is not running"
        print_progress "Attempting to start Docker..."

        if [[ "$OSTYPE" == "darwin"* ]]; then
            open -a Docker 2>/dev/null || true
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || true
        fi

        # Wait for Docker
        local retries=0
        while ! docker info &> /dev/null && [ $retries -lt 30 ]; do
            sleep 2
            ((retries++))
        done

        if docker info &> /dev/null; then
            print_success "Docker started successfully"
        else
            print_error "Could not start Docker. Please start it manually."
            all_ok=false
        fi
    fi

    $all_ok
}

# =============================================================================
# ERROR DETECTION AND AUTO-FIX
# =============================================================================

auto_fix() {
    local error_line="$1"
    local fixed=false

    # Missing package-lock.json
    if [[ "$error_line" =~ "package-lock.json" ]]; then
        print_warning "Detected: Missing package-lock.json"
        print_progress "Auto-fixing: Generating package-lock.json..."
        cd backend
        npm install --legacy-peer-deps >> "$LOG_FILE" 2>&1
        cd ..
        print_success "Auto-fixed: package-lock.json generated"
        fixed=true
    fi

    # Port already in use
    if [[ "$error_line" =~ "port is already allocated" ]]; then
        print_warning "Detected: Port already in use"
        print_progress "Auto-fixing: Stopping conflicting containers..."
        docker-compose down >> "$LOG_FILE" 2>&1
        print_success "Auto-fixed: Stopped conflicting containers"
        fixed=true
    fi

    # No space left
    if [[ "$error_line" =~ "no space left" ]]; then
        print_warning "Detected: Disk space issue"
        print_progress "Auto-fixing: Cleaning Docker system..."
        docker system prune -af >> "$LOG_FILE" 2>&1
        print_success "Auto-fixed: Docker cleaned"
        fixed=true
    fi

    # Network error
    if [[ "$error_line" =~ "network.*not found" ]]; then
        print_warning "Detected: Network issue"
        print_progress "Auto-fixing: Creating Docker network..."
        docker network create weavenote-network >> "$LOG_FILE" 2>&1 || true
        print_success "Auto-fixed: Network created"
        fixed=true
    fi

    echo "$fixed"
}

# =============================================================================
# MAIN INSTALLATION
# =============================================================================

main() {
    clear

    echo -e "${MAGENTA}"
    cat << "EOF"
  ██╗    ██╗██╗  ██╗███████╗██╗     ███████╗ ██████╗ ███╗   ██╗
  ██║    ██║██║  ██║██╔════╝██║     ██╔════╝██╔═══██╗████╗  ██║
  ██║ █╗ ██║███████║█████╗  ██║     ███████╗██║   ██║██╔██╗ ██║
  ██║███╗██║██╔══██║██╔══╝  ██║     ╚════██║██║   ██║██║╚██╗██║
  ╚███╔███╔╝██║  ██║███████╗███████╗███████║╚██████╔╝██║ ╚████║
   ╚══╝╚══╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝

  Smart Installer v2.0 - One-Click Installation
EOF
    echo -e "${NC}\n"

    # Initialize log
    echo "=== Weavenote Installation Log ===" > "$LOG_FILE"
    echo "Started: $(date)" >> "$LOG_FILE"
    log "INFO" "Installation started"

    # Step 1: Check dependencies
    if ! check_dependencies; then
        print_error "Missing required dependencies. Please install them and try again."
        log "ERROR" "Installation failed - missing dependencies"
        exit 1
    fi

    # Step 2: Ensure package-lock.json exists
    print_header "Preparing Build Files"
    if [ ! -f "backend/package-lock.json" ]; then
        print_progress "Generating backend package-lock.json..."
        cd backend
        npm install --legacy-peer-deps >> "$LOG_FILE" 2>&1
        cd ..
        print_success "package-lock.json generated"
    else
        print_success "package-lock.json already exists"
    fi

    # Step 3: Stop existing containers
    print_header "Cleaning Up"
    print_progress "Stopping any existing containers..."
    docker-compose down >> "$LOG_FILE" 2>&1 || true
    print_success "Cleanup complete"

    # Step 4: Build with progress
    print_header "Building Docker Containers"

    local retry_count=0
    local build_success=false

    while [ $retry_count -lt $MAX_RETRIES ] && [ "$build_success" = false ]; do
        if [ $retry_count -gt 0 ]; then
            print_warning "Retrying build (attempt $((retry_count + 1))/$MAX_RETRIES)..."
        fi

        # Run docker-compose and capture output
        local build_output
        build_output=$(docker-compose up -d --build 2>&1) || true

        echo "$build_output" >> "$LOG_FILE"

        # Check for errors
        local has_error=false
        while IFS= read -r line; do
            if [[ "$line" =~ [Ee]rror|[Ff]ailed|FAILED ]]; then
                has_error=true
                local fixed=$(auto_fix "$line")
                if [ "$fixed" = true ]; then
                    has_error=false
                fi
            fi
        done <<< "$build_output"

        if [ "$has_error" = false ]; then
            # Check if containers are running
            if docker-compose ps | grep -q "Up"; then
                build_success=true
            fi
        fi

        ((retry_count++))
    done

    if [ "$build_success" = false ]; then
        print_header "Installation Failed"
        print_error "Docker build failed. Check the log file:"
        echo "  $LOG_FILE"
        log "ERROR" "Installation failed - Docker build error"
        exit 1
    fi

    # Step 5: Health check
    print_header "Running Health Checks"

    local healthy=false
    local retries=0

    while [ $retries -lt 30 ] && [ "$healthy" = false ]; do
        show_progress $((retries + 1)) 30 "Waiting for services to start..."
        sleep 2

        if curl -s http://localhost:8080 > /dev/null 2>&1; then
            healthy=true
            echo ""
            print_success "Frontend is responding"
        fi

        ((retries++))
    done

    echo ""

    # Step 6: Final status
    print_header "Installation Complete"

    if [ "$healthy" = true ]; then
        print_success "Weavenote is running!"
        echo ""
        echo -e "${GREEN}  Access the application at: ${BLUE}http://localhost:8080${NC}"
        echo -e "${GREEN}  API endpoint: ${BLUE}http://localhost:3001${NC}"
        echo ""
        echo "  Log file: $LOG_FILE"
        log "INFO" "Installation completed successfully"

        # Open browser
        if command -v xdg-open &> /dev/null; then
            xdg-open http://localhost:8080 2>/dev/null &
        elif command -v open &> /dev/null; then
            open http://localhost:8080 2>/dev/null &
        fi
    else
        print_warning "Services are starting but not yet responding."
        echo "  Please wait a moment and try accessing: http://localhost:8080"
        log "WARN" "Installation completed but health check timed out"
    fi

    echo ""
    echo -e "${CYAN}  To stop: docker-compose down${NC}"
    echo -e "${CYAN}  To restart: docker-compose restart${NC}"
    echo -e "${CYAN}  To view logs: docker-compose logs -f${NC}"
}

# Run main function
main
