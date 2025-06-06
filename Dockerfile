FROM node:18-alpine

WORKDIR /app

# Install system dependencies including additional tools for AI packages
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Use corepack for pnpm
RUN corepack enable
RUN corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml ./

# Install dependencies (without postinstall script running build)
RUN pnpm install --frozen-lockfile --unsafe-perm

# Copy source code AFTER installing dependencies
COPY . .

# Now build the application
RUN pnpm build

EXPOSE 3001
CMD ["pnpm", "start"]
