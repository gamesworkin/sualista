// IMPORTAÇÃO DOS MÓDULOS WEB DO FIREBASE (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

// Inicializações de Fluxo do Firebase
let app, auth, database;
let isFirebaseConnected = false;

try {
    if (firebaseConfig.apiKey !== "SUA_API_KEY" && firebaseConfig.apiKey !== "") {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        database = getDatabase(app);
        isFirebaseConnected = true;
        console.log("🔥 Firebase conectado e ativo globalmente.");
    } else {
        console.warn("⚠️ Utilizando estrutura de simulação LocalStorage/Mock.");
    }
} catch (error) {
    console.error("Erro Crítico de Inicialização do Firebase:", error);
}

// Elementos Estruturais DOM
const tabUser = document.getElementById('tab-user');
const tabAdmin = document.getElementById('tab-admin');
const formUser = document.getElementById('form-user');
const formAdmin = document.getElementById('form-admin');
const btnSubmitUser = document.getElementById('btn-submit-user');
const btnSubmitAdmin = document.getElementById('btn-submit-admin');

// Elementos de Navegação Interna do Cliente
const btnNavMontador = document.getElementById('btn-nav-montador');
const btnNavPedidos = document.getElementById('btn-nav-pedidos');
const sectionMontador = document.getElementById('sub-section-montador');
const sectionPedidos = document.getElementById('sub-section-pedidos');

// Estado Dinâmico da Sessão
let currentUserData = null;
let currentDrive = { size: 0, limit: 0 };
let catalogGames = [];
let selectedGames = [];
let loadedAdminGamesRaw = [];
let systemMasterPassword = "admin";

// SISTEMA DE NAVEGAÇÃO ENTRE ABAS DO CLIENTE LOGADO
if(btnNavMontador && btnNavPedidos) {
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

// Sincronização em tempo real da senha master cadastrada no Admin
if (isFirebaseConnected) {
    onValue(ref(database, 'settings/masterPassword'), (snapshot) => {
        const val = snapshot.val();
        if (val) {
            systemMasterPassword = val;
            const inputMaster = document.getElementById('admin-master-input');
            if(inputMaster) inputMaster.value = val;
        }
    });
}

// Alternância Visual de Abas na Tela de Autenticação
tabUser.addEventListener('click', (e) => {
    e.preventDefault();
    tabUser.classList.add('active');
    tabAdmin.classList.remove('active');
    formUser.style.display = 'flex';
    formAdmin.style.display = 'none';
    formUser.querySelectorAll('input').forEach(input => input.setAttribute('required', 'true'));
    formAdmin.querySelectorAll('input').forEach(input => { input.removeAttribute('required'); input.value = ""; });
    resetButtonState(btnSubmitAdmin, "Acessar Painel");
});

tabAdmin.addEventListener('click', (e) => {
    e.preventDefault();
    tabAdmin.classList.add('active');
    tabUser.classList.remove('active');
    formAdmin.style.display = 'flex';
    formUser.style.display = 'none';
    formAdmin.querySelectorAll('input').forEach(input => input.setAttribute('required', 'true'));
    formUser.querySelectorAll('input').forEach(input => { input.removeAttribute('required'); input.value = ""; });
    resetButtonState(btnSubmitUser, "Entrar no Sistema");
});

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function setButtonLoadingState(button) {
    button.disabled = true;
    button.classList.add('loading');
    button.innerText = "ENTRANDO...";
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

// VALIDAR E SALVAR PERSISTÊNCIA DO CLIENTE LOCALMENTE
formUser.addEventListener('submit', (e) => {
    e.preventDefault();
    const masterPassInput = document.getElementById('master-password').value;
    const name = document.getElementById('user-name').value;
    const lastname = document.getElementById('user-lastname').value;
    const whatsapp = document.getElementById('user-whatsapp').value;
    const city = document.getElementById('user-city').value;

    setButtonLoadingState(btnSubmitUser);

    if (masterPassInput !== systemMasterPassword) {
        alert("❌ Senha Master incorreta!");
        resetButtonState(btnSubmitUser, "Entrar no Sistema");
        return;
    }

    currentUserData = { name, lastname, whatsapp, city, role: 'user' };
    localStorage.setItem('gamelist_session', JSON.stringify(currentUserData));
    
    setupClientEnvironment();
    resetButtonState(btnSubmitUser, "Entrar no Sistema");
    showScreen('drive-selection-screen');
    formUser.reset();
});

function setupClientEnvironment() {
    document.getElementById('user-welcome').innerText = `Olá, ${currentUserData.name} ${currentUserData.lastname}`;
    document.getElementById('tk-nome').innerText = currentUserData.name;
    document.getElementById('tk-sobrenome').innerText = currentUserData.lastname;
    document.getElementById('tk-whatsapp').innerText = currentUserData.whatsapp;
    document.getElementById('tk-cidade').innerText = currentUserData.city;
}

// LOGIN ADMINISTRATIVO (COM AUTENTICAÇÃO PERSISTENTE FIREBASE)
formAdmin.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-password').value;

    setButtonLoadingState(btnSubmitAdmin);

    if (isFirebaseConnected) {
        signInWithEmailAndPassword(auth, email, pass)
            .then((userCredential) => {
                currentUserData = { email: userCredential.user.email, role: 'admin' };
                localStorage.setItem('gamelist_session', JSON.stringify(currentUserData));
                executeAdminLoginFlow();
            })
            .catch(err => {
                alert("Acesso Administrativo Recusado! Verifique e-mail e senha.");
                resetButtonState(btnSubmitAdmin, "Acessar Painel");
            });
    } else {
        if(email === "admin@teste.com" && pass === "123456") {
            currentUserData = { email, role: 'admin' };
            localStorage.setItem('gamelist_session', JSON.stringify(currentUserData));
            executeAdminLoginFlow();
        } else {
            alert("[MOCK]: Use admin@teste.com e 123456");
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

// ENGENHARIA DE VERIFICAÇÃO DE SESSÃO ATIVA (ANTI-REFRESH 'F5')
function checkActiveSessionOnLoad() {
    const cachedSession = localStorage.getItem('gamelist_session');
    if (!cachedSession) {
        showScreen('auth-screen');
        return;
    }

    currentUserData = JSON.parse(cachedSession);

    if (currentUserData.role === 'admin') {
        if (isFirebaseConnected) {
            // Garante o re-vínculo seguro com o Auth do Firebase
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

// LOGOUT COMPLETO DO SISTEMA
function processClearLogout() {
    if (isFirebaseConnected) signOut(auth);
    currentUserData = null;
    currentDrive = { size: 0, limit: 0 };
    selectedGames = [];
    catalogGames = [];
    
    localStorage.removeItem('gamelist_session');
    formUser.reset();
    formAdmin.reset();
    
    resetButtonState(btnSubmitUser, "Entrar no Sistema");
    resetButtonState(btnSubmitAdmin, "Acessar Painel");
    
    if(btnNavMontador) {
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

// SELEÇÃO DO TAMANHO DE PENDRIVE
document.querySelectorAll('.drive-card').forEach(card => {
    card.addEventListener('click', () => {
        currentDrive.size = card.dataset.size;
        currentDrive.limit = parseFloat(card.dataset.limit);
        document.getElementById('display-drive-name').innerText = `Pendrive ${currentDrive.size}GB`;
        document.getElementById('tk-pendrive').innerText = `${currentDrive.size} GB (Real: ${currentDrive.limit} GB)`;
        
        selectedGames = [];
        showScreen('main-app-screen');
        loadCatalog();
        updateStorageMeter();
    });
});
document.getElementById('btn-back-drives').addEventListener('click', () => { showScreen('drive-selection-screen'); });

// FLUXO DO ACERVO DE JOGOS DO CLIENTE
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
        if(data) {
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
            
            // Verifica se o jogo ja estava marcado anteriormente para manter consistencia visual
            const isChecked = selectedGames.some(g => g.id === game.id) ? 'checked' : '';
            
            item.innerHTML = `
                <div class="game-info"><h4>${game.title}</h4><span>${game.size} GB</span></div>
                <input type="checkbox" class="chk-gamer" data-id="${game.id}" value="${game.size}" ${isChecked}>
            `;
            catalogContainer.appendChild(item);
        });
        document.querySelectorAll('.chk-gamer').forEach(chk => { chk.addEventListener('change', handleGameSelection); });
    } else {
        catalogContainer.innerHTML = '<p style="color: var(--text-muted)">Nenhum jogo disponível no catálogo.</p>';
    }
}

function handleGameSelection(e) {
    const gameId = e.target.dataset.id;
    const game = catalogGames.find(g => g.id === gameId);
    if (e.target.checked) {
        if(!selectedGames.some(g => g.id === gameId)) selectedGames.push(game);
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

// SALVAR NOVO PEDIDO DO CLIENTE (GERANDO A FICHA IMPRESSA EM BASE64)
document.getElementById('btn-generate-list').addEventListener('click', () => {
    const ticketElement = document.getElementById('ticket-lista');
    html2canvas(ticketElement, { backgroundColor: "#ffffff" }).then(canvas => {
        const base64Image = canvas.toDataURL('image/jpeg', 0.9);
        
        const orderPayload = {
            client: currentUserData, // Vincula de forma unica pelo nome/whatsapp corporativo
            driveSize: currentDrive.size,
            imageB64: base64Image,
            timestamp: Date.now()
        };

        if (isFirebaseConnected) {
            push(ref(database, 'orders'), orderPayload)
                .then(() => { 
                    alert("🎮 Seu pedido foi computado e enviado com sucesso!"); 
                    selectedGames = [];
                    renderTicketList();
                    updateStorageMeter();
                    // Redireciona de forma automatica para a aba de pedidos dele
                    btnNavPedidos.click();
                });
        } else {
            // Logica Simulada de Backup Local
            let localOrders = JSON.parse(localStorage.getItem('mock_orders') || '[]');
            orderPayload.id = "MOCK_" + Date.now();
            localOrders.push(orderPayload);
            localStorage.setItem('mock_orders', JSON.stringify(localOrders));
            
            alert("[MODO TESTE]: Pedido gravado com sucesso no Cache Local.");
            selectedGames = [];
            btnNavPedidos.click();
        }
    });
});

// ========================================================
// 📦 EXCLUSIVO: COMPARTIMENTO DE PRODUTOS E PEDIDOS DO CLIENTE
// ========================================================
function loadUserSpecificOrders() {
    const container = document.getElementById('client-orders-history-list');
    container.innerHTML = '<p style="color: var(--text-muted)">Buscando seu histórico no servidor...</p>';

    if (!isFirebaseConnected) {
        let localOrders = JSON.parse(localStorage.getItem('mock_orders') || '[]');
        // Filtra apenas pedidos correspondentes ao usuario atual logado no navegador
        let filtered = localOrders.filter(o => o.client.whatsapp === currentUserData.whatsapp);
        renderUserOrdersUI(filtered);
        return;
    }

    onValue(ref(database, 'orders'), (snapshot) => {
        const data = snapshot.val();
        let myOrdersArray = [];
        if (data) {
            Object.keys(data).forEach(key => {
                if (data[key].client && data[key].client.whatsapp === currentUserData.whatsapp) {
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
        container.innerHTML = '<p style="color: var(--text-muted)">Você ainda não enviou nenhum pedido. Monte seu primeiro pendrive agora!</p>';
        return;
    }

    // Ordena do mais recente para o mais antigo
    orders.sort((a,b) => b.timestamp - a.timestamp);

    orders.forEach(order => {
        const dateFormatted = new Date(order.timestamp).toLocaleString('pt-BR');
        const card = document.createElement('div');
        card.classList.add('client-order-card');
        
        card.innerHTML = `
            <div class="client-order-header">
                <div>
                    <h4>Pendrive Solicitado: ${order.driveSize} GB</h4>
                    <span style="color: var(--neon-green)">Data: ${dateFormatted}</span>
                </div>
                <span>ID: ${order.id}</span>
            </div>
            <div class="client-order-body">
                <img src="${order.imageB64}" alt="Espelho do Pedido">
                <div class="client-order-actions">
                    <button type="button" class="btn-danger-action btn-delete-my-order" data-id="${order.id}">Cancelar Pedido</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    // Evento de exclusão e cancelamento de pedidos por iniciativa do cliente
    container.querySelectorAll('.btn-delete-my-order').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const orderId = e.target.dataset.id;
            if (confirm("Tem certeza absoluta de que deseja excluir e cancelar este pedido do sistema? Esta ação removerá o registro permanente.")) {
                if (isFirebaseConnected) {
                    remove(ref(database, `orders/${orderId}`))
                        .then(() => alert("Pedido cancelado e apagado do banco de dados!"));
                } else {
                    let localOrders = JSON.parse(localStorage.getItem('mock_orders') || '[]');
                    localOrders = localOrders.filter(o => o.id !== orderId);
                    localStorage.setItem('mock_orders', JSON.stringify(localOrders));
                    alert("[MOCK]: Pedido removido do cache.");
                    loadUserSpecificOrders();
                }
            }
        });
    });
}


// ========================================================
// 🛠️ PAINEL DA ENGENHARIA DE CONTROLE DO ADMIN
// ========================================================
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
        container.innerHTML = '<p style="color:var(--text-muted); padding:10px;">Catálogo sem itens ativos.</p>';
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
            if (confirm("Remover este título definitivamente do catálogo público?")) {
                if (isFirebaseConnected) {
                    remove(ref(database, `catalog/${gameId}`))
                        .then(() => alert("Título excluído com sucesso do ecossistema."));
                } else {
                    alert("[MOCK]: Removido do ambiente local temporário.");
                }
            }
        });
    });
}

// Inserir Título Individual
document.getElementById('form-add-game').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('game-title').value;
    const size = document.getElementById('game-size').value;

    if (isFirebaseConnected) {
        push(ref(database, 'catalog'), { title: title, size: parseFloat(size).toFixed(1) }).then(() => {
            alert("Jogo adicionado!");
            document.getElementById('form-add-game').reset();
        });
    } else {
        alert("Inserido com sucesso no simulador.");
        document.getElementById('form-add-game').reset();
    }
});

// Importador Estruturado JSON em Lote
document.getElementById('btn-import-json').addEventListener('click', (e) => {
    const rawJson = document.getElementById('json-import-textarea').value.trim();
    const btn = e.target;

    if (!rawJson) { alert("Cole a cadeia de caracteres do JSON válido antes de processar!"); return; }

    try {
        const gamesList = JSON.parse(rawJson);
        if (!Array.isArray(gamesList)) { alert("O formato precisa obrigatoriamente ser uma Matriz/Array: [ { ... } ]"); return; }

        if (confirm(`Validado! Confirmar a injeção em lote de ${gamesList.length} registros no banco?`)) {
            setGenericButtonFeedback(btn, "PROCESSANDO INJEÇÃO...");
            
            if (isFirebaseConnected) {
                const catalogRef = ref(database, 'catalog');
                let promises = gamesList.map(game => {
                    return push(catalogRef, {
                        title: game.title,
                        size: parseFloat(game.size).toFixed(1)
                    });
                });

                Promise.all(promises)
                    .then(() => {
                        alert("🎉 Processamento em lote concluído com sucesso!");
                        document.getElementById('json-import-textarea').value = "";
                        resetButtonState(btn, "Importar JSON");
                    })
                    .catch(err => {
                        alert("Erro de Injeção: " + err.message);
                        resetButtonState(btn, "Importar JSON");
                    });
            } else {
                setTimeout(() => {
                    alert(`[MOCK]: ${gamesList.length} itens injetados localmente.`);
                    document.getElementById('json-import-textarea').value = "";
                    resetButtonState(btn, "Importar JSON");
                }, 800);
            }
        }
    } catch (err) {
        alert("Falha de Compilação do JSON! Certifique-se de usar aspas duplas padronizadas.\nErro: " + err.message);
    }
});

// Exportador Automatizado de Arquivos Físicos JSON
document.getElementById('btn-export-json').addEventListener('click', () => {
    if (loadedAdminGamesRaw.length === 0) {
        alert("❌ Impossível exportar um arquivo de backup com o acervo zerado.");
        return;
    }

    try {
        const jsonString = JSON.stringify(loadedAdminGamesRaw, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `backup_games_acervo_${Date.now()}.json`;
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
    } catch (error) {
        alert("Falha Operacional ao Gerar Download: " + error.message);
    }
});

// Resetadores Totais do Banco
document.getElementById('btn-clear-catalog').addEventListener('click', () => {
    if (confirm("🚨 ALERTA GERAL DE SEGURANÇA!\nDeseja verdadeiramente ELIMINAR COMPLETAMENTE todo o catálogo público? Essa operação destruirá os dados sem chance de retorno!")) {
        if (isFirebaseConnected) {
            remove(ref(database, 'catalog'))
                .then(() => alert("Banco de Dados limpo."));
        } else {
            alert("[MOCK]: Acervo limpo.");
        }
    }
});

// Atualizador de Chave Mestre
document.getElementById('form-update-master').addEventListener('submit', (e) => {
    e.preventDefault();
    const newMaster = document.getElementById('admin-master-input').value;
    const btn = document.getElementById('btn-update-master');
    
    setGenericButtonFeedback(btn, "GRAVANDO VALOR...");
    if (isFirebaseConnected) {
        set(ref(database, 'settings/masterPassword'), newMaster).then(() => {
            alert("Senha Master redefinida no Firebase!");
            resetButtonState(btn, "Atualizar Senha");
        });
    } else {
        systemMasterPassword = newMaster;
        alert("Senha Master atualizada localmente.");
        resetButtonState(btn, "Atualizar Senha");
    }
});

// Monitor de Pedidos Globais para Administração
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
                    <p><strong>Cliente:</strong> ${order.client.name} ${order.client.lastname}</p>
                    <p><strong>Contato Directo:</strong> ${order.client.whatsapp} | <strong>Localidade:</strong> ${order.client.city}</p>
                    <p><strong>Hardware Solicitado:</strong> Pendrive de ${order.driveSize}GB</p>
                    <img src="${order.imageB64}" alt="Lista Física Enviada">
                `;
                container.appendChild(box);
            });
        } else {
            container.innerHTML = '<p style="color: var(--text-muted)">Nenhum pedido em aberto na fila global.</p>';
        }
    });
}

// Inicializador Automático de Rotinas no Carregamento
window.addEventListener('DOMContentLoaded', () => {
    checkActiveSessionOnLoad();
    
    // Configura o pooling assíncrono para o admin se ele estiver ativo na tela
    setInterval(() => {
        const adminPanel = document.getElementById('admin-screen');
        if (adminPanel && adminPanel.classList.contains('active')) {
            loadGlobalOrdersForAdmin();
        }
    }, 5000);
});
