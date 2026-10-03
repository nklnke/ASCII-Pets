# Plan: растровый стиль ascii5 — кот (заглушки)

## Цель
Добавить pack-wide стиль `ascii5 — растр` (PNG-спрайты), тестовый пет — `cat`.
Дефолт остается `ascii1`. Заглушки-кубики сейчас, финальный арт позже.

> Нарушает правило AGENTS.md "только ASCII-арт" — оформляется как opt-in стиль,
> старый контракт не регрессирует.

## Контракт кадров (как у ASCII)
14 файлов в `assets/sprites/cat/`:
`walk1-4.png, happy1-2.png, hungry1-2.png, sleep1-2.png, jump1-2.png, blink.png, eat.png`.
Прозрачный фон, единый размер (96x96), различимые (номер/полоска).

## Изменения

1. **Ассеты:** `assets/sprites/cat/*.png` + генератор `scripts/make-sprite-stubs.py`
   (Pillow, не править бинари вручную).
2. **`src/renderer/sprites.ts` (новый, pure без Electron/DOM):**
   `spriteFor(style, id, pose, i): string` → `sprites/cat/walk1.png`.
3. **`src/shared/skins.ts`:**
   - `STYLE_LIST:55` + `{ id: "ascii5", name: "ASCII 5 — растр" }`
   - `styleFlat:74` / `styleColored:78` → `true` для `ascii5` (без инверсии/глиф-теней, как ascii4).
4. **`src/renderer/renderer.ts` (класс Pet):**
   - `syncElement():460` — третий режим `wantRaster`: показать `img.petsprite`, скрыть `pre`/`canvas`.
   - `setFrame():664` — маппинг текстового кадра → sprite-src, без span-перестройки.
   - `paintInk():734`, `drawSprite():477` — early-return для растра.
   - `measureCell/renderStats` — заглушка `cols/rows` (1x1), сэмплер `main.ts:54` не семплит мусор.
   - `width()/height()/clampX`, `step/yOffset` — без изменений.
   - CSS: `image-rendering: pixelated`, масштаб через `--pet-scale` (`applyScale():266`).
5. **Сборка/упаковка (`package.json`):**
   - `build:renderer:10` — копировать `assets/sprites/**` → `dist/renderer/sprites/`.
   - `files:27` — добавить `assets/sprites/**/*` (иначе NSIS/portable без картинок).
6. **Настройки:** `src/renderer/settings.ts:192` — пункт `ASCII 5 — растр`;
   `README` + `CHANGELOG Unreleased` — по строке.
7. **Тест `test/skins.test.mjs`:** блок `raster` — 14 PNG существуют, валидный IHDR, единый W×H.

## Открытый вопрос при реализации
Остальные скины (dog/frog/bird) в стиле `ascii5`: fallback на ASCII или скрыть из pack.
Решить при реализации (предложение: fallback + `console.warn`).

## Проверка
`npm run check` → `npm test` → `npm run start:fast`:
кот-растр ходит/спит/ест/прыгает, масштаб 85–160% не мылит, тултип/сэмплер без мусора.
