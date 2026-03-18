#!/bin/sh
set -e

# DBマイグレーションを適用してからサーバー起動
npx prisma migrate deploy

exec node server.js
