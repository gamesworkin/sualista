/* ============================================================
   MONTE SEU PENDRIVE OPL — Workin'Store
   ============================================================
   >>> PREENCHA AS CREDENCIAIS DO FIREBASE ABAIXO <<<
   Crie um projeto em https://console.firebase.google.com
   Ative: Authentication (Email/Password) e Realtime Database.
   Cadastre o usuário admin@admin.com em Authentication > Users.
   ============================================================ */
const FIREBASE_CONFIG = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "0000000000",
  appId: "SEU_APP_ID"
};

// Config do WhatsApp de suporte
const WHATSAPP_NUMBER = "5588988470190";
// Único e-mail com privilégios de admin
const ADMIN_EMAIL = "admin@admin.com";
// Jogos por página
const PAGE_SIZE = 30;

/* ============================================================
   INICIALIZAÇÃO FIREBASE
   ============================================================ */
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.database();

/* ============================================================
   ESTADO GLOBAL
   ============================================================ */
const state = {
  games: {},       // { id: game }
  categories: {},  // extraídas
  capacities: { 32: 29.5, 64: 59, 128: 118 }, // defaults reais
  selected: {},    // { id: game }
  capacity: 32,
  page: 1,
  query: "",
  category: "",
  sort: "az",
  userInfo: null,
  editingGameId: null,
  editingCoverBase64: null,
  isAdmin: false
};

/* ============================================================
   HELPERS
   ============================================================ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const OPL_RESERVED = 0.5;
function totalCapacity() {
  const real = Number(state.capacities[state.capacity]) || state.capacity;
  return Math.max(0, real - OPL_RESERVED);
}
function usedGb() {
  return Object.values(state.selected).reduce((s, g) => s + Number(g.size_gb || 0), 0);
}
function openModal(id) { $("#" + id).classList.remove("hidden"); }
function closeModal(id) { $("#" + id).classList.add("hidden"); }
document.addEventListener("click", (e) => {
  if (e.target.matches("[data-close]") || e.target.classList.contains("modal-close")) {
    const modal = e.target.closest(".modal");
    if (modal) modal.classList.add("hidden");
  }
});

/* ============================================================
   AUTENTICAÇÃO
   ============================================================ */
auth.onAuthStateChanged((user) => {
  const isAdmin = user && user.email === ADMIN_EMAIL;
  state.isAdmin = !!isAdmin;
  document.body.classList.toggle("is-admin", !!isAdmin);
  if (isAdmin) {
    loadAdminGames();
    loadAdminLists();
  }
});

$("#btn-admin-login").addEventListener("click", () => openModal("modal-login"));
$("#btn-admin-logout").addEventListener("click", () => auth.signOut());
$("#btn-admin-panel").addEventListener("click", () => openModal("modal-admin"));

$("#btn-login").addEventListener("click", async () => {
  const email = $("#login-email").value.trim();
  const pass = $("#login-pass").value;
  const err = $("#login-err");
  err.classList.add("hidden");
  if (email !== ADMIN_EMAIL) {
    err.textContent = "Apenas admin@admin.com pode acessar o painel.";
    err.classList.remove("hidden"); return;
  }
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    closeModal("modal-login");
  } catch (e) {
    err.textContent = "Falha no login: " + e.message;
    err.classList.remove("hidden");
  }
});

/* ============================================================
   CARREGAR DADOS DO REALTIME DB
   ============================================================ */
db.ref("games").on("value", (snap) => {
  state.games = snap.val() || {};
  // extrair categorias
  const cats = new Set();
  Object.values(state.games).forEach((g) => { if (g.category) cats.add(g.category); });
  state.categories = [...cats].sort();
  refreshCatalog();
  refreshFilterCats();
  refreshAdminGames();
});

db.ref("capacities").on("value", (snap) => {
  const v = snap.val();
  if (v) state.capacities = { ...state.capacities, ...v };
  fillCapacityInputs();
  refreshStorage();
});

db.ref("lists").on("value", (snap) => {
  state.lists = snap.val() || {};
  if (state.isAdmin) loadAdminLists();
});

/* ============================================================
   CATÁLOGO / FILTROS / PAGINAÇÃO
   ============================================================ */
$("#search").addEventListener("input", (e) => { state.query = e.target.value.toLowerCase(); state.page = 1; refreshCatalog(); });
$("#filter-cat").addEventListener("change", (e) => { state.category = e.target.value; state.page = 1; refreshCatalog(); });
$("#sort-mode").addEventListener("change", (e) => { state.sort = e.target.value; refreshCatalog(); });
$("#prev-page").addEventListener("click", () => { if (state.page > 1) { state.page--; refreshCatalog(); window.scrollTo({top:0, behavior:'smooth'}); } });
$("#next-page").addEventListener("click", () => { state.page++; refreshCatalog(); window.scrollTo({top:0, behavior:'smooth'}); });

function refreshFilterCats() {
  const sel = $("#filter-cat");
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todas as categorias</option>' +
    state.categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  sel.value = cur;
  const dl = $("#cat-list");
  dl.innerHTML = state.categories.map((c) => `<option value="${escapeHtml(c)}">`).join("");
}

function filterAndSort() {
  let list = Object.entries(state.games).map(([id, g]) => ({ id, ...g }));
  if (state.query) {
    list = list.filter((g) =>
      (g.name || "").toLowerCase().includes(state.query) ||
      (g.serial_code || "").toLowerCase().includes(state.query)
    );
  }
  if (state.category) list = list.filter((g) => g.category === state.category);
  switch (state.sort) {
    case "az": list.sort((a, b) => (a.name || "").localeCompare(b.name || "")); break;
    case "za": list.sort((a, b) => (b.name || "").localeCompare(a.name || "")); break;
    case "size-asc": list.sort((a, b) => (a.size_gb || 0) - (b.size_gb || 0)); break;
    case "size-desc": list.sort((a, b) => (b.size_gb || 0) - (a.size_gb || 0)); break;
  }
  return list;
}

function refreshCatalog() {
  const all = filterAndSort();
  $("#game-total").textContent = Object.keys(state.games).length;
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;
  const start = (state.page - 1) * PAGE_SIZE;
  const pageItems = all.slice(start, start + PAGE_SIZE);

  const container = $("#catalog");
  container.innerHTML = pageItems.map((g) => {
    const sel = !!state.selected[g.id];
    const cover = g.cover_base64
      ? `<img class="game-cover" src="${g.cover_base64}" alt="${escapeHtml(g.name)}" />`
      : `<div class="game-cover placeholder">🎮</div>`;
    return `
      <div class="game-card ${sel ? 'selected' : ''}" data-id="${g.id}">
        ${cover}
        <div class="game-body">
          <p class="game-name">${escapeHtml(g.name || '')}</p>
          <div class="game-meta">
            <span>${escapeHtml(g.serial_code || '')}</span>
            <span>${Number(g.size_gb || 0).toFixed(2)} GB</span>
          </div>
        </div>
      </div>`;
  }).join("") || `<p class="muted" style="grid-column:1/-1;text-align:center;padding:40px 0;">Nenhum jogo encontrado.</p>`;

  container.querySelectorAll(".game-card").forEach((el) => {
    el.addEventListener("click", () => toggleSelect(el.dataset.id));
  });

  $("#page-info").textContent = `Página ${state.page} de ${totalPages}`;
  $("#prev-page").disabled = state.page <= 1;
  $("#next-page").disabled = state.page >= totalPages;
}

/* ============================================================
   SELEÇÃO
   ============================================================ */
function toggleSelect(id) {
  const g = state.games[id];
  if (!g) return;
  if (state.selected[id]) delete state.selected[id];
  else state.selected[id] = { id, ...g };
  refreshCatalog();
  refreshStorage();
}
$("#btn-clear-sel").addEventListener("click", () => { state.selected = {}; refreshCatalog(); refreshStorage(); });
$("#btn-view-sel").addEventListener("click", () => showSelectionModal());

function showSelectionModal() {
  const list = Object.values(state.selected);
  const ol = $("#sel-list");
  ol.innerHTML = list.length ? list.map((g, i) => `
    <li>
      <span>${i + 1}</span>
      <div><b>${escapeHtml(g.name)}</b><br/><small style="color:#8892b0">${escapeHtml(g.serial_code || '')}</small></div>
      <span>${Number(g.size_gb).toFixed(2)}GB</span>
      <button data-remove="${g.id}">✕</button>
    </li>`).join("") : `<p class="muted">Nenhum jogo selecionado.</p>`;
  ol.querySelectorAll("[data-remove]").forEach((b) => {
    b.addEventListener("click", () => { delete state.selected[b.dataset.remove]; refreshCatalog(); refreshStorage(); showSelectionModal(); });
  });
  openModal("modal-selection");
}

/* ============================================================
   CAPACIDADE / STORAGE
   ============================================================ */
$$("#cap-buttons .cap-btn").forEach((b) => {
  b.addEventListener("click", () => {
    state.capacity = Number(b.dataset.cap);
    $$("#cap-buttons .cap-btn").forEach((x) => x.classList.toggle("active", x === b));
    refreshStorage();
  });
});

function refreshStorage() {
  const used = usedGb();
  const total = totalCapacity();
  const rem = Math.max(0, total - used);
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const over = used > total;
  const count = Object.keys(state.selected).length;

  $("#sel-count").textContent = `${count} ${count === 1 ? 'jogo selecionado' : 'jogos selecionados'}`;
  $("#used-gb").textContent = used.toFixed(2) + " GB";
  $("#rem-gb").textContent = rem.toFixed(2) + " GB";
  $("#tot-gb").textContent = total.toFixed(2) + " GB";
  $("#progress-bar").style.width = pct + "%";
  $("#progress-bar").classList.toggle("over", over);
  $("#over-msg").classList.toggle("hidden", !over);

  $("#sel-badge").textContent = count;
  $("#sel-title").textContent = count ? "Sua seleção" : "Nenhum jogo selecionado";
  $("#sel-sub").textContent = `${used.toFixed(2)} GB usados · ${rem.toFixed(2)} GB restantes`;
}

function fillCapacityInputs() {
  $("#real-32").value = state.capacities[32];
  $("#real-64").value = state.capacities[64];
  $("#real-128").value = state.capacities[128];
}
$("#btn-save-caps").addEventListener("click", async () => {
  const v = {
    32: Number($("#real-32").value),
    64: Number($("#real-64").value),
    128: Number($("#real-128").value)
  };
  await db.ref("capacities").set(v);
  alert("Capacidades salvas.");
});

/* ============================================================
   ENVIO DA LISTA — Dados do cliente + validação
   ============================================================ */
$("#btn-send-list").addEventListener("click", () => tryOpenSendFlow());

function tryOpenSendFlow() {
  const count = Object.keys(state.selected).length;
  if (!count) { alert("Selecione ao menos um jogo."); return; }
  if (usedGb() > totalCapacity()) {
    alert("Sua seleção ultrapassa a capacidade do pendrive. Remova alguns jogos.");
    return;
  }
  // se já temos dados, pula para modal de envio
  if (state.userInfo) openSendModal();
  else openModal("modal-userinfo");
}
$("#btn-open-send").addEventListener("click", () => { closeModal("modal-selection"); tryOpenSendFlow(); });

$("#btn-userinfo-continue").addEventListener("click", () => {
  const nome = $("#u-nome").value.trim();
  const sobrenome = $("#u-sobrenome").value.trim();
  const whatsapp = $("#u-whatsapp").value.trim();
  const cidade = $("#u-cidade").value.trim();
  const uf = $("#u-uf").value.trim().toUpperCase();
  const err = $("#userinfo-err");
  if (!nome || !sobrenome || !whatsapp || !cidade || !uf) {
    err.textContent = "Preencha todos os campos obrigatórios.";
    err.classList.remove("hidden"); return;
  }
  if (uf.length !== 2) {
    err.textContent = "UF deve ter 2 letras."; err.classList.remove("hidden"); return;
  }
  err.classList.add("hidden");
  state.userInfo = { nome, sobrenome, whatsapp, cidade, uf };
  closeModal("modal-userinfo");
  openSendModal();
});

function buildListText() {
  const u = state.userInfo || {};
  const list = Object.values(state.selected);
  const header =
`=== LISTA DE JOGOS - PENDRIVE OPL ${state.capacity}GB ===
Cliente: ${u.nome} ${u.sobrenome}
WhatsApp: ${u.whatsapp}
Cidade: ${u.cidade}/${u.uf}
Data: ${new Date().toLocaleString('pt-BR')}
======================================
`;
  const body = list.map((g, i) => `${String(i+1).padStart(2,"0")}. ${g.name} [${g.serial_code}] - ${Number(g.size_gb).toFixed(2)}GB`).join("\n");
  const footer = `\n\nTotal: ${list.length} jogos | ${usedGb().toFixed(2)}GB / ${totalCapacity().toFixed(2)}GB`;
  return header + body + footer;
}

function openSendModal() {
  $("#list-preview").textContent = buildListText();
  // salvar lista no realtime db
  saveListToDb();
  openModal("modal-send");
}

async function saveListToDb() {
  const payload = {
    userInfo: state.userInfo,
    capacity: state.capacity,
    usedGb: Number(usedGb().toFixed(2)),
    totalGb: Number(totalCapacity().toFixed(2)),
    games: Object.values(state.selected).map((g) => ({
      id: g.id, name: g.name, serial_code: g.serial_code || "", size_gb: g.size_gb
    })),
    status: "pending",
    createdAt: Date.now()
  };
  try { await db.ref("lists").push(payload); } catch(e) { console.warn("Falha ao salvar lista:", e); }
}

$("#btn-copy-text").addEventListener("click", async () => {
  await navigator.clipboard.writeText(buildListText());
  alert("Lista copiada!");
});

$("#btn-send-wa-text").addEventListener("click", () => {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildListText())}`;
  window.open(url, "_blank");
});

$("#btn-download-jpg").addEventListener("click", async () => {
  const dataUrl = await renderListToJpg();
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `pendrive-${state.capacity}gb-${Date.now()}.jpg`;
  a.click();
});

$("#btn-send-wa-jpg").addEventListener("click", async () => {
  await renderListToJpg(); // gera e baixa
  const msg = `Olá! Segue minha lista de jogos (JPG em anexo).\n\n${buildListText()}`;
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  // WhatsApp Web não aceita anexos via URL. Baixamos o JPG e o cliente anexa manualmente.
  const dataUrl = await renderListToJpg();
  const a = document.createElement("a");
  a.href = dataUrl; a.download = `pendrive-${state.capacity}gb.jpg`; a.click();
  setTimeout(() => window.open(url, "_blank"), 500);
});

async function renderListToJpg(userInfoOverride, gamesOverride, capacityOverride) {
  const u = userInfoOverride || state.userInfo || {};
  const list = gamesOverride || Object.values(state.selected);
  const cap = capacityOverride || state.capacity;
  const sheet = document.createElement("div");
  sheet.className = "jpg-sheet";
  sheet.innerHTML = `
    <h1>Monte seu Pendrive OPL - ${cap}GB</h1>
    <div class="client-info">
      <p><b>Cliente:</b> ${escapeHtml(u.nome || '')} ${escapeHtml(u.sobrenome || '')}</p>
      <p><b>WhatsApp:</b> ${escapeHtml(u.whatsapp || '')}</p>
      <p><b>Cidade/UF:</b> ${escapeHtml(u.cidade || '')}/${escapeHtml(u.uf || '')}</p>
      <p><b>Data:</b> ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    <ol>
      ${list.map((g) => `<li>${escapeHtml(g.name)} <b>[${escapeHtml(g.serial_code || '')}]</b> — ${Number(g.size_gb).toFixed(2)}GB</li>`).join("")}
    </ol>
    <div class="jpg-footer">Total: ${list.length} jogos · Workin'Store</div>
  `;
  const area = $("#jpg-render-area");
  area.innerHTML = ""; area.appendChild(sheet);
  const canvas = await html2canvas(sheet, { backgroundColor: "#0f1424", scale: 2 });
  return canvas.toDataURL("image/jpeg", 0.92);
}

/* ============================================================
   ADMIN — TABS
   ============================================================ */
$$(".tab-btn").forEach((b) => {
  b.addEventListener("click", () => {
    $$(".tab-btn").forEach((x) => x.classList.toggle("active", x === b));
    $$(".tab-panel").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== b.dataset.tab));
  });
});

/* ============================================================
   ADMIN — JOGOS
   ============================================================ */
$("#admin-search").addEventListener("input", () => refreshAdminGames());
$("#btn-new-game").addEventListener("click", () => openGameEdit(null));

function loadAdminGames() { refreshAdminGames(); }
function refreshAdminGames() {
  if (!state.isAdmin) return;
  const q = ($("#admin-search")?.value || "").toLowerCase();
  const list = Object.entries(state.games).map(([id, g]) => ({ id, ...g }))
    .filter((g) => !q || (g.name || "").toLowerCase().includes(q) || (g.serial_code || "").toLowerCase().includes(q))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const el = $("#admin-games-list");
  if (!el) return;
  el.innerHTML = list.map((g) => `
    <div class="admin-row">
      <div class="admin-row-main">
        <b>${escapeHtml(g.name)}</b>
        <span>${escapeHtml(g.serial_code || '')} · ${escapeHtml(g.category || 'sem categoria')} · ${Number(g.size_gb || 0).toFixed(2)}GB</span>
      </div>
      <div class="admin-row-actions">
        <button class="btn btn-ghost" data-edit="${g.id}">Editar</button>
        <button class="btn btn-danger" data-del="${g.id}">Excluir</button>
      </div>
    </div>`).join("") || `<p class="muted">Nenhum jogo cadastrado.</p>`;
  el.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openGameEdit(b.dataset.edit)));
  el.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
    if (confirm("Excluir este jogo?")) await db.ref("games/" + b.dataset.del).remove();
  }));
}

function openGameEdit(id) {
  state.editingGameId = id;
  state.editingCoverBase64 = null;
  const g = id ? state.games[id] : {};
  $("#ge-title").textContent = id ? "Editar jogo" : "Novo jogo";
  $("#ge-name").value = g.name || "";
  $("#ge-code").value = g.serial_code || "";
  $("#ge-category").value = g.category || "";
  $("#ge-region").value = g.region || "";
  $("#ge-size").value = g.size_gb || "";
  $("#ge-cover").value = "";
  $("#ge-preview").innerHTML = g.cover_base64 ? `<img src="${g.cover_base64}" />` : "";
  $("#btn-delete-game").style.display = id ? "" : "none";
  openModal("modal-game-edit");
}

$("#ge-cover").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const b64 = await fileToBase64(f, 400);
  state.editingCoverBase64 = b64;
  $("#ge-preview").innerHTML = `<img src="${b64}" />`;
});

$("#btn-save-game").addEventListener("click", async () => {
  const payload = {
    name: $("#ge-name").value.trim(),
    serial_code: $("#ge-code").value.trim(),
    category: $("#ge-category").value.trim(),
    region: $("#ge-region").value.trim(),
    size_gb: Number($("#ge-size").value) || 0
  };
  const err = $("#ge-err");
  if (!payload.name || !payload.serial_code) {
    err.textContent = "Nome e código são obrigatórios."; err.classList.remove("hidden"); return;
  }
  err.classList.add("hidden");
  if (state.editingCoverBase64) payload.cover_base64 = state.editingCoverBase64;
  else if (state.editingGameId && state.games[state.editingGameId]?.cover_base64) {
    payload.cover_base64 = state.games[state.editingGameId].cover_base64;
  }
  if (state.editingGameId) await db.ref("games/" + state.editingGameId).update(payload);
  else await db.ref("games").push(payload);
  closeModal("modal-game-edit");
});

$("#btn-delete-game").addEventListener("click", async () => {
  if (state.editingGameId && confirm("Excluir este jogo?")) {
    await db.ref("games/" + state.editingGameId).remove();
    closeModal("modal-game-edit");
  }
});

/* ============================================================
   ADMIN — IMPORTAR CSV
   Formato: name,serial_code,category,region,size_gb
   ============================================================ */
$("#csv-file").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  const text = await f.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(",").map((s) => s.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);
  let count = 0;
  const updates = {};
  for (const line of lines) {
    const cols = parseCsvLine(line);
    const key = db.ref("games").push().key;
    updates["games/" + key] = {
      name: cols[idx("name")] || "",
      serial_code: cols[idx("serial_code")] || "",
      category: cols[idx("category")] || "",
      region: cols[idx("region")] || "",
      size_gb: Number(cols[idx("size_gb")]) || 0
    };
    count++;
  }
  await db.ref().update(updates);
  alert(`${count} jogos importados.`);
  e.target.value = "";
});

function parseCsvLine(line) {
  const out = []; let cur = ""; let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/* ============================================================
   ADMIN — LISTAS DE CLIENTES
   ============================================================ */
function loadAdminLists() {
  if (!state.isAdmin) return;
  const el = $("#admin-lists"); if (!el) return;
  const lists = state.lists || {};
  const entries = Object.entries(lists).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
  el.innerHTML = entries.map(([id, l]) => {
    const u = l.userInfo || {};
    const statusColor = l.status === "done" ? "#22c55e" : "#4dabff";
    return `
      <div class="admin-row">
        <div class="admin-row-main">
          <b>${escapeHtml(u.nome || '')} ${escapeHtml(u.sobrenome || '')}</b>
          <span>${escapeHtml(u.whatsapp || '')} · ${escapeHtml(u.cidade || '')}/${escapeHtml(u.uf || '')}</span>
          <span>${l.games?.length || 0} jogos · ${Number(l.usedGb || 0).toFixed(2)}GB / ${l.capacity}GB · ${new Date(l.createdAt).toLocaleString('pt-BR')}</span>
          <span style="color:${statusColor}"><b>${l.status === 'done' ? 'FINALIZADA' : 'Pendente'}</b></span>
        </div>
        <div class="admin-row-actions">
          <button class="btn btn-ghost" data-jpg="${id}">Baixar JPG</button>
          <button class="btn btn-success" data-done="${id}">Encomenda finalizada</button>
          <button class="btn btn-danger" data-del="${id}">Finalizar e excluir</button>
        </div>
      </div>`;
  }).join("") || `<p class="muted">Nenhuma lista recebida ainda.</p>`;

  el.querySelectorAll("[data-jpg]").forEach((b) => b.addEventListener("click", async () => {
    const l = state.lists[b.dataset.jpg];
    const dataUrl = await renderListToJpg(l.userInfo, l.games, l.capacity);
    const a = document.createElement("a");
    a.href = dataUrl; a.download = `lista-${l.userInfo?.nome || 'cliente'}.jpg`; a.click();
  }));
  el.querySelectorAll("[data-done]").forEach((b) => b.addEventListener("click", async () => {
    await db.ref("lists/" + b.dataset.done + "/status").set("done");
  }));
  el.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
    if (confirm("Finalizar e excluir esta lista?")) await db.ref("lists/" + b.dataset.del).remove();
  }));
}

/* ============================================================
   UTIL
   ============================================================ */
function escapeHtml(s) { return String(s || "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

function fileToBase64(file, maxWidth) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // redimensionar para reduzir tamanho no realtime DB
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* init */
fillCapacityInputs();
refreshStorage();
