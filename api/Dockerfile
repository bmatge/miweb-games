FROM node:22-alpine
WORKDIR /app
COPY server.js .
# /data porte le volume des scores ; l'utilisateur `node` doit pouvoir y ecrire.
RUN mkdir -p /data && chown node:node /data
USER node
ENV SCORES_FICHIER=/data/scores.json PORT=3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/sante || exit 1
EXPOSE 3000
CMD ["node", "server.js"]
