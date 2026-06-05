# Flow backend — production image for the VPS.
FROM node:20-slim AS build
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend
RUN npm install --no-audit --no-fund
# Source (backend + shared types it imports across the repo root)
COPY backend/ /app/backend/
COPY shared/ /app/shared/
RUN npm run build

FROM node:20-slim AS runtime
ENV NODE_ENV=production
# Tell the app exactly where the shared/ dir (prompts) lives — robust regardless
# of the compiled directory layout.
ENV FLOW_SHARED_DIR=/app/shared
WORKDIR /app/backend
COPY --from=build /app/backend/package.json ./
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
# Prompts (.md) are read at runtime and are not emitted by tsc.
COPY --from=build /app/shared /app/shared
EXPOSE 8080
CMD ["node", "dist/backend/src/server.js"]
