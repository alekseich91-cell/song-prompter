# Задача: исправить синхронизацию прокрутки между основным окном и viewer

## Проект

Mini Prompter Lunia — десктопное Tauri v2 приложение (телепромптер для текстов песен).
Repo: https://github.com/alekseich91-cell/song-prompter
Рабочая директория: `/Users/lunia/cld/prompt`

## Проблема

Текст на основном экране и на втором экране (viewer) рассинхронизируется при прокрутке. К концу текста viewer отстаёт или опережает основной экран на 1-3 строки.

## Причина

Основной экран и viewer имеют разную ширину контейнера для текста:
- Основной: `lyricsContainer` ужат сайдбарами (~600px при окне 1200px)
- Viewer: `lyricsContainer` на весь экран (1920px+), но с `max-width` ограниченным до пиксельной ширины основного контейнера

Из-за этого текст может переноситься по-разному (разные padding, border, sub-pixel rendering). `scrollHeight` и `lyricsText.offsetHeight` отличаются → дробная позиция прокрутки даёт разные строки.

## Что уже пробовали (не помогло полностью)

1. **Пиксели напрямую** (`scrollTop`) — полностью ломается при разных разрешениях
2. **Доля от scroll range** (`scrollTop / (scrollHeight - clientHeight)`) — дрейфует из-за разного padding
3. **Matching bottom padding** на viewer (`applyExtraBottomPadding`) — всё равно дрейфует из-за разной ширины
4. **Передача containerWidthPx** от основного + доля от высоты текста (`scrollTop / lyricsText.offsetHeight`) — лучше, но к концу длинных текстов всё равно уплывает

## Ключевые файлы

- `src/app.js` (~1250 строк) — функция `getScrollFraction()` (строка ~309), `scrollStep()` (~345), `syncToViewer()` (~1165)
- `src/viewer.js` (~170 строк) — обработчики `listen('scroll')` и `listen('update-song')`
- `src/styles.css` — стили контейнеров `#lyricsContainer`, `#lyricsText`

## Текущая реализация

**app.js:**
```js
function getScrollFraction() {
    var textHeight = lyricsText.offsetHeight;
    if (textHeight <= 0) return 0;
    return lyricsContainer.scrollTop / textHeight;
}
```
Отправляется через `emitTo('viewer', 'scroll', { scrollFraction: getScrollFraction() })`.
В `syncToViewer()` также передаётся `containerWidthPx: lyricsContainer.clientWidth`.

**viewer.js:**
```js
// В listener 'update-song':
if (msg.style.containerWidthPx) {
    lyricsContainer.style.maxWidth = msg.style.containerWidthPx + 'px';
}
// ...
lyricsContainer.scrollTop = msg.scrollFraction * lyricsText.offsetHeight;

// В listener 'scroll':
lyricsContainer.scrollTop = msg.scrollFraction * lyricsText.offsetHeight;
```

Viewer также вызывает `applyExtraBottomPadding()` (padding = containerHeight / 2).

## Возможные решения для исследования

1. **Идентичная ширина текста** — на viewer задавать `lyricsText` точно такую же ширину как на основном (не контейнера, а именно текстового блока). Проверить что padding/margin совпадают.

2. **Позиция по номеру строки** — вычислить какая строка текста находится наверху viewport в основном окне (scrollTop / lineHeight), передать номер строки, на viewer прокрутить до той же строки.

3. **DOM-элементы-маркеры** — обернуть каждую строку текста в `<span>` или `<div>`, найти какой элемент виден сверху через `getBoundingClientRect()`, передать его индекс, на viewer найти тот же элемент и прокрутить к нему.

4. **Единый scrollHeight** — убедиться что `lyricsText.offsetHeight` одинаков на обоих экранах. Если viewer'у задать ту же ширину контейнера + те же padding/font/lineHeight, высота текста должна совпасть пиксель в пиксель.

## Как тестировать

1. `npx tauri dev` — запустить приложение
2. Добавить песню с длинным текстом (20+ строк)
3. Нажать "Второй экран" (откроется viewer на другом мониторе)
4. Прокрутить текст — сравнить позиции на обоих экранах
5. Проверить начало, середину и конец текста

## Сборка для теста

```bash
npx tauri build
cp -f src-tauri/target/release/bundle/dmg/*.dmg ~/Desktop/Mini\ Prompter\ Lunia/
```
