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

    // --- la barrita ---
    function crearBarrita() {
        const caja = document.createElement('div');
        caja.id = 'barra-tamano';
        caja.style.cssText = 'position:fixed;right:12px;bottom:64px;z-index:20;background:rgba(20,20,30,.85);' +
            'color:#fff;font:13px "Segoe UI",sans-serif;padding:8px 12px;border-radius:10px;display:flex;' +
            'align-items:center;gap:8px;box-shadow:0 2px 8px rgba(0,0,0,.4)';
        caja.innerHTML = '<label for="escala-ar">Tamaño</label>' +
            '<input id="escala-ar" type="range" min="' + ESCALA_MIN + '" max="' + ESCALA_MAX + '" step="0.05" style="width:140px">' +
            '<span id="escala-ar-valor" style="min-width:38px;text-align:right"></span>';
        document.body.appendChild(caja);

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
