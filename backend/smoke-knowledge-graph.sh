#!/bin/bash
# @lifecycle TEMPORARY — Smoke test for Knowledge Graph API (TASK-KG-001 P0.4)
# Usage: bash smoke-knowledge-graph.sh [base_url]
#   base_url defaults to http://localhost:3001/api/v1

set -euo pipefail

BASE_URL="${1:-http://localhost:3001/api/v1}"
PASS=0
FAIL=0

green() { echo -e "\033[32m✓ $1\033[0m"; }
red()   { echo -e "\033[31m✗ $1\033[0m"; }
step()  { echo -e "\033[36m\n── $1 ──\033[0m"; }

# --- Setup: register or login + promote ---
step "Setup: get user (register or login)"

# Try register first; if duplicate, fall back to login
REG_HTTP=$(curl -s -o /tmp/kg-reg.json -w '%{http_code}' -X POST "$BASE_URL/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"kg-smoke@floweng.dev","password":"Test1234!","name":"KG Smoke"}')

if [ "$REG_HTTP" = "201" ]; then
  USER_ID=$(python3 -c "import json;print(json.load(open('/tmp/kg-reg.json'))['data']['user']['id'])")
  green "registered user $USER_ID"
elif [ "$REG_HTTP" = "409" ]; then
  LOGIN_HTTP=$(curl -s -o /tmp/kg-login.json -w '%{http_code}' -X POST "$BASE_URL/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"kg-smoke@floweng.dev","password":"Test1234!"}')
  if [ "$LOGIN_HTTP" = "201" ]; then
    USER_ID=$(python3 -c "import json;print(json.load(open('/tmp/kg-login.json'))['data']['user']['id'])")
    green "logged in as existing user $USER_ID"
  else
    red "login failed (HTTP $LOGIN_HTTP)"; cat /tmp/kg-login.json
    exit 1
  fi
else
  red "register failed (HTTP $REG_HTTP)"; cat /tmp/kg-reg.json
  exit 1
fi

step "Setup: ensure ADMIN role"
docker exec floweng-db psql -U floweng -d floweng -c \
  "UPDATE users SET role = 'ADMIN' WHERE id = '$USER_ID';" > /dev/null 2>&1
green "promoted to ADMIN"

# Fresh token after role change
TOKEN=$(curl -sf -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"kg-smoke@floweng.dev","password":"Test1234!"}' | \
  python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")
green "obtained admin token"

AUTH="Authorization: Bearer $TOKEN"

# --- 1. POST node A ---
step "1. POST /knowledge/nodes (node-a)"
HTTP_CODE=$(curl -s -o /tmp/kg-node-a.json -w '%{http_code}' -X POST "$BASE_URL/knowledge/nodes" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"nodeId":"node-a","type":"REQUIREMENT","label":"Node A","module":"test"}')
# Idempotent: accept 201 (created) or 409 (already exists)
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "409" ]; then
  green "node-a → HTTP $HTTP_CODE"
  PASS=$((PASS + 1))
else
  red "node-a → HTTP $HTTP_CODE"; cat /tmp/kg-node-a.json
  FAIL=$((FAIL + 1))
fi

# --- 2. POST node B ---
step "2. POST /knowledge/nodes (node-b)"
HTTP_CODE=$(curl -s -o /tmp/kg-node-b.json -w '%{http_code}' -X POST "$BASE_URL/knowledge/nodes" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"nodeId":"node-b","type":"CODE","label":"Node B","module":"test"}')
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "409" ]; then
  green "node-b → HTTP $HTTP_CODE"
  PASS=$((PASS + 1))
else
  red "node-b → HTTP $HTTP_CODE"; cat /tmp/kg-node-b.json
  FAIL=$((FAIL + 1))
fi

# --- 3. POST node C ---
step "3. POST /knowledge/nodes (node-c)"
HTTP_CODE=$(curl -s -o /tmp/kg-node-c.json -w '%{http_code}' -X POST "$BASE_URL/knowledge/nodes" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"nodeId":"node-c","type":"ARCHITECTURE","label":"Node C","module":"test"}')
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "409" ]; then
  green "node-c → HTTP $HTTP_CODE"
  PASS=$((PASS + 1))
else
  red "node-c → HTTP $HTTP_CODE"; cat /tmp/kg-node-c.json
  FAIL=$((FAIL + 1))
fi

# --- 4. POST edge A→B ---
step "4. POST /knowledge/edges (A→B)"
HTTP_CODE=$(curl -s -o /tmp/kg-edge-ab.json -w '%{http_code}' -X POST "$BASE_URL/knowledge/edges" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"edgeId":"edge-ab","sourceNodeId":"node-a","targetNodeId":"node-b","type":"IMPLEMENTS"}')
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "409" ]; then
  green "edge A→B → HTTP $HTTP_CODE"
  PASS=$((PASS + 1))
else
  red "edge A→B → HTTP $HTTP_CODE"; cat /tmp/kg-edge-ab.json
  FAIL=$((FAIL + 1))
fi

# --- 5. POST edge B→C ---
step "5. POST /knowledge/edges (B→C)"
HTTP_CODE=$(curl -s -o /tmp/kg-edge-bc.json -w '%{http_code}' -X POST "$BASE_URL/knowledge/edges" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"edgeId":"edge-bc","sourceNodeId":"node-b","targetNodeId":"node-c","type":"DEPENDS_ON"}')
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "409" ]; then
  green "edge B→C → HTTP $HTTP_CODE"
  PASS=$((PASS + 1))
else
  red "edge B→C → HTTP $HTTP_CODE"; cat /tmp/kg-edge-bc.json
  FAIL=$((FAIL + 1))
fi

# --- 6. GET neighbors (node-a) ---
step "6. GET /knowledge/graph/neighbors?nodeId=node-a"
HTTP_CODE=$(curl -s -o /tmp/kg-neighbors.json -w '%{http_code}' \
  "$BASE_URL/knowledge/graph/neighbors?nodeId=node-a" -H "$AUTH")
if [ "$HTTP_CODE" = "200" ]; then
  OUTGOING=$(python3 -c "import json;d=json.load(open('/tmp/kg-neighbors.json'));dd=d.get('data',d);print(len(dd.get('outgoing',[])))")
  INCOMING=$(python3 -c "import json;d=json.load(open('/tmp/kg-neighbors.json'));dd=d.get('data',d);print(len(dd.get('incoming',[])))")
  if [ "$OUTGOING" -ge 1 ]; then
    green "neighbors: $OUTGOING outgoing, $INCOMING incoming"
    PASS=$((PASS + 1))
  else
    red "neighbors: expected ≥1 outgoing, got $OUTGOING"; cat /tmp/kg-neighbors.json
    FAIL=$((FAIL + 1))
  fi
else
  red "neighbors → HTTP $HTTP_CODE"; cat /tmp/kg-neighbors.json
  FAIL=$((FAIL + 1))
fi

# --- 7. GET impact (node-a, depth=5) ---
step "7. GET /knowledge/graph/impact?nodeId=node-a&depth=5"
HTTP_CODE=$(curl -s -o /tmp/kg-impact.json -w '%{http_code}' \
  "$BASE_URL/knowledge/graph/impact?nodeId=node-a&depth=5" -H "$AUTH")
if [ "$HTTP_CODE" = "200" ]; then
  NODES=$(python3 -c "import json;d=json.load(open('/tmp/kg-impact.json'));dd=d.get('data',d);print(len(dd.get('nodes',[])))")
  if [ "$NODES" -ge 2 ]; then
    green "impact: $NODES nodes found (expected ≥2: B + C)"
    PASS=$((PASS + 1))
  else
    red "impact: expected ≥2 nodes, got $NODES"; cat /tmp/kg-impact.json
    FAIL=$((FAIL + 1))
  fi
else
  red "impact → HTTP $HTTP_CODE"; cat /tmp/kg-impact.json
  FAIL=$((FAIL + 1))
fi

# --- 8. GET path (node-a → node-c) ---
step "8. GET /knowledge/graph/trace?fromNodeId=node-a&toNodeId=node-c"
HTTP_CODE=$(curl -s -o /tmp/kg-trace.json -w '%{http_code}' \
  "$BASE_URL/knowledge/graph/trace?fromNodeId=node-a&toNodeId=node-c" -H "$AUTH")
if [ "$HTTP_CODE" = "200" ]; then
  PARSED=$(python3 -c "import json;d=json.load(open('/tmp/kg-trace.json'));dd=d.get('data',d);print(dd.get('found',False));print(len(dd.get('path',[])))")
  FOUND=$(echo "$PARSED" | sed -n '1p')
  PATH_LEN=$(echo "$PARSED" | sed -n '2p')
  if [ "$FOUND" = "True" ] && [ "$PATH_LEN" -ge 2 ]; then
    green "path: found=$FOUND, path length=$PATH_LEN"
    PASS=$((PASS + 1))
  else
    red "path: found=$FOUND, length=$PATH_LEN"; cat /tmp/kg-trace.json
    FAIL=$((FAIL + 1))
  fi
else
  red "path → HTTP $HTTP_CODE"; cat /tmp/kg-trace.json
  FAIL=$((FAIL + 1))
fi

# --- Summary ---
step "SMOKE TEST SUMMARY"
echo "Passed: $PASS"
echo "Failed: $FAIL"
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  green "ALL $TOTAL SMOKE TESTS PASSED"
  exit 0
else
  red "$FAIL/$TOTAL SMOKE TESTS FAILED"
  exit 1
fi
