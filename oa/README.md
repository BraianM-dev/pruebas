# Calabozos & Código · Objeto de Aprendizaje

OA para el Sprint 2: convierte el tablero grabado a láser en la **Cripta del Algoritmo**, una aventura donde HTML, CSS, JavaScript, IA local y conectividad son cinco runas por recuperar.

## Qué incluye

- `index.html` y `styles.css`: narrativa, mapa de los cuatro perfiles motivacionales, mockup basado en las fotos reales, paleta, tipografías y nota de uso de IAG.
- `DISENO.md`: documento ampliado de diseño y decisiones pedagógicas.
- `juego/`: juego de campaña con retos, progreso local, narración del Dungeon Master, controles web y conexión opcional a placas.
- `hardware/`: programas MicroPython para micro:bit y ESP32-C3 Super Mini, además de cableado y pasos de instalación.
- `gateway_oa.py`: API local que conecta el juego a Ollama. Si no hay modelo o servidor, el juego conserva narraciones de respaldo.
- `assets/`: logo y fotografías del tablero entregadas para este proyecto.

## Ejecutar en la computadora del aula

En una terminal, desde la raíz del repositorio:

```bash
cd oa
python -m http.server 5500 --bind 0.0.0.0
```

Abre `http://localhost:5500/` para el diseño o `http://localhost:5500/juego/` para jugar.

### Dungeon Master con Ollama (opcional)

En otra terminal:

```bash
cd oa
python -m pip install -r requirements.txt
ollama pull llama3.2
uvicorn gateway_oa:app --host 0.0.0.0 --port 8000
```

La API usa `llama3.2` por defecto. Puedes seleccionar otro modelo instalado con la variable `OLLAMA_MODEL`. El relato se genera localmente y no determina dados, daño ni progreso. Si Ollama no está instalado o disponible, el juego usa respuestas de respaldo.

## Placas

La aventura funciona también sin placas. Para micro:bit, carga `hardware/microbit_controller.py` y conecta por USB desde Chrome o Edge en localhost. A cambia el héroe, B ataca, A+B lanza el D20 y agitar busca una pista.

El ESP32-C3 Super Mini es opcional: consulta `hardware/README.md` para el puente Wi-Fi/UART y el cableado. Utiliza una red de pruebas del aula y cambia la clave predeterminada antes de usar el punto de acceso.

## Publicación y realidad aumentada

La página de diseño queda en `https://braianm-dev.github.io/pruebas/oa/` y el juego en `https://braianm-dev.github.io/pruebas/oa/juego/`. En GitHub Pages, el juego conserva los controles web; Ollama requiere ejecutar la página y la API en la red local.

El panel de realidad aumentada reutiliza la experiencia y los marcadores que ya existían en la raíz del repositorio (`index.html`, `Marcadores/` y `modelos/`). Esta entrega añade únicamente la carpeta `oa/`; esos archivos existentes no se modifican.
