FROM node:22-alpine

WORKDIR /app

# Install dependencies first (better cache)
COPY package*.json ./

RUN npm install

# Copy project
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]