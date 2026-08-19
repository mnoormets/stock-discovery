FROM node:20-slim
# node-cron ajastab Tallinna aja järgi; docker-compose.yml seab sama väärtuse.
ENV TZ=Europe/Tallinn
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY scheduler.js ./
CMD ["node", "scheduler.js"]
