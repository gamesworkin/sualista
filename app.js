// IMPORTAÇÃO DOS MÓDULOS WEB DO FIREBASE (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// COLE SUAS CONFIGURAÇÕES DO FIREBASE AQUI
const firebaseConfig = {
    apiKey: "AIzaSyBvdW06QiHlJA5glUKtucX6hL8LdvlTPME",
    authDomain: "sua-lista-e6ef3.firebaseapp.com",
    databaseURL: "https://sua-lista-e6ef3-default-rtdb.firebaseio.com/",
    projectId: "sua-lista-e6ef3",
    storageBucket: "sua-lista-e6ef3.firebasestorage.app",
    messagingSenderId: "689656568290",
    appId: "1:689656568290:web:8f82257c9bb23f8b1481bb"
};

// Inicializações do Firebase
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

// Senha Master de Segurança
let systemMasterPassword = "admin"; 

if (isFirebaseConnected) {
    const masterPasswordRef = ref(database, 'settings/masterPassword');
    onValue(masterPasswordRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
            systemMasterPassword = val;
            const adminMasterInput = document.getElementById('admin-master-input');
            if(adminMasterInput) adminMasterInput.value = val;
        }
    });
}

// Estado da Aplicação
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

// Troca de Abas de Login
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

// LOGIN DO CLIENTE
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
    document.getElementById('tk-nome').innerText = currentUserData.name;
    document.getElementById('tk-sobrenome').innerText = currentUserData.lastname;
    document.getElementById('tk-whatsapp').innerText = currentUserData.whatsapp;
    document.getElementById('tk-cidade').innerText = currentUserData.city;

    setTimeout(() => {
        showScreen('drive-selection-screen');
        formUser.reset();
        resetButtonState(btnSubmitUser, "Entrar no Sistema");
    }, 600);
});

// LOGIN DO ADMIN
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
                syncCatalogToAdminPanel();
            })
            .catch(err => {
                alert("Acesso Administrativo Negado!");
                resetButtonState(btnSubmitAdmin, "Acessar Painel");
            });
    } else {
        setTimeout(() => {
            alert("[MODO TESTE LOCAL]: Painel Admin aberto.");
            currentUserData = { role: 'admin' };
            showScreen('admin-screen');
            resetButtonState(btnSubmitAdmin, "Acessar Painel");
            syncCatalogToAdminPanel();
        }, 600);
    }
});

// LOGOUT INTEGRAL
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

// SELEÇÃO DO PENDRIVE
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

// LER E RENDERIZAR CATALOGO (CLIENTE)
function loadCatalog() {
    if (!isFirebaseConnected) {
        catalogGames = [
            { id: "1", title: "GTA San Andreas", size: "4.3" },
            { id: "2", title: "Resident Evil 4", size: "3.5" },
            { id: "3", title: "God of War II", size: "7.9" }
        ];
        renderCatalogUI();
        return;
    }
    const catalogRef = ref(database, 'catalog');
    onValue(catalogRef, (snapshot) => {
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
            item.innerHTML = `
                <div class="game-info"><h4>${game.title}</h4><span>${game.size} GB</span></div>
                <input type="checkbox" class="chk-gamer" data-id="${game.id}" value="${game.size}">
            `;
            catalogContainer.appendChild(item);
        });
        document.querySelectorAll('.chk-gamer').forEach(chk => { chk.addEventListener('change', handleGameSelection); });
    } else {
        catalogContainer.innerHTML = '<p style="color: var(--text-muted)">Nenhum jogo no catálogo.</p>';
    }
}

function handleGameSelection(e) {
    const gameId = e.target.dataset.id;
    const game = catalogGames.find(g => g.id === gameId);
    if (e.target.checked) selectedGames.push(game);
    else selectedGames = selectedGames.filter(g => g.id !== gameId);
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

// SALVAR PEDIDO CLIENTE
document.getElementById('btn-generate-list').addEventListener('click', () => {
    const ticketElement = document.getElementById('ticket-lista');
    html2canvas(ticketElement, { backgroundColor: "#ffffff" }).then(canvas => {
        const base64Image = canvas.toDataURL('image/jpeg', 0.9);
        if (isFirebaseConnected) {
            push(ref(database, 'orders'), { client: currentUserData, driveSize: currentDrive.size, imageB64: base64Image, timestamp: Date.now() })
                .then(() => { alert("🎮 Pedido enviado com sucesso!"); processClearLogout(); });
        } else {
            alert("[MOCK]: Pedido simulado.");
            processClearLogout();
        }
    });
});

// ========================================================
// 🛠️ ÁREA EXCLUSIVA DE ENGENHARIA DE DADOS DO ADMIN
// ========================================================

// Variavel temporaria para manter os jogos carregados para fins de exportacao estruturada
let loadedAdminGamesRaw = [];

// Sincronização da lista de gerenciamento (Exclusão Individual)
function syncCatalogToAdminPanel() {
    if (!isFirebaseConnected) {
        loadedAdminGamesRaw = [
            { title: "GTA San Andreas", size: 4.3 },
            { title: "Resident Evil 4", size: 3.5 },
            { title: "God of War II", size: 7.9 }
        ];
        renderAdminManageUI([
            { id: "1", title: "GTA San Andreas", size: "4.3" },
            { id: "2", title: "Resident Evil 4", size: "3.5" },
            { id: "3", title: "God of War II", size: "7.9" }
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
                // Limpa as chaves unicas geradas pelo Firebase para deixar o JSON limpo e portavel na exportacao
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
            if (confirm("Deseja realmente remover este jogo do catálogo?")) {
                if (isFirebaseConnected) {
                    remove(ref(database, `catalog/${gameId}`))
                        .then(() => alert("Jogo removido!"))
                        .catch(err => alert("Erro ao deletar: " + err.message));
                } else {
                    alert("[MOCK]: Jogo excluído localmente.");
                }
            }
        });
    });
}

// Cadastrar Jogo Individual
document.getElementById('form-add-game').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('game-title').value;
    const size = document.getElementById('game-size').value;

    if (isFirebaseConnected) {
        push(ref(database, 'catalog'), { title: title, size: parseFloat(size).toFixed(1) }).then(() => {
            alert("Jogo cadastrado!");
            document.getElementById('form-add-game').reset();
        });
    } else {
        alert("Jogo cadastrado localmente!");
        document.getElementById('form-add-game').reset();
    }
});

// Importação de Jogos em Lote (JSON)
document.getElementById('btn-import-json').addEventListener('click', (e) => {
    const rawJson = document.getElementById('json-import-textarea').value.trim();
    const btn = e.target;

    if (!rawJson) { alert("Cole um código JSON válido antes de prosseguir!"); return; }

    try {
        const gamesList = JSON.parse(rawJson);
        if (!Array.isArray(gamesList)) { alert("O formato do JSON precisa ser um Array: [ { ... }, { ... } ]"); return; }

        if (confirm(`Deseja importar todos os ${gamesList.length} jogos para o banco?`)) {
            setGenericButtonFeedback(btn, "IMPORTANDO...");
            
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
                        alert("🎉 Todos os jogos foram importados em lote com sucesso!");
                        document.getElementById('json-import-textarea').value = "";
                        resetButtonState(btn, "Importar JSON");
                    })
                    .catch(err => {
                        alert("Erro durante a inserção: " + err.message);
                        resetButtonState(btn, "Importar JSON");
                    });
            } else {
                setTimeout(() => {
                    alert(`[MOCK]: ${gamesList.length} jogos importados com sucesso.`);
                    document.getElementById('json-import-textarea').value = "";
                    resetButtonState(btn, "Importar JSON");
                }, 800);
            }
        }
    } catch (err) {
        alert("Erro Crítico de Sintaxe no JSON! Verifique vírgulas e aspas duplas.\nErro: " + err.message);
    }
});

// ==========================================
// 📥 ADIÇÃO: EXPORTAÇÃO COMPLETA DO CATÁLOGO (JSON)
// ==========================================
document.getElementById('btn-export-json').addEventListener('click', () => {
    if (loadedAdminGamesRaw.length === 0) {
        alert("❌ Não há jogos cadastrados no catálogo atual para realizar a exportação.");
        return;
    }

    try {
        // Converte o array de jogos limpo em uma string JSON identada para facil leitura
        const jsonString = JSON.stringify(loadedAdminGamesRaw, null, 2);
        
        // Cria um elemento Blob na memoria do navegador simulando o arquivo
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        // Cria um link temporario para acionar o download do arquivo .json
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `backup_catalogo_jogos_${Date.now()}.json`;
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        
        // Limpeza de memoria pós-download
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
        
        alert("💾 Arquivo de backup exportado e baixado com sucesso!");
    } catch (error) {
        alert("Erro ao tentar exportar os dados do catálogo: " + error.message);
    }
});

// Limpar Todo o Catálogo (Exclusão Completa)
document.getElementById('btn-clear-catalog').addEventListener('click', () => {
    if (confirm("⚠️ ATENÇÃO CRÍTICA!\nVocê tem certeza que deseja APAGAR TODO o catálogo de jogos? Esta ação é irreversível!")) {
        if (isFirebaseConnected) {
            remove(ref(database, 'catalog'))
                .then(() => alert("💥 Catálogo de jogos completamente esvaziado!"))
                .catch(err => alert("Erro ao limpar banco: " + err.message));
        } else {
            alert("[MOCK]: Catálogo limpo.");
        }
    }
});

// Atualizar Senha Master
document.getElementById('form-update-master').addEventListener('submit', (e) => {
    e.preventDefault();
    const newMaster = document.getElementById('admin-master-input').value;
    const btn = document.getElementById('btn-update-master');
    
    setGenericButtonFeedback(btn, "ATUALIZANDO...");
    if (isFirebaseConnected) {
        set(ref(database, 'settings/masterPassword'), newMaster).then(() => {
            alert("Senha Master alterada!");
            resetButtonState(btn, "Atualizar Senha");
        });
    } else {
        systemMasterPassword = newMaster;
        alert("Senha Master simulada alterada!");
        resetButtonState(btn, "Atualizar Senha");
    }
});

// Carregar Pedidos
function loadOrdersForAdmin() {
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
                    <p><strong>Contato:</strong> ${order.client.whatsapp} | <strong>Cidade:</strong> ${order.client.city}</p>
                    <p><strong>Tamanho:</strong> Pendrive de ${order.driveSize}GB</p>
                    <img src="${order.imageB64}" alt="Pedido">
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
}, 4000);
