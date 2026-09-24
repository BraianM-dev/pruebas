# Sprint 2 · Calabozos & Código

Objeto de aprendizaje gamificado que funciona como sitio estático y añade integraciones opcionales.

## Uso básico
Abre `oa/index.html` desde GitHub Pages. A cambia opción, B valida y Enter avanza. El progreso se conserva en el navegador.

## micro:bit por USB
1. Carga `microbit_control.py` con el editor Python de micro:bit.
2. Conecta la placa y abre la web en Chrome/Edge mediante HTTPS.
3. Pulsa **Conectar micro:bit** y selecciona el puerto.
4. A cambia opción, B valida y A+B avanza.

## Dungeon Master local con Ollama
```bash
ollama pull llama3.2
pip install fastapi uvicorn httpx
cd oa
uvicorn gateway_oa:app --host 0.0.0.0 --port 8000
```
El sitio intenta acceder a `localhost:8000`. Si el navegador bloquea el acceso desde HTTPS, sirve también `oa` localmente con `python -m http.server 5500`.

## ESP32-C3 Super Mini
Es una extensión opcional como puente Wi-Fi/UART. La versión base usa micro:bit por USB para reducir puntos de falla. Una etapa posterior puede enviar los mismos comandos `A`, `B` y `AB` por UART o WebSocket.
