# 🐉 Proyecto Educativo: Realidad Aumentada & Hardware
**Destinado a estudiantes de UTU.**

Este proyecto es una plantilla de Realidad Aumentada (AR) diseñada para ejecutarse en el navegador. En el transcurso del semestre lo expandiremos para conectarlo con placas **micro:bit**, **ESP32** y crear un juego interactivo de tablero (tipo Calabozos y Dragones).

---

## 🛠️ ¿Qué tecnologías estamos usando?

1. **[A-Frame](https://aframe.io/):** Es un marco de trabajo (framework) para crear experiencias de realidad virtual y 3D directamente usando etiquetas HTML. No requiere instalar programas complejos.
2. **[AR.js](https://ar-js-org.github.io/AR.js-Docs/):** Es una librería súper rápida que usa la cámara de tu celular o computadora para detectar "marcadores" en el mundo real y renderizar objetos 3D sobre ellos.
3. **Modelos 3D:**
   * **GLB:** Es el formato estándar y moderno para modelos 3D en la web. Es ligero, rápido e incluye texturas y animaciones en un solo archivo.
   * **FBX:** Un formato muy popular en la industria de los videojuegos. Aquí lo usamos mediante un complemento (`aframe-extras`).
4. **GitHub Pages:** Nos permite alojar nuestro proyecto de forma gratuita para que cualquiera pueda acceder desde su celular escaneando un código QR.

---

## 🏷️ Tipos de Marcadores

En la carpeta `/marcadores` (o imprimiéndolos por tu cuenta) encontrarás los patrones que la cámara debe reconocer. El código está preparado para detectar tres tipos:

* **Hiro:** El marcador clásico de AR.js.
* **Kanji:** Otro marcador por defecto.
* **Barcode (4x4 BCH 13,5,5):** Códigos de barras de matriz cuadrada. ¡Podemos tener decenas de estos marcadores diferentes simplemente cambiando un número! Ideal para tableros con muchas casillas o distintos monstruos.

> **Nota:** Si en algún momento preferís usar marcadores tipo `13,9,3` en lugar de `13,5,5`, solo tenés que cambiar el valor `matrixCodeType` en el archivo `index.html`. Eso sí: todos los marcadores barcode impresos deben corresponder al mismo tipo configurado, o la cámara no los va a reconocer.

*** [URL para crear marcadores](https://au.gmented.com/app/marker/marker.php) ***

---

## 🚀 Cómo agregar un nuevo modelo al proyecto

Si querés que aparezca un nuevo modelo cuando la cámara lea el **Barcode número 1**, necesitás 4 pasos:

**1. Sube tu modelo:**

Guarda tu archivo (ej: `pocima.glb`) en la carpeta `/modelos/`.

**2. Precarga el modelo en `index.html`:**

Dentro de la etiqueta `<a-assets>`, agrega:

```html
<a-asset-item id="pocima-glb" src="modelos/pocima.glb"></a-asset-item>
```

**3. Agrega el nuevo marcador:**

Debajo del último marcador en `index.html`, escribe:

```html
<a-marker type="barcode" value="1" id="Barcode_1" registerevents>
    <a-entity gltf-model="#pocima-glb" scale="1 1 1" position="0 0 0"></a-entity>
</a-marker>
```

**4. Avisale al panel de información (`js/eventos.js`):**

Sin este paso el modelo va a aparecer en la escena 3D, pero el panel va a seguir mostrando "Desconocido" en lugar del nombre real. Dentro de `registerevents`, agregá una línea nueva junto a las que ya existen:

```javascript
if(marcadorId === "Hiro") modeloNombre = "dragon.glb";
if(marcadorId === "Kanji") modeloNombre = "dragon.fbx";
if(marcadorId === "Barcode_0") modeloNombre = "cofre.glb";
if(marcadorId === "Barcode_1") modeloNombre = "pocima.glb"; // ← línea nueva
```

¡Y listo! Cuando actualices la página, la cámara reconocerá el Barcode 1, mostrará la pócima y el panel indicará correctamente qué modelo fue detectado.
