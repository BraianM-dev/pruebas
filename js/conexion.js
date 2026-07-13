// js/conexion.js
const Conexion = {
    socket: null,

    // Apunta a localhost para las pruebas en la misma computadora.
    // Si usas el celular en la misma red WiFi, cambia 'localhost' por tu IP privada (ej. 192.168.1.50)
    urlGateway: (location.protocol === "https:" ? "wss://" : "ws://") + "localhost:8000/ws",

    conectarWS: function () {
        this.socket = new WebSocket(this.urlGateway);

        this.socket.onopen = () => console.log("Conectado al gateway en: " + this.urlGateway);

        this.socket.onmessage = (evento) => {
            const mensaje = JSON.parse(evento.data);
            Conexion.aplicarComando(mensaje);
        };

        this.socket.onclose = () => {
            console.log("Conexión perdida con el gateway. Reintentando en 3s...");
            setTimeout(() => this.conectarWS(), 3000);
        };
    },

    aplicarComando: function (msg) {
        const entidad = document.getElementById("objeto-" + msg.marcador);
        if (!entidad) return;

        if (msg.accion === "mostrar") {
            if (msg.modelo) {
                // Manejo dinámico según el tipo de formato del modelo 3D
                if (msg.tipoModelo === "fbx") {
                    entidad.setAttribute("fbx-model", "src: url(" + msg.modelo + ")");
                } else {
                    entidad.setAttribute("gltf-model", msg.modelo);
                }
            }
            entidad.setAttribute("visible", "true");
            console.log(`Mostrando marcador: ${msg.marcador}`);
        }
        
        if (msg.accion === "ocultar") {
            entidad.setAttribute("visible", "false");
            console.log(`Ocultando marcador: ${msg.marcador}`);
        }
    },

    enviarEvento: function (tipo, marcadorId) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ tipo: tipo, marcador: marcadorId }));
        }
    },

    conectarSSE: function () {
        // Vincula dinámicamente con el host actual para pruebas locales fluidas
        const host = location.hostname === "" ? "localhost" : location.hostname;
        const fuente = new EventSource("http://" + host + ":8000/historia");
        const panel = document.getElementById("panel-historia");

        if (!panel) return;

        fuente.onmessage = (evento) => {
            panel.innerText += evento.data;
            panel.scrollTop = panel.scrollHeight;
        };
    }
};
// Esto le da la orden de iniciar las conexiones apenas lee el archivo
Conexion.conectarWS();
Conexion.conectarSSE();
