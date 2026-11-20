// js/acciones.js
// ------------------------------------------------------------------
// ACCIONES DE LOS PERSONAJES (los que tienen class="personaje")
//
//  - Barra de vida arriba de cada personaje (verde -> amarilla -> roja).
//  - Click derecho sobre un personaje: camina un paso hacia adelante
//    (el largo del paso se ajusta con la barrita "Paso").
//  - Shift + click derecho: vuelve a su código. Sobre una lápida: revive.
//  - Si después de caminar queda a un paso de un personaje del OTRO bando
//    (data-bando="heroe" / "malo") y los dos se miran de frente: pelean por
//    turnos hasta que uno se queda sin vida. El que muere hace su animación,
//    se hunde en el piso y en su lugar queda una lápida.
//  - Vida y ataque: si el DM le cargó stats al código (hp, hpMax, atk) se
//    usan esas; si no, los valores de abajo (el malo cae primero).
//  - Al DM se le avisa { action: 'pelea', slots } y { action: 'muerte', slot }.
//
// Animaciones de los personajes: Quieto, Caminar, Atacar, Golpe y Morir.
// El corrimiento lo aplica marcadores-estables.js con el._avance.
// ------------------------------------------------------------------

(function () {
    const DURACION_PASO = 1100;   // ms que tarda en caminar un paso
    const TURNO_MS = 1300;        // ms de cada ataque en la pelea
    const DE_FRENTE = 0.5;        // cuánto se tienen que mirar (1 = exactamente de frente)
    const POR_DEFECTO = {         // si el DM no cargó stats
        heroe: { vida: 10, ataque: 3 },
        malo:  { vida: 6,  ataque: 1 }
    };
    const ALTURA_BARRA = 2.15;    // arriba de la cabeza (en anchos de código, antes de la barrita Tamaño)
    const ANCHO_BARRA = 1.0;

    function escena() { return document.querySelector('a-scene'); }
    function modeloDe(raiz) { return raiz.querySelector('.personaje'); }
    function slotDe(raiz) {
        const id = raiz.id || raiz.getAttribute('data-copia-de') || '';
        return window.Utilidades ? Utilidades.slotFromMarkerId(id) : id;
    }
    // Todos los personajes a la vista (vivos o muertos): el <a-marker> o la copia
    function raicesVisibles() {
        return Array.from(document.querySelectorAll('.personaje'))
            .map(function (m) { return m.parentElement; })
            .filter(function (raiz) { return raiz && raiz.object3D.visible; });
    }
    function personajesVisibles() {
        return raicesVisibles().filter(function (raiz) { return !raiz._muerto; });
    }

    // --- vida ---
    function ficha(raiz) {
        if (raiz._ficha) return raiz._ficha;
        const m = modeloDe(raiz);
        let bando = (m && m.getAttribute('data-bando')) || 'heroe';
        let base = POR_DEFECTO[bando] || POR_DEFECTO.heroe;
        let vidaMax = base.vida, ataque = base.ataque;
        const stats = window.Utilidades && Utilidades.statsAsignadas && Utilidades.statsAsignadas[slotDe(raiz)];
        if (stats) {
            if (stats.hpMax > 0) vidaMax = stats.hpMax;
            if (stats.atk > 0) ataque = stats.atk;
            if (/^🎭/.test(stats.name || '')) bando = 'heroe';
            if (/^👹/.test(stats.name || '')) bando = 'malo';
        }
        const vida = stats && stats.hp >= 0 && stats.hp <= vidaMax ? stats.hp : vidaMax;
        raiz._ficha = { bando: bando, vidaMax: vidaMax, vida: vida, ataque: ataque };
        return raiz._ficha;
    }

    function colorVida(r) { return r > 0.6 ? '#4caf50' : r > 0.3 ? '#ffc107' : '#e53935'; }

    function crearBarra(raiz) {
        const barra = document.createElement('a-entity');
        barra.className = 'dinamico barra-vida';
        barra.setAttribute('position', '0 ' + ALTURA_BARRA + ' 0');
        barra.setAttribute('look-at', '[camera]');
        barra.innerHTML =
            '<a-plane width="' + (ANCHO_BARRA + 0.06) + '" height="0.18" color="#111" opacity="0.85" material="shader: flat; transparent: true"></a-plane>' +
            '<a-plane class="relleno" width="' + ANCHO_BARRA + '" height="0.12" position="0 0 0.01" color="#4caf50" material="shader: flat"></a-plane>';
        raiz.appendChild(barra);
        return barra;
    }
    function actualizarBarras() {
        raicesVisibles().forEach(function (raiz) {
            let barra = raiz.querySelector(':scope > .barra-vida');
            if (!barra) barra = crearBarra(raiz);
            const f = ficha(raiz);
            barra.object3D.visible = !raiz._muerto;
            const relleno = barra.querySelector('.relleno');
            if (!relleno || !relleno.object3D) return;
            const r = Math.max(0, f.vida / f.vidaMax);
            relleno.object3D.scale.x = Math.max(0.001, r);
            relleno.object3D.position.x = -ANCHO_BARRA * (1 - r) / 2;
            const color = colorVida(r);
            if (relleno._color !== color) { relleno.setAttribute('color', color); relleno._color = color; }
        });
    }
    setInterval(actualizarBarras, 150);

    function cartel(raiz, texto, color, sube) {
        const t = document.createElement('a-text');
        t.className = 'dinamico';
        t.setAttribute('value', texto);
        t.setAttribute('align', 'center');
        t.setAttribute('color', color);
        t.setAttribute('width', sube ? '5' : '6');
        const y = ALTURA_BARRA + 0.35;
        t.setAttribute('position', '0 ' + y + ' 0');
        t.setAttribute('look-at', '[camera]');
        if (sube) t.setAttribute('animation', 'property: position; to: 0 ' + (y + 0.7) + ' 0; dur: 900; easing: easeOutQuad');
        raiz.appendChild(t);
        if (sube) setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 900);
        return t;
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

    // --- elegir el personaje (o lápida) más cercano al click, en pantalla ---
    function personajeEn(x, y, lienzo) {
        const camara = escena().camera;
        const caja = lienzo.getBoundingClientRect();
        const limite = Math.max(60, caja.width * 0.08);
        let mejor = null, dMin = limite;
        raicesVisibles().forEach(function (raiz) {
            raiz.object3D.updateMatrixWorld(true);
            const p = new THREE.Vector3(0, raiz._muerto ? 0.4 : 0.8, 0).applyMatrix4(raiz.object3D.matrixWorld).project(camara);
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
        const bandoA = ficha(a).bando;
        let rival = null, dMin = window.pasoAR * 1.6;
        personajesVisibles().forEach(function (b) {
            if (b === a || b._accion || ficha(b).bando === bandoA) return;   // solo bandos opuestos
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

    function pelear(a, b) {
        a._accion = b._accion = 'pelea';
        const aviso = cartel(a, '¡PELEA!', '#ffcc00', false);
        if (window.Comunicacion) Comunicacion.enviarAlPadre({ action: 'pelea', slots: [slotDe(a), slotDe(b)] });
        let atacante = a, defensor = b;
        (function turno() {
            animar(atacante, 'Atacar', true);
            setTimeout(function () {
                const dano = ficha(atacante).ataque;
                const fd = ficha(defensor);
                fd.vida = Math.max(0, fd.vida - dano);
                cartel(defensor, '-' + dano, '#ff5252', true);
                animar(defensor, 'Golpe', true);
            }, TURNO_MS * 0.35);
            setTimeout(function () {
                animar(atacante, 'Quieto');
                if (ficha(defensor).vida <= 0) {
                    if (aviso.parentNode) aviso.parentNode.removeChild(aviso);
                    a._accion = b._accion = null;
                    morir(defensor);
                    return;
                }
                animar(defensor, 'Quieto');
                const t = atacante; atacante = defensor; defensor = t;
                turno();
            }, TURNO_MS);
        })();
    }

    // --- muerte y lápida ---
    function morir(raiz) {
        raiz._muerto = true;
        raiz._accion = 'muerte';
        animar(raiz, 'Morir', true);
        if (window.Comunicacion) Comunicacion.enviarAlPadre({ action: 'muerte', slot: slotDe(raiz) });
        const m = modeloDe(raiz);
        setTimeout(function () {
            // se hunde en el piso
            const t0 = performance.now();
            (function hundir() {
                const t = Math.min(1, (performance.now() - t0) / 700);
                if (m) m.object3D.position.y = -1.2 * t;
                if (t < 1) { requestAnimationFrame(hundir); return; }
                if (m) m.object3D.visible = false;
                // y aparece la lápida
                const lapida = document.createElement('a-entity');
                lapida.className = 'dinamico lapida';
                lapida.setAttribute('gltf-model', 'url(modelos/kaykit/lapida.glb)');
                lapida.setAttribute('scale', '0.01 0.01 0.01');
                lapida.setAttribute('animation', 'property: scale; to: 0.5 0.5 0.5; dur: 500; easing: easeOutBack');
                raiz.appendChild(lapida);
                raiz._accion = null;
            })();
        }, 1400);
    }

    function revivir(raiz) {
        const lapida = raiz.querySelector(':scope > .lapida');
        if (lapida) lapida.parentNode.removeChild(lapida);
        const m = modeloDe(raiz);
        if (m) { m.object3D.position.y = 0; m.object3D.visible = true; }
        const f = ficha(raiz);
        f.vida = f.vidaMax;
        raiz._muerto = false;
        raiz._accion = null;
        animar(raiz, 'Quieto');
        cartel(raiz, '+' + f.vidaMax, '#69f0ae', true);
    }

    // Para usar desde la consola o desde el DM más adelante
    window.AccionesAR = { caminar: caminar, pelear: pelear, morir: morir, revivir: revivir, buscarRival: buscarRival, ficha: ficha, personajesVisibles: personajesVisibles };

    // --- click derecho ---
    window.addEventListener('contextmenu', function (ev) {
        const s = escena();
        const lienzo = s && s.canvas;
        if (!lienzo || ev.target !== lienzo) return;   // fuera de la escena: menú normal
        ev.preventDefault();
        const raiz = personajeEn(ev.clientX, ev.clientY, lienzo);
        if (!raiz || raiz._accion) return;
        if (raiz._muerto) { if (ev.shiftKey) revivir(raiz); return; }   // lápida: Shift revive
        if (ev.shiftKey) { caminar(raiz, 0); return; }                   // vuelve a su código
        caminar(raiz, (raiz._avance || 0) + window.pasoAR, function () {
            const rival = buscarRival(raiz);
            if (rival) pelear(raiz, rival);
        });
    });
})();
