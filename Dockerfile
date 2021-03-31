FROM node:12 as builder

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

COPY package.json package-lock.json ./
RUN npm ci

FROM node:12

WORKDIR /usr/src/app

COPY --from=builder node_modules node_modules

COPY . .

CMD ["node", "app.js"]
