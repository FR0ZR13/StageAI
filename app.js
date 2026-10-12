(() => {
"use strict";
const CFG = window.APP_CONFIG || {};

/* ---------- Datos de la banda (editar aquí si cambia algo) ---------- */
const BAND = "Tomo Como Rey";

const MUSICIANS = [
  { id: "miguel",   name: "Miguel",   role: "Batería" },
  { id: "mario",    name: "Mario",    role: "Bajo" },
  { id: "cony",     name: "Cony",     role: "Congas · Coros 1" },
  { id: "chany",    name: "Chany",    role: "Guitarra 1" },
  { id: "jaime",    name: "Jaime",    role: "Guitarra 2 · Voz 2" },
  { id: "salo",     name: "Salo",     role: "Teclado Nord · Keytar" },
  { id: "fernando", name: "Fernando", role: "Trombón" },
  { id: "pume",     name: "Pume",     role: "Saxo" },
  { id: "pato",     name: "Pato",     role: "Trompeta · Coros 2" },
  { id: "negro",    name: "Negro",    role: "Voz principal · Guitarra 3 · Acústica" }
];

const SOURCES = [
  { id: "master",   name: "Volumen general" },
  { id: "bateria",  name: "Batería", children: [
    { id: "bombo",    name: "Bombo" },
    { id: "caja",     name: "Caja" },
    { id: "hihat",    name: "Hi-hat" },
    { id: "toms",     name: "Toms" },
    { id: "timbales", name: "Timbales" },
    { id: "campanas", name: "Campanas" },
    { id: "oh",       name: "Platillos OH" }
  ] },
  { id: "bajo",     name: "Bajo" },
  { id: "congas",   name: "Congas" },
  { id: "bongo",    name: "Bongo" },
  { id: "gtr1",     name: "Guitarra 1" },
  { id: "gtr2",     name: "Guitarra 2" },
  { id: "gtr3",     name: "Guitarra 3" },
  { id: "acustica", name: "Guitarra acústica" },
  { id: "nord",     name: "Teclado Nord" },
  { id: "keytar",   name: "Keytar" },
  { id: "trombon",  name: "Trombón" },
  { id: "saxo",     name: "Saxo" },
  { id: "trompeta", name: "Trompeta" },
  { id: "voz-prin", name: "Voz principal Negro" },
  { id: "voz-2",    name: "Voz 2 (Jaime)" },
  { id: "coros-1",  name: "Coros 1 (Cony)" },
  { id: "coros-2",  name: "Coros 2 (Pato)" },
  { id: "voz-dir",  name: "Voz director" },
  { id: "secuencia",name: "Secuencia" }
];

const ROLES = [
  { id: "monitor",   name: "Sonidista monitor",       hint: "Recibe y ve los pedidos de mezcla" },
  { id: "drumtech",  name: "Drumtech",                hint: "Batería y percusión" },
  { id: "guitartech",name: "Guitartech",              hint: "Guitarras y teclados" },
  { id: "rf",        name: "Técnico RF",              hint: "Micrófonos y monitores inalámbricos" },
  { id: "director",  name: "Director / secuenciador", hint: "Secuencias y flujo del show" },
  { id: "musico",    name: "Músico",                  hint: "Pedir cambios de tu propia mezcla" },
  { id: "sala",      name: "Sonidista sala",          hint: "No participa en la mezcla de músicos" }
];

/* ---------- Utilidades ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ls = {
  get(k, d) { try { const v = localStorage.getItem("tcr." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("tcr." + k, JSON.stringify(v)); } catch {} }
};
const mus = id => MUSICIANS.find(m => m.id === id);
const src = id => {
  for (const s of SOURCES) {
    if (s.id === id) return s;
    for (const c of s.children || []) if (c.id === id) return { ...c, name: s.name + " · " + c.name };
  }
};
const roleOf = id => ROLES.find(r => r.id === id);
const cleanRoom = r => (r || "").toLowerCase().replace(/[^a-z0-9_-]/g, "") || "sala";
const ago = t => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  return s < 60 ? `hace ${s} s` : `hace ${Math.round(s / 60)} min`;
};

/* ---------- Estado ---------- */
if (ls.get("role", null) === "musico" && !ls.get("me", null)) ls.set("role", null);
const S = {
  role: ls.get("role", null),
  room: ls.get("room", CFG.defaultRoom || "tcr"),
  sound: ls.get("sound", true),
  reqs: {}, online: false, sel: { m: null, e: null },
  me: ls.get("me", null), pickMe: null, open: null, cart: [], checked: new Set(), sending: false,
  seen: new Set(), loaded: false, setup: false, pickRole: null, tr: null, sentMsg: ""
};

/* ---------- Transporte ---------- */
function makeTransport(room, onData, onStatus) {
  const r = cleanRoom(room);
  const url = (CFG.firebaseUrl || "").trim().replace(/\/+$/, "");
  return url ? firebaseTransport(url, r, onData, onStatus) : localTransport(r, onData, onStatus);
}

function firebaseTransport(url, r, onData, onStatus) {
  const base = `${url}/rooms/${r}/req`;
  let map = {};
  const apply = (path, data, patch) => {
    if (path === "/") {
      if (patch) { map = { ...map }; for (const k in (data || {})) { if (data[k] === null) delete map[k]; else map[k] = data[k]; } }
      else map = data || {};
      return;
    }
    const p = path.split("/").filter(Boolean), id = p[0];
    map = { ...map };
    if (p.length === 1) {
      if (patch) map[id] = { ...(map[id] || {}), ...(data || {}) };
      else if (data === null) delete map[id]; else map[id] = data;
    } else {
      map[id] = { ...(map[id] || {}) };
      if (data === null) delete map[id][p[1]]; else map[id][p[1]] = data;
    }
  };
  const es = new EventSource(base + ".json");
  es.onopen = () => onStatus(true);
  es.onerror = () => onStatus(false);
  const handler = patch => e => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (!m) return;
    apply(m.path, m.data, patch);
    onData({ ...map });
  };
  es.addEventListener("put", handler(false));
  es.addEventListener("patch", handler(true));
  const ok = res => { if (!res.ok) throw new Error(res.status); return res; };
  return {
    mode: "firebase",
    send: req => fetch(base + ".json", { method: "POST", body: JSON.stringify(req) }).then(ok),
    done: ids => Promise.all(ids.map(id => fetch(`${base}/${id}.json`, { method: "PATCH", body: JSON.stringify({ done: true }) }).then(ok))),
    clear: () => fetch(base + ".json", { method: "DELETE" }).then(ok),
    close: () => es.close()
  };
}

function localTransport(r, onData, onStatus) {
  const key = "tcr.local." + r;
  let map = {};
  try { map = JSON.parse(localStorage.getItem(key) || "{}"); } catch {}
  const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("tcr-" + r) : null;
  const push = () => {
    try { localStorage.setItem(key, JSON.stringify(map)); } catch {}
    if (bc) bc.postMessage(map);
    onData({ ...map });
  };
  if (bc) bc.onmessage = e => { map = e.data || {}; onData({ ...map }); };
  setTimeout(() => { onStatus(true); onData({ ...map }); }, 0);
  return {
    mode: "local",
    send: req => { map = { ...map, ["l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)]: req }; push(); return Promise.resolve(); },
    done: ids => { map = { ...map }; ids.forEach(id => { if (map[id]) map[id] = { ...map[id], done: true }; }); push(); return Promise.resolve(); },
    clear: () => { map = {}; push(); return Promise.resolve(); },
    close: () => { if (bc) bc.close(); }
  };
}

/* ---------- Audio / avisos ---------- */
let actx = null;
function unlockAudio() {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch {}
}
function beep() {
  if (!S.sound || !actx) return;
  const t = actx.currentTime;
  [880, 1175].forEach((f, i) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + i * 0.14);
    g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.14 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.14 + 0.13);
    o.connect(g).connect(actx.destination); o.start(t + i * 0.14); o.stop(t + i * 0.14 + 0.14);
  });
}
async function keepAwake() { try { if (navigator.wakeLock) await navigator.wakeLock.request("screen"); } catch {} }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepAwake(); });

let toastT;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ---------- Datos derivados ---------- */
const arr = x => Array.isArray(x) ? x : (x && typeof x === "object" ? Object.values(x) : []);
function entries() {
  return Object.entries(S.reqs).filter(([, v]) => v && v.m && (v.items || v.e))
    .map(([id, v]) => ({ id, ...v, items: v.items ? arr(v.items) : [{ e: v.e, d: v.d }] }));
}
const pending = () => entries().filter(r => !r.done).sort((a, b) => (b.t || 0) - (a.t || 0));
const fmtD = d => (d > 0 ? "+" : "−") + Math.abs(d);
const itemsText = items => items.map(i => `${src(i.e)?.name || i.e} ${fmtD(i.d)}`).join(", ");
function cartAdd(e, d) {
  const i = S.cart.findIndex(x => x.e === e);
  if (i < 0) S.cart.push({ e, d });
  else { S.cart[i].d += d; if (S.cart[i].d === 0) S.cart.splice(i, 1); }
}

/* ---------- Vistas ---------- */
function renderHeader() {
  const h = $("#hdr");
  if (S.setup || !S.role) { h.innerHTML = ""; return; }
  const pend = pending().length;
  h.innerHTML = `
    <div class="brand"><b>${esc(BAND)}</b><span>${esc(roleOf(S.role).name)}${S.role === "musico" ? " · " + esc(mus(S.me).name) : ""} · sala ${esc(cleanRoom(S.room))}</span></div>
    ${S.role === "monitor" ? `<div class="pill ${pend ? "alert" : ""}">Pendientes ${pend}</div>` : ""}
    <span class="dot ${S.online ? "on" : ""}" title="${S.online ? "Conectado" : "Sin conexión"}"></span>
    <button class="icon-btn" data-act="edit" aria-label="Cambiar rol o sala">⚙</button>`;
}

function renderMain() {
  const m = $("#main");
  if (S.setup || !S.role) return m.innerHTML = setupView();
  const banner = S.tr && S.tr.mode === "local"
    ? `<div class="banner">Modo local: los pedidos solo se ven en este dispositivo. Para conectar al equipo, configura Firebase en config.js (ver README).</div>` : "";
  if (S.role === "monitor") { m.innerHTML = banner + monitorShell(); renderMonitor(); }
  else if (S.role === "sala") m.innerHTML = banner + `<p class="empty">El sonidista de sala no participa en la mezcla de músicos. Puedes cambiar de rol con el botón ⚙ si necesitas ayudar.</p>`;
  else { m.innerHTML = banner + panelView(); updatePanel(); renderRecent(); }
}

function setupView() {
  const pick = S.pickRole || S.role;
  const me = S.pickMe || S.me;
  const ready = pick && (pick !== "musico" || me);
  return `<div class="setup">
    <h1>${esc(BAND)}</h1>
    <p>Mezcla de músicos · pedidos al monitorista</p>
    <div class="field"><label for="room">Código de sala (todo el staff usa el mismo)</label>
      <input id="room" value="${esc(S.room)}" autocapitalize="none" autocomplete="off" spellcheck="false"></div>
    <div class="field"><label>Tu rol</label><div class="roles">
      ${ROLES.map(r => `<button class="chip ${pick === r.id ? "on" : ""}" data-act="pick-role" data-id="${r.id}"><b>${esc(r.name)}</b><small>${esc(r.hint)}</small></button>`).join("")}
    </div></div>
    ${pick === "musico" ? `<div class="field"><label>¿Quién eres?</label><div class="grid m">
      ${MUSICIANS.map(x => `<button class="chip ${me === x.id ? "on" : ""}" data-act="pick-me" data-id="${x.id}"><b>${esc(x.name)}</b><small>${esc(x.role)}</small></button>`).join("")}
    </div></div>` : ""}
    <button class="cta" data-act="enter" ${ready ? "" : "disabled"}>Entrar</button>
  </div>`;
}

function elsHtml() {
  const bdg = id => { const c = S.cart.find(i => i.e === id); return c ? `<em class="bdg ${c.d > 0 ? "up" : "down"}">${fmtD(c.d)}</em>` : ""; };
  const on = id => S.sel.e === id ? " on" : "";
  return SOURCES.map(x => {
    if (!x.children) return `<button class="chip el${on(x.id)}" data-act="sel-e" data-id="${x.id}"><b>${esc(x.name)}</b>${bdg(x.id)}</button>`;
    const open = S.open === x.id;
    return `<button class="chip el group${on(x.id)}" data-act="sel-e" data-id="${x.id}" aria-expanded="${open}"><b>${esc(x.name)}</b>${bdg(x.id)}<small>${open ? "Ocultar canales ▴" : "Ver canales ▾"}</small></button>`
      + (open ? `<div class="subgrid">${x.children.map(c => `<button class="chip el${on(c.id)}" data-act="sel-e" data-id="${c.id}"><b>${esc(c.name)}</b>${bdg(c.id)}</button>`).join("")}</div>` : "");
  }).join("");
}

function panelView() {
  const personal = S.role === "musico";
  return `
  ${personal ? `<p class="empty" style="padding:0 0 12px">Pedidos para tu monitor, ${esc(mus(S.me).name)}. Puedes juntar varios cambios y enviarlos en un solo pedido.</p>` : `
  <section class="step"><h2><i>1</i> Músico</h2><div class="grid m">
    ${MUSICIANS.map(x => `<button class="chip" data-act="sel-m" data-id="${x.id}"><b>${esc(x.name)}</b><small>${esc(x.role)}</small></button>`).join("")}
  </div></section>`}
  <section class="step"><h2><i>${personal ? 1 : 2}</i> Elementos (toca − o + en cada uno)</h2><div class="grid e" id="els"></div></section>
  <section class="step"><h2>${personal ? "Tus pedidos" : "Tus últimos pedidos"}</h2><ul class="recent" id="recent"></ul></section>
  <div class="spacer"></div>
  <div class="dock"><div class="dock-in">
    <div class="sel" id="selbar"></div>
    <div class="cart" id="cart"></div>
    <div class="pm">
      <button class="down" data-act="add" data-d="-1" aria-label="Bajar volumen">−</button>
      <button class="up" data-act="add" data-d="1" aria-label="Subir volumen">+</button>
    </div>
    <div class="sendrow">
      <button class="ghost" data-act="clear-cart">Vaciar</button>
      <button class="send" id="sendb" data-act="send">Enviar pedido</button>
    </div>
  </div></div>`;
}

function updatePanel() {
  const els = $("#els"); if (els) els.innerHTML = elsHtml();
  document.querySelectorAll('[data-act="sel-m"]').forEach(b => b.classList.toggle("on", b.dataset.id === S.sel.m));
  document.querySelectorAll('[data-act="add"]').forEach(b => b.disabled = !(S.sel.m && S.sel.e));
  const sb = $("#sendb"); if (!sb) return;
  sb.disabled = !(S.sel.m && S.cart.length) || S.sending;
  sb.textContent = S.cart.length ? `Enviar pedido (${S.cart.length})` : "Enviar pedido";
  document.querySelector('[data-act="clear-cart"]').disabled = !S.cart.length;
  $("#cart").innerHTML = S.cart.map(i => `<button class="ci ${i.d > 0 ? "up" : "down"}" data-act="rm" data-id="${i.e}" aria-label="Quitar ${esc(src(i.e).name)}">${esc(src(i.e).name)} ${fmtD(i.d)} ✕</button>`).join("");
  const bar = $("#selbar"), who = S.role === "musico" || !S.sel.m ? "" : esc(mus(S.sel.m).name) + " · ";
  if (S.sentMsg) bar.innerHTML = `<span class="sent">${esc(S.sentMsg)}</span>`;
  else if (!S.sel.m) bar.innerHTML = `<span>Elige un músico</span>`;
  else if (S.sel.e) bar.innerHTML = `<b>${who}${esc(src(S.sel.e).name)}</b><span>Toca − o +</span>`;
  else bar.innerHTML = `<span>${S.cart.length ? who + "agrega más elementos o envía" : who + "elige un elemento"}</span>`;
}

function renderRecent() {
  const ul = $("#recent"); if (!ul) return;
  const mine = entries().filter(r => S.role === "musico" ? (r.from === "musico" && r.m === S.me) : r.from === S.role).sort((a, b) => b.t - a.t).slice(0, 4);
  ul.innerHTML = mine.length ? mine.map(r => `<li><span>${esc(mus(r.m)?.name || r.m)} · ${esc(itemsText(r.items))}</span>
    <span class="${r.done ? "ok" : "wait"}">${r.done ? "Hecho" : "Pendiente"}</span></li>`).join("")
    : `<li><span class="empty" style="padding:0">Aún no has enviado pedidos.</span></li>`;
}

function monitorShell() {
  return `<div class="tools">
    <button class="tool ${S.sound ? "on" : ""}" data-act="sound">Sonido ${S.sound ? "activado" : "silenciado"}</button>
    <button class="tool" data-act="clear">Limpiar historial</button></div>
    <div id="queue"></div><h3 class="sec">Hechos recientemente</h3><ul class="hist" id="hist"></ul>`;
}

function renderMonitor() {
  const q = $("#queue"); if (!q) return;
  const g = pending();
  q.innerHTML = g.length ? g.map(r => {
    const from = r.from === "musico" ? "Pedido personal del músico" : (roleOf(r.from)?.name || r.from);
    return `<div class="card2 ${S.seen.has(r.id) ? "" : "fresh"}">
      <div class="top"><div class="who"><b>${esc(mus(r.m)?.name || r.m)}</b><small>${esc(from)} · ${ago(r.t || Date.now())}</small></div>
        <button class="done-btn" data-act="done" data-ids="${r.id}">Hecho</button></div>
      <ul class="items">${r.items.map((i, n) => { const k = r.id + ":" + n; return `<li><button class="it ${i.d > 0 ? "up" : "down"} ${S.checked.has(k) ? "chk" : ""}" data-act="chk" data-k="${k}"><span class="amt">${fmtD(i.d)}</span><span>${esc(src(i.e)?.name || i.e)}</span></button></li>`; }).join("")}</ul>
    </div>`;
  }).join("") : `<p class="empty">Sin pedidos pendientes.</p>`;
  const done = entries().filter(r => r.done).sort((a, b) => b.t - a.t).slice(0, 8);
  $("#hist").innerHTML = done.length ? done.map(r => `<li>${esc(mus(r.m)?.name || r.m)} · ${esc(itemsText(r.items))}</li>`).join("") : "<li>Nada aún.</li>";
}

/* ---------- Flujo ---------- */
function onData(map) {
  S.reqs = map;
  const fresh = entries().filter(r => !r.done && !S.seen.has(r.id));
  if (S.role === "monitor" && S.loaded && fresh.length) { beep(); if (navigator.vibrate) navigator.vibrate([80, 60, 80]); }
  renderHeader();
  if (S.role === "monitor") renderMonitor(); else renderRecent();
  entries().forEach(r => S.seen.add(r.id));
  S.loaded = true;
}

function start() {
  if (S.tr) S.tr.close();
  S.loaded = false; S.seen = new Set(); S.reqs = {}; S.online = false;
  S.tr = makeTransport(S.room, onData, on => { S.online = on; renderHeader(); });
  S.cart = []; S.sending = false;
  if (S.role === "musico") S.sel.m = S.me;
  keepAwake();
  renderHeader(); renderMain();
}

function send() {
  if (S.sending || !S.sel.m || !S.cart.length) return;
  const req = { t: Date.now(), from: S.role, m: S.sel.m, items: S.cart.map(i => ({ e: i.e, d: i.d })) };
  const n = req.items.length;
  S.sending = true; updatePanel();
  S.tr.send(req).then(() => {
    S.cart = []; S.sel.e = null; S.sending = false;
    S.sentMsg = `Enviado a monitor: ${mus(req.m).name} · ${n} ${n === 1 ? "cambio" : "cambios"}`;
    updatePanel(); clearTimeout(send.t); send.t = setTimeout(() => { S.sentMsg = ""; updatePanel(); }, 2200);
    if (navigator.vibrate) navigator.vibrate(40);
  }).catch(() => { S.sending = false; updatePanel(); toast("No se pudo enviar. Tu pedido sigue armado."); });
}

document.addEventListener("click", e => {
  unlockAudio();
  const b = e.target.closest("[data-act]"); if (!b) return;
  const a = b.dataset.act;
  if (a === "pick-role") { S.pickRole = b.dataset.id; renderMain(); }
  else if (a === "pick-me") { S.pickMe = b.dataset.id; renderMain(); }
  else if (a === "enter") {
    S.room = ($("#room").value || "").trim() || "tcr"; S.role = S.pickRole || S.role; S.setup = false;
    if (S.role === "musico") { S.me = S.pickMe || S.me; ls.set("me", S.me); }
    S.sel = { m: S.role === "musico" ? S.me : null, e: null };
    ls.set("role", S.role); ls.set("room", S.room); start();
  }
  else if (a === "edit") { S.setup = true; S.pickRole = S.role; renderHeader(); renderMain(); }
  else if (a === "sel-m") {
    if (S.sel.m && S.sel.m !== b.dataset.id && S.cart.length) { S.cart = []; toast("Pedido vaciado: cambiaste de músico"); }
    S.sel.m = b.dataset.id; updatePanel();
  }
  else if (a === "sel-e") {
    const id = b.dataset.id, g = SOURCES.find(x => x.id === id);
    if (g && g.children) { S.open = (S.open === id && S.sel.e === id) ? null : id; S.sel.e = id; }
    else S.sel.e = id;
    updatePanel();
  }
  else if (a === "add") { if (S.sel.m && S.sel.e) { cartAdd(S.sel.e, Number(b.dataset.d)); if (navigator.vibrate) navigator.vibrate(15); updatePanel(); } }
  else if (a === "rm") { S.cart = S.cart.filter(i => i.e !== b.dataset.id); updatePanel(); }
  else if (a === "clear-cart") { S.cart = []; updatePanel(); }
  else if (a === "send") send();
  else if (a === "chk") { const k = b.dataset.k; if (S.checked.has(k)) S.checked.delete(k); else S.checked.add(k); renderMonitor(); }
  else if (a === "done") S.tr.done(b.dataset.ids.split(",")).catch(() => toast("No se pudo marcar como hecho."));
  else if (a === "sound") { S.sound = !S.sound; ls.set("sound", S.sound); renderMain(); if (S.sound) beep(); }
  else if (a === "clear") { if (confirm("¿Borrar todos los pedidos de esta sala?")) S.tr.clear().catch(() => toast("No se pudo limpiar.")); }
});

setInterval(() => { if (S.role === "monitor" && !S.setup) renderMonitor(); }, 15000);

if (S.role) start(); else { renderHeader(); renderMain(); }
})();
