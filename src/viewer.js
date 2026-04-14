var tauriEvent = window.__TAURI__.event;
var emitTo = tauriEvent.emitTo;
var listen = tauriEvent.listen;

var lyricsContainer = document.getElementById('lyricsContainer');
var lyricsText = document.getElementById('lyricsText');
var fullscreenHint = document.getElementById('fullscreenHint');
var urgentMessageDisplay = document.getElementById('urgentMessageDisplay');
var urgentMessageText = document.getElementById('urgentMessageText');
var viewerSongListItemsEl = document.getElementById('viewerSongListItems');

var urgentMessageTimeout = null;

// --- Fullscreen ---
// The viewer opens as a borderless window covering the entire monitor.
// No native fullscreen (avoids macOS Spaces black-screen issue).
// Hide the fullscreen hint immediately since we're already "fullscreen".
document.body.classList.add('is-fullscreen');

// F key — no-op (window already covers the monitor)
document.addEventListener('keydown', function(e) {
    var key = e.key;
    if (key === 'f' || key === 'F' || key === '\u0430' || key === '\u0410') {
        e.preventDefault();
    }
});

// Hide hint (already fullscreen-like)
if (fullscreenHint) {
    fullscreenHint.style.display = 'none';
}

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
    if (typeof msg.scrollFraction === 'number') {
        var maxScroll = lyricsContainer.scrollHeight - lyricsContainer.clientHeight;
        lyricsContainer.scrollTop = msg.scrollFraction * maxScroll;
    }
    if (msg.showSongList) {
        document.body.classList.add('show-song-list');
        renderViewerSongList(msg.songList, msg.lang);
    } else {
        document.body.classList.remove('show-song-list');
    }
});

listen('scroll', function(event) {
    var msg = event.payload;
    if (typeof msg.scrollFraction === 'number') {
        var maxScroll = lyricsContainer.scrollHeight - lyricsContainer.clientHeight;
        lyricsContainer.scrollTop = msg.scrollFraction * maxScroll;
    }
});

listen('urgent-message', function(event) {
    var msg = event.payload;
    showUrgentMessage(msg.text, msg.duration);
});

listen('hide-urgent', function() {
    hideUrgentMessage();
});

// --- Init ---

(function init() {
    emitTo('main', 'viewer-ready', {});
})();
