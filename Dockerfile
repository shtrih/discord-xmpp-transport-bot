FROM node:14

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

CMD ["node", "app.js"]
