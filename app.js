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

// Inicializações do Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Estado do Aplicativo de Usuário Atual
let currentUserData = null;
let currentDrive = { size: 0, limit: 0 };
let catalogGames = [];
let selectedGames = [];

// ==========================================
// CONTROLE DE TELAS E ABAS (LOGIN)
// ==========================================
const tabUser = document.getElementById('tab-user');
const tabAdmin = document.getElementById('tab-admin');
const formUser = document.getElementById('form-user');
const formAdmin = document.getElementById('form-admin');

tabUser.addEventListener('click', () => {
    tabUser.classList.add('active');
    tabAdmin.classList.remove('active');
    formUser.classList.add('active');
    formAdmin.classList.remove('active');
});

tabAdmin.addEventListener('click', () => {
    tabAdmin.classList.add('active');
    tabUser.classList.remove('active');
    formAdmin.classList.add('active');
    formUser.classList.remove('active');
});

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ==========================================
// FLUXO DE AUTENTICAÇÃO
// ==========================================

// Login do Cliente (Utiliza a Senha Master cadastrada no Auth)
formUser.addEventListener('submit', (e) => {
    e.preventDefault();
    const masterPass = document.getElementById('master-password').value;
    
    // Captura os dados do cliente obrigatórios
    currentUserData = {
        name: document.getElementById('user-name').value,
        lastname: document.getElementById('user-lastname').value,
        whatsapp: document.getElementById('user-whatsapp').value,
        city: document.getElementById('user-city').value,
        role: 'user'
    };

    // Injeta os dados cadastrados diretamente nos elementos internos do Ticket
    document.getElementById('tk-nome').innerText = currentUserData.name;
    document.getElementById('tk-sobrenome').innerText = currentUserData.lastname;
    document.getElementById('tk-whatsapp').innerText = currentUserData.whatsapp;
    document.getElementById('tk-cidade').innerText = currentUserData.city;

    // Autentica via Firebase Auth com e-mail padrão do sistema
    signInWithEmailAndPassword(auth, "master@gamelist.com", masterPass)
        .then(() => {
            showScreen('drive-selection-screen');
        })
        .catch(err => {
            alert("Senha Master Inválida! Erro: " + err.message);
        });
});

// Login do Administrador (admin@admin.com)
formAdmin.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-password').value;

    signInWithEmailAndPassword(auth, email, pass)
        .then(() => {
            currentUserData = { role: 'admin' };
            showScreen('admin-screen');
        })
        .catch(err => {
            alert("Acesso Administrativo Negado!");
        });
});

// Botões de Desconexão (Sair)
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
document.getElementById('admin-logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (!user) {
        showScreen('auth-screen');
        selectedGames = [];
    }
});

// ==========================================
// SELEÇÃO DO PENDRIVE
// ==========================================
document.querySelectorAll('.drive-card').forEach(card => {
    card.addEventListener('click', () => {
        currentDrive.size = card.dataset.size;
        currentDrive.limit = parseFloat(card.dataset.limit);
        
        // Atualiza textos na tela principal e injeta o tamanho no Ticket (JPEG)
        document.getElementById('display-drive-name').innerText = `Pendrive ${currentDrive.size}GB`;
        document.getElementById('tk-pendrive').innerText = `${currentDrive.size} GB (Real: ${currentDrive.limit} GB)`;
        
        // Reseta seleção anterior
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
    const catalogRef = ref(database, 'catalog');
    onValue(catalogRef, (snapshot) => {
        const data = snapshot.val();
        catalogGames = [];
        const catalogContainer = document.getElementById('catalog-list');
        catalogContainer.innerHTML = '';

        if(data) {
            Object.keys(data).forEach(key => {
                const game = { id: key, ...data[key] };
                catalogGames.push(game);

                // Constrói os cards do Catálogo de forma dinâmica
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

            // Adiciona evento aos novos Checkboxes criados
            document.querySelectorAll('.chk-gamer').forEach(chk => {
                chk.addEventListener('change', handleGameSelection);
            });
        } else {
            catalogContainer.innerHTML = '<p style="color: var(--text-muted)">Nenhum jogo no catálogo.</p>';
        }
    });
}

// Manipula a seleção e deseleção de jogos
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

// Atualização em Tempo Real da Barra de Armazenamento e Ativação do Botão
function updateStorageMeter() {
    const totalSize = selectedGames.reduce((acc, game) => acc + parseFloat(game.size), 0);
    const limit = currentDrive.limit;
    
    // Calcula a porcentagem ocupada da barra
    const percentage = Math.min((totalSize / limit) * 100, 100);
    
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = `${percentage}%`;
    
    document.getElementById('storage-text').innerText = `${totalSize.toFixed(2)} / ${limit.toFixed(2)} GB`;
    document.getElementById('game-counter').innerText = `Jogos selecionados: ${selectedGames.length} (Mínimo 5)`;

    const btnGenerate = document.getElementById('btn-generate-list');

    // Validação de Regras de Negócio
    if (totalSize > limit) {
        progressBar.classList.add('exceeded');
        btnGenerate.disabled = true;
    } else {
        progressBar.classList.remove('exceeded');
        // Valida se atingiu o mínimo de 5 jogos exigidos
        if (selectedGames.length >= 5) {
            btnGenerate.disabled = false;
        } else {
            btnGenerate.disabled = true;
        }
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
// GERAR IMAGEM JPEG (BASE64) E SALVAR NO FIREBASE
// ==========================================
document.getElementById('btn-generate-list').addEventListener('click', () => {
    const ticketElement = document.getElementById('ticket-lista');
    
    // Captura o HTML da lista contendo as info capturadas e gera o JPEG limpo
    html2canvas(ticketElement, { backgroundColor: "#ffffff" }).then(canvas => {
        const base64Image = canvas.toDataURL('image/jpeg', 0.9);

        // Salva o pedido com todos os dados do cliente e a imagem no banco Realtime Database
        const ordersRef = ref(database, 'orders');
        const newOrder = {
            client: currentUserData,
            driveSize: currentDrive.size,
            imageB64: base64Image,
            timestamp: Date.now()
        };

        push(ordersRef, newOrder)
            .then(() => {
                alert("🎮 Lista processada e enviada com sucesso para produção!");
                signOut(auth);
            })
            .catch(err => alert("Erro ao registrar pedido: " + err.message));
    });
});

// ==========================================
// PAINEL DO ADMINISTRADOR (CADASTRO E PEDIDOS)
// ==========================================

// Cadastrar novo jogo no Firebase
document.getElementById('form-add-game').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('game-title').value;
    const size = document.getElementById('game-size').value;

    const catalogRef = ref(database, 'catalog');
    push(catalogRef, {
        title: title,
        size: parseFloat(size).toFixed(1)
    }).then(() => {
        alert("Jogo adicionado com sucesso!");
        document.getElementById('form-add-game').reset();
    });
});

// Renderizar Pedidos com a Imagem gerada em Base64 para o Administrador
function loadOrdersForAdmin() {
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
                    <p><strong>Tamanho Solicitado:</strong> Pendrive de ${order.driveSize}GB</p>
                    <p><strong>Imagem da Lista (Salva em Base64):</strong></p>
                    <img src="${order.imageB64}" alt="Lista do Pedido">
                `;
                container.appendChild(box);
            });
        } else {
            container.innerHTML = '<p style="color: var(--text-muted)">Nenhum pedido recebido até o momento.</p>';
        }
    });
}

// Disparador para carregar os pedidos caso a tela seja a de Administração
setInterval(() => {
    if (document.getElementById('admin-screen').classList.contains('active')) {
        loadOrdersForAdmin();
    }
}, 3000);
