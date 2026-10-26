// js/conexion.js
// Comunicación bidireccional entre el iframe AR y el cliente  DM

const Comunicacion = {

    enviarAlPadre: function (msg) {
        try {
            window.parent.postMessage(Object.assign({ source: 'ar-frame' }, msg), '*');
        } catch (e) {
            console.warn('[AR] postMessage error:', e);
        }
    },

    escucharComandos: function (callback) {
        window.addEventListener('message', (e) => {
            if (!e.data || e.data.target !== 'ar-frame') return;
            try {
                callback(e.data);
            } catch (err) {
                console.warn('[AR] Command handler error:', err);
            }
        });
    }
};

window.addEventListener('load', () => {
    Comunicacion.escucharComandos((cmd) => {
        switch (cmd.action) {
            case 'assign-model':
                Utilidades.asignarModelo(cmd.slot, {
                    type: cmd.modelType || 'gltf',
                    url: cmd.modelUrl,
                    name: cmd.modelName || 'Modelo',
                    scale: cmd.scale,
                    rotation: cmd.rotation,
                    position: cmd.position,
                    animated: cmd.animated !== false
                });
                break;
            case 'show-model':
                Utilidades.mostrarModelo(cmd.slot, true);
                break;
            case 'hide-model':
                Utilidades.mostrarModelo(cmd.slot, false);
                break;
            case 'assign-stats':
                Utilidades.asignarStats(cmd.slot, cmd.stats);
                break;
            case 'clear-stats':
                Utilidades.limpiarStats(cmd.slot);
                break;
            case 'clear-model':
                Utilidades.limpiarModelo(cmd.slot);
                break;
            case 'toggle-panel':
                Utilidades.togglePanel(cmd.visible !== false);
                break;
            default:
                console.warn('[AR] Comando desconocido:', cmd.action);
        }
    });
});
