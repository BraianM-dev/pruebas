// js/conexion.js
// Toda la comunicación de red vive acá, separada del resto.

const Conexion = {
    socket: null,

    // wss si la página es https (GitHub Pages), ws si estás probando en local
    urlGateway: (location.protocol === "https:" ? "wss://" : "ws://") + "TU_IP_O_DOMINIO:8000/ws",

    conectarWS: function () {
        this.socket = new WebSocket(this.urlGateway);

        this.socket.onopen = () => console.log("Conectado al gateway");

        this.socket.onmessage = (evento) => {
            const mensaje = JSON.parse(evento.data);
            // Ejemplo esperado: {accion:"mostrar", marcador:"Barcode_0", modelo:"#modelo-mago-glb"}
            //                    {accion:"ocultar", marcador:"Barcode_0"}
            Conexion.aplicarComando(mensaje);
        };

        this.socket.onclose = () => {
            console.log("Desconectado, reintentando en 3s...");
            setTimeout(() => this.conectarWS(), 3000);
        };
    },

    aplicarComando: function (msg) {
        const entidad = document.getElementById("objeto-" + msg.marcador);
        if (!entidad) return;

        if (msg.accion === "mostrar") {
            if (msg.modelo) entidad.setAttribute("gltf-model", msg.modelo);
            entidad.setAttribute("visible", "true");
        }
        if (msg.accion === "ocultar") {
            entidad.setAttribute("visible", "false");
        }
    },

    // Lo llama eventos.js cuando la cámara ve o pierde un marcador
    enviarEvento: function (tipo, marcadorId) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ tipo: tipo, marcador: marcadorId }));
        }
    },

    // SSE: narración del Dungeon Master en vivo
    conectarSSE: function () {
        const fuente = new EventSource(
            (location.protocol === "https:" ? "https://" : "http://") + "TU_IP_O_DOMINIO:8000/historia"
        );
        const panel = document.getElementById("panel-historia");

        fuente.onmessage = (evento) => {
            panel.innerText += evento.data;
            panel.scrollTop = panel.scrollHeight;
        };
    }
};

window.addEventListener("load", () => {
    Conexion.conectarWS();
    Conexion.conectarSSE();
});
