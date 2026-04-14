var tauriEvent = window.__TAURI__.event;
var emitTo = tauriEvent.emitTo;
var listen = tauriEvent.listen;
var getCurrentWindow = window.__TAURI__.window.getCurrentWindow;

var lyricsContainer = document.getElementById('lyricsContainer');
var lyricsText = document.getElementById('lyricsText');
var fullscreenHint = document.getElementById('fullscreenHint');
var urgentMessageDisplay = document.getElementById('urgentMessageDisplay');
var urgentMessageText = document.getElementById('urgentMessageText');
var viewerSongListItemsEl = document.getElementById('viewerSongListItems');

var urgentMessageTimeout = null;

// --- Fullscreen management ---

async function updateFullscreenState() {
    var appWindow = getCurrentWindow();
    var isFs = await appWindow.isFullscreen();
    document.body.classList.toggle('is-fullscreen', isFs);
}

async function toggleFullscreen() {
    var appWindow = getCurrentWindow();
    var isFs = await appWindow.isFullscreen();
    await appWindow.setFullscreen(!isFs);
    document.body.classList.toggle('is-fullscreen', !isFs);
}

if (fullscreenHint) {
    fullscreenHint.addEventListener('click', async function() {
        var appWindow = getCurrentWindow();
        await appWindow.setFullscreen(true);
        document.body.classList.add('is-fullscreen');
    });
}

document.addEventListener('keydown', function(e) {
    var key = e.key;
    if (key === 'f' || key === 'F' || key === '\u0430' || key === '\u0410') {
        e.preventDefault();
        toggleFullscreen();
    }
});

// --- Urgent messages ---

function showUrgentMessage(text, duration) {
    if (!urgentMessageDisplay || !urgentMessageText) return;
    urgentMessageText.textContent = text;
    urgentMessageDisplay.classList.add('visible');
    if (urgentMessageTimeout) clearTimeout(urgentMessageTimeout);
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

// --- Viewer song list ---

function renderViewerSongList(songList, lang) {
    if (!viewerSongListItemsEl || !Array.isArray(songList)) return;
    viewerSongListItemsEl.textContent = '';

    var header = document.querySelector('#viewerSongList .viewer-song-header');
    if (header) {
        header.textContent = lang === 'ru' ? 'Список песен' : 'Song list';
    }

    songList.forEach(function(song, index) {
        var item = document.createElement('div');
        item.className = 'viewer-song-item';
        if (song.isCurrent) {
            item.classList.add('current');
        } else if (song.played) {
            item.classList.add('played');
        } else {
            item.classList.add('pending');
        }
        item.textContent = (index + 1) + '. ' + song.title;
        viewerSongListItemsEl.appendChild(item);
    });
}

// --- Tauri event listeners ---

listen('update-song', function(event) {
    var msg = event.payload;
    lyricsText.textContent = msg.text || '';
    if (msg.style) {
        lyricsText.style.fontSize = (msg.style.fontSize || 32) + 'px';
        lyricsText.style.lineHeight = msg.style.lineHeight || 0.8;
        lyricsContainer.style.maxWidth = (msg.style.widthPercent || 100) + '%';
        if (msg.style.textAlign) {
            lyricsText.style.textAlign = msg.style.textAlign;
            if (msg.style.textAlign === 'left') {
                lyricsText.classList.add('align-left');
            } else {
                lyricsText.classList.remove('align-left');
            }
        }
    }
    if (typeof msg.scrollTop === 'number') {
        lyricsContainer.scrollTop = msg.scrollTop;
    }
    if (msg.showSongList) {
        document.body.classList.add('show-song-list');
        renderViewerSongList(msg.songList, msg.lang);
    } else {
        document.body.classList.remove('show-song-list');
    }
    if (fullscreenHint && msg.lang) {
        fullscreenHint.textContent = msg.lang === 'ru'
            ? 'Нажмите F для полноэкранного режима'
            : 'Press F for fullscreen mode';
    }
});

listen('scroll', function(event) {
    var msg = event.payload;
    if (typeof msg.scrollTop === 'number') {
        lyricsContainer.scrollTop = msg.scrollTop;
    }
});

listen('enter-fullscreen', async function() {
    var appWindow = getCurrentWindow();
    await appWindow.setFullscreen(true);
    document.body.classList.add('is-fullscreen');
});

listen('exit-fullscreen', async function() {
    var appWindow = getCurrentWindow();
    await appWindow.setFullscreen(false);
    document.body.classList.remove('is-fullscreen');
});

listen('urgent-message', function(event) {
    var msg = event.payload;
    showUrgentMessage(msg.text, msg.duration);
});

listen('hide-urgent', function() {
    hideUrgentMessage();
});

// --- Init ---

(async function init() {
    await updateFullscreenState();
    emitTo('main', 'viewer-ready', {});
})();
