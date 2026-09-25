"""Puente opcional ESP32-C3: micro:bit UART <-> HTTP polling local.

Acceso inicial: AP PuenteMagico (clave por defecto: Calabozo26).
La web solicita /health y /events?after=<id>.
"""
import network
import socket
import time
import json
import ure
from machine import UART, Pin

AP_NAME = "PuenteMagico"
AP_PASSWORD = "Calabozo26"  # Cambiar antes de usar en un entorno compartido.
UART_BAUD = 115200
COMMANDS = ("NEXT_HERO", "ATTACK", "ROLL", "HEAL", "EXPLORE")
uart = UART(1, baudrate=UART_BAUD, tx=Pin(4), rx=Pin(5))
events = []
sequence = 0
uart_buffer = b""

ap = network.WLAN(network.AP_IF)
ap.active(True)
ap.config(essid=AP_NAME, password=AP_PASSWORD)
while not ap.active():
    time.sleep_ms(100)
ip = ap.ifconfig()[0]
print("Puente activo en http://%s" % ip)

def read_uart_events():
    global uart_buffer, sequence, events
    if not uart.any():
        return
    uart_buffer += uart.read() or b""
    while b"\n" in uart_buffer:
        raw, uart_buffer = uart_buffer.split(b"\n", 1)
        command = raw.decode().strip().upper()
        if command in COMMANDS:
            sequence += 1
            events.append({"id": sequence, "command": command})
            events = events[-40:]

def response(client, status, body, content_type="application/json"):
    if isinstance(body, dict) or isinstance(body, list):
        body = json.dumps(body)
    data = body.encode()
    head = ("HTTP/1.1 %s\r\n" % status +
            "Content-Type: %s; charset=utf-8\r\n" % content_type +
            "Content-Length: %d\r\n" % len(data) +
            "Access-Control-Allow-Origin: *\r\n" +
            "Access-Control-Allow-Methods: GET, OPTIONS\r\n" +
            "Cache-Control: no-store\r\nConnection: close\r\n\r\n")
    client.send(head.encode() + data)

def route(client, request):
    first = request.split("\r\n", 1)[0]
    parts = first.split()
    if len(parts) < 2:
        return response(client, "400 Bad Request", {"error": "peticion_invalida"})
    method, target = parts[0], parts[1]
    if method == "OPTIONS":
        return response(client, "204 No Content", "", "text/plain")
    if method != "GET":
        return response(client, "405 Method Not Allowed", {"error": "solo_get"})
    path, _, query = target.partition("?")
    if path == "/health":
        return response(client, "200 OK", {"ok": True, "ip": ip, "cursor": sequence})
    if path == "/events":
        match = ure.search(r"(?:^|&)after=(\d+)", query)
        after = int(match.group(1)) if match else 0
        return response(client, "200 OK", {"events": [event for event in events if event["id"] > after]})
    if path == "/send":
        return response(client, "410 Gone", {"error": "el_control_se_recibe_desde_microbit"})
    if path == "/":
        return response(client, "200 OK", {"servicio": "PuenteMagico", "estado": "listo", "ip": ip})
    return response(client, "404 Not Found", {"error": "no_encontrado"})

server = socket.socket()
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind(("0.0.0.0", 80))
server.listen(3)
server.settimeout(0.05)

while True:
    read_uart_events()
    try:
        client, _ = server.accept()
    except OSError:
        continue
    try:
        client.settimeout(0.5)
        request = client.recv(1024).decode()
        route(client, request)
    except Exception as error:
        try:
            response(client, "500 Internal Server Error", {"error": "error_puente"})
        except Exception:
            pass
    finally:
        client.close()
