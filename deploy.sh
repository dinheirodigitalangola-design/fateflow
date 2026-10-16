#!/usr/bin/env bash
# FateFlow — deploy na VPS (correr como root ou com docker disponível).
# Uso: ./deploy.sh
# Segredos: pedidos/gerados na hora, guardados só em .env (chmod 600). Nada é commitado.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/fateflow}"
REPO_URL="${REPO_URL:-}"   # ex: export REPO_URL=git@github.com:org/fateflow.git (ou deixa vazio se o código já está na VPS)

echo "== 1. Código =="
if [ -n "$REPO_URL" ]; then
  [ -d "$APP_DIR/.git" ] || git clone "$REPO_URL" "$APP_DIR"
  git -C "$APP_DIR" pull --ff-only
  cd "$APP_DIR"
else
  echo "REPO_URL vazio — a usar código já existente em $(pwd)"
  [ -f docker-compose.yml ] || { echo "ERRO: corre ./deploy.sh dentro da pasta do código (onde está docker-compose.yml)"; exit 1; }
fi

echo "== 2. .env (criado 1x, nunca commitado) =="
if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
  MYSQL_ROOT_PASSWORD="$(openssl rand -base64 24)"
  MYSQL_PASSWORD="$(openssl rand -base64 24)"
  SESSION_SECRET="$(openssl rand -base64 48)"
  echo "Preenche no .env (nano .env):"
  echo "  MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD"
  echo "  MYSQL_PASSWORD=$MYSQL_PASSWORD"
  echo "  DATABASE_URL=mysql://fateflow:${MYSQL_PASSWORD}@mysql:3306/fateflow"
  echo "  APP_URL=https://fateflow.ddaorven.com"
  echo "  GOOGLE_CLIENT_ID=<do Google Cloud Console>"
  echo "  GOOGLE_CLIENT_SECRET=<do Google Cloud Console>"
  echo "  SESSION_SECRET=$SESSION_SECRET"
  echo "--- ABORTADO: preenche o .env e volta a correr ./deploy.sh ---"
  exit 1
fi

echo "== 3. MySQL (interno, sem porta exposta) =="
set -a; . ./.env; set +a
docker compose up -d mysql
docker compose exec -T mysql mysqladmin ping -h localhost -u fateflow -p"$MYSQL_PASSWORD" --wait=120

echo "== 4. Build da app =="
docker compose up -d --build app

echo "== 5. Migrations =="
docker compose run --rm app pnpm db:migrate

echo "== 6. Seed (2x p/ provar idempotência) =="
docker compose run --rm app pnpm db:seed
docker compose run --rm app pnpm db:seed
docker compose exec -T mysql mysql -u fateflow -p"$MYSQL_PASSWORD" fateflow \
  -e "SELECT (SELECT COUNT(*) FROM works) AS works, (SELECT COUNT(*) FROM episodes) AS episodes, (SELECT COUNT(*) FROM routes) AS routes, (SELECT COUNT(*) FROM route_items) AS route_items;"
echo "^ esperado: works=15 routes=4 route_items=26 episodes=150"

echo "== 7. Smoke test local =="
sleep 3
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS -X POST "http://127.0.0.1:3000/api/trpc/catalog.list?batch=1" -H 'Content-Type: application/json' -d '{"0":{}}' | head -c 200; echo

echo "== 8. Caddy =="
echo "Adiciona o conteúdo de Caddyfile.fateflow ao Caddyfile do host e faz:"
echo "  caddy fmt --overwrite /etc/caddy/Caddyfile && systemctl reload caddy"
echo "Depois testa: https://fateflow.ddaorven.com/api/health"

echo "== 9. Smoke test público (após Caddy) =="
echo "  curl https://fateflow.ddaorven.com/api/health"
echo "  Login Google fim-a-fim no browser + marcar episódio + 2ª conta"
echo "== DEPLOY OK =="
