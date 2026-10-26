// js/utilidades.js
// Herramientas de UI, gestión de modelos y paneles de stats en AR

const Utilidades = {

    UI: {
        marcador: document.getElementById('marcador-id'),
        modelo: document.getElementById('modelo-id'),
        estado: document.getElementById('estado-id'),
        fps: document.getElementById('fps-id'),
        panel: document.getElementById('panel-info'),
        toggleBtn: document.getElementById('panel-info-toggle')
    },

    modelosAsignados: {},
    statsAsignadas: {},
    slotsActualmenteVisibles: {},

    togglePanel: function (visible) {
        if (!this.UI.panel) return;
        const mostrar = (visible !== undefined) ? visible : this.UI.panel.classList.contains('hidden');
        this.UI.panel.classList.toggle('hidden', !mostrar);
        if (this.UI.toggleBtn) {
            this.UI.toggleBtn.textContent = mostrar ? 'Ocultar panel' : 'Mostrar panel';
        }
    },

    marcadorEncontrado: function (idMarcador, nombreModelo) {
        if (this.UI.marcador) this.UI.marcador.innerText = idMarcador;
        if (this.UI.modelo) this.UI.modelo.innerText = nombreModelo || '-';
        if (this.UI.estado) {
            this.UI.estado.innerText = "Detectado";
            this.UI.estado.style.color = "#4CAF50";
        }
    },

    marcadorPerdido: function () {
        if (this.UI.marcador) this.UI.marcador.innerText = "Ninguno";
        if (this.UI.modelo) this.UI.modelo.innerText = "-";
        if (this.UI.estado) {
            this.UI.estado.innerText = "Buscando...";
            this.UI.estado.style.color = "#FFD700";
        }
    },

    slotFromMarkerId: function (markerId) {
        if (markerId === 'marker-hiro') return 'hiro';
        if (markerId === 'marker-kanji') return 'kanji';
        const m = markerId.match(/^marker-(\d+)$/);
        return m ? m[1] : markerId;
    },

    markerElPorSlot: function (slot) {
        const slotStr = String(slot);
        if (slotStr === 'hiro') return document.getElementById('marker-hiro');
        if (slotStr === 'kanji') return document.getElementById('marker-kanji');
        return document.getElementById('marker-' + slotStr);
    },

    infoMarcador: function (markerId) {
        return this.modelosAsignados[this.slotFromMarkerId(markerId)] || null;
    },

    // Muestra u oculta los slots de un marcador específico
    slotVisible: function (slot, visible) {
        const marker = this.markerElPorSlot(slot);
        if (!marker) return;
        const modelSlot = marker.querySelector('.model-slot');
        const statsSlot = marker.querySelector('.stats-slot');
        if (modelSlot) modelSlot.setAttribute('visible', visible ? 'true' : 'false');
        if (statsSlot) statsSlot.setAttribute('visible', visible ? 'true' : 'false');
        this.slotsActualmenteVisibles[slot] = !!visible;
    },

    ocultarTodosSlots: function () {
        Object.keys(this.modelosAsignados).forEach(slot => this.slotVisible(slot, false));
    },

    crearEntidadModelo: function (config) {
        const el = document.createElement('a-entity');
        el.setAttribute('position', config.position || '0 0 0');
        el.setAttribute('rotation', config.rotation || '0 0 0');
        el.setAttribute('scale', config.scale || '1 1 1');

        switch (config.type) {
            case 'gltf':
                el.setAttribute('gltf-model', config.url);
                if (config.animated) el.setAttribute('animation-mixer', '');
                break;
            case 'fbx':
                el.setAttribute('fbx-model', 'src: url(' + config.url + ')');
                if (config.animated) el.setAttribute('animation-mixer', 'clip: *; loop: repeat');
                break;
            case 'image':
                el.setAttribute('geometry', 'primitive: plane; width: 1.5; height: 1.5');
                el.setAttribute('material', 'src: ' + config.url + '; transparent: true; alphaTest: 0.5');
                el.setAttribute('rotation', config.rotation || '-90 0 0');
                break;
            case 'video':
                el.setAttribute('geometry', 'primitive: plane; width: 2; height: 1.2');
                el.setAttribute('material', 'src: ' + config.url);
                el.setAttribute('rotation', config.rotation || '-90 0 0');
                break;
            case 'gif':
                el.setAttribute('geometry', 'primitive: plane; width: 1; height: 1');
                el.setAttribute('material', 'shader: gif; src: ' + config.url);
                el.setAttribute('rotation', config.rotation || '-90 0 0');
                break;
            case 'trees':
                el.appendChild(this._crearArboles());
                break;
            case 'none':
            default:
                el.setAttribute('geometry', 'primitive: box; width: 0.3; height: 0.3; depth: 0.3');
                el.setAttribute('material', 'color: #888; opacity: 0.4');
        }
        return el;
    },

    _crearArboles: function () {
        const cont = document.createElement('a-entity');
        const p1 = document.createElement('a-entity');
        p1.setAttribute('position', '-0.8 0 -0.3');
        [45, -45].forEach(rot => {
            const p = document.createElement('a-plane');
            p.setAttribute('src', '#arbol1');
            p.setAttribute('transparent', 'true');
            p.setAttribute('alpha-test', '0.5');
            p.setAttribute('width', '3');
            p.setAttribute('height', '3');
            p.setAttribute('position', '0 0.65 0');
            p.setAttribute('rotation', '0 ' + rot + ' 0');
            p1.appendChild(p);
        });
        cont.appendChild(p1);
        const p2 = document.createElement('a-entity');
        p2.setAttribute('position', '0.9 0 0.5');
        [45, -45].forEach(rot => {
            const p = document.createElement('a-plane');
            p.setAttribute('src', '#arbol2');
            p.setAttribute('transparent', 'true');
            p.setAttribute('alpha-test', '0.5');
            p.setAttribute('width', '3');
            p.setAttribute('height', '3');
            p.setAttribute('position', '0 0.55 0');
            p.setAttribute('rotation', '0 ' + rot + ' 0');
            p2.appendChild(p);
        });
        cont.appendChild(p2);
        return cont;
    },

    asignarModelo: function (slot, config) {
        const marker = this.markerElPorSlot(slot);
        if (!marker) {
            console.warn('[AR] Marker no encontrado para slot:', slot);
            return false;
        }
        const modelSlot = marker.querySelector('.model-slot');
        if (!modelSlot) return false;
        while (modelSlot.firstChild) modelSlot.removeChild(modelSlot.firstChild);
        const modelo = this.crearEntidadModelo(config);
        modelSlot.appendChild(modelo);
        // NO forzamos 'visible'. El slot hereda la visibilidad del marcador.
        // Solo se mostrará cuando markerFound dispare slotVisible(slot, true).
        this.modelosAsignados[slot] = config;
        return true;
    },

    limpiarModelo: function (slot) {
        return this.asignarModelo(slot, { type: 'none', name: 'Vacío', animated: false });
    },

    mostrarModelo: function (slot, visible) {
        this.slotVisible(slot, visible);
    },

    crearPanelStats: function (stats) {
        const container = document.createElement('a-entity');

        const bg = document.createElement('a-plane');
        bg.setAttribute('width', '1.8');
        bg.setAttribute('height', '0.6');
        bg.setAttribute('color', '#111');
        bg.setAttribute('opacity', '0.85');
        bg.setAttribute('position', '0 0 0');
        container.appendChild(bg);

        const nameText = document.createElement('a-text');
        nameText.setAttribute('value', String(stats.name || 'Entidad').slice(0, 22));
        nameText.setAttribute('align', 'center');
        nameText.setAttribute('color', '#ffd700');
        nameText.setAttribute('position', '0 0.2 0.02');
        nameText.setAttribute('scale', '0.5 0.5 0.5');
        container.appendChild(nameText);

        const barBg = document.createElement('a-plane');
        barBg.setAttribute('width', '1.6');
        barBg.setAttribute('height', '0.14');
        barBg.setAttribute('color', '#333');
        barBg.setAttribute('position', '0 0 0.02');
        container.appendChild(barBg);

        const pct = Math.max(0, Math.min(1, (stats.hp || 0) / (stats.hpMax || 1)));
        const barFill = document.createElement('a-plane');
        barFill.setAttribute('width', String(1.6 * pct));
        barFill.setAttribute('height', '0.12');
        barFill.setAttribute('color', pct > 0.5 ? '#4CAF50' : (pct > 0.25 ? '#FFC107' : '#e94560'));
        barFill.setAttribute('position', ((1.6 * pct - 1.6) / 2) + ' 0 0.03');
        container.appendChild(barFill);

        const hpText = document.createElement('a-text');
        hpText.setAttribute('value',
            'HP ' + (stats.hp || 0) + '/' + (stats.hpMax || 0) +
            '  ATK ' + (stats.atk || 0) +
            '  DEF ' + (stats.def || 0) +
            '  Nv ' + (stats.nivel || 1));
        hpText.setAttribute('align', 'center');
        hpText.setAttribute('color', '#fff');
        hpText.setAttribute('position', '0 -0.15 0.02');
        hpText.setAttribute('scale', '0.4 0.4 0.4');
        container.appendChild(hpText);

        return container;
    },

    asignarStats: function (slot, stats) {
        const marker = this.markerElPorSlot(slot);
        if (!marker) return false;
        const statsSlot = marker.querySelector('.stats-slot');
        if (!statsSlot) return false;
        while (statsSlot.firstChild) statsSlot.removeChild(statsSlot.firstChild);
        const panel = this.crearPanelStats(stats);
        statsSlot.appendChild(panel);
        // La visibilidad ya se controla por slotVisible en markerFound/Lost
        this.statsAsignadas[slot] = stats;
        return true;
    },

    limpiarStats: function (slot) {
        const marker = this.markerElPorSlot(slot);
        if (!marker) return;
        const statsSlot = marker.querySelector('.stats-slot');
        if (!statsSlot) return;
        while (statsSlot.firstChild) statsSlot.removeChild(statsSlot.firstChild);
        delete this.statsAsignadas[slot];
    },

    iniciarFPS: function () {
        let frames = 0;
        let ultimoTiempo = performance.now();
        const bucle = () => {
            frames++;
            const ahora = performance.now();
            if (ahora >= ultimoTiempo + 1000) {
                if (this.UI.fps) this.UI.fps.innerText = frames;
                frames = 0;
                ultimoTiempo = ahora;
            }
            requestAnimationFrame(bucle);
        };
        bucle();
    }
};

window.addEventListener('load', () => {
    Utilidades.iniciarFPS();

    // Asignar modelos a los slots (no se hacen visibles hasta que el marcador sea detectado)
    Utilidades.asignarModelo('hiro', { type: 'gltf', url: '#modelo-dragon-glb', name: 'Dragón', scale: '0.1 0.1 0.1', animated: true });
    Utilidades.asignarModelo('kanji', { type: 'fbx', url: 'modelos/dragon.fbx', name: 'Dragón FBX', scale: '0.1 0.1 0.1', animated: true });
    Utilidades.asignarModelo('0', { type: 'gltf', url: '#modelo-mago-glb', name: 'Mago', scale: '0.5 0.5 0.5', rotation: '-90 0 0', animated: true });
    Utilidades.asignarModelo('1', { type: 'fbx', url: 'modelos/mago.fbx', name: 'Mago FBX', scale: '0.01 0.01 0.01', rotation: '-90 0 0', animated: true });
    Utilidades.asignarModelo('2', { type: 'gltf', url: '#modelo-model-glb', name: 'Modelo', scale: '2 2 2', rotation: '-90 0 0', animated: true });
    Utilidades.asignarModelo('3', { type: 'gif', url: 'modelos/fuego.gif', name: 'Fuego', rotation: '-90 0 0' });
    Utilidades.asignarModelo('4', { type: 'image', url: '#imgDragon', name: 'Imagen', rotation: '-90 0 0' });
    Utilidades.asignarModelo('5', { type: 'video', url: '#videoEjemplo', name: 'Video 1', rotation: '-90 0 0' });
    Utilidades.asignarModelo('6', { type: 'video', url: '#videoEjemplo2', name: 'Video 2', rotation: '-90 0 0' });
    Utilidades.asignarModelo('7', { type: 'video', url: '#Tablero', name: 'Tablero', rotation: '-90 0 0' });
    Utilidades.asignarModelo('8', { type: 'trees', name: 'Árboles' });
    Utilidades.asignarModelo('9', { type: 'gltf', url: '#modelo-naturaleza-glb', name: 'Naturaleza', scale: '2 2 2', rotation: '-90 5 0', animated: true });
    Utilidades.asignarModelo('10', { type: 'gltf', url: 'modelos/esqueleto_animado.glb', name: 'Esqueleto', scale: '1 1 1', rotation: '-60 0 0', animated: true });
    Utilidades.asignarModelo('11', { type: 'gltf', url: 'modelos/evil.glb', name: 'Evil', scale: '100 100 100', rotation: '-60 0 0', animated: true });

    // Asegurar que todos los slots estén ocultos al inicio
    Utilidades.ocultarTodosSlots();

    if (window.Comunicacion) {
        Comunicacion.enviarAlPadre({ action: 'ar-frame-ready' });
    }
});
