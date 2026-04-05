FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

ENV REACT_APP_API_URL=/api
ENV CHOKIDAR_USEPOLLING=true
ENV WDS_SOCKET_PORT=0

CMD ["npm", "start"]
