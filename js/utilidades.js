// js/utilidades.js

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
        return this.modelosAsignados[slot] || null;
    },

    // Crea dinámicamente el contenedor de stats si no existe
    _getOrCreateStatsSlot: function (marker) {
        let statsSlot = marker.querySelector('.stats-slot');
        if (!statsSlot) {
            statsSlot = document.createElement('a-entity');
            statsSlot.className = 'stats-slot';
            statsSlot.setAttribute('position', '0 1.5 0');
            statsSlot.setAttribute('look-at', '[camera]');
            marker.appendChild(statsSlot);
        }
        return statsSlot;
    },

    crearPanelStats: function (stats) {
        const container = document.createElement('a-entity');

        const bg = document.createElement('a-plane');
        bg.setAttribute('width', '1.8');
        bg.setAttribute('height', '0.6');
        bg.setAttribute('color', '#111');
        bg.setAttribute('opacity', '0.85');
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
        barFill.setAttribute('width', String(Math.max(0.001, 1.6 * pct)));
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
        if (!marker) {
            console.warn('[AR] Marcador no encontrado para stats:', slot);
            return false;
        }
        const statsSlot = this._getOrCreateStatsSlot(marker);
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

    // Cambia atributos del .model-entity existente. No crea slots ni toca visible.
    asignarModelo: function (slot, config) {
        const marker = this.markerElPorSlot(slot);
        if (!marker) {
            console.warn('[AR] Marcador no encontrado para modelo:', slot);
            return false;
        }
        const modelEntity = marker.querySelector('.model-entity');
        if (!modelEntity) {
            console.warn('[AR] No existe .model-entity en el marcador', slot);
            return false;
        }

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
        const modelEntity = marker.querySelector('.model-entity');
        if (!modelEntity) return;
        modelEntity.setAttribute('visible', visible ? 'true' : 'false');
    },

    limpiarModelo: function (slot) {
        return this.asignarModelo(slot, { type: 'none', name: 'Vacío' });
    },

    inicializarModelosPorDefecto: function () {
        this.modelosAsignados['hiro'] = { type: 'gltf', url: '#modelo-dragon-glb', name: 'Dragón' };
        this.modelosAsignados['kanji'] = { type: 'fbx', url: 'modelos/dragon.fbx', name: 'Dragón FBX' };
        this.modelosAsignados['0'] = { type: 'gltf', url: '#modelo-mago-glb', name: 'Mago' };
        this.modelosAsignados['1'] = { type: 'fbx', url: 'modelos/mago.fbx', name: 'Mago FBX' };
        this.modelosAsignados['2'] = { type: 'gltf', url: '#modelo-model-glb', name: 'Modelo' };
        this.modelosAsignados['3'] = { type: 'gif', url: 'modelos/fuego.gif', name: 'Fuego' };
        this.modelosAsignados['4'] = { type: 'image', url: '#imgDragon', name: 'Imagen' };
        this.modelosAsignados['5'] = { type: 'video', url: '#videoEjemplo', name: 'Video 1' };
        this.modelosAsignados['6'] = { type: 'video', url: '#videoEjemplo2', name: 'Video 2' };
        this.modelosAsignados['7'] = { type: 'video', url: '#Tablero', name: 'Tablero' };
        this.modelosAsignados['8'] = { type: 'trees', name: 'Árboles' };
        this.modelosAsignados['9'] = { type: 'gltf', url: '#modelo-naturaleza-glb', name: 'Naturaleza' };
        this.modelosAsignados['10'] = { type: 'gltf', url: 'modelos/esqueleto_animado.glb', name: 'Esqueleto' };
        this.modelosAsignados['11'] = { type: 'gltf', url: 'modelos/evil.glb', name: 'Evil' };
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

// Avisar al padre cuando la escena esté lista
function _avisarReady() {
    if (window.Comunicacion) Comunicacion.enviarAlPadre({ action: 'ar-frame-ready' });
}

document.addEventListener('DOMContentLoaded', () => {
    Utilidades.iniciarFPS();
    Utilidades.inicializarModelosPorDefecto();

    if (typeof AFRAME === 'undefined') {
        console.warn('[AR] AFRAME no está cargado — revisar CDN');
        return;
    }

    const scene = document.querySelector('a-scene');
    if (!scene) return;
    if (scene.hasLoaded) {
        setTimeout(_avisarReady, 300);
    } else {
        scene.addEventListener('loaded', () => setTimeout(_avisarReady, 300));
    }
});
