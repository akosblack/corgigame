/* Corgi Quest: a dependency-free canvas platformer. */
(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const startScreen = document.querySelector("#start-screen");
  const pauseScreen = document.querySelector("#pause-screen");
  const endScreen = document.querySelector("#end-screen");
  const endTitle = document.querySelector("#end-title");
  const endCopy = document.querySelector("#end-copy");
  const W = 1280;
  const H = 720;
  const worldWidth = 6200;
  const keys = new Set();
  const pressed = new Set();
  const particles = [];
  const stars = Array.from({ length: 80 }, (_, i) => ({ x: (i * 173) % worldWidth, y: 55 + (i * 97) % 180, s: 1 + i % 3 }));

  let mode = "start";
  let last = 0;
  let cameraX = 0;
  let shake = 0;
  let levelTime = 0;
  let score = 0;
  let collected = 0;
  let checkpointReached = false;
  let checkpointX = 2440;
  let audioContext;
  let musicTimer;
  let musicOn = true;
  let soundAvailable = true;

  const player = {
    x: 150, y: 450, w: 72, h: 82, vx: 0, vy: 0, face: 1, grounded: false,
    coyote: 0, jumpBuffer: 0, dash: 0, dashCooldown: 0, attack: 0, invuln: 0,
    hp: 8, maxHp: 8, spawnX: 150, spawnY: 450, anim: 0
  };

  const platforms = [
    [0, 560, 760, 160], [900, 560, 650, 160], [1690, 520, 520, 200],
    [2290, 560, 870, 160], [3250, 500, 430, 220], [3790, 560, 760, 160],
    [4750, 520, 540, 200], [5390, 560, 810, 160],
    [460, 420, 190, 28], [1060, 410, 210, 28], [1370, 335, 160, 28],
    [1830, 370, 190, 28], [2030, 280, 170, 28], [2730, 390, 190, 28],
    [3490, 335, 170, 28], [3980, 410, 210, 28], [4420, 330, 150, 28],
    [4970, 355, 180, 28]
  ].map(([x, y, w, h]) => ({ x, y, w, h }));

  const treats = [
    [250, 490], [510, 350], [710, 500], [1000, 500], [1140, 340],
    [1410, 265], [1780, 450], [1900, 300], [2075, 210], [2520, 490],
    [2800, 320], [3050, 490], [3420, 430], [3540, 265], [4050, 340],
    [4480, 260], [4860, 450], [5030, 285], [5500, 490], [5900, 490]
  ].map(([x, y], i) => ({ x, y, r: 13, taken: false, phase: i * .7 }));

  const enemies = [
    { type: "squirrel", x: 620, y: 510, w: 42, h: 46, vx: 50, min: 500, max: 720, hp: 2, alive: true },
    { type: "squirrel", x: 1200, y: 360, w: 42, h: 46, vx: 45, min: 1030, max: 1420, hp: 2, alive: true },
    { type: "squirrel", x: 1850, y: 470, w: 42, h: 46, vx: 55, min: 1740, max: 2150, hp: 2, alive: true },
    { type: "squirrel", x: 2870, y: 510, w: 42, h: 46, vx: 65, min: 2500, max: 3050, hp: 2, alive: true },
    { type: "squirrel", x: 4140, y: 510, w: 42, h: 46, vx: 55, min: 3900, max: 4450, hp: 2, alive: true }
  ];

  const boss = { x: 5650, y: 470, w: 130, h: 90, vx: 75, hp: 8, maxHp: 8, alive: true, cooldown: 1 };
  const hazards = [[770, 600, 130, 40], [1550, 600, 140, 40], [3160, 600, 90, 40], [4510, 600, 240, 40]];
  const checkpoint = { x: checkpointX, y: 500, active: false };

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function reset() {
    mode = "playing";
    levelTime = 0;
    score = 0;
    collected = 0;
    checkpointReached = false;
    checkpoint.active = false;
    player.spawnX = 150;
    player.spawnY = 450;
    player.hp = player.maxHp;
    player.dashCooldown = 0;
    player.invuln = 0;
    respawn();
    treats.forEach(t => { t.taken = false; });
    enemies.forEach(e => { e.alive = true; e.hp = 2; e.x = e.min; });
    boss.alive = true;
    boss.hp = boss.maxHp;
    startScreen.classList.add("hidden");
    endScreen.classList.add("hidden");
    pauseScreen.classList.add("hidden");
  }

  function respawn() {
    player.x = player.spawnX;
    player.y = player.spawnY;
    player.vx = 0;
    player.vy = 0;
    player.hp = player.maxHp;
    player.invuln = 2;
    cameraX = Math.max(0, player.x - 330);
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function addParticles(x, y, color, amount = 8, speed = 120) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      particles.push({ x, y, vx: Math.cos(angle) * speed * Math.random(), vy: Math.sin(angle) * speed * Math.random(), life: .45 + Math.random() * .45, color, size: 3 + Math.random() * 4 });
    }
  }

  function hurt(amount = 1) {
    if (player.invuln > 0) return;
    player.hp -= amount;
    player.invuln = 1.3;
    shake = 12;
    addParticles(player.x + player.w / 2, player.y + player.h / 2, "#ff6b6b", 12, 180);
    if (player.hp <= 0) {
      score = Math.max(0, score - 100);
      respawn();
    }
  }

  function attackBox() {
    return { x: player.face > 0 ? player.x + player.w - 4 : player.x - 104, y: player.y + 14, w: 104, h: 58 };
  }

  function attack() {
    if (player.attack > 0) return;
    player.attack = .38;
    shake = 7;
    playBark();
    const hit = attackBox();
    enemies.forEach(e => {
      if (e.alive && rectsOverlap(hit, e)) {
        e.hp--;
        e.vx = player.face * 180;
        addParticles(e.x + e.w / 2, e.y + e.h / 2, "#ffd166", 8);
        if (e.hp <= 0) { e.alive = false; score += 150; }
      }

      function playBark() {
        if (!soundAvailable) return;
        ensureAudio();
        if (!audioContext) return;
        try {
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          oscillator.type = "square";
          oscillator.frequency.setValueAtTime(240, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(120, audioContext.currentTime + .12);
          gain.gain.setValueAtTime(.045, audioContext.currentTime);
          gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .13);
          oscillator.connect(gain).connect(audioContext.destination);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + .14);
        } catch {
          soundAvailable = false;
        }
      }

      function startMusic() {
        if (!musicOn || !soundAvailable) return;
        ensureAudio();
        if (!audioContext) return;
        audioContext.resume().catch(() => { soundAvailable = false; });
        if (musicTimer) return;
        const notes = [261.63, 329.63, 392, 523.25, 392, 329.63, 293.66, 349.23];
        let step = 0;
        musicTimer = setInterval(() => {
          if (mode !== "playing" || !musicOn) return;
          try {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            oscillator.type = "square";
            oscillator.frequency.value = notes[step++ % notes.length];
            gain.gain.setValueAtTime(.045, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .16);
            oscillator.connect(gain).connect(audioContext.destination);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + .17);
          } catch {
            soundAvailable = false;
            clearInterval(musicTimer);
            musicTimer = undefined;
          }
        }, 240);
      }

      function ensureAudio() {
        if (audioContext || !soundAvailable) return;
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) {
          soundAvailable = false;
          return;
        }
        try {
          audioContext = new AudioCtor();
        } catch {
          soundAvailable = false;
        }
      }
    });
    if (boss.alive && rectsOverlap(hit, boss)) {
      boss.hp--;
      boss.cooldown = .7;
      addParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, "#ff9f43", 12, 180);
      if (boss.hp <= 0) { boss.alive = false; score += 1000; endGame(true); }
    }
  }

  function endGame(won) {
    mode = "ended";
    endTitle.textContent = won ? "Park saved!" : "Adventure over";
    endCopy.textContent = won
      ? `You defeated the squirrel king, collected ${collected} treats, and scored ${score.toLocaleString()} points.`
      : "The park will be here when you are ready for another run.";
    endScreen.classList.remove("hidden");
  }

  function update(dt) {
    if (mode !== "playing") return;
    levelTime += dt;
    player.anim += dt;
    player.invuln = Math.max(0, player.invuln - dt);
    player.attack = Math.max(0, player.attack - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.coyote = Math.max(0, player.coyote - dt);
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);

    const left = keys.has("ArrowLeft") || keys.has("KeyA");
    const right = keys.has("ArrowRight") || keys.has("KeyD");
    const accel = player.dash > 0 ? 0 : 1800;
    if (left) { player.vx -= accel * dt; player.face = -1; }
    if (right) { player.vx += accel * dt; player.face = 1; }
    if (!left && !right && player.dash <= 0) player.vx *= Math.pow(.0008, dt);
    player.vx = Math.max(-310, Math.min(310, player.vx));

    if (pressed.has("Space") || pressed.has("ArrowUp") || pressed.has("KeyW")) player.jumpBuffer = .13;
    if (player.jumpBuffer > 0 && (player.grounded || player.coyote > 0)) {
      player.vy = -720;
      player.grounded = false;
      player.jumpBuffer = 0;
      addParticles(player.x + player.w / 2, player.y + player.h, "#fff0a6", 6, 80);
    }
    if (pressed.has("ShiftLeft") || pressed.has("ShiftRight") || pressed.has("KeyK")) {
      if (player.dashCooldown <= 0) {
        player.dash = .16;
        player.dashCooldown = .65;
        player.vx = player.face * 850;
        player.invuln = Math.max(player.invuln, .25);
        addParticles(player.x, player.y + player.h / 2, "#a7e8ff", 10, 180);
      }
    }
    if (pressed.has("KeyJ") || pressed.has("KeyX")) attack();
    if (player.dash > 0) player.dash -= dt;

    player.vy += 1900 * dt;
    const oldY = player.y;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.grounded = false;
    platforms.forEach(p => {
      if (player.x + player.w > p.x && player.x < p.x + p.w &&
          oldY + player.h <= p.y + 8 && player.y + player.h >= p.y && player.vy >= 0) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.grounded = true;
        player.coyote = .1;
      }
    });
    player.x = Math.max(0, Math.min(worldWidth - player.w, player.x));
    if (player.y > H + 120 || hazards.some(h => rectsOverlap(player, { x: h[0], y: h[1], w: h[2], h: h[3] }))) {
      score = Math.max(0, score - 50);
      respawn();
    }

    if (!checkpointReached && player.x > checkpointX - 50) {
      checkpointReached = true;
      checkpoint.active = true;
      player.spawnX = checkpointX + 30;
      player.spawnY = 410;
      score += 250;
      addParticles(checkpointX, checkpoint.y, "#7df2a4", 20, 220);
    }

    treats.forEach(t => {
      if (!t.taken && Math.hypot(player.x + player.w / 2 - t.x, player.y + player.h / 2 - t.y) < 34) {
        t.taken = true;
        collected++;
        score += 50;
        addParticles(t.x, t.y, "#ffd166", 10);
      }
    });

    enemies.forEach(e => {
      if (!e.alive) return;
      e.x += e.vx * dt;
      if (e.x < e.min || e.x > e.max) e.vx *= -1;
      if (rectsOverlap(player, e)) {
        if (player.vy > 180 && player.y + player.h - e.y < 26) {
          e.hp--;
          player.vy = -420;
          if (e.hp <= 0) { e.alive = false; score += 150; addParticles(e.x, e.y, "#ffd166", 12); }
        } else hurt();
      }
    });

    if (boss.alive && player.x > 5350) {
      boss.x += boss.vx * dt;
      if (boss.x < 5480 || boss.x > 6000) boss.vx *= -1;
      boss.cooldown -= dt;
      if (boss.cooldown <= 0) {
        boss.cooldown = 1.4;
        addParticles(boss.x + boss.w / 2, boss.y, "#ff8066", 8);
      }
      if (rectsOverlap(player, boss)) hurt(2);
    }

    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 360 * dt; p.life -= dt; });
    while (particles.length && particles[0].life <= 0) particles.shift();
    cameraX += (Math.max(0, Math.min(worldWidth - W, player.x - 360)) - cameraX) * Math.min(1, dt * 5);
    shake = Math.max(0, shake - dt * 30);
    pressed.clear();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const sx = (Math.random() - .5) * shake;
    const sy = (Math.random() - .5) * shake;
    ctx.save();
    ctx.translate(sx, sy);
    drawBackground();
    ctx.save();
    ctx.translate(-cameraX, 0);
    platforms.forEach(drawPlatform);
    hazards.forEach(h => { ctx.fillStyle = "#d64e5a"; ctx.fillRect(h[0], h[1], h[2], h[3]); for (let x = h[0]; x < h[0] + h[2]; x += 24) { ctx.fillStyle = "#ff9d5c"; ctx.beginPath(); ctx.moveTo(x, h[1] + 40); ctx.lineTo(x + 12, h[1]); ctx.lineTo(x + 24, h[1] + 40); ctx.fill(); } });
    treats.forEach(drawTreat);
    drawCheckpoint();
    enemies.forEach(drawEnemy);
    if (boss.alive) drawBoss();
    particles.forEach(p => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); ctx.globalAlpha = 1; });
    drawPlayer();
    ctx.restore();
    ctx.restore();
    drawHud();
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "#263c68"); gradient.addColorStop(1, "#f08d77");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffe19a"; ctx.beginPath(); ctx.arc(1040, 125, 58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#38456f";
    stars.forEach(s => { const x = s.x - cameraX * .18; if (x > -10 && x < W + 10) ctx.fillRect(x, s.y, s.s, s.s); });
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = ["#354d70", "#2d4264", "#253858"][layer];
      const offset = (cameraX * [.12, .2, .3][layer]) % 480;
      for (let x = -480 - offset; x < W + 480; x += 480) {
        ctx.beginPath(); ctx.moveTo(x, 500); ctx.lineTo(x + 170, 300 - layer * 35); ctx.lineTo(x + 350, 500); ctx.fill();
      }
    }
  }

  function drawPlatform(p) {
    ctx.fillStyle = "#4d3049"; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#79bf72"; ctx.fillRect(p.x, p.y, p.w, 12);
    ctx.fillStyle = "#a8db76"; ctx.fillRect(p.x, p.y, p.w, 4);
    ctx.fillStyle = "#39273e";
    for (let x = p.x + 14; x < p.x + p.w; x += 35) ctx.fillRect(x, p.y + 30, 13, 8);
  }

  function drawTreat(t) {
    if (t.taken) return;
    const bob = Math.sin(levelTime * 4 + t.phase) * 4;
    ctx.fillStyle = "#ffd166"; ctx.fillRect(t.x - 12, t.y - 10 + bob, 24, 20);
    ctx.fillStyle = "#fff0a6"; ctx.fillRect(t.x - 5, t.y - 15 + bob, 10, 30);
    ctx.fillStyle = "#bc674f"; ctx.fillRect(t.x - 3, t.y - 3 + bob, 6, 6);
  }

  function drawCheckpoint() {
    ctx.fillStyle = "#593d54"; ctx.fillRect(checkpointX, 420, 8, 140);
    ctx.fillStyle = checkpoint.active ? "#7df2a4" : "#9a7090";
    ctx.beginPath(); ctx.moveTo(checkpointX + 8, 425); ctx.lineTo(checkpointX + 72, 450); ctx.lineTo(checkpointX + 8, 475); ctx.fill();
  }

  function drawEnemy(e) {
    if (!e.alive) return;
    ctx.fillStyle = "#7a4c49"; ctx.fillRect(e.x + 5, e.y + 15, e.w - 10, e.h - 15);
    ctx.fillStyle = "#b86d58"; ctx.fillRect(e.x, e.y + 8, e.w, 30);
    ctx.fillStyle = "#f4c58e"; ctx.fillRect(e.x + 8, e.y + 17, 26, 20);
    ctx.fillStyle = "#241c35"; ctx.fillRect(e.x + 13, e.y + 22, 4, 4); ctx.fillRect(e.x + 27, e.y + 22, 4, 4);
    ctx.fillStyle = "#f08a68"; ctx.fillRect(e.x + e.w - 7, e.y - 4, 15, 18);
  }

  function drawBoss() {
    ctx.fillStyle = "#5b344e"; ctx.fillRect(boss.x, boss.y + 22, boss.w, boss.h - 22);
    ctx.fillStyle = "#b94f5b"; ctx.fillRect(boss.x - 8, boss.y, boss.w + 16, 64);
    ctx.fillStyle = "#f2bf86"; ctx.fillRect(boss.x + 23, boss.y + 20, 84, 42);
    ctx.fillStyle = "#241c35"; ctx.fillRect(boss.x + 43, boss.y + 32, 8, 8); ctx.fillRect(boss.x + 90, boss.y + 32, 8, 8);
    ctx.fillStyle = "#ffd166"; ctx.fillRect(boss.x + 42, boss.y - 12, 12, 20); ctx.fillRect(boss.x + 86, boss.y - 12, 12, 20);
    ctx.fillStyle = "#ff5c66"; ctx.fillRect(boss.x, boss.y - 32, boss.w, 10);
    ctx.fillStyle = "#7df2a4"; ctx.fillRect(boss.x, boss.y - 32, boss.w * boss.hp / boss.maxHp, 10);
  }

  function drawPlayer() {
    if (player.invuln > 0 && Math.floor(player.invuln * 14) % 2 === 0) return;
    const bob = player.grounded ? Math.sin(player.anim * 12) * 2 : 0;
    ctx.save(); ctx.translate(player.x + player.w / 2, player.y + player.h / 2 + bob); ctx.scale(player.face, 1);
    ctx.fillStyle = "#8d3f43"; ctx.fillRect(-32, -14, 64, 48);
    ctx.fillStyle = "#e58a5b"; ctx.fillRect(-40, -32, 72, 48);
    ctx.fillStyle = "#fff0c7"; ctx.fillRect(-27, -12, 50, 30);
    ctx.fillStyle = "#241c35"; ctx.fillRect(7, -17, 8, 8); ctx.fillRect(-18, -17, 8, 8);
    ctx.fillStyle = "#241c35"; ctx.fillRect(12, 4, 11, 7);
    ctx.fillStyle = "#743843"; ctx.fillRect(-38, -45, 20, 23); ctx.fillRect(15, -45, 21, 23);
    ctx.fillStyle = "#ffe29a"; ctx.fillRect(-36, -40, 15, 13); ctx.fillRect(18, -40, 15, 13);
    ctx.fillStyle = "#f7c66e"; ctx.fillRect(-29, 25, 22, 17); ctx.fillRect(12, 25, 22, 17);
    ctx.fillStyle = "#bd4f5c"; ctx.fillRect(-42, 19, 12, 10);
    if (player.attack > 0) {
      ctx.fillStyle = "#ff8fa3";
      ctx.fillRect(30, -1, 68, 13);
      ctx.fillRect(84, -7, 18, 24);
      ctx.fillStyle = "#fff0a6";
      ctx.fillRect(30, -6, 9, 22);
    }
    ctx.restore();
  }

  function drawHud() {
    ctx.fillStyle = "#10182bcc"; ctx.fillRect(18, 18, W - 36, 64);
    ctx.fillStyle = "#fff4d6"; ctx.font = "bold 22px monospace"; ctx.fillText("PARK PATROL", 36, 47);
    ctx.fillStyle = "#ffd166"; ctx.font = "bold 18px monospace"; ctx.fillText(`TREATS ${collected}/20`, 250, 46);
    ctx.fillText(`SCORE ${score.toString().padStart(5, "0")}`, 460, 46);
    ctx.fillStyle = "#3a2948"; ctx.fillRect(850, 32, 150, 18);
    ctx.fillStyle = "#ff6b6b"; ctx.fillRect(850, 32, 150 * player.hp / player.maxHp, 18);
    ctx.fillStyle = "#fff4d6"; ctx.fillText("HP", 815, 47);
    ctx.fillStyle = "#a9b8d7"; ctx.font = "14px monospace"; ctx.fillText(`ESC pause · M music ${musicOn ? "on" : "off"}`, 1040, 47);
  }

  function frame(now) {
    const dt = Math.min(.033, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", event => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    if (!keys.has(event.code)) pressed.add(event.code);
    keys.add(event.code);
    if (event.code === "Escape" && (mode === "playing" || mode === "paused")) {
      mode = mode === "playing" ? "paused" : "playing";
      pauseScreen.classList.toggle("hidden", mode !== "paused");
    }
  });
  window.addEventListener("keyup", event => keys.delete(event.code));
  document.querySelector("#start-button").addEventListener("click", () => { reset(); startMusic(); });
  document.querySelector("#restart-button").addEventListener("click", reset);
  window.addEventListener("keydown", event => {
    if (event.code === "KeyM") {
      musicOn = !musicOn;
      if (musicOn) startMusic();
    }
  });
  resize();
  requestAnimationFrame(frame);
})();
