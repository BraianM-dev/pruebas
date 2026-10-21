window.CalabozosStateBridge = (function () {
    const config = {
        appsScriptUrl: "",
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
        ]
    };
    function configurar(op) { Object.assign(config, op); }

    function url(p) {
        if (!config.appsScriptUrl) throw new Error("appsScriptUrl no configurada");
        const qs = Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== "")
            .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
        return config.appsScriptUrl + "?" + qs;
    }
    async function getJSON(p) {
        const r = await fetch(url(p), { cache: "no-store" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
    }
    async function postJSON(p, b) {
        const r = await fetch(url(p), {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(b || {})
        });
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
    }
    async function postCheckAuth(p, b) {
        const r = await postJSON(p, b);
        if (r.error === "auth") { const e = new Error("host_revoked"); e.code = "host_revoked"; throw e; }
        return r;
    }

    const api = {
        ping:                  ()                              => getJSON({ accion: "ping", _: Date.now() }),
        whoami:                ()                              => getJSON({ accion: "whoami", _: Date.now() }),
        enterClass:            (codigo)                        => postJSON({ accion: "enterClass" }, { codigo }),
        adminLogin:            (pin)                           => postJSON({ accion: "adminLogin" }, { pin }),
        unirseSala:            (sala, nombre, jid, gateToken)  => getJSON({ accion: "unirse", sala, nombre, jugadorId: jid || "", gateToken: gateToken || "", _: Date.now() }),
        crearSala:             (sala, adminToken)              => postJSON({ accion: "crear", sala }, { adminToken }),
        sync:                  (sala, tok, rev, seq)           => postJSON({ accion: "sync", sala }, { sessionToken: tok, rev, seq }),
        syncHost:              (sala, hostToken, rev, seq)     => postJSON({ accion: "sync", sala }, { hostToken, rev, seq }),
        syncDocente:           (sala, adminToken)              => postJSON({ accion: "syncDocente", sala }, { adminToken }),
        listarJugadores:       (sala, hostToken)               => postJSON({ accion: "listarJugadores", sala }, { hostToken }),
        publicarEstado:        (sala, hostToken, snapshot)     => postCheckAuth({ accion: "publicar", sala }, { hostToken, snapshot }),
        enviarMensaje:         (sala, tok, m)                  => postJSON({ accion: "enviar", sala }, Object.assign({ sessionToken: tok }, m)),
        cerrarSala:            (sala, hostToken)               => postJSON({ accion: "cerrar", sala }, { hostToken }),
        sigpost:               (sala, payload)                 => postJSON({ accion: "sigpost", sala }, payload),
        sigpoll:               (sala, payload)                 => postCheckAuth({ accion: "sigpoll", sala }, payload),
        sigack:                (sala, payload)                 => postJSON({ accion: "sigack", sala }, payload),
        genTraspaso:           (sala, hostToken)               => postJSON({ accion: "genTraspaso", sala }, { hostToken }),
        canjeTraspaso:         (sala, tok, codigo)             => postJSON({ accion: "canjeTraspaso", sala }, { sessionToken: tok, codigo }),
        solicitarRecuperacion: (sala, adminToken)              => postJSON({ accion: "solicitarRecuperacion", sala }, { adminToken }),
        confirmarRecuperacion: (sala, ticket, adminToken)      => postJSON({ accion: "confirmarRecuperacion", sala }, { ticket, adminToken }),
        kickPeer:              (sala, hostToken, peerId)       => postJSON({ accion: "kick", sala }, { hostToken, peerId }),
        kickJugador:           (sala, hostToken, jugadorId)    => postJSON({ accion: "kickJugador", sala }, { hostToken, jugadorId })
    };

    let pollingId = null, ultRev = 0, ultSeq = 0, intBase = 2000, errConsec = 0;
    function iniciarPolling(sala, sessionToken, op) {
        detenerPolling();
        ultRev = 0; ultSeq = 0; intBase = 2000; errConsec = 0;
        let tokenActual = sessionToken;
        const onEstado   = op.onEstado   || (() => {});
        const onMensajes = op.onMensajes || (() => {});
        const onError    = op.onError    || (() => {});
        const onRejoin   = op.onRejoin   || (() => {});
        const nombre     = op.nombre     || "Alumno";
        const jugadorId  = op.jugadorId  || "";
        const gateToken  = op.gateToken  || "";
        async function tick() {
            try {
                const r = await api.sync(sala, tokenActual, ultRev, ultSeq);
                if (r.ok) {
                    errConsec = 0; intBase = Math.max(2000, intBase - 200);
                    if (r.estado && r.revision !== ultRev) { ultRev = r.revision; onEstado(r.estado); }
                    if (r.mensajes && r.mensajes.length) { ultSeq = r.ultimoSeq; onMensajes(r.mensajes); }
                } else if (r.error === "auth") {
                    try {
                        const re = await api.unirseSala(sala, nombre, jugadorId, gateToken);
                        if (re.ok) { tokenActual = re.sessionToken; onRejoin(re); intBase = 2000; }
                        else {
                            const e = new Error(re.error); e.code = re.error; onError(e);
                            if (re.error === "baneado" || re.error === "codigo_clase_requerido") return;
                        }
                    } catch (e) {
                        const err = new Error("rejoin:" + e.message); err.code = e.code || "rejoin_failed"; onError(err);
                    }
                } else if (r.error === "baneado") {
                    const e = new Error("baneado"); e.code = "baneado"; onError(e); return;
                } else { errConsec++; onError(new Error(r.error)); }
            } catch (e) { errConsec++; onError(e); }
            pollingId = setTimeout(tick, Math.min(6000, intBase + errConsec * 800));
        }
        tick();
    }
    function detenerPolling() { if (pollingId) { clearTimeout(pollingId); pollingId = null; } }

    function esperarICE(pc, timeoutMs) {
        return new Promise(resolve => {
            if (pc.iceGatheringState === "complete") return resolve();
            const t = setTimeout(resolve, timeoutMs || 6000);
            pc.addEventListener("icegatheringstatechange", () => {
                if (pc.iceGatheringState === "complete") { clearTimeout(t); resolve(); }
            });
            pc.addEventListener("icecandidate", ev => { if (!ev.candidate) { clearTimeout(t); resolve(); } });
        });
    }

    class P2PHost {
        constructor(sala, hostToken, cb) {
            this.sala = sala; this.token = hostToken; this.peers = new Map();
            this.pollId = null; this.cb = cb || {}; this.activo = true;
            this._procesandoPoll = false;
        }
        start() { if (config.appsScriptUrl) this.pollId = setInterval(() => this._poll(), 2000); }
        stop() {
            this.activo = false;
            if (this.pollId) { clearInterval(this.pollId); this.pollId = null; }
            this.peers.forEach(({ pc }) => { try { pc.close(); } catch (_) {} });
            this.peers.clear();
        }
        cerrarPeer(peerId) {
            const e = this.peers.get(peerId);
            if (!e) return false;
            try { if (e.channel) e.channel.close(); } catch (_) {}
            try { e.pc.close(); } catch (_) {}
            this.peers.delete(peerId);
            this.cb.onPeerDisconnected && this.cb.onPeerDisconnected(peerId);
            return true;
        }
        async _poll() {
            if (!this.activo || this._procesandoPoll) return;
            this._procesandoPoll = true;
            try {
                const r = await api.sigpoll(this.sala, { hostToken: this.token });
                if (!r || !r.ok || !r.mensajes) return;
                const ids = [];
                for (const msg of r.mensajes) {
                    if (msg.type === "hello")  await this._onHello(msg);
                    else if (msg.type === "answer") await this._onAnswer(msg);
                    if (msg._id) ids.push(msg._id);
                }
                if (ids.length) await api.sigack(this.sala, { hostToken: this.token, ids }).catch(() => {});
            } catch (e) {
                if (e.code === "host_revoked") {
                    this.activo = false;
                    if (this.pollId) { clearInterval(this.pollId); this.pollId = null; }
                    this.cb.onHostRevoked && this.cb.onHostRevoked();
                }
            } finally { this._procesandoPoll = false; }
        }
        async _onHello(msg) {
            const peerId = msg.from;
            if (!peerId || peerId === "HOST") return;
            if (!this.activo) return;
            const existente = this.peers.get(peerId);
            if (existente) {
                if (existente.channel && existente.channel.readyState === "open") return;
                if (existente.negociando) return;
                this.cerrarPeer(peerId);
            }
            const pc = new RTCPeerConnection({ iceServers: config.iceServers });
            const entry = { pc, channel: null, peerId, name: msg.name || peerId, jugadorId: msg.jugadorId || null, negociando: true };
            this.peers.set(peerId, entry);
            let disconnTimer = null;
            try {
                pc.onconnectionstatechange = () => {
                    const s = pc.connectionState;
                    if (s === "connected") {
                        if (disconnTimer) { clearTimeout(disconnTimer); disconnTimer = null; }
                    } else if (s === "disconnected" || s === "failed") {
                        if (!disconnTimer) {
                            disconnTimer = setTimeout(() => {
                                if (this.peers.get(peerId) === entry) this.cerrarPeer(peerId);
                                disconnTimer = null;
                            }, 15000);
                        }
                    } else if (s === "closed") {
                        if (disconnTimer) { clearTimeout(disconnTimer); disconnTimer = null; }
                        if (this.peers.get(peerId) === entry) this.cerrarPeer(peerId);
                    }
                };
                const ch = pc.createDataChannel("juego", { ordered: true });
                this._setupChannel(entry, ch);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await esperarICE(pc, 6000);
                if (!this.activo) { this.cerrarPeer(peerId); return; }
                await api.sigpost(this.sala, { hostToken: this.token, to: peerId,
                    msg: { type: "offer", sdp: pc.localDescription } });
            } catch (e) {
                if (this.peers.get(peerId) === entry) {
                    this.peers.delete(peerId);
                    try { pc.close(); } catch (_) {}
                    this.cb.onPeerDisconnected && this.cb.onPeerDisconnected(peerId);
                }
                if (e.code === "host_revoked") this.cb.onHostRevoked && this.cb.onHostRevoked();
            }
        }
        async _onAnswer(msg) {
            const entry = this.peers.get(msg.from);
            if (!entry || !msg.sdp) return;
            if (entry.pc.remoteDescription) return;
            try { await entry.pc.setRemoteDescription(msg.sdp); } catch (_) {}
        }
        _setupChannel(entry, ch) {
            entry.channel = ch;
            ch.onopen = () => { entry.negociando = false; this.cb.onPeerConnected && this.cb.onPeerConnected(entry.peerId, entry.name, entry.jugadorId); };
            ch.onmessage = ev => { try { this.cb.onPeerMessage && this.cb.onPeerMessage(entry.peerId, JSON.parse(ev.data)); } catch (_) {} };
            ch.onclose = () => { if (this.peers.get(entry.peerId) === entry) this.cerrarPeer(entry.peerId); };
        }
        broadcast(m) {
            const d = JSON.stringify(m); let n = 0;
            this.peers.forEach(({ channel }) => { if (channel && channel.readyState === "open") { try { channel.send(d); n++; } catch (_) {} } });
            return n;
        }
        enviarA(pid, m) {
            const e = this.peers.get(pid);
            if (!e || !e.channel || e.channel.readyState !== "open") return false;
            try { e.channel.send(JSON.stringify(m)); return true; } catch (_) { return false; }
        }
        peersConectados() {
            return Array.from(this.peers.entries()).filter(([, e]) => e.channel && e.channel.readyState === "open")
                .map(([id, e]) => ({ id, name: e.name, jugadorId: e.jugadorId }));
        }
    }

    class P2PPeer {
        constructor(sala, sessionToken, peerId, nombre, jugadorId, cb) {
            this.sala = sala; this.token = sessionToken; this.peerId = peerId || null;
            this.nombre = nombre || "Alumno"; this.jugadorId = jugadorId || null;
            this.pc = null; this.channel = null;
            this.pollId = null; this.retryId = null;
            this._timeout = null; this._reconexId = null;
            this.connected = false; this.cb = cb || {};
            this._resolver = null; this._rechazar = null;
            this._desconectado = false; this._intentos = 0;
            this._maxIntentos = 3;
            this._procesandoPoll = false;
            this._negociando = false;
            this._generacion = 0;
        }
        _limpiarTimers() {
            if (this.pollId) { clearInterval(this.pollId); this.pollId = null; }
            if (this.retryId) { clearInterval(this.retryId); this.retryId = null; }
            if (this._timeout) { clearTimeout(this._timeout); this._timeout = null; }
            if (this._reconexId) { clearTimeout(this._reconexId); this._reconexId = null; }
        }
        _cerrarPC() {
            if (this.channel) { try { this.channel.close(); } catch (_) {} this.channel = null; }
            if (this.pc) { try { this.pc.close(); } catch (_) {} this.pc = null; }
            this.connected = false; this._negociando = false;
        }
        _limpiar() { this._limpiarTimers(); this._cerrarPC(); }
        async _enviarHello() {
            try {
                await api.sigpost(this.sala, { sessionToken: this.token, to: "HOST",
                    msg: { type: "hello", name: this.nombre, jugadorId: this.jugadorId } });
            } catch (_) {}
        }
        conectar() {
            return new Promise((resolve, reject) => {
                this._resolver = resolve; this._rechazar = reject;
                this._intentos = 0;
                this._intentarConectar(0);
            });
        }
        async _intentarConectar(delayMs) {
            if (this._desconectado) return;
            if (delayMs) await new Promise(r => setTimeout(r, delayMs));
            if (this._desconectado) return;
            this._intentos++; this._generacion++;
            this._cerrarPC();
            await this._enviarHello();
            this.pollId = setInterval(() => this._poll(), 1200);
            this.retryId = setInterval(() => { if (!this.connected && !this._desconectado) this._enviarHello(); }, 5000);
            this._timeout = setTimeout(() => { if (!this.connected && !this._desconectado) this._fallarIntento(); }, 15000);
        }
        _fallarIntento() {
            this._limpiarTimers(); this._cerrarPC();
            if (this._desconectado) return;
            if (this._intentos < this._maxIntentos) {
                const delay = 2000 * Math.pow(2, this._intentos - 1);
                this._reconexId = setTimeout(() => { this._reconexId = null; this._intentarConectar(0); }, delay);
            } else {
                this._desconectado = true;
                if (this._rechazar) { const r = this._rechazar; this._rechazar = null; r(new Error("P2P no disponible")); }
                this.cb.onDisconnected && this.cb.onDisconnected();
            }
        }
        _reconectarUnaVez() {
            if (this._desconectado || this._reconexId) return;
            this._cerrarPC(); this._limpiarTimers(); this._intentos = 0;
            this._reconexId = setTimeout(() => { this._reconexId = null; this._intentarConectar(0); }, 2000);
        }
        async _poll() {
            if (this.connected || this._desconectado || this._procesandoPoll) return;
            this._procesandoPoll = true;
            try {
                const r = await api.sigpoll(this.sala, { sessionToken: this.token });
                if (!r || !r.ok || !r.mensajes) return;
                const ids = [];
                for (const msg of r.mensajes) {
                    if (msg.type === "offer") await this._onOffer(msg);
                    if (msg._id) ids.push(msg._id);
                }
                if (ids.length) await api.sigack(this.sala, { sessionToken: this.token, ids }).catch(() => {});
            } catch (_) {}
            finally { this._procesandoPoll = false; }
        }
        async _onOffer(msg) {
            if (this._desconectado || this.connected || this._negociando) return;
            if (this.pc) {
                const s = this.pc.connectionState;
                if (s === "new" || s === "connecting" || s === "connected") return;
                this._cerrarPC();
            }
            this._negociando = true;
            const gen = this._generacion;
            try {
                const pc = new RTCPeerConnection({ iceServers: config.iceServers });
                this.pc = pc;
                let disconnTimer = null;
                pc.ondatachannel = ev => {
                    if (this._generacion !== gen || this.pc !== pc) return;
                    this.channel = ev.channel;
                    this._setupChannel(pc, ev.channel, gen);
                };
                pc.onconnectionstatechange = () => {
                    if (this._generacion !== gen || this.pc !== pc) return;
                    const s = pc.connectionState;
                    if (s === "connected") {
                        if (disconnTimer) { clearTimeout(disconnTimer); disconnTimer = null; }
                    } else if (s === "disconnected" || s === "failed") {
                        if (!disconnTimer) {
                            disconnTimer = setTimeout(() => {
                                if (this.connected) {
                                    this.connected = false;
                                    this.cb.onDisconnected && this.cb.onDisconnected();
                                    this._reconectarUnaVez();
                                }
                                disconnTimer = null;
                            }, 15000);
                        }
                    } else if (s === "closed") {
                        if (disconnTimer) { clearTimeout(disconnTimer); disconnTimer = null; }
                        if (this.connected) {
                            this.connected = false;
                            this.cb.onDisconnected && this.cb.onDisconnected();
                            this._reconectarUnaVez();
                        }
                    }
                };
                await pc.setRemoteDescription(msg.sdp);
                const ans = await pc.createAnswer();
                await pc.setLocalDescription(ans);
                await esperarICE(pc, 6000);
                await api.sigpost(this.sala, { sessionToken: this.token, to: "HOST",
                    msg: { type: "answer", sdp: pc.localDescription } });
            } catch (e) {
                this._negociando = false; this._cerrarPC(); this._fallarIntento();
            }
        }
        _setupChannel(pc, channel, gen) {
            channel.onopen = () => {
                if (this._generacion !== gen || this.pc !== pc) return;
                this._limpiarTimers();
                this.connected = true; this._negociando = false; this._intentos = 0;
                this.cb.onConnected && this.cb.onConnected();
                if (this._resolver) { const r = this._resolver; this._resolver = null; r(this); }
            };
            channel.onmessage = ev => { try { this.cb.onMessage && this.cb.onMessage(JSON.parse(ev.data)); } catch (_) {} };
            channel.onclose = () => {
                if (this._generacion !== gen || this.pc !== pc) return;
                if (this.connected) {
                    this.connected = false;
                    this.cb.onDisconnected && this.cb.onDisconnected();
                    this._reconectarUnaVez();
                }
            };
        }
        enviar(m) {
            if (!this.channel || this.channel.readyState !== "open") return false;
            try { this.channel.send(JSON.stringify(m)); return true; } catch (_) { return false; }
        }
        desconectar() { this._desconectado = true; this._limpiar(); }
    }

    return Object.assign({}, api, {
        configurar, iniciarPolling, detenerPolling, P2PHost, P2PPeer
    });
})();
