// js/acciones.js
// ------------------------------------------------------------------
// ACCIONES DE LOS PERSONAJES (los que tienen class="personaje")
//
//  - Barra de vida arriba de cada personaje (verde -> amarilla -> roja).
//  - Click derecho sobre un personaje: camina un paso hacia adelante
//    (el largo del paso se ajusta con la barrita "Paso").
//  - Shift + click derecho: vuelve a su código. Sobre una lápida: revive.
//  - Si un personaje queda a un paso de uno del OTRO bando (porque caminó o
//    porque lo acercaron con la mano; data-bando="heroe" / "malo") y los dos
//    se miran de frente: pelean por
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
    const ANCHO_BARRA = 0.55;     // en anchos de código (antes de la barrita Tamaño)
    const ALTO_BARRA = 0.07;
    const SOBRE_CABEZA = 0.06;    // cuánto más arriba de la cabeza va la barra
    const DESCANSO_MS = 3000;     // el que gana una pelea no vuelve a pelear enseguida
    const ALCANCE_MIN = 2.6;      // distancia mínima de pelea, en anchos de código (~14 cm)
    const ALTURA_SIN_CABEZA = 1.4;

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

    // Dónde termina la cabeza de este personaje (casco, sombrero o capucha
    // incluidos), en las medidas del código. Se mide una vez, cuando el modelo cargó.
    function alturaCabeza(raiz) {
        const m = modeloDe(raiz);
        const malla = m && m.getObject3D('mesh');
        if (!malla) return null;
        if (raiz._cabeza && raiz._cabeza.malla === malla) return raiz._cabeza.y;
        raiz.object3D.updateMatrixWorld(true);
        const aLocal = new THREE.Matrix4().copy(raiz.object3D.matrixWorld).invert();
        const caja = new THREE.Box3(), parte = new THREE.Box3();
        malla.traverse(function (o) {
            if (!o.isMesh || !/head|hat|helmet|hood|skull/i.test(o.name)) return;
            if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
            parte.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).applyMatrix4(aLocal);
            caja.union(parte);
        });
        const y = caja.isEmpty() ? ALTURA_SIN_CABEZA : caja.max.y;
        raiz._cabeza = { malla: malla, y: y };
        return y;
    }

    function crearBarra(raiz) {
        const barra = document.createElement('a-entity');
        barra.className = 'dinamico barra-vida';
        barra.setAttribute('look-at', '[camera]');
        barra.innerHTML =
            '<a-plane width="' + (ANCHO_BARRA + 0.03) + '" height="' + (ALTO_BARRA + 0.03) + '" color="#111" opacity="0.85" material="shader: flat; transparent: true"></a-plane>' +
            '<a-plane class="relleno" width="' + ANCHO_BARRA + '" height="' + ALTO_BARRA + '" position="0 0 0.005" color="#4caf50" material="shader: flat"></a-plane>';
        raiz.appendChild(barra);
        return barra;
    }
    function alturaBarra(raiz) {
        const y = alturaCabeza(raiz);
        return (y === null ? ALTURA_SIN_CABEZA : y) + SOBRE_CABEZA;
    }
    function actualizarBarras() {
        raicesVisibles().forEach(function (raiz) {
            let barra = raiz.querySelector(':scope > .barra-vida');
            if (!barra) barra = crearBarra(raiz);
            const f = ficha(raiz);
            barra.object3D.position.y = alturaBarra(raiz);
            barra.object3D.visible = !raiz._muerto && alturaCabeza(raiz) !== null;
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
        t.setAttribute('width', sube ? '3' : '3.5');
        const y = alturaBarra(raiz) + 0.2;
        t.setAttribute('position', '0 ' + y + ' 0');
        t.setAttribute('look-at', '[camera]');
        if (sube) t.setAttribute('animation', 'property: position; to: 0 ' + (y + 0.5) + ' 0; dur: 900; easing: easeOutQuad');
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
        // Alcance: un paso y medio, pero nunca menos de 2,6 anchos de código: dos
        // papeles pegados (con su margen blanco) ya quedan a 1,6-2,5 de distancia.
        let rival = null, dMin = Math.max(window.pasoAR * 1.6, ALCANCE_MIN);
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
                    atacante._descanso = performance.now() + DESCANSO_MS;
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
        descarbonizar(raiz);
        const f = ficha(raiz);
        f.vida = f.vidaMax;
        raiz._muerto = false;
        raiz._accion = null;
        animar(raiz, 'Quieto');
        cartel(raiz, '+' + f.vidaMax, '#69f0ae', true);
    }

    // =================================================================
    // HECHIZOS (data-hechizos en el .personaje, por ahora "bola-de-fuego")
    // =================================================================
    function enMundo(raiz, x, y, z) {
        raiz.object3D.updateMatrixWorld(true);
        return new THREE.Vector3(x, y, z).applyMatrix4(raiz.object3D.matrixWorld);
    }
    function esferaDeFuego(radio, color, opacidad) {
        const e = document.createElement('a-entity');
        e.setAttribute('geometry', 'primitive: sphere; radius: ' + radio + '; segmentsWidth: 12; segmentsHeight: 8');
        e.setAttribute('material', 'shader: flat; color: ' + color + '; transparent: true; opacity: ' + opacidad);
        return e;
    }
    function borrarEn(e, ms) { setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, ms); }

    // Carbonizado: negro con brasas naranjas que se apagan. Se guarda el color
    // original para cuando revive.
    function carbonizar(raiz) {
        const malla = modeloDe(raiz) && modeloDe(raiz).getObject3D('mesh');
        if (!malla) return;
        const mats = [];
        malla.traverse(function (o) {
            if (!o.isMesh) return;
            (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
                if (!m.userData.colorOriginal) m.userData.colorOriginal = { color: m.color.clone(), emissive: m.emissive ? m.emissive.clone() : null, intensidad: m.emissiveIntensity };
                m.color.set('#1c1410');
                if (m.emissive) { m.emissive.set('#ff4a00'); m.emissiveIntensity = 1.2; }
                mats.push(m);
            });
        });
        const t0 = performance.now();
        (function brasas() {
            const t = Math.min(1, (performance.now() - t0) / 1500);
            mats.forEach(function (m) { if (m.emissive) m.emissiveIntensity = 1.2 * (1 - t); });
            if (t < 1) requestAnimationFrame(brasas);
        })();
    }
    function descarbonizar(raiz) {
        const malla = modeloDe(raiz) && modeloDe(raiz).getObject3D('mesh');
        if (!malla) return;
        malla.traverse(function (o) {
            if (!o.isMesh) return;
            (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
                const orig = m.userData.colorOriginal;
                if (!orig) return;
                m.color.copy(orig.color);
                if (orig.emissive) { m.emissive.copy(orig.emissive); m.emissiveIntensity = orig.intensidad; }
            });
        });
    }

    function bolaDeFuego(lanzador, objetivo) {
        lanzador._accion = 'hechizo';
        objetivo._accion = 'hechizo';
        if (window.Comunicacion) Comunicacion.enviarAlPadre({ action: 'hechizo', hechizo: 'bola-de-fuego', de: slotDe(lanzador), a: slotDe(objetivo) });
        // el mago se da vuelta hacia el enemigo
        const m = modeloDe(lanzador);
        lanzador.object3D.updateMatrixWorld(true);
        const local = posicion(objetivo).applyMatrix4(new THREE.Matrix4().copy(lanzador.object3D.matrixWorld).invert());
        if (m) m.object3D.rotation.y = Math.atan2(local.x, local.z);
        animar(lanzador, 'Atacar', true);

        setTimeout(function () {
            const escenaEl = escena();
            const desde = enMundo(lanzador, 0, 1.0, 0), escala = window.escalaAR;
            const bola = esferaDeFuego(0.11 * escala, '#ffd54f', 1);
            const halo = esferaDeFuego(0.2 * escala, '#ff3d00', 0.45);
            bola.appendChild(halo);
            // Ojo: sin luz propia. Si una escena de A-Frame recibe una luz, apaga sus
            // luces por defecto, y al desaparecer la bola todo queda negro.
            bola.object3D.position.copy(desde);
            escenaEl.appendChild(bola);
            const t0 = performance.now(), DUR = 650;
            let ultimaChispa = 0;
            (function volar() {
                const ahora = performance.now();
                const t = Math.min(1, (ahora - t0) / DUR);
                const hasta = enMundo(objetivo, 0, 0.8, 0);   // sigue al enemigo aunque se mueva
                const p = desde.clone().lerp(hasta, t);
                p.y += Math.sin(Math.PI * t) * 0.35 * escala;  // un poquito de arco
                bola.object3D.position.copy(p);
                bola.object3D.scale.setScalar(1 + 0.15 * Math.sin(ahora / 40));
                if (ahora - ultimaChispa > 45) {                 // estela
                    ultimaChispa = ahora;
                    const chispa = esferaDeFuego(0.07 * escala, '#ff6d00', 0.7);
                    chispa.object3D.position.copy(p);
                    chispa.setAttribute('animation', 'property: scale; to: 0.05 0.05 0.05; dur: 350');
                    escenaEl.appendChild(chispa);
                    borrarEn(chispa, 360);
                }
                if (t < 1) { requestAnimationFrame(volar); return; }
                // impacto
                bola.parentNode.removeChild(bola);
                const explosion = esferaDeFuego(0.3 * escala, '#ff6d00', 0.85);
                explosion.object3D.position.copy(hasta);
                explosion.setAttribute('animation__crece', 'property: scale; to: 3.2 3.2 3.2; dur: 450; easing: easeOutQuad');
                explosion.setAttribute('animation__apaga', 'property: material.opacity; to: 0; dur: 450; easing: easeInQuad');
                escenaEl.appendChild(explosion);
                borrarEn(explosion, 470);
                const f = ficha(objetivo);
                cartel(objetivo, '-' + f.vida, '#ff5252', true);
                f.vida = 0;
                carbonizar(objetivo);
                objetivo._accion = null;
                morir(objetivo);
                setTimeout(function () {
                    if (m) m.object3D.rotation.y = 0;
                    animar(lanzador, 'Quieto');
                    lanzador._accion = null;
                    lanzador._descanso = performance.now() + DESCANSO_MS;
                }, 500);
            })();
        }, 450);
    }

    // --- menú del click derecho (para los que tienen hechizos) ---
    let menu = null, apuntando = null, avisoApuntar = null;
    function cerrarMenu() { if (menu && menu.parentNode) menu.parentNode.removeChild(menu); menu = null; }
    function dejarDeApuntar() {
        apuntando = null;
        const s = escena(); if (s && s.canvas) s.canvas.style.cursor = '';
        if (avisoApuntar && avisoApuntar.parentNode) avisoApuntar.parentNode.removeChild(avisoApuntar);
        avisoApuntar = null;
    }
    const ESTILO_CAJA = 'position:fixed;z-index:30;background:rgba(20,20,30,.92);color:#fff;font:14px "Segoe UI",sans-serif;' +
        'border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.5);';
    function mostrarMenu(raiz, x, y) {
        cerrarMenu();
        menu = document.createElement('div');
        menu.style.cssText = ESTILO_CAJA + 'padding:6px;display:flex;flex-direction:column;gap:4px;min-width:170px;' +
            'left:' + Math.min(x, innerWidth - 190) + 'px;top:' + Math.min(y, innerHeight - 110) + 'px';
        const opciones = [];
        if ((modeloDe(raiz).getAttribute('data-hechizos') || '').indexOf('bola-de-fuego') !== -1) {
            opciones.push(['🔥 Bola de fuego', function () { empezarAApuntar(raiz); }]);
        }
        opciones.push(['🚶 Caminar', function () { caminarYBuscar(raiz); }]);
        opciones.forEach(function (op) {
            const b = document.createElement('button');
            b.textContent = op[0];
            b.style.cssText = 'all:unset;cursor:pointer;padding:9px 12px;border-radius:7px;font-size:15px';
            b.onmouseenter = function () { b.style.background = 'rgba(255,255,255,.12)'; };
            b.onmouseleave = function () { b.style.background = ''; };
            b.onclick = function (e) { e.stopPropagation(); cerrarMenu(); op[1](); };
            menu.appendChild(b);
        });
        document.body.appendChild(menu);
    }
    function empezarAApuntar(raiz) {
        apuntando = raiz;
        const s = escena(); if (s && s.canvas) s.canvas.style.cursor = 'crosshair';
        avisoApuntar = document.createElement('div');
        avisoApuntar.style.cssText = ESTILO_CAJA + 'left:50%;top:14px;transform:translateX(-50%);padding:9px 16px';
        avisoApuntar.textContent = '🔥 Elegí un enemigo · Esc cancela';
        document.body.appendChild(avisoApuntar);
    }
    function avisoBreve(texto) {
        const d = document.createElement('div');
        d.style.cssText = ESTILO_CAJA + 'left:50%;top:14px;transform:translateX(-50%);padding:9px 16px';
        d.textContent = texto;
        document.body.appendChild(d);
        borrarEn(d, 1600);
    }
    function elegirObjetivo(x, y, lienzo) {
        const lanzador = apuntando;
        const objetivo = personajeEn(x, y, lienzo);
        dejarDeApuntar();
        if (!lanzador || lanzador._muerto || lanzador._accion) return;
        if (!objetivo || objetivo._muerto) { avisoBreve('No había ningún enemigo ahí'); return; }
        if (ficha(objetivo).bando === ficha(lanzador).bando) { avisoBreve('Ese no es un enemigo'); return; }
        if (objetivo._accion) { avisoBreve('Está ocupado peleando'); return; }
        bolaDeFuego(lanzador, objetivo);
    }
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape') { cerrarMenu(); dejarDeApuntar(); } });
    window.addEventListener('click', function (ev) {
        if (menu && !menu.contains(ev.target)) cerrarMenu();
        const s = escena();
        if (apuntando && s && ev.target === s.canvas) { ev.preventDefault(); elegirObjetivo(ev.clientX, ev.clientY, s.canvas); }
    });

    function caminarYBuscar(raiz) {
        if (raiz._accion || raiz._muerto) return;
        caminar(raiz, (raiz._avance || 0) + window.pasoAR, function () {
            const rival = buscarRival(raiz);
            if (rival) pelear(raiz, rival);
        });
    }

    // --- peleas sin click: si un héroe y un malo quedan cara a cara y cerca
    // (porque caminaron o porque los acercaron con la mano), pelean solos ---
    setInterval(function () {
        const ahora = performance.now();
        personajesVisibles().forEach(function (a) {
            if (a._accion || a._descanso > ahora) return;
            const rival = buscarRival(a);
            if (rival && !(rival._descanso > ahora)) pelear(a, rival);
        });
    }, 500);

    // Para usar desde la consola o desde el DM más adelante
    window.AccionesAR = { caminar: caminar, pelear: pelear, morir: morir, revivir: revivir, bolaDeFuego: bolaDeFuego, buscarRival: buscarRival, ficha: ficha, personajesVisibles: personajesVisibles };

    // --- click derecho ---
    window.addEventListener('contextmenu', function (ev) {
        const s = escena();
        const lienzo = s && s.canvas;
        if (!lienzo || ev.target !== lienzo) return;   // fuera de la escena: menú normal
        ev.preventDefault();
        cerrarMenu();
        if (apuntando) { elegirObjetivo(ev.clientX, ev.clientY, lienzo); return; }   // apuntando: el click derecho también elige
        const raiz = personajeEn(ev.clientX, ev.clientY, lienzo);
        if (!raiz || raiz._accion) return;
        if (raiz._muerto) { if (ev.shiftKey) revivir(raiz); return; }   // lápida: Shift revive
        if (ev.shiftKey) { caminar(raiz, 0); return; }                   // vuelve a su código
        if (modeloDe(raiz).getAttribute('data-hechizos')) { mostrarMenu(raiz, ev.clientX, ev.clientY); return; }
        caminarYBuscar(raiz);
    });
})();
