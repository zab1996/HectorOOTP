FROM nginx:alpine
COPY . /usr/share/nginx/html
# Prefer index.html; HTML pages are at site root
EXPOSE 80
