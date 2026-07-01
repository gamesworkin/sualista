// ==========================================
// CONFIGURAÇÕES DO CONFIG DO FIREBASE
// Substitua pelas credenciais do seu Console Firebase
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
let generatedJpgBase64 = ""; // Armazena a imagem gerada temporariamente na sessão

const sections = {
    welcome: document.getElementById('welcome-section'),
    builder: document.getElementById('game-selection-section'),
    success: document.getElementById('success-section'),
    admin: document.getElementById('admin-section')
};

document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupEventListeners();
    setupKeyboardNavigation();
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

    document.getElementById('btn-back-to-usb').addEventListener('click', () => {
        switchSection('welcome');
    });

    // Abertura e fechamento controlado do Modal de Login
    const loginModal = document.getElementById('login-modal');
    document.getElementById('btn-admin-modal').addEventListener('click', () => {
        loginModal.style.display = 'flex';
        document.getElementById('login-email').focus();
    });
    
    document.querySelector('.close-modal').addEventListener('click', () => {
        loginModal.style.display = 'none';
    });
    
    // Submissão com efeito de carregamento visual "Logando..."
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        const btnSubmit = document.getElementById('btn-login-submit');
        
        // Bloqueia botão e altera texto para evitar cliques repetidos
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Logando...";

        auth.signInWithEmailAndPassword(email, pass)
            .then(() => {
                loginModal.style.display = 'none';
                document.getElementById('login-form').reset();
            })
            .catch(err => {
                alert("Falha ao autenticar: " + err.message);
            })
            .finally(() => {
                // Restaura o botão caso dê erro
                btnSubmit.disabled = false;
                btnSubmit.innerText = "Entrar no Painel";
            });
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

    // CRUD - Salvar / Editar Jogos
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

    // Monitora os campos de texto do cliente para ativar/desativar botão de envio
    const clientInputs = ['client-name', 'client-surname', 'client-whatsapp', 'client-city'];
    clientInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', updateStorageMetrics);
    });

    // Evento de geração da imagem real
    document.getElementById('btn-generate-list').addEventListener('click', processAndSendJPEGList);

    // Permite ao usuário baixar localmente o JPEG gerado
    document.getElementById('btn-download-user-jpg').addEventListener('click', () => {
        if(generatedJpgBase64) {
            const link = document.createElement('a');
            link.href = "data:image/jpeg;base64," + generatedJpgBase64;
            link.download = `Minha_Lista_PS2_${currentUsb.size}GB.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    });
}

// FUNÇÃO DE NAVEGAÇÃO POR TECLADO COM A TECLA ENTER
function setupKeyboardNavigation() {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');

    emailInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Impede o envio precoce do formulário
            passwordInput.focus(); // Pula para a senha
        }
    });
    // O campo de password naturalmente submete o form ao pressionar enter por estar dentro de um <form>
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

    // Validação de campos obrigatórios
    const name = document.getElementById('client-name').value.trim();
    const surname = document.getElementById('client-surname').value.trim();
    const whatsapp = document.getElementById('client-whatsapp').value.trim();
    const city = document.getElementById('client-city').value.trim();
    const formValido = name !== "" && surname !== "" && whatsapp !== "" && city !== "";

    if (totalUsedGB > max) {
        bar.classList.add('overlimit');
        btnGenerate.disabled = true;
    } else {
        bar.classList.remove('overlimit');
        // O botão só destrava com jogos na lista E formulário preenchido
        btnGenerate.disabled = !(userSelection.length > 0 && formValido);
    }
}

// --- GERAÇÃO COMPLETA DA IMAGEM REAL EM ALTA DEFINIÇÃO VIA CANVAS ---
function processAndSendJPEGList() {
    const name = document.getElementById('client-name').value.trim();
    const surname = document.getElementById('client-surname').value.trim();
    const whatsapp = document.getElementById('client-whatsapp').value.trim();
    const city = document.getElementById('client-city').value.trim();
    const fullName = `${name} ${surname}`;

    // Injeta os dados coletados nos rótulos da folha A4 interna
    document.getElementById('a4-lbl-name').innerText = fullName;
    document.getElementById('a4-lbl-whatsapp').innerText = whatsapp;
    document.getElementById('a4-lbl-city').innerText = city;
    document.getElementById('a4-usb-size').innerText = `${currentUsb.size}GB (Capacidade Real Livre: ${currentUsb.maxCapacity}GB)`;

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
    document.getElementById('a4-total-used').innerText = `${totalUsedGB.toFixed(2)} GB`;

    const btnGen = document.getElementById('btn-generate-list');
    btnGen.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando Imagem...';
    btnGen.disabled = true;

    // Renderização direta com Html2Canvas
    const targetElement = document.getElementById('a4-jpg-template');
    
    html2canvas(targetElement, {
        scale: 2, // Garante alta resolução para leitura de textos pequenos
        logging: false,
        useCORS: true
    }).then(canvas => {
        // Converte o canvas obtido para string JPEG base64 pura (removendo o cabeçalho data:image/jpeg;base64,)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const base64Image = dataUrl.split(',')[1];
        
        generatedJpgBase64 = base64Image;

        // Salva a Encomenda com os dados de identificação estruturados
        const orderPayload = {
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            clientName: fullName,
            clientWhatsapp: whatsapp,
            clientCity: city,
            usbOriginalSize: `${currentUsb.size}GB`,
            gamesCount: userSelection.length,
            imageJpgBase64: base64Image
        };

        database.ref('orders').push(orderPayload).then(() => {
            setupWhatsappButton(fullName, whatsapp, city);
            switchSection('success');
        }).catch(err => {
            alert("Erro ao enviar pedido para a base de dados: " + err.message);
            btnGen.innerHTML = '<i class="fa-solid fa-file-image"></i> Enviar e Gerar Imagem da Lista';
            btnGen.disabled = false;
        });
    });
}

function setupWhatsappButton(name, whatsapp, city) {
    let msg = `*AVISO DE NOVA LISTA DE JOGOS - PS2*%0A`;
    msg += `---------------------------------%0A`;
    msg += `*Cliente:* ${name}%0A`;
    msg += `*WhatsApp:* ${whatsapp}%0A`;
    msg += `*Cidade:* ${city}%0A`;
    msg += `*Pen Drive:* ${currentUsb.size}GB (${userSelection.length} jogos)%0A`;
    msg += `---------------------------------%0A`;
    msg += `_A imagem completa da lista já se encontra salva no seu Painel Administrativo!_`;

    const url = `https://api.whatsapp.com/send?phone=${TELEFONE_WHATSAPP}&text=${msg}`;
    document.getElementById('btn-whatsapp-share').onclick = () => window.open(url, '_blank');
}

// --- CONTROLE PAINEL DO ADMINISTRADOR ---
function loadAdminData() {
    database.ref('orders').on('value', snapshot => {
        const tableBody = document.getElementById('admin-orders-table');
        tableBody.innerHTML = '';
        
        if(!snapshot.exists()) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhuma nova encomenda na fila.</td></tr>';
            return;
        }

        snapshot.forEach(childSnapshot => {
            const order = childSnapshot.val();
            const orderId = childSnapshot.key;
            const date = new Date(order.timestamp).toLocaleString('pt-BR');
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${date}</td>
                <td>
                    <strong>${order.clientName}</strong><br>
                    <small style="color: #8892b0;">${order.clientWhatsapp} | ${order.clientCity}</small>
                </td>
                <td><i class="fa-solid fa-usb" style="color: var(--primary-neon);"></i> ${order.usbOriginalSize}</td>
                <td>${order.gamesCount} jogo(s)</td>
                <td>
                    <button class="btn-primary" style="padding: 6px 12px; font-size: 0.85rem;" onclick="viewImageFromAdmin('${orderId}')">
                        <i class="fa-solid fa-eye"></i> Ver Imagem
                    </button>
                    <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;" onclick="downloadImageFromAdmin('${orderId}')">
                        <i class="fa-solid fa-download"></i> Baixar JPEG
                    </button>
                    <button class="btn-danger" style="padding: 6px 12px; font-size: 0.85rem;" onclick="finalizeAndClearOrder('${orderId}')">
                        <i class="fa-solid fa-circle-check"></i> Finalizar e Deletar
                    </button>
                </td>
            `;
            tableBody.prepend(tr); 
        });
    });
}

// Abre a imagem JPEG gerada em uma nova guia para visualização imediata do Admin
window.viewImageFromAdmin = function(orderId) {
    database.ref('orders/' + orderId).once('value').then(snapshot => {
        if(snapshot.exists()) {
            const order = snapshot.val();
            const byteCharacters = atob(order.imageJpgBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {type: 'image/jpeg'});
            const fileURL = URL.createObjectURL(blob);
            window.open(fileURL, '_blank');
        }
    });
};

// Faz o download direto do arquivo de imagem do pedido
window.downloadImageFromAdmin = function(orderId) {
    database.ref('orders/' + orderId).once('value').then(snapshot => {
        if(snapshot.exists()) {
            const order = snapshot.val();
            const link = document.createElement('a');
            link.href = "data:image/jpeg;base64," + order.imageJpgBase64;
            link.download = `Lista_PS2_${order.clientName.replace(/\s+/g, '_')}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    });
};

// Remove de forma limpa o pedido finalizado da base do Firebase Realtime Database
window.finalizeAndClearOrder = function(orderId) {
    if(confirm("Deseja marcar essa encomenda como concluída e entregue? Isto apagará o registro permanentemente do banco de dados.")) {
        database.ref('orders/' + orderId).remove().then(() => {
            alert("Pedido finalizado com sucesso! Banco de dados limpo.");
        }).catch(err => alert("Erro ao limpar banco: " + err.message));
    }
};

function renderAdminGamesTable() {
    const tableBody = document.getElementById('admin-games-table');
    tableBody.innerHTML = '';
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
