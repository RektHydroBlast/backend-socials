# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies including node-gyp requirements
RUN apk add --no-cache python3 make g++ git

# Enable corepack and use specific pnpm version
RUN corepack enable
RUN corepack prepare pnpm@8.15.0 --activate

# Copy package configuration files
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY .pnpmrc* ./

# Install dependencies with better error handling
RUN pnpm install --frozen-lockfile --unsafe-perm || \
    (echo "Frozen lockfile failed, trying without..." && pnpm install --unsafe-perm)

# Copy the rest of the application
COPY . .

# Build the application
RUN pnpm build

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["pnpm", "start"]
