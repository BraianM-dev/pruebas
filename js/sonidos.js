// js/sonidos.js
// ------------------------------------------------------------------
// SONIDOS DEL JUEGO
//  - Pasos, cortes y golpes: archivos de sonidos/ (Kenney "RPG Audio", CC0).
//  - Bola de fuego, explosión, muerte, revivir, lápida y el AMBIENTE de
//    mazmorra (zumbido grave, viento y gotas): los genera el navegador con
//    Web Audio, sin archivos.
//  - Los navegadores no dejan sonar nada hasta que la persona toca la página:
//    el sonido arranca con el primer click o toque.
//  - Fila "Sonido" en la caja de controles: prender/apagar y volumen
//    (se recuerda).
// Lo usa acciones.js a través de window.Sonidos.
// ------------------------------------------------------------------

(function () {
    const ARCHIVOS = {
        paso: ['paso_0', 'paso_1', 'paso_2', 'paso_3', 'paso_4'],
        corte: ['corte_1', 'corte_2'],
        golpe: ['golpe'],
        desenvainar: ['desenvainar'],
        metal: ['metal'],
        tela: ['tela']
    };
    let ctx = null, maestro = null, buffers = {}, ambiente = null;
    let activo = true, volumen = 0.8;
    try {
        if (localStorage.getItem('sonidoAR') === 'no') activo = false;
        const v = parseFloat(localStorage.getItem('volumenAR'));
        if (v >= 0 && v <= 1) volumen = v;
    } catch (e) { /* sin localStorage */ }

    function iniciar() {
        if (ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        maestro = ctx.createGain();
        maestro.gain.value = activo ? volumen : 0;
        maestro.connect(ctx.destination);
        Object.keys(ARCHIVOS).forEach(function (k) {
            buffers[k] = [];
            ARCHIVOS[k].forEach(function (nombre) {
                fetch('sonidos/' + nombre + '.mp3')
                    .then(function (r) { return r.arrayBuffer(); })
                    .then(function (a) { return new Promise(function (ok, mal) { ctx.decodeAudioData(a, ok, mal); }); })
                    .then(function (b) { buffers[k].push(b); })
                    .catch(function (e) { console.warn('[sonidos] no cargó', nombre, e); });
            });
        });
    }
    // El primer click/toque destraba el audio y arranca el ambiente
    function destrabar() {
        iniciar();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        if (!ambiente) ambiente = crearAmbiente();
    }
    ['pointerdown', 'touchstart', 'keydown', 'contextmenu'].forEach(function (ev) {
        window.addEventListener(ev, destrabar, { capture: true });
    });

    // --- reproducir un archivo (con un poco de variación para que no suene igual) ---
    function tocar(tipo, vol, tono) {
        if (!ctx || !activo) return;
        const lista = buffers[tipo];
        if (!lista || !lista.length) return;
        const fuente = ctx.createBufferSource();
        fuente.buffer = lista[Math.floor(Math.random() * lista.length)];
        fuente.playbackRate.value = (tono || 1) * (0.92 + Math.random() * 0.16);
        const g = ctx.createGain();
        g.gain.value = vol === undefined ? 1 : vol;
        fuente.connect(g); g.connect(maestro);
        fuente.start();
    }

    // --- piezas para los sonidos generados ---
    function ruido(segundos) {
        const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * segundos), ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const s = ctx.createBufferSource();
        s.buffer = b;
        return s;
    }
    function tono(tipo, desde, hasta, dur, vol, cuando) {
        const t = ctx.currentTime + (cuando || 0);
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = tipo;
        o.frequency.setValueAtTime(desde, t);
        o.frequency.exponentialRampToValueAtTime(hasta, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(maestro);
        o.start(t); o.stop(t + dur + 0.05);
    }

    // Bola de fuego volando: soplido que sube + chisporroteo
    function zumbidoFuego(dur) {
        if (!ctx || !activo) return;
        const t = ctx.currentTime;
        const n = ruido(dur + 0.2), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'bandpass'; f.Q.value = 1.2;
        f.frequency.setValueAtTime(300, t);
        f.frequency.exponentialRampToValueAtTime(1800, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.08);
        g.gain.setValueAtTime(0.5, t + dur * 0.8);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
        n.connect(f); f.connect(g); g.connect(maestro);
        n.start(t); n.stop(t + dur + 0.2);
        for (let i = 0; i < 6; i++) tono('square', 2500 + Math.random() * 2000, 800, 0.03, 0.04, Math.random() * dur);
    }
    // Explosión: estallido de ruido que se oscurece + golpe grave
    function explosion() {
        if (!ctx || !activo) return;
        const t = ctx.currentTime;
        const n = ruido(1.2), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(3000, t);
        f.frequency.exponentialRampToValueAtTime(120, t + 1.0);
        g.gain.setValueAtTime(0.9, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
        n.connect(f); f.connect(g); g.connect(maestro);
        n.start(t); n.stop(t + 1.2);
        tono('sine', 110, 35, 0.6, 0.9);
    }
    // Muerte: quejido que baja + cuerpo que cae
    function muerte() {
        if (!ctx || !activo) return;
        tono('triangle', 420, 70, 0.9, 0.25);
        setTimeout(function () { tocar('tela', 0.8, 0.8); tocar('golpe', 0.9, 0.6); }, 650);
    }
    // Lápida: piedra que se apoya
    function lapida() {
        if (!ctx || !activo) return;
        tono('sine', 140, 45, 0.35, 0.7);
        tocar('golpe', 0.7, 0.5);
    }
    // Revivir: arpegio que sube
    function revivir() {
        if (!ctx || !activo) return;
        [523, 659, 784, 1047].forEach(function (f, i) { tono('triangle', f, f * 1.01, 0.35, 0.18, i * 0.09); });
    }

    // --- AMBIENTE de mazmorra: zumbido grave + viento + gotas ---
    function crearAmbiente() {
        const salida = ctx.createGain();
        salida.gain.value = 0.0001;
        salida.connect(maestro);
        salida.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 3);   // entra despacio

        // zumbido grave (dos tonos apenas desafinados) que respira
        const filtro = ctx.createBiquadFilter();
        filtro.type = 'lowpass'; filtro.frequency.value = 180;
        const gz = ctx.createGain(); gz.gain.value = 0.05;
        [55, 55.6].forEach(function (f) {
            const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
            o.connect(filtro); o.start();
        });
        const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
        lfo.frequency.value = 0.07; lfoG.gain.value = 70;
        lfo.connect(lfoG); lfoG.connect(filtro.frequency); lfo.start();
        filtro.connect(gz); gz.connect(salida);

        // viento: ruido filtrado que sube y baja
        const viento = ruido(4); viento.loop = true;
        const fv = ctx.createBiquadFilter(); fv.type = 'bandpass'; fv.frequency.value = 500; fv.Q.value = 0.8;
        const gv = ctx.createGain(); gv.gain.value = 0.025;
        const lfo2 = ctx.createOscillator(), lfo2G = ctx.createGain();
        lfo2.frequency.value = 0.11; lfo2G.gain.value = 0.02;
        lfo2.connect(lfo2G); lfo2G.connect(gv.gain); lfo2.start();
        viento.connect(fv); fv.connect(gv); gv.connect(salida); viento.start();

        // gotas que caen de vez en cuando, con eco
        const eco = ctx.createDelay(); eco.delayTime.value = 0.23;
        const ecoG = ctx.createGain(); ecoG.gain.value = 0.35;
        eco.connect(ecoG); ecoG.connect(eco); ecoG.connect(salida);
        (function gota() {
            if (activo && ctx.state === 'running') {
                const t = ctx.currentTime, f = 900 + Math.random() * 900;
                const o = ctx.createOscillator(), g = ctx.createGain();
                o.type = 'sine';
                o.frequency.setValueAtTime(f, t);
                o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.12);
                g.gain.setValueAtTime(0.0001, t);
                g.gain.exponentialRampToValueAtTime(0.06, t + 0.005);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
                o.connect(g); g.connect(salida); g.connect(eco);
                o.start(t); o.stop(t + 0.2);
            }
            setTimeout(gota, 1800 + Math.random() * 4500);
        })();
        return salida;
    }

    // --- pasos mientras camina ---
    function pasos(duracionMs) {
        if (!ctx || !activo) return;
        const cada = 300, n = Math.max(1, Math.round(duracionMs / cada));
        for (let i = 0; i < n; i++) setTimeout(function () { tocar('paso', 0.55); }, i * cada);
    }

    // --- prender/apagar y volumen ---
    function aplicar() {
        if (maestro) maestro.gain.setTargetAtTime(activo ? volumen : 0, ctx.currentTime, 0.05);
        try {
            localStorage.setItem('sonidoAR', activo ? 'si' : 'no');
            localStorage.setItem('volumenAR', String(volumen));
        } catch (e) { /* no se recuerda */ }
    }
    function crearControles() {
        const caja = document.getElementById('barra-tamano');
        const fila = document.createElement('div');
        fila.style.cssText = 'display:flex;align-items:center;gap:8px';
        fila.innerHTML = '<button id="sonido-ar" type="button" style="all:unset;cursor:pointer;font-size:16px;width:52px" title="Prender o apagar el sonido"></button>' +
            '<input id="volumen-ar" type="range" min="0" max="1" step="0.05" style="width:140px">' +
            '<span id="volumen-ar-valor" style="min-width:38px;text-align:right"></span>';
        if (caja) caja.insertBefore(fila, caja.lastElementChild);   // antes del texto de ayuda
        else { fila.style.cssText += ';position:fixed;left:12px;bottom:12px;z-index:20;background:rgba(20,20,30,.85);color:#fff;padding:6px 10px;border-radius:10px'; document.body.appendChild(fila); }
        const boton = fila.querySelector('#sonido-ar'), barra = fila.querySelector('#volumen-ar'), valor = fila.querySelector('#volumen-ar-valor');
        function pintar() { boton.textContent = activo ? '🔊 Sonido' : '🔇 Sonido'; barra.value = volumen; valor.textContent = Math.round(volumen * 100) + '%'; barra.disabled = !activo; }
        boton.addEventListener('click', function () { destrabar(); activo = !activo; aplicar(); pintar(); });
        barra.addEventListener('input', function () { volumen = parseFloat(barra.value); aplicar(); pintar(); });
        pintar();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', crearControles);
    else crearControles();

    window.Sonidos = {
        pasos: pasos,
        corte: function () { tocar('corte', 0.8); },
        golpe: function () { tocar('golpe', 1); },
        desenvainar: function () { tocar('desenvainar', 0.7); },
        zumbidoFuego: zumbidoFuego,
        explosion: explosion,
        muerte: muerte,
        lapida: lapida,
        revivir: revivir
    };
})();
