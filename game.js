'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
];

// Paletas del resto de skins, con el mismo orden que COLORS (I, O, T, S, Z, J, L)
const NEON_COLORS = [null, '#00f0ff', '#fff200', '#d94bff', '#39ff14', '#ff2a55', '#5c8dff', '#ff9100'];
const PASTEL_COLORS = [null, '#9fdfe8', '#ffe08a', '#cdb0ee', '#aee0b0', '#f6a9b0', '#a9c4f5', '#ffc59e'];
const PIXEL_COLORS = [null, '#22b8e6', '#f2c81c', '#9b4fd6', '#45b845', '#dc3f3b', '#7ba3ee', '#ee8422'];

// Cada skin define su paleta, la opacidad de la pieza fantasma y la función que
// pinta un bloque a partir de su esquina superior izquierda. El resto del aspecto
// de la página se define en style.css con [data-skin="..."].
const SKINS = {
  retro:  { colors: COLORS,        ghostAlpha: 0.2, paint: paintRetro },
  neon:   { colors: NEON_COLORS,   ghostAlpha: 0.5, paint: paintNeon, forceDark: true },
  pastel: { colors: PASTEL_COLORS, ghostAlpha: 0.35, paint: paintPastel },
  pixel:  { colors: PIXEL_COLORS,  ghostAlpha: 0.3, paint: paintPixel },
};

// Textura del skin pixel art: l = luz, w = brillo, s = moteado, d = sombra
const PIXEL_PATTERN = [
  'llllllllld',
  'lww.....sd',
  'lw...s...d',
  'l..s...l.d',
  'l.....s..d',
  'l.s.l....d',
  'l......s.d',
  'l..s.....d',
  'ls....s.sd',
  'dddddddddd',
];
const PIXEL_TONES = {
  l: 'rgba(255,255,255,0.35)',
  w: 'rgba(255,255,255,0.7)',
  s: 'rgba(0,0,0,0.18)',
  d: 'rgba(0,0,0,0.4)',
};
const pixelTiles = new Map(); // un mosaico pre-renderizado por color y tamaño

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const MAX_START_LEVEL = 10;
const PAUSE_KEYS = ['KeyP', 'Escape'];
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'KeyX', 'Space'];

const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;
const MAX_NAME_LENGTH = 12;
const DEFAULT_NAME = 'Anónimo';

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
const restartBtn = document.getElementById('restart-btn');
const resumeBtn = document.getElementById('resume-btn');
const pauseOptions = document.getElementById('pause-options');
const controlsBtn = document.getElementById('controls-btn');
const controlsList = document.getElementById('controls-list');
const startLevelSelect = document.getElementById('start-level');
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const startRecordsEl = document.getElementById('start-records');
const gameOverPanel = document.getElementById('game-over-panel');
const overRecordsEl = document.getElementById('over-records');
const recordMessage = document.getElementById('record-message');
const recordForm = document.getElementById('record-form');
const nameInput = document.getElementById('player-name');
const resetRecordsBtns = document.querySelectorAll('.reset-records-btn');
const storageWarnings = document.querySelectorAll('.storage-warning');

// Teclas de juego pulsadas desde que la partida se (re)anudó
const activeKeys = new Set();

let board, current, next, score, lines, level, startLevel, paused, gameOver, lastTime, dropAccum, dropInterval, animId, started, combo, pendingScore, highlightIndex, skin;

/* ---- Records (localStorage) ---- */

// Copia en memoria: es la única disponible si localStorage falla.
let memoryRecords = emptyRecords();
let storageFailed = false;

function emptyRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function sanitizeName(value) {
  const text = typeof value === 'string' ? value : '';
  const clean = text.replace(/[\p{Cc}\p{Bidi_Control}]/gu, '').trim();
  return Array.from(clean).slice(0, MAX_NAME_LENGTH).join('').trim() || DEFAULT_NAME;
}

function toCount(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

// Nunca se confía en lo almacenado: puede estar corrupto o editado a mano.
function sanitizeRecords(data) {
  const top = (Array.isArray(data?.top) ? data.top : [])
    .filter(entry => toCount(entry?.score) > 0)
    .map(entry => ({ name: sanitizeName(entry.name), score: entry.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECORDS);
  return { top, bestCombo: toCount(data?.bestCombo), maxLines: toCount(data?.maxLines) };
}

function readRecords() {
  if (storageFailed) return memoryRecords;
  let raw;
  try {
    raw = localStorage.getItem(RECORDS_KEY);
  } catch (e) {
    storageFailed = true;
    return memoryRecords;
  }
  try {
    memoryRecords = sanitizeRecords(JSON.parse(raw));
  } catch (e) {
    memoryRecords = emptyRecords(); // JSON corrupto
  }
  return memoryRecords;
}

function writeRecords(records) {
  memoryRecords = records;
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (e) {
    storageFailed = true;
  }
}

// Posición (0-4) que ocuparía la puntuación, o -1 si no entra en el top.
// En caso de empate conserva el puesto el record más antiguo.
function rankFor(top, points) {
  if (points <= 0) return -1;
  const index = top.findIndex(entry => points > entry.score);
  const rank = index === -1 ? top.length : index;
  return rank < MAX_RECORDS ? rank : -1;
}

function insertEntry(top, rank, entry) {
  return [...top.slice(0, rank), entry, ...top.slice(rank)].slice(0, MAX_RECORDS);
}

function updateBests(gameCombo, gameLines) {
  const records = readRecords();
  if (gameCombo <= records.bestCombo && gameLines <= records.maxLines) return;
  writeRecords({
    ...records,
    bestCombo: Math.max(records.bestCombo, gameCombo),
    maxLines: Math.max(records.maxLines, gameLines),
  });
}

// Guarda la puntuación pendiente (si la hay). Solo puede ocurrir una vez por partida.
function commitPending() {
  if (!pendingScore) return;
  const entry = { name: sanitizeName(nameInput.value), score: pendingScore };
  pendingScore = null;
  const records = readRecords();
  const rank = rankFor(records.top, entry.score);
  if (rank >= 0) writeRecords({ ...records, top: insertEntry(records.top, rank, entry) });
  highlightIndex = rank;
  nameInput.blur();
  recordForm.classList.add('hidden');
  recordMessage.textContent = rank >= 0
    ? `Record guardado en el puesto #${rank + 1}`
    : 'La puntuación ya no entra en el top 5';
  renderRecords();
}

function resetRecords() {
  const note = pendingScore ? ' La puntuación de esta partida, aún sin guardar, se conserva.' : '';
  if (!window.confirm(`¿Seguro que quieres borrar todos los records? No se puede deshacer.${note}`)) return;
  writeRecords(emptyRecords());
  highlightIndex = -1;
  recordMessage.textContent = '';
  renderRecords();
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function fillRecords(container, { top, bestCombo, maxLines }, highlight) {
  let list;
  if (top.length) {
    list = createEl('ol', 'records-list');
    top.forEach((entry, i) => {
      const item = createEl('li', i === highlight ? 'highlight' : '');
      item.append(
        createEl('span', 'record-rank', `${i + 1}.`),
        createEl('span', 'record-name', entry.name),
        createEl('span', 'record-score', entry.score.toLocaleString()),
      );
      list.append(item);
    });
  } else {
    list = createEl('p', 'records-empty', 'Todavía no hay records');
  }

  const stats = createEl('dl', 'records-stats');
  for (const [label, value] of [['Mejor combo', bestCombo], ['Líneas máximas', maxLines]]) {
    const stat = createEl('div');
    stat.append(createEl('dt', 'label', label.toUpperCase()), createEl('dd', '', value.toLocaleString()));
    stats.append(stat);
  }

  container.replaceChildren(createEl('p', 'label', `TOP ${MAX_RECORDS}`), list, stats);
}

function renderRecords() {
  const records = readRecords();
  fillRecords(startRecordsEl, records, -1);

  // Mientras no se guarda, la tabla de game over muestra dónde quedaría la puntuación.
  const rank = pendingScore ? rankFor(records.top, pendingScore) : -1;
  if (rank >= 0) {
    const preview = { name: sanitizeName(nameInput.value), score: pendingScore };
    fillRecords(overRecordsEl, { ...records, top: insertEntry(records.top, rank, preview) }, rank);
    recordMessage.textContent = `¡Nuevo record! Entras en el puesto #${rank + 1}`;
  } else {
    fillRecords(overRecordsEl, records, highlightIndex);
  }

  const empty = !records.top.length && !records.bestCombo && !records.maxLines;
  resetRecordsBtns.forEach(btn => { btn.disabled = empty; });
  storageWarnings.forEach(el => el.classList.toggle('hidden', !storageFailed));
}

/* ---- Juego ---- */

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
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
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = speedFor(level);
    updateHUD();
  }
  return cleared;
}

function speedFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
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
  const cleared = clearLines();
  // Combo: piezas consecutivas fijadas que limpian al menos una línea.
  combo = cleared ? combo + 1 : 0;
  if (cleared) updateBests(combo, lines);
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

function drawBlock(context, x, y, colorIndex, size, ghost = false) {
  if (!colorIndex) return;
  // save/restore evita que shadowBlur, globalAlpha, etc. afecten a otros dibujos
  context.save();
  context.globalAlpha = ghost ? skin.ghostAlpha : 1;
  skin.paint(context, x * size, y * size, size, skin.colors[colorIndex], ghost);
  context.restore();
}

function paintRetro(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

function paintNeon(context, px, py, size, color, ghost) {
  context.shadowColor = color;
  context.shadowBlur = ghost ? 6 : 14;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 3, py + 3, size - 6, size - 6);
  if (ghost) return;
  context.shadowBlur = 0;
  context.globalAlpha = 0.35;
  context.fillStyle = color;
  context.fillRect(px + 4, py + 4, size - 8, size - 8);
  // núcleo claro del tubo
  context.globalAlpha = 0.6;
  context.strokeStyle = '#ffffff';
  context.lineWidth = 0.5;
  context.strokeRect(px + 3, py + 3, size - 6, size - 6);
}

function roundedRectPath(context, x, y, w, h, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + w, y, x + w, y + h, radius);
  context.arcTo(x + w, y + h, x, y + h, radius);
  context.arcTo(x, y + h, x, y, radius);
  context.arcTo(x, y, x + w, y, radius);
  context.closePath();
}

function paintPastel(context, px, py, size, color, ghost) {
  roundedRectPath(context, px + 1.5, py + 1.5, size - 3, size - 3, 8);
  context.fillStyle = color;
  context.fill();
  if (ghost) {
    context.globalAlpha = 1;
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.stroke();
    return;
  }
  context.strokeStyle = 'rgba(0,0,0,0.12)';
  context.lineWidth = 1;
  context.stroke();
  // brillo suave
  roundedRectPath(context, px + 5, py + 4, size - 10, 7, 3.5);
  context.fillStyle = 'rgba(255,255,255,0.45)';
  context.fill();
}

function getPixelTile(color, size) {
  const key = `${color}-${size}`;
  let tile = pixelTiles.get(key);
  if (tile) return tile;
  tile = document.createElement('canvas');
  tile.width = tile.height = size;
  const tileCtx = tile.getContext('2d');
  const dot = size / PIXEL_PATTERN.length;
  tileCtx.fillStyle = color;
  tileCtx.fillRect(0, 0, size, size);
  for (let r = 0; r < PIXEL_PATTERN.length; r++) {
    for (let c = 0; c < PIXEL_PATTERN[r].length; c++) {
      const tone = PIXEL_TONES[PIXEL_PATTERN[r][c]];
      if (!tone) continue;
      tileCtx.fillStyle = tone;
      tileCtx.fillRect(c * dot, r * dot, dot, dot);
    }
  }
  pixelTiles.set(key, tile);
  return tile;
}

function paintPixel(context, px, py, size, color) {
  context.drawImage(getPixelTile(color, size), px, py);
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || '#22222e';
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

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, true);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  updateHUD();
  const isRecord = rankFor(readRecords().top, score) >= 0;
  pendingScore = isRecord ? score : null;
  highlightIndex = -1;
  nameInput.value = '';
  recordMessage.textContent = '';
  recordForm.classList.toggle('hidden', !isRecord);
  renderRecords();
  showOverlay('GAME OVER', `Puntuación: ${score.toLocaleString()}`, false);
  if (isRecord) nameInput.focus();
}

function setControlsVisible(visible) {
  controlsList.hidden = !visible;
  controlsBtn.setAttribute('aria-expanded', String(visible));
  controlsBtn.textContent = visible ? 'Ocultar controles' : 'Ver controles';
}

function showOverlay(title, detail, isPauseMenu) {
  overlayTitle.textContent = title;
  overlayScore.textContent = detail;
  resumeBtn.hidden = !isPauseMenu;
  pauseOptions.hidden = !isPauseMenu;
  gameOverPanel.classList.toggle('hidden', isPauseMenu);
  setControlsVisible(false);
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  // sin foco residual: Space/Enter/flechas no deben actuar sobre el menú oculto
  if (overlay.contains(document.activeElement)) document.activeElement.blur();
  overlay.classList.add('hidden');
}

function togglePause() {
  if (!started || gameOver) return;
  paused = !paused;
  activeKeys.clear();
  if (!paused) {
    hideOverlay();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showOverlay('PAUSA', '', true);
  }
}

function loop(ts) {
  const dt = ts - lastTime;
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
  draw();
  // lockPiece puede terminar la partida dentro de este mismo frame
  if (!gameOver) animId = requestAnimationFrame(loop);
}

function init() {
  commitPending(); // reiniciar sin pulsar "Guardar" no pierde el record
  started = true;
  combo = 0;
  highlightIndex = -1;
  board = createBoard();
  score = 0;
  lines = 0;
  startLevel = Number(startLevelSelect.value);
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = speedFor(level);
  dropAccum = 0;
  activeKeys.clear();
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  startScreen.classList.add('hidden');
  hideOverlay();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return; // escribiendo el nombre
  if (e.ctrlKey || e.metaKey || e.altKey) return; // atajos del navegador
  if (e.target.tagName === 'BUTTON' && ['Space', 'Enter', 'NumpadEnter'].includes(e.code)) {
    if (e.repeat) e.preventDefault(); // una tecla mantenida no repite la acción
    if (!started || paused || gameOver) return; // activación normal del botón
    if (e.code === 'Space') e.target.blur(); // en partida, Space es caída y no pulsa el botón
  }
  if (!started) return;
  if (PAUSE_KEYS.includes(e.code)) {
    e.preventDefault();
    if (!e.repeat) togglePause();
    return;
  }
  // Con el menú abierto las teclas quedan para el propio menú (Tab, selector, botones)
  if (paused || gameOver || !GAME_KEYS.includes(e.code)) return;
  e.preventDefault();
  // Una tecla mantenida desde antes de (re)anudar no actúa hasta volver a pulsarla
  if (!e.repeat) activeKeys.add(e.code);
  else if (!activeKeys.has(e.code)) return;
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

[startBtn, restartBtn].forEach(btn => btn.addEventListener('click', () => {
  btn.blur(); // evita que Space/Enter vuelvan a activar el botón
  init();
}));

resumeBtn.addEventListener('click', togglePause);
controlsBtn.addEventListener('click', e => {
  setControlsVisible(controlsList.hidden);
  if (e.detail) controlsBtn.blur(); // solo con ratón; con teclado se conserva el foco
});

for (let n = 1; n <= MAX_START_LEVEL; n++) {
  startLevelSelect.add(new Option(n, n));
}

resetRecordsBtns.forEach(btn => btn.addEventListener('click', () => {
  btn.blur();
  resetRecords();
}));

recordForm.addEventListener('submit', e => {
  e.preventDefault();
  commitPending();
});

nameInput.addEventListener('input', renderRecords);

nameInput.addEventListener('keydown', e => {
  // Un Space pulsado para la caída justo al perder no debe colarse en el nombre.
  if (e.code === 'Space' && !nameInput.value) e.preventDefault();
});

// Cerrar o recargar la página tampoco pierde un record sin guardar.
window.addEventListener('pagehide', commitPending);

const themeBtn = document.getElementById('theme-toggle');
const skinButtons = document.querySelectorAll('#skin-selector button');

// Redibuja los canvas al momento, también en pausa o game over
function redraw() {
  if (current && next) {
    draw();
    drawNext();
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
  }
}

// Un skin con forceDark ignora el tema claro sin borrar la preferencia guardada
function updateThemeButton() {
  const forced = Boolean(skin.forceDark);
  const light = !forced && document.documentElement.dataset.theme === 'light';
  themeBtn.disabled = forced;
  themeBtn.title = forced ? 'Este skin usa siempre fondo negro' : '';
  themeBtn.setAttribute('aria-pressed', String(light));
  themeBtn.textContent = light ? '☀️ Claro' : '🌙 Oscuro';
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch (e) { /* sin almacenamiento */ }
  updateThemeButton();
  redraw();
}

function setSkin(name) {
  const id = Object.hasOwn(SKINS, name) ? name : 'retro';
  skin = SKINS[id];
  document.documentElement.dataset.skin = id;
  try { localStorage.setItem('skin', id); } catch (e) { /* sin almacenamiento */ }
  skinButtons.forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.skinOption === id)));
  updateThemeButton();
  redraw();
}

themeBtn.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeBtn.blur(); // evita que Space/Enter vuelvan a activar el botón
});

skinButtons.forEach(btn => btn.addEventListener('click', () => {
  setSkin(btn.dataset.skinOption);
  btn.blur(); // evita que Space/Enter vuelvan a activar el botón
}));

setSkin(document.documentElement.dataset.skin);
setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

renderRecords(); // la partida empieza al pulsar "Jugar" en la pantalla de inicio
