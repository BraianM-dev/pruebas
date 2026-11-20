// js/acciones.js
// ------------------------------------------------------------------
// ACCIONES DE LOS PERSONAJES (los que tienen class="personaje")
//
//  - Click derecho sobre un personaje: camina un paso hacia adelante
//    (el largo del paso se ajusta con la barrita "Paso").
//  - Shift + click derecho: vuelve a su código.
//  - Si después de caminar queda a un paso de otro personaje y los dos
//    se miran de frente: pelean (se atacan por turnos) y se le avisa
//    al DM con { action: 'pelea', slots: [...] }.
//
// Los personajes tienen 4 animaciones: Quieto, Caminar, Atacar y Golpe.
// El corrimiento lo aplica marcadores-estables.js con el._avance.
// ------------------------------------------------------------------

(function () {
    const DURACION_PASO = 1100;   // ms que tarda en caminar un paso
    const TURNO_MS = 1300;        // ms de cada ataque en la pelea
    const TURNOS = 4;             // ataques en total (2 cada uno)
    const DE_FRENTE = 0.5;        // cuánto se tienen que mirar (1 = exactamente de frente)

    function escena() { return document.querySelector('a-scene'); }

    // Personajes a la vista: el <a-marker> o la copia que contiene al .personaje
    function personajesVisibles() {
        return Array.from(document.querySelectorAll('.personaje'))
            .map(function (m) { return m.parentElement; })
            .filter(function (raiz) { return raiz && raiz.object3D.visible; });
    }
    function modeloDe(raiz) { return raiz.querySelector('.personaje'); }
    function slotDe(raiz) {
        const id = raiz.id || raiz.getAttribute('data-copia-de') || '';
        return window.Utilidades ? Utilidades.slotFromMarkerId(id) : id;
    }

    function animar(raiz, clip, unaVez) {
        const m = modeloDe(raiz);
        if (!m) return;
        m.setAttribute('animation-mixer', unaVez
            ? { clip: clip, loop: 'once', clampWhenFinished: true, crossFadeDuration: 0.15 }
            : { clip: clip, loop: 'repeat', clampWhenFinished: false, crossFadeDuration: 0.2 });
        // Una animación "de una vez" que ya terminó no vuelve a arrancar sola:
        // la reiniciamos (si no, el segundo ataque de la pelea no se mueve)
        const mezclador = m.components['animation-mixer'] && m.components['animation-mixer'].mixer;
        if (unaVez && mezclador) {
            mezclador._actions.forEach(function (accion) {
                if (accion.getClip().name === clip) accion.reset().fadeIn(0.15).play();
            });
        }
    }

    // --- elegir el personaje más cercano al click (en pantalla) ---
    function personajeEn(x, y, lienzo) {
        const camara = escena().camera;
        const caja = lienzo.getBoundingClientRect();
        const limite = Math.max(60, caja.width * 0.08);
        let mejor = null, dMin = limite;
        personajesVisibles().forEach(function (raiz) {
            raiz.object3D.updateMatrixWorld(true);
            // la mitad del cuerpo, más o menos
            const p = new THREE.Vector3(0, 0.8, 0).applyMatrix4(raiz.object3D.matrixWorld).project(camara);
            if (p.z > 1) return;   // detrás de la cámara
            const px = caja.left + (p.x + 1) / 2 * caja.width;
            const py = caja.top + (1 - p.y) / 2 * caja.height;
            const d = Math.hypot(px - x, py - y);
            if (d < dMin) { dMin = d; mejor = raiz; }
        });
        return mejor;
    }

    // --- caminar ---
    function caminar(raiz, hasta, alTerminar) {
        const desde = raiz._avance || 0;
        const t0 = performance.now();
        raiz._accion = 'caminar';
        animar(raiz, 'Caminar');
        (function paso() {
            const t = Math.min(1, (performance.now() - t0) / DURACION_PASO);
            raiz._avance = desde + (hasta - desde) * t;
            if (t < 1) { requestAnimationFrame(paso); return; }
            animar(raiz, 'Quieto');
            raiz._accion = null;
            if (alTerminar) alTerminar();
        })();
    }

    // --- pelea ---
    function posicion(raiz) { return new THREE.Vector3().setFromMatrixPosition(raiz.object3D.matrixWorld); }
    function frente(raiz) { return new THREE.Vector3(0, 0, 1).transformDirection(raiz.object3D.matrixWorld); }

    // Todo se compara sobre el plano de la mesa (el del código de "a"): cada
    // código tiembla un poco en inclinación y altura, y eso no debe contar.
    function buscarRival(a) {
        a.object3D.updateMatrixWorld(true);
        const normal = new THREE.Vector3(0, 1, 0).transformDirection(a.object3D.matrixWorld);
        const alPlano = function (v) { return v.sub(normal.clone().multiplyScalar(v.dot(normal))); };
        const pa = posicion(a), fa = alPlano(frente(a)).normalize();
        let rival = null, dMin = window.pasoAR * 1.6;
        personajesVisibles().forEach(function (b) {
            if (b === a || b._accion) return;
            b.object3D.updateMatrixWorld(true);
            const ab = alPlano(posicion(b).sub(pa));
            const d = ab.length();
            if (d > dMin || d < 0.01) return;
            ab.normalize();
            const fb = alPlano(frente(b)).normalize();
            if (fa.dot(ab) < DE_FRENTE) return;          // a no mira a b
            if (fb.dot(ab) > -DE_FRENTE) return;         // b no mira a a
            dMin = d; rival = b;
        });
        return rival;
    }

    function cartel(raiz, texto) {
        const t = document.createElement('a-text');
        t.setAttribute('value', texto);
        t.setAttribute('align', 'center');
        t.setAttribute('color', '#ffcc00');
        t.setAttribute('width', '6');
        t.setAttribute('position', '0 2.6 ' + (window.pasoAR / 2));
        t.setAttribute('look-at', '[camera]');
        raiz.appendChild(t);
        return t;
    }

    function pelear(a, b) {
        a._accion = b._accion = 'pelea';
        const aviso = cartel(a, '¡PELEA!');
        if (window.Comunicacion) Comunicacion.enviarAlPadre({ action: 'pelea', slots: [slotDe(a), slotDe(b)] });
        let n = 0;
        (function turno() {
            if (n >= TURNOS) {
                animar(a, 'Quieto'); animar(b, 'Quieto');
                a._accion = b._accion = null;
                if (aviso.parentNode) aviso.parentNode.removeChild(aviso);
                return;
            }
            const atacante = n % 2 === 0 ? a : b, defensor = n % 2 === 0 ? b : a;
            n++;
            animar(atacante, 'Atacar', true);
            setTimeout(function () { animar(defensor, 'Golpe', true); }, TURNO_MS * 0.35);
            setTimeout(function () { animar(atacante, 'Quieto'); animar(defensor, 'Quieto'); turno(); }, TURNO_MS);
        })();
    }

    // Para usar desde la consola o desde el DM más adelante
    window.AccionesAR = { caminar: caminar, pelear: pelear, buscarRival: buscarRival, personajesVisibles: personajesVisibles };

    // --- click derecho ---
    window.addEventListener('contextmenu', function (ev) {
        const s = escena();
        const lienzo = s && s.canvas;
        if (!lienzo || ev.target !== lienzo) return;   // fuera de la escena: menú normal
        ev.preventDefault();
        const raiz = personajeEn(ev.clientX, ev.clientY, lienzo);
        if (!raiz || raiz._accion) return;
        if (ev.shiftKey) { caminar(raiz, 0); return; }   // vuelve a su código
        caminar(raiz, (raiz._avance || 0) + window.pasoAR, function () {
            const rival = buscarRival(raiz);
            if (rival) pelear(raiz, rival);
        });
    });
})();
