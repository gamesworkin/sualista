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
let generatedPdfBase64 = ""; // Armazena o PDF gerado temporariamente para o usuário baixar

const sections = {
    welcome: document.getElementById('welcome-section'),
    builder: document.getElementById('game-selection-section'),
    success: document.getElementById('success-section'),
    admin: document.getElementById('admin-section')
};

document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    // Monitor de autenticação para a Área Admin
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

    // Ouvinte em tempo real da lista base de jogos do Realtime Database
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

    document.getElementById('btn-back-to-usb').addEventListener('click', () => {
        switchSection('welcome');
    });

    // Abertura do Modal de Login do Admin
    const loginModal = document.getElementById('login-modal');
    document.getElementById('btn-admin-modal').addEventListener('click', () => {
        loginModal.style.display = 'flex';
    });
    
    document.querySelector('.close-modal').addEventListener('click', () => {
        loginModal.style.display = 'none';
    });
    
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const pass = document.getElementById('login-password').value;
        auth.signInWithEmailAndPassword('admin@admin.com', pass)
            .then(() => {
                loginModal.style.display = 'none';
                document.getElementById('login-password').value = '';
            })
            .catch(err => alert("Falha ao autenticar: " + err.message));
    });

    document.getElementById('btn-admin-logout').addEventListener('click', () => {
        auth.signOut().then(() => switchSection('welcome'));
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // CRUD do Administrador - Salvar / Editar
    document.getElementById('game-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('game-title').value;
        const sizeValue = parseFloat(document.getElementById('game-size').value);
        const unit = document.getElementById('game-unit').value;
        const sizeInGB = unit === 'MB' ? sizeValue / 1024 : sizeValue;

        const gameData = {
            title: title,
            displaySize: sizeValue,
            unit: unit,
            sizeGB: sizeInGB
        };

        if (isEditing) {
            database.ref('games/' + currentEditId).set(gameData).then(() => resetGameForm());
        } else {
            database.ref('games').push(gameData).then(() => resetGameForm());
        }
    });

    document.getElementById('btn-cancel-edit').addEventListener('click', resetGameForm);
    document.getElementById('btn-export-json').addEventListener('click', exportDatabaseToJSON);
    document.getElementById('import-json').addEventListener('change', importDatabaseFromJSON);

    // Fluxo do Usuário: Gerar lista transforma a folha em PDF real e joga em Base64
    document.getElementById('btn-generate-list').addEventListener('click', processAndSendPDFList);

    // Ação do usuário baixar o PDF localmente na tela de sucesso
    document.getElementById('btn-download-user-pdf').addEventListener('click', () => {
        if(generatedPdfBase64) {
            downloadPdfFromBase64(generatedPdfBase64, `Minha_Lista_PS2_${currentUsb.size}GB.pdf`);
        }
    });
}

function switchSection(sectionId) {
    Object.values(sections).forEach(s => s.classList.remove('active'));
    sections[sectionId].classList.add('active');
}

function formatGameSizeText(game) {
    return `${game.displaySize} ${game.unit}`;
}

function renderCatalog() {
    const listContainer = document.getElementById('catalog-list');
    listContainer.innerHTML = '';
    if(catalogGames.length === 0) {
        listContainer.innerHTML = '<p style="padding:15px; color:#666;">Catálogo vazio.</p>';
        return;
    }
    catalogGames.forEach(game => {
        const item = document.createElement('div');
        item.className = 'game-item';
        item.innerHTML = `
            <div class="game-item-info"><span class="title">${game.title}</span><span class="size">${formatGameSizeText(game)}</span></div>
            <button class="btn-primary" onclick="addGameToSelection('${game.id}')"><i class="fa-solid fa-plus"></i></button>
        `;
        listContainer.appendChild(item);
    });
}

function renderUserSelection() {
    const listContainer = document.getElementById('user-selected-list');
    listContainer.innerHTML = '';
    if(userSelection.length === 0) {
        listContainer.innerHTML = '<p style="padding:15px; color:#666;">Nenhum jogo selecionado.</p>';
        return;
    }
    userSelection.forEach((game, index) => {
        const item = document.createElement('div');
        item.className = 'game-item';
        item.innerHTML = `
            <div class="game-item-info"><span class="title">${game.title}</span><span class="size">${formatGameSizeText(game)}</span></div>
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
        btnGenerate.disabled = userSelection.length === 0;
    }
}

// --- GERAÇÃO COMPLETA DO PDF REAL (HTML2PDF) EM BASE64 PARA ENVIO ---
function processAndSendPDFList() {
    const tableBody = document.getElementById('a4-table-body');
    tableBody.innerHTML = '';
    
    userSelection.forEach((game, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center;">${index + 1}</td>
            <td style="font-weight: bold;">${game.title}</td>
            <td style="text-align: center;">${formatGameSizeText(game)}</td>
        `;
        tableBody.appendChild(tr);
    });

    let totalUsedGB = userSelection.reduce((acc, game) => acc + game.sizeGB, 0);
    document.getElementById('a4-usb-size').innerText = `${currentUsb.size}GB (Teto Real: ${currentUsb.maxCapacity}GB)`;
    document.getElementById('a4-total-used').innerText = `${totalUsedGB.toFixed(2)} GB`;

    // Configuração do motor html2pdf para folha A4 perfeita
    const element = document.getElementById('a4-pdf-template');
    const opt = {
        margin: 0,
        filename: 'lista.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Altera o texto do botão para indicar carregamento
    const btnGen = document.getElementById('btn-generate-list');
    btnGen.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando PDF...';
    btnGen.disabled = true;

    html2pdf().set(opt).from(element).outputPdf('arraybuffer').then(pdfBuffer => {
        // Converte o Buffer Binário do PDF diretamente em uma String Base64 limpa
        let binary = '';
        const bytes = new Uint8Array(pdfBuffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64PDF = window.btoa(binary);
        
        generatedPdfBase64 = base64PDF; // salva localmente na sessão do cliente

        // Salva nas Encomendas do Administrador no Firebase
        const orderPayload = {
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            usbOriginalSize: `${currentUsb.size}GB`,
            gamesCount: userSelection.length,
            pdfBase64File: base64PDF
        };

        database.ref('orders').push(orderPayload).then(() => {
            setupWhatsappButton();
            switchSection('success');
        }).catch(err => {
            alert("Erro ao sincronizar pedido com o servidor: " + err.message);
            btnGen.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Gerar Lista Final (PDF)';
            btnGen.disabled = false;
        });
    });
}

function setupWhatsappButton() {
    let msg = `*NOVA ENCOMENDA DE JOGOS - PS2*%0A`;
    msg += `---------------------------------%0A`;
    msg += `*Pen Drive:* ${currentUsb.size}GB%0A`;
    msg += `*Quantidade de Jogos:* ${userSelection.length}%0A%0A`;
    msg += `*JOGOS SOLICITADOS:*%0A`;
    userSelection.forEach((game, i) => {
        msg += `${i+1}. ${game.title} (${formatGameSizeText(game)})%0A`;
    });
    const url = `https://api.whatsapp.com/send?phone=${TELEFONE_WHATSAPP}&text=${msg}`;
    document.getElementById('btn-whatsapp-share').onclick = () => window.open(url, '_blank');
}

// --- FLUXO DO ADMINISTRADOR ---
function loadAdminData() {
    database.ref('orders').on('value', snapshot => {
        const tableBody = document.getElementById('admin-orders-table');
        tableBody.innerHTML = '';
        
        if(!snapshot.exists()) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Nenhuma nova encomenda na fila.</td></tr>';
            return;
        }

        snapshot.forEach(childSnapshot => {
            const order = childSnapshot.val();
            const orderId = childSnapshot.key;
            const date = new Date(order.timestamp).toLocaleString('pt-BR');
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${date}</td>
                <td><i class="fa-solid fa-usb" style="color: var(--primary-neon);"></i> ${order.usbOriginalSize}</td>
                <td>${order.gamesCount} jogo(s)</td>
                <td>
                    <button class="btn-primary" style="padding: 6px 12px; font-size: 0.85rem;" onclick="viewPdfFromAdmin('${orderId}')">
                        <i class="fa-solid fa-eye"></i> Visualizar PDF
                    </button>
                    <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;" onclick="downloadPdfFromAdmin('${orderId}')">
                        <i class="fa-solid fa-download"></i> Baixar PDF
                    </button>
                    <button class="btn-danger" style="padding: 6px 12px; font-size: 0.85rem;" onclick="finalizeAndClearOrder('${orderId}')">
                        <i class="fa-solid fa-circle-check"></i> Finalizar e Entregar
                    </button>
                </td>
            `;
            tableBody.prepend(tr); 
        });
    });
}

// FUNÇÃO PARA O ADMIN REVISAR O PEDIDO EM PDF INSTANTANEAMENTE
window.viewPdfFromAdmin = function(orderId) {
    database.ref('orders/' + orderId).once('value').then(snapshot => {
        if(snapshot.exists()) {
            const order = snapshot.val();
            const base64 = order.pdfBase64File;
            
            // Converte base64 para blob binário e abre em uma nova aba do navegador nativamente
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {type: 'application/pdf'});
            const fileURL = URL.createObjectURL(blob);
            window.open(fileURL, '_blank');
        }
    });
};

// FUNÇÃO PARA O ADMIN BAIXAR O PDF LEGÍTIMO DIRETAMENTE
window.downloadPdfFromAdmin = function(orderId) {
    database.ref('orders/' + orderId).once('value').then(snapshot => {
        if(snapshot.exists()) {
            const order = snapshot.val();
            downloadPdfFromBase64(order.pdfBase64File, `Pedido_PS2_${order.usbOriginalSize}_${orderId}.pdf`);
        }
    });
};

// BOTÃO FINALIZAR: REMOVE O PEDIDO DO FIREBASE BANCO DE DADOS PARA LIMPEZA DEFINITIVA
window.finalizeAndClearOrder = function(orderId) {
    if(confirm("Deseja marcar essa encomenda como concluída? Ela será excluída permanentemente do painel.")) {
        database.ref('orders/' + orderId).remove().then(() => {
            alert("Pedido finalizado com sucesso. Banco de dados limpo!");
        }).catch(err => alert("Erro ao limpar registro: " + err.message));
    }
};

// AUXILIAR DE DOWNLOAD GLOBAL DE PDF VIA BASE64
function downloadPdfFromBase64(base64String, filename) {
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {type: 'application/pdf'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderAdminGamesTable() {
    const tableBody = document.getElementById('admin-games-table');
    tableBody.innerHTML = '';
    if(catalogGames.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Nenhum jogo cadastrado.</td></tr>';
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
    if(confirm("Deseja excluir este jogo?")) {
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

function exportDatabaseToJSON() {
    if (catalogGames.length === 0) return alert("Sem dados.");
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(catalogGames, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "backup_jogos_ps2.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.removeChild(downloadAnchor);
}

function importDatabaseFromJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (Array.isArray(importedData)) {
                if (confirm(`Importar ${importedData.length} jogos?`)) {
                    importedData.forEach(game => {
                        database.ref('games').push({
                            title: game.title,
                            displaySize: game.displaySize,
                            unit: game.unit,
                            sizeGB: game.sizeGB
                        });
                    });
                    alert("Importado com sucesso!");
                }
            }
        } catch (err) { alert("Erro: " + err.message); }
    };
    reader.readAsText(file);
}
