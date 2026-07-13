// js/eventos.js
// Este archivo detecta cuándo un marcador entra o sale de la pantalla.

AFRAME.registerComponent('registerevents', {
    init: function () {
        var marcador = this.el; // El elemento HTML del marcador actual

        // EVENTO: Cuando el marcador entra en el campo de visión
        marcador.addEventListener('markerFound', function() {
            var marcadorId = marcador.id;
            var modeloNombre = "Desconocido";

            // Asignamos el nombre del modelo para mostrarlo en el panel
            if(marcadorId === "Hiro") modeloNombre = "dragon.glb";
            if(marcadorId === "Kanji") modeloNombre = "dragon.fbx";
            if(marcadorId === "Barcode_0") modeloNombre = "mago.glb";
            if(marcadorId === "Barcode_1") modeloNombre = "mago.fbx";
            if(marcadorId === "Barcode_2") modeloNombre = "model.fbx";
            // Actualizamos la interfaz usando nuestro archivo de utilidades
            // Utilidades.marcadorEncontrado(marcadorId, modeloNombre);
            Utilidades.marcadorEncontrado(marcadorId, "esperando servidor...");
            Conexion.enviarEvento("marcador_detectado", marcadorId);
            /* -----------------------------------------------------------------
               GANCHO PARA PRÓXIMAS CLASES (Hardware & IoT)
               Aquí, en el futuro, los estudiantes agregarán las peticiones fetch
               para comunicarse con el ESP32 o enviar datos por serial/bluetooth 
               a la placa micro:bit cuando aparezca un marcador en el juego.
               ----------------------------------------------------------------- */
               // ejemplo: fetch('http://IP_DEL_ESP32/marcador?id=' + marcadorId);
        });

        // EVENTO: Cuando el marcador sale del campo de visión
        marcador.addEventListener('markerLost', function() {
            Utilidades.marcadorPerdido();
            Conexion.enviarEvento("marcador_perdido", marcador.id);
            // Aquí en el futuro se podrá enviar la orden de apagar LEDs o detener motores.
        });
    }
});
