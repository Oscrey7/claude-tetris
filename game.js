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
const startScreen = document.getElementById('start-screen');
const startRecords = document.getElementById('start-records');
const playBtn = document.getElementById('play-btn');
const startResetBtn = document.getElementById('start-reset-btn');
const gameoverRecords = document.getElementById('gameover-records');
const recordMsg = document.getElementById('record-msg');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const overRecords = document.getElementById('over-records');
const overResetBtn = document.getElementById('over-reset-btn');

const RECORDS_KEY = 'tetris-records';
const LAST_NAME_KEY = 'lastName';
const MAX_RECORDS = 5;
const MAX_NAME = 12;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, combo, maxCombo, pendingRecord;

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
  combo = cleared ? combo + 1 : 0;
  maxCombo = Math.max(maxCombo, combo);
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
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

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
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

  // antes de la primera partida solo hay tablero
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
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

// ---- Récords ----

function toCount(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

// Siempre devuelve una estructura válida, aunque lo guardado esté corrupto
function loadRecords() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(RECORDS_KEY)); } catch (e) { /* sin almacenamiento o JSON corrupto */ }
  const top = (Array.isArray(data?.top) ? data.top : [])
    .filter(entry => entry && Number.isFinite(entry.score))
    .map(entry => ({
      name: typeof entry.name === 'string' ? entry.name.slice(0, MAX_NAME) : 'Anónimo',
      score: toCount(entry.score),
      lines: toCount(entry.lines),
      level: toCount(entry.level),
      combo: toCount(entry.combo),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECORDS);
  return { top, bestCombo: toCount(data?.bestCombo), maxLines: toCount(data?.maxLines) };
}

// Devuelve false si no se ha podido persistir
function saveRecords(records) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    return true;
  } catch (e) {
    return false;
  }
}

function addStats(records, gameCombo, gameLines) {
  records.bestCombo = Math.max(records.bestCombo, gameCombo);
  records.maxLines = Math.max(records.maxLines, gameLines);
}

function createRow(cellTag, values) {
  const row = document.createElement('tr');
  for (const value of values) {
    const cell = document.createElement(cellTag);
    cell.textContent = value;
    row.appendChild(cell);
  }
  return row;
}

// Los nombres son texto del usuario: se insertan solo con textContent
function renderRecords(container, records, highlight) {
  let list;
  if (records.top.length) {
    list = document.createElement('table');
    list.className = 'records-table';
    list.createTHead().appendChild(createRow('th', ['#', 'Nombre', 'Puntos', 'Líneas', 'Nivel', 'Combo']));
    const body = list.createTBody();
    records.top.forEach((entry, i) => {
      const row = createRow('td', [i + 1, entry.name, entry.score.toLocaleString(), entry.lines, entry.level, entry.combo]);
      if (entry === highlight) row.className = 'current';
      body.appendChild(row);
    });
  } else {
    list = document.createElement('p');
    list.className = 'records-empty';
    list.textContent = 'Aún no hay récords';
  }
  const stats = document.createElement('p');
  stats.className = 'records-stats';
  stats.textContent = `Mejor combo: ${records.bestCombo} · Líneas máximas: ${records.maxLines}`;
  container.replaceChildren(list, stats);
}

function qualifies(records, points) {
  const { top } = records;
  return points > 0 && (top.length < MAX_RECORDS || points > top[MAX_RECORDS - 1].score);
}

function recordMessage(records, points) {
  const isBest = !records.top.length || points > records.top[0].score;
  return isBest ? '¡Nuevo récord!' : `¡Entras en el top ${MAX_RECORDS}!`;
}

function showGameOverRecords() {
  const records = loadRecords();
  // combo y líneas se registran aunque la puntuación no entre en el top
  addStats(records, maxCombo, lines);
  saveRecords(records);

  pendingRecord = qualifies(records, score) ? { score, lines, level, combo: maxCombo } : null;
  recordMsg.textContent = pendingRecord ? recordMessage(records, score) : '';
  if (pendingRecord) {
    let lastName = '';
    try { lastName = localStorage.getItem(LAST_NAME_KEY) || ''; } catch (e) { /* sin almacenamiento */ }
    nameInput.value = lastName.slice(0, MAX_NAME);
  }
  nameForm.hidden = !pendingRecord;
  renderRecords(overRecords, records);
  gameoverRecords.hidden = false;
  gameoverRecords.closest('.overlay-box').classList.add('records-card');
}

function hideGameOverRecords() {
  gameoverRecords.hidden = true;
  gameoverRecords.closest('.overlay-box').classList.remove('records-card');
}

function submitRecord(e) {
  e.preventDefault();
  if (!pendingRecord) return;
  const name = nameInput.value.trim();
  if (name) {
    try { localStorage.setItem(LAST_NAME_KEY, name); } catch (err) { /* sin almacenamiento */ }
  }

  const entry = { name: name || 'Anónimo', ...pendingRecord };
  const records = loadRecords();
  records.top.push(entry);
  records.top.sort((a, b) => b.score - a.score);
  records.top.splice(MAX_RECORDS);
  addStats(records, entry.combo, entry.lines);
  const saved = saveRecords(records);

  pendingRecord = null;
  nameInput.blur();
  nameForm.hidden = true;
  if (!saved) {
    recordMsg.textContent = 'No se pudo guardar el récord';
  } else if (!records.top.includes(entry)) {
    // otra pestaña pudo llenar el top mientras se escribía el nombre
    recordMsg.textContent = 'La puntuación ya no entra en el top';
  } else {
    recordMsg.textContent = '¡Récord guardado!';
  }
  renderRecords(overRecords, records, entry);
}

function resetRecords(e) {
  e.currentTarget.blur();
  if (!confirm('¿Borrar todos los récords?')) return;
  try { localStorage.removeItem(RECORDS_KEY); } catch (err) { /* sin almacenamiento */ }
  const records = loadRecords();
  renderRecords(startRecords, records);
  renderRecords(overRecords, records);
  // una puntuación aún sin guardar se puede seguir guardando
  recordMsg.textContent = pendingRecord ? recordMessage(records, pendingRecord.score) : '';
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  showGameOverRecords();
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
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
      // endGame() ya se ejecutó dentro de este frame: no dibujar ni programar otro
      if (gameOver) return;
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  maxCombo = 0;
  pendingRecord = null;
  startScreen.classList.add('hidden');
  hideGameOverRecords();
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // sin partida iniciada, o escribiendo el nombre: no son teclas de juego
  if (!current || e.target === nameInput) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
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
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => {
  if (pendingRecord && !confirm('No has guardado tu récord. ¿Reiniciar de todos modos?')) return;
  init();
});
playBtn.addEventListener('click', () => {
  playBtn.blur();
  init();
});
nameForm.addEventListener('submit', submitRecord);
startResetBtn.addEventListener('click', resetRecords);
overResetBtn.addEventListener('click', resetRecords);

const themeBtn = document.getElementById('theme-toggle');

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch (e) { /* sin almacenamiento */ }
  const light = theme === 'light';
  themeBtn.setAttribute('aria-pressed', String(light));
  themeBtn.textContent = light ? '☀️ Claro' : '🌙 Oscuro';
  if (board) draw();
  if (next) drawNext();
}

themeBtn.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeBtn.blur(); // evita que Space/Enter vuelvan a activar el botón
});

setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

// pantalla de inicio: tablero vacío de fondo hasta pulsar "Jugar"
board = createBoard();
draw();
renderRecords(startRecords, loadRecords());
