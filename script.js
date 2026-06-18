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

const keys = new Set();

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

let battery = 100;
let isFlashlightOn = false;
let wasFlashlightOn = false;
let isRunning = false;
let lastTime = 0;
let playTime = 0;
let animationId = null;
let audioContext = null;

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

function resetGame() {
  const { width, height } = getGameSize();

  player.x = 70;
  player.y = height - 70;
  player.lastDirX = 1;
  player.lastDirY = 0;

  monster.x = width * 0.55;
  monster.y = height * 0.45;

  exit.x = width - 80;
  exit.y = 70;

  battery = 100;
  playTime = 0;
  isFlashlightOn = false;
  wasFlashlightOn = false;
  isRunning = true;
  lastTime = performance.now();

  gameStatus.textContent = "탈출 중";
  messageEl.classList.add("hidden");
  monsterEl.classList.remove("stunned");
  updateRender();
}

function startGame() {
  initAudio();
  cancelAnimationFrame(animationId);
  resetGame();
  animationId = requestAnimationFrame(gameLoop);
}

function endGame(title, description, statusText) {
  isRunning = false;
  cancelAnimationFrame(animationId);

  if (isFlashlightOn) {
    isFlashlightOn = false;
    wasFlashlightOn = false;
    playFlashlightOffSound();
  }

  if (statusText === "승리") {
    playVictorySound();
  }

  if (statusText === "패배") {
    playDefeatSound();
  }

  gameStatus.textContent = statusText;
  messageEl.innerHTML = `
    <h2>${title}</h2>
    <p>${description}</p>
    <button id="restartBtn">다시 시작</button>
  `;
  messageEl.classList.remove("hidden");
  document.getElementById("restartBtn").addEventListener("click", startGame);
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

  player.x += dx * player.speed * delta;
  player.y += dy * player.speed * delta;

  player.x = clamp(player.x, radius, width - radius);
  player.y = clamp(player.y, radius, height - radius);
}

function updateFlashlight(delta) {
  isFlashlightOn = keys.has("Space") && battery > 0;

  if (isFlashlightOn && !wasFlashlightOn) {
    playFlashlightOnSound();
  }

  if (!isFlashlightOn && wasFlashlightOn) {
    playFlashlightOffSound();
  }

  wasFlashlightOn = isFlashlightOn;

  if (isFlashlightOn) {
    battery -= 22 * delta;
  } else {
    battery += 7 * delta;
  }

  battery = clamp(battery, 0, 100);

  if (battery <= 0) {
    endGame("배터리 방전", "어둠이 완전히 삼켜버렸습니다.", "패배");
  }
}

function updateMonster(delta) {
  const stunned = isMonsterInLight();
  monsterEl.classList.toggle("stunned", stunned);

  if (stunned) return;

  const dx = player.x - monster.x;
  const dy = player.y - monster.y;
  const distance = Math.hypot(dx, dy);

  if (distance > 0) {
    monster.x += (dx / distance) * monster.speed * delta;
    monster.y += (dy / distance) * monster.speed * delta;
  }
}

function isMonsterInLight() {
  if (!isFlashlightOn) return false;

  const vx = monster.x - player.x;
  const vy = monster.y - player.y;
  const distance = Math.hypot(vx, vy);

  if (distance > 230) return false;

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
  if (monsterDistance < (player.size + monster.size) / 2) {
    endGame("괴물에게 잡혔다", "손전등 타이밍이 조금 늦었습니다.", "패배");
    return;
  }

  const isInExit =
    Math.abs(player.x - exit.x) < exit.width / 2 &&
    Math.abs(player.y - exit.y) < exit.height / 2;

  if (isInExit) {
    endGame("탈출 성공!", `${playTime.toFixed(1)}초 만에 출구에 도착했습니다.`, "승리");
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
  timeText.textContent = `${playTime.toFixed(1)}초`;
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
  updateRender();
});

startBtn.addEventListener("click", startGame);
updateRender();