/* =========================================================
 * CATÁLOGO RETRO - script.js
 * Firebase Authentication + Realtime Database
 * Estrutura modular via IIFE / módulos internos
 * ========================================================= */

/* -------- CONFIGURAÇÃO FIREBASE --------
 * Substitua os valores abaixo pelos do seu projeto Firebase.
 * Console: https://console.firebase.google.com
 * Passos:
 *   1. Criar projeto Firebase.
 *   2. Ativar Authentication -> Email/Senha.
 *   3. Criar usuário admin@admin.com.
 *   4. Ativar Realtime Database (modo bloqueado).
 *   5. Colar as regras recomendadas (veja README).
 *   6. Colar aqui as credenciais do "Web App".
 */
const firebaseConfig = {
  apiKey: "AIzaSyBvdW06QiHlJA5glUKtucX6hL8LdvlTPME",
  authDomain: "sua-lista-e6ef3.firebaseapp.com",
  databaseURL: "https://sua-lista-e6ef3-default-rtdb.firebaseio.com",
  projectId: "sua-lista-e6ef3",
  storageBucket: "sua-lista-e6ef3.firebasestorage.app",
  messagingSenderId: "689656568290",
  appId: "1:689656568290:web:8f82257c9bb23f8b1481bb"
};

/* Constantes globais */
const ADMIN_EMAIL = "admin@admin.com";
const GAMES_PER_PAGE = 30;

/* Inicialização Firebase */
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

/* =========================================================
 * ESTADO GLOBAL
 * ========================================================= */
const state = {
  games: [],
  categories: [],
  subcategories: [],
  pendrives: [],
  orders: [],
  settings: {},
  cart: [],
  selectedPendriveId: null,
  filters: { search: "", category: "", subcategory: "", sort: "alpha" },
  currentPage: 1,
  isAdmin: false,
};

/* =========================================================
 * UTIL - Funções auxiliares
 * ========================================================= */

/** Seletor curto */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Exibe toast */
function toast(msg, type = "") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2800);
}

/** Formata número (2 casas) */
const fmt = (n) => Number(n || 0).toFixed(2);

/** Gera ID único simples */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Escapa HTML */
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Data/hora atual formatada */
function nowParts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    iso: d.toISOString(),
  };
}

/** Abre/fecha modal */
function openModal(id) { $("#" + id).classList.remove("hidden"); }
function closeModal(id) { $("#" + id).classList.add("hidden"); }

/* =========================================================
 * FIREBASE DATA LAYER
 * ========================================================= */

/** Cria dados padrão caso não existam ainda no DB */
async function ensureDefaults() {
  const snap = await db.ref("pendrives").once("value");
  if (!snap.exists()) {
    const defaults = {
      p32: { id: "p32", name: "32 GB", capacity: 29.20, order: 1 },
      p64: { id: "p64", name: "64 GB", capacity: 58.90, order: 2 },
      p128: { id: "p128", name: "128 GB", capacity: 116.40, order: 3 },
    };
    await db.ref("pendrives").set(defaults);
  }

  const sSnap = await db.ref("settings").once("value");
  if (!sSnap.exists()) {
    await db.ref("settings").set({
      siteTitle: "Catálogo Retro",
      siteName: "Catálogo Retro",
      logoUrl: "",
      faviconUrl: "",
      primaryColor: "#00b3ff",
      secondaryColor: "#8a2be2",
      backgroundUrl: "",
      footerText: "© Catálogo Retro - Todos os direitos reservados",
      whatsappNumber: "5588988470190",
      whatsappMessage: "Olá! Segue minha lista de jogos.",
      jpgMessage: "Obrigado por escolher o Catálogo Retro!",
    });
  }
}

/** Escuta em tempo real: aplica callback ao receber snapshot */
function listenList(path, key) {
  db.ref(path).on("value", (snap) => {
    const val = snap.val() || {};
    state[key] = Object.values(val);
    onDataChange(key);
  });
}

/** Callback quando muda uma coleção */
function onDataChange(key) {
  if (key === "settings") applySettings();
  if (key === "pendrives") { buildPendriveSelect(); updatePendriveBar(); }
  if (["games", "categories", "subcategories"].includes(key)) {
    buildFilterOptions();
    renderCatalog();
  }
  if (state.isAdmin) renderCurrentAdminView();
}

/** Listener especial para settings (não é lista) */
function listenSettings() {
  db.ref("settings").on("value", (snap) => {
    state.settings = snap.val() || {};
    applySettings();
    if (state.isAdmin) renderCurrentAdminView();
  });
}

/** Listener orders */
function listenOrders() {
  db.ref("orders").on("value", (snap) => {
    const val = snap.val() || {};
    state.orders = Object.values(val);
    if (state.isAdmin) renderCurrentAdminView();
  });
}

/* =========================================================
 * SETTINGS -> UI
 * ========================================================= */

/** Aplica configurações visuais dinâmicas */
function applySettings() {
  const s = state.settings || {};
  if (s.siteTitle) {
    document.title = s.siteTitle;
    $("#siteTitle").textContent = s.siteTitle;
  }
  if (s.logoUrl) $("#siteLogo").src = s.logoUrl;
  if (s.faviconUrl) $("#faviconLink").href = s.faviconUrl;
  if (s.footerText) $("#footerText").textContent = s.footerText;
  if (s.primaryColor) document.documentElement.style.setProperty("--primary", s.primaryColor);
  if (s.secondaryColor) document.documentElement.style.setProperty("--secondary", s.secondaryColor);
  if (s.backgroundUrl) {
    document.body.style.backgroundImage =
      `linear-gradient(rgba(5,6,13,.85), rgba(5,6,13,.85)), url("${s.backgroundUrl}")`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundAttachment = "fixed";
  }
}

/* =========================================================
 * CATÁLOGO PÚBLICO
 * ========================================================= */

/** Constrói select + botões de pendrives (botões usados no mobile) */
function buildPendriveSelect() {
  const sel = $("#pendriveSelect");
  const btnWrap = $("#pendriveButtons");
  const list = [...state.pendrives].sort((a, b) => (a.order || 0) - (b.order || 0));

  // <select> (desktop)
  sel.innerHTML = list.map((p) =>
    `<option value="${p.id}">${esc(p.name)} — ${fmt(p.capacity)} GB</option>`
  ).join("");

  if (list.length && !state.selectedPendriveId) {
    state.selectedPendriveId = list[0].id;
  }
  if (state.selectedPendriveId) sel.value = state.selectedPendriveId;

  // Botões (mobile)
  if (btnWrap) {
    btnWrap.innerHTML = list.map((p) => `
      <button type="button" data-pendrive-btn="${p.id}"
        class="${p.id === state.selectedPendriveId ? "active" : ""}"
        aria-pressed="${p.id === state.selectedPendriveId}">
        ${esc(p.name)}
      </button>
    `).join("");
    btnWrap.querySelectorAll("button[data-pendrive-btn]").forEach((b) => {
      b.addEventListener("click", () => {
        state.selectedPendriveId = b.dataset.pendriveBtn;
        sel.value = state.selectedPendriveId;
        // Atualiza estados visuais dos botões
        btnWrap.querySelectorAll("button[data-pendrive-btn]").forEach((x) => {
          const on = x.dataset.pendriveBtn === state.selectedPendriveId;
          x.classList.toggle("active", on);
          x.setAttribute("aria-pressed", on ? "true" : "false");
        });
        updatePendriveBar();
        renderCart();
      });
    });
  }
}

/** Constrói filtros de categoria/subcategoria */
function buildFilterOptions() {
  const cats = [...state.categories].sort((a, b) => (a.order || 0) - (b.order || 0));
  $("#categoryFilter").innerHTML =
    `<option value="">Todas categorias</option>` +
    cats.map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");

  const subs = [...state.subcategories].sort((a, b) => (a.order || 0) - (b.order || 0));
  $("#subcategoryFilter").innerHTML =
    `<option value="">Todas subcategorias</option>` +
    subs.map((s) => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join("");
}

/** Retorna lista de jogos após filtros/pesquisa/ordenação */
function getFilteredGames() {
  const { search, category, subcategory, sort } = state.filters;
  let arr = state.games.slice();

  if (category) arr = arr.filter((g) => g.category === category);
  if (subcategory) arr = arr.filter((g) => g.subcategory === subcategory);
  if (search) {
    const q = search.toLowerCase();
    arr = arr.filter((g) =>
      (g.name || "").toLowerCase().includes(q) ||
      (g.category || "").toLowerCase().includes(q) ||
      (g.subcategory || "").toLowerCase().includes(q)
    );
  }
  if (sort === "alpha") arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  if (sort === "light") arr.sort((a, b) => (a.size || 0) - (b.size || 0));
  if (sort === "heavy") arr.sort((a, b) => (b.size || 0) - (a.size || 0));
  return arr;
}

/** Renderiza catálogo */
function renderCatalog() {
  const wrap = $("#gamesGrid");
  const all = getFilteredGames();
  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / GAMES_PER_PAGE));
  if (state.currentPage > pages) state.currentPage = 1;
  const start = (state.currentPage - 1) * GAMES_PER_PAGE;
  const items = all.slice(start, start + GAMES_PER_PAGE);

  $("#emptyState").classList.toggle("hidden", total > 0);

  wrap.innerHTML = items.map((g) => {
    const inList = state.cart.some((c) => c.id === g.id);
    return `
      <div class="game-card ${inList ? "in-list" : ""}" data-id="${g.id}">
        <div class="thumb"><img loading="lazy" src="${esc(g.image || "")}" alt="${esc(g.name)}" onerror="this.style.opacity=.15"/></div>
        <div class="info">
          <h3>${esc(g.name)}</h3>
          <div class="meta">
            <span>${esc(g.category || "")}</span>
            <span>${fmt(g.size)} GB</span>
          </div>
        </div>
        <button class="add" title="Adicionar" data-add="${g.id}"><i class="fa-solid fa-plus"></i></button>
      </div>
    `;
  }).join("");

  renderPagination(pages);
}

/** Paginação */
function renderPagination(pages) {
  const p = $("#pagination");
  if (pages <= 1) { p.innerHTML = ""; return; }
  const cur = state.currentPage;
  const btn = (label, page, opts = {}) =>
    `<button ${opts.disabled ? "disabled" : ""} ${opts.active ? 'class="active"' : ""} data-page="${page}">${label}</button>`;
  let html = btn(`<i class="fa-solid fa-chevron-left"></i>`, cur - 1, { disabled: cur === 1 });
  const range = [];
  const push = (n) => range.push(n);
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - cur) <= 2) push(i);
    else if (range[range.length - 1] !== "...") push("...");
  }
  range.forEach((n) => {
    html += n === "..." ? `<button disabled>…</button>` : btn(n, n, { active: n === cur });
  });
  html += btn(`<i class="fa-solid fa-chevron-right"></i>`, cur + 1, { disabled: cur === pages });
  p.innerHTML = html;
}

/* =========================================================
 * DETALHE DO JOGO
 * ========================================================= */
function openGameDetail(id) {
  const g = state.games.find((x) => x.id === id);
  if (!g) return;
  $("#gmImg").src = g.image || "";
  $("#gmName").textContent = g.name;
  $("#gmCat").textContent = g.category || "-";
  $("#gmSub").textContent = g.subcategory || "-";
  $("#gmDesc").textContent = g.description || "";
  $("#gmComp").textContent = g.compatibility || "-";
  $("#gmLang").textContent = g.language || "-";
  $("#gmSize").textContent = fmt(g.size);
  $("#gmCode").textContent = g.code || "-";
  $("#gmAddBtn").onclick = () => { addToCart(id); closeModal("gameModal"); };
  openModal("gameModal");
}

/* =========================================================
 * CARRINHO / LISTA
 * ========================================================= */
function addToCart(id) {
  if (state.cart.some((c) => c.id === id)) { toast("Já está na lista."); return; }
  const g = state.games.find((x) => x.id === id);
  if (!g) return;
  state.cart.push(g);
  toast(`${g.name} adicionado!`, "success");
  updatePendriveBar();
  renderCatalog();
  renderCart();
}
function removeFromCart(id) {
  state.cart = state.cart.filter((c) => c.id !== id);
  updatePendriveBar(); renderCatalog(); renderCart();
}
function currentPendrive() {
  return state.pendrives.find((p) => p.id === state.selectedPendriveId) || state.pendrives[0];
}
function cartTotalGB() {
  return state.cart.reduce((s, g) => s + Number(g.size || 0), 0);
}

/** Atualiza barra do pendrive */
function updatePendriveBar() {
  const p = currentPendrive();
  const cap = p ? Number(p.capacity) : 0;
  const used = cartTotalGB();
  const free = Math.max(0, cap - used);
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;

  $("#usedGB").textContent = fmt(used);
  $("#freeGB").textContent = fmt(free);
  $("#percentUsed").textContent = pct.toFixed(0) + "%";
  $("#qtyGames").textContent = state.cart.length;

  const bar = $("#pendriveBar");
  bar.style.width = pct + "%";
  let color = "linear-gradient(90deg,#10b981,#22c55e)";
  if (pct > 90) color = "linear-gradient(90deg,#ef4444,#dc2626)";
  else if (pct > 75) color = "linear-gradient(90deg,#f97316,#fb923c)";
  else if (pct > 55) color = "linear-gradient(90deg,#eab308,#fde047)";
  bar.style.background = color;

  $("#cartBadge").textContent = state.cart.length;
}

/** Renderiza carrinho no modal */
function renderCart() {
  const wrap = $("#cartItems");
  const p = currentPendrive();
  const cap = p ? Number(p.capacity) : 0;
  const used = cartTotalGB();
  const over = used > cap;

  wrap.innerHTML = state.cart.length ? state.cart.map((g) => `
    <div class="cart-item">
      <img src="${esc(g.image || "")}" alt=""/>
      <div>
        <div class="name">${esc(g.name)}</div>
        <div class="size">${esc(g.category || "")}</div>
      </div>
      <div>${fmt(g.size)} GB</div>
      <button class="rm" data-rm="${g.id}"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join("") : `<p style="text-align:center;color:var(--text-muted);padding:20px;">Sua lista está vazia.</p>`;

  $("#cartQty").textContent = state.cart.length;
  $("#cartUsed").textContent = fmt(used);
  $("#cartCap").textContent = fmt(cap);

  const warn = $("#cartWarn");
  if (over) {
    warn.textContent = "A lista ultrapassou a capacidade disponível. Remova alguns jogos ou selecione um pendrive maior.";
    warn.classList.remove("hidden");
  } else warn.classList.add("hidden");

  validateCheckout();
}

/** Habilita/desabilita finalizar */
function validateCheckout() {
  const form = $("#checkoutForm");
  const fields = ["firstName", "lastName", "whatsapp", "city", "uf"];
  const empty = fields.some((n) => !form.elements[n].value.trim());
  const p = currentPendrive();
  const cap = p ? Number(p.capacity) : 0;
  const over = cartTotalGB() > cap;
  const noItems = state.cart.length === 0;
  $("#finishBtn").disabled = empty || over || noItems;
}

/* =========================================================
 * CHECKOUT + JPG + WHATSAPP
 * ========================================================= */
async function handleCheckout(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  data.uf = data.uf.toUpperCase();

  const p = currentPendrive();
  const used = cartTotalGB();
  const cap = Number(p.capacity);
  const free = cap - used;
  const t = nowParts();

  const orderId = uid();
  const order = {
    id: orderId,
    firstName: data.firstName, lastName: data.lastName,
    whatsapp: data.whatsapp, city: data.city, uf: data.uf,
    pendriveName: p.name, capacity: cap, used, free,
    games: state.cart.map((g) => ({ id: g.id, name: g.name, size: g.size, category: g.category })),
    quantity: state.cart.length,
    status: "pendente",
    date: t.date, time: t.time, createdAt: t.iso,
    imageBase64: "",
  };

  // Gera JPG
  const jpg = await buildOrderImage(order);
  order.imageBase64 = jpg;

  // Salva no Firebase
  try {
    await db.ref("orders/" + orderId).set(order);
  } catch (err) {
    console.error(err);
    toast("Erro ao salvar pedido: " + err.message, "error");
    return;
  }

  // Preview + download + WhatsApp
  $("#jpgPreview").src = jpg;
  $("#downloadJpg").href = jpg;
  $("#sendWhats").href = buildWhatsappUrl(order);
  closeModal("cartModal");
  openModal("jpgModal");

  // Limpa carrinho
  state.cart = [];
  updatePendriveBar();
  renderCart();
  renderCatalog();
  toast("Pedido registrado!", "success");
}

/** Constrói URL do WhatsApp com os dados do pedido */
function buildWhatsappUrl(order) {
  const number = (state.settings.whatsappNumber || "5588988470190").replace(/\D/g, "");
  const lines = [
    `*Novo pedido - ${state.settings.siteTitle || "Catálogo Retro"}*`,
    `Nome: ${order.firstName} ${order.lastName}`,
    `Cidade: ${order.city}/${order.uf}`,
    `WhatsApp: ${order.whatsapp}`,
    `Pendrive: ${order.pendriveName}`,
    `Jogos: ${order.quantity}`,
    `Usado: ${fmt(order.used)} GB • Livre: ${fmt(order.free)} GB`,
    `Data: ${order.date} ${order.time}`,
    ``,
    state.settings.whatsappMessage || "",
    ``,
    `O JPG do pedido foi gerado pelo sistema e está salvo para conferência pelo administrador.`,
  ];
  return `https://wa.me/${number}?text=` + encodeURIComponent(lines.join("\n"));
}

/* =========================================================
 * GERAÇÃO DE IMAGEM (Canvas -> JPG Base64)
 * ========================================================= */
async function buildOrderImage(order) {
  const W = 900;
  const headerH = 260;
  const rowH = 34;
  const rows = order.games.length;
  const H = headerH + rows * rowH + 120;

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Fundo
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#05060d");
  grad.addColorStop(0.5, "#0b0d1a");
  grad.addColorStop(1, "#11132a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Barra topo
  const bar = ctx.createLinearGradient(0, 0, W, 0);
  bar.addColorStop(0, state.settings.primaryColor || "#00b3ff");
  bar.addColorStop(1, state.settings.secondaryColor || "#8a2be2");
  ctx.fillStyle = bar;
  ctx.fillRect(0, 0, W, 6);

  // Logo (se URL válida)
  let logoDrawn = false;
  if (state.settings.logoUrl) {
    try {
      const img = await loadImage(state.settings.logoUrl);
      ctx.drawImage(img, 30, 30, 80, 80);
      logoDrawn = true;
    } catch (_) { /* ignora */ }
  }
  const infoX = logoDrawn ? 130 : 30;

  // Título
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px Orbitron, Arial";
  ctx.fillText(state.settings.siteTitle || "Catálogo Retro", infoX, 60);

  ctx.fillStyle = "#a4a9c9";
  ctx.font = "16px Rajdhani, Arial";
  ctx.fillText(`Pedido gerado em ${order.date} às ${order.time}`, infoX, 88);

  // Dados do cliente (2 colunas)
  ctx.fillStyle = "#eef1ff";
  ctx.font = "16px Rajdhani, Arial";
  const info = [
    [`Nome:`, `${order.firstName} ${order.lastName}`],
    [`Cidade/UF:`, `${order.city}/${order.uf}`],
    [`WhatsApp:`, `${order.whatsapp}`],
    [`Pendrive:`, `${order.pendriveName}`],
    [`Capacidade:`, `${fmt(order.capacity)} GB`],
    [`Usado:`, `${fmt(order.used)} GB`],
    [`Restante:`, `${fmt(order.free)} GB`],
    [`Data/Hora:`, `${order.date} ${order.time}`],
  ];
  let y = 130;
  info.forEach(([k, v], i) => {
    const col = i % 2;
    const line = Math.floor(i / 2);
    const x = 30 + col * (W / 2);
    ctx.fillStyle = "#a4a9c9";
    ctx.fillText(k, x, y + line * 26);
    ctx.fillStyle = "#eef1ff";
    ctx.fillText(v, x + 110, y + line * 26);
  });

  // Divisor
  ctx.strokeStyle = "rgba(255,255,255,.15)";
  ctx.beginPath(); ctx.moveTo(30, headerH - 20); ctx.lineTo(W - 30, headerH - 20); ctx.stroke();

  // Lista jogos
  ctx.fillStyle = "#00b3ff";
  ctx.font = "bold 18px Orbitron, Arial";
  ctx.fillText(`Jogos selecionados (${order.games.length})`, 30, headerH + 10);

  ctx.font = "15px Rajdhani, Arial";
  ctx.fillStyle = "#eef1ff";
  order.games.forEach((g, i) => {
    const yy = headerH + 40 + i * rowH;
    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,.03)";
      ctx.fillRect(20, yy - 20, W - 40, rowH);
    }
    ctx.fillStyle = "#a4a9c9";
    ctx.fillText(String(i + 1).padStart(3, "0"), 30, yy);
    ctx.fillStyle = "#eef1ff";
    ctx.fillText(g.name.substring(0, 60), 80, yy);
    ctx.fillStyle = "#7dd3fc";
    ctx.textAlign = "right";
    ctx.fillText(`${fmt(g.size)} GB`, W - 30, yy);
    ctx.textAlign = "left";
  });

  // Rodapé
  const footY = H - 60;
  ctx.fillStyle = bar;
  ctx.fillRect(0, footY, W, 4);
  ctx.fillStyle = "#a4a9c9";
  ctx.font = "14px Rajdhani, Arial";
  ctx.textAlign = "center";
  ctx.fillText(state.settings.jpgMessage || "Obrigado pela preferência!", W / 2, footY + 30);
  ctx.textAlign = "left";

  return canvas.toDataURL("image/jpeg", 0.9);
}

/** Carrega imagem CORS-safe */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/* =========================================================
 * AUTENTICAÇÃO / ADMIN
 * ========================================================= */
function bindLogin() {
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      await auth.signInWithEmailAndPassword(data.email, data.password);
      closeModal("loginModal");
    } catch (err) {
      toast(err.message, "error");
    }
  });

  auth.onAuthStateChanged((user) => {
    if (!user) { showPublic(); return; }
    if (user.email !== ADMIN_EMAIL) {
      toast("Acesso não autorizado.", "error");
      auth.signOut();
      return;
    }
    showAdmin();
  });
}

function showPublic() {
  state.isAdmin = false;
  $("#publicApp").classList.remove("hidden");
  $("#adminApp").classList.add("hidden");
}
function showAdmin() {
  state.isAdmin = true;
  $("#adminApp").classList.remove("hidden");
  $("#publicApp").classList.add("hidden");
  listenOrders();
  renderCurrentAdminView();
}

/* =========================================================
 * ADMIN - Views
 * ========================================================= */
let currentAdminView = "dashboard";
function renderCurrentAdminView() {
  // Evita apagar o input enquanto o admin digita: se o foco estiver dentro do
  // viewContainer em um campo de texto, re-renderiza depois que ele perder foco.
  const active = document.activeElement;
  const container = $("#viewContainer");
  if (container && active && container.contains(active) &&
      (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
    if (!renderCurrentAdminView._pending) {
      renderCurrentAdminView._pending = true;
      active.addEventListener("blur", () => {
        renderCurrentAdminView._pending = false;
        renderCurrentAdminView();
      }, { once: true });
    }
    return;
  }
  $("#viewTitle").textContent = ({
    dashboard: "Dashboard", orders: "Pedidos", games: "Jogos",
    categories: "Categorias", subcategories: "Subcategorias",
    pendrives: "Pendrives", settings: "Configurações",
  })[currentAdminView];
  const c = container;
  const fn = {
    dashboard: viewDashboard, orders: viewOrders, games: viewGames,
    categories: viewCategories, subcategories: viewSubcategories,
    pendrives: viewPendrives, settings: viewSettings,
  }[currentAdminView];
  c.innerHTML = fn ? fn() : "";
  wireAdminActions();
}

function viewDashboard() {
  const totalGames = state.games.length;
  const pending = state.orders.filter((o) => o.status === "pendente").length;
  const finished = state.orders.filter((o) => o.status === "finalizado").length;
  const totalGB = state.games.reduce((s, g) => s + Number(g.size || 0), 0);
  return `
    <div class="stats">
      <div class="stat-card"><div class="label"><i class="fa-solid fa-gamepad"></i> Jogos</div><div class="value">${totalGames}</div></div>
      <div class="stat-card"><div class="label"><i class="fa-solid fa-receipt"></i> Pedidos pendentes</div><div class="value">${pending}</div></div>
      <div class="stat-card"><div class="label"><i class="fa-solid fa-check"></i> Finalizados</div><div class="value">${finished}</div></div>
      <div class="stat-card"><div class="label"><i class="fa-solid fa-database"></i> Catálogo total</div><div class="value">${fmt(totalGB)} GB</div></div>
      <div class="stat-card"><div class="label"><i class="fa-solid fa-tags"></i> Categorias</div><div class="value">${state.categories.length}</div></div>
      <div class="stat-card"><div class="label"><i class="fa-solid fa-hard-drive"></i> Pendrives</div><div class="value">${state.pendrives.length}</div></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>Últimos pedidos</h2></div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Data</th><th>Cliente</th><th>Cidade</th><th>Pendrive</th><th>Qtd</th><th>Status</th></tr></thead>
          <tbody>
            ${state.orders.slice(-6).reverse().map(o => `
              <tr>
                <td>${esc(o.date)} ${esc(o.time)}</td>
                <td>${esc(o.firstName)} ${esc(o.lastName)}</td>
                <td>${esc(o.city)}/${esc(o.uf)}</td>
                <td>${esc(o.pendriveName)}</td>
                <td>${o.quantity}</td>
                <td><span class="status ${o.status}">${o.status}</span></td>
              </tr>
            `).join("") || `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px;">Sem pedidos ainda</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function viewOrders() {
  return `
    <div class="panel">
      <div class="panel-head">
        <h2>Todos os pedidos</h2>
        <input id="orderSearch" placeholder="Pesquisar pedidos..." style="max-width:260px;"/>
      </div>
      <div class="table-wrap">
        <table class="admin-table" id="ordersTable">
          <thead><tr><th>Data</th><th>Cliente</th><th>Cidade</th><th>Pendrive</th><th>Qtd</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${state.orders.slice().reverse().map(o => `
              <tr data-order="${o.id}">
                <td>${esc(o.date)} ${esc(o.time)}</td>
                <td>${esc(o.firstName)} ${esc(o.lastName)}</td>
                <td>${esc(o.city)}/${esc(o.uf)}</td>
                <td>${esc(o.pendriveName)}</td>
                <td>${o.quantity}</td>
                <td><span class="status ${o.status}">${o.status}</span></td>
                <td class="row-btns">
                  <button class="icon-btn" data-view-jpg="${o.id}" title="Ver JPG"><i class="fa-solid fa-eye"></i></button>
                  <button class="icon-btn" data-dl-jpg="${o.id}" title="Baixar JPG"><i class="fa-solid fa-download"></i></button>
                  ${o.status === "pendente" ? `<button class="icon-btn" data-finish="${o.id}" title="Finalizar"><i class="fa-solid fa-check"></i></button>` : ""}
                  <button class="icon-btn danger" data-del-order="${o.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px;">Sem pedidos ainda</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function viewGames() {
  return `
    <div class="panel">
      <div class="panel-head">
        <h2>Gerenciar jogos</h2>
        <button class="btn btn-primary" data-add-game><i class="fa-solid fa-plus"></i> Novo jogo</button>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th></th><th>Nome</th><th>Categoria</th><th>Subcategoria</th><th>GB</th><th>Código</th><th>Ações</th></tr></thead>
          <tbody>
            ${state.games.map(g => `
              <tr>
                <td><img class="thumb-sm" src="${esc(g.image || "")}" alt=""/></td>
                <td>${esc(g.name)}</td>
                <td>${esc(g.category || "")}</td>
                <td>${esc(g.subcategory || "")}</td>
                <td>${fmt(g.size)}</td>
                <td>${esc(g.code || "")}</td>
                <td class="row-btns">
                  <button class="icon-btn" data-edit-game="${g.id}"><i class="fa-solid fa-pen"></i></button>
                  <button class="icon-btn danger" data-del-game="${g.id}"><i class="fa-solid fa-trash"></i></button>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px;">Nenhum jogo cadastrado</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function viewSimpleList(title, key, refPath) {
  const items = [...state[key]].sort((a, b) => (a.order || 0) - (b.order || 0));
  const inputId = `newSimpleName_${refPath}`;
  return `
    <div class="panel">
      <div class="panel-head">
        <h2>${title}</h2>
        <div style="display:flex;gap:8px;">
          <input id="${inputId}" placeholder="Digite o nome e pressione Enter" data-simple-input="${refPath}" autocomplete="off"/>
          <button class="btn btn-primary" data-add-simple="${refPath}"><i class="fa-solid fa-plus"></i> Adicionar</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Ordem</th><th>Nome</th><th>Ações</th></tr></thead>
          <tbody>
            ${items.map(i => `
              <tr>
                <td><input type="number" data-order-simple="${refPath}|${i.id}" value="${i.order || 0}" style="width:70px;"/></td>
                <td><input data-name-simple="${refPath}|${i.id}" value="${esc(i.name)}"/></td>
                <td class="row-btns">
                  <button class="icon-btn" data-save-simple="${refPath}|${i.id}" title="Salvar"><i class="fa-solid fa-check"></i></button>
                  <button class="icon-btn danger" data-del-simple="${refPath}|${i.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px;">Vazio</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
function viewCategories() { return viewSimpleList("Categorias", "categories", "categories"); }
function viewSubcategories() { return viewSimpleList("Subcategorias", "subcategories", "subcategories"); }

function viewPendrives() {
  const items = [...state.pendrives].sort((a, b) => (a.order || 0) - (b.order || 0));
  return `
    <div class="panel">
      <div class="panel-head">
        <h2>Pendrives</h2>
        <button class="btn btn-primary" data-add-pen><i class="fa-solid fa-plus"></i> Novo</button>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Ordem</th><th>Nome</th><th>Capacidade real (GB)</th><th>Ações</th></tr></thead>
          <tbody>
            ${items.map(p => `
              <tr>
                <td><input type="number" data-pen-order="${p.id}" value="${p.order || 0}" style="width:70px;"/></td>
                <td><input data-pen-name="${p.id}" value="${esc(p.name)}"/></td>
                <td><input type="number" step="0.01" data-pen-cap="${p.id}" value="${p.capacity}"/></td>
                <td class="row-btns">
                  <button class="icon-btn" data-save-pen="${p.id}"><i class="fa-solid fa-check"></i></button>
                  <button class="icon-btn danger" data-del-pen="${p.id}"><i class="fa-solid fa-trash"></i></button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function viewSettings() {
  const s = state.settings || {};
  const field = (name, label, type = "text") =>
    `<label style="display:flex;flex-direction:column;gap:6px;">
      <span style="color:var(--text-muted);font-size:13px;">${label}</span>
      <input type="${type}" data-setting="${name}" value="${esc(s[name] || "")}"/>
    </label>`;
  const area = (name, label) =>
    `<label style="display:flex;flex-direction:column;gap:6px;">
      <span style="color:var(--text-muted);font-size:13px;">${label}</span>
      <textarea data-setting="${name}" rows="2" style="background:rgba(255,255,255,.05);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:10px;">${esc(s[name] || "")}</textarea>
    </label>`;
  return `
    <div class="panel">
      <div class="panel-head"><h2>Configurações do site</h2>
        <button class="btn btn-primary" data-save-settings><i class="fa-solid fa-check"></i> Salvar</button>
      </div>
      <div class="grid-2">
        ${field("siteTitle", "Título do site")}
        ${field("siteName", "Nome do site")}
        ${field("logoUrl", "Logo (URL do GitHub)")}
        ${field("faviconUrl", "Favicon (URL)")}
        ${field("primaryColor", "Cor principal (hex)")}
        ${field("secondaryColor", "Cor secundária (hex)")}
        ${field("backgroundUrl", "Imagem de fundo (URL)")}
        ${field("whatsappNumber", "Número WhatsApp (ex 5588988470190)")}
        ${area("whatsappMessage", "Mensagem WhatsApp")}
        ${area("jpgMessage", "Mensagem do rodapé do JPG")}
        ${area("footerText", "Texto do rodapé do site")}
      </div>
    </div>
  `;
}

/* =========================================================
 * ADMIN - Ações (delegated events)
 * ========================================================= */
function wireAdminActions() {
  const c = $("#viewContainer");

  // === ORDERS ===
  c.querySelectorAll("[data-view-jpg]").forEach((b) => b.onclick = () => {
    const o = state.orders.find(x => x.id === b.dataset.viewJpg);
    if (!o) return;
    $("#jpgPreview").src = o.imageBase64 || "";
    $("#downloadJpg").href = o.imageBase64 || "#";
    $("#sendWhats").href = buildWhatsappUrl(o);
    openModal("jpgModal");
  });
  c.querySelectorAll("[data-dl-jpg]").forEach((b) => b.onclick = () => {
    const o = state.orders.find(x => x.id === b.dataset.dlJpg);
    if (!o) return;
    const a = document.createElement("a");
    a.href = o.imageBase64; a.download = `pedido-${o.id}.jpg`; a.click();
  });
  c.querySelectorAll("[data-finish]").forEach((b) => b.onclick = async () => {
    await db.ref("orders/" + b.dataset.finish + "/status").set("finalizado");
    toast("Pedido finalizado", "success");
  });
  c.querySelectorAll("[data-del-order]").forEach((b) => b.onclick = async () => {
    if (!confirm("Excluir este pedido permanentemente?")) return;
    await db.ref("orders/" + b.dataset.delOrder).remove();
    toast("Pedido excluído", "success");
  });
  const os = c.querySelector("#orderSearch");
  if (os) os.oninput = () => {
    const q = os.value.toLowerCase();
    c.querySelectorAll("#ordersTable tbody tr").forEach((tr) => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  };

  // === GAMES ===
  const addG = c.querySelector("[data-add-game]");
  if (addG) addG.onclick = () => openGameForm();
  c.querySelectorAll("[data-edit-game]").forEach(b => b.onclick = () => openGameForm(b.dataset.editGame));
  c.querySelectorAll("[data-del-game]").forEach(b => b.onclick = async () => {
    if (!confirm("Excluir este jogo?")) return;
    await db.ref("games/" + b.dataset.delGame).remove();
    toast("Jogo excluído", "success");
  });

  // === SIMPLE LISTS (categories/subcategories) ===
  const addS = c.querySelector("[data-add-simple]");
  const addSimpleHandler = async () => {
    const path = addS.dataset.addSimple;
    const input = c.querySelector(`[data-simple-input="${path}"]`);
    const name = (input?.value || "").trim();
    if (!name) { toast("Digite um nome antes de adicionar", "error"); input?.focus(); return; }
    try {
      const id = uid();
      const order = (Array.isArray(state[path]) ? state[path].length : 0) + 1;
      await db.ref(`${path}/${id}`).set({ id, name, order });
      if (input) input.value = "";
      toast(`${path === "subcategories" ? "Subcategoria" : "Categoria"} adicionada`, "success");
    } catch (err) {
      console.error("Erro ao adicionar em", path, err);
      toast("Erro ao salvar: " + (err?.message || err), "error");
    }
  };
  if (addS) {
    addS.onclick = addSimpleHandler;
    const inp = c.querySelector(`[data-simple-input="${addS.dataset.addSimple}"]`);
    if (inp) inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addSimpleHandler(); }
    });
  }
  c.querySelectorAll("[data-save-simple]").forEach(b => b.onclick = async () => {
    const [path, id] = b.dataset.saveSimple.split("|");
    const name = c.querySelector(`[data-name-simple="${path}|${id}"]`).value.trim();
    const order = Number(c.querySelector(`[data-order-simple="${path}|${id}"]`).value) || 0;
    if (!name) { toast("Nome não pode ficar vazio", "error"); return; }
    try {
      await db.ref(`${path}/${id}`).update({ name, order });
      toast("Salvo", "success");
    } catch (err) {
      console.error(err);
      toast("Erro ao salvar: " + (err?.message || err), "error");
    }
  });
  c.querySelectorAll("[data-del-simple]").forEach(b => b.onclick = async () => {
    const [path, id] = b.dataset.delSimple.split("|");
    if (!confirm("Excluir?")) return;
    try {
      await db.ref(`${path}/${id}`).remove();
      toast("Excluído", "success");
    } catch (err) {
      console.error(err);
      toast("Erro ao excluir: " + (err?.message || err), "error");
    }
  });

  // === PENDRIVES ===
  const addP = c.querySelector("[data-add-pen]");
  if (addP) addP.onclick = async () => {
    const id = uid();
    await db.ref("pendrives/" + id).set({ id, name: "Novo Pendrive", capacity: 0, order: state.pendrives.length + 1 });
  };
  c.querySelectorAll("[data-save-pen]").forEach(b => b.onclick = async () => {
    const id = b.dataset.savePen;
    const name = c.querySelector(`[data-pen-name="${id}"]`).value.trim();
    const capacity = Number(c.querySelector(`[data-pen-cap="${id}"]`).value) || 0;
    const order = Number(c.querySelector(`[data-pen-order="${id}"]`).value) || 0;
    await db.ref("pendrives/" + id).update({ name, capacity, order });
    toast("Salvo", "success");
  });
  c.querySelectorAll("[data-del-pen]").forEach(b => b.onclick = async () => {
    if (!confirm("Excluir pendrive?")) return;
    await db.ref("pendrives/" + b.dataset.delPen).remove();
  });

  // === SETTINGS ===
  const saveS = c.querySelector("[data-save-settings]");
  if (saveS) saveS.onclick = async () => {
    const payload = {};
    c.querySelectorAll("[data-setting]").forEach(el => payload[el.dataset.setting] = el.value);
    await db.ref("settings").update(payload);
    toast("Configurações salvas", "success");
  };
}

/** Form de jogo (novo/edit) via prompt-like modal simples usando cartModal reaproveitado */
function openGameForm(editId) {
  const g = editId ? state.games.find(x => x.id === editId) : {};
  const html = `
    <div class="modal" id="gameFormModal">
      <div class="modal-content glass wide">
        <button class="modal-close" data-close-gf><i class="fa-solid fa-xmark"></i></button>
        <h2>${editId ? "Editar" : "Novo"} jogo</h2>
        <form id="gameForm" class="checkout-form">
          <div class="grid-2">
            <input required name="name" placeholder="Nome" value="${esc(g.name || "")}"/>
            <input required name="code" placeholder="Código único" value="${esc(g.code || "")}"/>
            <select required name="category">${["", ...state.categories.map(c => c.name)].map(n => `<option ${g.category === n ? "selected" : ""} value="${esc(n)}">${esc(n || "Categoria")}</option>`).join("")}</select>
            <select name="subcategory">${["", ...state.subcategories.map(c => c.name)].map(n => `<option ${g.subcategory === n ? "selected" : ""} value="${esc(n)}">${esc(n || "Subcategoria")}</option>`).join("")}</select>
            <input name="compatibility" placeholder="Compatibilidade" value="${esc(g.compatibility || "")}"/>
            <input name="language" placeholder="Idioma" value="${esc(g.language || "")}"/>
            <input required type="number" step="0.01" name="size" placeholder="Tamanho GB" value="${g.size ?? ""}"/>
            <input name="image" placeholder="URL da imagem (GitHub)" value="${esc(g.image || "")}"/>
          </div>
          <textarea name="description" rows="3" placeholder="Descrição" style="background:rgba(255,255,255,.05);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:10px;">${esc(g.description || "")}</textarea>
          <button type="submit" class="btn btn-primary btn-block"><i class="fa-solid fa-check"></i> Salvar</button>
        </form>
      </div>
    </div>`;
  const div = document.createElement("div");
  div.innerHTML = html;
  const modal = div.firstElementChild;
  document.body.appendChild(modal);
  modal.querySelector("[data-close-gf]").onclick = () => modal.remove();
  modal.querySelector("#gameForm").onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    data.size = Number(data.size) || 0;
    const id = editId || uid();
    const payload = {
      id,
      name: data.name, code: data.code,
      category: data.category, subcategory: data.subcategory,
      compatibility: data.compatibility, language: data.language,
      size: data.size, image: data.image, description: data.description,
      createdAt: g.createdAt || new Date().toISOString(),
    };
    await db.ref("games/" + id).set(payload);
    modal.remove();
    toast("Jogo salvo", "success");
  };
}

/* =========================================================
 * BINDINGS PÚBLICOS
 * ========================================================= */
function bindPublicUI() {
  // Delegação: cards e botões
  $("#gamesGrid").addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) { e.stopPropagation(); addToCart(add.dataset.add); return; }
    const card = e.target.closest(".game-card");
    if (card) openGameDetail(card.dataset.id);
  });

  $("#pagination").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-page]");
    if (!b || b.disabled) return;
    state.currentPage = Number(b.dataset.page);
    renderCatalog();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  $("#searchInput").addEventListener("input", (e) => { state.filters.search = e.target.value; state.currentPage = 1; renderCatalog(); });
  $("#categoryFilter").addEventListener("change", (e) => { state.filters.category = e.target.value; state.currentPage = 1; renderCatalog(); });
  $("#subcategoryFilter").addEventListener("change", (e) => { state.filters.subcategory = e.target.value; state.currentPage = 1; renderCatalog(); });
  $("#sortFilter").addEventListener("change", (e) => { state.filters.sort = e.target.value; renderCatalog(); });

  $("#pendriveSelect").addEventListener("change", (e) => { state.selectedPendriveId = e.target.value; updatePendriveBar(); renderCart(); });

  $("#openCartBtn").addEventListener("click", () => { renderCart(); openModal("cartModal"); });
  $("#adminLoginBtn").addEventListener("click", () => openModal("loginModal"));

  // Fechar modais
  document.body.addEventListener("click", (e) => {
    const close = e.target.closest("[data-close]");
    if (close) closeModal(close.dataset.close);
  });

  // Carrinho: remover / validar / submit
  $("#cartItems").addEventListener("click", (e) => {
    const rm = e.target.closest("[data-rm]");
    if (rm) removeFromCart(rm.dataset.rm);
  });
  $("#checkoutForm").addEventListener("input", validateCheckout);
  $("#checkoutForm").addEventListener("submit", handleCheckout);

  // Admin nav
  document.body.addEventListener("click", (e) => {
    const nav = e.target.closest(".nav-item[data-view]");
    if (nav) {
      currentAdminView = nav.dataset.view;
      $$(".nav-item").forEach(n => n.classList.remove("active"));
      nav.classList.add("active");
      renderCurrentAdminView();
      $(".admin-sidebar").classList.remove("open");
    }
  });
  $("#logoutBtn").addEventListener("click", () => auth.signOut());
  $("#mobileMenuBtn").addEventListener("click", () => $(".admin-sidebar").classList.toggle("open"));
}

/* =========================================================
 * BOOTSTRAP
 * ========================================================= */
async function main() {
  try {
    await ensureDefaults();
  } catch (err) {
    console.warn("ensureDefaults falhou (regras podem impedir):", err);
  }
  listenSettings();
  listenList("games", "games");
  listenList("categories", "categories");
  listenList("subcategories", "subcategories");
  listenList("pendrives", "pendrives");
  bindLogin();
  bindPublicUI();
  setTimeout(() => $("#appLoader").classList.add("hidden"), 400);
}

main();
