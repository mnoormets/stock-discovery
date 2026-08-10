FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY scheduler.js ./
CMD ["node", "scheduler.js"]
