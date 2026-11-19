// js/marcadores-estables.js
// ------------------------------------------------------------------
// 1) MARCADORES ESTABLES
//    AR.js esconde el modelo en el mismo cuadro en que no lee el código,
//    y un código lejos o inclinado se lee en un cuadro sí y en otro no:
//    por eso los modelos parpadean. Acá cada modelo se queda quieto en su
//    último lugar durante MANTENER_MS antes de esconderse.
//    (Los modelos NO tapan los códigos: AR.js lee la imagen de la cámara,
//    no lo que se dibuja encima.)
//
// 2) TAMAÑO GENERAL
//    Una barrita abajo a la derecha agranda o achica todo lo que se
//    dibuja sobre los marcadores. Se recuerda en este navegador.
// ------------------------------------------------------------------

(function () {
    const MANTENER_MS = 500;
    const ESCALA_MIN = 0.3, ESCALA_MAX = 2.5;

    // --- tamaño general (lo usa también multi-marcador.js) ---
    window.escalaAR = 1;
    try {
        const guardada = parseFloat(localStorage.getItem('escalaAR'));
        if (guardada >= ESCALA_MIN && guardada <= ESCALA_MAX) window.escalaAR = guardada;
    } catch (e) { /* sin localStorage: queda en 1 */ }

    // --- marcadores estables: envolvemos el tick de AR.js ---
    const Anchor = AFRAME.components['arjs-anchor'].Component;
    const tickOriginal = Anchor.prototype.tick;

    Anchor.prototype.tick = function () {
        if (!this.isReady || !this._arAnchor) return tickOriginal.apply(this, arguments);
        const el = this.el;

        // Umbral automático (Otsu): AR.js trae el umbral FIJO en 100 y con
        // poca luz o el papel inclinado el negro se ve gris y no lo lee.
        // Medido con cámara: un código pasó de leerse en el 7 % de los
        // cuadros al 100 %, sin bajar la velocidad (el "adaptativo" la baja a la mitad).
        const ctx = this._arAnchor.arSession && this._arAnchor.arSession.arContext;
        if (ctx && ctx.arController && !ctx._umbralAutomatico) {
            ctx.arController.setThresholdMode(2);   // 2 = AR_LABELING_THRESH_MODE_AUTO_OTSU
            ctx._umbralAutomatico = true;
        }

        // El tick original avisa markerFound/markerLost cada vez que el
        // código aparece o se pierde un cuadro: lo silenciamos y avisamos
        // nosotros solo cuando el modelo de verdad aparece o se va.
        const emitReal = el.emit;
        el.emit = function (nombre) {
            if (nombre === 'markerFound' || nombre === 'markerLost') return;
            return emitReal.apply(this, arguments);
        };
        try { tickOriginal.apply(this, arguments); } finally { delete el.emit; }

        const ahora = performance.now();
        if (this._arAnchor.object3d.visible) this._ultimoVisto = ahora;
        const mostrar = !!this._ultimoVisto && (ahora - this._ultimoVisto) < MANTENER_MS;

        // Si no se ve, AR.js deja la última posición: el modelo queda ahí quieto
        el.object3D.visible = mostrar;
        el.object3D.scale.multiplyScalar(window.escalaAR);

        if (mostrar && !this._mostrado) el.emit('markerFound');
        if (!mostrar && this._mostrado) el.emit('markerLost');
        this._mostrado = mostrar;
    };

    // --- cámara elegida (si la PC tiene varias) ---
    // AR.js acepta "deviceId" en <a-scene arjs="...">: le pasamos la que
    // se eligió en el selector, guardada en este navegador.
    let camaraGuardada = null;
    try { camaraGuardada = localStorage.getItem('camaraAR'); } catch (e) { /* sin localStorage */ }
    const SistemaAR = AFRAME.systems.arjs;
    if (SistemaAR && camaraGuardada) {
        const initOriginal = SistemaAR.prototype.init;
        SistemaAR.prototype.init = function () {
            this.data.deviceId = camaraGuardada;
            return initOriginal.apply(this, arguments);
        };
    }
    // Si la cámara guardada ya no está enchufada, volvemos a la de siempre
    window.addEventListener('camera-error', function () {
        if (!camaraGuardada) return;
        try { localStorage.removeItem('camaraAR'); } catch (e) { /* nada */ }
        location.reload();
    });

    function llenarCamaras(select) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
        navigator.mediaDevices.enumerateDevices().then(function (lista) {
            const camaras = lista.filter(function (d) { return d.kind === 'videoinput'; });
            // el <video> de la cámara es el que trae imagen en vivo (srcObject);
            // la escena tiene otros <video> de ejemplo en <a-assets>
            const video = Array.from(document.querySelectorAll('video')).find(function (v) { return v.srcObject; });
            const pista = video && video.srcObject.getVideoTracks()[0];
            const enUso = pista && pista.getSettings().deviceId;
            select.innerHTML = '';
            camaras.forEach(function (d, i) {
                const op = document.createElement('option');
                op.value = d.deviceId;
                op.textContent = d.label || ('Cámara ' + (i + 1));
                if (d.deviceId === enUso) op.selected = true;
                select.appendChild(op);
            });
            select.parentElement.style.display = camaras.length > 1 ? 'flex' : 'none';
        });
    }

    // --- controles: cámara + barrita de tamaño ---
    function crearBarrita() {
        const caja = document.createElement('div');
        caja.id = 'barra-tamano';
        caja.style.cssText = 'position:fixed;right:12px;bottom:64px;z-index:20;background:rgba(20,20,30,.85);' +
            'color:#fff;font:13px "Segoe UI",sans-serif;padding:8px 12px;border-radius:10px;display:flex;' +
            'flex-direction:column;gap:6px;box-shadow:0 2px 8px rgba(0,0,0,.4);max-width:calc(100vw - 24px)';
        caja.innerHTML =
            '<div style="display:none;align-items:center;gap:8px"><label for="camara-ar">Cámara</label>' +
            '<select id="camara-ar" style="flex:1;min-width:0;max-width:220px;font:inherit"></select></div>' +
            '<div style="display:flex;align-items:center;gap:8px"><label for="escala-ar">Tamaño</label>' +
            '<input id="escala-ar" type="range" min="' + ESCALA_MIN + '" max="' + ESCALA_MAX + '" step="0.05" style="width:140px">' +
            '<span id="escala-ar-valor" style="min-width:38px;text-align:right"></span></div>';
        document.body.appendChild(caja);

        const selectCamara = caja.querySelector('#camara-ar');
        selectCamara.addEventListener('change', function () {
            try { localStorage.setItem('camaraAR', selectCamara.value); } catch (e) { /* no se recuerda */ }
            location.reload();
        });
        // Los nombres de las cámaras aparecen recién cuando el navegador da permiso
        window.addEventListener('camera-init', function () { setTimeout(function () { llenarCamaras(selectCamara); }, 500); });
        if (navigator.mediaDevices) navigator.mediaDevices.addEventListener('devicechange', function () { llenarCamaras(selectCamara); });
        llenarCamaras(selectCamara);

        const barra = caja.querySelector('#escala-ar');
        const valor = caja.querySelector('#escala-ar-valor');
        barra.value = window.escalaAR;
        valor.textContent = Math.round(window.escalaAR * 100) + '%';
        barra.addEventListener('input', function () {
            window.escalaAR = parseFloat(barra.value);
            valor.textContent = Math.round(window.escalaAR * 100) + '%';
            try { localStorage.setItem('escalaAR', String(window.escalaAR)); } catch (e) { /* no se recuerda */ }
        });
    }
    if (document.body) crearBarrita();
    else document.addEventListener('DOMContentLoaded', crearBarrita);
})();
