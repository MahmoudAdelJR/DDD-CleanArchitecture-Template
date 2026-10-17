# ---- build stage -------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
# Reproducible install from the lockfile
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY angular.json tsconfig*.json ./
COPY src ./src
COPY public ./public
RUN npm run build

# ---- runtime stage -----------------------------------------------------
FROM nginx:1.27-alpine
ENV APP_API_BASE_URL=/api \
    APP_TRUSTED_ORIGINS=[] \
    APP_SUPPORTED_LOCALES='["en","fr"]' \
    APP_DEFAULT_LOCALE=en \
    APP_MOCK_API=false \
    NGINX_ENVSUBST_OUTPUT_DIR=/usr/share/nginx/html/config
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist/DDD-CleanArchitecture-Template/browser /usr/share/nginx/html
RUN mkdir -p /usr/share/nginx/html/config
COPY deploy/app-config.json.template /etc/nginx/templates/app-config.json.template

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
