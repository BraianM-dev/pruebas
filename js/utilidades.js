// js/utilidades.js
// Este archivo agrupa herramientas y funciones para no mezclar la interfaz con la lógica de AR.

const Utilidades = {
    // Capturamos los elementos del panel HTML
    UI: {
        marcador: document.getElementById('marcador-id'),
        modelo: document.getElementById('modelo-id'),
        estado: document.getElementById('estado-id'),
        fps: document.getElementById('fps-id')
    },

    // Se ejecuta cuando la cámara ve un marcador
    marcadorEncontrado: function(idMarcador, modeloAsignado) {
        this.UI.marcador.innerText = idMarcador;
        this.UI.modelo.innerText = modeloAsignado;
        this.UI.estado.innerText = "Detectado";
        this.UI.estado.style.color = "#4CAF50"; // Cambia el texto a verde
    },

    // Se ejecuta cuando la cámara pierde el marcador
    marcadorPerdido: function() {
        this.UI.marcador.innerText = "Ninguno";
        this.UI.modelo.innerText = "-";
        this.UI.estado.innerText = "Buscando...";
        this.UI.estado.style.color = "#FFD700"; // Cambia el texto a amarillo
    },

    // Calculador básico de Fotogramas por Segundo (FPS) para medir el rendimiento
    iniciarFPS: function() {
        let frames = 0;
        let ultimoTiempo = performance.now();

        const bucle = () => {
            frames++;
            const tiempoActual = performance.now();
            if (tiempoActual >= ultimoTiempo + 1000) {
                this.UI.fps.innerText = frames;
                frames = 0;
                ultimoTiempo = tiempoActual;
            }
            requestAnimationFrame(bucle); // Llama a la función en el próximo render
        };
        bucle();
    }
};

// Arrancamos el contador de FPS cuando la página termina de cargar
window.addEventListener('load', () => {
    Utilidades.iniciarFPS();
});