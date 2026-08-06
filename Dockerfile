# CloverArcade -- self-hosted arcade/console emulation front-end
# Stage 1: fetch EmulatorJS (GPL-3.0, https://github.com/EmulatorJS/EmulatorJS)
FROM alpine:3.20 AS fetch
ARG EMULATORJS_VERSION=4.2.1
RUN apk add --no-cache curl unzip
WORKDIR /src
RUN curl -fsSL -o ejs.zip \
      "https://github.com/EmulatorJS/EmulatorJS/releases/download/v${EMULATORJS_VERSION}/${EMULATORJS_VERSION}.zip" \
 && mkdir -p /out/emulatorjs \
 && unzip -q ejs.zip -d /out/emulatorjs \
 && rm ejs.zip \
 && ls /out/emulatorjs

# Stage 2: runtime
FROM nginx:1.27-alpine
LABEL org.opencontainers.image.title="CloverArcade" \
      org.opencontainers.image.vendor="MyClover.Tech" \
      org.opencontainers.image.description="Self-hosted arcade-style web front-end for open-source emulators (EmulatorJS / libretro)" \
      org.opencontainers.image.licenses="GPL-3.0-or-later"

RUN apk add --no-cache jq bash tini

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY ui/ /usr/share/nginx/html/
COPY --from=fetch /out/emulatorjs/ /usr/share/nginx/html/emulatorjs/

RUN chmod +x /usr/local/bin/entrypoint.sh \
 && mkdir -p /roms /saves

VOLUME ["/roms", "/saves"]
EXPOSE 80
ENV ARCADE_NAME="CloverArcade" \
    ARCADE_TAGLINE="Insert Coin" \
    ARCADE_THREADS="4"

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
