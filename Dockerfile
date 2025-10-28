FROM node:20-alpine

RUN apk add --no-cache ffmpeg bash

WORKDIR /app

COPY package*.json /app

RUN npm install 

COPY . .

EXPOSE 3000

CMD ["npx", "nodemon", "--watch", "src", "--exec", "ts-node", "src/index.ts"]