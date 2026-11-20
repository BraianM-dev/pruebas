// js/marcadores-estables.js
// ------------------------------------------------------------------
// 1) VARIAS COPIAS DE CUALQUIER CÓDIGO + SIN PARPADEO
//    AR.js ubica un solo modelo por número: con dos esbirros impresos,
//    el único esbirro salta de un código al otro. Acá seguimos nosotros
//    TODAS las copias de cada código barcode:
//      - la 1ra copia mueve el <a-marker> original (el DM lo sigue usando igual)
//      - la 2da, 3ra y 4ta muestran un clon de su contenido
//    Cada copia conserva su lugar aunque se muevan, y si un cuadro no se
//    lee, el modelo se queda quieto MANTENER_MS antes de esconderse
//    (antes parpadeaba). Los modelos NO tapan los códigos: AR.js lee la
//    imagen de la cámara, no lo que se dibuja encima.
//    (El código 8 de los árboles lo maneja multi-marcador.js: ahí cada
//    copia muestra un árbol DISTINTO.)
//
// 2) TAMAÑO GENERAL: barrita abajo a la derecha (se recuerda).
// 3) CÁMARA: selector si la PC tiene varias (se recuerda).
// 4) UMBRAL AUTOMÁTICO y PROFUNDIDAD DE LA CÁMARA 3D (ver más abajo).
// ------------------------------------------------------------------

(function () {
    const MANTENER_MS = 500;    // cuánto aguanta un modelo cuando su código no se lee
    const MAX_COPIAS = 4;       // copias del mismo código a la vez
    const DISTANCIA = 1.5;      // cuánto puede moverse una copia entre cuadros (en anchos de código)
    const SUAVIZADO = 0.5;      // 0 = sin suavizar
    const CONFIANZA = 0.6;      // igual que AR.js
    const ESCALA_MIN = 0.3, ESCALA_MAX = 2.5;

    // --- tamaño general (lo usa también multi-marcador.js) ---
    window.escalaAR = 1;
    try {
        const guardada = parseFloat(localStorage.getItem('escalaAR'));
        if (guardada >= ESCALA_MIN && guardada <= ESCALA_MAX) window.escalaAR = guardada;
    } catch (e) { /* sin localStorage: queda en 1 */ }

    // --- largo de un paso al caminar (lo usa acciones.js), en anchos de código ---
    const PASO_MIN = 0.5, PASO_MAX = 3;
    window.pasoAR = 1;
    try {
        const guardado = parseFloat(localStorage.getItem('pasoAR'));
        if (guardado >= PASO_MIN && guardado <= PASO_MAX) window.pasoAR = guardado;
    } catch (e) { /* sin localStorage: queda en 1 */ }

    // --- profundidad de la cámara 3D ---
    // AR.js arma la cámara con un rango de 0,0001 a 1000 (diez millones a uno):
    // la tarjeta de video no distingue qué cara del modelo está adelante y las
    // superficies cercanas (capa, cuerpo, arma) parpadean como "ruido".
    // Lo dejamos en 0,1 a 200 (un código mide 1; la cámara suele estar a ~10).
    const CERCA = 0.1, LEJOS = 200;
    const PROF_A = -(LEJOS + CERCA) / (LEJOS - CERCA), PROF_B = -2 * LEJOS * CERCA / (LEJOS - CERCA);
    function arreglarProfundidad(camara) {
        if (!camara) return;
        const m = camara.projectionMatrix.elements;
        if (m[11] !== -1 || (m[10] === PROF_A && m[14] === PROF_B)) return;   // ya está, o no es perspectiva
        m[10] = PROF_A;
        m[14] = PROF_B;
        camara.projectionMatrixInverse.copy(camara.projectionMatrix).invert();
    }

    // =================================================================
    // SEGUIMIENTO PROPIO DE LOS CÓDIGOS BARCODE
    // =================================================================
    const seg = {
        ctrl: null,
        ctx: null,
        detecciones: {},   // valor -> [{pos, quat}] del último cuadro procesado
        marcadores: {},    // valor -> { el, pistas, copias, sucio, habia }
        porElemento: new Map()
    };
    const rotX = new THREE.Matrix4().makeRotationX(Math.PI / 2);

    function conectar(sceneEl) {
        const sys = sceneEl.systems.arjs;
        const ctx = sys && sys._arSession && sys._arSession.arContext;
        if (!ctx || !ctx.arController) return;
        seg.ctx = ctx;
        seg.ctrl = ctx.arController;

        // Umbral automático (Otsu): AR.js trae el umbral FIJO en 100 y con
        // poca luz o el papel inclinado el negro se ve gris y no lo lee.
        // Medido con cámara: un código pasó de leerse en el 7 % de los
        // cuadros al 100 %, sin bajar la velocidad (el "adaptativo" la baja a la mitad).
        seg.ctrl.setThresholdMode(2);   // 2 = AR_LABELING_THRESH_MODE_AUTO_OTSU

        sceneEl.querySelectorAll('a-marker').forEach(function (el) {
            const anchor = el.components['arjs-anchor'];
            if (!anchor || anchor.data.type !== 'barcode') return;
            const m = { el: el, valor: anchor.data.barcodeValue, pistas: [], copias: [], habia: false };
            seg.marcadores[m.valor] = m;
            seg.porElemento.set(el, m);
        });
        envolverDM();

        seg.ctrl.addEventListener('getMarker', function (ev) {
            const d = ev.data;
            if (d.type !== 1) return;                                   // 1 = BARCODE_MARKER
            if (!seg.marcadores[d.marker.idMatrix]) return;
            if (d.marker.cfMatrix < CONFIANZA) return;
            // Misma cuenta que hace AR.js para ubicar un <a-marker>
            const mat = new THREE.Matrix4().copy(seg.ctx._artoolkitProjectionAxisTransformMatrix);
            mat.multiply(new THREE.Matrix4().fromArray(d.matrix));
            mat.multiply(rotX);
            const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), esc = new THREE.Vector3();
            mat.decompose(pos, quat, esc);
            (seg.detecciones[d.marker.idMatrix] = seg.detecciones[d.marker.idMatrix] || []).push({ pos: pos, quat: quat });
        });
    }

    // Copia = entidad suelta en la escena con un clon de lo que tiene el <a-marker>
    // El HTML original del <a-marker> (como está escrito en index.html)
    function clonarContenido(m, destino) {
        Array.from(m.el.children).forEach(function (hijo) {
            if (hijo.classList.contains('stats-slot')) return;   // las stats las pone el DM (ver abajo)
            const c = hijo.cloneNode(true);
            c.removeAttribute('id');
            c.querySelectorAll('[id]').forEach(function (x) { x.removeAttribute('id'); });
            destino.appendChild(c);
        });
    }
    function crearCopia(m) {
        const copia = document.createElement('a-entity');
        copia.className = 'copia-marcador';
        copia.setAttribute('data-copia-de', m.el.id);
        copia.setAttribute('visible', 'false');
        clonarContenido(m, copia);
        m.el.sceneEl.appendChild(copia);
        aplicarLoDelDM(m, copia);
        return copia;
    }

    // --- lo que el DM le cambia a un código, también a sus copias ---
    // A-Frame no deja en el HTML el modelo que puso el DM (el atributo queda
    // vacío), así que no alcanza con clonar: repetimos sobre cada copia las
    // mismas funciones de Utilidades que usó el DM.
    const FUNCIONES_DM = ['asignarModelo', 'asignarStats', 'limpiarStats', 'mostrarModelo'];
    function enCopia(copia, fn, args) {
        const buscar = Utilidades.markerElPorSlot;
        Utilidades.markerElPorSlot = function () { return copia; };
        try { fn.apply(Utilidades, args); } finally { Utilidades.markerElPorSlot = buscar; }
    }
    function envolverDM() {
        if (!window.Utilidades || Utilidades._copiasEnvueltas) return;
        Utilidades._copiasEnvueltas = true;
        FUNCIONES_DM.forEach(function (nombre) {
            const original = Utilidades[nombre];
            if (typeof original !== 'function') return;
            Utilidades['_' + nombre + 'Original'] = original;
            Utilidades[nombre] = function (slot) {
                const r = original.apply(this, arguments);
                const m = seg.marcadores[slot];
                const args = arguments;
                if (m) m.copias.forEach(function (c) { if (c) enCopia(c, original, args); });
                return r;
            };
        });
    }
    function aplicarLoDelDM(m, copia) {
        if (!window.Utilidades || !Utilidades._copiasEnvueltas) return;
        const slot = String(m.valor);
        if (Utilidades.modelosAsignados[slot]) enCopia(copia, Utilidades._asignarModeloOriginal, [slot, Utilidades.modelosAsignados[slot]]);
        if (Utilidades.statsAsignadas[slot]) enCopia(copia, Utilidades._asignarStatsOriginal, [slot, Utilidades.statsAsignadas[slot]]);
    }

    const adelante = new THREE.Vector3();
    function ponerEn(obj3d, pista) {
        if (!pista) { obj3d.visible = false; return; }
        obj3d.position.copy(pista.pos);
        // Personaje que caminó (acciones.js): queda corrido hacia adelante de su
        // código, en anchos de código (largo físico: no depende de la barrita Tamaño)
        const avance = obj3d.el && obj3d.el._avance;
        if (avance) obj3d.position.add(adelante.set(0, 0, avance).applyQuaternion(pista.quat));
        obj3d.quaternion.copy(pista.quat);
        obj3d.scale.setScalar(window.escalaAR);
        obj3d.visible = true;
    }
    // slot 0 = el <a-marker> original; slot 1..3 = copias
    function aplicar(m) {
        const porSlot = [];
        m.pistas.forEach(function (p) { porSlot[p.slot] = p; });
        ponerEn(m.el.object3D, porSlot[0]);
        for (let k = 1; k < MAX_COPIAS; k++) {
            if (!porSlot[k] && !m.copias[k]) continue;
            if (!m.copias[k]) m.copias[k] = crearCopia(m);
            ponerEn(m.copias[k].object3D, porSlot[k]);
        }
    }

    function actualizar() {
        const ahora = performance.now();
        Object.keys(seg.marcadores).forEach(function (v) {
            const m = seg.marcadores[v];
            const dets = seg.detecciones[v] || [];

            // 1) Emparejar cada detección con la copia que ya veníamos siguiendo más cerca
            const pares = [];
            m.pistas.forEach(function (p, i) {
                dets.forEach(function (d, j) { pares.push({ i: i, j: j, dist: p.pos.distanceTo(d.pos) }); });
            });
            pares.sort(function (a, b) { return a.dist - b.dist; });
            const pistaUsada = {}, detUsada = {};
            pares.forEach(function (par) {
                if (pistaUsada[par.i] || detUsada[par.j] || par.dist > DISTANCIA) return;
                pistaUsada[par.i] = detUsada[par.j] = true;
                const p = m.pistas[par.i], d = dets[par.j];
                p.pos.lerp(d.pos, 1 - SUAVIZADO);
                p.quat.slerp(d.quat, 1 - SUAVIZADO);
                p.visto = ahora;
            });

            // 2) Detecciones nuevas: toman el primer lugar libre (original, copia 1, 2, 3)
            dets.forEach(function (d, j) {
                if (detUsada[j]) return;
                const ocupados = m.pistas.map(function (p) { return p.slot; });
                let slot = 0;
                while (ocupados.indexOf(slot) !== -1) slot++;
                if (slot >= MAX_COPIAS) return;
                m.pistas.push({ slot: slot, pos: d.pos.clone(), quat: d.quat.clone(), visto: ahora });
            });

            // 3) Las que hace rato no se leen, se liberan
            m.pistas = m.pistas.filter(function (p) { return ahora - p.visto <= MANTENER_MS; });

            aplicar(m);

            // 4) Avisar al DM solo cuando aparece la primera copia o se va la última
            const hay = m.pistas.length > 0;
            if (hay && !m.habia) m.el.emit('markerFound');
            if (!hay && m.habia) m.el.emit('markerLost');
            m.habia = hay;
        });
        seg.detecciones = {};
    }

    // --- video y dibujo alineados ---
    // AR.js solo acomoda el dibujo 3D sobre el video cuando la ventana cambia de
    // tamaño (y unos segundos al arrancar). Si la cámara tarda en abrir, quedan
    // desalineados y TODOS los modelos aparecen corridos de sus códigos.
    // Medido: video arriba en -232 y dibujo en 8 hasta el próximo "resize".
    let ultimaRevision = 0;
    function revisarAlineacion(escenaEl, sesion) {
        const ahora = performance.now();
        if (ahora - ultimaRevision < 250) return;
        ultimaRevision = ahora;
        const fuente = sesion && sesion.arSource;
        const video = fuente && fuente.domElement;
        const lienzo = escenaEl.canvas;
        if (!video || !lienzo || !video.videoWidth) return;
        const a = video.getBoundingClientRect(), b = lienzo.getBoundingClientRect();
        const corrido = Math.abs(a.top - b.top) > 2 || Math.abs(a.left - b.left) > 2 || Math.abs(a.height - b.height) > 2 || Math.abs(a.width - b.width) > 2;
        // La imagen interna del dibujo tiene que tener la misma proporción que como
        // se muestra: si A-Frame la midió antes de que AR.js acomodara la página,
        // queda estirada (medido: 1920x720 mostrada en 1280x960 = el doble de alta)
        // y los modelos se ven deformados.
        const estirado = b.height > 0 && lienzo.height > 0 &&
            Math.abs((lienzo.width / lienzo.height) / (b.width / b.height) - 1) > 0.02;
        if (corrido || estirado) {
            // Lo mismo que pasa al cambiar el tamaño de la ventana: AR.js copia
            // el tamaño del video al <body> y A-Frame reacomoda el dibujo.
            window.dispatchEvent(new Event('resize'));
        }
    }

    // --- cámara 3D fija en el centro ---
    // A-Frame le agrega a la cámara una altura de ojos de 1,6 y los controles de
    // realidad virtual (look-controls: arrastrar la gira; wasd-controls: W/A/S/D la
    // mueve). En AR la cámara tiene que quedarse en (0,0,0) mirando de frente: si
    // no, TODOS los modelos se ven corridos de sus códigos (medido: 1,6 hacia abajo).
    function fijarCamara(camara) {
        const el = camara && camara.el;
        if (!el) return;
        ['look-controls', 'wasd-controls'].forEach(function (c) {
            if (el.components[c] && el.components[c].data.enabled !== false) el.setAttribute(c, 'enabled', false);
        });
        const o = el.object3D;
        if (o.position.lengthSq() > 0 || o.rotation.x || o.rotation.y || o.rotation.z) {
            o.position.set(0, 0, 0);
            o.rotation.set(0, 0, 0);
        }
    }

    // AR.js procesa la cámara (y vuelve a copiar la cámara 3D) en el tick de su
    // sistema: justo después actualizamos el seguimiento y la profundidad.
    if (AFRAME.systems.arjs) {
        const tickSistema = AFRAME.systems.arjs.prototype.tick;
        AFRAME.systems.arjs.prototype.tick = function () {
            const r = tickSistema.apply(this, arguments);
            arreglarProfundidad(this.el.camera);
            fijarCamara(this.el.camera);
            if (this.isReady) revisarAlineacion(this.el, this._arSession);
            if (this.isReady) {
                if (!seg.ctrl) conectar(this.el);
                else actualizar();
            }
            return r;
        };
    }

    // --- el tick de cada <a-marker> de AR.js ---
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

        // Códigos barcode: manda nuestro seguimiento (pisa lo que puso AR.js)
        const m = seg.porElemento.get(el);
        if (m) { aplicar(m); return; }

        // Hiro / Kanji (patrones): solo el margen anti-parpadeo
        const ahora = performance.now();
        if (this._arAnchor.object3d.visible) this._ultimoVisto = ahora;
        const mostrar = !!this._ultimoVisto && (ahora - this._ultimoVisto) < MANTENER_MS;
        el.object3D.visible = mostrar;
        el.object3D.scale.multiplyScalar(window.escalaAR);
        if (mostrar && !this._mostrado) el.emit('markerFound');
        if (!mostrar && this._mostrado) el.emit('markerLost');
        this._mostrado = mostrar;
    };

    // =================================================================
    // CÁMARA ELEGIDA (si la PC tiene varias)
    // =================================================================
    // AR.js acepta "deviceId" en <a-scene arjs="...">: le pasamos la que
    // se eligió en el selector, guardada en este navegador.
    let camaraGuardada = null, saltearGuardada = false;
    try {
        camaraGuardada = localStorage.getItem('camaraAR');
        saltearGuardada = sessionStorage.getItem('camaraSaltear') === '1';
        sessionStorage.removeItem('camaraSaltear');
    } catch (e) { /* sin storage */ }
    const SistemaAR = AFRAME.systems.arjs;
    if (SistemaAR && camaraGuardada && !saltearGuardada) {
        const initOriginal = SistemaAR.prototype.init;
        SistemaAR.prototype.init = function () {
            this.data.deviceId = camaraGuardada;
            return initOriginal.apply(this, arguments);
        };
    }
    // Si la cámara elegida no está enchufada, por esta vez usamos la de siempre,
    // pero NO olvidamos la elegida: cuando se enchufe, la página se cambia sola.
    window.addEventListener('camera-error', function () {
        if (!camaraGuardada || saltearGuardada) return;
        try { sessionStorage.setItem('camaraSaltear', '1'); } catch (e) { /* nada */ }
        location.reload();
    });
    function camaraEnUso() {
        const video = Array.from(document.querySelectorAll('video')).find(function (v) { return v.srcObject; });
        const pista = video && video.srcObject.getVideoTracks()[0];
        return pista && pista.getSettings().deviceId;
    }
    function siVolvioLaElegida(lista) {
        if (!camaraGuardada || camaraEnUso() === camaraGuardada) return;
        if (lista.some(function (d) { return d.kind === 'videoinput' && d.deviceId === camaraGuardada; })) location.reload();
    }

    function llenarCamaras(select) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
        navigator.mediaDevices.enumerateDevices().then(function (lista) {
            const camaras = lista.filter(function (d) { return d.kind === 'videoinput'; });
            // el <video> de la cámara es el que trae imagen en vivo (srcObject);
            // la escena tiene otros <video> de ejemplo en <a-assets>
            const enUso = camaraEnUso();
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
            '<span id="escala-ar-valor" style="min-width:38px;text-align:right"></span></div>' +
            '<div style="display:flex;align-items:center;gap:8px" title="Cuánto avanza un personaje con click derecho (en anchos de código)">' +
            '<label for="paso-ar">Paso</label>' +
            '<input id="paso-ar" type="range" min="' + PASO_MIN + '" max="' + PASO_MAX + '" step="0.05" style="width:140px;margin-left:14px">' +
            '<span id="paso-ar-valor" style="min-width:38px;text-align:right"></span></div>' +
            '<div style="font-size:11px;opacity:.75">Click derecho: avanza · Shift + click derecho: vuelve</div>';
        document.body.appendChild(caja);

        const paso = caja.querySelector('#paso-ar');
        const pasoValor = caja.querySelector('#paso-ar-valor');
        paso.value = window.pasoAR;
        pasoValor.textContent = window.pasoAR.toFixed(2);
        paso.addEventListener('input', function () {
            window.pasoAR = parseFloat(paso.value);
            pasoValor.textContent = window.pasoAR.toFixed(2);
            try { localStorage.setItem('pasoAR', String(window.pasoAR)); } catch (e) { /* no se recuerda */ }
        });

        const selectCamara = caja.querySelector('#camara-ar');
        selectCamara.addEventListener('change', function () {
            try { localStorage.setItem('camaraAR', selectCamara.value); } catch (e) { /* no se recuerda */ }
            location.reload();
        });
        // Los nombres de las cámaras aparecen recién cuando el navegador da permiso
        window.addEventListener('camera-init', function () { setTimeout(function () { llenarCamaras(selectCamara); }, 500); });
        if (navigator.mediaDevices) navigator.mediaDevices.addEventListener('devicechange', function () {
            llenarCamaras(selectCamara);
            navigator.mediaDevices.enumerateDevices().then(siVolvioLaElegida);   // enchufaron la elegida: cambiar
        });
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
