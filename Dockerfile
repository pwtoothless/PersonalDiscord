FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Copy web files into the Nginx webroot
COPY . .

# Update Nginx to listen on port 30081 to match your proxy config
RUN sed -i 's/80/30081/g' /etc/nginx/conf.d/default.conf

EXPOSE 30081