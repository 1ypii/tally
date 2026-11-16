#!/bin/sh
set -e

export SERVER_NAME=":${PORT:-8080}"

php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration
exec frankenphp run --config /etc/frankenphp/Caddyfile
