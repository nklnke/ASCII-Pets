# Plan: растровый движок + паки скинов (ascii5 — первый пак, заглушки)

## 1. Цель и не-цели
- Цель: движок PNG-спрайтов + формат паков анимаций. Первый пак — `ascii5` на заглушках-кубиках, финальный арт позже.
- Не-цели: не менять дефолт (`ascii1`), не удалять и не менять готовые стили `ascii1-4` (остаются в проекте как есть), не ломать ASCII-контракт, не делать редактор паков и не вводить стиль на отдельный слот.

## 2. Решения и ограничения
- Стили `ascii1-4` не трогаем: арт, палитры и поведение остаются, движок только добавляется рядом.
- Каждый пак = отдельный pack-wide стиль (`ascii5`, дальше `ascii6...`, как `ascii1-4`).
- Полный пак обязателен: петы + кучки + иконки. Неполный пак скрыт из настроек + `console.warn`.
- Opt-in: нарушает правило AGENTS.md «только ASCII-арт», поэтому растровые стили — опция, старый контракт не регрессирует.

## 3. Формат пака
```
assets/sprites/<packId>/
  manifest.json
  cat/walk1-4.png happy1-2.png hungry1-2.png sleep1-2.png jump1-2.png blink.png eat.png (14)
  dog/... (14)
  frog/... (14)
  bird/... (14)
  poop/poop1-2.png
  icons/icon.png icon-16.png
```
- `manifest.json`: `{ id, name, frameSize: [96,96], anchor: "bottom-center", rendering: "pixelated|smooth", version }`.
- Требования к PNG: прозрачный фон, единый WxH внутри пака, заглушки различимы (номер/полоска). Бинари руками не править — только генератором.

## 4. Архитектура движка
- Discovery: список паков из `manifest.json` → регистрация стилей.
- Validation (pure): 56 пет-кадров + `poop/` + `icons/` на месте, единый размер, якорь `bottom-center`.
- Load: ленивая предзагрузка спрайтов активного стиля, кеш в памяти.
- Render: текстовый кадр → `src` (`img.petsprite`), без span-перестройки; инверсия и глиф-тени отключены (как `ascii4`).
- Fallback: нет файла/битый пак → ASCII-кадр + `warn`; сэмплер фона растр не трогает.

## 5. Изменения по файлам
1. `src/renderer/sprites.ts` (новый, pure без Electron/DOM): `spriteFor()`, `poopSpriteFor()`, `packIcon()`, `loadPackManifest()` + валидатор полноты.
2. `src/shared/skins.ts`: только добавление в `STYLE_LIST:55` (`ascii5`, дальше `ascii6...`); записи `ascii1-4` не менять; `styleFlat:74` / `styleColored:78` → `true` для растра; `rendering` из манифеста в CSS-класс.
3. `src/renderer/renderer.ts` (класс `Pet`): `syncElement():460` — режим `wantRaster` (`img` видим, `pre`/`canvas` скрыты); `setFrame():664` — маппинг в `src`; `paintInk():734`, `drawSprite():477` — early-return; `measureCell/renderStats` — заглушка 1×1; `width()/height()/clampX`, `step/yOffset` — без изменений; масштаб через `--pet-scale` (`applyScale():266`); кучки — `img` из пака, ноты/сердечки остаются DOM.
4. `src/main.ts`: иконки трея из `icons/` активного пака, fallback на `assets/icon*.png`.
5. `src/renderer/settings.ts:192`: пункт `ASCII 5 — растр` (дальше по пункту на пак).
6. `scripts/make-sprite-stubs.py` (новый, Pillow): генерация заглушек полного пака.
7. `package.json`: `build:renderer:10` — копировать `assets/sprites/**` → `dist/renderer/sprites/`; `files:27` — добавить `assets/sprites/**/*`.
8. Доки: `README` + `CHANGELOG (Unreleased)` — по строке на пак.

## 6. Тесты (`test/skins.test.mjs`, блок `raster`)
- Манифест парсится и валиден.
- 56 PNG + `poop/` + `icons/` существуют, IHDR валиден, единый WxH.
- Неполный пак отсекается валидатором.

## 7. Проверка (приемка)
`npm run check` → `npm test` → `npm run start:fast`:
- все 4 растр-пета ходят/спят/едят/прыгают;
- масштаб 85–160% держит якорь к полу, без замыливания заглушек;
- тултип/сэмплер без мусора, пауза/звук/социалки работают как в ASCII.
