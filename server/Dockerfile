FROM node:18-alpine

WORKDIR /app

# Copy only what we need for the license server
COPY package.json package-lock.json* ./
RUN npm install --only=production || npm install --only=production

COPY server/license-server.js server/license-server.js
COPY tools/license-generator.js tools/license-generator.js

ENV PORT=8088
EXPOSE 8088

CMD ["node", "server/license-server.js"]

