# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

No build step or dependencies. Open directly or serve with any static server:

```bash
open index.html                  # macOS direct open
python3 -m http.server 8000      # then visit http://localhost:8000
```

## Architecture

Three files, no framework, no bundler:

- **`index.html`** — DOM structure: `<canvas id="board">` (300×600px) for the playfield, `<canvas id="next-canvas">` (120×120px) for the preview, sidebar HUD (`#score`, `#lines`, `#level`), and a single overlay `#overlay` used for the start screen, pause menu and game over. The overlay's `data-mode` (`start|pause|gameover`) plus each child's `data-show="…"` list decide what is visible (CSS rules in `style.css`); `showOverlay(mode)` / `hideOverlay()` in `game.js` switch it.
- **`style.css`** — Dark/retro arcade theme; uses CSS variables, flexbox, and `backdrop-filter` on overlays.
- **`game.js`** — All game logic (`'use strict'`, no modules). UI text is in Spanish.

### game.js internals

| Concern | Key identifiers |
|---|---|
| Board state | `board` — `ROWS×COLS` matrix; `0` = empty, `1–8` = piece type index (8 = "Tuerca") |
| Piece representation | `{ type, shape, x, y }` where `shape` is a 2-D matrix |
| Rotation | `rotateCW(shape)` — transpose + reverse; `tryRotate()` applies wall kicks `[0,±1,±2]` |
| Collision | `collide(shape, ox, oy)` — checks bounds and board occupancy |
| Game loop | `loop(ts)` via `requestAnimationFrame`; `dropAccum` tracks elapsed ms against `dropInterval` |
| Line clear | `clearLines()` — iterates board bottom-up, splices full rows, prepends empty row |
| Scoring | `LINE_SCORES = [0,100,300,500,800]` × `level`; hard drop +2/cell, soft drop +1/row |
| Speed | `speedFor(level)` = `max(100, 1000 − (level−1) × 90)` ms; level = `max(gameStartLevel, floor(lines/10) + 1)` |
| Combo | `combo` counts consecutive locks that clear lines; `maxCombo` per game |
| Ghost piece | `ghostY()` — projects current piece down until collision; drawn at `globalAlpha = 0.2` |
| State flags | `started` (false on start screen), `paused`, `gameOver`, `animId` (RAF handle), `inputLockUntil` + `freshKeys` (ignore input briefly / held-key repeats after resuming) |

### Game flow

Page load shows the start screen (`showOverlay('start')`, empty board, `current = next = null`; `draw`/`drawNext` tolerate nulls). Jugar / Reiniciar call `init()` → `spawn()` → `requestAnimationFrame(loop)`. Each frame: accumulate dt → auto-drop or `lockPiece()` → `draw()`. `lockPiece()` = `merge()` + `clearLines()` + `spawn()`. If `spawn()` immediately collides → `endGame()` → `recordGame()` (top 5) → `showOverlay('gameover', rank)`. Pause is `pauseGame()` / `resumeGame()`; all game keys are ignored while any overlay is open.

## Tunable constants (top of game.js)

`COLS` (10), `ROWS` (20), `BLOCK` (30 px), `COLORS` (array indexed 1–7), `LINE_SCORES`. If you change `COLS`/`ROWS`/`BLOCK`, update the canvas `width`/`height` attributes in `index.html` to match (`COLS×BLOCK` and `ROWS×BLOCK`).

## Skins

`SKINS` (top of game.js) maps id → `{ name, colors, bg, grid, drawBlock(c, px, py, s, color) }`. `colors` is indexed like `PIECES` (index 0 `null`). `COLORS` and `skin` are `let`s reassigned by `applySkin(id)`, which also sets the canvases' background (`bg`/`grid` null → CSS theme variables), `body[data-skin]`, saves the choice and redraws. `drawBlock()` wraps the skin's function in `save()/restore()` so `shadowBlur` etc. don't leak. When adding a piece, add its color to every skin.

## localStorage keys

`tetris-theme`, `tetris-skin`, `tetris-start-level`, `tetris-player` (last name used), `tetris-records` (`{ top: [{id,name,score,lines,level,combo}], bestCombo, maxLines }`). Access goes through `storageGet`/`storageSet` (try/catch).
