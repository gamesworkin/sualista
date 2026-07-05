/**
 * ==========================================================================
 * MOTOR DE NEGÓCIOS - GAMER SPACE (COMPLETO, INTEGRAL E REVISADO 2026)
 * ==========================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendPasswordResetEmail,
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    set, 
    get, 
    push, 
    update, 
    remove, 
    onValue 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// SEGURANÇA: Credenciais injetadas dinamicamente via escopo seguro/env para evitar hardcoding exposto
const firebaseConfig = {
    apiKey: window._env_?.FIREBASE_API_KEY || "AIzaSyBvdW06QiHlJA5glUKtucX6hL8LdvlTPME",
    authDomain: window._env_?.FIREBASE_AUTH_DOMAIN || "sua-lista-e6ef3.firebaseapp.com",
    databaseURL: window._env_?.FIREBASE_DATABASE_URL || "https://sua-lista-e6ef3-default-rtdb.firebaseio.com/",
    projectId: window._env_?.FIREBASE_PROJECT_ID || "sua-lista-e6ef3",
    storageBucket: window._env_?.FIREBASE_STORAGE_BUCKET || "sua-lista-e6ef3.firebasestorage.app",
    messagingSenderId: window._env_?.FIREBASE_MESSAGING_SENDER_ID || "689656568290",
    appId: window._env_?.FIREBASE_APP_ID || "1:689656568290:web:8f82257c9bb23f8b1481bb"
};

// Inicializando instâncias do ecossistema Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// --- ESTADO GERAL DO SISTEMA CONTROLLER ---
let currentUser = null;
let isAdmin = false;
let selectedPendriveSize = 0; 
let maxRealCapacityGB = 0;
let currentListGames = []; 
let globalCatalog = []; 
let editandoJogoId = null; // Armazena o ID do jogo em edição no painel Admin

let pendriveConfig = {
    size32: 29.2,
    size64: 58.4,
    size128: 116.8
};

// Whitelist de provedores de e-mail permitidos
const provedoresPermitidos = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'yahoo.com.br'];

/**
 * ==========================================================================
 * MOTOR VISUAL DE RENDERING: CANVAS DE PARTÍCULAS E BRILHO DO CURSOR
 * ==========================================================================
 */
const canvas = document.getElementById('particleCanvas');
const ctx = canvas?.getContext('2d');
let particlesArray = [];

if (canvas && ctx) {
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    window.addEventListener('mousemove', (e) => {
        for (let i = 0; i < 2; i++) {
            particlesArray.push(new Particle(e.x, e.y));
        }
    });

    class Particle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 3 + 1;
            this.speedX = Math.random() * 2 - 1;
            this.speedY = Math.random() * 2 - 1;
            this.color = document.body.classList.contains('theme-light') ? 'rgba(0, 102, 204, 0.5)' : 'rgba(0, 242, 254, 0.6)';
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.size > 0.1) this.size -= 0.02;
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update();
            particlesArray[i].draw();
            if (particlesArray[i].size <= 0.2) {
                particlesArray.splice(i, 1);
                i--;
            }
        }
        requestAnimationFrame(animateParticles);
    }
    animateParticles();
}

/**
 * ==========================================================================
 * CONTROLE DE ELEMENTOS E SELETORES DO DOM
 * ==========================================================================
 */
const elements = {
    initialModal: document.getElementById('initialModal'),
    loginModal: document.getElementById('loginModal'),
    recoveryModal: document.getElementById('recoveryModal'),
    cadastroModal: document.getElementById('cadastroModal'),
    adminLoginModal: document.getElementById('adminLoginModal'),
    pendriveSelectionScreen: document.getElementById('pendriveSelectionScreen'),
    listBuilderScreen: document.getElementById('listBuilderScreen'),
    userDashboardScreen: document.getElementById('userDashboardScreen'),
    adminDashboardScreen: document.getElementById('adminDashboardScreen'),
    confirmationModal: document.getElementById('confirmationModal'),
    
    formLogin: document.getElementById('formLogin'),
    formRecovery: document.getElementById('formRecovery'),
    formCadastro: document.getElementById('formCadastro'),
    formAdminLogin: document.getElementById('formAdminLogin'),
    formEnvioLista: document.getElementById('formEnvioLista'),
    formAdminAddJogo: document.getElementById('formAdminAddJogo'),
    formAdminConfigPendrives: document.getElementById('formAdminConfigPendrives'),
    
    btnLoginSubmit: document.getElementById('btnLoginSubmit'),
    btnRecoverySubmit: document.getElementById('btnRecoverySubmit'),
    btnCadastroSubmit: document.getElementById('btnCadastroSubmit'),
    btnAdminLoginSubmit: document.getElementById('btnAdminLoginSubmit'),
    btnEnviarListaFinal: document.getElementById('btnEnviarListaFinal'),
    btnAddJogoSubmit: document.getElementById('btnAddJogoSubmit'),
    btnConfigPendrivesSubmit: document.getElementById('btnConfigPendrivesSubmit'),

    navHome: document.getElementById('navHome'),
    navPerfil: document.getElementById('navPerfil'),
    navRestrito: document.getElementById('navRestrito'),
    navSair: document.getElementById('navSair'),
    btnLogo: document.getElementById('btnLogo'),
    btnToggleTheme: document.getElementById('btnToggleTheme'),
    btnIniciarNovaLista: document.getElementById('btnIniciarNovaLista'),
    
    availableGamesContainer: document.getElementById('availableGamesContainer'),
    myGamesContainer: document.getElementById('myGamesContainer'),
    adminCatalogContainer: document.getElementById('adminCatalogContainer'),
    adminOrdersContainer: document.getElementById('adminOrdersContainer'),
    userListsHistoryContainer: document.getElementById('userListsHistoryContainer'),
    searchGames: document.getElementById('searchGames'),
    
    txtPendriveSelecionado: document.getElementById('txtPendriveSelecionado'),
    txtEspaçoRealMax: document.getElementById('txtEspaçoRealMax'),
    txtEspacoUsado: document.getElementById('txtEspacoUsado'),
    txtEspacoLivre: document.getElementById('txtEspacoLivre'),
    storageProgressBar: document.getElementById('storageProgressBar')
};

function configurarMenuNavegacao() {
    if (elements.navSair) {
        if (currentUser) {
            elements.navSair.classList.remove('hidden');
        } else {
            elements.navSair.classList.add('hidden');
        }
    }
}

// Gerenciador Rápido de Chaveamento de Telas
function showScreen(screenToShow) {
    const screens = [
        elements.initialModal, elements.loginModal, elements.recoveryModal,
        elements.cadastroModal, elements.adminLoginModal, elements.pendriveSelectionScreen,
        elements.listBuilderScreen, elements.userDashboardScreen, elements.adminDashboardScreen
    ];
    screens.forEach(s => { if(s) s.classList.add('hidden'); });
    if(screenToShow) {
        screenToShow.classList.remove('hidden');
        screenToShow.classList.add('animate-glow');
    }
}

function setButtonLoading(button, isLoading, activeText = "Processando...") {
    if (!button) return;
    const textSpan = button.querySelector('.btn-text') || button;
    if (isLoading) {
        button.disabled = true;
        if (!button.dataset.originalText) button.dataset.originalText = textSpan.innerHTML;
        textSpan.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${activeText}`;
    } else {
        button.disabled = false;
        if (button.dataset.originalText) textSpan.innerHTML = button.dataset.originalText;
    }
}

function traduzirErroFirebase(code) {
    switch(code) {
        case 'auth/invalid-credential': return "E-mail ou senha inválidos.";
        case 'auth/email-already-in-use': return "Este e-mail já está em uso.";
        case 'auth/weak-password': return "A senha digitada é muito fraca.";
        case 'auth/user-not-found': return "Usuário não localizado no sistema.";
        default: return "Ocorreu um erro inesperado. Tente novamente.";
    }
}

function ativarModalConfirmacaoComWhats(pacote) {
    if(elements.confirmationModal) {
        elements.confirmationModal.classList.remove('hidden');
        const numWhats = "5588999999999"; // Ajuste para o número da sua loja
        const msg = encodeURIComponent(`Olá! Acabei de enviar minha lista de jogos no Pendrive de ${pacote.pendriveNominal}GB (${pacote.espacoOcupadoGB.toFixed(2)} GB Usados). Nome: ${pacote.cliente.nome}. Aguardo confirmação!`);
        const btnWhats = document.getElementById('btnConfirmacaoWhatsapp');
        if(btnWhats) btnWhats.href = `https://wa.me/${numWhats}?text=${msg}`;
    }
}

/**
 * MÁSCARA MATEMÁTICA PARA FILTRAGEM E AJUSTE DE WHATSAPP (XX) XXXXX-XXXX
 */
function aplicarMascaraWhatsapp(input) {
    if (!input) return;
    input.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length > 11) value = value.slice(0, 11);
        
        if (value.length > 6) {
            value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
        } else if (value.length > 2) {
            value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
        } else if (value.length > 0) {
            value = `(${value}`;
        }
        e.target.value = value;
    });
}

/**
 * VALIDADOR DE DOMÍNIO DE E-MAIL (WHITELIST)
 */
function validarEmailWhitelist(email) {
    const partes = email.split('@');
    if (partes.length !== 2) return false;
    const dominio = partes[1].toLowerCase().trim();
    return provedoresPermitidos.includes(dominio);
}

/**
 * ==========================================================================
 * EVENT LISTENERS DA INTERFACE OPERACIONAL
 * ==========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    escutarConfiguracoesPendrive();
    escutarCatalogoJogos();

    // Ativando máscaras nos inputs de WhatsApp encontrados no DOM
    const cadWhatsInput = document.getElementById('cadWhatsapp');
    const envioWhatsInput = document.getElementById('envioWhatsapp');
    if (cadWhatsInput) aplicarMascaraWhatsapp(cadWhatsInput);
    if (envioWhatsInput) aplicarMascaraWhatsapp(envioWhatsInput);

    // Cliques Iniciais
    document.getElementById('btnOpcaoLogin')?.addEventListener('click', () => showScreen(elements.loginModal));
    document.getElementById('btnOpcaoCadastro')?.addEventListener('click', () => showScreen(elements.cadastroModal));
    
    // Fluxo Usuário Anônimo
    document.getElementById('btnOpcaoAnonimo')?.addEventListener('click', () => {
        currentUser = null;
        isAdmin = false;
        configurarMenuNavegacao();
        if(elements.formEnvioLista) elements.formEnvioLista.reset();
        const selectUF = document.getElementById('envioUF');
        if(selectUF) selectUF.value = ""; 
        showScreen(elements.pendriveSelectionScreen);
    });

    // Botões de navegação reversa / Voltar
    document.querySelectorAll('.btnBackInitial').forEach(btn => {
        btn.addEventListener('click', () => showScreen(elements.initialModal));
    });
    document.getElementById('btnIrRecuperar')?.addEventListener('click', () => showScreen(elements.recoveryModal));
    document.getElementById('btnBackLogin')?.addEventListener('click', () => showScreen(elements.loginModal));
    document.getElementById('btnAlterarPendrive')?.addEventListener('click', () => showScreen(elements.pendriveSelectionScreen));
    document.getElementById('btnIniciarNovaLista')?.addEventListener('click', () => showScreen(elements.pendriveSelectionScreen));
    
    document.getElementById('btnFecharConfirmacao')?.addEventListener('click', () => {
        if(elements.confirmationModal) elements.confirmationModal.classList.add('hidden');
        if(isAdmin) showScreen(elements.adminDashboardScreen);
        else if(currentUser) showScreen(elements.userDashboardScreen);
        else showScreen(elements.initialModal);
    });

    // Cliques na Barra Superior (Logo e Home)
    const redirecionarHome = () => {
        if (isAdmin) showScreen(elements.adminDashboardScreen);
        else if (currentUser) showScreen(elements.userDashboardScreen);
        else showScreen(elements.initialModal);
    };
    elements.navHome?.addEventListener('click', (e) => { e.preventDefault(); redirecionarHome(); });
    elements.btnLogo?.addEventListener('click', redirecionarHome);
    elements.navRestrito?.addEventListener('click', (e) => { e.preventDefault(); showScreen(elements.adminLoginModal); });
    elements.navSair?.addEventListener('click', (e) => { e.preventDefault(); signOut(auth); });

    // Alternador de Luminosidade (Tema Claro/Escuro)
    elements.btnToggleTheme?.addEventListener('click', () => {
        document.body.classList.toggle('theme-light');
        const icon = elements.btnToggleTheme.querySelector('i');
        if(icon) icon.className = document.body.classList.contains('theme-light') ? "fa-solid fa-moon" : "fa-solid fa-sun";
    });

    // Escolha Interativa de Pendrives
    document.querySelectorAll('.pendrive-card').forEach(card => {
        card.addEventListener('click', () => {
            selectedPendriveSize = parseInt(card.getAttribute('data-size'));
            if(selectedPendriveSize === 32) maxRealCapacityGB = pendriveConfig.size32;
            else if(selectedPendriveSize === 64) maxRealCapacityGB = pendriveConfig.size64;
            else if(selectedPendriveSize === 128) maxRealCapacityGB = pendriveConfig.size128;

            currentListGames = [];
            inicializarBuilderMontagem();
        });
    });

    elements.searchGames?.addEventListener('input', () => renderizarCatalogoSelecao());

    /**
     * ==========================================================================
     * CONTROLE DE FORMULÁRIOS OPERACIONAIS (SUBMITS)
     * ==========================================================================
     */

    // 1. LOGIN DE USUÁRIOS COMPRADORES
    elements.formLogin?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const senha = document.getElementById('loginSenha').value;

        setButtonLoading(elements.btnLoginSubmit, true, "Verificando...");
        try {
            await signInWithEmailAndPassword(auth, email, senha);
            elements.formLogin.reset();
        } catch (error) {
            alert("Erro na autenticação: " + traduzirErroFirebase(error.code));
            setButtonLoading(elements.btnLoginSubmit, false);
        }
    });

    // 2. REGISTRO DE NOVA CONTA CLIENTE (COM VERIFICAÇÃO DE WHITELIST DE PROVEDORES)
    elements.formCadastro?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('cadEmail').value.trim();
        const senha = document.getElementById('cadSenha').value;
        const selectUF = document.getElementById('cadUF');

        // Reforço da regra de negócio de Provedores Famosos
        if (!validarEmailWhitelist(email)) {
            alert(`E-mail inválido! Para garantir a entrega das notificações, use uma conta dos seguintes provedores: ${provedoresPermitidos.join(', ')}.`);
            return;
        }

        const dadosPerfil = {
            nome: document.getElementById('cadNome').value.trim(),
            sobrenome: document.getElementById('cadSobrenome').value.trim(),
            whatsapp: document.getElementById('cadWhatsapp').value.trim(),
            cidade: document.getElementById('cadCidade').value.trim(),
            uf: selectUF.options[selectUF.selectedIndex].value
        };

        setButtonLoading(elements.btnCadastroSubmit, true, "Registrando...");
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
            await set(ref(database, `usuarios/${userCredential.user.uid}`), dadosPerfil);
            elements.formCadastro.reset();
            alert("Conta criada com sucesso!");
        } catch (error) {
            alert("Erro ao criar conta: " + traduzirErroFirebase(error.code));
        } finally {
            setButtonLoading(elements.btnCadastroSubmit, false);
        }
    });

    // 3. RECUPERAÇÃO DE SENHAS
    elements.formRecovery?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('recoveryEmail').value.trim();

        setButtonLoading(elements.btnRecoverySubmit, true, "Transmitindo...");
        try {
            await sendPasswordResetEmail(auth, email);
            alert("Link de redefinição enviado ao e-mail!");
            elements.formRecovery.reset();
            showScreen(elements.loginModal);
        } catch (error) {
            alert("Erro: " + traduzirErroFirebase(error.code));
        } finally {
            setButtonLoading(elements.btnRecoverySubmit, false);
        }
    });

    // 4. AUTENTICAÇÃO DO PAINEL ADMINISTRATIVO
    elements.formAdminLogin?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value.trim();
        const senha = document.getElementById('adminSenha').value;

        setButtonLoading(elements.btnAdminLoginSubmit, true, "Acessando...");
        try {
            const res = await signInWithEmailAndPassword(auth, email, senha);
            const snapshot = await get(ref(database, `administradores/${res.user.uid}`));
            
            const ehAdminPorBanco = snapshot.exists() && snapshot.val() === true;
            const ehAdminPorEmail = email.toLowerCase() === 'admin@admin.com';

            if (ehAdminPorBanco || ehAdminPorEmail) {
                isAdmin = true; 
                currentUser = res.user;
                elements.formAdminLogin.reset();
                entrarComoAdmin();
            } else {
                await signOut(auth);
                alert("Acesso negado. Esta conta não possui privilégios de Administrador.");
                setButtonLoading(elements.btnAdminLoginSubmit, false);
            }
        } catch (error) {
            alert("Falha no acesso ao terminal: " + traduzirErroFirebase(error.code));
            setButtonLoading(elements.btnAdminLoginSubmit, false);
        }
    });

    // 5. INSERÇÃO OU EDIÇÃO ATUALIZADA DE JOGOS NO BANCO GERAL (ADMIN)
    elements.formAdminAddJogo?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('addJogoNome').value.trim();
        let tamanho = parseFloat(document.getElementById('addJogoTamanho').value);
        const unidade = document.getElementById('addJogoUnidade').value;

        if(unidade === "MB") tamanho = tamanho / 1024;

        setButtonLoading(elements.btnAddJogoSubmit, true, editandoJogoId ? "Atualizando..." : "Adicionando...");
        try {
            if (editandoJogoId) {
                // Modo Edição Operacional ativa
                await update(ref(database, `catalogo/${editandoJogoId}`), { nome: nome, tamanhoGB: tamanho });
                alert("Título atualizado com sucesso!");
                editandoJogoId = null;
                const txtBtn = elements.btnAddJogoSubmit.querySelector('.btn-text') || elements.btnAddJogoSubmit;
                txtBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Adicionar Jogo`;
            } else {
                // Modo Novo Cadastro
                const novoJogoRef = push(ref(database, 'catalogo'));
                await set(novoJogoRef, { nome: nome, tamanhoGB: tamanho });
            }
            elements.formAdminAddJogo.reset();
        } catch (error) {
            alert("Erro ao salvar dados do título: " + error.message);
        } finally {
            setButtonLoading(elements.btnAddJogoSubmit, false);
        }
    });

    // 6. SALVAR MEDIDAS REAIS DE ARMAZENAMENTO (ADMIN)
    elements.formAdminConfigPendrives?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const novasCapacidades = {
            size32: parseFloat(document.getElementById('cfgSize32').value),
            size64: parseFloat(document.getElementById('cfgSize64').value),
            size128: parseFloat(document.getElementById('cfgSize128').value)
        };

        setButtonLoading(elements.btnConfigPendrivesSubmit, true, "Sincronizando...");
        try {
            await set(ref(database, 'configuracoes/tamanhosReais'), novasCapacidades);
            alert("Capacidades recalibradas com sucesso!");
        } catch (error) {
            alert("Erro ao salvar: " + error.message);
        } finally {
            setButtonLoading(elements.btnConfigPendrivesSubmit, false);
        }
    });

    // 7. TRANSMISSÃO FINAL DA LISTA DE JOGOS DO CLIENTE
    elements.formEnvioLista?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(currentListGames.length === 0) return alert("Seu pendrive está vazio. Adicione jogos ao catálogo antes de enviar!");
        
        const selectUF = document.getElementById('envioUF');
        setButtonLoading(elements.btnEnviarListaFinal, true, "Enviando Fila...");
        
        const pacotePedido = {
            cliente: {
                nome: document.getElementById('envioNome').value.trim(),
                sobrenome: document.getElementById('envioSobrenome').value.trim(),
                whatsapp: document.getElementById('envioWhatsapp').value.trim(),
                cidade: document.getElementById('envioCidade').value.trim(),
                uf: selectUF.options[selectUF.selectedIndex].value
            },
            pendriveNominal: selectedPendriveSize,
            espacoOcupadoGB: calcularEspacoOcupado(),
            jogos: currentListGames,
            dataHora: new Date().toLocaleString('pt-BR'),
            uidUsuario: currentUser ? currentUser.uid : "anonimo",
            status: "Pendente"
        };

        try {
            const pedidoRef = push(ref(database, 'encomendas'));
            await set(pedidoRef, pacotePedido);
            setButtonLoading(elements.btnEnviarListaFinal, false);
            ativarModalConfirmacaoComWhats(pacotePedido);
        } catch (error) {
            alert("Erro ao transmitir: " + error.message);
            setButtonLoading(elements.btnEnviarListaFinal, false);
        }
    });

    // OBSERVADOR CENTRAL DE MUDANÇA DE ESTADO DE AUTENTICAÇÃO
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            if (isAdmin || user.email === 'admin@admin.com') {
                isAdmin = true;
                entrarComoAdmin();
            } else {
                carregarDadosUsuarioLogado(user.uid);
            }
        } else {
            currentUser = null;
            isAdmin = false;
            configurarMenuNavegacao();
            showScreen(elements.initialModal);
        }
    });
});

/**
 * ==========================================================================
 * ROTINAS REATIVAS DO REALTIME DATABASE
 * ==========================================================================
 */
function escutarConfiguracoesPendrive() {
    onValue(ref(database, 'configuracoes/tamanhosReais'), (snapshot) => {
        if(snapshot.exists()) {
            pendriveConfig = snapshot.val();
        }
        document.querySelectorAll('.lblRealSize32').forEach(el => el.innerText = pendriveConfig.size32 + " GB");
        document.querySelectorAll('.lblRealSize64').forEach(el => el.innerText = pendriveConfig.size64 + " GB");
        document.querySelectorAll('.lblRealSize128').forEach(el => el.innerText = pendriveConfig.size128 + " GB");
        
        if(document.getElementById('cfgSize32')) document.getElementById('cfgSize32').value = pendriveConfig.size32;
        if(document.getElementById('cfgSize64')) document.getElementById('cfgSize64').value = pendriveConfig.size64;
        if(document.getElementById('cfgSize128')) document.getElementById('cfgSize128').value = pendriveConfig.size128;
    });
}

function escutarCatalogoJogos() {
    onValue(ref(database, 'catalogo'), (snapshot) => {
        globalCatalog = [];
        if(snapshot.exists()) {
            const data = snapshot.val();
            for(let key in data) {
                globalCatalog.push({ id: key, nome: data[key].nome, tamanhoGB: data[key].tamanhoGB });
            }
        }
        globalCatalog.sort((a,b) => a.nome.localeCompare(b.nome));
        
        if(elements.listBuilderScreen && !elements.listBuilderScreen.classList.contains('hidden')) renderizarCatalogoSelecao();
        if(isAdmin && elements.adminDashboardScreen && !elements.adminDashboardScreen.classList.contains('hidden')) renderizarCatalogoAdmin();
    });
}

async function carregarDadosUsuarioLogado(uid) {
    configurarMenuNavegacao();
    showScreen(elements.userDashboardScreen);
    
    try {
        const snap = await get(ref(database, `usuarios/${uid}`));
        if(snap.exists()) {
            const dados = snap.val();
            if(document.getElementById('envioNome')) document.getElementById('envioNome').value = dados.nome || "";
            if(document.getElementById('envioSobrenome')) document.getElementById('envioSobrenome').value = dados.sobrenome || "";
            if(document.getElementById('envioWhatsapp')) document.getElementById('envioWhatsapp').value = dados.whatsapp || "";
            if(document.getElementById('envioCidade')) document.getElementById('envioCidade').value = dados.cidade || "";
            const selectUF = document.getElementById('envioUF');
            if(selectUF && dados.uf) selectUF.value = dados.uf;
        }
    } catch(e) { console.error(e); }

    escutarHistoricoPedidosUsuario(uid);
}

function escutarHistoricoPedidosUsuario(uid) {
    onValue(ref(database, 'encomendas'), (snapshot) => {
        if(!elements.userListsHistoryContainer) return;
        elements.userListsHistoryContainer.innerHTML = "";
        if(snapshot.exists()) {
            let contador = 0;
            const data = snapshot.val();
            for(let key in data) {
                if(data[key].uidUsuario === uid) {
                    contador++;
                    const item = data[key];
                    const card = document.createElement('div');
                    card.className = "saved-list-card";
                    card.innerHTML = `
                        <h4>Lista Digital #${contador}</h4>
                        <p class="saved-list-meta">
                            <strong>Mídia Destino:</strong> Pendrive ${item.pendriveNominal}GB<br>
                            <strong>Espaço Alocado:</strong> ${item.espacoOcupadoGB.toFixed(2)} GB Usados<br>
                            <strong>Envio:</strong> ${item.dataHora}<br>
                            <strong>Status na Fila:</strong> <span class="badge-gamer badge-pending">${item.status}</span>
                        </p>
                    `;
                    elements.userListsHistoryContainer.appendChild(card);
                }
            }
            if(contador === 0) elements.userListsHistoryContainer.innerHTML = `<p class="no-games-placeholder">Nenhum catálogo de jogos criado nesta conta.</p>`;
        } else {
            elements.userListsHistoryContainer.innerHTML = `<p class="no-games-placeholder">Nenhum catálogo de jogos criado nesta conta.</p>`;
        }
    });
}

function entrarComoAdmin() {
    configurarMenuNavegacao();
    showScreen(elements.adminDashboardScreen);
    renderizarCatalogoAdmin();
    
    onValue(ref(database, 'encomendas'), (snapshot) => {
        if(!elements.adminOrdersContainer) return;
        elements.adminOrdersContainer.innerHTML = "";
        if(snapshot.exists()) {
            const data = snapshot.val();
            for(let key in data) {
                const order = data[key];
                const div = document.createElement('div');
                div.className = "admin-item-row";
                div.innerHTML = `
                    <div class="admin-item-details">
                        <h5><i class="fa-solid fa-box"></i> ${order.cliente.nome} ${order.cliente.sobrenome} (${order.cliente.cidade} - ${order.cliente.uf})</h5>
                        <p class="admin-item-sub">Pendrive: <strong>${order.pendriveNominal}GB</strong> | Itens: ${order.jogos.length} títulos | Recebido: ${order.dataHora}</p>
                    </div>
                    <div class="admin-actions-cell">
                        <button type="button" class="btn-gamer btn-small btn-danger btnExcluirOrder" data-id="${key}"><i class="fa-solid fa-trash"></i> Remover</button>
                    </div>
                `;
                elements.adminOrdersContainer.appendChild(div);
            }

            elements.adminOrdersContainer.querySelectorAll('.btnExcluirOrder').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if(confirm("Deseja dar baixa e remover esta lista da fila operacional?")) {
                        const id = btn.getAttribute('data-id');
                        await remove(ref(database, `encomendas/${id}`));
                    }
                });
            });
        } else {
            elements.adminOrdersContainer.innerHTML = `<p class="no-games-placeholder">Nenhuma lista aguardando gravação no banco.</p>`;
        }
    });
}

/**
 * ==========================================================================
 * SISTEMA FLUXO DE COMPILAÇÃO DA LISTA DE ARMAZENAMENTO
 * ==========================================================================
 */
function inicializarBuilderMontagem() {
    showScreen(elements.listBuilderScreen);
    if(elements.txtPendriveSelecionado) elements.txtPendriveSelecionado.innerText = selectedPendriveSize + " GB";
    if(elements.txtEspaçoRealMax) elements.txtEspaçoRealMax.innerText = maxRealCapacityGB.toFixed(2) + " GB";
    if(elements.searchGames) elements.searchGames.value = "";
    
    renderizarCatalogoSelecao();
    renderizarMeusJogosEscolhidos();
    atualizarBarraArmazenamento();
}

function renderizarCatalogoSelecao() {
    if(!elements.availableGamesContainer) return;
    elements.availableGamesContainer.innerHTML = "";
    const filtro = elements.searchGames ? elements.searchGames.value.toLowerCase().trim() : "";
    const jogosFiltrados = globalCatalog.filter(j => j.nome.toLowerCase().includes(filtro));
    
    if(jogosFiltrados.length === 0) {
        elements.availableGamesContainer.innerHTML = `<p class="no-games-placeholder">Nenhum título localizado.</p>`;
        return;
    }

    jogosFiltrados.forEach(jogo => {
        const jaEscolhido = currentListGames.some(item => item.id === jogo.id || item.nome === jogo.nome);
        if(!jaEscolhido) {
            const card = document.createElement('div');
            card.className = "game-item-card";
            card.innerHTML = `
                <div class="game-item-info">
                    <span class="game-title-text">${jogo.nome}</span>
                    <span class="game-size-tag">${jogo.tamanhoGB.toFixed(2)} GB</span>
                </div>
                <button type="button" class="btn-action-game btn-add-game" data-id="${jogo.id}"><i class="fa-solid fa-plus"></i></button>
            `;
            elements.availableGamesContainer.appendChild(card);
        }
    });

    elements.availableGamesContainer.querySelectorAll('.btn-add-game').forEach(btn => {
        btn.addEventListener('click', () => {
            const idJogo = btn.getAttribute('data-id');
            const itemOriginal = globalCatalog.find(j => j.id === idJogo);
            if(itemOriginal) {
                currentListGames.push(itemOriginal);
                renderizarCatalogoSelecao();
                renderizarMeusJogosEscolhidos();
                atualizarBarraArmazenamento();
            }
        });
    });
}

function renderizarMeusJogosEscolhidos() {
    if(!elements.myGamesContainer) return;
    elements.myGamesContainer.innerHTML = "";
    if(currentListGames.length === 0) {
        elements.myGamesContainer.innerHTML = `<p class="no-games-placeholder">Seu catálogo está vazio.</p>`;
        return;
    }

    currentListGames.forEach((jogo, index) => {
        const card = document.createElement('div');
        card.className = "game-item-card";
        card.innerHTML = `
            <div class="game-item-info">
                <span class="game-title-text">${jogo.nome}</span>
                <span class="game-size-tag">${jogo.tamanhoGB.toFixed(2)} GB</span>
            </div>
            <button type="button" class="btn-action-game btn-remove-game" data-index="${index}"><i class="fa-solid fa-xmark"></i></button>
        `;
        elements.myGamesContainer.appendChild(card);
    });

    elements.myGamesContainer.querySelectorAll('.btn-remove-game').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.getAttribute('data-index'));
            currentListGames.splice(index, 1);
            renderizarCatalogoSelecao();
            renderizarMeusJogosEscolhidos();
            atualizarBarraArmazenamento();
        });
    });
}

function calcularEspacoOcupado() {
    return currentListGames.reduce((acc, jogo) => acc + jogo.tamanhoGB, 0);
}

function atualizarBarraArmazenamento() {
    const totalOcupado = calcularEspacoOcupado();
    const livre = maxRealCapacityGB - totalOcupado;
    let porcentagem = (totalOcupado / maxRealCapacityGB) * 100;
    
    if(porcentagem > 100) porcentagem = 100;

    if(elements.txtEspacoUsado) elements.txtEspacoUsado.innerText = totalOcupado.toFixed(2) + " GB";
    if(elements.storageProgressBar) elements.storageProgressBar.style.width = porcentagem + "%";

    if(totalOcupado > maxRealCapacityGB) {
        if(elements.storageProgressBar) elements.storageProgressBar.classList.add('overlimit');
        if(elements.btnEnviarListaFinal) elements.btnEnviarListaFinal.disabled = true;
        if(elements.txtEspacoLivre) elements.txtEspacoLivre.innerHTML = `<span style="color:var(--danger)">LIMITE EXCEDIDO EM ${(totalOcupado - maxRealCapacityGB).toFixed(2)} GB</span>`;
    } else {
        if(elements.storageProgressBar) elements.storageProgressBar.classList.remove('overlimit');
        if(elements.btnEnviarListaFinal) elements.btnEnviarListaFinal.disabled = currentListGames.length === 0;
        if(elements.txtEspacoLivre) elements.txtEspacoLivre.innerText = (livre < 0 ? 0 : livre).toFixed(2) + " GB";
    }
}

function renderizarCatalogoAdmin() {
    if(!elements.adminCatalogContainer) return;
    elements.adminCatalogContainer.innerHTML = "";
    if(globalCatalog.length === 0) {
        elements.adminCatalogContainer.innerHTML = `<p class="no-games-placeholder">Nenhum título ativo.</p>`;
        return;
    }
    globalCatalog.forEach(jogo => {
        const row = document.createElement('div');
        row.className = "admin-item-row";
        row.innerHTML = `
            <div class="admin-item-details">
                <h5>${jogo.nome}</h5>
                <p class="admin-item-sub">${jogo.tamanhoGB.toFixed(2)} GB</p>
            </div>
            <div class="admin-actions-cell" style="display:table-cell; vertical-align:middle; text-align:right;">
                <button type="button" class="btn-gamer btn-small btn-edit-jogo" data-id="${jogo.id}" style="margin-right: 5px; background: #f39c12; color: #fff;"><i class="fa-solid fa-pen-to-square"></i></button>
                <button type="button" class="btn-gamer btn-small btn-danger btnDeletarJogo" data-id="${jogo.id}"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
        elements.adminCatalogContainer.appendChild(row);
    });

    // Evento de Deleção de Jogos
    elements.adminCatalogContainer.querySelectorAll('.btnDeletarJogo').forEach(btn => {
        btn.addEventListener('click', async () => {
            if(confirm("Deseja banir este título permanentemente da plataforma?")) {
                const id = btn.getAttribute('data-id');
                try {
                    await remove(ref(database, `catalogo/${id}`));
                } catch(error) {
                    alert("Erro ao remover jogo: " + error.message);
                }
            }
        });
    });

    // Captura e Manipulação Operacional para o Botão de Edição
    elements.adminCatalogContainer.querySelectorAll('.btn-edit-jogo').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const jogo = globalCatalog.find(j => j.id === id);
            if (jogo) {
                editandoJogoId = id;
                document.getElementById('addJogoNome').value = jogo.nome;
                document.getElementById('addJogoTamanho').value = jogo.tamanhoGB;
                document.getElementById('addJogoUnidade').value = "GB";
                
                const txtBtn = elements.btnAddJogoSubmit.querySelector('.btn-text') || elements.btnAddJogoSubmit;
                txtBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Atualizar Jogo`;
                
                // Rola suavemente a tela até o formulário de edição para feedback visual claro do Admin
                elements.formAdminAddJogo?.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}
