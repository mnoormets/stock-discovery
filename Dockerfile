# Lihtne dev-image: käivitab Next.js arendusserveri.
# Personaalseks lokaalseks tööriistaks piisab dev-režiimist (kiirem, lihtsam mõista).
FROM node:22-slim

# Tallinna kalendripäev on äriloogika, mitte kuvaeelistus. docker-compose.yml
# seab sama väärtuse; see rida hoiab image'i korrektseks ka siis, kui keegi
# ehitab või käivitab selle compose'ist mööda.
ENV TZ=Europe/Tallinn

WORKDIR /app

# Paigalda ainult sõltuvused (kiirem cache)
COPY package.json package-lock.json ./
RUN npm ci

# Ülejäänud kood tuleb docker-compose bind-mountiga (live edit)
COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
