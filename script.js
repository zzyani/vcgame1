const gameArea = document.getElementById("gameArea");
const playerEl = document.getElementById("player");
const monsterEl = document.getElementById("monster");
const exitEl = document.getElementById("exit");
const flashlightEl = document.getElementById("flashlight");
const messageEl = document.getElementById("message");
const startBtn = document.getElementById("startBtn");
const gameStatus = document.getElementById("gameStatus");
const batteryFill = document.getElementById("batteryFill");
const timeText = document.getElementById("timeText");
const obstacleLayer = document.getElementById("obstacleLayer");

const keys = new Set();
const RANKING_KEY = "lightMonsterRanking";
const MAX_LEVEL = 5;

const levels = {
  1: { name: "1단계", monsterSpeed: 120, batteryDrain: 22, batteryCharge: 7, lightRange: 230, monsterScale: 1, obstacleCount: 1 },
  2: { name: "2단계", monsterSpeed: 150, batteryDrain: 28, batteryCharge: 6, lightRange: 215, monsterScale: 1.18, obstacleCount: 2 },
  3: { name: "3단계", monsterSpeed: 178, batteryDrain: 34, batteryCharge: 5, lightRange: 195, monsterScale: 1.35, obstacleCount: 3 },
  4: { name: "4단계", monsterSpeed: 205, batteryDrain: 40, batteryCharge: 4, lightRange: 175, monsterScale: 1.5, obstacleCount: 4 },
  5: { name: "5단계", monsterSpeed: 235, batteryDrain: 46, batteryCharge: 3, lightRange: 155, monsterScale: 1.65, obstacleCount: 5 },
};

const obstacleTypes = [
  { className: "obstacle-rock", width: 64, height: 58 },
  { className: "obstacle-crystal", width: 48, height: 76 },
  { className: "obstacle-pillar", width: 42, height: 92 },
  { className: "obstacle-wall", width: 110, height: 34 },
  { className: "obstacle-spike", width: 60, height: 62 },
];

const player = {
  x: 80,
  y: 80,
  size: 30,
  speed: 240,
  lastDirX: 1,
  lastDirY: 0,
};

const monster = {
  x: 520,
  y: 320,
  size: 42,
  speed: 120,
};

const exit = {
  x: 0,
  y: 0,
  width: 96,
  height: 56,
};

let obstacles = [];
let currentLevel = 1;
let battery = 100;
let isFlashlightOn = false;
let wasFlashlightOn = false;
let isRunning = false;
let lastTime = 0;
let playTime = 0;
let totalPlayTime = 0;
let animationId = null;
let audioContext = null;
let ambientOscillators = [];
let ambientGain = null;
let isAmbientPlaying = false;
let monsterStuckTime = 0;
let monsterDetour = null;

function getGameSize() {
  return {
    width: gameArea.clientWidth,
    height: gameArea.clientHeight,
  };
}

function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playFlashlightOnSound() {
  playClickSound({
    startFrequency: 920,
    endFrequency: 520,
    duration: 0.055,
    volume: 0.16,
    waveType: "square",
  });

  setTimeout(() => {
    playClickSound({
      startFrequency: 640,
      endFrequency: 760,
      duration: 0.04,
      volume: 0.08,
      waveType: "triangle",
    });
  }, 38);
}

function playFlashlightOffSound() {
  playClickSound({
    startFrequency: 360,
    endFrequency: 160,
    duration: 0.09,
    volume: 0.12,
    waveType: "triangle",
  });
}

function playVictorySound() {
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const notes = [523.25, 659.25, 783.99];

  notes.forEach((freq, index) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const startTime = now + index * 0.15;

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.25);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.3);
  });
}

function playDefeatSound() {
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(90, now + 0.8);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

  osc.connect(gain);
  gain.connect(audioContext.destination);

  osc.start(now);
  osc.stop(now + 0.8);
}

function playClickSound({ startFrequency, endFrequency, duration, volume, waveType }) {
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  oscillator.type = waveType;
  oscillator.frequency.setValueAtTime(startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);

  filter.type = "highpass";
  filter.frequency.setValueAtTime(120, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function startAmbientMusic() {
  if (!audioContext || isAmbientPlaying) return;

  ambientGain = audioContext.createGain();
  ambientGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  ambientGain.gain.exponentialRampToValueAtTime(0.045, audioContext.currentTime + 1.2);

  const frequencies = [55, 82.41, 110];

  ambientOscillators = frequencies.map((freq, index) => {
    const osc = audioContext.createOscillator();
    const filter = audioContext.createBiquadFilter();

    osc.type = index === 0 ? "sine" : "triangle";
    osc.frequency.setValueAtTime(freq, audioContext.currentTime);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(260, audioContext.currentTime);

    osc.connect(filter);
    filter.connect(ambientGain);
    osc.start();

    return osc;
  });

  ambientGain.connect(audioContext.destination);
  isAmbientPlaying = true;
}

function pauseAmbientMusic() {
  if (!ambientGain || !isAmbientPlaying) return;

  ambientGain.gain.cancelScheduledValues(audioContext.currentTime);
  ambientGain.gain.setValueAtTime(ambientGain.gain.value, audioContext.currentTime);
  ambientGain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.25);
}

function resumeAmbientMusic() {
  if (!ambientGain || !isAmbientPlaying || !isRunning) return;

  ambientGain.gain.cancelScheduledValues(audioContext.currentTime);
  ambientGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  ambientGain.gain.exponentialRampToValueAtTime(0.045, audioContext.currentTime + 0.8);
}

function stopAmbientMusic() {
  if (!isAmbientPlaying) return;

  ambientOscillators.forEach((osc) => {
    try {
      osc.stop();
      osc.disconnect();
    } catch (error) {}
  });

  if (ambientGain) {
    ambientGain.disconnect();
  }

  ambientOscillators = [];
  ambientGain = null;
  isAmbientPlaying = false;
}

function applyLevelVisuals() {
  gameArea.classList.remove("level-1", "level-2", "level-3", "level-4", "level-5");
  monsterEl.classList.remove(
    "monster-level-1",
    "monster-level-2",
    "monster-level-3",
    "monster-level-4",
    "monster-level-5"
  );

  gameArea.classList.add(`level-${currentLevel}`);
  monsterEl.classList.add(`monster-level-${currentLevel}`);
}

function resetLevel() {
  const { width, height } = getGameSize();
  const levelData = levels[currentLevel];

  player.x = 70;
  player.y = height - 70;
  player.lastDirX = 1;
  player.lastDirY = 0;

  monster.x = width * 0.55;
  monster.y = height * 0.45;
  monster.speed = levelData.monsterSpeed;
  monsterStuckTime = 0;
  monsterDetour = null;

  exit.x = width - 80;
  exit.y = 70;

  battery = 100;
  playTime = 0;
  isFlashlightOn = false;
  wasFlashlightOn = false;
  isRunning = true;
  lastTime = performance.now();

  gameStatus.textContent = `${levelData.name} 진행 중`;
  messageEl.classList.add("hidden");
  monsterEl.classList.remove("stunned");

  applyLevelVisuals();
  createObstacles();
  updateRender();
}

function createObstacles() {
  const { width, height } = getGameSize();
  const levelData = levels[currentLevel];

  obstacles = [];
  obstacleLayer.innerHTML = "";

  let attempts = 0;

  while (attempts < 80) {
    attempts += 1;
    obstacles = [];

    let tryCount = 0;

    while (obstacles.length < levelData.obstacleCount && tryCount < 500) {
      tryCount += 1;

      const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];

      const obstacle = {
        x: randomRange(120, width - 120),
        y: randomRange(110, height - 110),
        width: type.width,
        height: type.height,
        className: type.className,
      };

      if (canPlaceObstacle(obstacle)) {
        obstacles.push(obstacle);
      }
    }

    if (obstacles.length === levelData.obstacleCount && isMapPlayable()) {
      break;
    }
  }

  obstacleLayer.innerHTML = "";

  obstacles.forEach((obstacle) => {
    const obstacleEl = document.createElement("div");
    obstacleEl.className = `obstacle ${obstacle.className}`;
    obstacleEl.style.left = `${obstacle.x}px`;
    obstacleEl.style.top = `${obstacle.y}px`;
    obstacleEl.style.width = `${obstacle.width}px`;
    obstacleEl.style.height = `${obstacle.height}px`;
    obstacleLayer.appendChild(obstacleEl);
  });
}

function canPlaceObstacle(obstacle) {
  const safeZones = [
    { x: player.x, y: player.y, radius: 140 },
    { x: exit.x, y: exit.y, radius: 140 },
    { x: monster.x, y: monster.y, radius: 150 },
  ];

  const inSafeZone = safeZones.some((zone) => {
    return Math.hypot(obstacle.x - zone.x, obstacle.y - zone.y) < zone.radius;
  });

  if (inSafeZone) return false;

  const tooClose = obstacles.some((other) => {
    return rectsOverlap(
      obstacle.x,
      obstacle.y,
      obstacle.width + 50,
      obstacle.height + 50,
      other.x,
      other.y,
      other.width,
      other.height
    );
  });

  return !tooClose;
}

function isMapPlayable() {
  return hasGridPath(monster.x, monster.y, player.x, player.y) &&
         hasGridPath(player.x, player.y, exit.x, exit.y);
}

function hasGridPath(startX, startY, targetX, targetY) {
  const { width, height } = getGameSize();
  const gridSize = 40;
  const cols = Math.floor(width / gridSize);
  const rows = Math.floor(height / gridSize);

  const start = {
    x: clamp(Math.floor(startX / gridSize), 0, cols - 1),
    y: clamp(Math.floor(startY / gridSize), 0, rows - 1),
  };

  const target = {
    x: clamp(Math.floor(targetX / gridSize), 0, cols - 1),
    y: clamp(Math.floor(targetY / gridSize), 0, rows - 1),
  };

  const queue = [start];
  const visited = new Set([`${start.x},${start.y}`]);

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.x === target.x && current.y === target.y) {
      return true;
    }

    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    directions.forEach((dir) => {
      const next = {
        x: current.x + dir.x,
        y: current.y + dir.y,
      };

      const key = `${next.x},${next.y}`;

      if (
        next.x >= 0 &&
        next.x < cols &&
        next.y >= 0 &&
        next.y < rows &&
        !visited.has(key) &&
        !isPointBlocked(next.x * gridSize + gridSize / 2, next.y * gridSize + gridSize / 2, 26)
      ) {
        visited.add(key);
        queue.push(next);
      }
    });
  }

  return false;
}

function startGame() {
  initAudio();
  stopAmbientMusic();
  startAmbientMusic();
  cancelAnimationFrame(animationId);

  currentLevel = 1;
  totalPlayTime = 0;

  resetLevel();
  animationId = requestAnimationFrame(gameLoop);
}

function startNextLevel() {
  currentLevel += 1;
  resetLevel();
  animationId = requestAnimationFrame(gameLoop);
}

function clearKeyState() {
  keys.clear();
  isFlashlightOn = false;
  wasFlashlightOn = false;
}

function endGame(title, description, statusText) {
  isRunning = false;
  cancelAnimationFrame(animationId);
  stopAmbientMusic();

  totalPlayTime += playTime;

  if (isFlashlightOn) {
    isFlashlightOn = false;
    wasFlashlightOn = false;
    playFlashlightOffSound();
  }

  clearKeyState();

  if (statusText === "승리") playVictorySound();
  if (statusText === "패배") playDefeatSound();

  gameStatus.textContent = statusText;

  if (statusText === "승리" && currentLevel < MAX_LEVEL) {
    showLevelClearMessage(description);
    return;
  }

  showFinalMessage(title, description, statusText);
}

function showLevelClearMessage(description) {
  messageEl.innerHTML = `
    <h2>${currentLevel}단계 클리어!</h2>
    <p>${description}</p>
    <p>다음 단계에서는 괴물이 더 빨라지고, 손전등 배터리 소모와 장애물이 증가합니다.</p>

    <div class="level-button-wrap">
      <button id="nextLevelBtn">다음 단계로</button>
      <button id="restartBtn">처음부터 다시</button>
    </div>
  `;

  messageEl.classList.remove("hidden");

  document.getElementById("nextLevelBtn").addEventListener("click", startNextLevel);
  document.getElementById("restartBtn").addEventListener("click", startGame);
}

function showFinalMessage(title, description, statusText) {
  messageEl.innerHTML = `
    <h2>${title}</h2>
    <p>${description}</p>
    <p>도달 단계: ${currentLevel}단계</p>
    <p>총 플레이 시간: ${totalPlayTime.toFixed(1)}초</p>

    <div class="rank-form">
      <input id="nicknameInput" type="text" maxlength="10" placeholder="닉네임 입력" />
      <button id="saveRankBtn">기록 남기기</button>
    </div>

    <div id="rankingBoard" class="ranking-board">
      ${getRankingHTML()}
    </div>

    <button id="restartBtn" class="restart-bottom">다시 시작</button>
  `;

  messageEl.classList.remove("hidden");

  document.getElementById("restartBtn").addEventListener("click", startGame);
  document.getElementById("saveRankBtn").addEventListener("click", () => saveCurrentRank(statusText));
}

function saveCurrentRank(statusText) {
  const nicknameInput = document.getElementById("nicknameInput");
  const nickname = nicknameInput.value.trim();

  if (!nickname) {
    alert("닉네임을 입력해주세요.");
    return;
  }

  saveRanking({
    nickname,
    result: statusText,
    level: currentLevel,
    time: Number(totalPlayTime.toFixed(1)),
    date: Date.now(),
  });

  document.getElementById("rankingBoard").innerHTML = getRankingHTML();
  nicknameInput.disabled = true;

  const saveRankBtn = document.getElementById("saveRankBtn");
  saveRankBtn.disabled = true;
  saveRankBtn.textContent = "기록 완료";
}

function getRankings() {
  const saved = localStorage.getItem(RANKING_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveRanking(record) {
  const rankings = getRankings();

  rankings.push(record);

  rankings.sort((a, b) => {
    if (a.result === "승리" && b.result !== "승리") return -1;
    if (a.result !== "승리" && b.result === "승리") return 1;

    if (a.level !== b.level) return b.level - a.level;

    if (a.result === "승리" && b.result === "승리") {
      return a.time - b.time;
    }

    return b.date - a.date;
  });

  localStorage.setItem(RANKING_KEY, JSON.stringify(rankings.slice(0, 10)));
}

function getRankingHTML() {
  const rankings = getRankings();

  if (rankings.length === 0) {
    return `
      <h3>랭킹 TOP 10</h3>
      <p>아직 기록이 없습니다.</p>
    `;
  }

  const rankingItems = rankings
    .map((rank, index) => {
      const resultText = rank.result === "승리" ? "전체 탈출" : "실패";
      const levelText = `${rank.level || 1}단계`;

      return `
        <li>
          <span>${index + 1}. ${rank.nickname}</span>
          <span>${resultText} / ${levelText} / ${rank.time}초</span>
        </li>
      `;
    })
    .join("");

  return `
    <h3>랭킹 TOP 10</h3>
    <ol class="ranking-list">
      ${rankingItems}
    </ol>
  `;
}

function gameLoop(now) {
  if (!isRunning) return;

  const delta = Math.min((now - lastTime) / 1000, 0.04);
  lastTime = now;
  playTime += delta;

  updatePlayer(delta);
  updateFlashlight(delta);
  updateMonster(delta);
  checkCollision();
  updateRender();

  animationId = requestAnimationFrame(gameLoop);
}

function updatePlayer(delta) {
  let dx = 0;
  let dy = 0;

  if (keys.has("ArrowLeft") || keys.has("KeyA")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) dy += 1;

  if (dx !== 0 || dy !== 0) {
    const length = Math.hypot(dx, dy);
    dx /= length;
    dy /= length;
    player.lastDirX = dx;
    player.lastDirY = dy;
  }

  const { width, height } = getGameSize();
  const radius = player.size / 2;

  const nextX = clamp(player.x + dx * player.speed * delta, radius, width - radius);
  const nextY = clamp(player.y + dy * player.speed * delta, radius, height - radius);

  if (!isCircleTouchingObstacles(nextX, player.y, radius)) player.x = nextX;
  if (!isCircleTouchingObstacles(player.x, nextY, radius)) player.y = nextY;
}

function updateFlashlight(delta) {
  const levelData = levels[currentLevel];

  isFlashlightOn = keys.has("Space") && battery > 0;

  if (isFlashlightOn && !wasFlashlightOn) {
    playFlashlightOnSound();
    pauseAmbientMusic();
  }

  if (!isFlashlightOn && wasFlashlightOn) {
    playFlashlightOffSound();
    resumeAmbientMusic();
  }

  wasFlashlightOn = isFlashlightOn;

  battery += isFlashlightOn
    ? -levelData.batteryDrain * delta
    : levelData.batteryCharge * delta;

  battery = clamp(battery, 0, 100);

  if (battery <= 0) {
    endGame("배터리 방전", "어둠이 완전히 삼켜버렸습니다.", "패배");
  }
}

function updateMonster(delta) {
  const stunned = isMonsterInLight();
  monsterEl.classList.toggle("stunned", stunned);

  if (stunned) return;

  const target = monsterDetour || player;
  const beforeX = monster.x;
  const beforeY = monster.y;

  moveMonsterToward(target.x, target.y, delta);

  const movedDistance = Math.hypot(monster.x - beforeX, monster.y - beforeY);

  if (movedDistance < 0.5) {
    monsterStuckTime += delta;
  } else {
    monsterStuckTime = 0;
  }

  if (monsterStuckTime > 0.35) {
    monsterDetour = findMonsterDetourPoint();
    monsterStuckTime = 0;
  }

  if (monsterDetour && Math.hypot(monster.x - monsterDetour.x, monster.y - monsterDetour.y) < 28) {
    monsterDetour = null;
  }
}

function moveMonsterToward(targetX, targetY, delta) {
  const dx = targetX - monster.x;
  const dy = targetY - monster.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= 0) return;

  const speed = monster.speed * delta;
  const dirX = dx / distance;
  const dirY = dy / distance;

  const candidates = [
    { x: monster.x + dirX * speed, y: monster.y + dirY * speed },
    { x: monster.x + dirX * speed, y: monster.y },
    { x: monster.x, y: monster.y + dirY * speed },
    { x: monster.x - dirY * speed, y: monster.y + dirX * speed },
    { x: monster.x + dirY * speed, y: monster.y - dirX * speed },
  ];

  let best = null;
  let bestDistance = Infinity;

  candidates.forEach((candidate) => {
    if (!isCircleTouchingObstacles(candidate.x, candidate.y, getMonsterHitRadius())) {
      const targetDistance = Math.hypot(candidate.x - targetX, candidate.y - targetY);

      if (targetDistance < bestDistance) {
        best = candidate;
        bestDistance = targetDistance;
      }
    }
  });

  if (best) {
    monster.x = best.x;
    monster.y = best.y;
  }
}

function findMonsterDetourPoint() {
  const { width, height } = getGameSize();
  const radius = getMonsterHitRadius();
  const points = [];

  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
    points.push({
      x: clamp(monster.x + Math.cos(angle) * 120, radius, width - radius),
      y: clamp(monster.y + Math.sin(angle) * 120, radius, height - radius),
    });
  }

  const validPoints = points.filter((point) => {
    return !isCircleTouchingObstacles(point.x, point.y, radius);
  });

  if (validPoints.length === 0) return null;

  validPoints.sort((a, b) => {
    const aDistance = Math.hypot(a.x - player.x, a.y - player.y);
    const bDistance = Math.hypot(b.x - player.x, b.y - player.y);
    return aDistance - bDistance;
  });

  return validPoints[0];
}

function isMonsterInLight() {
  if (!isFlashlightOn) return false;

  const levelData = levels[currentLevel];
  const vx = monster.x - player.x;
  const vy = monster.y - player.y;
  const distance = Math.hypot(vx, vy);

  if (distance > levelData.lightRange) return false;

  const dirLength = Math.hypot(player.lastDirX, player.lastDirY);
  const lightX = player.lastDirX / dirLength;
  const lightY = player.lastDirY / dirLength;
  const monsterX = vx / distance;
  const monsterY = vy / distance;
  const dot = lightX * monsterX + lightY * monsterY;

  return dot > 0.45;
}

function checkCollision() {
  const monsterDistance = Math.hypot(player.x - monster.x, player.y - monster.y);

  if (monsterDistance < player.size / 2 + getMonsterHitRadius()) {
    endGame("괴물에게 잡혔다", "손전등 타이밍이 조금 늦었습니다.", "패배");
    return;
  }

  const isInExit =
    Math.abs(player.x - exit.x) < exit.width / 2 &&
    Math.abs(player.y - exit.y) < exit.height / 2;

  if (isInExit) {
    if (currentLevel < MAX_LEVEL) {
      endGame("단계 클리어!", `${playTime.toFixed(1)}초 만에 출구에 도착했습니다.`, "승리");
    } else {
      endGame("최종 탈출 성공!", `${totalPlayTime.toFixed(1)}초 만에 모든 단계를 클리어했습니다.`, "승리");
    }
  }
}

function updateRender() {
  const angle = Math.atan2(player.lastDirY, player.lastDirX) * 180 / Math.PI;

  playerEl.style.left = `${player.x}px`;
  playerEl.style.top = `${player.y}px`;

  monsterEl.style.left = `${monster.x}px`;
  monsterEl.style.top = `${monster.y}px`;

  exitEl.style.left = `${exit.x}px`;
  exitEl.style.top = `${exit.y}px`;

  flashlightEl.style.left = `${player.x}px`;
  flashlightEl.style.top = `${player.y - 75}px`;
  flashlightEl.style.transform = `rotate(${angle}deg)`;
  flashlightEl.classList.toggle("on", isFlashlightOn);

  batteryFill.style.width = `${battery}%`;
  timeText.textContent = `${levels[currentLevel].name} / ${playTime.toFixed(1)}초`;
}

function isCircleTouchingObstacles(circleX, circleY, radius) {
  return obstacles.some((obstacle) => {
    return isCircleTouchingRect(circleX, circleY, radius, obstacle);
  });
}

function isCircleTouchingRect(circleX, circleY, radius, rect) {
  const closestX = clamp(circleX, rect.x - rect.width / 2, rect.x + rect.width / 2);
  const closestY = clamp(circleY, rect.y - rect.height / 2, rect.y + rect.height / 2);

  const distanceX = circleX - closestX;
  const distanceY = circleY - closestY;

  return distanceX * distanceX + distanceY * distanceY < radius * radius;
}

function isPointBlocked(x, y, padding) {
  return obstacles.some((obstacle) => {
    return (
      x > obstacle.x - obstacle.width / 2 - padding &&
      x < obstacle.x + obstacle.width / 2 + padding &&
      y > obstacle.y - obstacle.height / 2 - padding &&
      y < obstacle.y + obstacle.height / 2 + padding
    );
  });
}

function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
  return (
    Math.abs(x1 - x2) < (w1 + w2) / 2 &&
    Math.abs(y1 - y2) < (h1 + h2) / 2
  );
}

function getMonsterHitRadius() {
  return (monster.size * levels[currentLevel].monsterScale) / 2;
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) {
    event.preventDefault();
  }

  if (!isRunning && event.code === "Space") return;

  keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("resize", () => {
  if (!isRunning) return;

  const { width, height } = getGameSize();

  player.x = clamp(player.x, player.size / 2, width - player.size / 2);
  player.y = clamp(player.y, player.size / 2, height - player.size / 2);
  exit.x = width - 80;
  exit.y = 70;

  createObstacles();
  updateRender();
});

startBtn.addEventListener("click", startGame);
applyLevelVisuals();
updateRender();