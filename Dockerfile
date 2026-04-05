# Use a lightweight Node.js environment
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of your game code
COPY . .

# Cloud Run injects the PORT dynamically, but defaults to 8080
ENV PORT=8080
EXPOSE 8080

# Start the server
CMD [ "node", "server.js" ]