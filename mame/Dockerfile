# CloverArcade -- MAME native sidecar
#
# Runs real MAME (GPL-2.0, https://www.mamedev.org/) inside a containerised
# desktop session and streams it to the browser over KasmVNC
# (https://github.com/kasmtech/KasmVNC), using LinuxServer.io's KasmVNC
# baseimage (GPL-3.0, https://github.com/linuxserver/docker-baseimage-kasmvnc).
# Thank you to all three teams.
#
# Why this exists: EmulatorJS runs mame2003-plus / FBNeo cores, which cover the
# classics but not modern MAME romsets (0.2xx+), 3D arcade hardware, or MAME's
# own front-end UI. This sidecar covers that gap with the real binary.

FROM lscr.io/linuxserver/baseimage-kasmvnc:debianbookworm

LABEL org.opencontainers.image.title="CloverArcade MAME Cabinet" \
      org.opencontainers.image.vendor="MyClover.Tech" \
      org.opencontainers.image.description="Native MAME streamed to the browser via KasmVNC" \
      org.opencontainers.image.licenses="GPL-3.0-or-later"

ENV TITLE="CloverArcade Cabinet" \
    MAME_ROM_PATH="/roms/arcade" \
    MAME_GAME="" \
    MAME_EXTRA_ARGS="" \
    START_DOCKER=false

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        mame \
        mame-data \
        libsdl2-2.0-0 \
        libsdl2-ttf-2.0-0 \
        pulseaudio \
        alsa-utils \
        fonts-dejavu-core \
        xterm; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY root/ /

RUN chmod +x /usr/local/bin/clover-mame

EXPOSE 3000 3001
VOLUME ["/config", "/roms"]
