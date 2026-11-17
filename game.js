'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const MAX_START_LEVEL = 10;
const TOP_SIZE = 5;
const RESUME_INPUT_LOCK_MS = 200;

const STORAGE = {
  theme: 'tetris-theme',
  skin: 'tetris-skin',
  startLevel: 'tetris-start-level',
  records: 'tetris-records',
  player: 'tetris-player',
};

// ---------- Utilidades de almacenamiento ----------

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* sin almacenamiento disponible */ }
}

// ---------- Utilidades de color ----------

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// amt > 0 mezcla con blanco, amt < 0 mezcla con negro
function shade(hex, amt) {
  const target = amt < 0 ? 0 : 255;
  const t = Math.abs(amt);
  const [r, g, b] = hexToRgb(hex).map(v => Math.round(v + (target - v) * t));
  return `rgb(${r},${g},${b})`;
}

function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function roundRectPath(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

// ---------- Skins ----------
// Cada skin define su paleta (indexada igual que PIECES) y su forma de dibujar un bloque.
// bg/grid a null => se usan las variables CSS del modo claro/oscuro.

const SKINS = {
  retro: {
    name: 'Retro',
    bg: null,
    grid: null,
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d', '#9e9e9e'],
    drawBlock(c, px, py, s, color) {
      c.fillStyle = color;
      c.fillRect(px + 1, py + 1, s - 2, s - 2);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(px + 1, py + 1, s - 2, 4);
    },
  },
  neon: {
    name: 'Neon',
    bg: '#000000',
    grid: '#0e0e18',
    colors: [null, '#00f0ff', '#fff200', '#d000ff', '#39ff14', '#ff073a', '#4d7cff', '#ff8c00', '#d0d0d0'],
    drawBlock(c, px, py, s, color) {
      const inset = 3;
      c.shadowColor = color;
      c.shadowBlur = s * 0.5;
      c.fillStyle = rgba(color, 0.22);
      c.fillRect(px + inset, py + inset, s - inset * 2, s - inset * 2);
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.strokeRect(px + inset, py + inset, s - inset * 2, s - inset * 2);
    },
  },
  pastel: {
    name: 'Pastel',
    bg: '#fbf6f1',
    grid: '#efe5dc',
    colors: [null, '#a8e6f0', '#fff0a0', '#d9c2f0', '#bfe8c4', '#f7b8b8', '#b8d4f7', '#ffd3a8', '#d8d2da'],
    drawBlock(c, px, py, s, color) {
      const r = s * 0.28;
      roundRectPath(c, px + 2, py + 2, s - 4, s - 4, r);
      c.fillStyle = color;
      c.fill();
      c.lineWidth = 1.5;
      c.strokeStyle = shade(color, -0.18);
      c.stroke();
      roundRectPath(c, px + 6, py + 5, s - 12, s * 0.2, r * 0.4);
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fill();
    },
  },
  pixel: {
    name: 'Pixel art',
    bg: '#101020',
    grid: '#1c1c34',
    colors: [null, '#3cbcfc', '#f8d878', '#b85cf8', '#58d854', '#f83800', '#6888fc', '#fca044', '#a4a4a4'],
    drawBlock(c, px, py, s, color) {
      const p = Math.max(1, Math.floor(s / 10));
      const inner = s - p * 2;
      // contorno
      c.fillStyle = shade(color, -0.55);
      c.fillRect(px, py, s, s);
      // cuerpo
      c.fillStyle = color;
      c.fillRect(px + p, py + p, inner, inner);
      // bisel claro arriba/izquierda
      c.fillStyle = shade(color, 0.4);
      c.fillRect(px + p, py + p, inner, p);
      c.fillRect(px + p, py + p, p, inner);
      // bisel oscuro abajo/derecha
      c.fillStyle = shade(color, -0.3);
      c.fillRect(px + p, py + s - p * 2, inner, p);
      c.fillRect(px + s - p * 2, py + p, p, inner);
      // textura de dither
      c.fillStyle = shade(color, -0.15);
      for (let i = 3; i < 8; i++)
        for (let j = 3; j < 8; j++)
          if ((i + j) % 3 === 0) c.fillRect(px + i * p, py + j * p, p, p);
      // brillo
      c.fillStyle = '#ffffff';
      c.fillRect(px + p * 2, py + p * 2, p, p);
    },
  },
};

let skin = SKINS.retro;
let COLORS = skin.colors;

// ---------- DOM ----------

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const recordBadge = document.getElementById('record-badge');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const playBtn = document.getElementById('play-btn');
const resumeBtn = document.getElementById('resume-btn');
const restartBtn = document.getElementById('restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const menuBtn = document.getElementById('menu-btn');
const controlsList = document.getElementById('controls-list');
const levelSelect = document.getElementById('level-select');
const skinSelect = document.getElementById('skin-select');
const recordsBody = document.getElementById('records-body');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');

// ---------- Estado ----------

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let started = false;
let startLevel = 1;
let gameStartLevel = 1;
let combo = 0;
let maxCombo = 0;
let inputLockUntil = 0;
let records;
let lastEntryId = null;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function speedFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.max(gameStartLevel, Math.floor(lines / 10) + 1);
    dropInterval = speedFor(level);
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// ---------- Render ----------

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.save();
  context.globalAlpha = alpha ?? 1;
  skin.drawBlock(context, x * size, y * size, size, COLORS[colorIndex]);
  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = skin.grid || getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (!current) return;

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!next) return;
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function applySkin(id) {
  if (!SKINS[id]) id = 'retro';
  skin = SKINS[id];
  COLORS = skin.colors;
  canvas.style.background = skin.bg || '';
  nextCanvas.style.background = skin.bg || '';
  document.body.dataset.skin = id;
  skinSelect.value = id;
  storageSet(STORAGE.skin, id);
  draw();
  drawNext();
}

// ---------- Récords ----------

function emptyRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  try {
    const data = JSON.parse(storageGet(STORAGE.records));
    if (!data || !Array.isArray(data.top)) return emptyRecords();
    return {
      top: data.top
        .filter(e => e && Number.isFinite(e.score))
        .map(e => ({
          id: e.id,
          name: String(e.name ?? 'Jugador').slice(0, 12),
          score: e.score,
          lines: Number(e.lines) || 0,
          level: Number(e.level) || 1,
          combo: Number(e.combo) || 0,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_SIZE),
      bestCombo: Number(data.bestCombo) || 0,
      maxLines: Number(data.maxLines) || 0,
    };
  } catch {
    return emptyRecords();
  }
}

function saveRecords() {
  storageSet(STORAGE.records, JSON.stringify(records));
}

// Registra la partida terminada. Devuelve el puesto (1..TOP_SIZE) o 0 si no entra en el top.
function recordGame() {
  records.bestCombo = Math.max(records.bestCombo, maxCombo);
  records.maxLines = Math.max(records.maxLines, lines);
  lastEntryId = null;
  let rank = 0;
  if (score > 0) {
    const entry = {
      id: Date.now(),
      name: storageGet(STORAGE.player) || 'Jugador',
      score, lines, level, combo: maxCombo,
    };
    records.top.push(entry);
    records.top.sort((a, b) => b.score - a.score);
    records.top = records.top.slice(0, TOP_SIZE);
    rank = records.top.indexOf(entry) + 1;
    if (rank) lastEntryId = entry.id;
  }
  saveRecords();
  return rank;
}

function renderRecords() {
  recordsBody.replaceChildren();
  if (!records.top.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'records-empty';
    td.textContent = 'Aún no hay récords';
    tr.append(td);
    recordsBody.append(tr);
  }
  records.top.forEach((e, i) => {
    const tr = document.createElement('tr');
    if (e.id === lastEntryId) tr.className = 'highlight';
    for (const value of [i + 1, e.name, e.score.toLocaleString(), e.lines, e.level]) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.append(td);
    }
    recordsBody.append(tr);
  });
  bestComboEl.textContent = records.bestCombo;
  maxLinesEl.textContent = records.maxLines;
}

// ---------- Overlay / menús ----------

function setControlsVisible(visible) {
  controlsList.classList.toggle('hidden', !visible);
  controlsBtn.setAttribute('aria-expanded', String(visible));
  controlsBtn.textContent = visible ? 'Ocultar controles' : 'Ver controles';
}

function showOverlay(mode, rank = 0) {
  overlay.dataset.mode = mode;
  setControlsVisible(false);
  recordBadge.classList.add('hidden');
  nameForm.classList.add('hidden');

  if (mode === 'start') {
    overlayTitle.textContent = 'NUEVA PARTIDA';
  } else if (mode === 'pause') {
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  } else if (mode === 'gameover') {
    overlayTitle.textContent = 'GAME OVER';
    overlayScore.textContent =
      `Puntuación: ${score.toLocaleString()} · Líneas: ${lines} · Combo máx.: ${maxCombo}`;
    if (rank) {
      recordBadge.textContent = rank === 1 ? '¡Nuevo mejor récord!' : `¡Nuevo récord! Puesto #${rank}`;
      recordBadge.classList.remove('hidden');
      nameForm.classList.remove('hidden');
      nameInput.value = storageGet(STORAGE.player) || '';
    }
  }

  renderRecords();
  overlay.classList.remove('hidden');

  if (mode === 'gameover') {
    // No se enfoca un botón: el Espacio del hard drop que acabó la partida podría activarlo al soltarse
    if (rank) {
      nameInput.focus();
      nameInput.select();
    } else if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  } else {
    (mode === 'start' ? playBtn : resumeBtn).focus();
  }
}

function hideOverlay() {
  overlay.classList.add('hidden');
  // Evita que Espacio/flechas activen un botón o select del menú al volver al juego
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

function pauseGame() {
  if (!started || gameOver || paused) return;
  paused = true;
  cancelAnimationFrame(animId);
  showOverlay('pause');
}

function resumeGame() {
  if (!paused) return;
  paused = false;
  hideOverlay();
  freshKeys.clear();
  inputLockUntil = performance.now() + RESUME_INPUT_LOCK_MS;
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function togglePause() {
  if (paused) resumeGame();
  else pauseGame();
}

function goToMenu() {
  cancelAnimationFrame(animId);
  started = false;
  paused = false;
  gameOver = false;
  lastEntryId = null;
  showOverlay('start');
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  const rank = recordGame();
  showOverlay('gameover', rank);
}

// ---------- Bucle ----------

function loop(ts) {
  const dt = Math.max(0, ts - lastTime);
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  cancelAnimationFrame(animId);
  board = createBoard();
  score = 0;
  lines = 0;
  level = gameStartLevel = startLevel;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  started = true;
  lastEntryId = null;
  dropInterval = speedFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  inputLockUntil = lastTime + RESUME_INPUT_LOCK_MS;
  next = randomPiece();
  spawn();
  updateHUD();
  hideOverlay();
  freshKeys.clear();
  animId = requestAnimationFrame(loop);
}

// ---------- Entrada ----------

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'KeyX', 'Space']);
// Teclas pulsadas desde la última vuelta al juego: las repeticiones de teclas que ya
// estaban mantenidas en el menú se ignoran hasta que se suelten y se vuelvan a pulsar.
const freshKeys = new Set();

document.addEventListener('keyup', e => freshKeys.delete(e.code));

document.addEventListener('keydown', e => {
  const typing = e.target instanceof HTMLInputElement;

  if (e.code === 'Escape' || (e.code === 'KeyP' && !typing)) {
    if (started && !gameOver) {
      e.preventDefault();
      togglePause();
    }
    return;
  }

  // Menú abierto (inicio, pausa o game over): el juego no recibe teclas
  if (!started || paused || gameOver) return;

  if (GAME_KEYS.has(e.code)) e.preventDefault();
  // Breve bloqueo tras reanudar/empezar para evitar movimientos accidentales
  if (performance.now() < inputLockUntil) return;
  if (e.repeat && !freshKeys.has(e.code)) return;
  freshKeys.add(e.code);

  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      hardDrop();
      break;
  }
  updateHUD();
});

playBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', resumeGame);
menuBtn.addEventListener('click', goToMenu);
controlsBtn.addEventListener('click', () => {
  setControlsVisible(controlsList.classList.contains('hidden'));
});

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = nameInput.value.trim().slice(0, 12) || 'Jugador';
  const entry = records.top.find(r => r.id === lastEntryId);
  if (entry) {
    entry.name = name;
    saveRecords();
  }
  storageSet(STORAGE.player, name);
  nameForm.classList.add('hidden');
  renderRecords();
  restartBtn.focus();
});

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los récords?')) return;
  records = emptyRecords();
  lastEntryId = null;
  saveRecords();
  renderRecords();
});

for (let l = 1; l <= MAX_START_LEVEL; l++) levelSelect.add(new Option(String(l), String(l)));
levelSelect.addEventListener('change', () => {
  startLevel = Number(levelSelect.value);
  storageSet(STORAGE.startLevel, String(startLevel));
});

for (const [id, s] of Object.entries(SKINS)) skinSelect.add(new Option(s.name, id));
skinSelect.addEventListener('change', () => applySkin(skinSelect.value));

// ---------- Tema claro/oscuro ----------

const themeToggle = document.getElementById('theme-toggle');
const toggleIcon = themeToggle.querySelector('.toggle-icon');
const toggleLabel = themeToggle.querySelector('.toggle-label');

function applyTheme(isLight) {
  if (isLight) {
    document.body.classList.add('light-mode');
    toggleIcon.textContent = '☀';
    toggleLabel.textContent = 'DARK';
  } else {
    document.body.classList.remove('light-mode');
    toggleIcon.textContent = '☾';
    toggleLabel.textContent = 'LIGHT';
  }
}

applyTheme(storageGet(STORAGE.theme) === 'light');

themeToggle.addEventListener('click', () => {
  const isLight = !document.body.classList.contains('light-mode');
  applyTheme(isLight);
  storageSet(STORAGE.theme, isLight ? 'light' : 'dark');
  themeToggle.blur();
  if (paused || !started || gameOver) draw();
});

// ---------- Arranque: pantalla de inicio ----------

const savedLevel = Number(storageGet(STORAGE.startLevel));
startLevel = savedLevel >= 1 && savedLevel <= MAX_START_LEVEL ? savedLevel : 1;
levelSelect.value = String(startLevel);
records = loadRecords();
board = createBoard();
current = null;
next = null;
score = 0;
lines = 0;
level = startLevel;
updateHUD();
applySkin(storageGet(STORAGE.skin));
showOverlay('start');
