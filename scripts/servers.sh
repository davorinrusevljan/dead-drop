#!/bin/bash
# Server management script for dead-drop development
# Uses lsof and pkill for reliable process management

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CORE_API_PORT=9090
ADMIN_API_PORT=9091
CORE_WEB_PORT=3010
ADMIN_WEB_PORT=3011

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if a port is in use (use curl for HTTP servers, lsof as fallback)
port_in_use() {
    local port=$1
    # Try curl first (more reliable for HTTP servers like Next.js)
    if curl -s -o /dev/null -w "" --connect-timeout 1 "http://localhost:$port" 2>/dev/null; then
        return 0
    fi
    # Fallback to lsof for non-HTTP services
    lsof -i ":$port" -t >/dev/null 2>&1
}

# Kill process on a port
kill_port() {
    local port=$1
    local pids=$(lsof -i ":$port" -t 2>/dev/null || true)
    if [ -n "$pids" ]; then
        log_info "Killing process(es) on port $port: $pids"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 0.5
    fi
}

# Wait for a port to be available
wait_for_port() {
    local port=$1
    local max_wait=10
    local count=0
    while port_in_use $port && [ $count -lt $max_wait ]; do
        sleep 1
        ((count++))
    done
    if port_in_use $port; then
        return 1
    fi
    return 0
}

# Start Core API
start_core_api() {
    if port_in_use $CORE_API_PORT; then
        log_warn "Core API port $CORE_API_PORT is in use"
        return 1
    fi

    log_info "Starting Core API on port $CORE_API_PORT..."
    cd /workspaces/dead-drop/apps/core
    API_PORT=$CORE_API_PORT pnpm dev:api &
    echo $! > /tmp/dead-drop-core-api.pid

    # Wait for it to start
    sleep 2
    if curl -s http://localhost:$CORE_API_PORT/api/health > /dev/null 2>&1; then
        log_info "Core API started successfully (PID: $(cat /tmp/dead-drop-core-api.pid))"
    else
        log_error "Core API failed to start"
        return 1
    fi
}

# Start Admin API
start_admin_api() {
    if port_in_use $ADMIN_API_PORT; then
        log_warn "Admin API port $ADMIN_API_PORT is in use"
        return 1
    fi

    log_info "Starting Admin API on port $ADMIN_API_PORT..."
    cd /workspaces/dead-drop/apps/admin
    JWT_SECRET=dev-secret-key-min-32-chars API_PORT=$ADMIN_API_PORT pnpm dev:api &
    echo $! > /tmp/dead-drop-admin-api.pid

    # Wait for it to start
    sleep 2
    if curl -s http://localhost:$ADMIN_API_PORT/api/health > /dev/null 2>&1; then
        log_info "Admin API started successfully (PID: $(cat /tmp/dead-drop-admin-api.pid))"
    else
        log_error "Admin API failed to start"
        return 1
    fi
}

# Start Core Web
start_core_web() {
    if port_in_use $CORE_WEB_PORT; then
        log_warn "Core Web port $CORE_WEB_PORT is in use"
        return 1
    fi

    log_info "Starting Core Web on port $CORE_WEB_PORT..."
    cd /workspaces/dead-drop/apps/core
    NEXT_PUBLIC_API_URL=http://localhost:$CORE_API_PORT pnpm dev &
    echo $! > /tmp/dead-drop-core-web.pid

    # Wait for it to start
    sleep 3
    if curl -s http://localhost:$CORE_WEB_PORT > /dev/null 2>&1; then
        log_info "Core Web started successfully (PID: $(cat /tmp/dead-drop-core-web.pid))"
    else
        log_warn "Core Web may still be starting..."
    fi
}

# Start Admin Web
start_admin_web() {
    if port_in_use $ADMIN_WEB_PORT; then
        log_warn "Admin Web port $ADMIN_WEB_PORT is in use"
        return 1
    fi

    log_info "Starting Admin Web on port $ADMIN_WEB_PORT..."
    cd /workspaces/dead-drop/apps/admin
    pnpm dev &
    echo $! > /tmp/dead-drop-admin-web.pid

    # Wait for it to start
    sleep 3
    if curl -s http://localhost:$ADMIN_WEB_PORT > /dev/null 2>&1; then
        log_info "Admin Web started successfully (PID: $(cat /tmp/dead-drop-admin-web.pid))"
    else
        log_warn "Admin Web may still be starting..."
    fi
}

# Stop servers
stop_core_api() {
    log_info "Stopping Core API..."
    kill_port $CORE_API_PORT
    rm -f /tmp/dead-drop-core-api.pid
}

stop_admin_api() {
    log_info "Stopping Admin API..."
    kill_port $ADMIN_API_PORT
    rm -f /tmp/dead-drop-admin-api.pid
}

stop_core_web() {
    log_info "Stopping Core Web..."
    kill_port $CORE_WEB_PORT
    rm -f /tmp/dead-drop-core-web.pid
}

stop_admin_web() {
    log_info "Stopping Admin Web..."
    kill_port $ADMIN_WEB_PORT
    rm -f /tmp/dead-drop-admin-web.pid
}

stop_all() {
    log_info "Stopping all servers..."
    stop_core_web
    stop_admin_web
    stop_core_api
    stop_admin_api
    log_info "All servers stopped"
}

# Status check
status() {
    echo ""
    echo "Server Status:"
    echo "=============="

    printf "%-15s %-10s %s\n" "Service" "Status" "URL"
    printf "%-15s %-10s %s\n" "-------" "------" "---"

    if port_in_use $CORE_API_PORT; then
        printf "%-15s ${GREEN}%-10s${NC} %s\n" "Core API" "RUNNING" "http://localhost:$CORE_API_PORT"
    else
        printf "%-15s ${RED}%-10s${NC} %s\n" "Core API" "STOPPED" "-"
    fi

    if port_in_use $ADMIN_API_PORT; then
        printf "%-15s ${GREEN}%-10s${NC} %s\n" "Admin API" "RUNNING" "http://localhost:$ADMIN_API_PORT"
    else
        printf "%-15s ${RED}%-10s${NC} %s\n" "Admin API" "STOPPED" "-"
    fi

    if port_in_use $CORE_WEB_PORT; then
        printf "%-15s ${GREEN}%-10s${NC} %s\n" "Core Web" "RUNNING" "http://localhost:$CORE_WEB_PORT"
    else
        printf "%-15s ${RED}%-10s${NC} %s\n" "Core Web" "STOPPED" "-"
    fi

    if port_in_use $ADMIN_WEB_PORT; then
        printf "%-15s ${GREEN}%-10s${NC} %s\n" "Admin Web" "RUNNING" "http://localhost:$ADMIN_WEB_PORT"
    else
        printf "%-15s ${RED}%-10s${NC} %s\n" "Admin Web" "STOPPED" "-"
    fi
    echo ""
}

# Start all servers
start_all() {
    log_info "Starting all servers..."
    start_core_api || true
    start_admin_api || true
    start_core_web || true
    start_admin_web || true
    status
}

# Bootstrap admin user
bootstrap_admin() {
    log_info "Creating admin user..."
    cd /workspaces/dead-drop/apps/admin
    JWT_SECRET=dev-secret-key-min-32-chars pnpm bootstrap-admin --username admin --password admin123
}

# Main command handler
case "${1:-}" in
    start)
        case "${2:-}" in
            core-api)   start_core_api ;;
            admin-api)  start_admin_api ;;
            core-web)   start_core_web ;;
            admin-web)  start_admin_web ;;
            all)        start_all ;;
            *)          echo "Usage: $0 start {core-api|admin-api|core-web|admin-web|all}" ;;
        esac
        ;;
    stop)
        case "${2:-}" in
            core-api)   stop_core_api ;;
            admin-api)  stop_admin_api ;;
            core-web)   stop_core_web ;;
            admin-web)  stop_admin_web ;;
            all)        stop_all ;;
            *)          echo "Usage: $0 stop {core-api|admin-api|core-web|admin-web|all}" ;;
        esac
        ;;
    restart)
        $0 stop "${2:-all}"
        sleep 1
        $0 start "${2:-all}"
        ;;
    status)
        status
        ;;
    bootstrap)
        bootstrap_admin
        ;;
    *)
        echo "Dead-Drop Server Management"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|bootstrap} [target]"
        echo ""
        echo "Targets:"
        echo "  core-api    Core API server (port $CORE_API_PORT)"
        echo "  admin-api   Admin API server (port $ADMIN_API_PORT)"
        echo "  core-web    Core web frontend (port $CORE_WEB_PORT)"
        echo "  admin-web   Admin web frontend (port $ADMIN_WEB_PORT)"
        echo "  all         All servers (default)"
        echo ""
        echo "Examples:"
        echo "  $0 start all       # Start all servers"
        echo "  $0 stop all        # Stop all servers"
        echo "  $0 status          # Check server status"
        echo "  $0 bootstrap       # Create admin user (admin/admin123)"
        ;;
esac
