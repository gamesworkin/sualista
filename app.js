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
            if(sections.admin && sections.admin.classList.contains('active')) {
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
    // Escuta o clique nos cards dos Pendrives da Home de forma segura
    document.querySelectorAll('.usb-card').forEach(card => {
        card.addEventListener('click', () => {
            currentUsb.size = parseInt(card.dataset.size);
            currentUsb.maxCapacity = parseFloat(card.dataset.max);
            
            const titleEl = document.getElementById('selected-usb-title');
            if (titleEl) titleEl.innerText = `${currentUsb.size}GB`;
            
            userSelection = []; 
            updateStorageMetrics();
            renderUserSelection();
            switchSection('builder');
        });
    });

    const btnBack = document.getElementById('btn-back-to-usb');
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            switchSection('welcome');
        });
    }

    // Abertura e fechamento do Modal de Login
    const loginModal = document.getElementById('login-modal');
    const btnAdminModal = document.getElementById('btn-admin-modal');
    const closeEl = document.querySelector('.close-modal');

    if (btnAdminModal && loginModal) {
        btnAdminModal.addEventListener('click', () => {
            loginModal.style.style.display = 'flex';
            const emailInput = document.getElementById('login-email');
            if(emailInput) emailInput.focus();
        });
    }
    
    if (closeEl && loginModal) {
        closeEl.addEventListener('click', () => {
            loginModal.style.display = 'none';
        });
    }
    
    // Submissão do login administrativo
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const emailEl = document.getElementById('login-email');
            const passEl = document.getElementById('login-password');
            const btnSubmit = document.getElementById('btn-login-submit');
            
            if (!emailEl || !passEl) return;

            const email = emailEl.value;
            const pass = passEl.value;
            
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerText = "Logando...";
            }

            auth.signInWithEmailAndPassword(email, pass)
                .then(() => {
                    if (loginModal) loginModal.style.display = 'none';
                    loginForm.reset();
                })
                .catch(err => {
                    alert("Falha ao autenticar: " + err.message);
                })
                .finally(() => {
                    if (btnSubmit) {
                        btnSubmit.disabled = false;
                        btnSubmit.innerText = "Entrar no Painel";
                    }
                });
        });
    }

    const btnLogout = document.getElementById('btn-admin-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            auth.signOut().then(() => switchSection('welcome'));
        });
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetTab = document.getElementById(btn.dataset.tab);
            if (targetTab) targetTab.classList.add('active');
        });
    });

    // CRUD - Salvar / Editar Jogos
    const gameForm = document.getElementById('game-form');
    if (gameForm) {
        gameForm.addEventListener('submit', (e) => {
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
    }

    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', resetGameForm);

    const btnExport = document.getElementById('btn-export-json');
    if (btnExport) btnExport.addEventListener('click', exportDatabaseToJSON);

    const fileImport = document.getElementById('import-json');
    if (fileImport) fileImport.addEventListener('change', importDatabaseFromJSON);

    // Monitora os campos de identificação obrigatórios do cliente
    const clientInputs = ['client-name', 'client-surname', 'client-whatsapp', 'client-city'];
    clientInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateStorageMetrics);
    });

    // Evento de geração da imagem real
    const btnGenList = document.getElementById('btn-generate-list');
    if (btnGenList) btnGenList.addEventListener('click', processAndSendJPEGList);

    // Permite baixar localmente o JPEG gerado
    const btnDownUserJpg = document.getElementById('btn-download-user-jpg');
    if (btnDownUserJpg) {
        btnDownUserJpg.addEventListener('click', () => {
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
}

// MAPEAMENTO SEGURO DA NAVEGAÇÃO DE TECLADO (ENTER)
function setupKeyboardNavigation() {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');

    if (emailInput && passwordInput) {
        emailInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); 
                passwordInput.focus(); 
            }
        });
    }
}

function switchSection(sectionId) {
    Object.keys(sections).forEach(key => {
        if(sections[key]) sections[key].classList.remove('active');
    });
    if(sections[sectionId]) sections[sectionId].classList.add('active');
}

function formatGameSizeText(game) {
    return `${game.displaySize} ${game.unit}`;
}

function renderCatalog() {
    const listContainer = document.getElementById('catalog-list');
    if (!listContainer) return;
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
    if (!listContainer) return;
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

window.addGameToSelection = function(id) {
    const game = catalogGames.find(g => g.id === id);
    if(game) {
        userSelection.push(game);
        renderUserSelection();
        updateStorageMetrics();
    }
};

window.removeGameFromSelection = function(index) {
    userSelection.splice(index, 1);
    renderUserSelection();
    updateStorageMetrics();
};

function updateStorageMetrics() {
    let totalUsedGB = userSelection.reduce((acc, game) => acc + game.sizeGB, 0);
    const max = currentUsb.maxCapacity;
    const percentage = max > 0 ? (totalUsedGB / max) * 100 : 0;
    
    const bar = document.getElementById('storage-bar');
    const text = document.getElementById('storage-text');
    const btnGenerate = document.getElementById('btn-generate-list');

    if (bar) bar.style.width = `${Math.min(percentage, 100)}%`;
    if (text) text.innerText = `${totalUsedGB.toFixed(2)} GB / ${max.toFixed(2)} GB usado`;

    // Validação de campos obrigatórios
    const nameEl = document.getElementById('client-name');
    const surnameEl = document.getElementById('client-surname');
    const whatsappEl = document.getElementById('client-whatsapp');
    const cityEl = document.getElementById('client-city');

    const name = nameEl ? nameEl.value.trim() : "";
    const surname = surnameEl ? surnameEl.value.trim() : "";
    const whatsapp = whatsappEl ? whatsappEl.value.trim() : "";
    const city = cityEl ? cityEl.value.trim() : "";
    const formValido = name !== "" && surname !== "" && whatsapp !== "" && city !== "";

    if (btnGenerate) {
        if (totalUsedGB > max) {
            if (bar) bar.classList.add('overlimit');
            btnGenerate.disabled = true;
        } else {
            if (bar) bar.classList.remove('overlimit');
            btnGenerate.disabled = !(userSelection.length > 0 && formValido);
        }
    }
}

// --- RENDEREZACAO E ENVIO DA IMAGEM REAL VIA CANVAS ---
function processAndSendJPEGList() {
    const name = document.getElementById('client-name').value.trim();
    const surname = document.getElementById('client-surname').value.trim();
    const whatsapp = document.getElementById('client-whatsapp').value.trim();
    const city = document.getElementById('client-city').value.trim();
    const fullName = `${name} ${surname}`;

    document.getElementById('a4-lbl-name').innerText = fullName;
    document.getElementById('a4-lbl-whatsapp').innerText = whatsapp;
    document.getElementById('a4-lbl-city').innerText = city;
    document.getElementById('a4-usb-size').innerText = `${currentUsb.size}GB (Capacidade Real Livre: ${currentUsb.maxCapacity}GB)`;

    const tableBody = document.getElementById('a4-table-body');
    if (!tableBody) return;
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
    if (btnGen) {
        btnGen.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando Imagem...';
        btnGen.disabled = true;
    }

    const targetElement = document.getElementById('a4-jpg-template');
    
    html2canvas(targetElement, {
        scale: 2, 
        logging: false,
        useCORS: true
    }).then(canvas => {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const base64Image = dataUrl.split(',')[1];
        
        generatedJpgBase64 = base64Image;

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
            if (btnGen) {
                btnGen.innerHTML = '<i class="fa-solid fa-file-image"></i> Enviar e Gerar Imagem da Lista';
                btnGen.disabled = false;
            }
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
    const btnWpp = document.getElementById('btn-whatsapp-share');
    if (btnWpp) btnWpp.onclick = () => window.open(url, '_blank');
}

// --- CONTROLE PAINEL DO ADMINISTRADOR ---
function loadAdminData() {
    database.ref('orders').on('value', snapshot => {
        const tableBody = document.getElementById('admin-orders-table');
        if (!tableBody) return;
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

window.finalizeAndClearOrder = function(orderId) {
    if(confirm("Deseja marcar essa encomenda como concluída e entregue? Isto apagará o registro permanentemente do banco de dados.")) {
        database.ref('orders/' + orderId).remove().then(() => {
            alert("Pedido finalizado com sucesso! Banco de dados limpo.");
        }).catch(err => alert("Erro ao limpar banco: " + err.message));
    }
};

function renderAdminGamesTable() {
    const tableBody = document.getElementById('admin-games-table');
    if (!tableBody) return;
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

window.startEditGame = function(id) {
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
};

window.deleteGame = function(id) {
    if(confirm("Deseja excluir este jogo?")) {
        database.ref('games/' + id).remove();
    }
};

function resetGameForm() {
    isEditing = false;
    currentEditId = null;
    const form = document.getElementById('game-form');
    if (form) form.reset();
    document.getElementById('form-title').innerText = "Cadastrar Novo Jogo";
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
