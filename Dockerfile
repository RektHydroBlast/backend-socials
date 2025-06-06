# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies including node-gyp requirements
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package.json yarn.lock ./

# Install corepack (needed for yarn)
RUN npm install -g corepack@0.24.1 && corepack enable

# Set yarn to ignore optional dependencies and platform-specific packages
ENV YARN_IGNORE_OPTIONAL=1
ENV YARN_IGNORE_PLATFORM=1

# Install dependencies
RUN yarn install --network-timeout 600000

# Copy the rest of the application
COPY . .

# Build the application
RUN yarn build

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["yarn", "start"]
