// IMPORTAÇÃO DOS MÓDULOS WEB DO FIREBASE (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// CONFIGURAÇÕES DO SEU PROJETO FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyBvdW06QiHlJA5glUKtucX6hL8LdvlTPME",
    authDomain: "sua-lista-e6ef3.firebaseapp.com",
    databaseURL: "https://sua-lista-e6ef3-default-rtdb.firebaseio.com/",
    projectId: "sua-lista-e6ef3",
    storageBucket: "sua-lista-e6ef3.firebasestorage.app",
    messagingSenderId: "689656568290",
    appId: "1:689656568290:web:8f82257c9bb23f8b1481bb"
};

// Inicialização das variáveis do ecossistema Firebase
let app;
let auth;
let database;
let isFirebaseConnected = false;

try {
    if (firebaseConfig.apiKey !== "SUA_API_KEY" && firebaseConfig.apiKey !== "") {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        database = getDatabase(app);
        isFirebaseConnected = true;
        console.log("🔥 Firebase conectado globalmente com sucesso.");
    } else {
        console.warn("⚠️ Firebase ausente ou não configurado. Executando em modo local simulado (Mock).");
    }
} catch (error) {
    console.error("Erro crítico na inicialização do Firebase:", error);
}

// ==========================================
// CONTROLE DE TELAS E REGRAS ANTI-SOBREPOSIÇÃO
// ==========================================
function gerenciarMudancaDeTela(nomeDaSecao) {
    // Coleta todas as seções de formulários da tela de autenticação para esconder
    const todasAsSecoes = document.querySelectorAll('.form-section');
    todasAsSecoes.forEach(secao => {
        secao.classList.remove('active');
    });

    // Coleta os botões das abas superiores para resetar o estilo visual
    const abasSuperiores = document.querySelectorAll('.tab-button');
    abasSuperiores.forEach(aba => {
        aba.classList.remove('active');
    });

    const containerAbas = document.getElementById('navigation-tabs');

    // Aplica a classe active estritamente na seção solicitada, evitando acúmulos na tela
    if (nomeDaSecao === 'cliente') {
        document.getElementById('section-login-cliente').classList.add('active');
        document.getElementById('tab-btn-cliente').classList.add('active');
        if (containerAbas) containerAbas.style.display = 'flex';
    } 
    else if (nomeDaSecao === 'admin') {
        document.getElementById('section-login-admin').classList.add('active');
        document.getElementById('tab-btn-admin').classList.add('active');
        if (containerAbas) containerAbas.style.display = 'flex';
    } 
    else if (nomeDaSecao === 'cadastro') {
        document.getElementById('section-cadastro-cliente').classList.add('active');
        if (containerAbas) containerAbas.style.display = 'none'; // Esconde as abas superiores para focar no cadastro
    }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

// Váriáveis de Estado da Sessão e Aplicação
let currentUserData = null;
let currentDrive = { size: 0, limit: 0 };
let catalogGames = [];
let selectedGames = [];
let loadedAdminGamesRaw = [];
let systemMasterPassword = "admin";

// ==========================================
// CAPTURA DE COMPORTAMENTOS DE BOTÕES E SUB-ABAS
// ==========================================
const btnNavMontador = document.getElementById('btn-nav-montador');
const btnNavPedidos = document.getElementById('btn-nav-pedidos');
const sectionMontador = document.getElementById('sub-section-montador');
const sectionPedidos = document.getElementById('sub-section-pedidos');

if (btnNavMontador && btnNavPedidos) {
    btnNavMontador.addEventListener('click', () => {
        btnNavMontador.classList.add('active');
        btnNavPedidos.classList.remove('active');
        if (sectionMontador) sectionMontador.classList.add('active');
        if (sectionPedidos) sectionPedidos.classList.remove('active');
        loadCatalog();
    });

    btnNavPedidos.addEventListener('click', () => {
        btnNavPedidos.classList.add('active');
        btnNavMontador.classList.remove('active');
        if (sectionPedidos) sectionPedidos.classList.add('active');
        if (sectionMontador) sectionMontador.classList.remove('active');
        loadUserSpecificOrders();
    });
}

// Sincronização em tempo real da senha master corporativa armazenada no banco
if (isFirebaseConnected) {
    onValue(ref(database, 'settings/masterPassword'), (snapshot) => {
        const value = snapshot.val();
        if (value) {
            systemMasterPassword = value;
            const adminInput = document.getElementById('admin-master-input');
            if (adminInput) adminInput.value = value;
        }
    });
}

// Auxiliares de Feedback Visual de carregamento nos botões
function setButtonLoadingState(button, text = "ENTRANDO...") {
    button.disabled = true;
    button.classList.add('loading');
    button.innerText = text;
}

function setGenericButtonFeedback(button, tempText) {
    button.disabled = true;
    button.innerText = tempText;
}

function resetButtonState(button, originalText) {
    button.disabled = false;
    button.classList.remove('loading');
    button.innerText = originalText;
}

// ==========================================
// CADASTRO DE CLIENTE COM VALIDAÇÃO DE USERNAME
// ==========================================
const formUserRegister = document.getElementById('form-cliente-cadastro');
if (formUserRegister) {
    formUserRegister.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('cadastro-username').value.trim().toLowerCase();
        const name = document.getElementById('cadastro-nome').value.trim();
        const lastname = document.getElementById('cadastro-textbox-sobrenome') ? document.getElementById('cadastro-textbox-sobrenome').value.trim() : document.getElementById('cadastro-sobrenome').value.trim();
        const whatsapp = document.getElementById('cadastro-whatsapp').value.trim();
        const city = document.getElementById('cadastro-cidade').value.trim();
        const masterPass = document.getElementById('cadastro-senha-master').value;
        const btnSubmitUserRegister = formUserRegister.querySelector('button[type="submit"]');

        setButtonLoadingState(btnSubmitUserRegister, "CADASTRANDO...");

        if (masterPass !== systemMasterPassword) {
            alert("❌ Senha Master de validação incorreta! Operação abortada.");
            resetButtonState(btnSubmitUserRegister, "Finalizar Meu Cadastro");
            return;
        }

        const newUserPayload = { username, name, lastname, whatsapp, city, role: 'user' };

        if (isFirebaseConnected) {
            const userRef = ref(database, `users/${username}`);
            
            get(userRef).then((snapshot) => {
                if (snapshot.exists()) {
                    alert("❌ Este username já está em uso por outro cliente!");
                    resetButtonState(btnSubmitUserRegister, "Finalizar Meu Cadastro");
                } else {
                    set(userRef, newUserPayload).then(() => {
                        alert("🎉 Conta criada com sucesso! Faça login para continuar.");
                        formUserRegister.reset();
                        resetButtonState(btnSubmitUserRegister, "Finalizar Meu Cadastro");
                        gerenciarMudancaDeTela('cliente');
                    });
                }
            }).catch(err => {
                alert("Erro ao checar o banco de dados: " + err.message);
                resetButtonState(btnSubmitUserRegister, "Finalizar Meu Cadastro");
            });
        } else {
            let localUsers = JSON.parse(localStorage.getItem('mock_users_db') || '{}');
            if (localUsers[username]) {
                alert("❌ Username indisponível localmente.");
                resetButtonState(btnSubmitUserRegister, "Finalizar Meu Cadastro");
                return;
            }
            localUsers[username] = newUserPayload;
            localStorage.setItem('mock_users_db', JSON.stringify(localUsers));
            alert("[MOCK]: Conta criada em cache local!");
            formUserRegister.reset();
            resetButtonState(btnSubmitUserRegister, "Finalizar Meu Cadastro");
            gerenciarMudancaDeTela('cliente');
        }
    });
}

// ==========================================
// LOGIN DO CLIENTE (USERNAME + SENHA MASTER)
// ==========================================
const formUserLogin = document.getElementById('form-cliente-login');
if (formUserLogin) {
    formUserLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('cliente-username').value.trim().toLowerCase();
        const passwordInput = document.getElementById('cliente-senha').value;
        const btnSubmitUserLogin = formUserLogin.querySelector('button[type="submit"]');

        setButtonLoadingState(btnSubmitUserLogin);

        if (passwordInput !== systemMasterPassword) {
            alert("❌ Senha Master corporativa incorreta!");
            resetButtonState(btnSubmitUserLogin, "Entrar no Sistema");
            return;
        }

        if (isFirebaseConnected) {
            get(ref(database, `users/${usernameInput}`)).then((snapshot) => {
                if (snapshot.exists()) {
                    currentUserData = snapshot.val();
                    localStorage.setItem('gamelist_session_v4', JSON.stringify(currentUserData));
                    
                    setupClientEnvironment();
                    resetButtonState(btnSubmitUserLogin, "Entrar no Sistema");
                    showScreen('drive-selection-screen');
                    formUserLogin.reset();
                } else {
                    alert("❌ Usuário não encontrado no sistema! Efetue o cadastro.");
                    resetButtonState(btnSubmitUserLogin, "Entrar no Sistema");
                }
            }).catch(err => {
                alert("Erro de autenticação no servidor: " + err.message);
                resetButtonState(btnSubmitUserLogin, "Entrar no Sistema");
            });
        } else {
            let localUsers = JSON.parse(localStorage.getItem('mock_users_db') || '{}');
            if (localUsers[usernameInput]) {
                currentUserData = localUsers[usernameInput];
                localStorage.setItem('gamelist_session_v4', JSON.stringify(currentUserData));
                setupClientEnvironment();
                resetButtonState(btnSubmitUserLogin, "Entrar no Sistema");
                showScreen('drive-selection-screen');
                formUserLogin.reset();
            } else {
                alert("[MOCK]: Usuário inexistente no banco de testes.");
                resetButtonState(btnSubmitUserLogin, "Entrar no Sistema");
            }
        }
    });
}

function setupClientEnvironment() {
    const welcome = document.getElementById('user-welcome');
    if (welcome) welcome.innerText = `Olá, @${currentUserData.username}`;
    
    if (document.getElementById('tk-username')) document.getElementById('tk-username').innerText = `@${currentUserData.username}`;
    if (document.getElementById('tk-nome')) document.getElementById('tk-nome').innerText = currentUserData.name;
    if (document.getElementById('tk-sobrenome')) document.getElementById('tk-sobrenome').innerText = currentUserData.lastname;
    if (document.getElementById('tk-whatsapp')) document.getElementById('tk-whatsapp').innerText = currentUserData.whatsapp;
    if (document.getElementById('tk-cidade')) document.getElementById('tk-cidade').innerText = currentUserData.city;
}

// ==========================================
// LOGIN DO ADMINISTRADOR (SESSÃO DO ADMIN)
// ==========================================
const formAdmin = document.getElementById('form-admin-login');
if (formAdmin) {
    formAdmin.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const pass = document.getElementById('admin-senha').value;
        const btnSubmitAdmin = formAdmin.querySelector('button[type="submit"]');

        setButtonLoadingState(btnSubmitAdmin);

        if (isFirebaseConnected) {
            signInWithEmailAndPassword(auth, email, pass)
                .then((userCredential) => {
                    currentUserData = { email: userCredential.user.email, role: 'admin' };
                    localStorage.setItem('gamelist_session_v4', JSON.stringify(currentUserData));
                    executeAdminLoginFlow();
                    resetButtonState(btnSubmitAdmin, "Acessar Painel Master");
                })
                .catch(err => {
                    alert("Acesso Negado Administrativo! Verifique suas credenciais.");
                    resetButtonState(btnSubmitAdmin, "Acessar Painel Master");
                });
        } else {
            if (email === "admin@teste.com" && pass === "123456") {
                currentUserData = { email, role: 'admin' };
                localStorage.setItem('gamelist_session_v4', JSON.stringify(currentUserData));
                executeAdminLoginFlow();
                resetButtonState(btnSubmitAdmin, "Acessar Painel Master");
            } else {
                alert("[MOCK]: Use o e-mail admin@teste.com e a senha 123456");
                resetButtonState(btnSubmitAdmin, "Acessar Painel Master");
            }
        }
    });
}

function executeAdminLoginFlow() {
    showScreen('admin-screen');
    if (formAdmin) formAdmin.reset();
    syncCatalogToAdminPanel();
    syncUsersToAdminPanel();
    loadGlobalOrdersForAdmin();
}

// ==========================================
// PERSISTÊNCIA E LOGOUT ANTI-REFRESH DE PÁGINA
// ==========================================
function checkActiveSessionOnLoad() {
    const cachedSession = localStorage.getItem('gamelist_session_v4');
    if (!cachedSession) {
        showScreen('auth-screen');
        return;
    }

    currentUserData = JSON.parse(cachedSession);

    if (currentUserData.role === 'admin') {
        if (isFirebaseConnected) {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    executeAdminLoginFlow();
                } else {
                    processClearLogout();
                }
            });
        } else {
            executeAdminLoginFlow();
        }
    } else if (currentUserData.role === 'user') {
        setupClientEnvironment();
        showScreen('drive-selection-screen');
    }
}

function processClearLogout() {
    if (isFirebaseConnected && auth) signOut(auth);
    currentUserData = null;
    currentDrive = { size: 0, limit: 0 };
    selectedGames = [];
    catalogGames = [];
    
    localStorage.removeItem('gamelist_session_v4');
    if (formUserLogin) formUserLogin.reset();
    if (formUserRegister) formUserRegister.reset();
    if (formAdmin) formAdmin.reset();
    
    if (btnNavMontador) {
        btnNavMontador.classList.add('active');
        btnNavPedidos.classList.remove('active');
        if (sectionMontador) sectionMontador.classList.add('active');
        if (sectionPedidos) sectionPedidos.classList.remove('active');
    }
    
    showScreen('auth-screen');
    gerenciarMudancaDeTela('cliente');
}

if (document.getElementById('logout-btn')) document.getElementById('logout-btn').addEventListener('click', processClearLogout);
if (document.getElementById('app-logout-btn')) document.getElementById('app-logout-btn').addEventListener('click', processClearLogout);
if (document.getElementById('admin-logout-btn')) document.getElementById('admin-logout-btn').addEventListener('click', processClearLogout);

// ==========================================
// SELEÇÃO DO TAMANHO DO PENDRIVE (LIMITES)
// ==========================================
document.querySelectorAll('.drive-card').forEach(card => {
    card.addEventListener('click', () => {
        currentDrive.size = card.dataset.size;
        currentDrive.limit = parseFloat(card.dataset.limit);
        if (document.getElementById('display-drive-name')) document.getElementById('display-drive-name').innerText = `Pendrive ${currentDrive.size}GB`;
        if (document.getElementById('tk-pendrive')) document.getElementById('tk-pendrive').innerText = `${currentDrive.size} GB (Limite Real: ${currentDrive.limit} GB)`;
        
        selectedGames = [];
        showScreen('main-app-screen');
        loadCatalog();
        updateStorageMeter();
    });
});
if (document.getElementById('btn-back-drives')) document.getElementById('btn-back-drives').addEventListener('click', () => { showScreen('drive-selection-screen'); });

// ==========================================
// CONTROLE DO CATÁLOGO DE JOGOS E SELEÇÕES
// ==========================================
function loadCatalog() {
    if (!isFirebaseConnected) {
        catalogGames = [
            { id: "1", title: "GTA San Andreas Ultra", size: "4.3" },
            { id: "2", title: "Resident Evil 4 Remake", size: "3.5" },
            { id: "3", title: "God of War II Nostalgia", size: "7.9" },
            { id: "4", title: "Need For Speed Underground 2", size: "2.1" },
            { id: "5", title: "Crash Bandicoot Trilogy", size: "3.2" }
        ];
        renderCatalogUI();
        return;
    }
    onValue(ref(database, 'catalog'), (snapshot) => {
        const data = snapshot.val();
        catalogGames = [];
        if (data) {
            Object.keys(data).forEach(key => { catalogGames.push({ id: key, ...data[key] }); });
        }
        renderCatalogUI();
    });
}

function renderCatalogUI() {
    const catalogContainer = document.getElementById('catalog-list');
    if (!catalogContainer) return;
    catalogContainer.innerHTML = '';
    
    if (catalogGames.length > 0) {
        catalogGames.forEach(game => {
            const item = document.createElement('div');
            item.classList.add('catalog-item');
            const isChecked = selectedGames.some(g => g.id === game.id) ? 'checked' : '';
            
            item.innerHTML = `
                <div class="game-info"><h4>${game.title}</h4><span>${game.size} GB</span></div>
                <input type="checkbox" class="chk-gamer" data-id="${game.id}" value="${game.size}" ${isChecked}>
            `;
            catalogContainer.appendChild(item);
        });
        document.querySelectorAll('.chk-gamer').forEach(chk => { chk.addEventListener('change', handleGameSelection); });
    } else {
        catalogContainer.innerHTML = '<p style="color: var(--text-muted)">Nenhum jogo cadastrado no momento.</p>';
    }
}

function handleGameSelection(e) {
    const gameId = e.target.dataset.id;
    const game = catalogGames.find(g => g.id === gameId);
    if (e.target.checked) {
        if (!selectedGames.some(g => g.id === gameId)) selectedGames.push(game);
    } else {
        selectedGames = selectedGames.filter(g => g.id !== gameId);
    }
    updateStorageMeter();
    renderTicketList();
}

// Medidor Volumétrico de Espaço Interno do Hardware
function updateStorageMeter() {
    const totalSize = selectedGames.reduce((acc, game) => acc + parseFloat(game.size), 0);
    const limit = currentDrive.limit;
    const percentage = Math.min((totalSize / limit) * 100, 100);
    
    if (document.getElementById('progress-bar')) document.getElementById('progress-bar').style.width = `${percentage}%`;
    if (document.getElementById('storage-text')) document.getElementById('storage-text').innerText = `${totalSize.toFixed(2)} / ${limit.toFixed(2)} GB`;
    if (document.getElementById('game-counter')) document.getElementById('game-counter').innerText = `Jogos selecionados: ${selectedGames.length} (Mínimo necessário: 5)`;
    
    const btnGenerate = document.getElementById('btn-generate-list');
    if (btnGenerate) {
        if (totalSize > limit) {
            if (document.getElementById('progress-bar')) document.getElementById('progress-bar').classList.add('exceeded');
            btnGenerate.disabled = true;
        } else {
            if (document.getElementById('progress-bar')) document.getElementById('progress-bar').classList.remove('exceeded');
            btnGenerate.disabled = selectedGames.length < 5;
        }
    }
}

function renderTicketList() {
    const listContainer = document.getElementById('selected-games-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    
    if (selectedGames.length === 0) { 
        listContainer.classList.add('games-list-vazia'); 
        return; 
    }
    listContainer.classList.remove('games-list-vazia');
    selectedGames.forEach(game => {
        const li = document.createElement('li');
        li.classList.add('ticket-item');
        li.innerHTML = `<span>${game.title}</span> <span>${game.size} GB</span>`;
        listContainer.appendChild(li);
    });
}

// ==========================================
// CAPTURA DO PRINT E ENVIO DE PEDIDO (CLIENTE)
// ==========================================
const btnGenerateList = document.getElementById('btn-generate-list');
if (btnGenerateList) {
    btnGenerateList.addEventListener('click', () => {
        const ticketElement = document.getElementById('ticket-lista');
        
        html2canvas(ticketElement, { 
            backgroundColor: "#ffffff",
            width: 650,
            windowWidth: 1200
        }).then(canvas => {
            const base64Image = canvas.toDataURL('image/jpeg', 0.9);
            
            const orderPayload = {
                client: currentUserData,
                driveSize: currentDrive.size,
                imageB64: base64Image,
                timestamp: Date.now()
            };

            if (isFirebaseConnected) {
                push(ref(database, 'orders'), orderPayload)
                    .then(() => { 
                        alert("🎮 Sua lista de jogos foi capturada e enviada com sucesso!"); 
                        selectedGames = [];
                        renderTicketList();
                        updateStorageMeter();
                        if (btnNavPedidos) btnNavPedidos.click();
                    });
            } else {
                let localOrders = JSON.parse(localStorage.getItem('mock_orders_v2') || '[]');
                orderPayload.id = "ORDER_" + Date.now();
                localOrders.push(orderPayload);
                localStorage.setItem('mock_orders_v2', JSON.stringify(localOrders));
                
                alert("[MOCK MODO TESTE]: Salvo localmente na memória do navegador.");
                selectedGames = [];
                if (btnNavPedidos) btnNavPedidos.click();
            }
        });
    });
}

// ==========================================
// HISTÓRICO PARTICULAR DE SOLICITAÇÕES DO CLIENTE
// ==========================================
function loadUserSpecificOrders() {
    const container = document.getElementById('client-orders-history-list');
    if (!container) return;
    container.innerHTML = '<p style="color: var(--text-muted)">Carregando seu histórico de pedidos direto do servidor...</p>';

    if (!isFirebaseConnected) {
        let localOrders = JSON.parse(localStorage.getItem('mock_orders_v2') || '[]');
        let filtered = localOrders.filter(o => o.client && o.client.username === currentUserData.username);
        renderUserOrdersUI(filtered);
        return;
    }

    onValue(ref(database, 'orders'), (snapshot) => {
        const data = snapshot.val();
        let myOrdersArray = [];
        if (data) {
            Object.keys(data).forEach(key => {
                if (data[key].client && data[key].client.username === currentUserData.username) {
                    myOrdersArray.push({ id: key, ...data[key] });
                }
            });
        }
        renderUserOrdersUI(myOrdersArray);
    });
}

function renderUserOrdersUI(orders) {
    const container = document.getElementById('client-orders-history-list');
    if (!container) return;
    container.innerHTML = '';

    if (orders.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted)">Você não efetuou nenhuma montagem ainda.</p>';
        return;
    }

    orders.sort((a, b) => b.timestamp - a.timestamp);

    orders.forEach(order => {
        const dateFormatted = new Date(order.timestamp).toLocaleString('pt-BR');
        const card = document.createElement('div');
        card.classList.add('client-order-card');
        
        card.innerHTML = `
            <div class="client-order-header">
                <div>
                    <h4>Montagem de ${order.driveSize} GB</h4>
                    <span style="color: var(--neon-green)">Enviado em: ${dateFormatted}</span>
                </div>
                <span style="font-size:12px; opacity:0.5;">ID: ${order.id}</span>
            </div>
            <div class="client-order-body">
                <img src="${order.imageB64}" alt="Lista Capturada">
                <div>
                    <button type="button" class="btn-danger-action btn-delete-my-order" data-id="${order.id}">Cancelar Pedido</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll('.btn-delete-my-order').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const orderId = e.target.dataset.id;
            if (confirm("Deseja apagar esta solicitação do sistema definitivamente?")) {
                if (isFirebaseConnected) {
                    remove(ref(database, `orders/${orderId}`))
                        .then(() => alert("Pedido cancelado e removido."));
                } else {
                    let localOrders = JSON.parse(localStorage.getItem('mock_orders_v2') || '[]');
                    localOrders = localOrders.filter(o => o.id !== orderId);
                    localStorage.setItem('mock_orders_v2', JSON.stringify(localOrders));
                    alert("Removido localmente.");
                    loadUserSpecificOrders();
                }
            }
        });
    });
}

// ==========================================
// PAINEL ADMINISTRATIVO (GERENCIADOR GLOBAL)
// ==========================================
function syncCatalogToAdminPanel() {
    if (!isFirebaseConnected) {
        loadedAdminGamesRaw = [
            { title: "GTA San Andreas Ultra", size: 4.3 },
            { title: "Resident Evil 4 Remake", size: 3.5 }
        ];
        renderAdminManageUI([
            { id: "1", title: "GTA San Andreas Ultra", size: "4.3" },
            { id: "2", title: "Resident Evil 4 Remake", size: "3.5" }
        ]);
        return;
    }
    onValue(ref(database, 'catalog'), (snapshot) => {
        const data = snapshot.val();
        const gamesArray = [];
        loadedAdminGamesRaw = [];
        if (data) {
            Object.keys(data).forEach(key => { 
                gamesArray.push({ id: key, ...data[key] });
                loadedAdminGamesRaw.push({ title: data[key].title, size: parseFloat(data[key].size) });
            });
        }
        renderAdminManageUI(gamesArray);
    });
}

function renderAdminManageUI(games) {
    if(document.getElementById('admin-catalog-count')) document.getElementById('admin-catalog-count').innerText = games.length;
    const container = document.getElementById('admin-catalog-manage-list');
    if (!container) return;
    container.innerHTML = '';

    if (games.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); padding:10px;">Catálogo sem jogos.</p>';
        return;
    }

    games.forEach(game => {
        const div = document.createElement('div');
        div.classList.add('admin-manage-item');
        div.innerHTML = `
            <div>${game.title} <span>(${game.size} GB)</span></div>
            <button type="button" class="btn-delete-game" data-id="${game.id}">❌</button>
        `;
        container.appendChild(div);
    });

    container.querySelectorAll('.btn-delete-game').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gameId = e.target.dataset.id;
            if (confirm("Remover permanentemente este título do acervo?")) {
                if (isFirebaseConnected) remove(ref(database, `catalog/${gameId}`));
            }
        });
    });
}

function syncUsersToAdminPanel() {
    const userContainer = document.getElementById('admin-users-manage-list');
    if (!userContainer) return;

    if (!isFirebaseConnected) {
        userContainer.innerHTML = '<p style="color: var(--text-muted); padding: 10px;">Modo teste local ativo.</p>';
        return;
    }

    onValue(ref(database, 'users'), (snapshot) => {
        userContainer.innerHTML = '';
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(usernameKey => {
                const user = data[usernameKey];
                const div = document.createElement('div');
                div.classList.add('admin-manage-item');
                div.innerHTML = `
                    <div><strong>@${user.username}</strong> <span>(${user.name})</span></div>
                    <button type="button" class="btn-delete-game btn-purge-user" data-username="${user.username}">❌</button>
                `;
                userContainer.appendChild(div);
            });

            userContainer.querySelectorAll('.btn-purge-user').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const targetUser = e.currentTarget.dataset.username;
                    if (confirm(`⚠️ EXPULSAR DO BANCO:\nDeseja DELETAR em definitivo o cliente @${targetUser}? Ele perderá o acesso imediatamente.`)) {
                        remove(ref(database, `users/${targetUser}`))
                            .then(() => alert(`Usuário @${targetUser} foi expulso.`));
                    }
                });
            });
        } else {
            userContainer.innerHTML = '<p style="color: var(--text-muted); padding: 10px;">Nenhum usuário registrado.</p>';
        }
    });
}

// Inserção Manual de Jogos Únicos
const formAddGame = document.getElementById('form-add-game');
if (formAddGame) {
    formAddGame.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('game-title').value;
        const size = document.getElementById('game-size').value;

        if (isFirebaseConnected) {
            push(ref(database, 'catalog'), { title: title, size: parseFloat(size).toFixed(1) }).then(() => {
                alert("Título inserido com sucesso!");
                formAddGame.reset();
            });
        } else {
            alert("Título emulado no painel de testes.");
            formAddGame.reset();
        }
    });
}

// Ferramenta Bulk-Import (JSON em lote)
const btnImportJson = document.getElementById('btn-import-json');
if (btnImportJson) {
    btnImportJson.addEventListener('click', (e) => {
        const rawJson = document.getElementById('json-import-textarea').value.trim();
        const btn = e.target;

        if (!rawJson) { alert("Por favor, cole a estrutura de dados JSON para prosseguir!"); return; }

        try {
            const gamesList = JSON.parse(rawJson);
            if (!Array.isArray(gamesList)) { alert("O código estrutural precisa obrigatoriamente ser um Array!"); return; }

            if (confirm(`Deseja injetar em lote os ${gamesList.length} jogos catalogados no JSON?`)) {
                setGenericButtonFeedback(btn, "IMPORTANDO JOGOS...");
                
                if (isFirebaseConnected) {
                    const catalogRef = ref(database, 'catalog');
                    let promises = gamesList.map(game => {
                        return push(catalogRef, { title: game.title, size: parseFloat(game.size).toFixed(1) });
                    });

                    Promise.all(promises).then(() => {
                        alert("Injeção em lote finalizada!");
                        document.getElementById('json-import-textarea').value = "";
                        resetButtonState(btn, "Importar JSON");
                    });
                } else {
                    alert(`[MOCK]: ${gamesList.length} processados localmente.`);
                    resetButtonState(btn, "Importar JSON");
                }
            }
        } catch (err) {
            alert("Falha estrutural na codificação do JSON: " + err.message);
        }
    });
}

// Backup em Lote (Exportar Catálogo em JSON)
const btnExportJson = document.getElementById('btn-export-json');
if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
        if (loadedAdminGamesRaw.length === 0) { alert("Nenhum dado ativo disponível para exportação."); return; }
        try {
            const jsonString = JSON.stringify(loadedAdminGamesRaw, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_gamelist_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert("Falha de exportação de dados: " + e.message);
        }
    });
}

if(document.getElementById('btn-clear-catalog')) {
    document.getElementById('btn-clear-catalog').addEventListener('click', () => {
        if (confirm("Deseja DELETAR TODO o catálogo de jogos público definitivamente?")) {
            if (isFirebaseConnected) remove(ref(database, 'catalog'));
        }
    });
}

// Alteração de Senha Corporativa Master
const formUpdateMaster = document.getElementById('form-update-master');
if (formUpdateMaster) {
    formUpdateMaster.addEventListener('submit', (e) => {
        e.preventDefault();
        const newMaster = document.getElementById('admin-master-input').value;
        const btn = document.getElementById('btn-update-master');
        
        setGenericButtonFeedback(btn, "ATUALIZANDO...");
        if (isFirebaseConnected) {
            set(ref(database, 'settings/masterPassword'), newMaster).then(() => {
                alert("Nova Senha Master em operação no banco!");
                resetButtonState(btn, "Atualizar Senha");
            });
        } else {
            systemMasterPassword = newMaster;
            alert("Nova senha local configurada.");
            resetButtonState(btn, "Atualizar Senha");
        }
    });
}

// ==========================================
// FILA DE PEDIDOS RECEBIDOS (VER E BAIXAR LISTAS)
// ==========================================
function loadGlobalOrdersForAdmin() {
    if (!isFirebaseConnected) return;
    onValue(ref(database, 'orders'), (snapshot) => {
        const container = document.getElementById('orders-container');
        if (!container) return;
        container.innerHTML = '';
        const data = snapshot.val();
        
        if (data) {
            Object.keys(data).forEach(key => {
                const order = data[key];
                const box = document.createElement('div');
                box.classList.add('order-box');
                
                box.innerHTML = `
                    <div class="order-box-header">
                        <div class="order-box-details">
                            <p><strong>Username:</strong> @${order.client.username}</p>
                            <p><strong>Nome do Cliente:</strong> ${order.client.name} ${order.client.lastname}</p>
                            <p><strong>Contato/WhatsApp:</strong> ${order.client.whatsapp} | <strong>Cidade:</strong> ${order.client.city}</p>
                            <p><strong>Hardware Escolhido:</strong> Pendrive de ${order.driveSize}GB</p>
                        </div>
                        <div class="admin-order-actions">
                            <button type="button" class="btn-info-action btn-view-order-list" data-img="${order.imageB64}">Ver lista</button>
                            <button type="button" class="btn-success-action btn-download-order-list" data-username="${order.client.username}" data-img="${order.imageB64}">Baixar lista</button>
                            <button type="button" class="btn-danger-action btn-purge-order" data-orderid="${key}">Remover Pedido</button>
                        </div>
                    </div>
                    <img src="${order.imageB64}" alt="Print Completo do Pedido">
                `;
                container.appendChild(box);
            });

            // AÇÃO ADICIONADA: Ver lista (Abre a captura limpa em outra aba do navegador)
            container.querySelectorAll('.btn-view-order-list').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const base64Data = e.currentTarget.dataset.img;
                    const novaAba = window.open();
                    if(novaAba) {
                        novaAba.document.write(`<title>Visualizar Ticket de Lista</title><body style="margin:0; background:#0d0e12; display:flex; justify-content:center; align-items:center; min-height:100vh;"><img src="${base64Data}" style="max-width:100%; height:auto; border:2px solid #24262f; border-radius:8px; box-shadow: 0 0 20px rgba(0,0,0,0.8);"></body>`);
                    } else {
                        alert("Por favor, ative a liberação de Pop-ups no seu navegador para abrir a imagem.");
                    }
                });
            });

            // AÇÃO ADICIONADA: Baixar lista (Força o download direto em arquivo .jpg)
            container.querySelectorAll('.btn-download-order-list').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const base64Data = e.currentTarget.dataset.img;
                    const clientUser = e.currentTarget.dataset.username;
                    const linkDownload = document.createElement('a');
                    linkDownload.href = base64Data;
                    linkDownload.download = `lista_jogos_${clientUser}_${Date.now()}.jpg`;
                    document.body.appendChild(linkDownload);
                    linkDownload.click();
                    document.body.removeChild(linkDownload);
                });
            });

            // Ação Admin: Expurgar registro da fila
            container.querySelectorAll('.btn-purge-order').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idDoPedido = e.currentTarget.dataset.orderid;
                    if (confirm("Deseja arquivar e apagar de forma definitiva o registro deste pedido de sua fila global?")) {
                        remove(ref(database, `orders/${idDoPedido}`))
                            .then(() => alert("Registro expurgado da base ativa."));
                    }
                });
            });
        } else {
            container.innerHTML = '<p style="color: var(--text-muted)">Nenhum pedido pendente de montagem na fila global.</p>';
        }
    });
}

// ==========================================
// ESCUTAS AUTOMÁTICAS DE INICIALIZAÇÃO DA PÁGINA
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    // Roda verificação anti-refresh de persistência de conta logada
    checkActiveSessionOnLoad();

    // Vincula cliques nas abas superiores da tela de login/cadastro para evitar sobreposições
    if (document.getElementById('tab-btn-cliente')) {
        document.getElementById('tab-btn-cliente').addEventListener('click', () => {
            gerenciarMudancaDeTela('cliente');
        });
    }

    if (document.getElementById('tab-btn-admin')) {
        document.getElementById('tab-btn-admin').addEventListener('click', () => {
            gerenciarMudancaDeTela('admin');
        });
    }

    // Vincula cliques nos links alternadores em formato de texto
    if (document.getElementById('link-abrir-cadastro')) {
        document.getElementById('link-abrir-cadastro').addEventListener('click', () => {
            gerenciarMudancaDeTela('cadastro');
        });
    }

    if (document.getElementById('link-voltar-login')) {
        document.getElementById('link-voltar-login').addEventListener('click', () => {
            gerenciarMudancaDeTela('cliente');
        });
    }
    
    // Pooling de verificação secundária em tempo real a cada 5 segundos no painel administrativo
    setInterval(() => {
        const adminPanel = document.getElementById('admin-screen');
        if (adminPanel && adminPanel.classList.contains('active')) {
            loadGlobalOrdersForAdmin();
        }
    }, 5000);
});
