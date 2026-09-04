FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html

# 127.0.0.1 et non localhost : localhost resout en ::1, or nginx n'ecoute
# qu'en IPv4 ici. Un healthcheck en echec rend le conteneur `unhealthy`, et
# Traefik v3 exclut alors le conteneur du load-balancer -> 404 (piege connu
# des migrations vers spawn).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

EXPOSE 80
