# ---- Stage 1: Build the Vite frontend ----------------------------------------
FROM node:22-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/package.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Run the unified Express server ----------------------------------
FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY mock-server.js ./
# Copy the built frontend assets into ./dist so Express can serve them
COPY --from=frontend-build /frontend/dist ./dist

EXPOSE 6330

CMD ["node", "mock-server.js"]
