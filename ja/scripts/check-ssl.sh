#!/usr/bin/env bash
# SSL強制の「前」と「後」で、同じテストを回すスクリプトです。
# わざと間違ったパスワードで接続して、「どの段階で断られるか」を見ます（本物のパスワードは使いません）。
#
# 使い方:
#   export PGHOST="aws-0-<リージョン>.pooler.supabase.com"   # ダッシュボードの Connect → Session pooler
#   export PGUSER="postgres.<PROJECT_REF>"
#   ./scripts/check-ssl.sh
set -u

: "${PGHOST:?PGHOST を設定してください（READMEを参照）}"
: "${PGUSER:?PGUSER を設定してください（READMEを参照）}"
command -v psql >/dev/null || { echo "psql が見つかりません（PostgreSQLのクライアントを入れてください）"; exit 1; }

for mode in disable require; do
  printf "sslmode=%-8s -> " "$mode"
  # PGPASSWORD は、わざと間違った値です。環境にある本物のパスワードを使わないよう、ここで上書きします。
  PGPASSWORD=wrong-on-purpose PGCONNECT_TIMEOUT=10 psql \
    "host=$PGHOST port=5432 dbname=postgres user=$PGUSER sslmode=$mode" \
    -c "select 1" 2>&1 | head -1
done
