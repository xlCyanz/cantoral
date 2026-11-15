#!/bin/bash
# Las muestras de la prueba de audio y video de Configuración
# (src/lib/pruebaDeFormatos.ts): un segundo de tono, y en los videos una
# imagen de 64×36, con el códec más común de cada contenedor. Pesan unos
# 200 KB entre todas. Se vuelven a hacer con:
#
#   scripts/muestras-de-formato.sh
#
# Hace falta ffmpeg con libx264, libvpx, libopus y libmp3lame.
set -e
cd "$(dirname "$0")/../public/pruebas-de-formato"
A="-f lavfi -i sine=frequency=440:duration=1:sample_rate=22050"
A48="-f lavfi -i sine=frequency=440:duration=1:sample_rate=48000"
V="-f lavfi -i testsrc=size=64x36:rate=10:duration=1"
Q="-y -loglevel error"
ffmpeg $Q $A -ac 1 -c:a libmp3lame -b:a 32k prueba.mp3
ffmpeg $Q $A -ac 1 -c:a flac prueba.flac
ffmpeg $Q $A -ac 1 -c:a pcm_s16le prueba.wav
ffmpeg $Q $A -ac 1 -c:a aac -b:a 32k prueba.m4a
ffmpeg $Q $A -ac 1 -c:a aac -b:a 32k -f adts prueba.aac
ffmpeg $Q $A -ac 2 -c:a vorbis -strict -2 prueba.ogg
ffmpeg $Q $A48 -ac 1 -c:a libopus -b:a 16k prueba.opus
ffmpeg $Q $A -ac 1 -c:a pcm_s16be prueba.aiff
ffmpeg $Q $A -ac 1 -c:a wmav2 -b:a 32k prueba.wma
ffmpeg $Q $V $A -ac 1 -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 32k -movflags +faststart prueba.mp4
ffmpeg $Q $V $A -ac 1 -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 32k -movflags +faststart prueba.mov
ffmpeg $Q $V $A -ac 1 -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 32k -movflags +faststart -f mp4 prueba.m4v
ffmpeg $Q $V $A48 -ac 1 -c:v libvpx-vp9 -b:v 50k -c:a libopus -b:a 16k prueba.webm
ffmpeg $Q $V $A -ac 1 -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 32k prueba.mkv
ffmpeg $Q $V $A -ac 1 -c:v mpeg4 -vtag xvid -c:a libmp3lame -b:a 32k prueba.avi
ffmpeg $Q $V $A -ac 1 -c:v wmv2 -c:a wmav2 -b:a 32k prueba.wmv
