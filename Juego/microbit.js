const serialStatus = document.getElementById("serial-status");
let serialReader = null;
let esp32Active = false;
let esp32Cursor = 0;

function dispatchCommand(command) {
  const allowed = ["NEXT_HERO", "ATTACK", "ROLL", "HEAL", "EXPLORE"];
  if (!allowed.includes(command)) return;
  window.dispatchEvent(new CustomEvent("game-command", { detail: command }));
}

async function connectMicrobit() {
  if (!("serial" in navigator)) {
    serialStatus.textContent = "Este navegador no ofrece Web Serial. Usa Chrome o Edge en HTTPS o localhost.";
    return;
  }
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    serialStatus.textContent = "Micro:bit conectada por USB · espera comandos.";
    document.getElementById("btn-connect-microbit").textContent = "Conectada";
    window.dispatchEvent(new CustomEvent("game-hardware", { detail: { type: "microbit", connected: true } }));
    const decoder = new TextDecoderStream();
    port.readable.pipeTo(decoder.writable).catch(() => {});
    serialReader = decoder.readable.getReader();
    let buffer = "";
    while (true) {
      const { value, done } = await serialReader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      lines.forEach(line => dispatchCommand(line.trim().toUpperCase()));
    }
  } catch (error) {
    serialStatus.textContent = error.name === "NotFoundError" ? "Conexión cancelada. La partida puede continuar sin placa." : "No se pudo abrir el puerto USB. Revisa el cable y cierra el editor serial.";
  } finally {
    if (serialReader) { try { serialReader.releaseLock(); } catch (_) {} serialReader = null; }
  }
}

function normalizeEndpoint(value) {
  const raw = value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(raw)) throw new Error("Escribe una dirección http:// o https:// válida.");
  return raw;
}

async function connectEsp32() {
  const status = document.getElementById("esp32-status");
  const button = document.getElementById("btn-connect-esp32");
  if (esp32Active) {
    esp32Active = false; button.textContent = "Enlazar"; status.textContent = "Puente desconectado";
    window.dispatchEvent(new CustomEvent("game-hardware", { detail: { type: "esp32", connected: false } }));
    return;
  }
  let base;
  try { base = normalizeEndpoint(document.getElementById("esp32-url").value); }
  catch (error) { status.textContent = error.message; return; }
  status.textContent = "Buscando el puente en la red local…";
  try {
    const response = await fetch(`${base}/health`, { cache: "no-store" });
    if (!response.ok) throw new Error("El puente no respondió.");
    const health = await response.json();
    if (!health.ok) throw new Error("La respuesta no corresponde al puente de juego.");
    esp32Active = true; esp32Cursor = Number(health.cursor) || 0; button.textContent = "Desconectar";
    status.textContent = `ESP32-C3 enlazado · ${health.ip || "red local"}`;
    window.dispatchEvent(new CustomEvent("game-hardware", { detail: { type: "esp32", connected: true } }));
    pollEsp32(base);
  } catch (_) {
    status.textContent = "No se pudo alcanzar el ESP32. Comprueba Wi-Fi, URL y CORS; el juego sigue disponible.";
  }
}

async function pollEsp32(base) {
  while (esp32Active) {
    try {
      const response = await fetch(`${base}/events?after=${esp32Cursor}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Puente desconectado");
      const data = await response.json();
      (data.events || []).forEach(item => {
        esp32Cursor = Math.max(esp32Cursor, Number(item.id) || 0);
        dispatchCommand(String(item.command || "").toUpperCase());
      });
      await new Promise(resolve => setTimeout(resolve, 220));
    } catch (_) {
      if (esp32Active) {
        esp32Active = false;
        document.getElementById("esp32-status").textContent = "Se perdió el puente Wi-Fi; la aventura continúa.";
        document.getElementById("btn-connect-esp32").textContent = "Reintentar";
        window.dispatchEvent(new CustomEvent("game-hardware", { detail: { type: "esp32", connected: false } }));
      }
    }
  }
}

document.getElementById("btn-connect-microbit").addEventListener("click", connectMicrobit);
document.getElementById("btn-connect-esp32").addEventListener("click", connectEsp32);

// Atajos para jugar sin hardware: flecha arriba cambia héroe, espacio ataca,
// D lanza el dado, H cura e I explora. Se ignoran al escribir en formularios.
document.addEventListener("keydown", event => {
  if (event.target.matches("input, textarea, select")) return;
  const key = event.key.toLowerCase();
  const commands = { arrowup: "NEXT_HERO", " ": "ATTACK", d: "ROLL", h: "HEAL", i: "EXPLORE" };
  if (commands[key]) { event.preventDefault(); dispatchCommand(commands[key]); }
});
