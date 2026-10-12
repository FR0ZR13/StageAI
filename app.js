(() => {
"use strict";
const CFG = window.APP_CONFIG || {};

/* =====================================================================
   Utilidades
   ===================================================================== */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ls = {
  get(k, d) { try { const v = localStorage.getItem("tcr." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("tcr." + k, JSON.stringify(v)); } catch {} }
};
const uid = p => p + "-" + Math.random().toString(36).slice(2, 7);
const clone = o => JSON.parse(JSON.stringify(o));
const cleanRoom = r => (r || "").toLowerCase().replace(/[^a-z0-9_-]/g, "") || "sala";
const ago = t => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 60 ? `hace ${s} s` : `hace ${Math.round(s / 60)} min`; };
const fmtD = d => (d > 0 ? "+" : "−") + Math.abs(d);
const arr = x => Array.isArray(x) ? x : (x && typeof x === "object" ? Object.values(x) : []);

/* Tipos de rol del staff */
const KINDS = [
  ["monitor", "Recibe pedidos (monitor)"],
  ["tech",    "Envía pedidos (técnico)"],
  ["musico",  "Músico (pedidos personales)"],
  ["none",    "Sin mezcla de músicos"]
];

/* =====================================================================
   Plantillas (bandas)
   ===================================================================== */
const DEFAULT_TEMPLATE = {
  id: "tomo-como-rey", name: "Tomo Como Rey", rev: 0,
  musicians: [
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
  ],
  sources: [
    { id: "master", name: "Volumen general" },
    { id: "bateria", name: "Batería", children: [
      { id: "bombo", name: "Bombo" }, { id: "caja", name: "Caja" }, { id: "hihat", name: "Hi-hat" },
      { id: "toms", name: "Toms" }, { id: "timbales", name: "Timbales" }, { id: "campanas", name: "Campanas" },
      { id: "oh", name: "Platillos OH" }
    ] },
    { id: "bajo", name: "Bajo" }, { id: "congas", name: "Congas" }, { id: "bongo", name: "Bongo" },
    { id: "gtr1", name: "Guitarra 1" }, { id: "gtr2", name: "Guitarra 2" }, { id: "gtr3", name: "Guitarra 3" },
    { id: "acustica", name: "Guitarra acústica" }, { id: "nord", name: "Teclado Nord" }, { id: "keytar", name: "Keytar" },
    { id: "trombon", name: "Trombón" }, { id: "saxo", name: "Saxo" }, { id: "trompeta", name: "Trompeta" },
    { id: "voz-prin", name: "Voz principal Negro" }, { id: "voz-2", name: "Voz 2 (Jaime)" },
    { id: "coros-1", name: "Coros 1 (Cony)" }, { id: "coros-2", name: "Coros 2 (Pato)" },
    { id: "voz-dir", name: "Voz director" }, { id: "secuencia", name: "Secuencia" }
  ],
  roles: [
    { id: "monitor",    name: "Sonidista monitor",       hint: "Recibe y ve los pedidos de mezcla", kind: "monitor" },
    { id: "drumtech",   name: "Drumtech",                hint: "Batería y percusión", kind: "tech" },
    { id: "guitartech", name: "Guitartech",              hint: "Guitarras y teclados", kind: "tech" },
    { id: "rf",         name: "Técnico RF",              hint: "Micrófonos y monitores inalámbricos", kind: "tech" },
    { id: "director",   name: "Director / secuenciador", hint: "Secuencias y flujo del show", kind: "tech" },
    { id: "musico",     name: "Músico",                  hint: "Pedir cambios de tu propia mezcla", kind: "musico" },
    { id: "sala",       name: "Sonidista sala",          hint: "No participa en la mezcla de músicos", kind: "none" }
  ]
};

function blankTemplate() {
  return {
    id: uid("tpl"), name: "", rev: 0, musicians: [],
    sources: [{ id: "master", name: "Volumen general" }],
    roles: [
      { id: uid("r"), name: "Sonidista monitor", hint: "Recibe y ve los pedidos de mezcla", kind: "monitor" },
      { id: uid("r"), name: "Técnico", hint: "Envía pedidos de mezcla", kind: "tech" },
      { id: uid("r"), name: "Músico", hint: "Pedir cambios de tu propia mezcla", kind: "musico" },
      { id: uid("r"), name: "Sonidista sala", hint: "No participa en la mezcla de músicos", kind: "none" }
    ]
  };
}

/* Valida y limpia una plantilla (también se usa al importar o recibir de la sala) */
function normTpl(x) {
  if (!x || typeof x !== "object") return null;
  const str = v => String(v == null ? "" : v).trim().slice(0, 80);
  const musicians = arr(x.musicians).filter(Boolean).map(m => ({ id: str(m.id) || uid("m"), name: str(m.name), role: str(m.role) })).filter(m => m.name);
  const sources = arr(x.sources).filter(Boolean).map(s => {
    const o = { id: str(s.id) || uid("c"), name: str(s.name) };
    const ch = arr(s.children).filter(Boolean).map(c => ({ id: str(c.id) || uid("c"), name: str(c.name) })).filter(c => c.name);
    if (ch.length) o.children = ch;
    return o;
  }).filter(s => s.name);
  const roles = arr(x.roles).filter(Boolean).map(r => ({
    id: str(r.id) || uid("r"), name: str(r.name), hint: str(r.hint),
    kind: KINDS.some(k => k[0] === r.kind) ? r.kind : "tech"
  })).filter(r => r.name);
  if (!musicians.length || !sources.length || !roles.some(r => r.kind === "monitor")) return null;
  return { id: str(x.id) || uid("tpl"), name: str(x.name) || "Sin nombre", rev: Number(x.rev) || 0, musicians, sources, roles };
}

function loadLib() {
  let l = ls.get("lib", null);
  if (!l || !Array.isArray(l.templates)) l = { templates: [], active: null };
  l.templates = l.templates.map(normTpl).filter(Boolean);
  if (!l.templates.length) l.templates = [clone(DEFAULT_TEMPLATE)];
  if (!l.templates.some(t => t.id === l.active)) l.active = l.templates[0].id;
  return l;
}
let LIB = loadLib();
const saveLib = () => ls.set("lib", LIB);
let T = LIB.templates.find(t => t.id === LIB.active);
function setActive(id) { LIB.active = id; T = LIB.templates.find(t => t.id === id); saveLib(); }

const mus = id => T.musicians.find(m => m.id === id);
const src = id => {
  for (const s of T.sources) {
    if (s.id === id) return s;
    for (const c of s.children || []) if (c.id === id) return { ...c, name: s.name + " · " + c.name };
  }
};
const roleOf = id => T.roles.find(r => r.id === id);
const kindOf = id => roleOf(id)?.kind;
const countChannels = t => t.sources.reduce((n, s) => n + 1 + (s.children || []).length, 0);

/* =====================================================================
   Estado
   ===================================================================== */
const S = {
  role: ls.get("role", null), room: ls.get("room", CFG.defaultRoom || "tcr"), me: ls.get("me", null),
  sound: ls.get("sound", true), screen: "home",
  reqs: {}, online: false, sel: { m: null, e: null }, cart: [], open: null,
  pickRole: null, pickMe: null, edit: null,
  seen: new Set(), loaded: false, checked: new Set(), sending: false, publishing: false, sentMsg: "", tr: null
};
const isK = k => kindOf(S.role) === k;
const sessionOk = () => !!(S.role && roleOf(S.role) && S.room && (!isK("musico") || mus(S.me)));

/* =====================================================================
   Transporte (Firebase o local)
   ===================================================================== */
const fbUrl = () => (CFG.firebaseUrl || "").trim().replace(/\/+$/, "");
const okRes = res => { if (!res.ok) throw new Error(res.status); return res; };
const fbPutTpl = (room, tpl) => fetch(`${fbUrl()}/rooms/${cleanRoom(room)}/template.json`, { method: "PUT", body: JSON.stringify(tpl) }).then(okRes);
const fbGetTpl = room => fetch(`${fbUrl()}/rooms/${cleanRoom(room)}/template.json`).then(okRes).then(r => r.json());

function makeTransport(room, onData, onStatus, onTpl) {
  const r = cleanRoom(room);
  return fbUrl() ? firebaseTransport(fbUrl(), r, onData, onStatus, onTpl) : localTransport(r, onData, onStatus);
}

function firebaseTransport(url, r, onData, onStatus, onTpl) {
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
  const tes = new EventSource(`${url}/rooms/${r}/template.json`);
  let pullT;
  const pull = () => { clearTimeout(pullT); pullT = setTimeout(() => fbGetTpl(r).then(d => { if (d) onTpl(d); }).catch(() => {}), 150); };
  tes.addEventListener("put", pull);
  tes.addEventListener("patch", pull);
  return {
    mode: "firebase",
    send: req => fetch(base + ".json", { method: "POST", body: JSON.stringify(req) }).then(okRes),
    done: ids => Promise.all(ids.map(id => fetch(`${base}/${id}.json`, { method: "PATCH", body: JSON.stringify({ done: true }) }).then(okRes))),
    clear: () => fetch(base + ".json", { method: "DELETE" }).then(okRes),
    publishTpl: t => fbPutTpl(r, t),
    close: () => { es.close(); tes.close(); }
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
    publishTpl: () => Promise.resolve(),
    close: () => { if (bc) bc.close(); }
  };
}

/* =====================================================================
   Audio / avisos
   ===================================================================== */
let actx = null;
function unlockAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch {} }
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
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200);
}

/* =====================================================================
   Datos derivados
   ===================================================================== */
function entries() {
  return Object.entries(S.reqs).filter(([, v]) => v && v.m && (v.items || v.e))
    .map(([id, v]) => ({ id, ...v, items: v.items ? arr(v.items) : [{ e: v.e, d: v.d }] }));
}
const pending = () => entries().filter(r => !r.done).sort((a, b) => (b.t || 0) - (a.t || 0));
const itemsText = items => items.map(i => `${src(i.e)?.name || i.e} ${fmtD(i.d)}`).join(", ");
function cartAdd(e, d) {
  const i = S.cart.findIndex(x => x.e === e);
  if (i < 0) S.cart.push({ e, d });
  else { S.cart[i].d += d; if (S.cart[i].d === 0) S.cart.splice(i, 1); }
}

/* =====================================================================
   Render general
   ===================================================================== */
function render() { renderHeader(); renderMain(); }

function renderHeader() {
  const h = $("#hdr");
  if (S.screen !== "app" || !sessionOk()) { h.innerHTML = ""; return; }
  const pend = pending().length;
  h.innerHTML = `
    <div class="brand"><b>${esc(T.name)}</b><span>${esc(roleOf(S.role).name)}${isK("musico") ? " · " + esc(mus(S.me).name) : ""} · sala ${esc(cleanRoom(S.room))}</span></div>
    ${isK("monitor") ? `<div class="pill ${pend ? "alert" : ""}">Pendientes ${pend}</div>` : ""}
    <span class="dot ${S.online ? "on" : ""}" title="${S.online ? "Conectado" : "Sin conexión"}"></span>
    <button class="icon-btn" data-act="home" aria-label="Bandas y ajustes">⚙</button>`;
}

function renderMain() {
  const m = $("#main");
  if (S.screen === "home") return m.innerHTML = homeView();
  if (S.screen === "join") return m.innerHTML = joinView();
  if (S.screen === "edit") return m.innerHTML = editView();
  const banner = S.tr && S.tr.mode === "local"
    ? `<div class="banner">Modo local: los pedidos solo se ven en este dispositivo. Para conectar al equipo, configura Firebase en config.js (ver README).</div>` : "";
  if (isK("monitor")) { m.innerHTML = banner + monitorShell(); renderMonitor(); }
  else if (isK("none")) m.innerHTML = banner + `<p class="empty">Este rol no participa en la mezcla de músicos. Puedes cambiar de rol con el botón ⚙ si necesitas ayudar.</p>`;
  else { m.innerHTML = banner + panelView(); updatePanel(); renderRecent(); }
}

/* ---------- Inicio: catálogo de bandas ---------- */
function homeView() {
  return `<div class="home">
    <h1>Bandas y plantillas</h1>
    <p class="lead">Elige la banda con la que vas a trabajar, o crea una nueva con sus músicos, canales y staff.</p>
    ${sessionOk() ? `<button class="tool" data-act="back-app">← Volver al panel</button>` : ""}
    <div class="tlist">
    ${LIB.templates.map(t => `<div class="tcard ${t.id === LIB.active ? "act" : ""}">
      <div class="tinfo"><b>${esc(t.name)}</b><small>${t.musicians.length} músicos · ${countChannels(t)} canales · ${t.roles.length} roles${t.id === LIB.active ? " · activa" : ""}</small></div>
      <div class="tbtn">
        <button class="use" data-act="use" data-id="${esc(t.id)}">Usar</button>
        <button class="mini" data-act="edit-t" data-id="${esc(t.id)}">Editar</button>
        <button class="mini" data-act="dup-t" data-id="${esc(t.id)}">Duplicar</button>
        <button class="mini" data-act="exp-t" data-id="${esc(t.id)}">Exportar</button>
        <button class="mini danger" data-act="del-t" data-id="${esc(t.id)}">Eliminar</button>
      </div></div>`).join("")}
    </div>
    <div class="homeact">
      <button class="add" data-act="new-t">+ Nueva banda</button>
      <label class="add" for="imp">Importar archivo (.json)</label>
      <input type="file" id="imp" accept=".json,application/json" hidden>
    </div>
    ${fbUrl() ? `<section class="blk"><h2>Unirme a una sala existente</h2>
      <p class="lead">Si otro equipo ya publicó su plantilla en una sala, escribe el código y la traemos.</p>
      <div class="joinrow"><input class="in" id="jroom" placeholder="Código de sala" autocapitalize="none" autocomplete="off" spellcheck="false">
      <button class="use" data-act="join-room">Buscar</button></div></section>` : ""}
  </div>`;
}

/* ---------- Entrar: sala + rol ---------- */
function joinView() {
  const pick = S.pickRole, me = S.pickMe || (mus(S.me) ? S.me : null);
  const needMe = kindOf(pick) === "musico";
  const ready = pick && (!needMe || me);
  return `<div class="setup">
    <button class="tool" data-act="home">← Bandas</button>
    <h1>${esc(T.name)}</h1>
    <p>Elige tu sala y tu rol</p>
    <div class="field"><label for="room">Código de sala (todo el staff usa el mismo)</label>
      <input class="in" id="room" value="${esc(S.room)}" autocapitalize="none" autocomplete="off" spellcheck="false"></div>
    <div class="field"><label>Tu rol</label><div class="roles">
      ${T.roles.map(r => `<button class="chip ${pick === r.id ? "on" : ""}" data-act="pick-role" data-id="${esc(r.id)}"><b>${esc(r.name)}</b><small>${esc(r.hint)}</small></button>`).join("")}
    </div></div>
    ${needMe ? `<div class="field"><label>¿Quién eres?</label><div class="grid m">
      ${T.musicians.map(x => `<button class="chip ${me === x.id ? "on" : ""}" data-act="pick-me" data-id="${esc(x.id)}"><b>${esc(x.name)}</b><small>${esc(x.role)}</small></button>`).join("")}
    </div></div>` : ""}
    <button class="cta" data-act="enter" ${ready ? "" : "disabled"}>Entrar</button>
  </div>`;
}

/* ---------- Editor de plantilla ---------- */
const ctl = (list, i, j) => {
  const d = `data-list="${list}" data-i="${i}"${j != null ? ` data-j="${j}"` : ""}`;
  return `<span class="ctl"><button data-act="ed-mv" ${d} data-dir="-1" aria-label="Subir">▲</button><button data-act="ed-mv" ${d} data-dir="1" aria-label="Bajar">▼</button><button class="x" data-act="ed-del" ${d} aria-label="Eliminar">✕</button></span>`;
};
const inp = (f, v, ph) => `<input class="in" data-f="${f}" value="${esc(v)}" placeholder="${esc(ph)}" autocomplete="off">`;

function editView() {
  const W = S.edit.W;
  return `<div class="edit">
    <h1>${S.edit.isNew ? "Nueva banda" : "Editar plantilla"}</h1>
    <div class="field"><label>Nombre de la banda</label>${inp("name", W.name, "Ej: Tomo Como Rey")}</div>

    <section class="blk"><h2>Músicos</h2>
      ${W.musicians.map((m, i) => `<div class="erow">${inp(`musicians.${i}.name`, m.name, "Nombre")}${inp(`musicians.${i}.role`, m.role, "Instrumento / voces")}${ctl("musicians", i)}</div>`).join("")}
      <button class="add" data-act="ed-add" data-list="musicians">+ Agregar músico</button>
    </section>

    <section class="blk"><h2>Canales</h2>
      <p class="lead">Lo que se puede subir o bajar en un monitor. Con "＋ sub" un canal se convierte en un menú con subcanales (como la batería).</p>
      ${W.sources.map((s, i) => `<div class="erow">${inp(`sources.${i}.name`, s.name, "Canal")}<button class="mini" data-act="ed-addchild" data-i="${i}">＋ sub</button>${ctl("sources", i)}</div>
        ${(s.children || []).map((c, j) => `<div class="erow child">${inp(`sources.${i}.children.${j}.name`, c.name, "Subcanal")}${ctl("sources", i, j)}</div>`).join("")}`).join("")}
      <button class="add" data-act="ed-add" data-list="sources">+ Agregar canal</button>
    </section>

    <section class="blk"><h2>Staff y roles</h2>
      <p class="lead">Debe haber al menos un rol que reciba pedidos (monitor).</p>
      ${W.roles.map((r, i) => `<div class="erow role">${inp(`roles.${i}.name`, r.name, "Rol")}${inp(`roles.${i}.hint`, r.hint, "Descripción")}
        <select class="in" data-f="roles.${i}.kind" aria-label="Tipo de rol">${KINDS.map(k => `<option value="${k[0]}" ${r.kind === k[0] ? "selected" : ""}>${k[1]}</option>`).join("")}</select>${ctl("roles", i)}</div>`).join("")}
      <button class="add" data-act="ed-add" data-list="roles">+ Agregar rol</button>
    </section>
    <div class="spacer" style="height:90px"></div>
    <div class="dock"><div class="dock-in"><div class="sendrow" style="margin:0">
      <button class="ghost" data-act="ed-cancel">Cancelar</button>
      <button class="send" data-act="ed-save">Guardar</button>
    </div></div></div>
  </div>`;
}

function setPath(o, path, val) {
  const p = path.split("."); let cur = o;
  for (let i = 0; i < p.length - 1; i++) { cur = cur[p[i]]; if (cur == null) return; }
  cur[p[p.length - 1]] = val;
}
function edRerender(focus) {
  const y = window.scrollY;
  $("#main").innerHTML = editView();
  window.scrollTo(0, y);
  if (focus) { const el = document.querySelector(`[data-f="${focus}"]`); if (el) el.focus(); }
}
function edTarget(b) {
  const W = S.edit.W, i = +b.dataset.i, j = b.dataset.j !== undefined ? +b.dataset.j : null;
  return j !== null ? { a: W.sources[i].children, idx: j, parent: W.sources[i] } : { a: W[b.dataset.list], idx: i };
}
function saveEdit() {
  const W = S.edit.W;
  W.name = W.name.trim();
  const bad = [...W.musicians, ...W.roles, ...W.sources, ...W.sources.flatMap(s => s.children || [])].some(x => !x.name.trim());
  if (!W.name) return toast("Falta el nombre de la banda");
  if (!W.musicians.length) return toast("Agrega al menos un músico");
  if (!W.sources.length) return toast("Agrega al menos un canal");
  if (bad) return toast("Hay filas sin nombre");
  if (!W.roles.some(r => r.kind === "monitor")) return toast("Debe haber un rol que reciba pedidos (monitor)");
  W.sources.forEach(s => { if (s.children && !s.children.length) delete s.children; });
  W.rev = Date.now();
  const n = normTpl(W); if (!n) return toast("La plantilla no es válida");
  const i = LIB.templates.findIndex(t => t.id === n.id);
  if (i >= 0) LIB.templates[i] = n; else LIB.templates.push(n);
  if (LIB.active === n.id) T = n;
  saveLib();
  const live = S.tr && sessionOk() && LIB.active === n.id;
  S.edit = null; S.screen = "home"; render();
  if (live) S.tr.publishTpl(n).then(() => toast("Guardado y enviado al equipo")).catch(() => toast("Guardado aquí, pero no se pudo enviar a la sala"));
  else toast("Plantilla guardada en este dispositivo");
}

/* ---------- Panel de pedidos (técnicos y músicos) ---------- */
function elsHtml() {
  const bdg = id => { const c = S.cart.find(i => i.e === id); return c ? `<em class="bdg ${c.d > 0 ? "up" : "down"}">${fmtD(c.d)}</em>` : ""; };
  const on = id => S.sel.e === id ? " on" : "";
  return T.sources.map(x => {
    if (!(x.children && x.children.length)) return `<button class="chip el${on(x.id)}" data-act="sel-e" data-id="${esc(x.id)}"><b>${esc(x.name)}</b>${bdg(x.id)}</button>`;
    const open = S.open === x.id;
    return `<button class="chip el group${on(x.id)}" data-act="sel-e" data-id="${esc(x.id)}" aria-expanded="${open}"><b>${esc(x.name)}</b>${bdg(x.id)}<small>${open ? "Ocultar canales ▴" : "Ver canales ▾"}</small></button>`
      + (open ? `<div class="subgrid">${x.children.map(c => `<button class="chip el${on(c.id)}" data-act="sel-e" data-id="${esc(c.id)}"><b>${esc(c.name)}</b>${bdg(c.id)}</button>`).join("")}</div>` : "");
  }).join("");
}

function panelView() {
  const personal = isK("musico");
  return `
  ${personal ? `<p class="empty" style="padding:0 0 12px">Pedidos para tu monitor, ${esc(mus(S.me).name)}. Puedes juntar varios cambios y enviarlos en un solo pedido.</p>` : `
  <section class="step"><h2><i>1</i> Músico</h2><div class="grid m">
    ${T.musicians.map(x => `<button class="chip" data-act="sel-m" data-id="${esc(x.id)}"><b>${esc(x.name)}</b><small>${esc(x.role)}</small></button>`).join("")}
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
  $("#cart").innerHTML = S.cart.map(i => `<button class="ci ${i.d > 0 ? "up" : "down"}" data-act="rm" data-id="${esc(i.e)}" aria-label="Quitar ${esc(src(i.e).name)}">${esc(src(i.e).name)} ${fmtD(i.d)} ✕</button>`).join("");
  const bar = $("#selbar"), who = isK("musico") || !S.sel.m ? "" : esc(mus(S.sel.m).name) + " · ";
  if (S.sentMsg) bar.innerHTML = `<span class="sent">${esc(S.sentMsg)}</span>`;
  else if (!S.sel.m) bar.innerHTML = `<span>Elige un músico</span>`;
  else if (S.sel.e) bar.innerHTML = `<b>${who}${esc(src(S.sel.e).name)}</b><span>Toca − o +</span>`;
  else bar.innerHTML = `<span>${S.cart.length ? who + "agrega más elementos o envía" : who + "elige un elemento"}</span>`;
}

function renderRecent() {
  const ul = $("#recent"); if (!ul) return;
  const mine = entries().filter(r => isK("musico") ? (kindOf(r.from) === "musico" && r.m === S.me) : r.from === S.role).sort((a, b) => b.t - a.t).slice(0, 4);
  ul.innerHTML = mine.length ? mine.map(r => `<li><span>${esc(mus(r.m)?.name || r.m)} · ${esc(itemsText(r.items))}</span>
    <span class="${r.done ? "ok" : "wait"}">${r.done ? "Hecho" : "Pendiente"}</span></li>`).join("")
    : `<li><span class="empty" style="padding:0">Aún no has enviado pedidos.</span></li>`;
}

/* ---------- Vista del monitorista ---------- */
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
    const from = kindOf(r.from) === "musico" ? "Pedido personal del músico" : (roleOf(r.from)?.name || r.from);
    return `<div class="card2 ${S.seen.has(r.id) ? "" : "fresh"}">
      <div class="top"><div class="who"><b>${esc(mus(r.m)?.name || r.m)}</b><small>${esc(from)} · ${ago(r.t || Date.now())}</small></div>
        <button class="done-btn" data-act="done" data-ids="${esc(r.id)}">Hecho</button></div>
      <ul class="items">${r.items.map((i, n) => { const k = r.id + ":" + n; return `<li><button class="it ${i.d > 0 ? "up" : "down"} ${S.checked.has(k) ? "chk" : ""}" data-act="chk" data-k="${esc(k)}"><span class="amt">${fmtD(i.d)}</span><span>${esc(src(i.e)?.name || i.e)}</span></button></li>`; }).join("")}</ul>
    </div>`;
  }).join("") : `<p class="empty">Sin pedidos pendientes.</p>`;
  const done = entries().filter(r => r.done).sort((a, b) => b.t - a.t).slice(0, 8);
  $("#hist").innerHTML = done.length ? done.map(r => `<li>${esc(mus(r.m)?.name || r.m)} · ${esc(itemsText(r.items))}</li>`).join("") : "<li>Nada aún.</li>";
}

/* =====================================================================
   Flujo
   ===================================================================== */
function onData(map) {
  S.reqs = map;
  const fresh = entries().filter(r => !r.done && !S.seen.has(r.id));
  if (isK("monitor") && S.loaded && fresh.length) { beep(); if (navigator.vibrate) navigator.vibrate([80, 60, 80]); }
  renderHeader();
  if (S.screen === "app") { if (isK("monitor")) renderMonitor(); else renderRecent(); }
  entries().forEach(r => S.seen.add(r.id));
  S.loaded = true;
}

function revalidate() {
  if (S.sel.m && !mus(S.sel.m)) S.sel.m = null;
  if (S.sel.e && !src(S.sel.e)) S.sel.e = null;
  S.cart = S.cart.filter(i => src(i.e));
  if (isK("musico")) S.sel.m = S.me;
}

/* La sala publicó una plantilla distinta: la adoptamos */
function onRemoteTpl(raw) {
  if (S.publishing) return;
  const n = normTpl(raw); if (!n) return;
  if (S.screen === "edit") return;
  if (n.id === T.id) {
    if (n.rev === T.rev) return;
    if (n.rev < T.rev) { if (S.tr) S.tr.publishTpl(T).catch(() => {}); return; }  /* la nuestra es más nueva: la subimos */
  }
  const i = LIB.templates.findIndex(t => t.id === n.id);
  if (i >= 0) LIB.templates[i] = n; else LIB.templates.push(n);
  setActive(n.id);
  if (!sessionOk()) {
    S.role = null; ls.set("role", null); S.pickRole = null; S.screen = "join";
    toast("La sala cambió de plantilla: elige tu rol");
  } else { revalidate(); toast("Plantilla actualizada por el equipo"); }
  render();
}

function start() {
  if (S.tr) S.tr.close();
  S.loaded = false; S.seen = new Set(); S.reqs = {}; S.online = false; S.cart = []; S.sending = false;
  S.tr = makeTransport(S.room, onData, on => { S.online = on; renderHeader(); }, onRemoteTpl);
  revalidate();
  keepAwake();
  render();
}

async function enterApp(publish) {
  S.sel = { m: isK("musico") ? S.me : null, e: null }; S.cart = [];
  if (publish && fbUrl()) {
    S.publishing = true;
    try {
      const rn = normTpl(await fbGetTpl(S.room).catch(() => null));
      if (rn && rn.id === T.id && rn.rev > (T.rev || 0)) {
        const i = LIB.templates.findIndex(t => t.id === rn.id);
        LIB.templates[i] = rn; T = rn; saveLib();
        toast("Se cargó la versión más reciente de la sala");
      } else {
        if (!T.rev) { T.rev = Date.now(); saveLib(); }
        await fbPutTpl(S.room, T);
      }
    } catch { toast("No se pudo publicar la plantilla en la sala"); }
    S.publishing = false;
    if (!sessionOk()) { S.role = null; ls.set("role", null); S.pickRole = null; S.screen = "join"; render(); return; }
  }
  S.screen = "app"; start();
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

function exportTpl(t) {
  const blob = new Blob([JSON.stringify(t, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "banda") + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* =====================================================================
   Eventos
   ===================================================================== */
document.addEventListener("click", e => {
  unlockAudio();
  const b = e.target.closest("[data-act]"); if (!b) return;
  const a = b.dataset.act, id = b.dataset.id;
  switch (a) {
    /* navegación */
    case "home": S.screen = "home"; render(); break;
    case "back-app": S.screen = "app"; render(); break;
    case "use": setActive(id); S.pickRole = roleOf(S.role) ? S.role : null; S.pickMe = null; S.screen = "join"; render(); break;
    case "pick-role": S.pickRole = id; S.room = ($("#room")?.value || S.room); render(); break;
    case "pick-me": S.pickMe = id; S.room = ($("#room")?.value || S.room); render(); break;
    case "enter": {
      if (!S.pickRole) break;
      S.room = ($("#room").value || "").trim() || "tcr"; S.role = S.pickRole;
      if (isK("musico")) S.me = S.pickMe || S.me;
      ls.set("role", S.role); ls.set("room", S.room); ls.set("me", S.me);
      enterApp(true); break;
    }
    case "join-room": {
      const r = ($("#jroom").value || "").trim(); if (!r) return toast("Escribe el código de sala");
      fbGetTpl(r).then(raw => {
        const n = normTpl(raw);
        if (!n) return toast("Esa sala no tiene una plantilla publicada");
        const i = LIB.templates.findIndex(t => t.id === n.id);
        if (i >= 0) LIB.templates[i] = n; else LIB.templates.push(n);
        setActive(n.id); S.room = r; S.pickRole = null; S.pickMe = null; S.screen = "join"; render();
      }).catch(() => toast("No se pudo consultar la sala"));
      break;
    }
    /* catálogo */
    case "new-t": S.edit = { isNew: true, W: blankTemplate() }; S.screen = "edit"; render(); window.scrollTo(0, 0); break;
    case "edit-t": S.edit = { isNew: false, W: clone(LIB.templates.find(t => t.id === id)) }; S.screen = "edit"; render(); window.scrollTo(0, 0); break;
    case "dup-t": {
      const c = clone(LIB.templates.find(t => t.id === id)); c.id = uid("tpl"); c.name = "Copia de " + c.name; c.rev = 0;
      LIB.templates.push(c); saveLib(); render(); toast("Plantilla duplicada"); break;
    }
    case "exp-t": exportTpl(LIB.templates.find(t => t.id === id)); break;
    case "del-t": {
      if (LIB.templates.length < 2) return toast("Debe quedar al menos una banda");
      const t = LIB.templates.find(x => x.id === id);
      if (!confirm(`¿Eliminar "${t.name}"? Esto solo la borra de este dispositivo.`)) break;
      LIB.templates = LIB.templates.filter(x => x.id !== id);
      if (LIB.active === id) { setActive(LIB.templates[0].id); S.role = null; ls.set("role", null); } else saveLib();
      render(); break;
    }
    /* editor */
    case "ed-add": {
      const W = S.edit.W, l = b.dataset.list;
      const item = l === "musicians" ? { id: uid("m"), name: "", role: "" } : l === "sources" ? { id: uid("c"), name: "" } : { id: uid("r"), name: "", hint: "", kind: "tech" };
      W[l].push(item); edRerender(`${l}.${W[l].length - 1}.name`); break;
    }
    case "ed-addchild": {
      const s = S.edit.W.sources[+b.dataset.i]; s.children = s.children || []; s.children.push({ id: uid("c"), name: "" });
      edRerender(`sources.${b.dataset.i}.children.${s.children.length - 1}.name`); break;
    }
    case "ed-del": {
      const { a: list, idx, parent } = edTarget(b);
      if (list[idx].name && !confirm(`¿Quitar "${list[idx].name}"?`)) break;
      list.splice(idx, 1); if (parent && !list.length) delete parent.children;
      edRerender(); break;
    }
    case "ed-mv": {
      const { a: list, idx } = edTarget(b), to = idx + Number(b.dataset.dir);
      if (to < 0 || to >= list.length) break;
      [list[idx], list[to]] = [list[to], list[idx]]; edRerender(); break;
    }
    case "ed-cancel": S.edit = null; S.screen = "home"; render(); break;
    case "ed-save": saveEdit(); break;
    /* panel de pedidos */
    case "sel-m":
      if (S.sel.m && S.sel.m !== id && S.cart.length) { S.cart = []; toast("Pedido vaciado: cambiaste de músico"); }
      S.sel.m = id; updatePanel(); break;
    case "sel-e": {
      const g = T.sources.find(x => x.id === id);
      if (g && g.children && g.children.length) { S.open = (S.open === id && S.sel.e === id) ? null : id; S.sel.e = id; }
      else S.sel.e = id;
      updatePanel(); break;
    }
    case "add": if (S.sel.m && S.sel.e) { cartAdd(S.sel.e, Number(b.dataset.d)); if (navigator.vibrate) navigator.vibrate(15); updatePanel(); } break;
    case "rm": S.cart = S.cart.filter(i => i.e !== id); updatePanel(); break;
    case "clear-cart": S.cart = []; updatePanel(); break;
    case "send": send(); break;
    /* monitor */
    case "done": S.tr.done(b.dataset.ids.split(",")).catch(() => toast("No se pudo marcar como hecho.")); break;
    case "chk": { const k = b.dataset.k; if (S.checked.has(k)) S.checked.delete(k); else S.checked.add(k); renderMonitor(); break; }
    case "sound": S.sound = !S.sound; ls.set("sound", S.sound); renderMain(); if (S.sound) beep(); break;
    case "clear": if (confirm("¿Borrar todos los pedidos de esta sala?")) S.tr.clear().catch(() => toast("No se pudo limpiar.")); break;
  }
});

/* campos del editor */
const onField = e => { const f = e.target.dataset && e.target.dataset.f; if (f && S.edit) setPath(S.edit.W, f, e.target.value); };
document.addEventListener("input", onField);
document.addEventListener("change", onField);

/* importar plantilla */
document.addEventListener("change", e => {
  if (e.target.id !== "imp" || !e.target.files[0]) return;
  const fr = new FileReader();
  fr.onload = () => {
    let n = null; try { n = normTpl(JSON.parse(fr.result)); } catch {}
    if (!n) return toast("El archivo no es una plantilla válida");
    if (LIB.templates.some(t => t.id === n.id)) { n.id = uid("tpl"); n.name += " (importada)"; }
    n.rev = 0; LIB.templates.push(n); saveLib(); render(); toast("Plantilla importada");
  };
  fr.readAsText(e.target.files[0]);
});

setInterval(() => { if (S.screen === "app" && isK("monitor")) renderMonitor(); }, 15000);

/* Inicio */
if (sessionOk()) { S.screen = "app"; enterApp(false); }
else { S.role = null; S.screen = "home"; render(); }
})();
