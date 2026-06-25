// IMPORTAÇÃO DOS MÓDULOS WEB DO FIREBASE (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, push, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

// Inicializações seguras do Firebase
let app, auth, database;
let isFirebaseConnected = false;

try {
    if (firebaseConfig.apiKey !== "SUA_API_KEY" && firebaseConfig.apiKey !== "") {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        database = getDatabase(app);
        isFirebaseConnected = true;
        console.log("🔥 Firebase inicializado com sucesso.");
    } else {
        console.warn("⚠️ Firebase não configurado. Rodando em modo de simulação local.");
    }
} catch (error) {
    console.error("Erro ao tentar ler o Firebase:", error);
}

// Variavel em memória para armazenar a Senha Master sincronizada do Banco de Dados
let systemMasterPassword = "admin"; // Senha padrão caso o banco esteja desligado

// Sincroniza a Senha Master do banco em tempo real se o Firebase estiver conectado
if (isFirebaseConnected) {
    const masterPasswordRef = ref(database, 'settings/masterPassword');
    onValue(masterPasswordRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
            systemMasterPassword = val;
            // Preenche automaticamente o campo no painel do administrador se ele estiver aberto
            const adminMasterInput = document.getElementById('admin-master-input');
            if(adminMasterInput) adminMasterInput.value = val;
        }
    });
}

// Estado Geral do Aplicativo
let currentUserData = null;
let currentDrive = { size: 0, limit: 0 };
let catalogGames = [];
let selectedGames = [];

// Elementos DOM de Controle de Acesso
const tabUser = document.getElementById('tab-user');
const tabAdmin = document.getElementById('tab-admin');
const formUser = document.getElementById('form-user');
const formAdmin = document.getElementById('form-admin');

const btnSubmitUser = document.getElementById('btn-submit-user');
const btnSubmitAdmin = document.getElementById('btn-submit-admin');

// Troca de Abas Corrigida e Reativa
tabUser.addEventListener('click', (e) => {
    e.preventDefault();
    tabUser.classList.add('active');
    tabAdmin.classList.remove('active');
    
    formUser.style.display = 'flex';
    formAdmin.style.display = 'none';
    
    formUser.querySelectorAll('input').forEach(input => input.setAttribute('required', 'true'));
    formAdmin.querySelectorAll('input').forEach(input => {
        input.removeAttribute('required');
        input.value = ""; 
    });
    resetButtonState(btnSubmitAdmin, "Acessar Painel");
});

tabAdmin.addEventListener('click', (e) => {
    e.preventDefault();
    tabAdmin.classList.add('active');
    tabUser.classList.remove('active');
    
    formAdmin.style.display = 'flex';
    formUser.style.display = 'none';
    
    formAdmin.querySelectorAll('input').forEach(input => input.setAttribute('required', 'true'));
    formUser.querySelectorAll('input').forEach(input => {
        input.removeAttribute('required');
        input.value = ""; 
    });
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

function resetButtonState(button, originalText) {
    button.disabled = false;
    button.classList.remove('loading');
    button.innerText = originalText;
}

// ==========================================
// FLUXO DE LOGIN: CLIENTE (SENHA MASTER NO REALTIME)
// ==========================================
formUser.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const masterPassInput = document.getElementById('master-password').value;
    const name = document.getElementById('user-name').value;
    const lastname = document.getElementById('user-lastname').value;
    const whatsapp = document.getElementById('user-whatsapp').value;
    const city = document.getElementById('user-city').value;

    setButtonLoadingState(btnSubmitUser);

    // Validação da Senha Master resgatada do banco de dados (ou do fallback "admin")
    if (masterPassInput !== systemMasterPassword) {
        alert("❌ Senha Master incorreta ou inválida! Solicite a senha correta.");
        resetButtonState(btnSubmitUser, "Entrar no Sistema");
        return;
    }

    // Sucesso na Autenticação da Senha Master
    currentUserData = { name, lastname, whatsapp, city, role: 'user' };

    document.getElementById('tk-nome').innerText = currentUserData.name;
    document.getElementById('tk-sobrenome').innerText = currentUserData.lastname;
    document.getElementById('tk-whatsapp').innerText = currentUserData.whatsapp;
    document.getElementById('tk-cidade').innerText = currentUserData.city;

    setTimeout(() => {
        showScreen('drive-selection-screen');
        formUser.reset();
        resetButtonState(btnSubmitUser, "Entrar no Sistema");
    }, 800);
});

// ==========================================
// FLUXO DE LOGIN: ADMINISTRADOR (FIREBASE AUTH)
// ==========================================
formAdmin.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-password').value;

    setButtonLoadingState(btnSubmitAdmin);

    if (isFirebaseConnected) {
        signInWithEmailAndPassword(auth, email, pass)
            .then(() => {
                currentUserData = { role: 'admin' };
                showScreen('admin-screen');
                formAdmin.reset();
                resetButtonState(btnSubmitAdmin, "Acessar Painel");
            })
            .catch(err => {
                alert("Acesso Administrativo Negado! Verifique email e senha.");
                resetButtonState(btnSubmitAdmin, "Acessar Painel");
            });
    } else {
        setTimeout(() => {
            alert("[MODO TESTE LOCAL]: Painel Admin aberto sem Firebase.");
            currentUserData = { role: 'admin' };
            showScreen('admin-screen');
            resetButtonState(btnSubmitAdmin, "Acessar Painel");
        }, 800);
    }
});

// ==========================================
// CONTROLE DE LOGOUT E LIMPEZA TOTAL DE MEMÓRIA
// ==========================================
function processClearLogout() {
    if (isFirebaseConnected) signOut(auth);
    
    currentUserData = null;
    currentDrive = { size: 0, limit: 0 };
    selectedGames = [];
    catalogGames = [];
    
    localStorage.clear();
    sessionStorage.clear();
    
    formUser.reset();
    formAdmin.reset();
    
    resetButtonState(btnSubmitUser, "Entrar no Sistema");
    resetButtonState(btnSubmitAdmin, "Acessar Painel");
    
    showScreen('auth-screen');
}

document.getElementById('logout-btn').addEventListener('click', processClearLogout);
document.getElementById('admin-logout-btn').addEventListener('click', processClearLogout);

if (isFirebaseConnected) {
    onAuthStateChanged(auth, (user) => {
        if (!user && currentUserData?.role === 'admin') {
            processClearLogout();
        }
    });
}

// ==========================================
// ALTERAR SENHA MASTER (DENTRO DO PAINEL ADMIN)
// ==========================================
document.getElementById('form-update-master').addEventListener('submit', (e) => {
    e.preventDefault();
    const newMasterValue = document.getElementById('admin-master-input').value;
    const btnUpdateMaster = document.getElementById('btn-update-master');

    btnUpdateMaster.disabled = true;
    btnUpdateMaster.innerText = "ATUALIZANDO...";

    if (isFirebaseConnected) {
        const masterPasswordRef = ref(database, 'settings/masterPassword');
        set(masterPasswordRef, newMasterValue)
            .then(() => {
                alert("🔒 Senha Master atualizada com sucesso no banco de dados!");
                btnUpdateMaster.disabled = false;
                btnUpdateMaster.innerText = "Atualizar Senha";
            })
            .catch(err => {
                alert("Erro ao salvar nova senha: " + err.message);
                btnUpdateMaster.disabled = false;
                btnUpdateMaster.innerText = "Atualizar Senha";
            });
    } else {
        systemMasterPassword = newMasterValue;
        alert(`[MODO TESTE LOCAL]: Senha Master alterada localmente para: ${newMasterValue}`);
        btnUpdateMaster.disabled = false;
        btnUpdateMaster.innerText = "Atualizar Senha";
    }
});

// ==========================================
// SELEÇÃO DO PENDRIVE
// ==========================================
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

document.getElementById('btn-back-drives').addEventListener('click', () => {
    showScreen('drive-selection-screen');
});

// ==========================================
// CARREGAR CATÁLOGO E ATUALIZAR INTERFACE
// ==========================================
function loadCatalog() {
    if (!isFirebaseConnected) {
        catalogGames = [
            { id: "1", title: "GTA San Andreas", size: "4.3" },
            { id: "2", title: "Resident Evil 4", size: "3.5" },
            { id: "3", title: "God of War II", size: "7.9" },
            { id: "4", title: "Need for Speed Underground 2", size: "2.1" },
            { id: "5", title: "Bomba Patch 2026", size: "1.8" }
        ];
        renderCatalogUI();
        return;
    }

    const catalogRef = ref(database, 'catalog');
    onValue(catalogRef, (snapshot) => {
        const data = snapshot.val();
        catalogGames = [];
        if(data) {
            Object.keys(data).forEach(key => {
                catalogGames.push({ id: key, ...data[key] });
            });
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
            item.innerHTML = `
                <div class="game-info">
                    <h4>${game.title}</h4>
                    <span>${game.size} GB</span>
                </div>
                <input type="checkbox" class="chk-gamer" data-id="${game.id}" value="${game.size}">
            `;
            catalogContainer.appendChild(item);
        });

        document.querySelectorAll('.chk-gamer').forEach(chk => {
            chk.addEventListener('change', handleGameSelection);
        });
    } else {
        catalogContainer.innerHTML = '<p style="color: var(--text-muted)">Nenhum jogo no catálogo.</p>';
    }
}

function handleGameSelection(e) {
    const gameId = e.target.dataset.id;
    const game = catalogGames.find(g => g.id === gameId);

    if (e.target.checked) {
        selectedGames.push(game);
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
    
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = `${percentage}%`;
    
    document.getElementById('storage-text').innerText = `${totalSize.toFixed(2)} / ${limit.toFixed(2)} GB`;
    document.getElementById('game-counter').innerText = `Jogos selecionados: ${selectedGames.length} (Mínimo 5)`;

    const btnGenerate = document.getElementById('btn-generate-list');

    if (totalSize > limit) {
        progressBar.classList.add('exceeded');
        btnGenerate.disabled = true;
    } else {
        progressBar.classList.remove('exceeded');
        btnGenerate.disabled = selectedGames.length < 5;
    }
}

function renderTicketList() {
    const listContainer = document.getElementById('selected-games-list');
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
// GERAR IMAGEM JPEG (BASE64) E SALVAR
// ==========================================
document.getElementById('btn-generate-list').addEventListener('click', () => {
    const ticketElement = document.getElementById('ticket-lista');
    
    html2canvas(ticketElement, { backgroundColor: "#ffffff" }).then(canvas => {
        const base64Image = canvas.toDataURL('image/jpeg', 0.9);

        if (isFirebaseConnected) {
            const ordersRef = ref(database, 'orders');
            const newOrder = {
                client: currentUserData,
                driveSize: currentDrive.size,
                imageB64: base64Image,
                timestamp: Date.now()
            };

            push(ordersRef, newOrder)
                .then(() => {
                    alert("🎮 Lista enviada com sucesso para produção!");
                    processClearLogout();
                })
                .catch(err => alert("Erro ao registrar pedido: " + err.message));
        } else {
            alert("[MODO TESTE LOCAL]: Lista simulada gerada com sucesso!");
            processClearLogout();
        }
    });
});

// ==========================================
// PAINEL DO ADMINISTRADOR (CADASTRO DE JOGOS)
// ==========================================
document.getElementById('form-add-game').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('game-title').value;
    const size = document.getElementById('game-size').value;

    if (isFirebaseConnected) {
        const catalogRef = ref(database, 'catalog');
        push(catalogRef, {
            title: title,
            size: parseFloat(size).toFixed(1)
        }).then(() => {
            alert("Jogo adicionado ao Firebase!");
            document.getElementById('form-add-game').reset();
        });
    } else {
        alert(`[MODO TESTE LOCAL]: Jogo "${title}" (${size} GB) simulado.`);
        document.getElementById('form-add-game').reset();
    }
});

function loadOrdersForAdmin() {
    if (!isFirebaseConnected) return;

    const ordersRef = ref(database, 'orders');
    onValue(ordersRef, (snapshot) => {
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
                    <p><strong>Contato:</strong> ${order.client.whatsapp} | <strong>Cidade:</strong> ${order.client.city}</p>
                    <p><strong>Tamanho:</strong> Pendrive de ${order.driveSize}GB</p>
                    <img src="${order.imageB64}" alt="Lista do Pedido">
                `;
                container.appendChild(box);
            });
        } else {
            container.innerHTML = '<p style="color: var(--text-muted)">Nenhum pedido recebido.</p>';
        }
    });
}

setInterval(() => {
    if (document.getElementById('admin-screen').classList.contains('active')) {
        loadOrdersForAdmin();
    }
}, 3000);
