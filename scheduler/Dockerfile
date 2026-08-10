FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install
COPY scheduler.js ./
CMD ["node", "scheduler.js"]
