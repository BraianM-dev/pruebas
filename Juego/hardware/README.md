# Integración física

El juego se puede probar sin hardware. La integración básica se hace con una micro:bit por USB; el ESP32-C3 es opcional y sirve cuando la compañía necesita controlar el juego por la red local.

## micro:bit por USB

1. Abre `microbit_controller.py` en el editor Python de micro:bit y cárgalo en la placa.
2. En Chrome o Edge, abre la página publicada o una copia local y pulsa **Conectar placa**.
3. Autoriza el puerto serial de la micro:bit.

Controles: A cambia de héroe; B ataca; A+B lanza el D20; agitar explora una pista. El teclado también funciona: flecha arriba, espacio, D, H e I.

El firmware emite las mismas órdenes por USB, radio y UART. Para agrupar placas, asigna el mismo canal a las placas del equipo: `GROUP_CHANNEL = 10`, `15`, `20`, `25` o `30`. Conecta por USB una placa receptora al navegador, o usa el ESP32 como receptor UART.

## ESP32-C3 Super Mini (opcional)

1. Copia `esp32_c3_bridge.py` al ESP32-C3 con la herramienta MicroPython compatible con tu versión.
2. Alimenta la micro:bit y el ESP32 con GND común. Cableado UART cruzado, 115200 baudios:

   | ESP32-C3 | micro:bit | Señal |
   |---|---|---|
   | GPIO4 (TX) | P0 (RX) | ESP32 transmite hacia micro:bit |
   | GPIO5 (RX) | P1 (TX) | ESP32 recibe desde micro:bit |
   | GND | GND | Referencia común |

3. Cambia la clave del AP en el firmware antes de usarlo con estudiantes. El AP inicial es `PuenteMagico`; la dirección esperada es `http://192.168.4.1`.
4. Sirve el repositorio en la misma computadora con `python -m http.server 5500 --bind 0.0.0.0`, abre `http://localhost:5500/Juego/`, conéctate al AP del ESP32 y pulsa **Enlazar**.

Si el navegador bloquea la red local o CORS, utiliza Web Serial por USB. La placa ESP32 es una extensión, no un requisito de la actividad.
