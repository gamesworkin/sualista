/**
 * ========================================================================== 
 * MOTOR DE NEGÓCIOS - WORKIN STORE (COMPLETO, INTEGRAL E ATUALIZADO 2026)
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

const firebaseConfig = {
    apiKey: window._env_?.FIREBASE_API_KEY || "AIzaSyBvdW06QiHlJA5glUKtucX6hL8LdvlTPME",
    authDomain: window._env_?.FIREBASE_AUTH_DOMAIN || "sua-lista-e6ef3.firebaseapp.com",
    databaseURL: window._env_?.FIREBASE_DATABASE_URL || "https://sua-lista-e6ef3-default-rtdb.firebaseio.com/",
    projectId: window._env_?.FIREBASE_PROJECT_ID || "sua-lista-e6ef3",
    storageBucket: window._env_?.FIREBASE_STORAGE_BUCKET || "sua-lista-e6ef3.firebasestorage.app",
    messagingSenderId: window._env_?.FIREBASE_MESSAGING_SENDER_ID || "689656568290",
    appId: window._env_?.FIREBASE_APP_ID || "1:689656568290:web:8f82257c9bb23f8b1481bb"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// --- ESTADO GERAL DO SISTEMA ---
let currentUser = null;
let isAdmin = false;
let selectedPendriveSize = 0; 
let maxRealCapacityGB = 0;
let currentListGames = []; 
let globalCatalog = []; 
let editandoJogoId = null; 

let pendriveConfig = { size32: 29.2, size64: 58.4, size128: 116.8 };
const provedoresPermitidos = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'yahoo.com.br'];

/**
 * ==========================================================================
 * CANVAS DE PARTÍCULAS DE FUNDO
 * ==========================================================================
 */
const canvas = document.getElementById('particleCanvas');
const ctx = canvas?.getContext('2d');
let particlesArray = [];

if (canvas && ctx) {
    window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    window.addEventListener('mousemove', (e) => { for (let i = 0; i < 2; i++) particlesArray.push(new Particle(e.x, e.y)); });

    class Particle {
        constructor(x, y) {
            this.x = x; this.y = y;
            this.size = Math.random() * 3 + 1;
            this.speedX = Math.random() * 2 - 1; this.speedY = Math.random() * 2 - 1;
            this.color = document.documentElement.getAttribute('data-theme') === 'light' ? 'rgba(155, 81, 224, 0.5)' : 'rgba(0, 242, 254, 0.6)';
        }
        update() {
            this.x += this.speedX; this.y += this.speedY;
            if (this.size > 0.1) this.size -= 0.02;
        }
        draw() {
            ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        }
    }
    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update(); particlesArray[i].draw();
            if (particlesArray[i].size <= 0.2) { particlesArray.splice(i, 1); i--; }
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
        if (currentUser) elements.navSair.classList.remove('hidden');
        else elements.navSair.classList.add('hidden');
    }
}

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

function aplicarMascaraWhatsapp(input) {
    if (!input) return;
    input.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length > 11) value = value.slice(0, 11);
        if (value.length > 6) value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
        else if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
        else if (value.length > 0) value = `(${value}`;
        e.target.value = value;
    });
}

function validarEmailWhitelist(email) {
    const partes = email.split('@');
    if (partes.length !== 2) return false;
    return provedoresPermitidos.includes(partes[1].toLowerCase().trim());
}

/**
 * ==========================================================================
 * GERADOR CORE DE DOCUMENTO A4 EM CANVAS BRANCO (BASE64)
 * ==========================================================================
 */
function gerarDocumentoA4Base64(pacote) {
    const canvasA4 = document.createElement('canvas');
    canvasA4.width = 842;
    canvasA4.height = 1191;
    const ctxA4 = canvasA4.getContext('2d');

    // Fundo Branco Sólido (Papel)
    ctxA4.fillStyle = '#FFFFFF';
    ctxA4.fillRect(0, 0, canvasA4.width, canvasA4.height);

    // Cabeçalho - Bordas e Divisórias
    ctxA4.strokeStyle = '#111111';
    ctxA4.lineWidth = 2;
    ctxA4.strokeRect(40, 40, canvasA4.width - 80, canvasA4.height - 80);
    ctxA4.beginPath();
    ctxA4.moveTo(40, 160);
    ctxA4.lineTo(canvasA4.width - 40, 160);
    ctxA4.stroke();

    // Título Principal do Estabelecimento
    ctxA4.fillStyle = '#000000';
    ctxA4.font = 'bold 28px sans-serif';
    ctxA4.fillText('Workin Store - Gravação', 60, 85);

    ctxA4.font = '14px sans-serif';
    ctxA4.fillStyle = '#555555';
    ctxA4.fillText(`Emitido em: ${pacote.dataHora || new Date().toLocaleString('pt-BR')}`, 60, 115);
    ctxA4.fillText(`Mídia de Destino: PENDRIVE ${pacote.pendriveNominal}GB`, 60, 135);

    // Dados do Cliente (Sub-bloco)
    ctxA4.fillStyle = '#000000';
    ctxA4.font = 'bold 15px sans-serif';
    ctxA4.fillText('DADOS DO REQUISITANTE:', 450, 85);
    ctxA4.font = '14px sans-serif';
    ctxA4.fillStyle = '#222222';
    ctxA4.fillText(`Nome: ${pacote.cliente.nome} ${pacote.cliente.sobrenome}`, 450, 105);
    ctxA4.fillText(`Contato: ${pacote.cliente.whatsapp}`, 450, 125);
    ctxA4.fillText(`Localidade: ${pacote.cliente.cidade} - ${pacote.cliente.uf}`, 450, 145);

    // Tabela de Jogos Cadastrados
    let yPosition = 210;
    ctxA4.font = 'bold 16px sans-serif';
    ctxA4.fillStyle = '#000000';
    ctxA4.fillText('Nº', 60, yPosition);
    ctxA4.fillText('TÍTULO DO JOGO SELECIONADO', 100, yPosition);
    ctxA4.fillText('(GB)', 700, yPosition);

    ctxA4.lineWidth = 1;
    ctxA4.beginPath();
    ctxA4.moveTo(40, yPosition + 10);
    ctxA4.lineTo(canvasA4.width - 40, yPosition + 10);
    ctxA4.stroke();

    yPosition += 35;
    ctxA4.font = '14px sans-serif';

    pacote.jogos.forEach((jogo, index) => {
        if(yPosition > canvasA4.height - 120) return; 
        ctxA4.fillStyle = '#000000';
        ctxA4.fillText(String(index + 1).padStart(2, '0'), 60, yPosition);
        
        let nomeCortado = jogo.nome;
        if(nomeCortado.length > 65) nomeCortado = nomeCortado.substring(0, 62) + '...';
        ctxA4.fillText(nomeCortado, 100, yPosition);
        
        ctxA4.fillText(`${jogo.tamanhoGB.toFixed(2)} GB`, 700, yPosition);

        ctxA4.strokeStyle = '#E0E0E0';
        ctxA4.beginPath();
        ctxA4.moveTo(40, yPosition + 8);
        ctxA4.lineTo(canvasA4.width - 40, yPosition + 8);
        ctxA4.stroke();

        yPosition += 28;
    });

    // Sumário / Rodapé de Fechamento da Folha
    yPosition += 20;
    if(yPosition > canvasA4.height - 100) yPosition = canvasA4.height - 110;
    
    ctxA4.strokeStyle = '#111111';
    ctxA4.lineWidth = 1.5;
    ctxA4.beginPath();
    ctxA4.moveTo(40, yPosition);
    ctxA4.lineTo(canvasA4.width - 40, yPosition);
    ctxA4.stroke();

    yPosition += 30;
    ctxA4.font = 'bold 15px sans-serif';
    ctxA4.fillStyle = '#000000';
    ctxA4.fillText(`TOTAL DE TÍTULOS ALOCADOS: ${pacote.jogos.length}`, 60, yPosition);
    ctxA4.fillText(`ESPAÇO TOTAL OCUPADO: ${pacote.espacoOcupadoGB.toFixed(2)} GB`, 450, yPosition);

    return canvasA4.toDataURL('image/jpeg', 0.9);
}

function configurarModalSucessoBotoes(pacote) {
    if(!elements.confirmationModal) return;
    elements.confirmationModal.classList.remove('hidden');

    const base64Data = gerarDocumentoA4Base64(pacote);

    // 1. Ação Visualizar em Nova Aba
    const btnVer = document.getElementById('btnVisualizarListaBase64');
    if(btnVer) {
        btnVer.onclick = (e) => {
            e.preventDefault();
            const novaAba = window.open();
            if(novaAba) novaAba.document.write(`<iframe src="${base64Data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
        };
    }

    // 2. Ação Baixar Imagem JPEG
    const btnBaixar = document.getElementById('btnBaixarListaJpeg');
    if(btnBaixar) {
        btnBaixar.onclick = (e) => {
            e.preventDefault();
            const link = document.createElement('a');
            link.download = `Lista-Workin-Store-${pacote.cliente.nome}.jpg`;
            link.href = base64Data;
            link.click();
        };
    }

    // 3. Ação Chamar no WhatsApp Comercial
    const btnWhats = document.getElementById('btnConfirmacaoWhatsapp');
    if(btnWhats) {
        const numWhats = "5588988470190"; 
        const msg = encodeURIComponent(`Olá! Acabei de registrar minha lista de jogos no Sistema.\nMídia: Pendrive ${pacote.pendriveNominal}GB (${pacote.espacoOcupadoGB.toFixed(2)} GB Usados).\nCliente: ${pacote.cliente.nome}. Aguardo confirmação operacional!`);
        btnWhats.href = `https://wa.me/${numWhats}?text=${msg}`;
    }
}

/**
 * ==========================================================================
 * EVENT LISTENERS DA INTERFACE OPERACIONAL
 * ==========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    escutarConfiguracoesPendrive();
    escutarCatalogoJogos();

    const cadWhatsInput = document.getElementById('cadWhatsapp');
    const envioWhatsInput = document.getElementById('envioWhatsapp');
    if (cadWhatsInput) aplicarMascaraWhatsapp(cadWhatsInput);
    if (envioWhatsInput) aplicarMascaraWhatsapp(envioWhatsInput);

    document.getElementById('btnOpcaoLogin')?.addEventListener('click', () => showScreen(elements.loginModal));
    document.getElementById('btnOpcaoCadastro')?.addEventListener('click', () => showScreen(elements.cadastroModal));
    
    document.getElementById('btnOpcaoAnonimo')?.addEventListener('click', () => {
        currentUser = null; isAdmin = false; configurarMenuNavegacao();
        if(elements.formEnvioLista) elements.formEnvioLista.reset();
        const selectUF = document.getElementById('envioUF');
        if(selectUF) selectUF.value = ""; 
        showScreen(elements.pendriveSelectionScreen);
    });

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

    const redirecionarHome = () => {
        if (isAdmin) showScreen(elements.adminDashboardScreen);
        else if (currentUser) showScreen(elements.userDashboardScreen);
        else showScreen(elements.initialModal);
    };
    elements.navHome?.addEventListener('click', (e) => { e.preventDefault(); redirecionarHome(); });
    elements.btnLogo?.addEventListener('click', redirecionarHome);
    elements.navRestrito?.addEventListener('click', (e) => { e.preventDefault(); showScreen(elements.adminLoginModal); });
    elements.navSair?.addEventListener('click', (e) => { e.preventDefault(); signOut(auth); });

    // --- CORREÇÃO INTEGRADA DO BOTÃO DE ALTERNÂNCIA DE TEMA CLARO / GAMER ---
    elements.btnToggleTheme?.addEventListener('click', () => {
        if (document.documentElement.getAttribute('data-theme') === 'light') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
        
        const icon = elements.btnToggleTheme.querySelector('i');
        if (icon) {
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            icon.className = isLight ? "fa-solid fa-moon" : "fa-solid fa-sun";
        }
    });

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

    // --- SUBMITS E OPERAÇÕES DE DADOS ---
    elements.formLogin?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const senha = document.getElementById('loginSenha').value;
        setButtonLoading(elements.btnLoginSubmit, true, "Verificando...");
        try { await signInWithEmailAndPassword(auth, email, senha); elements.formLogin.reset(); } 
        catch (error) { alert("Erro na autenticação: " + traduzirErroFirebase(error.code)); setButtonLoading(elements.btnLoginSubmit, false); }
    });

    elements.formCadastro?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('cadEmail').value.trim();
        const senha = document.getElementById('cadSenha').value;
        const selectUF = document.getElementById('cadUF');

        if (!validarEmailWhitelist(email)) {
            alert(`E-mail inválido! Use uma conta dos provedores válidos: ${provedoresPermitidos.join(', ')}.`);
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
        } catch (error) { alert("Erro ao criar conta: " + traduzirErroFirebase(error.code)); } 
        finally { setButtonLoading(elements.btnCadastroSubmit, false); }
    });

    elements.formRecovery?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('recoveryEmail').value.trim();
        setButtonLoading(elements.btnRecoverySubmit, true, "Transmitindo...");
        try { await sendPasswordResetEmail(auth, email); alert("Link enviado!"); elements.formRecovery.reset(); showScreen(elements.loginModal); } 
        catch (error) { alert("Erro: " + traduzirErroFirebase(error.code)); } 
        finally { setButtonLoading(elements.btnRecoverySubmit, false); }
    });

    elements.formAdminLogin?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value.trim();
        const senha = document.getElementById('adminSenha').value;
        setButtonLoading(elements.btnAdminLoginSubmit, true, "Acessando...");
        try {
            const res = await signInWithEmailAndPassword(auth, email, senha);
            const snapshot = await get(ref(database, `administradores/${res.user.uid}`));
            if (snapshot.exists() && snapshot.val() === true || email.toLowerCase() === 'admin@admin.com') {
                isAdmin = true; currentUser = res.user; elements.formAdminLogin.reset(); entrarComoAdmin();
            } else {
                await signOut(auth); alert("Acesso negado."); setButtonLoading(elements.btnAdminLoginSubmit, false);
            }
        } catch (error) { alert("Falha: " + traduzirErroFirebase(error.code)); setButtonLoading(elements.btnAdminLoginSubmit, false); }
    });

    elements.formAdminAddJogo?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('addJogoNome').value.trim();
        let tamanho = parseFloat(document.getElementById('addJogoTamanho').value);
        if(document.getElementById('addJogoUnidade').value === "MB") tamanho = tamanho / 1024;

        setButtonLoading(elements.btnAddJogoSubmit, true);
        try {
            if (editandoJogoId) {
                await update(ref(database, `catalogo/${editandoJogoId}`), { nome: nome, tamanhoGB: tamanho });
                editandoJogoId = null;
                elements.btnAddJogoSubmit.innerHTML = `<i class="fa-solid fa-plus"></i> Adicionar Jogo`;
            } else {
                await set(push(ref(database, 'catalogo')), { nome: nome, tamanhoGB: tamanho });
            }
            elements.formAdminAddJogo.reset();
        } catch (error) { alert("Erro ao salvar: " + error.message); } 
        finally { setButtonLoading(elements.btnAddJogoSubmit, false); }
    });

    elements.formAdminConfigPendrives?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const novasCapacidades = {
            size32: parseFloat(document.getElementById('cfgSize32').value),
            size64: parseFloat(document.getElementById('cfgSize64').value),
            size128: parseFloat(document.getElementById('cfgSize128').value)
        };
        setButtonLoading(elements.btnConfigPendrivesSubmit, true);
        try { await set(ref(database, 'configuracoes/tamanhosReais'), novasCapacidades); alert("Recalibrado!"); } 
        catch (error) { alert("Erro: " + error.message); } 
        finally { setButtonLoading(elements.btnConfigPendrivesSubmit, false); }
    });

    elements.formEnvioLista?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(currentListGames.length === 0) return alert("Seu pendrive está vazio!");
        
        const selectUF = document.getElementById('envioUF');
        setButtonLoading(elements.btnEnviarListaFinal, true);
        
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
            await set(push(ref(database, 'encomendas')), pacotePedido);
            setButtonLoading(elements.btnEnviarListaFinal, false);
            configurarModalSucessoBotoes(pacotePedido);
        } catch (error) { alert("Erro: " + error.message); setButtonLoading(elements.btnEnviarListaFinal, false); }
    });

    // --- MECANISMOS DE EXP/IMP DO ADMINISTRADOR ---
    document.getElementById('btnExportarCatalogo')?.addEventListener('click', () => {
        if(globalCatalog.length === 0) return alert("O catálogo está vazio para exportação.");
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(globalCatalog, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `WorkinStore-Catalogo-Backup.json`);
        downloadAnchor.click();
    });

    document.getElementById('btnImportarCatalogoFile')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const jogosImportados = JSON.parse(event.target.result);
                if(!Array.isArray(jogosImportados)) throw new Error("Formato inválido. Precisa ser uma lista de jogos.");
                
                if(confirm(`Deseja importar ${jogosImportados.length} títulos para o banco? Isso não apagará os atuais.`)) {
                    for(let jogo of jogosImportados) {
                        if(jogo.nome && jogo.tamanhoGB) {
                            await set(push(ref(database, 'catalogo')), { nome: jogo.nome, tamanhoGB: parseFloat(jogo.tamanhoGB) });
                        }
                    }
                    alert("Importação concluída com sucesso!");
                }
            } catch (err) { alert("Erro ao processar arquivo: " + err.message); }
        };
        reader.readAsText(file);
    });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            if (isAdmin || user.email === 'admin@admin.com') { isAdmin = true; entrarComoAdmin(); } 
            else { carregarDadosUsuarioLogado(user.uid); }
        } else {
            currentUser = null; isAdmin = false; configurarMenuNavegacao(); showScreen(elements.initialModal);
        }
    });
});

/**
 * ==========================================================================
 * CONTROLE REATIVO DO DATABASE E RENDERIZADORES
 * ==========================================================================
 */
function escutarConfiguracoesPendrive() {
    onValue(ref(database, 'configuracoes/tamanhosReais'), (snapshot) => {
        if(snapshot.exists()) pendriveConfig = snapshot.val();
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
            for(let key in data) globalCatalog.push({ id: key, nome: data[key].nome, tamanhoGB: data[key].tamanhoGB });
        }
        globalCatalog.sort((a,b) => a.nome.localeCompare(b.nome));
        if(elements.listBuilderScreen && !elements.listBuilderScreen.classList.contains('hidden')) renderizarCatalogoSelecao();
        if(isAdmin && elements.adminDashboardScreen && !elements.adminDashboardScreen.classList.contains('hidden')) renderizarCatalogoAdmin();
    });
}

async function carregarDadosUsuarioLogado(uid) {
    configurarMenuNavegacao(); showScreen(elements.userDashboardScreen);
    try {
        const snap = await get(ref(database, `usuarios/${uid}`));
        if(snap.exists()) {
            const dados = snap.val();
            if(document.getElementById('envioNome')) document.getElementById('envioNome').value = dados.nome || "";
            if(document.getElementById('envioSobrenome')) document.getElementById('envioSobrenome').value = dados.sobrenome || "";
            if(document.getElementById('envioWhatsapp')) document.getElementById('envioWhatsapp').value = dados.whatsapp || "";
            if(document.getElementById('envioCidade')) document.getElementById('envioCidade').value = dados.cidade || "";
            if(document.getElementById('envioUF') && dados.uf) document.getElementById('envioUF').value = dados.uf;
        }
    } catch(e) { console.error(e); }
    escutarHistoricoPedidosUsuario(uid);
}

function escutarHistoricoPedidosUsuario(uid) {
    onValue(ref(database, 'encomendas'), (snapshot) => {
        if(!elements.userListsHistoryContainer) return;
        elements.userListsHistoryContainer.innerHTML = "";
        let contador = 0;
        if(snapshot.exists()) {
            const data = snapshot.val();
            for(let key in data) {
                if(data[key].uidUsuario === uid) {
                    contador++; const item = data[key]; const card = document.createElement('div');
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
        }
        if(contador === 0) elements.userListsHistoryContainer.innerHTML = `<p class="no-games-placeholder">Nenhum catálogo de jogos criado nesta conta.</p>`;
    });
}

function entrarComoAdmin() {
    configurarMenuNavegacao(); showScreen(elements.adminDashboardScreen); renderizarCatalogoAdmin();
    onValue(ref(database, 'encomendas'), (snapshot) => {
        if(!elements.adminOrdersContainer) return;
        elements.adminOrdersContainer.innerHTML = "";
        if(snapshot.exists()) {
            const data = snapshot.val();
            for(let key in data) {
                const order = data[key]; const div = document.createElement('div');
                div.className = "admin-item-row";
                div.innerHTML = `
                    <div class="admin-item-details">
                        <h5><i class="fa-solid fa-box"></i> ${order.cliente.nome} ${order.cliente.sobrenome} (${order.cliente.cidade} - ${order.cliente.uf})</h5>
                        <p class="admin-item-sub">Pendrive: <strong>${order.pendriveNominal}GB</strong> | Itens: ${order.jogos.length} títulos | Recebido: ${order.dataHora}</p>
                    </div>
                    <div class="admin-actions-cell">
                        <button type="button" class="btn-gamer btn-small btnVerA4Admin" data-key="${key}" style="background:#3498db;"><i class="fa-solid fa-eye"></i></button>
                        <button type="button" class="btn-gamer btn-small btnBaixarA4Admin" data-key="${key}" style="background:#2ecc71;"><i class="fa-solid fa-download"></i></button>
                        <button type="button" class="btn-gamer btn-small btn-danger btnExcluirOrder" data-id="${key}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                elements.adminOrdersContainer.appendChild(div);
            }

            elements.adminOrdersContainer.querySelectorAll('.btnVerA4Admin').forEach(btn => {
                btn.addEventListener('click', () => {
                    const o = data[btn.getAttribute('data-key')];
                    const img = gerarDocumentoA4Base64(o);
                    const w = window.open();
                    if(w) w.document.write(`<iframe src="${img}" frameborder="0" style="border:0; width:100%; height:100%;"></iframe>`);
                });
            });

            elements.adminOrdersContainer.querySelectorAll('.btnBaixarA4Admin').forEach(btn => {
                btn.addEventListener('click', () => {
                    const o = data[btn.getAttribute('data-key')];
                    const img = gerarDocumentoA4Base64(o);
                    const a = document.createElement('a'); a.download = `Ordem-${o.cliente.nome}.jpg`; a.href = img; a.click();
                });
            });

            elements.adminOrdersContainer.querySelectorAll('.btnExcluirOrder').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if(confirm("Deseja dar baixa e remover esta lista?")) await remove(ref(database, `encomendas/${btn.getAttribute('data-id')}`));
                });
            });
        } else { elements.adminOrdersContainer.innerHTML = `<p class="no-games-placeholder">Nenhuma lista aguardando gravação.</p>`; }
    });
}

function inicializarBuilderMontagem() {
    showScreen(elements.listBuilderScreen);
    if(elements.txtPendriveSelecionado) elements.txtPendriveSelecionado.innerText = selectedPendriveSize + " GB";
    if(elements.txtEspaçoRealMax) elements.txtEspaçoRealMax.innerText = maxRealCapacityGB.toFixed(2) + " GB";
    if(elements.searchGames) elements.searchGames.value = "";
    renderizarCatalogoSelecao(); renderizarMeusJogosEscolhidos(); atualizarBarraArmazenamento();
}

function renderizarCatalogoSelecao() {
    if(!elements.availableGamesContainer) return;
    elements.availableGamesContainer.innerHTML = "";
    const filtro = elements.searchGames ? elements.searchGames.value.toLowerCase().trim() : "";
    const jogosFiltrados = globalCatalog.filter(j => j.nome.toLowerCase().includes(filtro));
    
    if(jogosFiltrados.length === 0) {
        elements.availableGamesContainer.innerHTML = `<p class="no-games-placeholder">Nenhum título localizado.</p>`; return;
    }

    jogosFiltrados.forEach(jogo => {
        if(!currentListGames.some(item => item.id === jogo.id)) {
            const card = document.createElement('div'); card.className = "game-item-card";
            card.innerHTML = `
                <div class="game-item-info"><span class="game-title-text">${jogo.nome}</span><span class="game-size-tag">${jogo.tamanhoGB.toFixed(2)} GB</span></div>
                <button type="button" class="btn-action-game btn-add-game" data-id="${jogo.id}"><i class="fa-solid fa-plus"></i></button>
            `;
            elements.availableGamesContainer.appendChild(card);
        }
    });

    elements.availableGamesContainer.querySelectorAll('.btn-add-game').forEach(btn => {
        btn.addEventListener('click', () => {
            const original = globalCatalog.find(j => j.id === btn.getAttribute('data-id'));
            if(original) { currentListGames.push(original); renderizarCatalogoSelecao(); renderizarMeusJogosEscolhidos(); atualizarBarraArmazenamento(); }
        });
    });
}

function renderizarMeusJogosEscolhidos() {
    if(!elements.myGamesContainer) return; elements.myGamesContainer.innerHTML = "";
    if(currentListGames.length === 0) { elements.myGamesContainer.innerHTML = `<p class="no-games-placeholder">Seu catálogo está vazio.</p>`; return; }

    currentListGames.forEach((jogo, index) => {
        const card = document.createElement('div'); card.className = "game-item-card";
        card.innerHTML = `
            <div class="game-item-info"><span class="game-title-text">${jogo.nome}</span><span class="game-size-tag">${jogo.tamanhoGB.toFixed(2)} GB</span></div>
            <button type="button" class="btn-action-game btn-remove-game" data-index="${index}"><i class="fa-solid fa-xmark"></i></button>
        `;
        elements.myGamesContainer.appendChild(card);
    });

    elements.myGamesContainer.querySelectorAll('.btn-remove-game').forEach(btn => {
        btn.addEventListener('click', () => {
            currentListGames.splice(parseInt(btn.getAttribute('data-index')), 1);
            renderizarCatalogoSelecao(); renderizarMeusJogosEscolhidos(); atualizarBarraArmazenamento();
        });
    });
}

function calcularEspacoOcupado() { return currentListGames.reduce((acc, jogo) => acc + jogo.tamanhoGB, 0); }

function atualizarBarraArmazenamento() {
    const totalOcupado = calcularEspacoOcupado(); const livre = maxRealCapacityGB - totalOcupado;
    let porcentagem = (totalOcupado / maxRealCapacityGB) * 100; if(porcentagem > 100) porcentagem = 100;

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
    if(!elements.adminCatalogContainer) return; elements.adminCatalogContainer.innerHTML = "";
    if(globalCatalog.length === 0) { elements.adminCatalogContainer.innerHTML = `<p class="no-games-placeholder">Nenhum título ativo.</p>`; return; }
    
    globalCatalog.forEach(jogo => {
        const row = document.createElement('div'); row.className = "admin-item-row";
        row.innerHTML = `
            <div class="admin-item-details"><h5>${jogo.nome}</h5><p class="admin-item-sub">${jogo.tamanhoGB.toFixed(2)} GB</p></div>
            <div class="admin-actions-cell">
                <button type="button" class="btn-gamer btn-small btn-edit-jogo" data-id="${jogo.id}" style="background: #f39c12;"><i class="fa-solid fa-pen-to-square"></i></button>
                <button type="button" class="btn-gamer btn-small btn-danger btnDeletarJogo" data-id="${jogo.id}"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
        elements.adminCatalogContainer.appendChild(row);
    });

    elements.adminCatalogContainer.querySelectorAll('.btnDeletarJogo').forEach(btn => {
        btn.addEventListener('click', async () => {
            if(confirm("Deseja banir este título?")) await remove(ref(database, `catalogo/${btn.getAttribute('data-id')}`));
        });
    });

    elements.adminCatalogContainer.querySelectorAll('.btn-edit-jogo').forEach(btn => {
        btn.addEventListener('click', () => {
            const jogo = globalCatalog.find(j => j.id === btn.getAttribute('data-id'));
            if (jogo) {
                editandoJogoId = jogo.id; document.getElementById('addJogoNome').value = jogo.nome;
                document.getElementById('addJogoTamanho').value = jogo.tamanhoGB; document.getElementById('addJogoUnidade').value = "GB";
                elements.btnAddJogoSubmit.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Atualizar Jogo`;
                elements.formAdminAddJogo?.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}
