FROM node:alpine
MAINTAINER St. John Johnson <st.john.johnson@gmail.com> and Jeremiah Wuenschel <jeremiah.wuenschel@gmail.com>

# Create our application direcory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Copy and install dependencies
COPY package.json /usr/src/app/
RUN npm install --production

# Copy everything else
COPY . /usr/src/app

# Expose Configuration Volume
VOLUME /config

# Set config directory
ENV CONFIG_DIR=/config

# Expose the web service port
EXPOSE 8080

# Run the service
CMD [ "npm", "start" ]
