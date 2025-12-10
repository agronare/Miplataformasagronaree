# Multi-stage Dockerfile: build client and run Node server
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY .env.example ./
EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "server/index.cjs"]
