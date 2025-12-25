const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#2c3e50',
    parent: 'game-container',
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

let score = 0;
let level = 1;
let streak = 0; // Current consecutive correct answers
let questionTimer = 10;
let totalSessionTime = 0;
let isPaused = false;
let gameActive = false;

let questionText, scoreText, levelText, timerText, sessionText, streakText;
let buttons = [];
let menuContainer;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function preload() {}

function create() {
    scoreText = this.add.text(20, 20, 'Score: 0', { fontSize: '20px', fill: '#fff' });
    levelText = this.add.text(20, 50, 'Level: 1', { fontSize: '20px', fill: '#f1c40f' });
    streakText = this.add.text(20, 80, 'Streak: 0', { fontSize: '20px', fill: '#3498db' });
    
    timerText = this.add.text(780, 20, 'Time: 10', { fontSize: '24px', fill: '#e74c3c' }).setOrigin(1, 0);
    sessionText = this.add.text(400, 20, 'Total: 0s', { fontSize: '18px', fill: '#bdc3c7' }).setOrigin(0.5, 0);
    questionText = this.add.text(400, 180, '', { fontSize: '48px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

    createSidebarButton(this, 730, 80, 'Pause', () => togglePause.call(this));
    createSidebarButton(this, 730, 120, 'Restart', () => restartSession.call(this));

    this.time.addEvent({ delay: 1000, callback: updateTimers, callbackScope: this, loop: true });

    showMenu.call(this, "MATH QUEST", "Start Game");
}

function update() {
    if (questionTimer < 4 && gameActive && !isPaused) {
        timerText.setAlpha(Math.sin(this.time.now / 100) * 0.5 + 0.5);
    } else {
        timerText.setAlpha(1);
    }
}

function updateTimers() {
    if (!gameActive || isPaused) return;
    totalSessionTime++;
    questionTimer--;
    sessionText.setText(`Total: ${totalSessionTime}s`);
    timerText.setText(`Time: ${questionTimer}`);
    if (questionTimer <= 0) {
        playSynthSound(150, 'sawtooth', 0.5);
        endGame.call(this, "Time's Up!");
    }
}

function playSynthSound(freq, type, duration) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function nextQuestion() {
    if (!gameActive) return;
    
    buttons.forEach(b => {
        this.tweens.add({
            targets: b,
            scale: 0,
            duration: 100,
            onComplete: () => b.destroy()
        });
    });
    buttons = [];

    questionTimer = Math.max(5, 16 - level);
    const maxNum = 10 * level;
    const ops = ['+', '-'];
    if (level > 1) ops.push('x');
    if (level > 2) ops.push('square');
    if (level > 3) ops.push('sqrt', 'cube');

    const op = ops[Math.floor(Math.random() * ops.length)];
    let a, b, answer, displayTask;

    switch(op) {
        case '+': a = Phaser.Math.Between(1, maxNum); b = Phaser.Math.Between(1, maxNum);
                  answer = a + b; displayTask = `${a} + ${b}`; break;
        case '-': a = Phaser.Math.Between(maxNum, maxNum*2); b = Phaser.Math.Between(1, maxNum);
                  answer = a - b; displayTask = `${a} - ${b}`; break;
        case 'x': a = Phaser.Math.Between(2, 5 + level); b = Phaser.Math.Between(2, 10);
                  answer = a * b; displayTask = `${a} × ${b}`; break;
        case 'square': a = Phaser.Math.Between(2, 5 + level);
                  answer = a * a; displayTask = `${a}²`; break;
        case 'cube': a = Phaser.Math.Between(2, 5);
                  answer = a * a * a; displayTask = `${a}³`; break;
        case 'sqrt': answer = Phaser.Math.Between(2, 10);
                  a = answer * answer; displayTask = `√${a}`; break;
    }

    questionText.setText(displayTask);
    questionText.setScale(0.5);
    questionText.alpha = 0;
    this.tweens.add({ targets: questionText, scale: 1, alpha: 1, duration: 400, ease: 'Back.easeOut' });

    let options = [answer];
    while(options.length < 4) {
        let wrong = answer + Phaser.Math.Between(-10, 10);
        if(!options.includes(wrong) && wrong >= 0) options.push(wrong);
    }
    options.sort(() => Math.random() - 0.5);

    options.forEach((val, i) => {
        const x = (i % 2 === 0) ? 280 : 520;
        const y = (i < 2) ? 350 : 480;
        
        const btn = this.add.container(x, y);
        const rect = this.add.rectangle(0, 0, 200, 90, 0x34495e).setInteractive({ useHandCursor: true });
        const txt = this.add.text(0, 0, val, { fontSize: '32px', fill: '#fff' }).setOrigin(0.5);
        btn.add([rect, txt]);
        
        btn.setScale(0);
        this.tweens.add({ targets: btn, scale: 1, delay: i * 50, duration: 500, ease: 'Elastic.easeOut' });

        rect.on('pointerover', () => {
            this.tweens.add({ targets: btn, scale: 1.1, duration: 100 });
            rect.setFillStyle(0x2ecc71);
        });
        rect.on('pointerout', () => {
            this.tweens.add({ targets: btn, scale: 1, duration: 100 });
            rect.setFillStyle(0x34495e);
        });

        rect.on('pointerdown', () => {
            if (isPaused) return;
            if (val === answer) {
                playSynthSound(523.25, 'sine', 0.2);
                streak++;
                
                // Bonus logic: Streak multiplier (max 3x)
                let multiplier = Math.min(3, 1 + Math.floor(streak / 5));
                score += (10 * multiplier);
                
                if (score % 100 === 0) { 
                    level++; 
                    levelText.setText(`Level: ${level}`);
                    playSynthSound(880, 'triangle', 0.5);
                }
                
                scoreText.setText(`Score: ${score}`);
                streakText.setText(`Streak: ${streak} (x${multiplier})`);
                
                // Pop animation for streak text
                this.tweens.add({ targets: streakText, scale: 1.5, duration: 100, yoyo: true });

                nextQuestion.call(this);
            } else {
                playSynthSound(110, 'square', 0.3);
                this.cameras.main.shake(200, 0.01);
                streak = 0; // Reset streak
                streakText.setText('Streak: 0');
                questionTimer = Math.max(0, questionTimer - 2);
                this.tweens.add({ targets: btn, x: x + 10, duration: 50, yoyo: true, repeat: 2 });
            }
        });
        buttons.push(btn);
    });
}

function togglePause() {
    if (!gameActive && !isPaused) return;
    isPaused = !isPaused;
    if (isPaused) showMenu.call(this, "Paused", "Resume");
    else {
        this.tweens.add({
            targets: menuContainer,
            scale: 0,
            alpha: 0,
            duration: 200,
            onComplete: () => menuContainer.destroy()
        });
    }
}

function restartSession() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    score = 0; level = 1; streak = 0; totalSessionTime = 0;
    scoreText.setText('Score: 0');
    levelText.setText('Level: 1');
    streakText.setText('Streak: 0');
    if (menuContainer) menuContainer.destroy();
    gameActive = true;
    isPaused = false;
    nextQuestion.call(this);
}

function endGame(reason) {
    gameActive = false;
    setTimeout(() => {
        const playerName = prompt("Great job! Enter your name:", "Player 1") || "Anonymous";
        saveHighScore(playerName, score);
        const highScores = getHighScores();
        let leaderboardStr = "TOP SCORES:\n";
        highScores.slice(0, 3).forEach(s => leaderboardStr += `${s.name}: ${s.score}\n`);
        showMenu.call(this, reason, "Try Again", `Final Score: ${score}\n\n${leaderboardStr}`);
    }, 100);
}

function saveHighScore(name, score) {
    let scores = JSON.parse(localStorage.getItem('mathGameScores') || '[]');
    scores.push({ name, score, date: new Date().toLocaleDateString() });
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem('mathGameScores', JSON.stringify(scores));
}

function getHighScores() {
    return JSON.parse(localStorage.getItem('mathGameScores') || '[]');
}

function showMenu(title, btnLabel, subtext = "") {
    if (menuContainer) menuContainer.destroy();
    gameActive = false;
    
    menuContainer = this.add.container(400, 300);
    const bg = this.add.rectangle(0, 0, 500, 450, 0x000000, 0.85);
    const t = this.add.text(0, -160, title, { fontSize: '40px', fill: '#fff' }).setOrigin(0.5);
    const st = this.add.text(0, -50, subtext, { fontSize: '20px', fill: '#bdc3c7', align: 'center' }).setOrigin(0.5);
    const startBtn = this.add.rectangle(0, 150, 200, 60, 0x27ae60).setInteractive({ useHandCursor: true });
    const startTxt = this.add.text(0, 150, btnLabel, { fontSize: '24px', fill: '#fff' }).setOrigin(0.5);
    
    menuContainer.add([bg, t, st, startBtn, startTxt]);
    menuContainer.setScale(0);
    this.tweens.add({ targets: menuContainer, scale: 1, duration: 500, ease: 'Back.easeOut' });

    startBtn.on('pointerdown', () => {
        if (title === "Paused") togglePause.call(this);
        else restartSession.call(this);
    });
}

function createSidebarButton(scene, x, y, label, callback) {
    const btn = scene.add.rectangle(x, y, 100, 30, 0x95a5a6).setInteractive({ useHandCursor: true });
    const txt = scene.add.text(x, y, label, { fontSize: '14px', fill: '#fff' }).setOrigin(0.5);
    btn.on('pointerdown', callback);
}