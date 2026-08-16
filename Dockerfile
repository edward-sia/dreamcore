# hiraeth — game + leaderboard in one container.
#   docker build -t hiraeth .
#   docker run -p 8091:8091 -v hiraeth-data:/data hiraeth

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8091 DATA_DIR=/data
COPY --from=build /app/dist ./dist
COPY server ./server
VOLUME /data
EXPOSE 8091
CMD ["node", "server/server.mjs"]
