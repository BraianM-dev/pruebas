const game = {
  hero: 0,
  enemy: 0,
  xp: 0,
  potions: 2,
  unlocked: [],
  heroes: [
    { name: "El Gran Mago", hp: 45, max: 50 },
    { name: "Guerrero de Acero", hp: 60, max: 65 },
    { name: "Luna Sombra", hp: 38, max: 45 }
  ],
  enemies: [
    { name: "Dragón de Eldoria", hp: 500, max: 500 },
    { name: "Guardián del Portal", hp: 120, max: 120 }
  ]
};

const fallbackLines = [
  "Un hilo azul cruza las grietas del suelo. La pista no está en la fuerza, sino en el orden de las runas.",
  "El eco devuelve la última palabra de la compañía: «estructura». Una puerta responde al otro lado de la cámara.",
  "La madera vibra bajo sus manos. El Guardián espera que la compañía explique por qué eligió ese camino.",
  "Una chispa ilumina el borde del tablero. En la cripta, cada conexión tiene dos extremos: origen y destino."
];

const byId = id => document.getElementById(id);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const tryStore = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* El juego continúa aunque el navegador bloquee el almacenamiento. */ } };

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem("calabozos-codigo-game") || "null");
    if (!saved) return;
    game.hero = clamp(Number(saved.hero) || 0, 0, game.heroes.length - 1);
    game.enemy = clamp(Number(saved.enemy) || 0, 0, game.enemies.length - 1);
    game.xp = clamp(Number(saved.xp) || 0, 0, 99999);
    game.potions = clamp(Number(saved.potions) || 0, 0, 2);
    game.unlocked = Array.isArray(saved.unlocked) ? saved.unlocked.filter(x => ["html", "css", "js", "ia", "conexion"].includes(x)) : [];
    [game.heroes, game.enemies].forEach((group, groupIndex) => {
      const old = groupIndex ? saved.enemies : saved.heroes;
      if (Array.isArray(old)) group.forEach((item, i) => { item.hp = clamp(Number(old[i]?.hp) || 0, 0, item.max); });
    });
  } catch (_) { /* Un estado anterior dañado no impide iniciar una campaña nueva. */ }
}

function saveGame() {
  tryStore("calabozos-codigo-game", {
    hero: game.hero, enemy: game.enemy, xp: game.xp, potions: game.potions,
    unlocked: game.unlocked, heroes: game.heroes, enemies: game.enemies
  });
}

function updateBars() {
  document.querySelectorAll("[data-hero]").forEach(button => {
    const index = Number(button.dataset.hero), hero = game.heroes[index];
    button.classList.toggle("is-active", index === game.hero);
    button.setAttribute("aria-pressed", String(index === game.hero));
    button.querySelector(".health-track i").style.width = `${hero.hp / hero.max * 100}%`;
    button.querySelector(".health-label").textContent = `${hero.hp} / ${hero.max} PV`;
  });
  document.querySelectorAll("[data-enemy]").forEach(button => {
    const index = Number(button.dataset.enemy), enemy = game.enemies[index];
    button.classList.toggle("is-target", index === game.enemy);
    button.setAttribute("aria-pressed", String(index === game.enemy));
    button.querySelector(".enemy-track i").style.width = `${enemy.hp / enemy.max * 100}%`;
    button.querySelector(".health-label").textContent = `${enemy.hp} / ${enemy.max} PV`;
    button.disabled = enemy.hp === 0;
  });
  byId("active-hero-label").textContent = game.heroes[game.hero].name;
  byId("xp-value").textContent = game.xp;
  byId("runes-value").textContent = game.unlocked.length;
  byId("campaign-completion").hidden = game.unlocked.length < 5;
  byId("potion-count").textContent = String(game.potions).padStart(2, "0");
  document.querySelectorAll("[data-relic]").forEach(card => {
    const awake = game.unlocked.includes(card.dataset.relic);
    card.classList.toggle("is-awake", awake);
    card.querySelector(".relic-state").textContent = awake ? "RUNa DESPIERTA".toUpperCase() : "BLOQUEADA";
  });
  saveGame();
}

function addStory(text, label = "DM") {
  const row = document.createElement("p");
  row.className = "story-entry";
  const tag = document.createElement("span"); tag.className = "story-time"; tag.textContent = label;
  const content = document.createElement("span"); content.textContent = text;
  row.append(tag, content); byId("story-log").append(row);
  while (byId("story-log").children.length > 12) byId("story-log").firstElementChild.remove();
  byId("story-log").scrollTop = byId("story-log").scrollHeight;
}

let toastTimer;
function toast(message) {
  const el = byId("toast"); el.textContent = message; el.classList.add("is-visible");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2600);
}

function rollD20(announce = true) {
  const roll = Math.floor(Math.random() * 20) + 1;
  const out = byId("d20-result"), panel = out.closest(".die-result");
  out.textContent = roll;
  panel.classList.toggle("is-crit", roll === 20);
  panel.classList.toggle("is-fail", roll === 1);
  const result = roll === 20 ? "ÉXITO CRÍTICO" : roll === 1 ? "FALLO CRÍTICO" : roll >= 10 ? "PRUEBA SUPERADA" : "LA CRIPTA RESISTE";
  byId("d20-outcome").textContent = result;
  if (announce) addStory(roll === 20 ? `¡Crítico! El D20 muestra ${roll}; las runas responden a la compañía.` : roll === 1 ? `El D20 cae en ${roll}. La cripta guarda silencio; pueden cambiar de estrategia.` : `La compañía obtiene ${roll} en el D20: ${result.toLowerCase()}.`, "D20");
  return roll;
}

function selectHero(index) {
  game.hero = index; updateBars();
  addStory(`Toma la iniciativa ${game.heroes[index].name}. La compañía prepara su siguiente decisión.`, "TURNO");
}

function selectEnemy(index) {
  if (game.enemies[index].hp <= 0) return;
  game.enemy = index; updateBars();
  toast(`Objetivo fijado: ${game.enemies[index].name}`);
}

function attack() {
  const hero = game.heroes[game.hero], enemy = game.enemies[game.enemy];
  if (enemy.hp <= 0) { toast("Elige un enemigo que siga en pie."); return; }
  const roll = rollD20(false);
  if (roll === 1) { addStory(`${hero.name} falla la maniobra. La compañía puede estudiar otra ruta.`, "ACCIÓN"); return; }
  if (roll < 10) { addStory(`Con un ${roll}, ${hero.name} obliga a ${enemy.name} a retroceder, pero no encuentra una abertura.`, "ACCIÓN"); return; }
  const base = [12, 16, 13][game.hero] + Math.floor(Math.random() * 8);
  const damage = roll === 20 ? base * 2 : base;
  enemy.hp = Math.max(0, enemy.hp - damage); game.xp += roll === 20 ? 30 : 15;
  addStory(`${roll === 20 ? "¡Golpe crítico! " : ""}${hero.name} supera la defensa e inflige ${damage} puntos a ${enemy.name}. ${enemy.hp ? `Quedan ${enemy.hp} PV.` : "La amenaza ha sido derrotada. ¡La ruta queda abierta!"}`, "ACCIÓN");
  if (enemy.hp === 0) game.xp += 50;
  updateBars();
}

function heal() {
  const hero = game.heroes[game.hero];
  if (game.potions <= 0) { toast("No quedan pociones. Explora el tablero para buscar recursos."); return; }
  if (hero.hp >= hero.max) { toast(`${hero.name} ya está en plena forma.`); return; }
  const before = hero.hp; hero.hp = Math.min(hero.max, hero.hp + 15); game.potions -= 1; game.xp += 5;
  addStory(`${hero.name} recupera ${hero.hp - before} puntos de vida. La compañía conserva una poción para el siguiente reto.`, "POCIÓN"); updateBars();
}

function explore() {
  game.xp += 10;
  const text = fallbackLines[Math.floor(Math.random() * fallbackLines.length)];
  addStory(text, "PISTA");
  toast("Pista encontrada · +10 XP");
  updateBars();
}

function awaken(name, award = true) {
  if (game.unlocked.includes(name)) return;
  game.unlocked.push(name);
  if (award) game.xp += 50;
  updateBars();
  if (game.unlocked.length === 5) {
    addStory("¡Las cinco runas se encienden! El portal de la cripta se abre y la compañía puede compartir cómo resolvió la misión.", "MISIÓN");
    toast("Misión completa · portal abierto");
  }
}

const challenges = {
  html: { number: "01", title: "La Runa de Estructura", prompt: "El mapa exige una región que identifique el contenido principal de esta página. ¿Qué elemento semántico elegirías?", options: [["<section>", false], ["<main>", true], ["<footer>", false]], success: "¡La Runa HTML despierta! <main> identifica el contenido dominante del documento." },
  css: { number: "02", title: "La Runa de Estilo", prompt: "La caja del cofre necesita espacio entre su contenido y el borde. ¿Qué propiedad CSS controla ese espacio interior?", options: [["margin", false], ["padding", true], ["display", false]], success: "¡La Runa CSS despierta! padding controla el espacio interior; margin crea espacio exterior." },
  js: { number: "03", title: "La Runa de Interacción", prompt: "La puerta debe reaccionar al pulsar el botón. ¿Qué evento escucharías con addEventListener?", options: [["click", true], ["load", false], ["scroll", false]], success: "¡La Runa JavaScript despierta! El evento click permite responder a la acción del jugador." }
};

function openChallenge(key) {
  const challenge = challenges[key];
  if (!challenge) return;
  byId("challenge-seal").textContent = challenge.number;
  byId("challenge-kicker").textContent = `RETO ${challenge.number} / 05 · PRUEBA DE CÓDIGO`;
  byId("challenge-title").textContent = challenge.title;
  byId("challenge-prompt").textContent = challenge.prompt;
  byId("challenge-feedback").textContent = "";
  const options = byId("challenge-options"); options.replaceChildren();
  challenge.options.forEach(([text, correct]) => {
    const button = document.createElement("button"); button.className = "challenge-option"; button.type = "button"; button.textContent = text;
    button.addEventListener("click", () => {
      if (game.unlocked.includes(key)) return;
      if (correct) {
        button.classList.add("is-correct"); byId("challenge-feedback").textContent = challenge.success;
        options.querySelectorAll("button").forEach(option => { option.disabled = true; });
        awaken(key); addStory(challenge.success, "RUNA");
      } else { button.classList.add("is-wrong"); byId("challenge-feedback").textContent = "La puerta no cede. Hablenlo en equipo e intenten otra respuesta."; }
    });
    options.append(button);
  });
  byId("relic-challenge").hidden = false;
  byId("relic-challenge").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function narrate(action, context = {}) {
  const localPage = ["localhost", "127.0.0.1"].includes(location.hostname) || /^10\./.test(location.hostname) || /^192\.168\./.test(location.hostname);
  const dmMode = byId("dm-mode");
  if (!localPage) {
    dmMode.textContent = "RESPALDO NARRATIVO · SIN SERVIDOR LOCAL";
    return fallbackLines[Math.floor(Math.random() * fallbackLines.length)];
  }
  dmMode.textContent = "OLLAMA · GENERANDO RELATO";
  const host = location.hostname || "127.0.0.1";
  try {
    const response = await fetch(`http://${host}:8000/narrar`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: String(action).slice(0, 240), personaje: game.heroes[game.hero].name, enemigo: game.enemies[game.enemy].name, tirada: context.roll ?? null, progreso: game.unlocked.length })
    });
    if (!response.ok) throw new Error("Narrador local no disponible");
    const data = await response.json(); dmMode.textContent = data.modo === "respaldo" ? "RELATO DE RESPALDO" : "OLLAMA LOCAL · ACTIVO";
    return data.relato;
  } catch (_) {
    dmMode.textContent = "RESPALDO NARRATIVO · OLLAMA NO DISPONIBLE";
    return fallbackLines[Math.floor(Math.random() * fallbackLines.length)];
  }
}

async function askDm(action) {
  const text = await narrate(action);
  addStory(text, "DUNGEON MASTER");
  awaken("ia", false);
  return text;
}

function startAr() {
  const frame = byId("ar-frame");
  frame.src = "../../index.html?embed=game";
  frame.hidden = false;
  byId("ar-placeholder").hidden = true;
  byId("ar-status").classList.add("is-live");
  byId("ar-status").innerHTML = "<i></i> CÁMARA ACTIVADA";
  byId("marker-state").textContent = "Permite el acceso y apunta a un marcador compatible.";
}

function handleMarker(event) {
  if (event.origin !== location.origin || event.data?.type !== "calabozos-ar") return;
  const { action, marker, name } = event.data;
  if (action === "found") {
    awaken("conexion", false);
    byId("marker-label").textContent = `${name || "Marcador"} · ${marker}`;
    byId("marker-state").textContent = `Marcador detectado: ${marker}`;
    byId("marker-dot").style.background = "var(--jade)";
    const markerInfo = marker + " " + name;
    if (/hiro|kanji|dragón|dragon/i.test(markerInfo)) selectEnemy(0);
    else if (/Barcode_0|Barcode_1|mago/i.test(markerInfo)) selectHero(0);
    else if (/Barcode_11|guerrero/i.test(markerInfo)) selectHero(1);
    addStory(`La cámara reconoce ${name || marker}. El mapa de la cripta actualiza la escena.`, "AR");
  } else if (action === "lost") {
    byId("marker-label").textContent = "Sin marcador detectado";
    byId("marker-state").textContent = "La cámara continúa buscando.";
    byId("marker-dot").style.background = "var(--gold)";
  }
}

document.querySelectorAll("[data-hero]").forEach(button => button.addEventListener("click", () => selectHero(Number(button.dataset.hero))));
document.querySelectorAll("[data-enemy]").forEach(button => button.addEventListener("click", () => selectEnemy(Number(button.dataset.enemy))));
byId("btn-roll").addEventListener("click", () => rollD20());
byId("btn-attack").addEventListener("click", attack);
byId("btn-heal").addEventListener("click", heal);
byId("btn-explore").addEventListener("click", explore);
byId("btn-load-ar").addEventListener("click", startAr);
byId("btn-relato-intro").addEventListener("click", () => askDm("La compañía llega a la entrada de la Cripta del Algoritmo y escucha al dragón detrás del portal."));
byId("btn-close-challenge").addEventListener("click", () => { byId("relic-challenge").hidden = true; });
document.querySelectorAll("[data-relic-action]").forEach(button => button.addEventListener("click", () => {
  const key = button.dataset.relicAction;
  if (["html", "css", "js"].includes(key)) openChallenge(key);
  else if (key === "ia") askDm("El grupo consulta al Dungeon Master local: ¿qué pista podría ayudar a interpretar la siguiente runa?");
  else { document.getElementById("hardware").scrollIntoView({ behavior: "smooth", block: "center" }); toast("Elige micro:bit por USB o enlaza el puente ESP32-C3."); }
}));
byId("dm-form").addEventListener("submit", async event => {
  event.preventDefault(); const input = byId("dm-input"), value = input.value.trim(); if (!value) return;
  input.disabled = true; const submit = byId("dm-form").querySelector("button"); submit.disabled = true; submit.textContent = "Consultando…";
  await askDm(value); input.value = ""; input.disabled = false; submit.disabled = false; submit.innerHTML = 'Narrar <span aria-hidden="true">↗</span>'; input.focus();
});
byId("btn-contraste").addEventListener("click", event => {
  const active = document.body.classList.toggle("alto-contraste"); event.currentTarget.setAttribute("aria-pressed", String(active));
});
window.addEventListener("message", handleMarker);
window.addEventListener("game-command", event => {
  const command = event.detail;
  if (command === "NEXT_HERO") selectHero((game.hero + 1) % game.heroes.length);
  else if (command === "ATTACK") attack();
  else if (command === "ROLL") rollD20();
  else if (command === "HEAL") heal();
  else if (command === "EXPLORE") explore();
});
window.addEventListener("game-hardware", event => {
  const { type, connected } = event.detail;
  if (connected) {
    byId("hardware-label").textContent = type === "esp32" ? "ESP32-C3 ENLAZADO" : "MICRO:BIT CONECTADA";
    byId("hardware-dot").style.background = "var(--jade)";
    byId(type === "esp32" ? "esp32-status" : "serial-status").textContent = "Conectada · controles activos";
    awaken("conexion", false);
  } else {
    byId("hardware-label").textContent = "MODO DE MESA";
    byId("hardware-dot").style.background = "var(--gold)";
    byId(type === "esp32" ? "esp32-status" : "serial-status").textContent = "Desconectada";
  }
});

byId("btn-reset-campaign")?.addEventListener("click", () => {
  if (!window.confirm("¿Reiniciar la expedición? Se borrarán el progreso, los PV y las runas de este navegador.")) return;
  try { localStorage.removeItem("calabozos-codigo-game"); } catch (_) { /* no-op */ }
  location.reload();
});
loadGame(); updateBars();
