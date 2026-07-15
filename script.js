/* =========================================================
 * PS2 Retrô — Catálogo Gamer
 * Frontend puro + Firebase (Auth + Realtime Database)
 * ---------------------------------------------------------
 * ESTRUTURA:
 *  1.  CONFIGURAÇÃO FIREBASE       → substitua firebaseConfig
 *  2.  ESTADO GLOBAL
 *  3.  UTILITÁRIOS (toasts, modais, loader)
 *  4.  AUTENTICAÇÃO ADMIN
 *  5.  CARREGAMENTO DE DADOS (settings, games, cats, pendrives)
 *  6.  ÁREA PÚBLICA (grid, filtros, carrinho, checkout)
 *  7.  GERAÇÃO DE IMAGEM JPG (Canvas)
 *  8.  ENVIO WHATSAPP + SALVAR PEDIDO
 *  9.  PAINEL ADMIN (dashboard, pedidos, jogos, cats, pen, config)
 * 10.  INICIALIZAÇÃO
 * ========================================================= */
/* ============ 1. CONFIGURAÇÃO FIREBASE ============
 * >>> COLE AQUI as credenciais do seu projeto Firebase.
 * Console Firebase → ⚙️ Configurações → Suas apps → Config
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
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
const ADMIN_EMAIL = "admin@admin.com";
const DEFAULT_WHATSAPP = "5588988470190";
/* ============ 2. ESTADO GLOBAL ============ */
const state = {
  settings: {},
  games: [],
  categories: [],
  pendrives: [],
  orders: [],
  cart: [],           // [{id, qty}]
  selectedPen: null,  // pendrive object
  filter: { q: "", cat: "", sort: "az" },
};
/* ============ 3. UTILITÁRIOS ============ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
function toast(msg, type = "info") {
  const c = $("#toast-container");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transform = "translateX(20px)"; }, 2600);
  setTimeout(() => t.remove(), 3000);
}
function showLoader(show = true) { $("#global-loader").classList.toggle("hidden", !show); }
function openModal(id) { $("#" + id).classList.remove("hidden"); }
function closeModal(id) { $("#" + id).classList.add("hidden"); }
function confirmDialog(msg) {
  return new Promise(resolve => {
    $("#confirm-msg").textContent = msg;
    openModal("modal-confirm");
    const yes = $("#confirm-yes"), no = $("#confirm-no");
    const cleanup = () => { yes.onclick = null; no.onclick = null; closeModal("modal-confirm"); };
    yes.onclick = () => { cleanup(); resolve(true); };
    no.onclick = () => { cleanup(); resolve(false); };
  });
}
function fmtGB(n) { return (Number(n) || 0).toFixed(2) + " GB"; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
/* Ripple effect */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn");
  if (!btn) return;
  const r = btn.getBoundingClientRect();
  btn.style.setProperty("--x", (e.clientX - r.left) + "px");
  btn.style.setProperty("--y", (e.clientY - r.top) + "px");
});
/* Fechar modais no backdrop */
document.addEventListener("click", (e) => {
  const cls = e.target.dataset.close;
  if (cls) closeModal(cls);
});
/* ============ 4. AUTENTICAÇÃO ADMIN ============ */
$("#btn-admin-login").addEventListener("click", () => openModal("modal-login"));
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = fd.get("email").trim();
  const password = fd.get("password");
  if (email !== ADMIN_EMAIL) { toast("Acesso não autorizado.", "error"); return; }
  try {
    showLoader(true);
    await auth.signInWithEmailAndPassword(email, password);
    closeModal("modal-login");
  } catch (err) {
    toast("Falha no login: " + err.message, "error");
  } finally { showLoader(false); }
});
auth.onAuthStateChanged((user) => {
  if (user && user.email === ADMIN_EMAIL) {
    $("#public-area").classList.add("hidden");
    $("#admin-area").classList.remove("hidden");
    bootAdmin();
  } else {
    if (user) { auth.signOut(); toast("Acesso não autorizado.", "error"); }
    $("#admin-area").classList.add("hidden");
    $("#public-area").classList.remove("hidden");
  }
});
$("#btn-logout").addEventListener("click", () => auth.signOut());
/* ============ 5. CARREGAMENTO DE DADOS ============ */
function listen(path, cb) { db.ref(path).on("value", s => cb(s.val() || null)); }
function applySettings(s) {
  state.settings = s || {};
  const st = state.settings;
  document.title = st.title || "PS2 Retrô";
  $("#site-title").textContent = st.displayName || st.title || "PS2 Retrô";
  if (st.logo) $("#site-logo").src = st.logo;
  if (st.favicon) $("#favicon").href = st.favicon;
  if (st.primary) document.documentElement.style.setProperty("--primary", st.primary);
  if (st.secondary) document.documentElement.style.setProperty("--secondary", st.secondary);
  if (st.bgImage) document.documentElement.style.setProperty("--bg-image", `url("${st.bgImage}")`);
  document.body.classList.toggle("theme-light", st.theme === "light");
  $("#footer-text").textContent = st.footer || "© PS2 Retrô";
}
listen("settings", applySettings);
listen("games", (v) => { state.games = objToArr(v); renderGames(); renderAdminGames(); populateCategoryFilter(); refreshStats(); });
listen("categories", (v) => { state.categories = objToArr(v); populateCategoryFilter(); renderAdminCategories(); populateGameFormCats(); refreshStats(); });
listen("pendrives", (v) => {
  state.pendrives = objToArr(v);
  if (!state.pendrives.length) seedDefaultPendrives();
  else { renderPendriveSelect(); renderAdminPendrives(); updateCapacityUI(); }
});
listen("orders", (v) => { state.orders = objToArr(v); renderOrders(); refreshStats(); });
function objToArr(obj) { return obj ? Object.entries(obj).map(([id, v]) => ({ id, ...v })) : []; }
async function seedDefaultPendrives() {
  const defaults = [
    { label: "32GB", real: 28.5 },
    { label: "64GB", real: 59.4 },
    { label: "128GB", real: 116.7 },
  ];
  for (const p of defaults) await db.ref("pendrives").push(p);
}
/* ============ 6. ÁREA PÚBLICA ============ */
function renderPendriveSelect() {
  const sel = $("#pendrive-select");
  sel.innerHTML = "";
  state.pendrives.forEach(p => {
    const o = document.createElement("option");
    o.value = p.id; o.textContent = `${p.label} (${p.real} GB)`;
    sel.appendChild(o);
  });
  if (!state.selectedPen) state.selectedPen = state.pendrives[0];
  sel.value = state.selectedPen?.id || "";
  updateCapacityUI();
}
$("#pendrive-select").addEventListener("change", (e) => {
  state.selectedPen = state.pendrives.find(p => p.id === e.target.value);
  updateCapacityUI();
});
function populateCategoryFilter() {
  const sel = $("#category-filter");
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todas categorias</option>';
  state.categories.forEach(c => {
    const o = document.createElement("option");
    o.value = c.nome; o.textContent = c.nome;
    sel.appendChild(o);
  });
  sel.value = cur;
}
$("#search-input").addEventListener("input", (e) => { state.filter.q = e.target.value.toLowerCase(); renderGames(); });
$("#category-filter").addEventListener("change", (e) => { state.filter.cat = e.target.value; renderGames(); });
$("#sort-select").addEventListener("change", (e) => { state.filter.sort = e.target.value; renderGames(); });
function renderGames() {
  const grid = $("#games-grid");
  let list = [...state.games];
  const { q, cat, sort } = state.filter;
  if (q) list = list.filter(g => (g.nome || "").toLowerCase().includes(q));
  if (cat) list = list.filter(g => g.categoria === cat);
  const cmp = {
    az: (a, b) => a.nome.localeCompare(b.nome),
    za: (a, b) => b.nome.localeCompare(a.nome),
    "size-asc": (a, b) => a.tamanho - b.tamanho,
    "size-desc": (a, b) => b.tamanho - a.tamanho,
  };
  list.sort(cmp[sort]);
  $("#games-empty").classList.toggle("hidden", list.length > 0);
  grid.innerHTML = list.map(g => `
    <article class="game-card" data-id="${g.id}">
      <div class="cover" style="background-image:url('${g.capa || ""}')">
        <span class="size">${(g.tamanho || 0).toFixed(2)} GB</span>
      </div>
      <div class="info">
        <h4 title="${g.nome}">${g.nome}</h4>
        <span>${g.categoria || ""}</span>
        <button class="add" data-add="${g.id}">+ Adicionar</button>
      </div>
    </article>
  `).join("");
  grid.querySelectorAll(".game-card").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.matches("[data-add]")) { addToCart(card.dataset.id); return; }
      openGameDetail(card.dataset.id);
    });
  });
}
function openGameDetail(id) {
  const g = state.games.find(x => x.id === id); if (!g) return;
  $("#mg-title").textContent = g.nome;
  $("#mg-cover").src = g.capa || "";
  $("#mg-cat").textContent = g.categoria || "-";
  $("#mg-size").textContent = (g.tamanho || 0).toFixed(2);
  $("#mg-compat").textContent = g.compatibilidade || "-";
  $("#mg-desc").textContent = g.descricao || "";
  $("#mg-add").onclick = () => { addToCart(id); closeModal("modal-game"); };
  openModal("modal-game");
}
/* --- Carrinho --- */
function addToCart(id) {
  const it = state.cart.find(c => c.id === id);
  if (it) it.qty += 1; else state.cart.push({ id, qty: 1 });
  toast("Adicionado à lista", "success");
  renderCart();
}
function removeFromCart(id) { state.cart = state.cart.filter(c => c.id !== id); renderCart(); }
function changeQty(id, delta) {
  const it = state.cart.find(c => c.id === id); if (!it) return;
  it.qty = Math.max(1, it.qty + delta); renderCart();
}
function totalUsedGB() {
  return state.cart.reduce((sum, c) => {
    const g = state.games.find(x => x.id === c.id);
    return sum + (g ? g.tamanho * c.qty : 0);
  }, 0);
}
$("#btn-open-cart").addEventListener("click", () => { renderCart(); openModal("modal-cart"); });
function renderCart() {
  $("#cart-count").textContent = state.cart.reduce((s, c) => s + c.qty, 0);
  const box = $("#cart-items");
  $("#cart-empty").classList.toggle("hidden", state.cart.length > 0);
  box.innerHTML = state.cart.map(c => {
    const g = state.games.find(x => x.id === c.id); if (!g) return "";
    return `
      <div class="cart-item">
        <img src="${g.capa || ""}" alt="">
        <div>
          <div class="name">${g.nome}</div>
          <div class="meta">${g.categoria} • ${(g.tamanho * c.qty).toFixed(2)} GB</div>
        </div>
        <div class="qty">
          <button data-dec="${g.id}">−</button>
          <span>${c.qty}</span>
          <button data-inc="${g.id}">+</button>
        </div>
        <button class="remove" data-rem="${g.id}">✕</button>
      </div>`;
  }).join("");
  box.querySelectorAll("[data-inc]").forEach(b => b.onclick = () => changeQty(b.dataset.inc, +1));
  box.querySelectorAll("[data-dec]").forEach(b => b.onclick = () => changeQty(b.dataset.dec, -1));
  box.querySelectorAll("[data-rem]").forEach(b => b.onclick = () => removeFromCart(b.dataset.rem));
  updateCapacityUI();
}
function updateCapacityUI() {
  const pen = state.selectedPen;
  const used = totalUsedGB();
  const cap = pen ? Number(pen.real) : 0;
  const free = Math.max(0, cap - used);
  const pct = cap ? Math.min(100, (used / cap) * 100) : 0;
  $("#cap-pendrive").textContent = pen ? `${pen.label} (${cap} GB)` : "-";
  $("#cap-used").textContent = fmtGB(used);
  $("#cap-free").textContent = fmtGB(free);
  const bar = $("#cap-bar");
  bar.style.width = pct + "%";
  const over = used > cap;
  bar.classList.toggle("over", over);
  const msg = $("#cap-msg");
  if (over) { msg.className = "cap-msg error"; msg.textContent = "A lista excedeu a capacidade do pendrive escolhido. Remova alguns jogos ou escolha um pendrive maior."; }
  else if (used > 0) { msg.className = "cap-msg ok"; msg.textContent = `Ocupado ${pct.toFixed(1)}%`; }
  else { msg.textContent = ""; }
  $("#btn-finalize").disabled = over || state.cart.length === 0;
  $("#btn-finalize").style.opacity = ($("#btn-finalize").disabled) ? .5 : 1;
}
/* --- Checkout --- */
$("#checkout-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!state.cart.length) return toast("Sua lista está vazia", "warn");
  if (!state.selectedPen) return toast("Escolha um pendrive", "warn");
  const fd = Object.fromEntries(new FormData(e.target).entries());
  fd.uf = (fd.uf || "").toUpperCase();
  await finalizeOrder(fd);
});
async function finalizeOrder(customer) {
  try {
    showLoader(true);
    const pen = state.selectedPen;
    const items = state.cart.map(c => {
      const g = state.games.find(x => x.id === c.id);
      return { id: g.id, nome: g.nome, categoria: g.categoria, tamanho: g.tamanho, qty: c.qty };
    });
    const used = totalUsedGB();
    const free = Math.max(0, pen.real - used);
    const now = new Date();
    const jpgBase64 = await generateListImage({ customer, pen, items, used, free, now });
    const order = {
      ...customer,
      pendrive: pen.label,
      pendriveReal: pen.real,
      usado: used,
      restante: free,
      lista: items,
      data: now.toLocaleDateString("pt-BR"),
      hora: now.toLocaleTimeString("pt-BR"),
      timestamp: now.getTime(),
      status: "pendente",
      imagem: jpgBase64,
    };
    const ref = await db.ref("orders").push(order);
    toast("Lista salva! Abrindo WhatsApp...", "success");
    openWhatsApp({ ...order, id: ref.key });
    // limpar
    state.cart = []; renderCart(); closeModal("modal-cart");
    e && e.target && e.target.reset && e.target.reset();
  } catch (err) {
    console.error(err); toast("Erro ao finalizar: " + err.message, "error");
  } finally { showLoader(false); }
}
/* ============ 7. GERAÇÃO DE IMAGEM JPG ============ */
async function generateListImage({ customer, pen, items, used, free, now }) {
  const W = 900;
  const headerH = 240;
  const rowH = 30;
  const footerH = 90;
  const H = headerH + items.length * rowH + footerH + 40;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  // Fundo gradient
  const grd = ctx.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, "#0b0f1e"); grd.addColorStop(1, "#1a1040");
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  // Header
  ctx.fillStyle = "rgba(0,224,255,0.08)"; ctx.fillRect(0, 0, W, headerH);
  ctx.fillStyle = "#00e0ff"; ctx.font = "bold 34px Orbitron, sans-serif";
  ctx.fillText(state.settings.displayName || "PS2 Retrô", 30, 55);
  ctx.fillStyle = "#a855f7"; ctx.font = "600 16px Rajdhani, sans-serif";
  ctx.fillText("Catálogo Gamer — Lista de Jogos", 30, 80);
  ctx.fillStyle = "#e8ecff"; ctx.font = "500 16px Rajdhani, sans-serif";
  const linhas = [
    `Data: ${now.toLocaleString("pt-BR")}`,
    `Cliente: ${customer.nome} ${customer.sobrenome}`,
    `Cidade/UF: ${customer.cidade} - ${customer.uf}`,
    `WhatsApp: ${customer.whatsapp}`,
    `Pendrive: ${pen.label} (${pen.real} GB)`,
    `Usado: ${used.toFixed(2)} GB • Restante: ${free.toFixed(2)} GB`,
  ];
  linhas.forEach((t, i) => ctx.fillText(t, 30, 120 + i * 20));
  // Tabela
  let y = headerH + 20;
  ctx.fillStyle = "#a855f7"; ctx.font = "bold 14px Rajdhani, sans-serif";
  ctx.fillText("#", 30, y); ctx.fillText("Jogo", 70, y);
  ctx.fillText("Categoria", 540, y); ctx.fillText("GB", 820, y);
  y += 10; ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(W - 20, y); ctx.stroke();
  y += 20;
  ctx.font = "500 14px Rajdhani, sans-serif"; ctx.fillStyle = "#e8ecff";
  items.forEach((g, i) => {
    ctx.fillText(String(i + 1), 30, y);
    ctx.fillText(truncate(ctx, g.nome + (g.qty > 1 ? ` x${g.qty}` : ""), 460), 70, y);
    ctx.fillText(truncate(ctx, g.categoria || "-", 260), 540, y);
    ctx.fillText((g.tamanho * g.qty).toFixed(2), 820, y);
    y += rowH;
  });
  // Footer
  y += 10; ctx.strokeStyle = "rgba(0,224,255,.4)"; ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(W - 20, y); ctx.stroke();
  y += 30;
  ctx.fillStyle = "#00e0ff"; ctx.font = "bold 18px Orbitron, sans-serif";
  ctx.fillText(`Total: ${items.reduce((s, g) => s + g.qty, 0)} jogos • ${used.toFixed(2)} GB`, 30, y);
  return c.toDataURL("image/jpeg", 0.9);
}
function truncate(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  while (text.length && ctx.measureText(text + "...").width > maxW) text = text.slice(0, -1);
  return text + "...";
}
/* ============ 8. WHATSAPP ============ */
function openWhatsApp(o) {
  const wpp = (state.settings.whatsapp || DEFAULT_WHATSAPP).replace(/\D/g, "");
  const txt =
`*Nova Lista PS2 Retrô*
Nome: ${o.nome} ${o.sobrenome}
Cidade/UF: ${o.cidade} - ${o.uf}
WhatsApp: ${o.whatsapp}
Pendrive: ${o.pendrive}
Qtd. jogos: ${o.lista.reduce((s, g) => s + g.qty, 0)}
Espaço utilizado: ${o.usado.toFixed(2)} GB
Espaço restante: ${o.restante.toFixed(2)} GB
Lista enviada pelo site.`;
  const url = `https://wa.me/${wpp}?text=${encodeURIComponent(txt)}`;
  window.open(url, "_blank");
}
/* ============ 9. PAINEL ADMIN ============ */
function bootAdmin() {
  $$(".admin-link[data-tab]").forEach(a => a.onclick = () => switchTab(a.dataset.tab));
  loadSettingsIntoForm();
}
function switchTab(tab) {
  $$(".admin-link").forEach(a => a.classList.toggle("active", a.dataset.tab === tab));
  $$(".admin-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
}
function refreshStats() {
  if (!$("#st-orders")) return;
  $("#st-orders").textContent = state.orders.length;
  $("#st-games").textContent = state.games.length;
  $("#st-cats").textContent = state.categories.length;
  $("#st-pend").textContent = state.orders.filter(o => o.status === "pendente").length;
}
/* --- Pedidos --- */
$("#orders-search").addEventListener("input", renderOrders);
$("#orders-sort").addEventListener("change", renderOrders);
function renderOrders() {
  const box = $("#orders-list"); if (!box) return;
  const q = $("#orders-search")?.value.toLowerCase() || "";
  const sort = $("#orders-sort")?.value || "recent";
  let list = [...state.orders];
  if (q) list = list.filter(o => `${o.nome} ${o.sobrenome} ${o.cidade} ${o.whatsapp}`.toLowerCase().includes(q));
  const sorters = {
    recent: (a, b) => (b.timestamp || 0) - (a.timestamp || 0),
    old: (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
    city: (a, b) => (a.cidade || "").localeCompare(b.cidade || ""),
    name: (a, b) => (a.nome || "").localeCompare(b.nome || ""),
    status: (a, b) => (a.status || "").localeCompare(b.status || ""),
  };
  list.sort(sorters[sort]);
  box.innerHTML = `
    <table class="data">
      <thead><tr><th>Data</th><th>Cliente</th><th>Cidade</th><th>Pendrive</th><th>Uso</th><th>Status</th><th>Ações</th></tr></thead>
      <tbody>
        ${list.map(o => `
          <tr>
            <td>${o.data || ""}<br><small>${o.hora || ""}</small></td>
            <td>${o.nome} ${o.sobrenome}<br><small>${o.whatsapp}</small></td>
            <td>${o.cidade}/${o.uf}</td>
            <td>${o.pendrive}</td>
            <td>${(o.usado || 0).toFixed(2)} GB</td>
            <td><span class="status ${o.status === "finalizada" ? "done" : "pending"}">${o.status}</span></td>
            <td class="actions-cell">
              <button data-view="${o.id}">👁️</button>
              <button data-dl="${o.id}">⬇️</button>
              ${o.status !== "finalizada" ? `<button data-done="${o.id}">✔</button>` : ""}
              <button class="del" data-delo="${o.id}">🗑️</button>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;
  box.querySelectorAll("[data-view]").forEach(b => b.onclick = () => viewOrderImg(b.dataset.view));
  box.querySelectorAll("[data-dl]").forEach(b => b.onclick = () => downloadOrderImg(b.dataset.dl));
  box.querySelectorAll("[data-done]").forEach(b => b.onclick = () => setOrderStatus(b.dataset.done, "finalizada"));
  box.querySelectorAll("[data-delo]").forEach(b => b.onclick = () => deleteOrder(b.dataset.delo));
}
function viewOrderImg(id) {
  const o = state.orders.find(x => x.id === id); if (!o?.imagem) return toast("Sem imagem", "warn");
  const w = window.open("");
  w.document.write(`<title>Lista ${o.nome}</title><body style="margin:0;background:#000;text-align:center"><img src="${o.imagem}" style="max-width:100%">`);
}
function downloadOrderImg(id) {
  const o = state.orders.find(x => x.id === id); if (!o?.imagem) return;
  const a = document.createElement("a");
  a.href = o.imagem; a.download = `lista-${o.nome}-${o.sobrenome}.jpg`; a.click();
}
async function setOrderStatus(id, status) {
  await db.ref("orders/" + id).update({ status });
  toast("Status atualizado", "success");
}
async function deleteOrder(id) {
  if (!(await confirmDialog("Excluir pedido definitivamente?"))) return;
  await db.ref("orders/" + id).remove();
  toast("Pedido excluído", "success");
}
/* --- Jogos --- */
$("#btn-new-game")?.addEventListener("click", () => openGameForm());
function renderAdminGames() {
  const box = $("#admin-games-list"); if (!box) return;
  box.innerHTML = `
    <table class="data">
      <thead><tr><th>Capa</th><th>Nome</th><th>Categoria</th><th>GB</th><th>Ações</th></tr></thead>
      <tbody>
        ${state.games.map(g => `
          <tr>
            <td><img src="${g.capa || ""}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;background:#0b0f1e"></td>
            <td>${g.nome}</td><td>${g.categoria || ""}</td><td>${(g.tamanho || 0).toFixed(2)}</td>
            <td class="actions-cell">
              <button data-edit="${g.id}">✏️</button>
              <button class="del" data-delg="${g.id}">🗑️</button>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;
  box.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openGameForm(b.dataset.edit));
  box.querySelectorAll("[data-delg]").forEach(b => b.onclick = async () => {
    if (!(await confirmDialog("Excluir este jogo?"))) return;
    await db.ref("games/" + b.dataset.delg).remove();
    toast("Excluído", "success");
  });
}
function populateGameFormCats() {
  const sel = $("#gf-cat"); if (!sel) return;
  sel.innerHTML = state.categories.map(c => `<option>${c.nome}</option>`).join("");
}
function openGameForm(id) {
  const form = $("#form-game"); form.reset();
  populateGameFormCats();
  if (id) {
    const g = state.games.find(x => x.id === id); if (!g) return;
    $("#gf-title").textContent = "Editar jogo";
    form.id.value = g.id;
    form.nome.value = g.nome || ""; form.categoria.value = g.categoria || "";
    form.capa.value = g.capa || ""; form.tamanho.value = g.tamanho || 0;
    form.compatibilidade.value = g.compatibilidade || ""; form.descricao.value = g.descricao || "";
  } else { $("#gf-title").textContent = "Novo jogo"; form.id.value = ""; }
  openModal("modal-game-form");
}
$("#form-game").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target).entries());
  fd.tamanho = Number(fd.tamanho);
  const id = fd.id; delete fd.id;
  try {
    if (id) await db.ref("games/" + id).update(fd);
    else await db.ref("games").push(fd);
    toast("Salvo", "success"); closeModal("modal-game-form");
  } catch (err) { toast(err.message, "error"); }
});
/* --- Categorias --- */
$("#form-cat")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = new FormData(e.target).get("nome").trim(); if (!nome) return;
  await db.ref("categories").push({ nome, ordem: state.categories.length });
  e.target.reset();
});
function renderAdminCategories() {
  const box = $("#admin-cats-list"); if (!box) return;
  box.innerHTML = `
    <table class="data">
      <thead><tr><th>Nome</th><th>Ações</th></tr></thead>
      <tbody>
        ${state.categories.map(c => `
          <tr>
            <td><input value="${c.nome}" data-edc="${c.id}" style="background:transparent;border:none"></td>
            <td class="actions-cell">
              <button data-savc="${c.id}">💾</button>
              <button class="del" data-delc="${c.id}">🗑️</button>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;
  box.querySelectorAll("[data-savc]").forEach(b => b.onclick = async () => {
    const inp = box.querySelector(`[data-edc="${b.dataset.savc}"]`);
    await db.ref("categories/" + b.dataset.savc).update({ nome: inp.value });
    toast("Categoria salva", "success");
  });
  box.querySelectorAll("[data-delc]").forEach(b => b.onclick = async () => {
    if (!(await confirmDialog("Excluir categoria?"))) return;
    await db.ref("categories/" + b.dataset.delc).remove();
  });
}
/* --- Pendrives --- */
function renderAdminPendrives() {
  const box = $("#admin-pen-list"); if (!box) return;
  box.innerHTML = state.pendrives.map(p => `
    <div class="inline-form">
      <input value="${p.label}" data-plabel="${p.id}" placeholder="Rótulo">
      <input value="${p.real}" type="number" step="0.01" data-preal="${p.id}" placeholder="GB real">
      <button class="btn btn-primary" data-savp="${p.id}">Salvar</button>
      <button class="btn btn-danger" data-delp="${p.id}">Excluir</button>
    </div>`).join("");
  box.querySelectorAll("[data-savp]").forEach(b => b.onclick = async () => {
    const id = b.dataset.savp;
    const label = box.querySelector(`[data-plabel="${id}"]`).value;
    const real = Number(box.querySelector(`[data-preal="${id}"]`).value);
    await db.ref("pendrives/" + id).update({ label, real });
    toast("Pendrive salvo", "success");
  });
  box.querySelectorAll("[data-delp]").forEach(b => b.onclick = async () => {
    if (!(await confirmDialog("Excluir este pendrive?"))) return;
    await db.ref("pendrives/" + b.dataset.delp).remove();
  });
}
$("#form-pen")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target).entries());
  await db.ref("pendrives").push({ label: fd.label, real: Number(fd.real) });
  e.target.reset();
});
/* --- Configurações --- */
function loadSettingsIntoForm() {
  const f = $("#form-settings"); if (!f) return;
  const s = state.settings || {};
  f.title.value = s.title || ""; f.displayName.value = s.displayName || "";
  f.logo.value = s.logo || ""; f.favicon.value = s.favicon || "";
  f.primary.value = s.primary || "#00e0ff"; f.secondary.value = s.secondary || "#a855f7";
  f.bgImage.value = s.bgImage || ""; f.footer.value = s.footer || "";
  f.whatsapp.value = s.whatsapp || DEFAULT_WHATSAPP; f.theme.value = s.theme || "dark";
}
$("#form-settings")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target).entries());
  await db.ref("settings").update(fd);
  toast("Configurações salvas", "success");
});
/* ============ 10. INIT ============ */
window.addEventListener("load", () => setTimeout(() => showLoader(false), 400));
