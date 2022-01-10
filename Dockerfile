FROM node:14.16.1-alpine

RUN apk update && apk add git openssh-client vim python py-pip jq
RUN apk add automake autoconf libtool dpkg pkgconfig nasm libpng
RUN pip install awscli
RUN apk --purge -v del py-pip
RUN apk add imagemagick ghostscript poppler-utils
# yarn needs to be explictly installed in both stages because kaniko deletes
# the filesystem before stages
RUN apk add --no-cache yarn

RUN rm /var/cache/apk/*

WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
# npmrc with JFrog token should be in /kaniko/ which is persisted across stages
#RUN HOME=/kaniko/ yarn install --frozen-lockfile

COPY . .
RUN yarn test
