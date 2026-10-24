#!/usr/bin/env bash
# The local demo instance of pHARe, for the captures of the portfolio video only. Never production.
#
#   video/capture/demo-instance.sh up     two new demo databases, the API, the auth service, the frontend and the demo account
#   video/capture/demo-instance.sh down   stops and deletes all of it
#
# Everything listens on 127.0.0.2: another project may hold 127.0.0.1:3000, and the frontend calls the ports 3000 and
# 8080 of its own host. The browser opens http://127.0.0.2:8000/login.html.
# - PostgreSQL: the container phare-demo-db (postgres:16-alpine) on 127.0.0.1:55432, with the volume phare-demo-pgdata,
#   deleted at each up and down. No other database is touched: the API gets DATABASE_URL for this one.
# - The API: a copy of backend/ in PHARE_DEMO_DIR, run by Maven in the container phare-demo-api (--network host), on 8080.
# - The auth service: a copy of backend-node/ in PHARE_DEMO_DIR (never its .env nor its database.sqlite), with its
#   SQLite in PHARE_DEMO_DIR, on 127.0.0.2:3000. JWT_SECRET, PHARE_DB_PATH, PHARE_ALLOWED_ORIGINS and PORT are exported
#   before it and the account script run, so no .env can override them.
# - The frontend: python3 -m http.server on 127.0.0.2:8000, serving frontend/ as it is.
# - The account: demo@example.com, created by backend-node/scripts/create-user.js, with a password generated now and
#   kept only in PHARE_DEMO_DIR/demo-password (0600). It is never printed.
# The ports must be free: this script stops nothing it did not start. PHARE_DEMO_DIR is /tmp/phare-demo by default.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
DIR=${PHARE_DEMO_DIR:-/tmp/phare-demo}
HOST=127.0.0.2
DB=phare-demo-db
API=phare-demo-api
VOLUME=phare-demo-pgdata
ACCOUNT=demo@example.com

# Who listens on a port: on any address for 55432 and 8080, on 127.0.0.2 (or on all addresses) for 3000 and 8000.
holder() {
      local pattern=":$1\b"
      if [ "$1" = 3000 ] || [ "$1" = 8000 ]; then pattern="(127\.0\.0\.2|0\.0\.0\.0|\*|\[::\]):$1\b"; fi
      ss -ltnp 2>/dev/null | grep -E "$pattern" | head -1 || true
}

wait_for() { # what, seconds, command...
      local what=$1 limit=$2; shift 2
      for _ in $(seq "$limit"); do "$@" >/dev/null 2>&1 && return 0; sleep 1; done
      echo "demo-instance: $what did not come up" >&2
      return 1
}
api_is_401() { [ "$(curl -s -o /dev/null -w '%{http_code}' "http://$HOST:8080/api/cas")" = 401 ]; }

stop_pid() { # name, fragment of its command line: only a process this script started
      local file="$DIR/$1.pid" pid
      [ -f "$file" ] || return 0
      pid=$(cat "$file")
      if kill -0 "$pid" 2>/dev/null && ps -o args= -p "$pid" | grep -q -- "$2"; then kill "$pid"; fi
      rm -f "$file"
}

down() {
      stop_pid frontend "http.server 8000"
      stop_pid login "phare-demo-login"
      docker rm -f -v "$API" "$DB" >/dev/null 2>&1 || true
      docker volume rm "$VOLUME" >/dev/null 2>&1 || true
      rm -rf "$DIR"
      echo "demo-instance: down ($DB, $VOLUME, $API, the auth service and the frontend removed)"
}

up() {
      down >/dev/null
      local busy=0 line
      for port in 55432 8080 3000 8000; do
            line=$(holder "$port")
            if [ -n "$line" ]; then echo "demo-instance: port $port is in use: $line" >&2; busy=1; fi
      done
      if [ "$busy" = 1 ]; then echo "demo-instance: free the ports first (this script stops nothing)" >&2; exit 1; fi
      mkdir -p "$DIR" && chmod 700 "$DIR"

      JWT_SECRET=$(openssl rand -base64 48)
      export JWT_SECRET
      export PHARE_ALLOWED_ORIGINS="http://$HOST:8000"
      export PHARE_DB_PATH="$DIR/auth.sqlite"
      export PORT=3000

      docker run -d --name "$DB" -p 127.0.0.1:55432:5432 -v "$VOLUME:/var/lib/postgresql/data" \
            -e POSTGRES_DB=phare_db -e POSTGRES_USER=phare_user -e POSTGRES_PASSWORD=phare_password postgres:16-alpine >/dev/null
      wait_for "$DB" 60 docker exec "$DB" pg_isready -h 127.0.0.1 -U phare_user -d phare_db

      # The API, from a copy of backend/: Maven writes its target/ there, not in the repository.
      cp -r "$ROOT/backend" "$DIR/backend" && rm -rf "$DIR/backend/target"
      mkdir -p "$HOME/.m2"
      docker run -d --name "$API" --network host --user "$(id -u):$(id -g)" -v "$HOME/.m2":/var/maven/.m2 \
            -e MAVEN_CONFIG=/var/maven/.m2 -v "$DIR/backend":/usr/src/app -w /usr/src/app -e JWT_SECRET -e PHARE_ALLOWED_ORIGINS \
            -e DATABASE_URL=jdbc:postgresql://localhost:55432/phare_db -e SERVER_PORT=8080 \
            maven:3.9.9-eclipse-temurin-17 mvn -q -B -Duser.home=/var/maven spring-boot:run >/dev/null

      # The auth service, from a copy of backend-node/ without node_modules, .env or database.sqlite.
      tar -C "$ROOT" -cf - --exclude=node_modules --exclude=.env --exclude=database.sqlite backend-node | tar -C "$DIR" -xf -
      (cd "$DIR/backend-node" && npm ci --no-audit --no-fund --loglevel=error)
      (cd "$DIR/backend-node" || exit 1
       nohup node -e "
            // phare-demo-login: the auth service as it is, listening on $HOST only
            const app = require('./server.js');
            require('./src/db/database').ready.then(() => app.listen(Number(process.env.PORT), '$HOST'));
       " >"$DIR/login.log" 2>&1 &
       echo $! >"$DIR/login.pid")
      wait_for "the auth service" 30 curl -sf "http://$HOST:3000/health"

      (cd "$ROOT/frontend" || exit 1
       nohup python3 -m http.server 8000 --bind "$HOST" >"$DIR/frontend.log" 2>&1 &
       echo $! >"$DIR/frontend.pid")
      wait_for "the frontend" 15 curl -sf -o /dev/null "http://$HOST:8000/login.html"

      # The demo account, with a password that meets the rules of the account script, never printed.
      local password
      password="D3mo-$(openssl rand -hex 8)!"
      (umask 077 && printf '%s\n' "$password" >"$DIR/demo-password")
      (cd "$DIR/backend-node" && PHARE_PASSWORD="$password" node scripts/create-user.js "$ACCOUNT" >/dev/null)
      echo "demo-instance: account $ACCOUNT created (its password is in $DIR/demo-password)"

      wait_for "the API" 420 api_is_401
      echo "demo-instance: up on $HOST: frontend http://$HOST:8000/login.html, auth service :3000, API :8080, database $DB on 55432"
}

case "${1:-}" in
      up) up ;;
      down) down ;;
      *) echo "usage: $0 up|down" >&2; exit 2 ;;
esac
