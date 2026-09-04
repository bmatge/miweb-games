FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
# Le site est servi tel quel : pas de build, pas de dependance. `.dockerignore`
# ecarte ce qui n'a rien a faire dans l'image (git, Dockerfile, compose, README).
COPY . /usr/share/nginx/html/
# nginx.conf doit rester dans le contexte de build (il alimente le COPY
# ci-dessus), mais n'a rien a faire dans les fichiers servis.
RUN rm -f /usr/share/nginx/html/nginx.conf

# 127.0.0.1 et non localhost : localhost resout en ::1, or nginx n'ecoute
# qu'en IPv4 ici. Un conteneur `unhealthy` serait exclu du load-balancer par
# Traefik v3 et rendrait un 404 alors que l'app tourne (piege connu spawn).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

EXPOSE 80
