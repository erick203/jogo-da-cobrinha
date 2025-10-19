// ==========================================================
// 1. CONSTANTES E CONFIGURAÇÕES DO JOGO
// ==========================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const wrapper = document.getElementById('game-board-wrapper'); // Wrapper do Canvas para responsividade

// Dimensões do Jogo
const TAMANHO = 20; // Tamanho do bloco (Grid Unit)
let LARGURA = canvas.width;
let ALTURA = canvas.height;

// Configurações de Gameplay
const VELOCIDADE_INICIAL = 150;
const VELOCIDADE_MINIMA = 50;
const REDUCAO_VELOCIDADE = 15;
const PONTOS_POR_NIVEL = 5; 

// Paleta de Cores (Reflete o CSS para o desenho do Canvas)
const CORES = {
    FUNDO: '#07010F', 
    COBRA_GRAD_1: '#00FFD1', 
    COBRA_GRAD_2: '#40FFFF', 
    COMIDA_BASIC_1: '#FF45A6', 
    COMIDA_BASIC_2: '#FF80B9', 
    OBSTACULO_GRAD_1: '#FFB800', 
    OBSTACULO_GRAD_2: '#332700', 
    PARTICULA_COMIDA: '0,255,209', 
    BRILHO: '#FCFCFF' 
};

// Elementos DOM 
const gameOverDiv = document.getElementById('gameOver');
const finalScoreSpan = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');
const startScreen = document.getElementById('startScreen');
const startButton = document.getElementById('startButton');
const scoreSpan = document.getElementById('score');
const levelSpan = document.getElementById('level');
const highscoreSpan = document.getElementById('highscore');
const levelProgressSpan = document.getElementById('level-progress');
const pauseScreen = document.getElementById('pauseScreen');
const resumeBtn = document.getElementById('resumeBtn');

// Áudio
const bgMusic = document.getElementById('bgMusic');
bgMusic.volume = 0.3;
const sfxEat = document.getElementById('sfxEat');
const sfxGameOver = document.getElementById('sfxGameOver');
const sfxCollision = document.getElementById('sfxCollision');


// Variáveis de Estado
let cobra = [];
let comida = null;
let dx = TAMANHO;
let dy = 0;
let score = 0;
let level = 1;
let velocidadeAtual = VELOCIDADE_INICIAL;
let highScore = localStorage.getItem('highscore') || 0;
let obstaculos = [];
let isGameOver = false;
let isPaused = true;
let particulas = [];
let pontosNoNivel = 0; 
let inputQueue = [];
let gameRAF;
let lastTime = 0;

highscoreSpan.textContent = highScore;


// ==========================================================
// 2. FUNÇÕES DE UTILIDADE E RESPONSIVIDADE
// ==========================================================

function ajustarCanvas() {
    // Calcula o novo tamanho do canvas para ser um múltiplo de TAMANHO
    let newSize = Math.floor(wrapper.clientWidth / TAMANHO) * TAMANHO;
    
    canvas.width = newSize;
    canvas.height = newSize;
    
    LARGURA = canvas.width;
    ALTURA = canvas.height;
    
    if (!isGameOver && !isPaused) desenhar(); 
}

window.addEventListener('resize', ajustarCanvas);
ajustarCanvas(); 

// ==========================================================
// 3. FUNÇÕES DE LÓGICA E GERAÇÃO
// ==========================================================

function gerarPosicaoAleatoria() {
    let x, y;
    do {
        x = Math.floor(Math.random() * LARGURA / TAMANHO) * TAMANHO;
        y = Math.floor(Math.random() * ALTURA / TAMANHO) * TAMANHO;
    } while (cobra.some(p => p.x === x && p.y === y) || obstaculos.some(o => o.x === x && o.y === y));

    return {x, y};
}

function gerarComida() {
    return gerarPosicaoAleatoria();
}

function gerarObstaculos(num) {
    obstaculos = [];
    for (let i = 0; i < num; i++) {
        let {x, y} = gerarPosicaoAleatoria();
        obstaculos.push({x, y});
    }
}

function processarInput() {
    if (inputQueue.length > 0) {
        const nextMove = inputQueue.shift(); 
        
        // Lógica de evitar movimento reverso
        if (nextMove === 'UP' && dy === 0) { dx = 0; dy = -TAMANHO; }
        else if (nextMove === 'DOWN' && dy === 0) { dx = 0; dy = TAMANHO; }
        else if (nextMove === 'LEFT' && dx === 0) { dx = -TAMANHO; dy = 0; }
        else if (nextMove === 'RIGHT' && dx === 0) { dx = TAMANHO; dy = 0; }
    }
}

function atualizarCobrinha() {
    processarInput();

    let cabeca = {x: cobra[cobra.length - 1].x + dx, y: cobra[cobra.length - 1].y + dy};

    // LÓGICA DO JOGO INFINITO (TOROIDAL ARRAY / EFEITO PAC-MAN)
    if (cabeca.x < 0) {
        cabeca.x = LARGURA - TAMANHO; // Passa para a direita
    } else if (cabeca.x >= LARGURA) {
        cabeca.x = 0; // Passa para a esquerda
    } else if (cabeca.y < 0) {
        cabeca.y = ALTURA - TAMANHO; // Passa para baixo
    } else if (cabeca.y >= ALTURA) {
        cabeca.y = 0; // Passa para cima
    }

    // Colisão remanescente (Corpo e Obstáculos)
    if (cobra.some(p => p.x === cabeca.x && p.y === cabeca.y) || 
        obstaculos.some(o => o.x === cabeca.x && o.y === cabeca.y)) { 
        sfxCollision.play();
        fimDeJogo(); 
        return; 
    }

    cobra.push(cabeca);

    // Comida
    if (comida && cabeca.x === comida.x && cabeca.y === comida.y) {
        score++;
        pontosNoNivel++; 
        sfxEat.play();
        
        scoreSpan.textContent = score;
        levelProgressSpan.textContent = `${pontosNoNivel}/${PONTOS_POR_NIVEL}`;

        // Lógica de Nível (Aumenta velocidade e obstáculos)
        if (pontosNoNivel === PONTOS_POR_NIVEL) { 
            level++;
            pontosNoNivel = 0; 
            levelSpan.textContent = level;
            velocidadeAtual = Math.max(VELOCIDADE_MINIMA, velocidadeAtual - REDUCAO_VELOCIDADE);
            gerarObstaculos(level);
        }

        comida = gerarComida();
    } else {
        cobra.shift(); 
    }
}


// ==========================================================
// 4. FUNÇÕES DE DESENHO E GAME LOOP
// ==========================================================

function limparTela() {
    ctx.fillStyle = CORES.FUNDO;
    ctx.fillRect(0, 0, LARGURA, ALTURA);
}

function desenharCobrinha() {
    cobra.forEach((segmento) => {
        let grad = ctx.createLinearGradient(segmento.x, segmento.y, segmento.x + TAMANHO, segmento.y + TAMANHO);
        grad.addColorStop(0, CORES.COBRA_GRAD_1);
        grad.addColorStop(1, CORES.COBRA_GRAD_2);
        ctx.fillStyle = grad;
        ctx.fillRect(segmento.x, segmento.y, TAMANHO, TAMANHO);
        
        ctx.strokeStyle = CORES.BRILHO;
        ctx.lineWidth = 1;
        ctx.strokeRect(segmento.x, segmento.y, TAMANHO, TAMANHO);
    });
}
function desenharComida() {
    const grad = ctx.createRadialGradient(comida.x + TAMANHO/2, comida.y + TAMANHO/2, 2, comida.x + TAMANHO/2, comida.y + TAMANHO/2, TAMANHO/2);
    grad.addColorStop(0, CORES.COMIDA_BASIC_2); 
    grad.addColorStop(1, CORES.COMIDA_BASIC_1); 
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(comida.x + TAMANHO/2, comida.y + TAMANHO/2, TAMANHO/2, 0, 2 * Math.PI);
    ctx.fill();
}
function desenharObstaculos() {
    obstaculos.forEach(o => {
        const grad = ctx.createLinearGradient(o.x, o.y, o.x + TAMANHO, o.y + TAMANHO);
        grad.addColorStop(0, CORES.OBSTACULO_GRAD_1);
        grad.addColorStop(1, CORES.OBSTACULO_GRAD_2);
        ctx.fillStyle = grad;
        ctx.fillRect(o.x, o.y, TAMANHO, TAMANHO);
        ctx.strokeStyle = CORES.OBSTACULO_GRAD_1;
        ctx.strokeRect(o.x, o.y, TAMANHO, TAMANHO);
    });
}

function desenhar() {
    limparTela();
    desenharComida();
    desenharObstaculos();
    desenharCobrinha();
}

function jogoLoop(currentTime) {
    if (isGameOver || isPaused) return;

    const delta = currentTime - lastTime;
    
    if (delta > velocidadeAtual) {
        lastTime = currentTime - (delta % velocidadeAtual);
        atualizarCobrinha();
    }
    
    desenhar(); 
    
    gameRAF = requestAnimationFrame(jogoLoop);
}

// ==========================================================
// 5. MANIPULAÇÃO DE ESTADO
// ==========================================================

function togglePause() {
    if (isGameOver || !startScreen.classList.contains('hidden')) return; 

    isPaused = !isPaused;

    if (isPaused) {
        cancelAnimationFrame(gameRAF);
        pauseScreen.classList.remove('hidden');
        bgMusic.pause();
    } else {
        pauseScreen.classList.add('hidden');
        bgMusic.play().catch(e => console.log('Erro ao tocar música.')); 
        gameRAF = requestAnimationFrame(jogoLoop);
    }
}

function fimDeJogo() {
    isGameOver = true; 
    cancelAnimationFrame(gameRAF); 
    
    sfxGameOver.play();
    gameOverDiv.classList.remove('hidden');
    finalScoreSpan.textContent = score;

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highscore', highScore);
        highscoreSpan.textContent = highScore;
    }

    bgMusic.pause();
}

function iniciarJogo() {
    startScreen.classList.add('hidden');
    gameOverDiv.classList.add('hidden');
    pauseScreen.classList.add('hidden'); 

    ajustarCanvas(); 

    bgMusic.currentTime = 0;
    bgMusic.play().catch(e => console.log('Erro ao tocar música.')); 

    // Resetar variáveis
    cobra = [{x: 200, y: 200}];
    dx = TAMANHO; dy = 0;
    score = 0; level = 1; velocidadeAtual = VELOCIDADE_INICIAL;
    obstaculos = [];
    comida = gerarComida();
    isGameOver = false; 
    isPaused = false;
    pontosNoNivel = 0; 
    inputQueue = []; 

    scoreSpan.textContent = score;
    levelSpan.textContent = level;
    levelProgressSpan.textContent = `${pontosNoNivel}/${PONTOS_POR_NIVEL}`;
    
    gerarObstaculos(0);
    lastTime = performance.now(); 
    gameRAF = requestAnimationFrame(jogoLoop);
}

// ==========================================================
// 6. EVENT LISTENERS
// ==========================================================

startButton.addEventListener('click', iniciarJogo);
restartBtn.addEventListener('click', iniciarJogo);
resumeBtn.addEventListener('click', togglePause); 

document.addEventListener('keydown', e => {
    if (e.key === 'p' || e.key === 'P') {
        togglePause();
        return; 
    }
    
    if (isGameOver || isPaused || !startScreen.classList.contains('hidden')) return;
    
    let nextDirection = null;

    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') nextDirection = 'UP';
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') nextDirection = 'DOWN';
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') nextDirection = 'LEFT';
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') nextDirection = 'RIGHT';

    if (nextDirection) {
        if (inputQueue.length < 2) {
            inputQueue.push(nextDirection);
        }
    }
});

limparTela();
startScreen.classList.remove('hidden');