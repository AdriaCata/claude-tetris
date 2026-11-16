# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris on HTML5 Canvas. There are no dependencies, no `package.json`, no build step, no linter and no test suite. User-facing text (README, UI strings, overlay messages) is in Spanish, so keep new UI text in Spanish too.

## Running

Open `index.html` directly in a browser, or serve the folder statically (recommended):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
npx serve .
```

To check a change, reload the page and play.

## Architecture

All game logic is in `game.js`, a single classic script (not a module) loaded at the end of `index.html`. It uses `'use strict'`, module-level `let` globals for game state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `animId`, …), and DOM lookups by id at load time. If you rename an element id in `index.html`, update the `getElementById` calls at the top of `game.js` too.

Key conventions that span several functions:

- **Board/piece encoding**: `board` is a `ROWS × COLS` matrix. Each cell holds `0` (empty) or a piece type index `1–8` (1–7 are the standard tetrominoes, 8 is the 3×3 "Tuerca" challenge piece: a ring with an empty center). The same index is used in `PIECES[type]` (the shape matrices store their own type number as the cell value) and in `COLORS[type]`, so index 0 is `null` in both arrays. When you add or reorder pieces, keep `PIECES` and `COLORS` in sync; `randomPiece()` picks uniformly from `PIECES.length - 1` types.
- **Collision is the single source of truth**: movement, rotation with wall kicks (`tryRotate`, offsets `[0,-1,1,-2,2]`), the ghost piece (`ghostY`), soft and hard drops, gravity in `loop`, and game-over detection in `spawn` all call `collide(shape, x, y)`. Cells with `y < 0` are allowed (above the board).
- **Lock pipeline**: `lockPiece()` → `merge()` → `clearLines()` (updates lines, score, level and `dropInterval`) → `spawn()` (promotes `next` to `current`; calls `endGame()` if the new piece collides immediately).
- **Loop/pause lifecycle**: `loop` is driven by `requestAnimationFrame` and accumulates `dt` into `dropAccum`. Pause and game over stop it with `cancelAnimationFrame(animId)`. Resuming resets `lastTime` before calling `loop` again so that `dt` doesn't jump. `init()` is used both for the first start and for restart (the overlay's restart button).
- **Rendering**: `draw()` redraws the whole board every frame (grid → locked cells → ghost at alpha 0.2 → current piece). `drawNext()` runs only when a piece spawns. Both use `drawBlock(context, x, y, colorIndex, size, alpha)`.
- **Scoring/speed**: `LINE_SCORES[cleared] * level`. A hard drop adds 2 points per row and a soft drop adds 1. Level is `floor(lines/10) + 1`. The drop interval is `max(100, 1000 − (level−1)·90)` ms.

Canvas sizes are hard-coded in `index.html`: `#board` is 300×600 and must equal `COLS·BLOCK × ROWS·BLOCK`. `#next-canvas` is 120×120, which assumes a 4×4 preview at 30px. If you change `COLS`, `ROWS` or `BLOCK`, update these sizes too.
