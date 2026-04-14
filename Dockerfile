# Estágio 1: Build do Frontend (React)
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Estágio 2: Servidor de Produção
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY server.js ./
COPY --from=build /app/dist ./dist

EXPOSE 4000
CMD ["npm", "start"]
