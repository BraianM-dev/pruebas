// ============================================================
// Calabozos State Bridge v3 · Salas remotas con polling
// ============================================================
window.CalabozosStateBridge = (function () {
    let config = {
        appsScriptUrl: "https://script.google.com/macros/s/AKfycbxDBHp-_0jRzIiz-Tn12ymAZuWWAzfnSR7SUqz7gVpOEiuvtAKkqg02t60rHNCS7nrp/exec",
        remoteSync: false,
        arFrameId: "ar-game-frame",
        arTargetOrigin: location.origin,
        onRemoteStatus: null
    };
    let callbacksAR = [];
    let pollingId = null;
    let ultimoEventId = null;
    let ultimoMsgId = 0;

    function configurar(opciones) { config = { ...config, ...opciones }; }

    function armarUrl(params) {
        if (!config.appsScriptUrl) throw new Error("appsScriptUrl no configurada");
        const qs = Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join("&");
        return `${config.appsScriptUrl}?${qs}`;
    }

    async function getJSON(params) {
        const r = await fetch(armarUrl(params), { cache: "no-store", redirect: "follow" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        return await r.json();
    }

    async function postJSON(params, body) {
        // text/plain evita preflight CORS contra GAS
        const r = await fetch(armarUrl(params), {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(body || {}),
            redirect: "follow"
        });
        if (!r.ok) throw new Error("HTTP " + r.status);
        try { return await r.json(); } catch (e) { return { ok: true }; }
    }

    // ---- API de salas ----
    async function ping() { return getJSON({ accion: "ping", _: Date.now() }); }
    async function crearSala(codigo) { return getJSON({ accion: "crear", sala: codigo }); }
    async function unirseSala(codigo) { return getJSON({ accion: "unirse", sala: codigo }); }
    async function cerrarSala(codigo) { return getJSON({ accion: "cerrar", sala: codigo }); }
    async function listarSalas() { return getJSON({ accion: "listar" }); }
    async function publicarEstadoSala(codigo, snapshot) {
        return postJSON({ accion: "publicar", sala: codigo }, snapshot);
    }
    async function enviarMensajeSala(codigo, mensaje) {
        return postJSON({ accion: "enviar", sala: codigo }, mensaje);
    }
    async function obtenerEstadoSala(codigo) {
        return getJSON({ accion: "estado", sala: codigo, _: Date.now() });
    }
    async function obtenerMensajesSala(codigo, desde) {
        return getJSON({ accion: "mensajes", sala: codigo, desde: desde || 0, _: Date.now() });
    }

    // ---- Polling unificado ----
    function iniciarPolling(codigo, opciones = {}) {
        detenerPolling();
        ultimoEventId = null;
        ultimoMsgId = Number(opciones.desde) || 0;
        const intervalo = Math.max(1000, Number(opciones.intervalo) || 1600);
        const onEstado = opciones.onEstado || function () {};
        const onMensajes = opciones.onMensajes || function () {};
        const onError = opciones.onError || function () {};

        pollingId = setInterval(async () => {
            try {
                const estado = await obtenerEstadoSala(codigo);
                if (estado && estado.eventId && estado.eventId !== ultimoEventId) {
                    ultimoEventId = estado.eventId;
                    onEstado(estado);
                }
            } catch (e) {
                if (config.onRemoteStatus) config.onRemoteStatus("error", "estado: " + e.message);
                onError(e);
            }
            try {
                const m = await obtenerMensajesSala(codigo, ultimoMsgId);
                if (m && m.ok && Array.isArray(m.mensajes) && m.mensajes.length) {
                    m.mensajes.forEach(msg => { if (msg.id > ultimoMsgId) ultimoMsgId = msg.id; });
                    onMensajes(m.mensajes);
                }
            } catch (e) {
                if (config.onRemoteStatus) config.onRemoteStatus("error", "mensajes: " + e.message);
                onError(e);
            }
        }, intervalo);
    }

    function detenerPolling() {
        if (pollingId) { clearInterval(pollingId); pollingId = null; }
        ultimoEventId = null;
        ultimoMsgId = 0;
    }

    // ---- Compat con la API anterior ----
    function publicar(snapshot, motivo) {
        callbacksAR.forEach(cb => { try { cb(snapshot, motivo); } catch (e) {} });
    }

    function suscribirEventosAR(cb) {
        callbacksAR.push(cb);
        return () => { callbacksAR = callbacksAR.filter(x => x !== cb); };
    }

    return {
        configurar,
        ping, crearSala, unirseSala, cerrarSala, listarSalas,
        publicarEstadoSala, enviarMensajeSala,
        obtenerEstadoSala, obtenerMensajesSala,
        iniciarPolling, detenerPolling,
        publicar, suscribirEventosAR
    };
})();