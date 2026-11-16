FROM node:24-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM dunglas/frankenphp:1-php8.4 AS app
RUN install-php-extensions pdo_pgsql gd intl opcache zip
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

ENV APP_ENV=prod \
    APP_DEBUG=0 \
    trustedproxies=REMOTE_ADDR \
    COMPOSER_ALLOW_SUPERUSER=1

WORKDIR /app
COPY api/composer.json api/composer.lock api/symfony.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-progress

COPY api/ ./
COPY --from=web /web/dist/ ./public/
RUN composer dump-autoload --no-dev --classmap-authoritative \
    && composer dump-env prod \
    && php bin/console cache:warmup

RUN useradd --system --no-create-home app \
    && setcap -r /usr/local/bin/frankenphp \
    && mkdir -p var \
    && chown -R app:app var /config/caddy /data/caddy

COPY start.sh /usr/local/bin/start
RUN chmod +x /usr/local/bin/start

USER app
EXPOSE 8080
CMD ["start"]
