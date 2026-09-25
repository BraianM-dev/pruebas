# Calabozos & Código · Sprint 2

`index.html` presenta el diseño del OA con narrativa, mapa de perfiles motivacionales, decisiones visuales y las fotografías del mockup físico aportadas para este proyecto. Su hoja visual está separada en `styles.css`.

La experiencia jugable está en [`../Juego/`](../Juego/), una ampliación del RPG que ya existe en el repositorio. Allí se combinan el tablero, héroes, enemigos, D20, cámara AR, desafíos de código, micro:bit y el narrador local.

## Publicación

- Diseño del OA: `https://braianm-dev.github.io/pruebas/oa/`
- Juego: `https://braianm-dev.github.io/pruebas/Juego/`

## Dungeon Master local con Ollama

La página publicada tiene relatos de respaldo. Para usar el modelo local, desde la raíz del repositorio abre dos terminales:

```bash
ollama pull llama3.2
pip install fastapi uvicorn httpx
uvicorn oa.gateway_oa:app --host 0.0.0.0 --port 8000
```

En la segunda terminal:

```bash
python -m http.server 5500 --bind 0.0.0.0
```

En el mismo equipo, abre `http://localhost:5500/Juego/`. Si otro equipo de la red jugará, abre `http://IP-DEL-EQUIPO:5500/Juego/` y la API usará el mismo nombre de host en el puerto 8000. Ollama usa `llama3.2` por defecto; define `OLLAMA_MODEL` para elegir otro modelo instalado. Sin Ollama, la aplicación entrega una narración de respaldo y continúa.

## Hardware

Las instrucciones de carga de micro:bit, canales de radio y cableado opcional del ESP32-C3 están en [`../Juego/hardware/README.md`](../Juego/hardware/README.md). La actividad conserva teclado y botones web si no hay placas disponibles.
