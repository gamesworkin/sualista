// ==========================================
// CONFIGURAÇÕES DO CONFIG DO FIREBASE
// Substitua pelo objeto fornecido no seu console Firebase!
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBvdW06QiHlJA5glUKtucX6hL8LdvlTPME",
    authDomain: "sua-lista-e6ef3.firebaseapp.com",
    databaseURL: "https://sua-lista-e6ef3-default-rtdb.firebaseio.com/",
    projectId: "sua-lista-e6ef3",
    storageBucket: "sua-lista-e6ef3.firebasestorage.app",
    messagingSenderId: "689656568290",
    appId: "1:689656568290:web:8f82257c9bb23f8b1481bb"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// CONFIGURAÇÃO FIXA DO PROPRIETÁRIO
const TELEFONE_WHATSAPP = "5588988470190";

// VARIÁVEIS DE ESTADO DA APLICAÇÃO
let currentUsb = { size: 0, maxCapacity: 0 };
let catalogGames = [];
let userSelection = [];
let isEditing = false;
let currentEditId = null;

// ELEMENTOS DOM
const sections = {
    welcome: document.getElementById('welcome-section'),
    builder: document.getElementById('game-selection-section'),
    success: document.getElementById('success-section'),
    admin: document.getElementById('admin-section')
};

// Inicializador
document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    // Escuta mudanças de autenticação do Admin
    auth.onAuthStateChanged(user => {
        if (user && user.email === 'admin@admin.com') {
            switchSection('admin');
            loadAdminData();
        } else {
            // Se não logado, volta para a home
            if(sections.admin.classList.contains('active')) {
                switchSection('welcome');
            }
        }
    });

    // Carrega catálogo base em tempo real
    database.ref('games').on('value', snapshot => {
        catalogGames = [];
        snapshot.forEach(childSnapshot => {
            catalogGames.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        renderCatalog();
        if (auth.currentUser) renderAdminGamesTable();
    });
}

function setupEventListeners() {
    // Escolha do Pen drive
    document.querySelectorAll('.usb-card').forEach(card => {
        card.addEventListener('click', () => {
            currentUsb.size = parseInt(card.dataset.size);
            currentUsb.maxCapacity = parseFloat(card.dataset.max);
            
            document.getElementById('selected-usb-title').innerText = `${currentUsb.size}GB`;
            userSelection = []; // limpa seleção antiga
            updateStorageMetrics();
            renderUserSelection();
            switchSection('builder');
        });
    });

    // Voltar da montagem para tela inicial
    document.getElementById('btn-back-to-usb').addEventListener('click', () => {
        switchSection('welcome');
    });

    // Modais e Login
    const modal = document.getElementById('login-modal');
    document.getElementById('btn-admin-modal').addEventListener('click', () => modal.style.display = 'flex');
    document.querySelector('.close-modal').addEventListener('click', () => modal.style.display = 'none');
    
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const pass = document.getElementById('login-password').value;
        auth.signInWithEmailAndPassword('admin@admin.com', pass)
            .then(() => {
                modal.style.display = 'none';
                document.getElementById('login-password').value = '';
            })
            .catch(err => alert("Senha inválida ou erro de conexão: " + err.message));
    });

    // Logout do Admin
    document.getElementById('btn-admin-logout').addEventListener('click', () => {
        auth.signOut().then(() => switchSection('welcome'));
    });

    // Admin - Troca de Abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // Admin - Salvar / Editar Jogo
    document.getElementById('game-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('game-title').value;
        const sizeValue = parseFloat(document.getElementById('game-size').value);
        const unit = document.getElementById('game-unit').value;
        
        // Converte tudo nativamente para GB para simplificar métricas no Database, mas guarda o rótulo original
        const sizeInGB = unit === 'MB' ? sizeValue / 1024 : sizeValue;

        const gameData = {
            title: title,
            displaySize: sizeValue,
            unit: unit,
            sizeGB: sizeInGB
        };

        if (isEditing) {
            database.ref('games/' + currentEditId).set(gameData)
                .then(() => resetGameForm());
        } else {
            database.ref('games').push(gameData)
                .then(() => resetGameForm());
        }
    });

    document.getElementById('btn-cancel-edit').addEventListener('click', resetGameForm);

    // Backup e Importação JSON
    document.getElementById('btn-export-json').addEventListener('click', exportDatabaseToJSON);
    document.getElementById('import-json').addEventListener('change', importDatabaseFromJSON);

    // Fluxo Final do Usuário - Botão Gerar Lista (Envia e abre opções)
    document.getElementById('btn-generate-list').addEventListener('click', finishAndSendList);

    // Compartilhamento e A4 Visualização
    document.getElementById('btn-view-a4').addEventListener('click', () => {
        document.getElementById('a4-container').style.display = 'block';
    });
    document.getElementById('btn-close-a4').addEventListener('click', () => {
        document.getElementById('a4-container').style.display = 'none';
    });
    document.getElementById('btn-print-a4').addEventListener('click', () => {
        window.print();
    });
}

// MUDANÇA DE SEÇÃO
function switchSection(sectionId) {
    Object.values(sections).forEach(s => s.classList.remove('active'));
    sections[sectionId].classList.add('active');
}

// FORMATAÇÃO DE CAPACIDADE DE EXIBIÇÃO
function formatGameSizeText(game) {
    return `${game.displaySize} ${game.unit}`;
}

// CARREGAR E RENDERIZAR INTERFACES DE USUÁRIOS
function renderCatalog() {
    const listContainer = document.getElementById('catalog-list');
    listContainer.innerHTML = '';

    if(catalogGames.length === 0) {
        listContainer.innerHTML = '<p style="padding:15px; color:#666;">Nenhum jogo disponível no catálogo.</p>';
        return;
    }

    catalogGames.forEach(game => {
        const item = document.createElement('div');
        item.className = 'game-item';
        item.innerHTML = `
            <div class="game-item-info">
                <span class="title">${game.title}</span>
                <span class="size">${formatGameSizeText(game)}</span>
            </div>
            <button class="btn-primary" onclick="addGameToSelection('${game.id}')"><i class="fa-solid fa-plus"></i></button>
        `;
        listContainer.appendChild(item);
    });
}

function renderUserSelection() {
    const listContainer = document.getElementById('user-selected-list');
    listContainer.innerHTML = '';

    if(userSelection.length === 0) {
        listContainer.innerHTML = '<p style="padding:15px; color:#666;">Nenhum jogo selecionado ainda.</p>';
        return;
    }

    userSelection.forEach((game, index) => {
        const item = document.createElement('div');
        item.className = 'game-item';
        item.innerHTML = `
            <div class="game-item-info">
                <span class="title">${game.title}</span>
                <span class="size">${formatGameSizeText(game)}</span>
            </div>
            <button class="btn-danger" onclick="removeGameFromSelection(${index})"><i class="fa-solid fa-trash"></i></button>
        `;
        listContainer.appendChild(item);
    });
}

function addGameToSelection(id) {
    const game = catalogGames.find(g => g.id === id);
    if(game) {
        userSelection.push(game);
        renderUserSelection();
        updateStorageMetrics();
    }
}

function removeGameFromSelection(index) {
    userSelection.splice(index, 1);
    renderUserSelection();
    updateStorageMetrics();
}

function updateStorageMetrics() {
    let totalUsedGB = userSelection.reduce((acc, game) => acc + game.sizeGB, 0);
    const max = currentUsb.maxCapacity;

    const percentage = (totalUsedGB / max) * 100;
    const bar = document.getElementById('storage-bar');
    const text = document.getElementById('storage-text');
    const btnGenerate = document.getElementById('btn-generate-list');

    bar.style.width = `${Math.min(percentage, 100)}%`;
    text.innerText = `${totalUsedGB.toFixed(2)} GB / ${max.toFixed(2)} GB usado`;

    if (totalUsedGB > max) {
        bar.classList.add('overlimit');
        btnGenerate.disabled = true;
    } else {
        bar.classList.remove('overlimit');
        // Desativa se estiver vazio, ativa se houver jogos dentro do limite permitido
        btnGenerate.disabled = userSelection.length === 0;
    }
}

// FLUXO DE CONCLUSÃO DA LISTA (CRIAÇÃO DO BASE64 E ENVIO AO ADMIN)
function finishAndSendList() {
    // 1. Gera Conteúdo Estruturado da Tabela A4 para Renderização e posterior Base64
    const tableBody = document.getElementById('a4-table-body');
    tableBody.innerHTML = '';
    
    userSelection.forEach((game, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td style="font-weight: bold;">${game.title}</td>
            <td>${formatGameSizeText(game)}</td>
        `;
        tableBody.appendChild(tr);
    });

    let totalUsedGB = userSelection.reduce((acc, game) => acc + game.sizeGB, 0);
    document.getElementById('a4-usb-size').innerText = `${currentUsb.size}GB (Capacidade real: ${currentUsb.maxCapacity}GB)`;
    document.getElementById('a4-total-used').innerText = `${totalUsedGB.toFixed(2)} GB`;

    // 2. Transforma o HTML gerado da folha A4 em Base64 string pura
    const htmlContent = document.getElementById('a4-container').innerHTML;
    const base64List = btoa(unescape(encodeURIComponent(htmlContent)));

    // 3. Monta payload para persistência nas Encomendas do Admin via Firebase
    const orderPayload = {
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        usbOriginalSize: `${currentUsb.size}GB`,
        gamesCount: userSelection.length,
        base64File: base64List
    };

    database.ref('orders').push(orderPayload)
        .then(() => {
            // Configura botão do whatsapp dinamicamente
            setupWhatsappButton();
            switchSection('success');
        })
        .catch(err => alert("Erro ao enviar pedido para o servidor: " + err.message));
}

function setupWhatsappButton() {
    let msg = `*NOVA ENCOMENDA DE JOGOS - PS2*%0A`;
    msg += `---------------------------------%0A`;
    msg += `*Pen Drive:* ${currentUsb.size}GB%0A`;
    msg += `*Quantidade de Jogos:* ${userSelection.length}%0A%0A`;
    msg += `*LISTA DE JOGOS:*%0A`;
    
    userSelection.forEach((game, i) => {
        msg += `${i+1}. ${game.title} (${formatGameSizeText(game)})%0A`;
    });

    const url = `https://api.whatsapp.com/send?phone=${TELEFONE_WHATSAPP}&text=${msg}`;
    document.getElementById('btn-whatsapp-share').onclick = () => {
        window.open(url, '_blank');
    };
}


// GERENCIAMENTO DA ÁREA ADMINISTRATIVA
function loadAdminData() {
    // Processamento de Pedidos do Usuário recebidos
    database.ref('orders').on('value', snapshot => {
        const tableBody = document.getElementById('admin-orders-table');
        tableBody.innerHTML = '';
        
        if(!snapshot.exists()) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhuma encomenda recebida ainda.</td></tr>';
            return;
        }

        snapshot.forEach(childSnapshot => {
            const order = childSnapshot.val();
            const date = new Date(order.timestamp).toLocaleString('pt-BR');
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${date}</td>
                <td><i class="fa-solid fa-usb"></i> Pen drive ${order.usbOriginalSize}</td>
                <td>${order.gamesCount} jogo(s)</td>
                <td>
                    <button class="btn-primary" onclick="downloadBase64Order('${childSnapshot.key}')">
                        <i class="fa-solid fa-download"></i> Baixar Arquivo Lista
                    </button>
                </td>
            `;
            tableBody.prepend(tr); // Mais recentes primeiro
        });
    });
}

function renderAdminGamesTable() {
    const tableBody = document.getElementById('admin-games-table');
    tableBody.innerHTML = '';

    if(catalogGames.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Nenhum jogo no banco de dados.</td></tr>';
        return;
    }

    catalogGames.forEach(game => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${game.title}</td>
            <td>${formatGameSizeText(game)}</td>
            <td>
                <button class="btn-secondary" style="padding: 5px 10px;" onclick="startEditGame('${game.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="btn-danger" style="padding: 5px 10px;" onclick="deleteGame('${game.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function startEditGame(id) {
    const game = catalogGames.find(g => g.id === id);
    if(game) {
        isEditing = true;
        currentEditId = id;
        document.getElementById('form-title').innerText = "Editar Jogo";
        document.getElementById('game-title').value = game.title;
        document.getElementById('game-size').value = game.displaySize;
        document.getElementById('game-unit').value = game.unit;
        document.getElementById('btn-cancel-edit').style.display = 'inline-flex';
    }
}

function deleteGame(id) {
    if(confirm("Deseja realmente excluir este jogo do catálogo?")) {
        database.ref('games/' + id).remove();
    }
}

function resetGameForm() {
    isEditing = false;
    currentEditId = null;
    document.getElementById('form-title').innerText = "Cadastrar Novo Jogo";
    document.getElementById('game-form').reset();
    document.getElementById('btn-cancel-edit').style.display = 'none';
}

// FUNÇÃO DO ADMIN PARA FAZER DOWNLOAD DA ENCOMENDA EM BASE64
window.downloadBase64Order = function(orderId) {
    database.ref('orders/' + orderId).once('value').then(snapshot => {
        if(snapshot.exists()) {
            const order = snapshot.val();
            
            // Cria elemento virtual para download do txt contendo a string base64 pura
            const element = document.createElement('a');
            const file = new Blob([order.base64File], {type: 'text/plain'});
            element.href = URL.createObjectURL(file);
            element.download = `Lista_PS2_${order.usbOriginalSize}_${orderId}.txt`;
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        }
    });
};

// EXPORTAR BANCO DE DADOS (JSON BACKUP)
function exportDatabaseToJSON() {
    if (catalogGames.length === 0) return alert("Não há dados para exportar.");
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(catalogGames, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "backup_jogos_ps2.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.removeChild(downloadAnchor);
}

// IMPORTAR BANCO DE DADOS (JSON BACKUP)
function importDatabaseFromJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (Array.isArray(importedData)) {
                if (confirm(`Atenção: Isso adicionará ${importedData.length} jogos ao seu catálogo atual. Deseja continuar?`)) {
                    importedData.forEach(game => {
                        // Limpa a chave ID anterior se houver para não conflitar no push
                        const newGame = {
                            title: game.title,
                            displaySize: game.displaySize,
                            unit: game.unit,
                            sizeGB: game.sizeGB
                        };
                        database.ref('games').push(newGame);
                    });
                    alert("Jogos importados com sucesso!");
                }
            } else {
                alert("Formato de arquivo JSON inválido. Deve ser uma lista de jogos.");
            }
        } catch (err) {
            alert("Erro ao ler o arquivo JSON: " + err.message);
        }
    };
    reader.readAsText(file);
}
