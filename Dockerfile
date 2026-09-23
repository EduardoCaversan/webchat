# Local-only image: no Firebase account, deploy credentials or billing required.
FROM eclipse-temurin:21-jre-jammy AS java
FROM node:22-bookworm-slim

COPY --from=java /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="/opt/java/openjdk/bin:${PATH}"
ENV CI=true \
    FIREBASE_CLI_DISABLE_UPDATE_CHECK=true

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Fetch emulator binaries during build, not on the first browser request.
RUN npx firebase setup:emulators:firestore && npx firebase setup:emulators:ui

# Copy only runtime/build inputs; unrelated files and credentials never enter the image.
COPY src ./src
COPY public ./public
COPY docker ./docker
COPY tsconfig.json vite.config.ts index.html firebase.json firestore.rules firestore.indexes.json ./
# Explicit demo values take precedence over any local environment.
ENV VITE_FIREBASE_API_KEY=demo-api-key \
    VITE_FIREBASE_AUTH_DOMAIN=demo-entre.firebaseapp.com \
    VITE_FIREBASE_PROJECT_ID=demo-entre \
    VITE_FIREBASE_APP_ID=1:123456789:web:demo \
    VITE_USE_EMULATORS=true
RUN npm run build

ENV GCLOUD_PROJECT=demo-entre \
    FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 \
    FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
EXPOSE 5173 4000 9099 8180 4400 9150
CMD ["node", "docker/start.mjs"]
