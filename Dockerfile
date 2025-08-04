# Use Node.js Alpine image for smaller size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
# Skip prepare script during installation
RUN npm ci --ignore-scripts

# Copy all source files
COPY . .

# Build the TypeScript code
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Default to stdio mode, can be overridden
ENV MODE=stdio
ENV HOST=0.0.0.0
ENV PORT=3000

# Run the appropriate server based on MODE
CMD ["sh", "-c", "if [ \"$MODE\" = \"sse\" ]; then node dist/server-sse.js; else node dist/index.js; fi"]