FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Copy web files into the Nginx webroot
COPY . .

# Update Nginx to listen on port 443 to match your proxy config
RUN sed -i 's/80/443/g' /etc/nginx/conf.d/default.conf

EXPOSE 443