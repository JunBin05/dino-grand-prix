const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = {};
let gameActive = false; 
let revealPhase = 0; // Tracks the podium reveal steps
let scoreInterval;
let globalSpeed = 1; // AUTHENTIC STARTING SPEED

const ITEM_TYPES = ['eclipse', 'bat', 'star', 'gravity', 'bubble', 'earthquake', 'healer', 'hyper'];
const ITEM_NAMES = {
    'eclipse': '🌑 The Eclipse', 'bat': '🦇 Vampire Bat', 'star': '⭐ The Star',
    'gravity': '🙃 Gravity Curse', 'bubble': '🫧 Bubble Shield', 'earthquake': '🌋 Earthquake',
    'healer': '💖 The Healer', 'hyper': '⚡ Hyper Speed'
};

io.on('connection', (socket) => {

    socket.on('triggerNextReveal', () => {
        revealPhase++;
        io.emit('revealState', revealPhase);
    });
    
    socket.on('playerJoin', (username) => {
        players[socket.id] = { id: socket.id, name: username, score: 0, y: 133, ducking: false, dead: false, item: null, lives: 3, invulnerable: false };
        io.emit('updateMatrix', players);
        if (gameActive) { socket.emit('roundStarted', { round: 1, mode: 'normal' }); } 
    });

    socket.on('adminStartRound', () => {
        if (!gameActive && Object.keys(players).length >= 1) startRound();
    });

    socket.on('updatePosition', (data) => {
        if (players[socket.id] && !players[socket.id].dead) {
            players[socket.id].y = data.y;
            players[socket.id].ducking = data.ducking;
            io.emit('playerMoved', { id: socket.id, data: data });
        }
    });

    socket.on('playerHit', () => {
        let p = players[socket.id];
        if (p && !p.dead && !p.invulnerable) {
            p.lives -= 1;
            if (p.lives <= 0) {
                p.dead = true;
                io.emit('playerDied', socket.id);
                checkRoundOver();
            } else {
                p.invulnerable = true;
                io.emit('updateScores', players); 
                setTimeout(() => {
                    if (players[socket.id]) { players[socket.id].invulnerable = false; io.emit('updateScores', players); }
                }, 2000); 
            }
        }
    });

    socket.on('died', () => {
        let p = players[socket.id];
        if (p && !p.dead) {
            p.lives = 0;         // Wipe out all lives
            p.dead = true;       // Mark as dead on the server
            io.emit('playerDied', socket.id); // Tell the spectator to draw WASTED
            io.emit('updateScores', players); // Update the lives UI
            checkRoundOver();    // Check if the game should end
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updateMatrix', players);
        checkRoundOver(); 
    });

    socket.on('collectedItem', () => {
        let p = players[socket.id];
        if (p && !p.dead) { // Notice we removed !p.item so it overwrites!
            p.item = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
            socket.emit('itemReceived', ITEM_NAMES[p.item] + ' (Press ENTER)');
            io.emit('updateScores', players); 
        }
    });

    socket.on('useItem', () => {
        let p = players[socket.id];
        if (!p || !p.item || p.dead) return;

        let weapon = p.item;
        p.item = null; 
        socket.emit('itemReceived', 'None');
        
        if (weapon === 'eclipse') { socket.broadcast.emit('attackedByEclipse'); } 
        else if (weapon === 'earthquake') { socket.broadcast.emit('attackedByEarthquake'); }
        else if (weapon === 'star') { socket.emit('starActivated'); }
        else if (weapon === 'bubble') { socket.emit('bubbleActivated'); }
        else if (weapon === 'gravity') {
            let targetId = null, maxScore = -1;
            for (let id in players) {
                if (!players[id].dead && id !== socket.id && players[id].score > maxScore) { maxScore = players[id].score; targetId = id; }
            }
            if (targetId) io.to(targetId).emit('attackedByGravity');
        }
        else if (weapon === 'bat') {
            let targetId = null, maxLives = 0;
            for (let id in players) {
                if (!players[id].dead && id !== socket.id && players[id].lives > maxLives) { maxLives = players[id].lives; targetId = id; }
            }
            if (targetId && maxLives > 0) {
                players[targetId].lives -= 1; 
                if (players[targetId].lives <= 0) {
                    players[targetId].dead = true;
                    io.emit('playerDied', targetId);
                    checkRoundOver();
                }
                if (p.lives < 3) p.lives += 1; 
                io.emit('updateScores', players);
            }
        }else if (weapon === 'healer') {
            // 1. Find the lowest amount of lives currently in the lobby
            let minLives = 99;
            for (let id in players) {
                if (!players[id].dead && players[id].lives < minLives) {
                    minLives = players[id].lives;
                }
            }
            // 2. Heal the player(s) tied for lowest!
            for (let id in players) {
                if (!players[id].dead && players[id].lives === minLives && players[id].lives < 3) {
                    players[id].lives += 1;
                }
            }
        }
        else if (weapon === 'hyper') {
            // Self-harm item! Only attacks the user who pressed ENTER
            socket.emit('attackedByHyper');
        }
        io.emit('updateScores', players);
    });
});

function startRound() {
    gameActive = true;
    globalSpeed = 1; // AUTHENTIC STARTING SPEED
    
    for (let id in players) {
        players[id].dead = false; players[id].score = 0; players[id].item = null; 
        players[id].lives = 3; players[id].invulnerable = false;
    }

    io.emit('roundStarted');
    io.emit('setSpeed', globalSpeed);
    
    scoreInterval = setInterval(() => {
        let anyoneAlive = false;
        for (let id in players) {
            if (!players[id].dead) {
                players[id].score += 1; anyoneAlive = true;
            }
        }
        
        // AUTHENTIC ACCELERATION
        if (anyoneAlive) {
            if (globalSpeed < 13) {
                globalSpeed += 0.01; // Smooth gradual speed increase
                io.emit('setSpeed', globalSpeed);
            }
            io.emit('updateScores', players); 
        }
    }, 100);
}

function checkRoundOver() {
    if (!gameActive) return;
    if (Object.keys(players).length === 0) { gameActive = false; clearInterval(scoreInterval); return; }

    let everyoneDead = true;
    for (let id in players) { if (!players[id].dead) everyoneDead = false; }

    if (everyoneDead) {
        gameActive = false; clearInterval(scoreInterval);
        let highestScore = -1, winnerName = "No one";
        for (let id in players) {
            if (players[id].score > highestScore) { highestScore = players[id].score; winnerName = players[id].name; }
        }
        revealPhase = 0; // Reset for the new podium
        io.emit('roundEnded', { winner: winnerName, score: highestScore });
    }
}

function spawnObstacle() {
    if (gameActive) { 
        if (Math.random() > 0.75) {
            let heights = [80, 110, 130]; 
            let birdY = heights[Math.floor(Math.random() * heights.length)];
            io.emit('spawnObstacle', { type: 'bird', x: 600, y: birdY, w: 46, h: 40 });
        } else {
            io.emit('spawnObstacle', { type: 'cactus', x: 600, y: 130, w: 25, h: 50 });
        }
    }
    
    // 🚨 INCREASED DELAYS: Now waits a minimum of 1.2 seconds between obstacles!
    const baseDelay = 2500 - (globalSpeed * 100); 
    const nextSpawn = Math.floor(Math.random() * 1200) + Math.max(1200, baseDelay); 
    setTimeout(spawnObstacle, nextSpawn);
}
// --- FIX 1: UPDATE SPAWN ITEM LOGIC ---
function spawnItemBox() {
    // Remove the currentMode check so items spawn in 'normal' mode
    if (gameActive) { 
        if (Math.random() > 0.7) { 
            let boxData = { type: 'item', x: 600, y: 70, w: 30, h: 30 };
            io.emit('spawnItemBox', boxData); 
            io.emit('spawnObstacle', boxData); 
        }
    }
    setTimeout(spawnItemBox, 1500); 
}

// --- FIX 2: START THE LOOP ---
spawnObstacle(); 
spawnItemBox(); // --- ADD THIS LINE HERE

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => { console.log(`🚀 Server running on http://localhost:${PORT}`); });