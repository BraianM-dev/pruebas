// Detecta los marcadores AR y comunica los hallazgos al juego contenedor.
const NOMBRES_MARCADORES = {
    Hiro: "Dragón de Eldoria",
    Kanji: "Dragón alternativo",
    Barcode_0: "Mago de la cripta",
    Barcode_1: "Mago de la cripta",
    Barcode_2: "Artefacto antiguo",
    Barcode_3: "Runa de fuego",
    Barcode_4: "Imagen del dragón",
    Barcode_5: "Escena animada",
    Barcode_6: "Escena de video",
    Barcode_7: "Mapa de la mazmorra",
    Barcode_8: "Bosque de la cripta",
    Barcode_9: "Terreno natural",
    Barcode_10: "Desierto antiguo",
    Barcode_11: "Guerrero de la compañía"
};

function publicarAlJuego(action, marker) {
    if (window.parent === window) return;
    window.parent.postMessage({
        type: "calabozos-ar",
        action: action,
        marker: marker,
        name: NOMBRES_MARCADORES[marker] || "Descubrimiento de la cripta"
    }, window.location.origin);
}

AFRAME.registerComponent("registerevents", {
    init: function () {
        var marcador = this.el;
        marcador.addEventListener("markerFound", function () {
            var marcadorId = marcador.id;
            var modeloNombre = NOMBRES_MARCADORES[marcadorId] || "Modelo de la cripta";
            if (window.Utilidades) Utilidades.marcadorEncontrado(marcadorId, modeloNombre);
            publicarAlJuego("found", marcadorId);
        });
        marcador.addEventListener("markerLost", function () {
            if (window.Utilidades) Utilidades.marcadorPerdido();
            publicarAlJuego("lost", marcador.id);
        });
    }
});
