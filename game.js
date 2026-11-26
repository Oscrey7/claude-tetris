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

// ---- Skins ----
// Cada skin pinta un bloque a partir de su esquina (px, py) en píxeles.
// `boardBg` y `grid` a null usan las variables CSS del tema claro/oscuro.
// Un `boardBg` propio debe repetirse en style.css para [data-skin].
// `colors` se indexa por tipo de pieza (1–7), igual que PIECES.
// Un skin nuevo debe añadirse también a la lista del <script> de index.html.
function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    name: 'Retro',
    colors: COLORS,
    boardBg: null,
    grid: null,
    drawBlock(context, px, py, size, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },
  neon: {
    name: 'Neon',
    colors: [null, '#00fff0', '#fff200', '#d400ff', '#39ff14', '#ff1744', '#7da6ff', '#ff8c00'],
    boardBg: '#000000',
    grid: '#161622',
    drawBlock(context, px, py, size, color, alpha) {
      context.shadowColor = color;
      context.shadowBlur = alpha < 1 ? 0 : 12; // el fantasma no brilla
      context.fillStyle = color;
      context.fillRect(px + 3, py + 3, size - 6, size - 6);
      context.shadowBlur = 0;
      // centro oscuro para resaltar el borde luminoso
      context.fillStyle = 'rgba(0,0,0,0.45)';
      context.fillRect(px + 7, py + 7, size - 14, size - 14);
    },
  },
  pastel: {
    name: 'Pastel',
    colors: [null, '#9ddce8', '#f7df94', '#cdaee8', '#aedcb0', '#f2a9ab', '#b5cdf5', '#f8c49c'],
    boardBg: null,
    grid: null,
    drawBlock(context, px, py, size, color, alpha) {
      roundedRectPath(context, px + 1.5, py + 1.5, size - 3, size - 3, size / 4);
      context.fillStyle = color;
      context.fill();
      if (alpha < 1) {
        // contorno más opaco para que el fantasma se vea sobre fondo claro
        context.globalAlpha = Math.min(1, alpha * 3);
        context.strokeStyle = color;
        context.lineWidth = 1.5;
        context.stroke();
      } else {
        roundedRectPath(context, px + 6, py + 4, size - 12, size / 5, size / 10);
        context.fillStyle = 'rgba(255,255,255,0.45)';
        context.fill();
      }
    },
  },
  pixel: {
    name: 'Pixel art',
    colors: [null, '#22b8d6', '#e6bc22', '#9b4dca', '#43a847', '#d63c3c', '#78a9e8', '#e67e22'],
    boardBg: null,
    grid: null,
    drawBlock(context, px, py, size, color) {
      const u = (size - 2) / 7; // rejilla de 7x7 "píxeles"
      const x = px + 1;
      const y = py + 1;
      const side = u * 7;
      context.fillStyle = color;
      context.fillRect(x, y, side, side);
      // trama interior (dithering)
      for (let r = 1; r < 6; r++) {
        for (let c = 1; c < 6; c++) {
          if ((r + c) % 2) continue;
          context.fillStyle = r + c < 6 ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
          context.fillRect(x + c * u, y + r * u, u, u);
        }
      }
      // bisel: luz arriba/izquierda, sombra abajo/derecha
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fillRect(x, y, side, u);
      context.fillRect(x, y + u, u, side - u);
      context.fillStyle = 'rgba(0,0,0,0.4)';
      context.fillRect(x + u, y + side - u, side - u, u);
      context.fillRect(x + side - u, y + u, u, side - 2 * u);
    },
  },
};

let activeSkin = SKINS.retro;

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

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

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
  const a = alpha ?? 1;
  context.save(); // restore() deshace alpha, sombras y demás estado del skin
  context.globalAlpha = a;
  activeSkin.drawBlock(context, x * size, y * size, size, activeSkin.colors[colorIndex], a);
  context.restore();
}

function clearCanvas(context) {
  const { width, height } = context.canvas;
  context.clearRect(0, 0, width, height);
  if (activeSkin.boardBg) {
    context.fillStyle = activeSkin.boardBg;
    context.fillRect(0, 0, width, height);
  }
}

function drawGrid() {
  ctx.strokeStyle = activeSkin.grid
    || getComputedStyle(document.documentElement).getPropertyValue('--grid').trim()
    || '#22222e';
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
  clearCanvas(ctx);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // tras el Game Over la pieza actual solapa el tablero: no se pinta
  if (gameOver) return;

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
  clearCanvas(nextCtx);
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
  draw(); // deja pintado el tablero definitivo bajo el overlay
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
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

restartBtn.addEventListener('click', init);

const themeBtn = document.getElementById('theme-toggle');

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch (e) { /* sin almacenamiento */ }
  const light = theme === 'light';
  themeBtn.setAttribute('aria-pressed', String(light));
  themeBtn.textContent = light ? '☀️ Claro' : '🌙 Oscuro';
  if (current && next) { draw(); drawNext(); }
}

themeBtn.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeBtn.blur(); // evita que Space/Enter vuelvan a activar el botón
});

setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

const skinSelect = document.getElementById('skin-select');

for (const [key, { name }] of Object.entries(SKINS)) skinSelect.add(new Option(name, key));

function setSkin(key) {
  const valid = Object.prototype.hasOwnProperty.call(SKINS, key) ? key : 'retro';
  activeSkin = SKINS[valid];
  skinSelect.value = valid;
  document.documentElement.dataset.skin = valid;
  try { localStorage.setItem('skin', valid); } catch (e) { /* sin almacenamiento */ }
  if (current && next) { draw(); drawNext(); }
}

skinSelect.addEventListener('change', () => {
  setSkin(skinSelect.value);
  skinSelect.blur(); // las flechas vuelven al juego en lugar de cambiar de opción
});

// Si el selector conserva el foco (p. ej. se cerró sin cambiar), las teclas del juego no deben usarlo
skinSelect.addEventListener('keydown', e => {
  if (e.altKey || !/^(Arrow(Left|Right|Up|Down)|Space|KeyP|KeyX)$/.test(e.code)) return;
  e.preventDefault();
  skinSelect.blur();
});

setSkin(document.documentElement.dataset.skin);

init();
