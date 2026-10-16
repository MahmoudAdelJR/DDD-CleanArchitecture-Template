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
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist/DDD-CleanArchitecture-Template/browser /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
