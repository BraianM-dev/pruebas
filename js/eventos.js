// js/eventos.js
// Detecta cuándo un marcador entra o sale del campo de visión
// y avisa al DM (padre) por postMessage

AFRAME.registerComponent('registerevents', {
    init: function () {
        const marcador = this.el;
        const marcadorId = marcador.id;

        marcador.addEventListener('markerFound', function () {
            const slot = Utilidades.slotFromMarkerId(marcadorId);
            const info = slot !== null ? Utilidades.infoMarcador(marcadorId) : null;
            Utilidades.marcadorEncontrado(marcadorId, info ? info.name : '');

            console.log('[AR] marker-found:', marcadorId, 'slot:', slot, 'model:', info && info.name);

            if (window.Comunicacion) {
                Comunicacion.enviarAlPadre({
                    action: 'marker-found',
                    markerId: marcadorId,
                    slot: slot,
                    modelInfo: info
                });
            }
        });

        marcador.addEventListener('markerLost', function () {
            Utilidades.marcadorPerdido();
            const slot = Utilidades.slotFromMarkerId(marcadorId);

            if (window.Comunicacion) {
                Comunicacion.enviarAlPadre({
                    action: 'marker-lost',
                    markerId: marcadorId,
                    slot: slot
                });
            }
        });
    }
});
