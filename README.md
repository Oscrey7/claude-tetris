# Tetris

Implementación del clásico **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Tetris](#tetris)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Records](#records)
  - [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
    - [Opción 1: abrir el archivo directamente](#opción-1-abrir-el-archivo-directamente)
    - [Opción 2: servidor local (recomendado)](#opción-2-servidor-local-recomendado)
  - [Controles](#controles)
  - [Skins](#skins)
  - [Cómo funciona](#cómo-funciona)
    - [1. `index.html`](#1-indexhtml)
    - [2. `style.css`](#2-stylecss)
    - [3. `game.js`](#3-gamejs)
    - [Flujo del juego](#flujo-del-juego)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel).
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Menú de pausa** (reanudar, reiniciar, ver controles y elegir nivel inicial) y **Game Over** con opción de reinicio.
- **Pantalla de inicio** y **tabla de records local** (top 5, mejor combo y líneas máximas).
- **Tema claro / oscuro** (oscuro por defecto).
- **Skins visuales** (Retro, Neon, Pastel y Pixel art) que se cambian sin recargar. Ver [Skins](#skins).

---

## Records

Los records se guardan en el `localStorage` del navegador (clave `tetris-records`) y se muestran en la pantalla de inicio y en el Game Over.

- **Top 5**: si la puntuación entra en la tabla, su puesto se resalta y puedes escribir tu nombre (máximo 12 caracteres; si lo dejas vacío se guarda como «Anónimo»). Una puntuación de 0 no entra y, en caso de empate, el record más antiguo conserva el puesto.
- Si reinicias, cierras o recargas la página sin pulsar **Guardar**, la puntuación se guarda igualmente con el nombre escrito hasta ese momento.
- **Mejor combo**: máximo número de piezas consecutivas fijadas que eliminan al menos una línea (una pieza que no elimina ninguna lo reinicia). No altera la puntuación.
- **Líneas máximas**: mayor número de líneas eliminadas en una sola partida.
- El mejor combo y las líneas máximas se actualizan durante la partida, entre o no la puntuación en el top 5.
- El botón **Borrar records** pide confirmación y elimina la tabla, el mejor combo y las líneas máximas.
- Si el almacenamiento no está disponible, el juego funciona igual y los records duran solo hasta recargar la página.

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar. Tienes dos opciones:

### Opción 1: abrir el archivo directamente

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Opción 2: servidor local (recomendado)

Cualquier servidor estático funciona. Algunos ejemplos:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

Después abre `http://localhost:8000` en el navegador.

---

## Controles

| Tecla       | Acción                            |
| ----------- | --------------------------------- |
| `←` / `→`   | Mover la pieza horizontalmente    |
| `↑` o `X`   | Rotar la pieza en sentido horario |
| `↓`         | Soft drop (bajar más rápido)      |
| `Espacio`   | Hard drop (caída instantánea)     |
| `P` o `Esc` | Pausar / reanudar                 |

### Menú de pausa

Al pausar aparece un menú con estas opciones:

- **Reanudar**: vuelve a la partida.
- **Reiniciar**: empieza una partida nueva sin recargar la página.
- **Ver controles**: muestra la lista de teclas dentro del menú.
- **Nivel inicial**: elige el nivel (1–10) con el que empezará la **próxima** partida; no cambia la partida en pausa.

Mientras el menú está abierto las teclas de juego no tienen efecto. Una tecla que siga pulsada al reanudar no actúa hasta volver a pulsarla.

La partida empieza al pulsar **Jugar** en la pantalla de inicio. Mientras escribes tu nombre, las teclas no controlan el juego.

El tema y el skin se eligen con los botones de la parte superior de la pantalla. Al hacer clic no retienen el foco, así que no interfieren con el teclado.

---

## Skins

El selector `SKIN` cambia al momento el tablero, la pieza fantasma, la vista previa y el estilo de la página, también en pausa o en Game Over.

| Skin      | Aspecto                                           | Tema claro / oscuro    |
| --------- | ------------------------------------------------- | ---------------------- |
| Retro     | Bloques cuadrados y colores planos (por defecto)  | Ambos                  |
| Neon      | Fondo negro y brillo con `shadowBlur`             | Siempre fondo negro    |
| Pastel    | Colores suaves y bordes redondeados               | Ambos                  |
| Pixel art | Textura pixelada sobre cada bloque, bordes rectos | Ambos                  |

La elección se guarda en `localStorage` (clave `skin`). Si el valor no es válido o el almacenamiento no está disponible, se usa Retro. Con Neon el botón de tema queda deshabilitado y tu preferencia se recupera al cambiar a otro skin.

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero.
- Un panel lateral con `SCORE`, `LINES`, `LEVEL`, vista de la siguiente pieza y la lista de controles.
- Un overlay de inicio con los records.
- Un overlay para el **menú de pausa** y el estado **GAME OVER** (este último con el formulario de nombre y los records).
- El botón de tema claro/oscuro y el selector de skin.

### 2. `style.css`

Aporta el aspecto visual con estética _dark / retro arcade_: fondo oscuro, tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays. Los colores son variables CSS que redefinen el tema claro (`[data-theme="light"]`) y cada skin (`[data-skin="..."]`).

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–7) que identifica la pieza.
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`).
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación**: usa la tabla clásica `[0, 100, 300, 500, 800]` multiplicada por el nivel actual; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Nivel y velocidad**: la partida empieza en el nivel inicial elegido (1 por defecto) y sube un nivel cada 10 líneas; la velocidad de caída se calcula como `max(100, 1000 − (level − 1) × 90)` milisegundos (`speedFor`).
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja semitransparente (opacidad `ghostAlpha` del skin).
- **Skins** (`SKINS`, `setSkin`): cada skin aporta su paleta, la opacidad de la pieza fantasma y la función que pinta un bloque; `drawBlock` delega en el skin activo.
- **Records** (`readRecords`, `writeRecords`, `commitPending`): validan lo leído de `localStorage` (datos corruptos o manipulados se descartan) e insertan los nombres en la página como texto, nunca como HTML.

### Flujo del juego

```
carga de la página → renderRecords()   (pantalla de inicio)
        ↓  botón "Jugar" / "Reiniciar"
init()
  ├─ commitPending()                → guarda el record pendiente, si lo hay
  ├─ createBoard()                  → matriz vacía
  ├─ next = randomPiece()
  ├─ spawn()                        → mueve next a current y genera nueva next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ acumula dt
     ├─ si dt ≥ dropInterval → baja la pieza o llama a lockPiece()
     ├─ draw()  (grid + tablero + ghost + pieza actual)
     └─ requestAnimationFrame(loop)

   keydown → mover / rotar / soft-drop / hard-drop / pausa
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()` y se muestra el overlay de **Game Over**.

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego, temas y skins
├── game.js         # Toda la lógica del Tetris, los records y el dibujo de los skins
└── README.md
```

---

## Personalización

Algunos parámetros fáciles de tunear en `game.js`:

| Constante         | Significado                              | Por defecto           |
| ----------------- | ---------------------------------------- | --------------------- |
| `COLS`            | Columnas del tablero                     | `10`                  |
| `ROWS`            | Filas del tablero                        | `20`                  |
| `BLOCK`           | Tamaño en píxeles de cada celda          | `30`                  |
| `COLORS`          | Paleta del skin Retro por tipo de pieza  | 7 colores             |
| `*_COLORS`        | Paletas de Neon, Pastel y Pixel art      | 7 colores cada una    |
| `LINE_SCORES`     | Puntos por 1, 2, 3 o 4 líneas eliminadas | `[0,100,300,500,800]` |
| `MAX_START_LEVEL` | Nivel inicial máximo seleccionable       | `10`                  |
| `speedFor()`      | Velocidad de caída en ms según el nivel  | `1000` en el nivel 1  |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
