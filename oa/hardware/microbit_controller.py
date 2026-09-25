"""Micro:bit V2: botones locales + radio del grupo + USB/UART al gateway.

Comandos aceptados por Juego/microbit.js:
NEXT_HERO, ATTACK, ROLL, HEAL y EXPLORE.
Cambiar GROUP_CHANNEL entre 10, 15, 20, 25 o 30 para separar grupos.
"""
from microbit import *
import radio
import uart

GROUP_CHANNEL = 10
COMMANDS = ("NEXT_HERO", "ATTACK", "ROLL", "HEAL", "EXPLORE")

radio.on()
radio.config(channel=GROUP_CHANNEL, power=6, length=32)
# Cableado del proyecto: ESP32 TX GPIO4 -> P0 (micro:bit RX),
# ESP32 RX GPIO5 <- P1 (micro:bit TX), GND común.
uart.init(baudrate=115200, tx=pin1, rx=pin0)

chord_locked = False
last_packet = ""
last_packet_at = running_time()

def send_to_game(command):
    """Emite por USB y UART y comparte el control con la compañía por radio."""
    print(command)
    uart.write(command + "\n")
    radio.send(command)
    display.show({"NEXT_HERO": "A", "ATTACK": "B", "ROLL": Image.DIAMOND,
                  "HEAL": Image.HEART, "EXPLORE": Image.COMPASS}.get(command, "?"))

def receive_from_party():
    """Reenvía a USB/UART los comandos de placas compañeras, sin retransmitir."""
    global last_packet, last_packet_at
    packet = radio.receive()
    if packet not in COMMANDS:
        return
    now = running_time()
    # Evita que varios rebotes de una misma pulsación ejecuten dos acciones.
    if packet == last_packet and now - last_packet_at < 250:
        return
    last_packet, last_packet_at = packet, now
    print(packet)
    uart.write(packet + "\n")

while True:
    if button_a.is_pressed() and button_b.is_pressed():
        # Consume both edge events so the chord doesn't also trigger A then B
        # after release.
        button_a.was_pressed()
        button_b.was_pressed()
        if not chord_locked:
            send_to_game("ROLL")
            chord_locked = True
    else:
        if chord_locked:
            # Keep draining button edges until both buttons have been released.
            button_a.was_pressed()
            button_b.was_pressed()
            if not button_a.is_pressed() and not button_b.is_pressed():
                chord_locked = False
        else:
            if button_a.was_pressed():
                send_to_game("NEXT_HERO")
            elif button_b.was_pressed():
                send_to_game("ATTACK")

    if accelerometer.was_gesture("shake"):
        send_to_game("EXPLORE")

    receive_from_party()
    sleep(35)
