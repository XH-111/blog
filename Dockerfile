FROM docker.m.daocloud.io/library/node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY backend ./backend
COPY public ./public

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8000

EXPOSE 8000

CMD ["sh", "-c", "node backend/scripts/migrate.js && node backend/src/server.js"]
