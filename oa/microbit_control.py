from microbit import *
while True:
    if button_a.is_pressed() and button_b.is_pressed():print("AB");display.show(Image.YES);sleep(450)
    elif button_a.was_pressed():print("A");display.show("A")
    elif button_b.was_pressed():print("B");display.show("B")
    sleep(40)
