// IMPORTAÇÃO DOS MÓDULOS WEB DO FIREBASE (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// COLE SUAS CONFIGURAÇÕES DO FIREBASE AQUI
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_AUTH_DOMAIN",
    databaseURL: "SUA_DATABASE_URL",
    projectId: "SEU_PROJECT_ID",
    storageBucket: "SEU_STORAGE_BUCKET",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID",
    appId: "SEU_APP_ID"
};

// Inicialização das variáveis do ecossistema Firebase
let app, auth, database;
let isFirebaseConnected = false;

try {
    if (firebaseConfig.apiKey !== "SUA_API_KEY" && firebaseConfig.apiKey !== "") {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        database = getDatabase(app);
        isFirebaseConnected = true;
        console.log("🔥 Firebase conectado globalmente.");
    } else {
        console.warn("⚠️ Firebase ausente. Executando em arquitetura mock/local.");
    }
} catch (error) {
    console.error("Erro na inicialização do Firebase:", error);
}

// Elementos DOM de Controle de Acesso e Alternâncias
const tabUser = document.getElementById('tab-user');
const tabAdmin = document.getElementById('tab-admin');
const formUserLogin = document.getElementById('form-user-login');
const formUserRegister = document.getElementById('form-user-register');
const formAdmin = document.getElementById('form-admin');

const btnSubmitUserLogin = document.getElementById('btn-submit-user-login');
const btnSubmitUserRegister = document.getElementById('btn-submit-user-register');
const btnSubmitAdmin = document.getElementById('btn-submit-admin');

const linkGoToRegister = document.getElementById('link-go-to-register');
const linkGoToLogin = document.getElementById('link-go-to-login');
const authTabsContainer = document.getElementById('auth-tabs-container');

// Elementos de Navegação das Abas do Cliente
const btnNavMontador = document.getElementById('btn-nav-montador');
const btnNavPedidos = document.getElementById('btn-nav-pedidos');
const sectionMontador = document.getElementById('sub-section-montador');
const sectionPedidos = document.getElementById('sub-section-pedidos');

// Estado da Sessão Atual
let currentUserData = null;
let currentDrive = { size: 0, limit: 0 };
let catalogGames = [];
let selectedGames = [];
let loadedAdminGamesRaw = [];
let systemMasterPassword = "admin";

// Gerenciamento e Escuta Ativa de Telas e Sub-abas
if (btnNavMontador && btnNavPedidos) {
    btnNavMontador.addEventListener('click', () => {
        btnNavMontador.classList.add('active');
        btnNavPedidos.classList.remove('active');
        sectionMontador.classList.add('active');
        sectionPedidos.classList.remove('active');
        loadCatalog();
    });

    btnNavPedidos.addEventListener('click', () => {
        btnNavPedidos.classList.add('active');
        btnNavMontador.classList.remove('active');
        sectionPedidos.classList.add('active');
        sectionMontador.classList.remove('active');
        loadUserSpecificOrders();
    });
}

// Alternância para o formulário de Cadastro do Cliente
linkGoToRegister.addEventListener('click', () => {
    formUserLogin.style.display = 'none';
    formUserRegister.style.display = 'flex';
});

// Alternância para voltar ao Login do Cliente
linkGoToLogin.addEventListener('click', () => {
    formUserRegister.style.display = 'none';
    formUserLogin.style.display = 'flex';
});

// Escuta ativa para sincronizar a Senha Master do banco de dados Realtime
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

// Trocas de Abas Principais (Cliente vs Admin) na tela de autenticação
tabUser.addEventListener('click', (e) => {
    e.preventDefault();
    tabUser.classList.add('active');
    tabAdmin.classList.remove('active');
    formUserLogin.style.display = 'flex';
    formUserRegister.style.display = 'none';
    formAdmin.style.display = 'none';
});

tabAdmin.addEventListener('click', (e) => {
    e.preventDefault();
    tabAdmin.classList.add('active');
    tabUser.classList.remove('active');
    formUserLogin.style.display = 'none';
    formUserRegister.style.display = 'none';
    formAdmin.style.display = 'flex';
});

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

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

// ROTINA 1: CADASTRO COMPLETO DO CLIENTE COM USERNAME NO REALTIME DATABASE
formUserRegister.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim().toLowerCase();
    const name = document.getElementById('reg-name').value.trim();
    const lastname = document.getElementById('reg-lastname').value.trim();
    const whatsapp = document.getElementById('reg-whatsapp').value.trim();
    const city = document.getElementById('reg-city').value.trim();
    const masterPass = document.getElementById('reg-master-password').value;

    setButtonLoadingState(btnSubmitUserRegister, "CADASTRANDO...");

    // Validação de Segurança Base com a Senha Master
    if (masterPass !== systemMasterPassword) {
        alert("❌ Senha Master de validação incorreta! Operação cancelada.");
        resetButtonState(btnSubmitUserRegister, "Criar Minha Conta");
        return;
    }

    const newUserPayload = { username, name, lastname, whatsapp, city, role: 'user' };

    if (isFirebaseConnected) {
        const userRef = ref(database, `users/${username}`);
        
        // Verifica se o username já existe no banco antes de gravar
        get(userRef).then((snapshot) => {
            if (snapshot.exists()) {
                alert("❌ Este username já está sendo utilizado por outro cliente!");
                resetButtonState(btnSubmitUserRegister, "Criar Minha Conta");
            } else {
                set(userRef, newUserPayload).then(() => {
                    alert("🎉 Conta criada com sucesso! Faça login com suas credenciais.");
                    formUserRegister.reset();
                    resetButtonState(btnSubmitUserRegister, "Criar Minha Conta");
                    linkGoToLogin.click();
                });
            }
        }).catch(err => {
            alert("Erro ao checar banco: " + err.message);
            resetButtonState(btnSubmitUserRegister, "Criar Minha Conta");
        });
    } else {
        // Fluxo Local de Fallback
        let localUsers = JSON.parse(localStorage.getItem('mock_users_db') || '{}');
        if (localUsers[username]) {
            alert("❌ Username indisponível.");
            resetButtonState(btnSubmitUserRegister, "Criar Minha Conta");
            return;
        }
        localUsers[username] = newUserPayload;
        localStorage.setItem('mock_users_db', JSON.stringify(localUsers));
        alert("[MOCK]: Conta criada localmente!");
        formUserRegister.reset();
        resetButtonState(btnSubmitUserRegister, "Criar Minha Conta");
        linkGoToLogin.click();
    }
});

// ROTINA 2: LOGIN DO CLIENTE BASEADO EM USERNAME + VALIDAÇÃO DA SENHA MASTER
formUserLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById('login-username').value.trim().toLowerCase();
    const passwordInput = document.getElementById('login-master-password').value;

    setButtonLoadingState(btnSubmitUserLogin);

    if (passwordInput !== systemMasterPassword) {
        alert("❌ Senha Master incorreta!");
        resetButtonState(btnSubmitUserLogin, "Entrar no Sistema");
        return;
    }

    if (isFirebaseConnected) {
        get(ref(database, `users/${usernameInput}`)).then((snapshot) => {
            if (snapshot.exists()) {
                currentUserData = snapshot.val();
                localStorage.setItem('gamelist_session_v2', JSON.stringify(currentUserData));
                
                setupClientEnvironment();
                resetButtonState(btnSubmitUserLogin, "Entrar no Sistema");
                showScreen('drive-selection-screen');
                formUserLogin.reset();
            } else {
                alert("❌ Usuário não encontrado no sistema! Realize o cadastro.");
                resetButtonState(btnSubmitUserLogin, "Entrar no Sistema");
            }
        }).catch(err => {
            alert("Erro de autenticação: " + err.message);
            resetButtonState(btnSubmitUserLogin, "Entrar no Sistema");
        });
    } else {
        // Validação Simulatória Local
        let localUsers = JSON.parse(localStorage.getItem('mock_users_db') || '{}');
        if (localUsers[usernameInput]) {
            currentUserData = localUsers[usernameInput];
            localStorage.setItem('gamelist_session_v2', JSON.stringify(currentUserData));
            setupClientEnvironment();
            resetButtonState(btnSubmitUserLogin, "Entrar no Sistema");
            showScreen('drive-selection-screen');
            formUserLogin.reset();
        } else {
            alert("[MOCK]: Usuário inexistente.");
            resetButtonState(btnSubmitUserLogin, "Entrar no Sistema");
        }
    }
});

function setupClientEnvironment() {
    document.getElementById('user-welcome').innerText = `Olá, @${currentUserData.username}`;
    document.getElementById('tk-username').innerText = `@${currentUserData.username}`;
    document.getElementById('tk-nome').innerText = currentUserData.name;
    document.getElementById('tk-sobrenome').innerText = currentUserData.lastname;
    document.getElementById('tk-whatsapp').innerText = currentUserData.whatsapp;
    document.getElementById('tk-cidade').innerText = currentUserData.city;
}

// ROTINA 3: LOGIN DO ADMINISTRADOR
formAdmin.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-password').value;

    setButtonLoadingState(btnSubmitAdmin);

    if (isFirebaseConnected) {
        signInWithEmailAndPassword(auth, email, pass)
            .then((userCredential) => {
                currentUserData = { email: userCredential.user.email, role: 'admin' };
                localStorage.setItem('gamelist_session_v2', JSON.stringify(currentUserData));
                executeAdminLoginFlow();
            })
            .catch(err => {
                alert("Acesso Negado! Verifique os dados de administrador.");
                resetButtonState(btnSubmitAdmin, "Acessar Painel");
            });
    } else {
        if (email === "admin@teste.com" && pass === "123456") {
            currentUserData = { email, role: 'admin' };
            localStorage.setItem('gamelist_session_v2', JSON.stringify(currentUserData));
            executeAdminLoginFlow();
        } else {
            alert("[MOCK]: Utilize admin@teste.com e 123456");
            resetButtonState(btnSubmitAdmin, "Acessar Painel");
        }
    }
});

function executeAdminLoginFlow() {
    showScreen('admin-screen');
    formAdmin.reset();
    resetButtonState(btnSubmitAdmin, "Acessar Painel");
    syncCatalogToAdminPanel();
}

// PERSISTÊNCIA COMPLETA DE SESSÃO ATIVA (MECANISMO ANTI-REFRESH / F5)
function checkActiveSessionOnLoad() {
    const cachedSession = localStorage.getItem('gamelist_session_v2');
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

// LIMPEZA COMPLETA DE LOGOUT
function processClearLogout() {
    if (isFirebaseConnected) signOut(auth);
    currentUserData = null;
    currentDrive = { size: 0, limit: 0 };
    selectedGames = [];
    catalogGames = [];
    
    localStorage.removeItem('gamelist_session_v2');
    formUserLogin.reset();
    formUserRegister.reset();
    formAdmin.reset();
    
    resetButtonState(btnSubmitUserLogin, "Entrar no Sistema");
    resetButtonState(btnSubmitAdmin, "Acessar Painel");
    
    if (btnNavMontador) {
        btnNavMontador.classList.add('active');
        btnNavPedidos.classList.remove('active');
        sectionMontador.classList.add('active');
        sectionPedidos.classList.remove('active');
    }
    
    showScreen('auth-screen');
}

document.getElementById('logout-btn').addEventListener('click', processClearLogout);
document.getElementById('app-logout-btn').addEventListener('click', processClearLogout);
document.getElementById('admin-logout-btn').addEventListener('click', processClearLogout);

// SELEÇÃO DE PENDRIVE
document.querySelectorAll('.drive-card').forEach(card => {
    card.addEventListener('click', () => {
        currentDrive.size = card.dataset.size;
        currentDrive.limit = parseFloat(card.dataset.limit);
        document.getElementById('display-drive-name').innerText = `Pendrive ${currentDrive.size}GB`;
        document.getElementById('tk-pendrive').innerText = `${currentDrive.size} GB (Limite: ${currentDrive.limit} GB Real)`;
        
        selectedGames = [];
        showScreen('main-app-screen');
        loadCatalog();
        updateStorageMeter();
    });
});
document.getElementById('btn-back-drives').addEventListener('click', () => { showScreen('drive-selection-screen'); });

// FLUXO DO CATÁLOGO DE JOGOS DO CLIENTE
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
        catalogContainer.innerHTML = '<p style="color: var(--text-muted)">Nenhum jogo disponível.</p>';
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

function updateStorageMeter() {
    const totalSize = selectedGames.reduce((acc, game) => acc + parseFloat(game.size), 0);
    const limit = currentDrive.limit;
    const percentage = Math.min((totalSize / limit) * 100, 100);
    document.getElementById('progress-bar').style.width = `${percentage}%`;
    document.getElementById('storage-text').innerText = `${totalSize.toFixed(2)} / ${limit.toFixed(2)} GB`;
    document.getElementById('game-counter').innerText = `Jogos selecionados: ${selectedGames.length} (Mínimo 5)`;
    
    const btnGenerate = document.getElementById('btn-generate-list');
    if (totalSize > limit) {
        document.getElementById('progress-bar').classList.add('exceeded');
        btnGenerate.disabled = true;
    } else {
        document.getElementById('progress-bar').classList.remove('exceeded');
        btnGenerate.disabled = selectedGames.length < 5;
    }
}

function renderTicketList() {
    const listContainer = document.getElementById('selected-games-list');
    listContainer.innerHTML = '';
    if (selectedGames.length === 0) { listContainer.classList.add('games-list-vazia'); return; }
    listContainer.classList.remove('games-list-vazia');
    selectedGames.forEach(game => {
        const li = document.createElement('li');
        li.classList.add('ticket-item');
        li.innerHTML = `<span>${game.title}</span> <span>${game.size} GB</span>`;
        listContainer.appendChild(li);
    });
}

// CAPTURA DA IMAGEM EM ALTA QUALIDADE E CRIAÇÃO DO PEDIDO
document.getElementById('btn-generate-list').addEventListener('click', () => {
    const ticketElement = document.getElementById('ticket-lista');
    
    // Configurações do html2canvas para garantir largura padrão mesmo em telas minimizadas
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
                    alert("🎮 Pedido enviado com sucesso!"); 
                    selectedGames = [];
                    renderTicketList();
                    updateStorageMeter();
                    btnNavPedidos.click();
                });
        } else {
            let localOrders = JSON.parse(localStorage.getItem('mock_orders_v2') || '[]');
            orderPayload.id = "ORDER_" + Date.now();
            localOrders.push(orderPayload);
            localStorage.setItem('mock_orders_v2', JSON.stringify(localOrders));
            
            alert("[MODO TESTE]: Gravado no Cache Local do Navegador.");
            selectedGames = [];
            btnNavPedidos.click();
        }
    });
});

// HISTÓRICO PARTICULAR: FILTRAGEM POR USERNAME ÚNICO DO CLIENTE
function loadUserSpecificOrders() {
    const container = document.getElementById('client-orders-history-list');
    container.innerHTML = '<p style="color: var(--text-muted)">Carregando seu histórico de pedidos...</p>';

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
    container.innerHTML = '';

    if (orders.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted)">Nenhum pedido efetuado sob este usuário.</p>';
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
                <img src="${order.imageB64}" alt="Lista Físico-Digital">
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
            if (confirm("Deseja deletar este pedido do sistema de forma permanente?")) {
                if (isFirebaseConnected) {
                    remove(ref(database, `orders/${orderId}`))
                        .then(() => alert("Pedido excluído!"));
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

// CONTROLADORES EXCLUSIVOS DO PAINEL ADMINISTRATIVO (ADMIN)
function syncCatalogToAdminPanel() {
    if (!isFirebaseConnected) {
        loadedAdminGamesRaw = [
            { title: "GTA San Andreas Ultra", size: 4.3 },
            { title: "Resident Evil 4 Remake", size: 3.5 },
            { title: "God of War II Nostalgia", size: 7.9 }
        ];
        renderAdminManageUI([
            { id: "1", title: "GTA San Andreas Ultra", size: "4.3" },
            { id: "2", title: "Resident Evil 4 Remake", size: "3.5" },
            { id: "3", title: "God of War II Nostalgia", size: "7.9" }
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
    document.getElementById('admin-catalog-count').innerText = games.length;
    const container = document.getElementById('admin-catalog-manage-list');
    container.innerHTML = '';

    if (games.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); padding:10px;">Catálogo vazio.</p>';
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
            if (confirm("Remover este jogo do catálogo público?")) {
                if (isFirebaseConnected) {
                    remove(ref(database, `catalog/${gameId}`));
                }
            }
        });
    });
}

// Cadastro Manual de Jogos pelo Administrador
document.getElementById('form-add-game').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('game-title').value;
    const size = document.getElementById('game-size').value;

    if (isFirebaseConnected) {
        push(ref(database, 'catalog'), { title: title, size: parseFloat(size).toFixed(1) }).then(() => {
            alert("Jogo adicionado com sucesso!");
            document.getElementById('form-add-game').reset();
        });
    } else {
        alert("Inserido com sucesso na simulação.");
        document.getElementById('form-add-game').reset();
    }
});

// Importador em Lote JSON
document.getElementById('btn-import-json').addEventListener('click', (e) => {
    const rawJson = document.getElementById('json-import-textarea').value.trim();
    const btn = e.target;

    if (!rawJson) { alert("Cole o código JSON estruturado antes!"); return; }

    try {
        const gamesList = JSON.parse(rawJson);
        if (!Array.isArray(gamesList)) { alert("O JSON deve conter um Array de objetos!"); return; }

        if (confirm(`Confirmar a injeção em lote de ${gamesList.length} jogos?`)) {
            setGenericButtonFeedback(btn, "PROCESSANDO...");
            
            if (isFirebaseConnected) {
                const catalogRef = ref(database, 'catalog');
                let promises = gamesList.map(game => {
                    return push(catalogRef, { title: game.title, size: parseFloat(game.size).toFixed(1) });
                });

                Promise.all(promises).then(() => {
                    alert("Injeção em lote concluída!");
                    document.getElementById('json-import-textarea').value = "";
                    resetButtonState(btn, "Importar JSON");
                });
            } else {
                alert(`[MOCK]: Injetado ${gamesList.length} itens.`);
                resetButtonState(btn, "Importar JSON");
            }
        }
    } catch (err) {
        alert("Erro na leitura do JSON: " + err.message);
    }
});

// Exportador em Bloco JSON
document.getElementById('btn-export-json').addEventListener('click', () => {
    if (loadedAdminGamesRaw.length === 0) { alert("Catálogo vazio para exportações."); return; }
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
        alert("Erro ao exportar: " + e.message);
    }
});

// Limpeza Integral do Catálogo
document.getElementById('btn-clear-catalog').addEventListener('click', () => {
    if (confirm("Deseja LIMPAR TODO o acervo de jogos do servidor?")) {
        if (isFirebaseConnected) remove(ref(database, 'catalog'));
    }
});

// Troca de Senha Master
document.getElementById('form-update-master').addEventListener('submit', (e) => {
    e.preventDefault();
    const newMaster = document.getElementById('admin-master-input').value;
    const btn = document.getElementById('btn-update-master');
    
    setGenericButtonFeedback(btn, "SALVANDO...");
    if (isFirebaseConnected) {
        set(ref(database, 'settings/masterPassword'), newMaster).then(() => {
            alert("Senha Master redefinida!");
            resetButtonState(btn, "Atualizar Senha");
        });
    } else {
        systemMasterPassword = newMaster;
        alert("Redefinido localmente.");
        resetButtonState(btn, "Atualizar Senha");
    }
});

// Coleta e pooling de Pedidos Globais para o Admin
function loadGlobalOrdersForAdmin() {
    if (!isFirebaseConnected) return;
    onValue(ref(database, 'orders'), (snapshot) => {
        const container = document.getElementById('orders-container');
        container.innerHTML = '';
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(key => {
                const order = data[key];
                const box = document.createElement('div');
                box.classList.add('order-box');
                box.innerHTML = `
                    <p><strong>Username:</strong> @${order.client.username}</p>
                    <p><strong>Nome:</strong> ${order.client.name} ${order.client.lastname}</p>
                    <p><strong>Contato:</strong> ${order.client.whatsapp} | <strong>Cidade:</strong> ${order.client.city}</p>
                    <p><strong>Hardware:</strong> Pendrive de ${order.driveSize}GB</p>
                    <img src="${order.imageB64}" alt="Print do Pedido">
                `;
                container.appendChild(box);
            });
        } else {
            container.innerHTML = '<p style="color: var(--text-muted)">Fila global de pedidos limpa.</p>';
        }
    });
}

// Inicializações Automáticas ao Carregar o Navegador
window.addEventListener('DOMContentLoaded', () => {
    checkActiveSessionOnLoad();
    
    setInterval(() => {
        const adminPanel = document.getElementById('admin-screen');
        if (adminPanel && adminPanel.classList.contains('active')) {
            loadGlobalOrdersForAdmin();
        }
    }, 5000);
});
