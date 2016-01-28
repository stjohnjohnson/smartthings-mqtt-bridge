FROM node:4-onbuild
MAINTAINER St. John Johnson <st.john.johnson@gmail.com> and Jeremiah Wuenschel <jeremiah.wuenschel@gmail.com>

# Expose Configuration Volume
VOLUME /config

# Set config directory
ENV CONFIG_DIR=/config

# Expose the web service port
EXPOSE 8080
