FROM node:13
# Create app directory
RUN mkdir -p /usr/src/k8sreport
WORKDIR /usr/src/k8sreport
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8798
CMD [ "npm", "start" ]
