FROM node:14.18.2-alpine
RUN apk update && apk add imagemagick ghostscript poppler-utils
WORKDIR /app
COPY . .
RUN npm ci
RUN npm test
