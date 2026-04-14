// ---------- Tauri API ----------
var invoke = window.__TAURI__.core.invoke;
var emitTo = window.__TAURI__.event.emitTo;
var listen = window.__TAURI__.event.listen;
var getCurrentWindow = window.__TAURI__.window.getCurrentWindow;

// ---------- Данные ----------
var songs = [];
var selectedSongIndex = 0;
var songCounter = 1;

// Глобальные триггеры песен
var songTriggers = [];

// Текущий язык интерфейса
var currentLang = 'ru';

// Настройка показа списка песен на втором экране
var showSongListOnViewer = false;

// Прокрутка
var isScrolling = false;
var scrollAnimationId = null;
var lastTimestamp = null;
var scrollAccumulator = 0;

// Флаг: открыто ли окно viewer
var viewerOpen = false;

// DOM-элементы
var songListEl = document.getElementById('songList');
var addSongBtn = document.getElementById('addSongBtn');
var resetPlayedBtn = document.getElementById('resetPlayedBtn');
var deleteSongBtn = document.getElementById('deleteSongBtn');

var lyricsContainer = document.getElementById('lyricsContainer');
var lyricsText = document.getElementById('lyricsText');

var songTitleInput = document.getElementById('songTitleInput');
var fontSizeRange = document.getElementById('fontSizeRange');
var fontSizeLabel = document.getElementById('fontSizeLabel');

var lineHeightRange = document.getElementById('lineHeightRange');
var lineHeightLabel = document.getElementById('lineHeightLabel');

var textWidthRange = document.getElementById('textWidthRange');
var textWidthLabel = document.getElementById('textWidthLabel');

// выравнивание текста (select)
var textAlignSelect = document.getElementById('textAlignSelect');

var speedRange = document.getElementById('speedRange');
var speedLabel = document.getElementById('speedLabel');

var durationInput = document.getElementById('durationInput');
var scrollModeRadios = document.querySelectorAll('input[name="scrollMode"]');
var speedControls = document.getElementById('speedControls');
var durationControls = document.getElementById('durationControls');

var startBtn = document.getElementById('startBtn');
var pauseBtn = document.getElementById('pauseBtn');
var stopBtn = document.getElementById('stopBtn');
var topBtn = document.getElementById('topBtn');

var lyricsInput = document.getElementById('lyricsInput');
var applyLyricsBtn = document.getElementById('applyLyricsBtn');
var importTxtBtn = document.getElementById('importTxtBtn');

var exportProjectBtn = document.getElementById('exportProjectBtn');
var importProjectBtn = document.getElementById('importProjectBtn');

// Checkbox для показа списка песен на втором экране
var showSongListCheckbox = document.getElementById('showSongListCheckbox');

// Viewer song list elements
var viewerSongListEl = document.getElementById('viewerSongList');
var viewerSongListItemsEl = document.getElementById('viewerSongListItems');

// ---------- Auto-save ----------
var autoSaveTimeout = null;
function scheduleAutoSave() {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(async function() {
        var data = exportProjectData();
        try { await invoke('auto_save', { data: JSON.stringify(data) }); }
        catch (e) { console.error('Auto-save failed:', e); }
    }, 500);
}

// ---------- Вспомогательные функции ----------

function defaultSong() {
    return {
        id: Date.now() + '_' + Math.random().toString(16).slice(2),
        title: translations[currentLang].songPrefix + ' ' + songCounter++,
        text: '',
        fontSize: 32,
        lineHeight: 0.8,
        textWidthPercent: 100,
        textAlign: 'center',
        scrollMode: 'speed',
        speed: 30,
        durationSeconds: 0,
        played: false,
        markers: []
    };
}

function createNewSong() {
    var song = defaultSong();
    songs.push(song);
    return songs.length - 1;
}

function renderSongList() {
    songListEl.textContent = '';
    songs.forEach(function(song, index) {
        var item = document.createElement('div');
        item.className = 'song-item' +
            (index === selectedSongIndex ? ' active' : '') +
            (song.played ? ' played' : '');
        var main = document.createElement('div');
        main.className = 'song-item-main';
        main.textContent = song.title || translations[currentLang].untitled;

        main.addEventListener('click', function() {
            selectSong(index);
        });

        var controls = document.createElement('div');
        controls.className = 'song-controls';

        var upBtn = document.createElement('button');
        upBtn.textContent = '\u25B2';
        upBtn.title = currentLang === 'ru' ? 'Переместить вверх' : 'Move up';
        upBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            moveSong(index, index - 1);
        });

        var downBtn = document.createElement('button');
        downBtn.textContent = '\u25BC';
        downBtn.title = currentLang === 'ru' ? 'Переместить вниз' : 'Move down';
        downBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            moveSong(index, index + 1);
        });

        controls.appendChild(upBtn);
        controls.appendChild(downBtn);

        item.appendChild(main);
        item.appendChild(controls);
        songListEl.appendChild(item);
    });

    // после отрисовки списка песен обновляем список песен в триггерах
    renderTriggers();
}

function moveSong(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= songs.length) return;
    var removed = songs.splice(fromIndex, 1);
    songs.splice(toIndex, 0, removed[0]);

    if (selectedSongIndex === fromIndex) {
        selectedSongIndex = toIndex;
    } else if (selectedSongIndex > fromIndex && selectedSongIndex <= toIndex) {
        selectedSongIndex--;
    } else if (selectedSongIndex < fromIndex && selectedSongIndex >= toIndex) {
        selectedSongIndex++;
    }

    renderSongList();
    scheduleAutoSave();
}

function selectSong(index) {
    if (index < 0 || index >= songs.length) return;

    // Если переключаемся на другую песню, помечаем текущую как проигранную
    var currentSong = songs[selectedSongIndex];
    if (currentSong && index !== selectedSongIndex) {
        if (lyricsContainer.scrollTop > 0 || currentSong.played) {
            currentSong.played = true;
        }
    }

    stopScroll();
    selectedSongIndex = index;
    renderSongList();
    loadSongIntoUI();
    syncToViewer();
    scheduleAutoSave();
}

function loadSongIntoUI() {
    var song = songs[selectedSongIndex];
    if (!song) return;

    songTitleInput.value = song.title;
    lyricsInput.value = song.text;
    lyricsText.textContent = song.text || '';

    // размер шрифта
    if (!song.fontSize) song.fontSize = 32;
    fontSizeRange.value = song.fontSize;
    updateFontSizeDisplay(song.fontSize);

    // межстрочный интервал
    if (!song.lineHeight) song.lineHeight = 0.8;
    lineHeightRange.value = Math.round(song.lineHeight * 10);
    updateLineHeightDisplay(song.lineHeight);

    // ширина текста
    if (!song.textWidthPercent) song.textWidthPercent = 100;
    textWidthRange.value = song.textWidthPercent;
    updateTextWidthDisplay(song.textWidthPercent);

    // выравнивание текста
    if (!song.textAlign) song.textAlign = 'center';
    if (textAlignSelect) {
        textAlignSelect.value = song.textAlign;
        updateTextAlign(song.textAlign);
    }

    // режим прокрутки
    if (!song.scrollMode) song.scrollMode = 'speed';
    scrollModeRadios.forEach(function(r) { r.checked = r.value === song.scrollMode; });
    updateScrollModeUI(song.scrollMode);

    // скорость
    if (!song.speed) song.speed = 30;
    speedRange.value = song.speed;
    updateSpeedLabel(song.speed);

    // длительность
    if (!song.durationSeconds) song.durationSeconds = 0;
    durationInput.value = formatDuration(song.durationSeconds);

    // сбрасываем прокрутку в начало
    lyricsContainer.scrollTop = 0;

    // рендерим маркеры таймлайна
    renderMarkers();

    // синхронизируем второй экран
    syncToViewer();
}

// ---------- Обновление отображения ----------
function updateFontSizeDisplay(size) {
    fontSizeLabel.textContent = size + 'px';
    lyricsText.style.fontSize = size + 'px';
}

function updateLineHeightDisplay(lh) {
    lineHeightLabel.textContent = lh.toFixed(1);
    lyricsText.style.lineHeight = lh;
}

function updateTextWidthDisplay(percent) {
    textWidthLabel.textContent = percent + '%';
    lyricsContainer.style.maxWidth = percent + '%';
}

function updateScrollModeUI(mode) {
    if (mode === 'duration') {
        speedControls.style.display = 'none';
        durationControls.style.display = '';
    } else {
        speedControls.style.display = '';
        durationControls.style.display = 'none';
    }
}

function updateSpeedLabel(speed) {
    speedLabel.textContent = speed + ' px/s';
}

function updateTextAlign(align) {
    if (align === 'left') {
        lyricsText.classList.add('align-left');
    } else {
        lyricsText.classList.remove('align-left');
    }
    lyricsText.style.textAlign = align;
}

function parseDuration(str) {
    if (!str) return 0;
    str = str.trim();
    var parts = str.split(':');
    if (parts.length === 2) {
        return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    }
    return parseInt(str, 10) || 0;
}

function formatDuration(sec) {
    if (!sec || sec <= 0) return '';
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + s.toString().padStart(2, '0');
}

// ---------- Прокрутка ----------

function getTextContentHeight() {
    // Text height WITHOUT dynamic bottom padding — this value is identical
    // on both screens (same text, same container width, same font/lineHeight).
    var pad = parseInt(lyricsText.style.paddingBottom) || 0;
    return lyricsText.offsetHeight - pad;
}

function getScrollFraction() {
    var contentH = getTextContentHeight();
    if (contentH <= 0) return 0;
    return lyricsContainer.scrollTop / contentH;
}

function getEffectiveSpeed() {
    var song = songs[selectedSongIndex];
    if (!song) return 30;
    if (song.scrollMode === 'duration' && song.durationSeconds > 0) {
        var totalHeight = lyricsText.scrollHeight - lyricsContainer.clientHeight;
        if (totalHeight <= 0) return 30;
        return totalHeight / song.durationSeconds;
    }
    return song.speed || 30;
}

function startScroll() {
    var song = songs[selectedSongIndex];
    if (!song) return;
    // отмечаем как проигранную
    song.played = true;
    renderSongList();
    // синхронизируем второй экран (обновляем статус played)
    syncToViewer();

    if (isScrolling) return;
    isScrolling = true;

    // добавляем padding снизу
    applyExtraBottomPadding();

    lastTimestamp = null;
    scrollAccumulator = 0;
    scrollAnimationId = requestAnimationFrame(scrollStep);
}

function scrollStep(timestamp) {
    if (!isScrolling) return;
    if (!lastTimestamp) lastTimestamp = timestamp;
    var delta = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    var speed = getEffectiveSpeed();
    scrollAccumulator += speed * delta;

    if (scrollAccumulator >= 1) {
        var pixels = Math.floor(scrollAccumulator);
        lyricsContainer.scrollTop += pixels;
        scrollAccumulator -= pixels;

        // синхронизируем второй экран
        if (viewerOpen) {
            emitTo('viewer', 'scroll', { scrollFraction: getScrollFraction() });
        }
    }

    scrollAnimationId = requestAnimationFrame(scrollStep);
}

function pauseScroll() {
    isScrolling = false;
    if (scrollAnimationId) cancelAnimationFrame(scrollAnimationId);
}

function stopScroll() {
    pauseScroll();
    lyricsContainer.scrollTop = 0;
    // sync viewer
    if (viewerOpen) {
        emitTo('viewer', 'scroll', { scrollFraction: 0 });
    }
}

function applyExtraBottomPadding() {
    var containerHeight = lyricsContainer.clientHeight;
    lyricsText.style.paddingBottom = Math.floor(containerHeight / 2) + 'px';
}

// ---------- Добавление / удаление песен ----------
addSongBtn.addEventListener('click', function() {
    var newIndex = createNewSong();
    selectSong(newIndex);
    renderSongList();
    scheduleAutoSave();
});

deleteSongBtn.addEventListener('click', function() {
    if (songs.length === 1) {
        songs[0] = defaultSong();
        selectedSongIndex = 0;
        renderSongList();
        loadSongIntoUI();
        scheduleAutoSave();
        return;
    }
    songs.splice(selectedSongIndex, 1);
    if (selectedSongIndex >= songs.length) {
        selectedSongIndex = songs.length - 1;
    }
    renderSongList();
    loadSongIntoUI();
    scheduleAutoSave();
});

resetPlayedBtn.addEventListener('click', function() {
    songs.forEach(function(s) { s.played = false; });
    renderSongList();
    syncToViewer();
    scheduleAutoSave();
});

songTitleInput.addEventListener('input', function() {
    var song = songs[selectedSongIndex];
    if (!song) return;
    song.title = songTitleInput.value;
    renderSongList();
    scheduleAutoSave();
});

fontSizeRange.addEventListener('input', function() {
    var song = songs[selectedSongIndex];
    if (!song) return;
    var size = parseInt(fontSizeRange.value, 10) || 32;
    song.fontSize = size;
    updateFontSizeDisplay(size);
    syncToViewer();
    scheduleAutoSave();
});

lineHeightRange.addEventListener('input', function() {
    var song = songs[selectedSongIndex];
    if (!song) return;
    var value = parseInt(lineHeightRange.value, 10) || 8;
    var lh = value / 10;
    song.lineHeight = lh;
    updateLineHeightDisplay(lh);
    syncToViewer();
    scheduleAutoSave();
});

textWidthRange.addEventListener('input', function() {
    var song = songs[selectedSongIndex];
    if (!song) return;
    var percent = parseInt(textWidthRange.value, 10) || 100;
    song.textWidthPercent = percent;
    updateTextWidthDisplay(percent);
    syncToViewer();
    scheduleAutoSave();
});

if (textAlignSelect) {
    textAlignSelect.addEventListener('change', function() {
        var song = songs[selectedSongIndex];
        if (!song) return;
        var align = textAlignSelect.value || 'center';
        song.textAlign = align;
        updateTextAlign(align);
        syncToViewer();
        scheduleAutoSave();
    });
}

scrollModeRadios.forEach(function(radio) {
    radio.addEventListener('change', function() {
        if (!radio.checked) return;
        var mode = radio.value;
        var song = songs[selectedSongIndex];
        if (!song) return;
        song.scrollMode = mode;
        updateScrollModeUI(mode);
        syncToViewer();
        scheduleAutoSave();
    });
});

speedRange.addEventListener('input', function() {
    var song = songs[selectedSongIndex];
    if (!song) return;
    var speed = Math.max(1, parseInt(speedRange.value, 10) || 1);
    song.speed = speed;
    updateSpeedLabel(speed);
    syncToViewer();
    scheduleAutoSave();
});

durationInput.addEventListener('change', function() {
    var song = songs[selectedSongIndex];
    if (!song) return;
    var seconds = parseDuration(durationInput.value);
    song.durationSeconds = seconds;
    durationInput.value = formatDuration(seconds);
    syncToViewer();
    scheduleAutoSave();
});

startBtn.addEventListener('click', startScroll);
pauseBtn.addEventListener('click', function() {
    if (isScrolling) {
        pauseScroll();
    } else {
        startScroll();
    }
});
stopBtn.addEventListener('click', stopScroll);
topBtn.addEventListener('click', function() {
    lyricsContainer.scrollTop = 0;
    if (viewerOpen) {
        emitTo('viewer', 'scroll', { scrollFraction: 0 });
    }
});

// при ручной прокрутке синхронизуем второй экран
lyricsContainer.addEventListener('scroll', function() {
    if (viewerOpen) {
        emitTo('viewer', 'scroll', { scrollFraction: getScrollFraction() });
    }
});

// ---------- Второй экран ----------
var secondScreenBtn = document.getElementById('secondScreenBtn');

async function openSecondScreen() {
    if (viewerOpen) return;
    try {
        var monitors = await invoke('list_monitors');
        if (monitors.length === 0) return;
        var monitorIndex = 0;

        if (monitors.length === 1) {
            monitorIndex = 0;
        } else {
            // Find the first monitor that is NOT the main window's monitor
            var otherIdx = -1;
            for (var i = 0; i < monitors.length; i++) {
                if (!monitors[i].is_main) { otherIdx = i; break; }
            }
            if (otherIdx >= 0) {
                monitorIndex = otherIdx;
            } else {
                monitorIndex = 0;
            }

            // If 3+ monitors, let user pick (default to the auto-detected other)
            if (monitors.length > 2) {
                var t = translations[currentLang];
                var names = monitors.map(function(m, i) {
                    var label = (i+1) + ': ' + m.name + ' (' + m.width + 'x' + m.height + ')';
                    if (m.is_main) label += ' [main]';
                    return label;
                }).join('\n');
                var choice = prompt(t.chooseMonitor + '\n' + names, String(monitorIndex + 1));
                if (!choice) return;
                monitorIndex = parseInt(choice, 10) - 1;
                if (isNaN(monitorIndex) || monitorIndex < 0 || monitorIndex >= monitors.length) {
                    monitorIndex = otherIdx >= 0 ? otherIdx : 0;
                }
            }
        }

        await invoke('open_viewer_on_monitor', { monitorIndex: monitorIndex });
        viewerOpen = true;
        document.body.classList.add('two-window-mode');
    } catch (e) { console.error('Failed to open viewer:', e); }
}

secondScreenBtn.addEventListener('click', function() {
    openSecondScreen();
});

// Checkbox показа списка песен на втором экране
if (showSongListCheckbox) {
    showSongListCheckbox.addEventListener('change', function() {
        showSongListOnViewer = showSongListCheckbox.checked;
        syncToViewer();
        scheduleAutoSave();
    });
}

// ---------- Экстренные сообщения ----------
var urgentMessageInput = document.getElementById('urgentMessageInput');
var sendUrgentBtn = document.getElementById('sendUrgentBtn');
var hideUrgentBtn = document.getElementById('hideUrgentBtn');
var urgentMessageDisplay = document.getElementById('urgentMessageDisplay');
var urgentMessageText = document.getElementById('urgentMessageText');
var urgentMessageTimeout = null;

// Отправка экстренного сообщения
if (sendUrgentBtn) {
    sendUrgentBtn.addEventListener('click', function() {
        var message = urgentMessageInput.value.trim();
        if (!message) return;

        if (viewerOpen) {
            emitTo('viewer', 'urgent-message', {
                text: message,
                duration: 30000
            });
        }
    });
}

// Убрать экстренное сообщение
if (hideUrgentBtn) {
    hideUrgentBtn.addEventListener('click', function() {
        if (viewerOpen) {
            emitTo('viewer', 'hide-urgent', {});
        }
    });
}

// Обработка экстренного сообщения на текущей странице
function showUrgentMessage(text, duration) {
    if (!urgentMessageDisplay || !urgentMessageText) return;

    urgentMessageText.textContent = text;
    urgentMessageDisplay.classList.add('visible');

    if (urgentMessageTimeout) {
        clearTimeout(urgentMessageTimeout);
    }

    urgentMessageTimeout = setTimeout(function() {
        hideUrgentMessage();
    }, duration || 30000);
}

function hideUrgentMessage() {
    if (!urgentMessageDisplay) return;
    urgentMessageDisplay.classList.remove('visible');
    if (urgentMessageTimeout) {
        clearTimeout(urgentMessageTimeout);
        urgentMessageTimeout = null;
    }
}

// ---------- Текст песни ----------
applyLyricsBtn.addEventListener('click', function() {
    var song = songs[selectedSongIndex];
    if (!song) return;
    song.text = lyricsInput.value || '';
    song.played = false;
    lyricsText.textContent = song.text;
    lyricsContainer.scrollTop = 0;
    renderSongList();
    syncToViewer();
    scheduleAutoSave();
});

// Импорт TXT — через Tauri native dialog
importTxtBtn.addEventListener('click', async function() {
    try {
        var files = await invoke('import_txt_dialog');
        if (!files || !files.length) return;

        if (files.length === 1) {
            // один файл в текущую песню
            var text = files[0].content || '';
            lyricsInput.value = text;
            var song = songs[selectedSongIndex];
            if (!song) return;
            song.text = text;
            song.played = false;
            lyricsText.textContent = text;
            lyricsContainer.scrollTop = 0;
            renderSongList();
        } else {
            // много файлов — создаём отдельную песню для каждого
            var firstNewIndex = null;
            files.forEach(function(file) {
                var fileText = file.content || '';
                var newIndex = createNewSong();
                var newSong = songs[newIndex];
                newSong.text = fileText;
                var baseName = (file.name || '').replace(/\.[^.]+$/, '');
                newSong.title = baseName || newSong.title;
                newSong.played = false;
                if (firstNewIndex === null) firstNewIndex = newIndex;
            });
            renderSongList();
            if (firstNewIndex !== null) {
                selectSong(firstNewIndex);
            }
        }
        scheduleAutoSave();
    } catch (e) {
        console.error('TXT import failed:', e);
    }
});

// ---------- Модальный редактор текста ----------
var lyricsEditorOverlay = document.getElementById('lyricsEditorOverlay');
var lyricsEditorArea = document.getElementById('lyricsEditorArea');
var openEditorBtn = document.getElementById('openEditorBtn');
var editorApplyBtn = document.getElementById('editorApplyBtn');
var editorCancelBtn = document.getElementById('editorCancelBtn');

if (openEditorBtn) {
    openEditorBtn.addEventListener('click', function() {
        lyricsEditorArea.value = lyricsInput.value;
        lyricsEditorOverlay.classList.add('visible');
        lyricsEditorArea.focus();
    });
}

if (editorApplyBtn) {
    editorApplyBtn.addEventListener('click', function() {
        lyricsInput.value = lyricsEditorArea.value;
        var song = songs[selectedSongIndex];
        if (song) {
            song.text = lyricsEditorArea.value || '';
            song.played = false;
            lyricsText.textContent = song.text;
            lyricsContainer.scrollTop = 0;
            renderSongList();
            syncToViewer();
            scheduleAutoSave();
        }
        lyricsEditorOverlay.classList.remove('visible');
    });
}

if (editorCancelBtn) {
    editorCancelBtn.addEventListener('click', function() {
        lyricsEditorOverlay.classList.remove('visible');
    });
}

// Esc закрывает редактор
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && lyricsEditorOverlay.classList.contains('visible')) {
        lyricsEditorOverlay.classList.remove('visible');
    }
});

// ---------- Проект: экспорт / импорт ----------

function exportProjectData() {
    var plainTriggers = songTriggers.map(function(t) {
        return { time: t.time, songIndex: t.songIndex };
    });
    return {
        version: 3,
        selectedSongIndex: selectedSongIndex,
        songs: songs,
        songTriggers: plainTriggers
    };
}

exportProjectBtn.addEventListener('click', async function() {
    var data = exportProjectData();
    try {
        await invoke('save_project_dialog', { data: JSON.stringify(data, null, 2) });
    } catch (e) {
        console.error('Export failed:', e);
    }
});

importProjectBtn.addEventListener('click', async function() {
    try {
        var content = await invoke('open_project_dialog');
        if (!content) return;
        var json = JSON.parse(content);
        if (!Array.isArray(json.songs)) {
            alert(currentLang === 'ru' ? 'Некорректный файл проекта.' : 'Invalid project file.');
            return;
        }
        songs = json.songs.map(function(s) {
            return Object.assign({}, defaultSong(), s);
        });
        if (!songs.length) {
            songs.push(defaultSong());
        }
        selectedSongIndex = Math.min(json.selectedSongIndex || 0, songs.length - 1);
        songCounter = songs.length + 1;
        songTriggers = Array.isArray(json.songTriggers)
            ? json.songTriggers.map(function(t) { return { time: t.time || 0, songIndex: t.songIndex || 0, _triggered: false }; })
            : [];
        renderSongList();
        renderTriggers();
        resetTriggerStates();
        loadSongIntoUI();
        startTimecode();
        scheduleAutoSave();
    } catch (e) {
        console.error('Import failed:', e);
        alert(currentLang === 'ru' ? 'Ошибка при чтении проекта.' : 'Error reading project.');
    }
});

// ---------- Локализация ----------
var languageSelect = document.getElementById('languageSelect');
languageSelect.addEventListener('change', function() {
    currentLang = languageSelect.value;
    updateUITexts(currentLang);
    renderTriggers();
    renderSongList();
    scheduleAutoSave();
});

// ---------- Таймкод ----------
var audioInputSelect = document.getElementById('audioInputSelect');
var timecodeClock = document.getElementById('timecodeClock');
var timecodeIntervalId = null;
var timecodeCurrentSeconds = 0;
var audioContext = null;
var analyser = null;
var microphoneSource = null;
var audioStream = null;
var decoder = null;
var timecodeLastFrameTimestamp = 0;

function startTimecode() {
    // Stop any previous interval
    if (timecodeIntervalId) {
        clearInterval(timecodeIntervalId);
        timecodeIntervalId = null;
    }
    timecodeCurrentSeconds = 0;
    timecodeLastFrameTimestamp = 0;
    resetTriggerStates();
    // Clean up previous audio context and stream
    if (audioContext) {
        try { audioContext.close(); } catch (e) { /* ignore */ }
        audioContext = null;
    }
    if (audioStream) {
        audioStream.getTracks().forEach(function(t) { t.stop(); });
        audioStream = null;
    }
    decoder = null;
    timecodeClock.textContent = '\u2014';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        timecodeClock.textContent = '\u2014';
        return;
    }
    var selectedDeviceId = audioInputSelect.value;
    navigator.mediaDevices
        .getUserMedia({ audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true })
        .then(function(stream) {
            audioStream = stream;
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            microphoneSource = audioContext.createMediaStreamSource(stream);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            microphoneSource.connect(analyser);
            decoder = new Decoder(audioContext.sampleRate);
            decoder.on('frame', function(frame) {
                var fps = decoder.framerate || 25;
                timecodeCurrentSeconds =
                    frame.hours * 3600 + frame.minutes * 60 + frame.seconds + frame.frames / fps;
                timecodeLastFrameTimestamp = Date.now();
                timecodeClock.textContent = formatTimecode(timecodeCurrentSeconds);
                checkSongTriggers();
                checkTimecodeMarkers();
            });
            var data = new Float32Array(analyser.fftSize);
            timecodeIntervalId = setInterval(function() {
                analyser.getFloatTimeDomainData(data);
                if (decoder) {
                    decoder.decode(data);
                }
                var now = Date.now();
                if (!timecodeLastFrameTimestamp || now - timecodeLastFrameTimestamp > 500) {
                    timecodeClock.textContent = '\u2014';
                }
            }, 40);
        })
        .catch(function(err) {
            console.error(err);
            timecodeClock.textContent = '\u2014';
            if (timecodeIntervalId) {
                clearInterval(timecodeIntervalId);
                timecodeIntervalId = null;
            }
        });
}

function pad(n) {
    return n.toString().padStart(2, '0');
}

function formatTimecode(totalSeconds) {
    var fps = (decoder && decoder.framerate) || 25;
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = Math.floor(totalSeconds % 60);
    var frames = Math.floor((totalSeconds - Math.floor(totalSeconds)) * fps);
    return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds) + ':' + pad(frames);
}

function parseTimecode(str) {
    if (!str) return 0;
    var parts = str.split(':').map(function(p) { return parseInt(p, 10) || 0; });
    if (parts.length === 4) {
        var fps = (decoder && decoder.framerate) || 25;
        return parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / fps;
    }
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return parts[0] || 0;
}

function populateAudioInputs(retry) {
    if (retry === undefined) retry = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then(function(devices) {
        var audioInputs = devices.filter(function(d) { return d.kind === 'audioinput'; });
        audioInputSelect.textContent = '';
        if (audioInputs.length === 0 || (audioInputs.length === 1 && audioInputs[0].label === '')) {
            var opt = document.createElement('option');
            opt.value = '';
            opt.textContent = translations[currentLang].noDevices;
            audioInputSelect.appendChild(opt);
            if (retry) {
                navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
                    stream.getTracks().forEach(function(t) { t.stop(); });
                    populateAudioInputs(false);
                }).catch(function() {});
            }
            return;
        }
        audioInputs.forEach(function(device) {
            var opt = document.createElement('option');
            opt.value = device.deviceId;
            opt.textContent = device.label || device.deviceId;
            audioInputSelect.appendChild(opt);
        });
    });
}

audioInputSelect.addEventListener('change', function() {
    startTimecode();
});

// ---------- Таймлайн (маркеры) ----------
var markersContainer = document.getElementById('markersContainer');
var addStartMarkerBtn = document.getElementById('addStartMarkerBtn');
var addPauseMarkerBtn = document.getElementById('addPauseMarkerBtn');
var addSpeedMarkerBtn = document.getElementById('addSpeedMarkerBtn');

function renderMarkers() {
    var song = songs[selectedSongIndex];
    if (!song) {
        markersContainer.textContent = '';
        return;
    }
    if (!Array.isArray(song.markers)) song.markers = [];
    song.markers.sort(function(a, b) { return (a.time || 0) - (b.time || 0); });
    markersContainer.textContent = '';
    song.markers.forEach(function(marker, index) {
        var row = document.createElement('div');
        row.className = 'marker-row';
        // type select
        var typeSelect = document.createElement('select');
        ['start', 'pause', 'change'].forEach(function(t) {
            var opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t === 'start' ? translations[currentLang].markerStart
                : t === 'pause' ? translations[currentLang].markerPause
                : translations[currentLang].markerSpeed;
            typeSelect.appendChild(opt);
        });
        typeSelect.value = marker.type || 'start';
        typeSelect.addEventListener('change', function() {
            marker.type = typeSelect.value;
            renderMarkers();
            scheduleAutoSave();
        });
        row.appendChild(typeSelect);
        // time input
        var timeInput = document.createElement('input');
        timeInput.type = 'text';
        timeInput.value = formatTimecode(marker.time || 0);
        timeInput.style.width = '90px';
        timeInput.addEventListener('change', function() {
            marker.time = parseTimecode(timeInput.value);
            renderMarkers();
            scheduleAutoSave();
        });
        row.appendChild(timeInput);
        // speed input (only for start and change)
        if (marker.type === 'start' || marker.type === 'change') {
            var speedInput = document.createElement('input');
            speedInput.type = 'number';
            speedInput.value = marker.speed || song.speed || 30;
            speedInput.min = 1;
            speedInput.max = 400;
            speedInput.step = 1;
            speedInput.style.width = '60px';
            speedInput.addEventListener('change', function() {
                marker.speed = parseInt(speedInput.value, 10) || 30;
                scheduleAutoSave();
            });
            row.appendChild(speedInput);
        }
        // remove button
        var removeBtn = document.createElement('button');
        removeBtn.textContent = '\u2715';
        removeBtn.title = translations[currentLang].remove;
        removeBtn.addEventListener('click', function() {
            song.markers.splice(index, 1);
            renderMarkers();
            scheduleAutoSave();
        });
        row.appendChild(removeBtn);
        markersContainer.appendChild(row);
    });
}

addStartMarkerBtn.addEventListener('click', function() {
    var song = songs[selectedSongIndex];
    if (!song) return;
    if (!Array.isArray(song.markers)) song.markers = [];
    song.markers.push({ type: 'start', time: timecodeCurrentSeconds || 0, speed: song.speed || 30 });
    renderMarkers();
    scheduleAutoSave();
});

addPauseMarkerBtn.addEventListener('click', function() {
    var song = songs[selectedSongIndex];
    if (!song) return;
    if (!Array.isArray(song.markers)) song.markers = [];
    song.markers.push({ type: 'pause', time: timecodeCurrentSeconds || 0 });
    renderMarkers();
    scheduleAutoSave();
});

if (addSpeedMarkerBtn) {
    addSpeedMarkerBtn.addEventListener('click', function() {
        var song = songs[selectedSongIndex];
        if (!song) return;
        if (!Array.isArray(song.markers)) song.markers = [];
        song.markers.push({ type: 'change', time: timecodeCurrentSeconds || 0, speed: song.speed || 30 });
        renderMarkers();
        scheduleAutoSave();
    });
}

function checkTimecodeMarkers() {
    var song = songs[selectedSongIndex];
    if (!song || !Array.isArray(song.markers) || song.markers.length === 0) return;
    if (song._lastTriggeredIndex == null) song._lastTriggeredIndex = -1;
    for (var i = song._lastTriggeredIndex + 1; i < song.markers.length; i++) {
        var mk = song.markers[i];
        if (timecodeCurrentSeconds >= (mk.time || 0)) {
            if (mk.type === 'start') {
                song.speed = mk.speed || song.speed;
                speedRange.value = song.speed;
                updateSpeedLabel(song.speed);
                startScroll();
            } else if (mk.type === 'pause') {
                pauseScroll();
            } else if (mk.type === 'change') {
                song.speed = mk.speed || song.speed;
                speedRange.value = song.speed;
                updateSpeedLabel(song.speed);
            }
            song._lastTriggeredIndex = i;
        } else {
            break;
        }
    }
}

// ---------- Триггеры песен ----------
var triggersContainer = document.getElementById('triggersContainer');
var addTriggerBtn = document.getElementById('addTriggerBtn');

function renderTriggers() {
    if (!triggersContainer) return;
    songTriggers.sort(function(a, b) { return (a.time || 0) - (b.time || 0); });
    triggersContainer.textContent = '';
    songTriggers.forEach(function(trigger, index) {
        var row = document.createElement('div');
        row.className = 'trigger-row';
        // выпадающий список песен
        var select = document.createElement('select');
        songs.forEach(function(s, idx) {
            var opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = s.title || translations[currentLang].untitled;
            select.appendChild(opt);
        });
        select.value = trigger.songIndex;
        select.addEventListener('change', function() {
            trigger.songIndex = parseInt(select.value, 10) || 0;
            scheduleAutoSave();
        });
        row.appendChild(select);
        // поле ввода времени
        var timeInput = document.createElement('input');
        timeInput.type = 'text';
        timeInput.value = formatTimecode(trigger.time || 0);
        timeInput.style.width = '90px';
        timeInput.addEventListener('change', function() {
            trigger.time = parseTimecode(timeInput.value);
            trigger._triggered = false;
            renderTriggers();
            scheduleAutoSave();
        });
        row.appendChild(timeInput);
        // кнопка удаления
        var removeBtn = document.createElement('button');
        removeBtn.textContent = '\u2715';
        removeBtn.title = translations[currentLang].remove;
        removeBtn.addEventListener('click', function() {
            songTriggers.splice(index, 1);
            renderTriggers();
            scheduleAutoSave();
        });
        row.appendChild(removeBtn);
        triggersContainer.appendChild(row);
    });
}

if (addTriggerBtn) {
    addTriggerBtn.addEventListener('click', function() {
        var trigger = {
            time: timecodeCurrentSeconds || 0,
            songIndex: selectedSongIndex || 0,
            _triggered: false
        };
        songTriggers.push(trigger);
        renderTriggers();
        scheduleAutoSave();
    });
}

function resetTriggerStates() {
    songTriggers.forEach(function(t) {
        t._triggered = false;
    });
}

function checkSongTriggers() {
    for (var i = 0; i < songTriggers.length; i++) {
        var trigger = songTriggers[i];
        if (!trigger._triggered && timecodeCurrentSeconds >= (trigger.time || 0)) {
            trigger._triggered = true;
            var idx = trigger.songIndex;
            if (typeof idx === 'number' && songs[idx]) {
                selectSong(idx);
                if (songs[idx]) songs[idx]._lastTriggeredIndex = -1;
                startScroll();
            }
        }
    }
}

// ---------- Синхронизация второго экрана ----------
function syncToViewer() {
    if (!viewerOpen) return;
    var song = songs[selectedSongIndex];
    if (!song) return;

    var songListData = songs.map(function(s, idx) {
        return {
            title: s.title || translations[currentLang].untitled,
            played: s.played,
            isCurrent: idx === selectedSongIndex
        };
    });

    emitTo('viewer', 'update-song', {
        text: song.text || '',
        style: {
            fontSize: song.fontSize,
            lineHeight: song.lineHeight,
            widthPercent: song.textWidthPercent,
            textAlign: song.textAlign,
            containerWidthPx: lyricsContainer.clientWidth
        },
        scrollFraction: getScrollFraction(),
        showSongList: showSongListOnViewer,
        songList: songListData,
        lang: currentLang
    });
}

// ---------- Хоткеи и полноэкранный режим ----------

function isEditingElement(target) {
    var tag = target.tagName;
    if (!tag) return false;
    var t = tag.toLowerCase();
    return t === 'input' || t === 'textarea';
}

async function toggleFullScreen() {
    // Only toggle fullscreen on viewer — main window stays windowed for controls
    if (viewerOpen) {
        emitTo('viewer', 'toggle-fullscreen', {});
    }
}

document.addEventListener('keydown', function(e) {
    if (isEditingElement(e.target)) return;

    var key = e.key;

    if (key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (isScrolling) {
            pauseScroll();
        } else {
            startScroll();
        }
        return;
    }

    if (key === 'Enter') {
        e.preventDefault();
        startScroll();
        return;
    }

    if (key === 'f' || key === 'F' || key === '\u0430' || key === '\u0410') {
        e.preventDefault();
        toggleFullScreen();
        return;
    }
});

// ---------- Auto-load ----------
async function autoLoad() {
    try {
        var content = await invoke('auto_load');
        if (!content) return false;
        var json = JSON.parse(content);
        if (!Array.isArray(json.songs) || !json.songs.length) return false;
        songs = json.songs.map(function(s) { return Object.assign({}, defaultSong(), s); });
        selectedSongIndex = Math.min(json.selectedSongIndex || 0, songs.length - 1);
        songCounter = songs.length + 1;
        songTriggers = Array.isArray(json.songTriggers)
            ? json.songTriggers.map(function(t) { return { time: t.time || 0, songIndex: t.songIndex || 0, _triggered: false }; })
            : [];
        return true;
    } catch (e) { console.error('Auto-load failed:', e); return false; }
}

// ---------- Инициализация ----------
(async function init() {
    var loaded = await autoLoad();
    if (!loaded) {
        var firstIndex = createNewSong();
        selectedSongIndex = firstIndex;
    }
    renderSongList();
    loadSongIntoUI();
    applyExtraBottomPadding();
    populateAudioInputs();
    startTimecode();
    updateUITexts(currentLang);
    renderTriggers();

    listen('viewer-ready', function() {
        viewerOpen = true;
        document.body.classList.add('two-window-mode');
        syncToViewer();
    });
    listen('viewer-closed', function() {
        viewerOpen = false;
        document.body.classList.remove('two-window-mode');
    });
})();
