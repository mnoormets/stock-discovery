# Lihtne dev-image: käivitab Next.js arendusserveri.
# Personaalseks lokaalseks tööriistaks piisab dev-režiimist (kiirem, lihtsam mõista).
FROM node:20-slim

WORKDIR /app

# Paigalda ainult sõltuvused (kiirem cache)
COPY package.json package-lock.json ./
RUN npm ci

# Ülejäänud kood tuleb docker-compose bind-mountiga (live edit)
COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
