// Canvas ve Context (Bağlam) ayarları
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Sabit Canvas Boyutları
const CANVAS_WIDTH = 450;
const CANVAS_HEIGHT = 700;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// --- OYUN SABİTLERİ VE VARLIKLAR ---
const BLOCK_HEIGHT = 28;
const INITIAL_BLOCK_WIDTH = CANVAS_WIDTH * 0.6;
const BASE_SPEED = 5; 
const SPEED_INCREMENT = 0.5;
const PARTICLE_COUNT = 15;
const PERFECT_TOLERANCE = 3; 

// Oyun durumu
let score = 0;
let gold = parseInt(localStorage.getItem('stackKingGold')) || 0; 
let isGameOver = false;
let isGameStarted = false;
let currentScreen = 'start'; 
let currentSpeed = BASE_SPEED;
let stackedBlocks = []; 
let particles = []; 
let currentBlock = {
    x: 0,
    y: CANVAS_HEIGHT - BLOCK_HEIGHT,
    width: INITIAL_BLOCK_WIDTH,
    direction: 1 
};
let highScores = JSON.parse(localStorage.getItem('stackKingScores')) || [];

// Yeni: Kozmetik Mağaza ve Aktif Görünüm
const SKINS_BASE = [
    { id: 'default', name: 'Varsayılan', price: 0, active: true, color: null },
    { id: 'gold', name: 'Altın Tuğla', price: 100, active: false, color: '#FFD700' },
    { id: 'neon', name: 'Neon Mavi', price: 250, active: false, color: '#33FFFF' }
];

// LocalStorage'dan kayıtlı skinleri yükle veya baz al (Hata çözümü için basit tutuldu)
let SKINS = JSON.parse(localStorage.getItem('stackKingSkins')) || SKINS_BASE;
// Aktif skini bul
let activeSkin = SKINS.find(s => s.active) || SKINS_BASE[0]; 


// Yeni: Ses Varlıkları (Ana klasör varsayımı)
const soundSuccess = new Audio('success.mp3'); 
const soundPerfect = new Audio('perfect.mp3');
const soundFail = new Audio('fail.mp3');
const soundClick = new Audio('click.mp3');

// Tüm sesleri bir diziye topla ve yüklemeye çalış
const allSounds = [soundSuccess, soundPerfect, soundFail, soundClick];

allSounds.forEach(sound => {
    sound.volume = 0.5; 
    sound.load(); 
    sound.addEventListener('error', (e) => {
        console.error("Ses dosyası yüklenemedi veya desteklenmiyor:", sound.src, e);
    });
});

function playSound(sound) {
    if (!sound) return;

    sound.pause();
    sound.currentTime = 0; 
    
    sound.play().catch(error => {
        if (error.name !== 'AbortError') { 
            console.warn("Ses engellendi (Kullanıcı etkileşimi gerekiyor):", sound.src);
        }
    });
}

function vibrate(pattern) {
    if (navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

// Veri Kayıt Fonksiyonları
function saveGold() {
    localStorage.setItem('stackKingGold', gold);
}

function saveSkins() { 
    localStorage.setItem('stackKingSkins', JSON.stringify(SKINS));
}

function saveScore(newScore) {
    if (newScore > 0) {
        highScores.push(newScore);
        highScores.sort((a, b) => b - a);
        highScores = highScores.slice(0, 5);
        localStorage.setItem('stackKingScores', JSON.stringify(highScores));
    }
}

// Renk geçişleri (Gradient) veya tek renk (Skin'e göre)
function getRandomStyle(x, y, w) {
    if (activeSkin.color) {
        return activeSkin.color; 
    }
    const hue = Math.floor(Math.random() * 360);
    const color1 = `hsl(${hue}, 80%, 75%)`; 
    const color2 = `hsl(${(hue + 60) % 360}, 80%, 65%)`;

    const gradient = ctx.createLinearGradient(x, y, x + w, y);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
}

// Partikül Mantığı
function createParticles(x, y, color) {
    const particleColor = typeof color === 'string' ? color : 'rgb(255, 255, 255)';

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: x,
            y: y,
            radius: Math.random() * 4 + 1,
            color: particleColor,
            vx: (Math.random() - 0.5) * 8, 
            vy: Math.random() * -5 - 2, 
            alpha: 1
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; 
        p.alpha -= 0.01; 

        if (p.alpha <= 0 || p.y > CANVAS_HEIGHT) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() { // EKSİK OLAN FONKSİYON EKLENDİ
    particles.forEach(p => {
        ctx.fillStyle = p.color; 
        ctx.globalAlpha = p.alpha;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1; 
}

function initializeGame() {
    canvas.addEventListener('click', handleInput);
    gameLoop();
}

function resetGame() {
    score = 0;
    isGameOver = false;
    currentSpeed = BASE_SPEED;
    stackedBlocks = [];
    particles = [];
    
    stackedBlocks.push({
        x: (CANVAS_WIDTH - INITIAL_BLOCK_WIDTH) / 2,
        y: CANVAS_HEIGHT - BLOCK_HEIGHT, 
        width: INITIAL_BLOCK_WIDTH,
        color: getRandomStyle(0, 0, INITIAL_BLOCK_WIDTH),
        base: true
    });
    
    startNextBlock();
}

function startNextBlock() {
    const lastBlock = stackedBlocks[stackedBlocks.length - 1];
    
    currentBlock.y = lastBlock.y - BLOCK_HEIGHT;
    currentBlock.width = lastBlock.width; 
    currentBlock.direction *= -1; 
    
    if (currentBlock.direction === 1) {
        currentBlock.x = -currentBlock.width; 
    } else {
        currentBlock.x = CANVAS_WIDTH; 
    }
    
    currentBlock.color = getRandomStyle(currentBlock.x, currentBlock.y, currentBlock.width);
    
    if (score > 0 && score % 10 === 0) {
        currentSpeed += SPEED_INCREMENT;
    }
}

function stopBlock() {
    if (isGameOver) return;

    const lastBlock = stackedBlocks[stackedBlocks.length - 1];
    const difference = currentBlock.x - lastBlock.x;
    const overlap = lastBlock.width - Math.abs(difference);

    if (overlap > 0) {
        const newWidth = overlap;
        let newX;
        let isPerfect = Math.abs(difference) <= PERFECT_TOLERANCE;

        if (difference > 0) {
            newX = lastBlock.x + difference;
        } else {
            newX = currentBlock.x;
        }

        stackedBlocks.push({
            x: newX,
            y: currentBlock.y,
            width: newWidth,
            color: getRandomStyle(newX, currentBlock.y, newWidth)
        });
        
        if (currentBlock.y < CANVAS_HEIGHT * 0.25) { 
             moveBlocksDown();
        }

        score++;
        
        if (isPerfect) {
            score += 5; 
            gold += 2; 
            createParticles(newX + newWidth/2, currentBlock.y + BLOCK_HEIGHT / 2, 'rgb(255, 215, 0)');
            playSound(soundPerfect);
            vibrate(100);
        } else {
            playSound(soundSuccess);
        }
        
        startNextBlock();
        saveGold();

    } else {
        gameOver();
    }
}

function moveBlocksDown() {
    const shiftAmount = BLOCK_HEIGHT;
    
    for (let block of stackedBlocks) {
        block.y += shiftAmount;
    }
    
    currentBlock.y += shiftAmount; 
}

function gameOver() {
    isGameOver = true;
    saveScore(score);
    gold += Math.floor(score / 5); 
    saveGold(); 
    playSound(soundFail);
    vibrate([200, 100, 200]);
}

function handleInput(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    playSound(soundClick); 

    if (currentScreen === 'start') {
        if (y > CANVAS_HEIGHT / 2 && y < CANVAS_HEIGHT / 2 + 50) { 
            currentScreen = 'game';
            resetGame();
            isGameStarted = true;
        } else if (y > CANVAS_HEIGHT / 2 + 70 && y < CANVAS_HEIGHT / 2 + 120) { 
            currentScreen = 'scores';
        } else if (y > CANVAS_HEIGHT / 2 + 140 && y < CANVAS_HEIGHT / 2 + 190) { 
            currentScreen = 'shop';
        }
    } else if (currentScreen === 'scores' || currentScreen === 'shop') {
        if (y > CANVAS_HEIGHT - 100 && y < CANVAS_HEIGHT - 50) { 
            currentScreen = 'start';
        }
        if (currentScreen === 'shop') {
             SKINS.forEach((skin, index) => {
                 const skinY = 150 + index * 100;
                 if (y > skinY && y < skinY + 70) { 
                     
                     if (skin.price === 0) {
                         activeSkin = skin;
                         SKINS.forEach(s => s.active = (s.id === skin.id));
                         saveSkins();
                     } else if (gold >= skin.price) {
                         gold -= skin.price;
                         saveGold();
                         skin.price = 0; 
                         activeSkin = skin;
                         SKINS.forEach(s => s.active = (s.id === skin.id));
                         saveSkins();
                     }
                 }
             });
        }
    } else if (currentScreen === 'game') {
        if (isGameOver) {
            currentScreen = 'start';
        } else {
            stopBlock();
        }
    }
}

// --- ÇİZİM FONKSİYONLARI ---

function drawBlock(block) {
    ctx.fillStyle = block.color;
    ctx.fillRect(block.x, block.y, block.width, BLOCK_HEIGHT);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5; 
    ctx.strokeRect(block.x, block.y, block.width, BLOCK_HEIGHT);
}

function drawButton(text, x, y, w, h, bgColor, textColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = textColor;
    ctx.font = `bold 24px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(text, x + w / 2, y + h * 0.65);
}

function drawStartScreen() {
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = `bold 45px Arial`; 
    ctx.fillText('Stack King', CANVAS_WIDTH / 2, 150);
    
    ctx.font = `25px Arial`;
    const bestScore = highScores.length > 0 ? highScores[0] : 0;
    ctx.fillText(`En İyi Skor: ${bestScore}`, CANVAS_WIDTH / 2, 220);

    drawButton('OYNA', CANVAS_WIDTH / 2 - 100, CANVAS_HEIGHT / 2, 200, 50, '#33cc33', '#fff');
    drawButton('SKORLAR', CANVAS_WIDTH / 2 - 100, CANVAS_HEIGHT / 2 + 70, 200, 50, '#cc8433', '#fff');
    drawButton(`MAĞAZA 💰 ${gold}`, CANVAS_WIDTH / 2 - 100, CANVAS_HEIGHT / 2 + 140, 200, 50, '#9933cc', '#fff');
}

function drawShopScreen() {
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = `bold 40px Arial`; 
    ctx.fillText('MAĞAZA', CANVAS_WIDTH / 2, 80);
    ctx.font = `25px Arial`;
    ctx.fillText(`💰 Altın: ${gold}`, CANVAS_WIDTH / 2, 130);
    
    ctx.textAlign = 'left';
    SKINS.forEach((skin, index) => {
        const skinY = 150 + index * 100;
        ctx.fillStyle = skin.id === activeSkin.id ? '#3a3a3a' : '#4a4a4a'; 
        ctx.fillRect(50, skinY, CANVAS_WIDTH - 100, 70);
        
        ctx.fillStyle = '#fff';
        ctx.font = `bold 24px Arial`;
        ctx.fillText(skin.name, 70, skinY + 30);
        
        ctx.font = `20px Arial`;
        if (skin.price > 0) {
            ctx.fillStyle = gold >= skin.price ? '#ffcc00' : '#ff4444';
            ctx.fillText(`💰 ${skin.price}`, 70, skinY + 55);
            
            const btnColor = gold >= skin.price ? '#33cc33' : '#777';
            drawButton('SATIN AL', CANVAS_WIDTH - 150, skinY + 20, 100, 35, btnColor, '#fff');
        } else {
            ctx.fillStyle = skin.id === activeSkin.id ? '#33cc33' : '#3399cc';
            drawButton(skin.id === activeSkin.id ? 'AKTİF' : 'SEÇ', CANVAS_WIDTH - 150, skinY + 20, 100, 35, skin.id === activeSkin.id ? '#2a8a2a' : '#2a6a8a', '#fff');
        }
    });

    drawButton('GERİ', CANVAS_WIDTH / 2 - 100, CANVAS_HEIGHT - 100, 200, 50, '#555', '#fff');
}

function drawHighScores() {
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = `bold 40px Arial`; 
    ctx.fillText('SKOR TABLOSU', CANVAS_WIDTH / 2, 100);
    
    ctx.font = `28px Arial`;
    ctx.textAlign = 'left';
    highScores.forEach((scoreItem, index) => {
        const rank = index + 1;
        ctx.fillText(`${rank}.  ${scoreItem} Yığın`, CANVAS_WIDTH / 2 - 100, 200 + index * 50);
    });
    
    drawButton('GERİ', CANVAS_WIDTH / 2 - 100, CANVAS_HEIGHT - 100, 200, 50, '#555', '#fff');
}

function drawGameScreen() {
    for (let block of stackedBlocks) {
        drawBlock(block);
    }
    
    if (!isGameOver) {
        drawBlock(currentBlock);
    }

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = `30px Arial`;
    ctx.fillText(`YIĞIN: ${score}`, CANVAS_WIDTH / 2, 50);
    
    if (isGameOver) {
        ctx.fillStyle = '#ff6b6b'; 
        ctx.font = `bold 45px Arial`;
        ctx.fillText('OYUN BİTTİ!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        
        ctx.fillStyle = '#fff';
        ctx.font = `28px Arial`;
        ctx.fillText(`SON SKOR: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
        ctx.fillText(`💰 Kazanılan Altın: ${Math.floor(score / 5)}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 85);

        ctx.font = `22px Arial`;
        ctx.fillText('Oynamak İçin Tıkla', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 130);
    }
    
    drawParticles(); 
}


function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (currentScreen === 'start') {
        drawStartScreen();
    } else if (currentScreen === 'scores') {
        drawHighScores();
    } else if (currentScreen === 'shop') {
        drawShopScreen();
    } else if (currentScreen === 'game') {
        drawGameScreen();
    }
}

function gameLoop() {
    if (currentScreen === 'game' && !isGameOver) {
        currentBlock.x += currentBlock.direction * currentSpeed;

        if (currentBlock.direction === 1 && currentBlock.x + currentBlock.width >= CANVAS_WIDTH) {
            currentBlock.direction = -1;
        } else if (currentBlock.direction === -1 && currentBlock.x <= 0) {
            currentBlock.direction = 1;
        }
        updateParticles(); 
    }

    draw();
    requestAnimationFrame(gameLoop);
}

// Oyunu başlat
initializeGame();