FROM node:20-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install to handle package.json changes)
RUN npm install

# Copy source code
COPY . .

# Set environment variable to fix crypto issue
ENV NODE_OPTIONS="--openssl-legacy-provider"

# The build will use environment variables passed in at build time
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

# Build the app
RUN npm run build

# For development (default)
FROM node:20-alpine as dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# For production
FROM nginx:alpine as prod
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]