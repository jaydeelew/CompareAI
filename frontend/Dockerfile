FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install to handle package.json changes)
RUN npm install

# Copy source code
COPY . .

EXPOSE 5173

# Set environment variable to fix crypto issue
ENV NODE_OPTIONS="--openssl-legacy-provider"

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"] 