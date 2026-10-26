// js/eventos.js
// Detecta cuándo un marcador entra o sale del campo de visión

AFRAME.registerComponent('registerevents', {
    init: function () {
        const marcador = this.el;
        const marcadorId = marcador.id;

        marcador.addEventListener('markerFound', function () {
            const slot = Utilidades.slotFromMarkerId(marcadorId);
            const info = Utilidades.infoMarcador(marcadorId);
            Utilidades.marcadorEncontrado(marcadorId, info ? info.name : 'Vacío');

            // Mostrar SOLO el slot de este marcador
            Utilidades.slotVisible(slot, true);

            Comunicacion.enviarAlPadre({
                action: 'marker-found',
                markerId: marcadorId,
                slot: slot,
                modelInfo: info ? { name: info.name, type: info.type } : null
            });
        });

        marcador.addEventListener('markerLost', function () {
            const slot = Utilidades.slotFromMarkerId(marcadorId);
            Utilidades.marcadorPerdido();

            // Ocultar el slot de este marcador
            Utilidades.slotVisible(slot, false);

            Comunicacion.enviarAlPadre({
                action: 'marker-lost',
                markerId: marcadorId,
                slot: slot
            });
        });
    }
});
