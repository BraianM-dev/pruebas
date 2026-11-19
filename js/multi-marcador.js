// js/multi-marcador.js
// ------------------------------------------------------------------
// VARIAS COPIAS DEL MISMO MARCADOR A LA VEZ
//
// <a-marker value="8"> muestra UN solo objeto: si la cámara ve dos
// códigos 8, AR.js elige uno y descarta el otro.
// Pero AR.js sí detecta TODAS las copias (lanza un evento "getMarker"
// por cada una). Este componente escucha esos eventos y pone un hijo
// distinto sobre cada copia:
//
//   1 copia en cámara  -> hijo 1 (árbol A)
//   2 copias en cámara -> hijo 1 y hijo 2 (árbol A y árbol B)
//   ... hasta tantos hijos como pongas dentro.
//
// Cada copia guarda su árbol mientras se la siga viendo (no se
// mezclan si las movés). Si sacás una, su árbol queda libre para la
// próxima que aparezca.
//
// Uso (directo dentro de <a-scene>, SIN position/rotation propios):
//   <a-entity id="Barcode_8" multi-marcador="valor: 8" registerevents>
//       <a-entity> ...árbol A... </a-entity>
//       <a-entity> ...árbol B... </a-entity>
//   </a-entity>
// ------------------------------------------------------------------

AFRAME.registerComponent('multi-marcador', {
    schema: {
        valor:      { type: 'int',    default: 8 },    // número del código barcode
        confianza:  { type: 'number', default: 0.6 },  // igual que AR.js (minConfidence)
        perderTras: { type: 'number', default: 300 },  // ms sin verlo antes de ocultar su objeto
        distancia:  { type: 'number', default: 1.5 },  // cuánto puede moverse entre cuadros (en anchos de marcador)
        suavizado:  { type: 'number', default: 0.5 }   // 0 = sin suavizar, 0.9 = muy suave (más lento)
    },

    init: function () {
        // Cada hijo es un "objeto" que se puede mostrar sobre una copia
        this.objetos = Array.from(this.el.children);
        this.objetos.forEach(function (o) { o.object3D.visible = false; });

        this.seguidos = [];   // copias vistas: { objeto, pos, quat, visto }
        this.cuadro = [];     // detecciones que llegaron desde el último tick
        this.ctrl = null;
        this.habiaAlguno = false;

        this.rotX = new THREE.Matrix4().makeRotationX(Math.PI / 2);
        this.alDetectar = this.alDetectar.bind(this);
    },

    // El controlador de AR.js se crea tarde (async): lo buscamos en cada tick hasta tenerlo
    conectar: function () {
        const sys = this.el.sceneEl.systems.arjs;
        const ctx = sys && sys._arSession && sys._arSession.arContext;
        if (!ctx || !ctx.arController) return;
        this.ctx = ctx;
        this.ctrl = ctx.arController;
        this.ctrl.addEventListener('getMarker', this.alDetectar);
    },

    // Se llama una vez por CADA marcador detectado en el cuadro
    alDetectar: function (ev) {
        const d = ev.data;
        if (d.type !== 1) return;                                   // 1 = BARCODE_MARKER
        if (d.marker.idMatrix !== this.data.valor) return;
        if (d.marker.cfMatrix < this.data.confianza) return;

        // Misma cuenta que hace AR.js para ubicar un <a-marker>
        const m = new THREE.Matrix4().copy(this.ctx._artoolkitProjectionAxisTransformMatrix);
        m.multiply(new THREE.Matrix4().fromArray(d.matrix));
        m.multiply(this.rotX);

        const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), esc = new THREE.Vector3();
        m.decompose(pos, quat, esc);
        this.cuadro.push({ pos: pos, quat: quat });
    },

    tick: function () {
        if (!this.ctrl) { this.conectar(); return; }

        const ahora = performance.now();
        const detecciones = this.cuadro;
        this.cuadro = [];

        // 1) Emparejar cada detección con la copia que ya veníamos siguiendo más cerca
        const pares = [];
        this.seguidos.forEach(function (s, i) {
            detecciones.forEach(function (d, j) {
                pares.push({ i: i, j: j, dist: s.pos.distanceTo(d.pos) });
            });
        });
        pares.sort(function (a, b) { return a.dist - b.dist; });

        const seguidoUsado = {}, deteccionUsada = {};
        pares.forEach((p) => {
            if (seguidoUsado[p.i] || deteccionUsada[p.j] || p.dist > this.data.distancia) return;
            seguidoUsado[p.i] = deteccionUsada[p.j] = true;
            const s = this.seguidos[p.i], d = detecciones[p.j];
            const k = 1 - this.data.suavizado;
            s.pos.lerp(d.pos, k);
            s.quat.slerp(d.quat, k);
            s.visto = ahora;
        });

        // 2) Detecciones nuevas: les toca el primer objeto libre (A, después B, ...)
        detecciones.forEach((d, j) => {
            if (deteccionUsada[j]) return;
            const ocupados = this.seguidos.map(function (s) { return s.objeto; });
            const libre = this.objetos.find(function (o) { return ocupados.indexOf(o) === -1; });
            if (!libre) return;   // hay más copias que objetos: la sobrante no muestra nada
            this.seguidos.push({ objeto: libre, pos: d.pos.clone(), quat: d.quat.clone(), visto: ahora });
        });

        // 3) Las que hace rato no se ven, se liberan
        this.seguidos = this.seguidos.filter((s) => {
            if (ahora - s.visto <= this.data.perderTras) return true;
            s.objeto.object3D.visible = false;
            return false;
        });

        // 4) Mover cada objeto arriba de su copia
        this.seguidos.forEach(function (s) {
            const o = s.objeto.object3D;
            o.position.copy(s.pos);
            o.quaternion.copy(s.quat);
            o.visible = true;
        });

        // 5) Avisar como un <a-marker> normal (lo escucha "registerevents" -> DM)
        const hayAlguno = this.seguidos.length > 0;
        if (hayAlguno && !this.habiaAlguno) this.el.emit('markerFound');
        if (!hayAlguno && this.habiaAlguno) this.el.emit('markerLost');
        this.habiaAlguno = hayAlguno;
    },

    remove: function () {
        if (this.ctrl) this.ctrl.removeEventListener('getMarker', this.alDetectar);
    }
});
