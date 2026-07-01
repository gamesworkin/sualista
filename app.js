// ==========================================
// CONFIGURAÇÕES DO CONFIG DO FIREBASE
// Substitua obrigatoriamente pelas credenciais do seu Console Firebase
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

// Inicialização segura das instâncias do Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// CONFIGURAÇÃO DO NÚMERO DE DESTINO DO WHATSAPP DO PROPRIETÁRIO
const TELEFONE_WHATSAPP = "5588988470190";

// GERENCIAMENTO DE ESTADOS GERAIS
let currentUsb = { size: 0, maxCapacity: 0 };
let catalogGames = [];
let userSelection = [];
let isEditing = false;
let currentEditId = null;

// MAPEAMENTO DOS ELEMENTOS DAS SEÇÕES
const sections = {
    welcome: document.getElementById('welcome-section'),
    builder: document.getElementById('game-selection-section'),
    success: document.getElementById('success-section'),
    admin: document.getElementById('admin-section')
};

// DISPARO AO CARREGAR O DOM DO NAVEGADOR
document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    // Monitor de autenticação persistente para a Área Admin
    auth.onAuthStateChanged(user => {
        if (user && user.email === 'admin@admin.com') {
            switchSection('admin');
            loadAdminData();
        } else {
            if(sections.admin.classList.contains('active')) {
                switchSection('welcome');
            }
        }
    });

    // Ouvinte em tempo real da lista base de jogos do banco Realtime Database
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
    // Escuta o clique nos cards dos Pendrives da Home
    document.querySelectorAll('.usb-card').forEach(card => {
        card.addEventListener('click', () => {
            currentUsb.size = parseInt(card.dataset.size);
            currentUsb.maxCapacity = parseFloat(card.dataset.max);
            
            document.getElementById('selected-usb-title').innerText = `${currentUsb.size}GB`;
            userSelection = []; 
            updateStorageMetrics();
            renderUserSelection();
            switchSection('builder');
        });
    });

    // Retornar da tela de montagem para a tela de escolha dos Pendrives
    document.getElementById('btn-back-to-usb').addEventListener('click', () => {
        switchSection('welcome');
    });

    // Gerenciamento Isolado de Abertura do Modal de Login do Admin
    const loginModal = document.getElementById('login-modal');
    document.getElementById('btn-admin-modal').addEventListener('click', () => {
        loginModal.style.display = 'flex';
    });
    
    document.querySelector('.close-modal').addEventListener('click', () => {
        loginModal.style.display = 'none';
    });
    
    // Submissão do Formulário de Login do Firebase
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const pass = document.getElementById('login-password').value;
        auth.signInWithEmailAndPassword('admin@admin.com', pass)
            .then(() => {
                loginModal.style.display = 'none';
                document.getElementById('login-password').value = '';
            })
            .catch(err => {
                alert("Falha ao autenticar administrador: " + err.message);
            });
    });

    // Desautenticação do Administrador
    document.getElementById('btn-admin-logout').addEventListener('click', () => {
        auth.signOut().then(() => {
            switchSection('welcome');
        });
    });

    // Alternância entre as abas internas do Painel Administrativo
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // Criação ou Edição de itens do catálogo via Painel Admin
    document.getElementById('game-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('game-title').value;
        const sizeValue = parseFloat(document.getElementById('game-size').value);
        const unit = document.getElementById('game-unit').value;
        
        // Padroniza de forma interna a volumetria em GB para cálculos lineares
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

    // Exportação e Importação de Cópias de Segurança em JSON
    document.getElementById('btn-export-json').addEventListener('click', exportDatabaseToJSON);
    document.getElementById('import-json').addEventListener('change', importDatabaseFromJSON);

    // Finalização e envio da lista montada pelo Usuário
    document.getElementById('btn-generate-list').addEventListener('click', finishAndSendList);

    // Manipulação da Visualização e Impressão do Modelo de Folha A4
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

// ALTERNADOR GLOBAL DE VISIBILIDADE DAS TELAS
function switchSection(sectionId) {
    Object.values(sections).forEach(s => s.classList.remove('active'));
    sections[sectionId].classList.add('active');
}

// RETORNA STRING FORMATADA DO TAMANHO DO JOGO
function formatGameSizeText(game) {
    return `${game.displaySize} ${game.unit}`;
}

// RENDERIZAÇÃO DO CATÁLOGO DE JOGOS DISPONÍVEIS
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

// RENDERIZAÇÃO DA SELEÇÃO ATUAL DO USUÁRIO
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

// GERENCIADOR DE MÉTRICAS E VALIDAÇÃO DE ESTOURO DO TAMANHO MÁXIMO DO PENDRIVE
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
        btnGenerate.disabled = userSelection.length === 0;
    }
}

// GERAÇÃO DO DOCUMENTO EM BASE64 E SALVAMENTO DE ENCOMENDAS NO FIREBASE
function finishAndSendList() {
    const tableBody = document.getElementById('a4-table-body');
    tableBody.innerHTML = '';
    
    userSelection.forEach((game, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td style="font-weight: bold; text-align: left;">${game.title}</td>
            <td>${formatGameSizeText(game)}</td>
        `;
        tableBody.appendChild(tr);
    });

    let totalUsedGB = userSelection.reduce((acc, game) => acc + game.sizeGB, 0);
    document.getElementById('a4-usb-size').innerText = `${currentUsb.size}GB (Capacidade real: ${currentUsb.maxCapacity}GB)`;
    document.getElementById('a4-total-used').innerText = `${totalUsedGB.toFixed(2)} GB`;

    // Processa o encapsulamento HTML puro da folha gerada e converte em String Base64 limpa
    const htmlContent = document.getElementById('a4-container').innerHTML;
    const base64List = btoa(unescape(encodeURIComponent(htmlContent)));

    const orderPayload = {
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        usbOriginalSize: `${currentUsb.size}GB`,
        gamesCount: userSelection.length,
        base64File: base64List
    };

    database.ref('orders').push(orderPayload)
        .then(() => {
            setupWhatsappButton();
            switchSection('success');
        })
        .catch(err => {
            alert("Erro ao enviar a lista gerada para o servidor: " + err.message);
        });
}

// MONTAGEM DO LINK DIRETO COM TEXTO RESTRUTURADO PARA O WHATSAPP
function setupWhatsappButton() {
    let msg = `*NOVA ENCOMENDA DE JOGOS - PS2*%0A`;
    msg += `---------------------------------%0A`;
    msg += `*Pen Drive Selecionado:* ${currentUsb.size}GB%0A`;
    msg += `*Quantidade de Jogos:* ${userSelection.length}%0A%0A`;
    msg += `*LISTA DOS JOGOS SELECIONADOS:*%0A`;
    
    userSelection.forEach((game, i) => {
        msg += `${i+1}. ${game.title} (${formatGameSizeText(game)})%0A`;
    });

    const url = `https://api.whatsapp.com/send?phone=${TELEFONE_WHATSAPP}&text=${msg}`;
    document.getElementById('btn-whatsapp-share').onclick = () => {
        window.open(url, '_blank');
    };
}

// PROCESSAMENTO DE ENCOMENDAS RECEBIDAS DO BANCO NA ÁREA DO ADMINISTRADOR
function loadAdminData() {
    database.ref('orders').on('value', snapshot => {
        const tableBody = document.getElementById('admin-orders-table');
        tableBody.innerHTML = '';
        
        if(!snapshot.exists()) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhuma lista encomendada localizada no momento.</td></tr>';
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
            tableBody.prepend(tr); 
        });
    });
}

function renderAdminGamesTable() {
    const tableBody = document.getElementById('admin-games-table');
    tableBody.innerHTML = '';

    if(catalogGames.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Nenhum jogo localizado no catálogo base.</td></tr>';
        return;
    }

    catalogGames.forEach(game => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${game.title}</td>
            <td>${formatGameSizeText(game)}</td>
            <td>
                <button class="btn-secondary" style="padding: 6px 12px;" onclick="startEditGame('${game.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="btn-danger" style="padding: 6px 12px;" onclick="deleteGame('${game.id}')"><i class="fa-solid fa-trash"></i></button>
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
    if(confirm("Deseja realmente remover este jogo da base de dados?")) {
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

// FUNÇÃO PARA DOWNLOAD DA STRING BASE64 PURA EM ARQUIVO .TXT
window.downloadBase64Order = function(orderId) {
    database.ref('orders/' + orderId).once('value').then(snapshot => {
        if(snapshot.exists()) {
            const order = snapshot.val();
            const element = document.createElement('a');
            const file = new Blob([order.base64File], {type: 'text/plain'});
            element.href = URL.createObjectURL(file);
            element.download = `Lista_Base64_PS2_${orderId}.txt`;
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        }
    });
};

// EXPORTAR BACKUP COMPLETO DO BANCO EM JSON
function exportDatabaseToJSON() {
    if (catalogGames.length === 0) return alert("Não existem dados disponíveis para exportação.");
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(catalogGames, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "backup_jogos_ps2.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.removeChild(downloadAnchor);
}

// IMPORTAR DADOS EXTERNOS VIA ARQUIVO JSON
function importDatabaseFromJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (Array.isArray(importedData)) {
                if (confirm(`Confirmar inclusão de ${importedData.length} novos jogos no catálogo em lote?`)) {
                    importedData.forEach(game => {
                        const newGame = {
                            title: game.title,
                            displaySize: game.displaySize,
                            unit: game.unit,
                            sizeGB: game.sizeGB
                        };
                        database.ref('games').push(newGame);
                    });
                    alert("Catálogo atualizado com sucesso!");
                }
            } else {
                alert("Formato incompatível detectado no JSON.");
            }
        } catch (err) {
            alert("Erro durante o processamento do arquivo JSON: " + err.message);
        }
    };
    reader.readAsText(file);
}
