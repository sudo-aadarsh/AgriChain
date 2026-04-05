FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Create default .env if not present
RUN cp .env.example .env 2>/dev/null || true

EXPOSE 5000

CMD ["npm", "run", "dev"]
