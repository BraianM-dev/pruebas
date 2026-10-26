// js/utilidades.js
// Herramientas de UI, gestión de modelos y paneles de stats en AR

// ============================================================
// COMUNICACIÓN CON EL PADRE (DM)
// ============================================================
window.Comunicacion = {
    enviarAlPadre: function (msg) {
        try {
            window.parent.postMessage(Object.assign({ source: 'ar-frame' }, msg), '*');
        } catch (e) {
            console.warn('[AR] postMessage error:', e);
        }
    }
};

const Utilidades = {

    UI: {
        marcador: document.getElementById('marcador-id'),
        modelo: document.getElementById('modelo-id'),
        estado: document.getElementById('estado-id'),
        fps: document.getElementById('fps-id'),
        panel: document.getElementById('panel-info')
    },

    modelosAsignados: {},
    statsAsignadas: {},

    nombresPorDefecto: {
        'hiro': 'Dragón',
        'kanji': 'Dragón FBX',
        '0': 'Mago',
        '1': 'Mago FBX',
        '2': 'Modelo',
        '3': 'Fuego',
        '4': 'Imagen',
        '5': 'Video 1',
        '6': 'Video 2',
        '7': 'Tablero',
        '8': 'Árboles',
        '9': 'Naturaleza',
        '10': 'Esqueleto',
        '11': 'Evil'
    },

    togglePanel: function (visible) {
        if (!this.UI.panel) return;
        let mostrar;
        if (visible === undefined) {
            mostrar = this.UI.panel.classList.contains('hidden');
        } else {
            mostrar = !!visible;
        }
        this.UI.panel.classList.toggle('hidden', !mostrar);
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
        if (markerId === 'Hiro') return 'hiro';
        if (markerId === 'Kanji') return 'kanji';
        const m = markerId.match(/^Barcode_(\d+)$/);
        return m ? m[1] : null;
    },

    markerElPorSlot: function (slot) {
        const s = String(slot);
        if (s === 'hiro') return document.getElementById('Hiro');
        if (s === 'kanji') return document.getElementById('Kanji');
        return document.getElementById('Barcode_' + s);
    },

    infoMarcador: function (markerId) {
        const slot = this.slotFromMarkerId(markerId);
        if (slot === null) return null;
        if (this.modelosAsignados[slot]) return this.modelosAsignados[slot];
        return { name: this.nombresPorDefecto[slot] || 'Modelo', type: 'default' };
    },

    crearPanelStats: function (stats) {
        const c = document.createElement('a-entity');

        const bg = document.createElement('a-plane');
        bg.setAttribute('width', '1.8');
        bg.setAttribute('height', '0.6');
        bg.setAttribute('color', '#111');
        bg.setAttribute('opacity', '0.85');
        c.appendChild(bg);

        const n = document.createElement('a-text');
        n.setAttribute('value', String(stats.name || 'Entidad').slice(0, 22));
        n.setAttribute('align', 'center');
        n.setAttribute('color', '#ffd700');
        n.setAttribute('position', '0 0.2 0.02');
        n.setAttribute('scale', '0.5 0.5 0.5');
        c.appendChild(n);

        const pct = Math.max(0, Math.min(1, (stats.hp || 0) / (stats.hpMax || 1)));

        const barBg = document.createElement('a-plane');
        barBg.setAttribute('width', '1.6');
        barBg.setAttribute('height', '0.14');
        barBg.setAttribute('color', '#333');
        c.appendChild(barBg);

        const barFill = document.createElement('a-plane');
        barFill.setAttribute('width', String(Math.max(0.001, 1.6 * pct)));
        barFill.setAttribute('height', '0.12');
        barFill.setAttribute('color', pct > 0.5 ? '#4CAF50' : (pct > 0.25 ? '#FFC107' : '#e94560'));
        barFill.setAttribute('position', ((1.6 * pct - 1.6) / 2) + ' 0 0.03');
        c.appendChild(barFill);

        const h = document.createElement('a-text');
        h.setAttribute('value',
            'HP ' + (stats.hp || 0) + '/' + (stats.hpMax || 0) +
            ' ATK ' + (stats.atk || 0) +
            ' DEF ' + (stats.def || 0) +
            ' Nv ' + (stats.nivel || 1));
        h.setAttribute('align', 'center');
        h.setAttribute('color', '#fff');
        h.setAttribute('position', '0 -0.15 0.02');
        h.setAttribute('scale', '0.4 0.4 0.4');
        c.appendChild(h);

        return c;
    },

    asignarStats: function (slot, stats) {
        const marker = this.markerElPorSlot(slot);
        if (!marker) { console.warn('[AR] Marcador no encontrado para stats:', slot); return false; }
        let statsSlot = marker.querySelector('.stats-slot');
        if (!statsSlot) {
            statsSlot = document.createElement('a-entity');
            statsSlot.className = 'stats-slot';
            statsSlot.setAttribute('position', '0 1.5 0');
            statsSlot.setAttribute('look-at', '[camera]');
            marker.appendChild(statsSlot);
        }
        while (statsSlot.firstChild) statsSlot.removeChild(statsSlot.firstChild);
        statsSlot.appendChild(this.crearPanelStats(stats));
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

    asignarModelo: function (slot, config) {
        const marker = this.markerElPorSlot(slot);
        if (!marker) { console.warn('[AR] Marcador no encontrado para modelo:', slot); return false; }
        const modelEntity = marker.querySelector('.model-entity');
        if (!modelEntity) { console.warn('[AR] No hay .model-entity en', slot); return false; }

        while (modelEntity.firstChild) modelEntity.removeChild(modelEntity.firstChild);
        modelEntity.removeAttribute('gltf-model');
        modelEntity.removeAttribute('fbx-model');
        modelEntity.removeAttribute('geometry');
        modelEntity.removeAttribute('material');
        modelEntity.removeAttribute('animation-mixer');
        modelEntity.removeAttribute('animation');

        switch (config.type) {
            case 'gltf':
                modelEntity.setAttribute('gltf-model', config.url);
                if (config.animated) modelEntity.setAttribute('animation-mixer', '');
                break;
            case 'fbx':
                modelEntity.setAttribute('fbx-model', 'src: url(' + config.url + ')');
                if (config.animated) modelEntity.setAttribute('animation-mixer', 'clip: *; loop: repeat');
                break;
            case 'image':
                modelEntity.setAttribute('geometry', 'primitive: plane; width: 1.5; height: 1.5');
                modelEntity.setAttribute('material', 'src: ' + config.url + '; transparent: true; alphaTest: 0.5');
                break;
            case 'video':
                modelEntity.setAttribute('geometry', 'primitive: plane; width: 2; height: 1.2');
                modelEntity.setAttribute('material', 'src: ' + config.url);
                break;
            case 'gif':
                modelEntity.setAttribute('geometry', 'primitive: plane; width: 1; height: 1');
                modelEntity.setAttribute('material', 'shader: gif; src: ' + config.url);
                break;
            case 'none':
            default:
                modelEntity.setAttribute('geometry', 'primitive: box; width: 0.3; height: 0.3; depth: 0.3');
                modelEntity.setAttribute('material', 'color: #888; opacity: 0.4');
        }

        modelEntity.setAttribute('position', config.position || '0 0 0');
        modelEntity.setAttribute('rotation', config.rotation || '0 0 0');
        modelEntity.setAttribute('scale', config.scale || '1 1 1');

        this.modelosAsignados[slot] = config;
        return true;
    },

    mostrarModelo: function (slot, visible) {
        const marker = this.markerElPorSlot(slot);
        if (!marker) return;
        const m = marker.querySelector('.model-entity');
        if (!m) return;
        m.setAttribute('visible', visible ? 'true' : 'false');
    },

    limpiarModelo: function (slot) {
        return this.asignarModelo(slot, { type: 'none', name: 'Vacío' });
    },

    iniciarFPS: function () {
        let frames = 0;
        let ultimo = performance.now();
        const loop = () => {
            frames++;
            const ahora = performance.now();
            if (ahora >= ultimo + 1000) {
                if (this.UI.fps) this.UI.fps.innerText = frames;
                frames = 0;
                ultimo = ahora;
            }
            requestAnimationFrame(loop);
        };
        loop();
    }
};

window.Utilidades = Utilidades;
