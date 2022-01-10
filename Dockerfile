FROM node:14.16.1-alpine
RUN apk update && apk add imagemagick ghostscript poppler-utils
WORKDIR /app
COPY . .
RUN npm install
RUN npm test