const translations = {
    ru: {
        songs: 'Песни', addSong: 'Добавить песню',
        resetPlayed: 'Сбросить проигранные', resetPlayedTitle: 'Сбросить отметки проигранных песен',
        songPanel: 'Песня', songTitlePlaceholder: 'Название песни',
        deleteSong: 'Удалить песню',
        songDeleteNote: 'Удалить можно любую, кроме последней — она будет просто очищена.',
        displayPanel: 'Отображение',
        fontSize: 'Размер шрифта ', lineHeight: 'Межстрочный интервал ',
        textWidth: 'Ширина текста ',
        textWidthNote: 'Регулирует ширину области текста по центру экрана.',
        alignment: 'Выравнивание', alignCenter: 'По центру', alignLeft: 'По левому краю',
        scrollPanel: 'Прокрутка', bySpeed: 'По скорости', byDuration: 'По длительности',
        scrollSpeed: 'Скорость прокрутки ',
        scrollSpeedNote: 'Чем больше значение, тем быстрее движется текст.',
        songDuration: 'Длительность песни ',
        durationNoteHtml: 'Например: <b>3:45</b> или <b>225</b>.',
        start: 'Старт (Enter)', pauseResume: 'Пауза / Продолжить (Space)',
        stop: 'Стоп', toTop: 'В начало', secondScreen: 'Второй экран',
        fullscreenNoteHtml: 'Полноэкранный режим — клавиша <b>F</b> или <b>А</b> (русская раскладка).',
        titleLabel: 'Название:', lyricsPanel: 'Текст песни',
        lyricsPlaceholder: 'Введите текст песни здесь...',
        applyLyrics: 'Обновить текст', importTxt: 'Импорт TXT',
        lyricsNoteHtml: 'Русский текст поддерживается (UTF-8).<br>Для .doc/.docx лучше предварительно сохранить как .txt.',
        projectPanel: 'Проект', exportProject: 'Экспорт проекта', importProject: 'Импорт проекта',
        projectNote: 'Экспортирует все песни и настройки в один JSON-файл.',
        timecodePanel: 'Таймкод', audioInput: 'Аудио вход:',
        timelinePanel: 'Таймлайн', addStart: 'Добавить старт',
        addPause: 'Добавить паузу', addSpeed: 'Добавить скорость',
        triggersPanel: 'Привязка песен', addTrigger: 'Добавить привязку',
        secondScreenPanel: 'Второй экран', showSongList: 'Показать список песен',
        showSongListNote: 'На втором экране будет отображаться список песен слева от текста.',
        urgentMessagePanel: 'Экстренное сообщение',
        urgentPlaceholder: 'Введите срочное сообщение...',
        send: 'Отправить', hideMessage: 'Убрать сообщение',
        urgentNote: 'Сообщение появится на втором экране на 30 сек.',
        loveNote: 'С любовью из России',
        noDevices: 'Нет устройств', untitled: 'Без названия', songPrefix: 'Песня',
        markerStart: 'Старт', markerPause: 'Пауза', markerSpeed: 'Скорость',
        remove: 'Удалить', songListHeader: 'Список песен',
        fullscreenHint: 'Нажмите F для полноэкранного режима',
        chooseMonitor: 'Выберите монитор (введите номер):',
    },
    en: {
        songs: 'Songs', addSong: 'Add song',
        resetPlayed: 'Reset played', resetPlayedTitle: 'Reset played songs',
        songPanel: 'Song', songTitlePlaceholder: 'Song title',
        deleteSong: 'Delete song',
        songDeleteNote: 'You can delete any song except the last one — it will just be cleared.',
        displayPanel: 'Display',
        fontSize: 'Font size ', lineHeight: 'Line height ',
        textWidth: 'Text width ',
        textWidthNote: 'Adjusts the width of the text area in the center of the screen.',
        alignment: 'Alignment', alignCenter: 'Center', alignLeft: 'Left',
        scrollPanel: 'Scroll', bySpeed: 'By speed', byDuration: 'By duration',
        scrollSpeed: 'Scroll speed ',
        scrollSpeedNote: 'The larger the value, the faster the text moves.',
        songDuration: 'Song duration ',
        durationNoteHtml: 'For example: <b>3:45</b> or <b>225</b>.',
        start: 'Start (Enter)', pauseResume: 'Pause / Resume (Space)',
        stop: 'Stop', toTop: 'To top', secondScreen: 'Second screen',
        fullscreenNoteHtml: 'Fullscreen mode — key <b>F</b>.',
        titleLabel: 'Title:', lyricsPanel: 'Lyrics',
        lyricsPlaceholder: 'Enter lyrics here...',
        applyLyrics: 'Apply lyrics', importTxt: 'Import TXT',
        lyricsNoteHtml: 'Russian text is supported (UTF-8).<br>For .doc/.docx it is better to save as .txt first.',
        projectPanel: 'Project', exportProject: 'Export project', importProject: 'Import project',
        projectNote: 'Exports all songs and settings into a single JSON file.',
        timecodePanel: 'Timecode', audioInput: 'Audio input:',
        timelinePanel: 'Timeline', addStart: 'Add start',
        addPause: 'Add pause', addSpeed: 'Add speed change',
        triggersPanel: 'Song triggers', addTrigger: 'Add trigger',
        secondScreenPanel: 'Second screen', showSongList: 'Show song list',
        showSongListNote: 'The second screen will display the song list on the left side of the text.',
        urgentMessagePanel: 'Urgent message',
        urgentPlaceholder: 'Enter urgent message...',
        send: 'Send', hideMessage: 'Hide message',
        urgentNote: 'Message will appear on second screen for 30 sec.',
        loveNote: 'With Love From Russia',
        noDevices: 'No devices', untitled: 'Untitled', songPrefix: 'Song',
        markerStart: 'Start', markerPause: 'Pause', markerSpeed: 'Speed',
        remove: 'Remove', songListHeader: 'Song list',
        fullscreenHint: 'Press F for fullscreen mode',
        chooseMonitor: 'Choose monitor (enter number):',
    }
};

function updateUITexts(lang) {
    var t = translations[lang] || translations.ru;

    document.querySelector('#leftSidebar .sidebar-header span').textContent = t.songs;
    document.getElementById('addSongBtn').title = t.addSong;
    document.getElementById('resetPlayedBtn').textContent = t.resetPlayed;
    document.getElementById('resetPlayedBtn').title = t.resetPlayedTitle;

    document.getElementById('songPanelTitle').textContent = t.songPanel;
    document.getElementById('songTitleInput').placeholder = t.songTitlePlaceholder;
    document.getElementById('deleteSongBtn').textContent = t.deleteSong;
    document.getElementById('songDeleteNote').textContent = t.songDeleteNote;

    document.getElementById('displayPanelTitle').textContent = t.displayPanel;
    var fontLbl = document.getElementById('fontSizeRange').closest('label');
    if (fontLbl) fontLbl.childNodes[0].textContent = t.fontSize;
    var lhLbl = document.getElementById('lineHeightRange').closest('label');
    if (lhLbl) lhLbl.childNodes[0].textContent = t.lineHeight;
    var wLbl = document.getElementById('textWidthRange').closest('label');
    if (wLbl) wLbl.childNodes[0].textContent = t.textWidth;
    document.getElementById('textWidthNote').textContent = t.textWidthNote;

    var alignLbl = document.getElementById('textAlignLabel');
    if (alignLbl) alignLbl.textContent = t.alignment;
    var acOpt = document.getElementById('textAlignCenterOption');
    if (acOpt) acOpt.textContent = t.alignCenter;
    var alOpt = document.getElementById('textAlignLeftOption');
    if (alOpt) alOpt.textContent = t.alignLeft;

    document.getElementById('scrollPanelTitle').textContent = t.scrollPanel;
    document.getElementById('scrollSpeedModeLabel').textContent = t.bySpeed;
    document.getElementById('scrollDurationModeLabel').textContent = t.byDuration;
    var spLbl = document.getElementById('speedRange').closest('label');
    if (spLbl) spLbl.childNodes[0].textContent = t.scrollSpeed;
    document.getElementById('scrollSpeedNote').textContent = t.scrollSpeedNote;
    var durLbl = document.getElementById('durationInput').closest('label');
    if (durLbl) durLbl.childNodes[0].textContent = t.songDuration;
    document.querySelector('#durationControls .small-note').innerHTML = t.durationNoteHtml;

    document.getElementById('startBtn').textContent = t.start;
    document.getElementById('pauseBtn').textContent = t.pauseResume;
    document.getElementById('stopBtn').textContent = t.stop;
    document.getElementById('topBtn').textContent = t.toTop;
    document.getElementById('secondScreenBtn').textContent = t.secondScreen;
    document.getElementById('fullscreenNote').innerHTML = t.fullscreenNoteHtml;

    var stLbl = document.getElementById('songTitleLabel');
    if (stLbl) stLbl.childNodes[0].textContent = t.titleLabel;

    document.getElementById('lyricsPanelTitle').textContent = t.lyricsPanel;
    document.getElementById('lyricsInput').placeholder = t.lyricsPlaceholder;
    document.getElementById('applyLyricsBtn').textContent = t.applyLyrics;
    document.getElementById('importTxtBtn').textContent = t.importTxt;
    document.getElementById('lyricsNote').innerHTML = t.lyricsNoteHtml;

    document.getElementById('projectPanelTitle').textContent = t.projectPanel;
    document.getElementById('exportProjectBtn').textContent = t.exportProject;
    document.getElementById('importProjectBtn').textContent = t.importProject;
    document.getElementById('projectNote').textContent = t.projectNote;

    document.getElementById('timecodePanelTitle').textContent = t.timecodePanel;
    document.getElementById('audioInputLabel').textContent = t.audioInput;

    document.getElementById('timelinePanelTitle').textContent = t.timelinePanel;
    document.getElementById('addStartMarkerBtn').textContent = t.addStart;
    document.getElementById('addPauseMarkerBtn').textContent = t.addPause;
    var asBtn = document.getElementById('addSpeedMarkerBtn');
    if (asBtn) asBtn.textContent = t.addSpeed;

    var trTitle = document.getElementById('triggersPanelTitle');
    if (trTitle) trTitle.textContent = t.triggersPanel;
    var atBtn = document.getElementById('addTriggerBtn');
    if (atBtn) atBtn.textContent = t.addTrigger;

    var ssTitle = document.getElementById('secondScreenPanelTitle');
    if (ssTitle) ssTitle.textContent = t.secondScreenPanel;
    var slLbl = document.getElementById('showSongListLabel');
    if (slLbl) slLbl.textContent = t.showSongList;
    var slNote = document.getElementById('showSongListNote');
    if (slNote) slNote.textContent = t.showSongListNote;

    var umTitle = document.getElementById('urgentMessagePanelTitle');
    if (umTitle) umTitle.textContent = t.urgentMessagePanel;
    var umInput = document.getElementById('urgentMessageInput');
    if (umInput) umInput.placeholder = t.urgentPlaceholder;
    var suBtn = document.getElementById('sendUrgentBtn');
    if (suBtn) suBtn.textContent = t.send;
    var huBtn = document.getElementById('hideUrgentBtn');
    if (huBtn) huBtn.textContent = t.hideMessage;
    var umNote = document.getElementById('urgentMessageNote');
    if (umNote) umNote.textContent = t.urgentNote;

    document.getElementById('loveNote').textContent = t.loveNote;
}
