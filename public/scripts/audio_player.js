import {
    shuffle,
    getScrollbarWidth,
    generateClientFileHash,
    debounce,
    throttle,
    eventManager
} from './function_storage.js';
import { configClassic } from './controls_config_classic.js';
import { configStylish } from './controls_config_stylish.js';
import { HoverIntent } from './hover_intent.js';
import { v4 as uuidv4 } from './libs/uuid_esm_browser/index.js';

console.log(localStorage);
//localStorage.clear();

// Constants-anchors
const
    cssRoot = document.querySelector(':root'),
    preloader = document.getElementById('preloader'),
    audioPlayerContainer = document.getElementById('audio-player-container'),
    tracklistDatabase = document.getElementById('tracklist-database'),
    tracklistDtbsTitle = tracklistDatabase.querySelector('#tracklist-database-title'),
    tracklistsContainer = document.getElementById('tracklists-container'),
    createTracklistBtn = document.getElementById('create-tracklist'),
    sortTracklistsBtn = document.getElementById('sort-tracklists'),
    expandAllTrlDetailsBtn = document.getElementById('expand-all-tracklist-details'),
    collapseAllTrlDetailsBtn = document.getElementById('collapse-all-tracklist-details'),
    clearPlaylistBtn = document.getElementById('clear-playlist'),
    tracklistDtbsBtn = document.getElementById('tracklist-database-button'),
    audioPlayer = document.getElementById('audio-player'),
    tooltip = document.getElementById('tooltip'),
    startInfoDisplay = document.getElementById('start-info-display'),
    trackTitleDisplay = document.getElementById('title-display'),
    artistNameDisplay = document.getElementById('artist-display'),
    curTimeDisplay = document.getElementById('current-time'),
    durationDisplay = document.getElementById('duration'),
    buffersContainer = document.getElementById('buffers-container'),
    timeRange = document.getElementById('time-range'),
    timeLine = document.getElementById('time-line'),
    timeBar = document.getElementById('time-bar'),
    audioControls = document.querySelector('audio-controls'),
    playPauseBtn = document.getElementById('play-pause'),
    stopBtn = document.getElementById('stop'),
    rewindBtn = document.getElementById('rewind'),
    forwardBtn = document.getElementById('forward'),
    indicator = document.getElementById('indicator'),
    shuffleBtn = document.getElementById('shuffle'),
    repeatBtn = document.getElementById('repeat'),
    volumeBtn = document.getElementById('volume'),
    volumeRange = document.getElementById('volume-range'),
    volumeLine = document.getElementById('volume-line'),
    volumeBar = document.getElementById('volume-bar'),
    playlistContainer = document.getElementById('playlist-container'),
    playlistLim = document.getElementById('playlist-limiter'),
    visPlaylistArea = document.getElementById('visible-playlist-area'),
    playlist = document.getElementById('playlist'),
    playlistScrollArrowUp = document.getElementById('playlist-scroll-arrow-up'),
    playlistScrollArrowDown = document.getElementById('playlist-scroll-arrow-down'),
    tempTrackStorage = document.getElementById('temporary-track-storage'),
    configBtn = document.getElementById('configuration'),
    colorBtn = document.getElementById('coloring'),
    playlistStyleBtn = document.getElementById('playlist-style'),
    settingsBtn = document.getElementById('settings'),
    keysInfoBtn = document.getElementById('info'),
    settingsArea = document.getElementById('settings-area'),
    settingsTitle = document.getElementById('settings-title'),
    curPlaylist = document.getElementById('current-playlist'),
    addOptionsCheckbox = document.getElementById('additional-options-checkbox'),
    defaultSettingsBtn = document.getElementById('default-settings'),
    docScrollArrowsContainer = document.getElementById('document-scroll-arrows-container'),
    docScrollArrowUp = document.getElementById('document-scroll-arrow-up'),
    docScrollArrowDown = document.getElementById('document-scroll-arrow-down'),
    keysInfoWin = document.getElementById('keys-info-window'),
    tracklistDelWin = document.getElementById('tracklist-deletion'),
    tracklistMgrWin = document.getElementById('tracklist-manager')
;

// Calculated and transformed constants
const 
    initAudioPlayerContainerStyle = getComputedStyle(audioPlayerContainer),
    initTracklistDtbsStyle = getComputedStyle(tracklistDatabase),
    audioPlayerContainerPaddingBottom = parseInt(initAudioPlayerContainerStyle.paddingBottom),
    commonBorderRadius = parseInt(initAudioPlayerContainerStyle.getPropertyValue('--common-border-radius')),
    commonSpacing = parseInt(initAudioPlayerContainerStyle.getPropertyValue('--common-spacing')),
    minTracklistDtbsWidth = parseInt(initTracklistDtbsStyle.minWidth),
    maxTracklistDtbsWidth = parseInt(initTracklistDtbsStyle.maxWidth),
    settingsAreaWidth = getSettingsAreaWidth(),
    defTracklistDtbsBtnHeight = parseInt(
        getComputedStyle(tracklistDtbsBtn.parentElement).getPropertyValue('--default-height')
    ),
    siteFooterHeight = parseInt(getComputedStyle(cssRoot).getPropertyValue('--site-footer-height')),
    playlistScrollArrowBoxHeight = playlistContainer.querySelector('.playlist-scroll-arrow-box').offsetHeight,
    timeLineMrgnLeft = Math.abs(parseInt(getComputedStyle(timeLine).marginLeft)), 
    trackHeight = parseInt(getComputedStyle(playlistLim).getPropertyValue('--track-height')),
    origDocWidth = getDocWidth()
;

// Setted constants
const 
    MIN_PAGE_LOAD_TIME = 500,
    MAX_TRACK_FILE_SIZE = 25 * 1024 * 1024, // Limit: 25MB
    MAX_COVER_FILE_SIZE = 1 * 1024 * 1024, // Limit: 1MB
    CHUNK_SIZE = 64 * 1024, // 64 KB
    MAX_LOADED_AUDIOS = 5,
    TIMELINE_FIXED_STEP = 2,
    TIMELINE_UPDATE_INTERVAL = 200,
    SET_CURRENT_TIME_THROTTLE_DELAY = 100,
    INPUT_VALIDATION_DELAY = 300,
    LAG = 16.7,
    ACCELERATION_FACTOR = 5,
    ACCELERATION_DELAY = 750,
    DEFAULT_SCROLLING_TIME = 150,
    KEY_SCROLLING_TIME = 120,
    PLAYLIST_FINISH_DELAY = 500,
    HIDE_SCROLL_ELEMENTS_DELAY = 500,
    RETURN_FOCUS_DELAY = 500
;

// Objects, Arrays, Maps, Sets
const
    origOrderedAudios = [],
    orderedDownloads = [],
    tracklistDatabaseUpdates = {},
    tooltipHoverIntentByElem = new WeakMap(),
    tracklistsExpandedState = new Map(),
    fixedCurPlaylistStrings = new Map(),
    highlightedBtns = new Map(),
    fileByInput = new Map(),
    cachedAudioPool = new Set(),
    activeToggledTrlDetails = new Set(),
    activeScrollKeys = new Set(),
    activeStepAccKeys = new Set(),
    canceledStepAccKeys = new Set(),
    titleMoveTimers = {},
    animationDelays = {},
    tracklistUpdateRegistry = {}
;

// Events
const 
    eventPointerMove = new Event('pointermove'),
    eventEndScrollingPlaylist = new CustomEvent('endScrollingPlaylist'),
    eventEndTracksRemoving = new CustomEvent('endTracksRemoving'),
    eventEndTacklistDtbsAnimation = new CustomEvent('endTacklistDtbsAnimation'),
    eventSortTracklists = new CustomEvent('sortTracklists')
;

// Variables
let
    scrollbarWidth = getScrollbarWidth(),
    currOrderedAudios = [],
    accelerateScrolling = false,
    pointerModeScrolling = false,
    activeScrollAndAlign = false,
    activeScrollOnKeyRepeat = false,
    activeScrollInPointerMode = false,
    cursorOverPlaylist = false,
    scrollablePlaylist = false,
    scrollElemsDisplaying = false,
    playOn = false,
    timePosSeeking = false,
    timeRangeEnter = false,
    timeLinePos = 0,
    timerSeekTimeout = null,
    timerTimeLineUpd = null,
    timerAccelerateAudioDelay = null,
    timerFinishPlay = null,
    timerHideScrollElems = null,
    timerReturnFocusDelay = null,
    timerAccelerateScrolling = null,
    timerSkipUpdatingTrack = null,
    requestCheckCurTime = null,
    requestCheckScrollabilities = null,
    requestAligningScroll = null,
    requestScrollInPointerMode = null,
    requestScrollOnKeyRepeat = null,
    highlightActiveElem = null,
    savedActiveElem = null,
    playlistLimScrollDirection = null,
    playlistLimScrollTop = 0,
    curAccelerateKey = null,
    acceleratePlaying = true,
    acceleration = false,
    accelerationType = 'none',
    removingTracksCount = 0,
    userInitiatedFocus = true,
    selectedAudio = null,
    tracklistsCollection
;

const DEFAULTS_DATA = {
    'cover-source': 'img/def_covers/no_cover_2.png',
    'visible-tracks__classic-config': 8,
    'visible-tracks__stylish-config': 6,
    'audio-player-volume': 0.75,
    'scroll-elements-opacity': 70,
    'wheel-scroll-step': 2
};

const executeTaskHoverIntentStrategies = {
    'time-range': executeTimeRangeTask,
    'volume-range': executeVolumeRangeTask
};

const accelerationData = {
    types: {
        'fast-forward': {
            playbackRate: ACCELERATION_FACTOR,
            classIcons: {
                accOn: 'icon-fast-forward',
                accOff: 'icon-to-end'
            },
            button: forwardBtn,
            accelerationSign: 1
        },
        'fast-rewind': {
            playbackRate: -ACCELERATION_FACTOR,
            classIcons: {
                accOn: 'icon-fast-backward',
                accOff: 'icon-to-start'
            },
            button: rewindBtn,
            accelerationSign: -1
        },
        'none': {
            playbackRate: 1
        }
    },

    keys: {
        KeyA: {
            stepFunc: stepBack,
            accelerationType: 'fast-rewind',
            button: rewindBtn
        },
        KeyD: {
            stepFunc: stepForward,
            accelerationType: 'fast-forward',
            button: forwardBtn
        },
        ArrowLeft: {
            stepFunc: stepBack,
            accelerationType: 'fast-rewind',
            button: rewindBtn
        },
        ArrowRight: {
            stepFunc: stepForward,
            accelerationType: 'fast-forward',
            button: forwardBtn
        },
        PointerRewind: {
            stepFunc: stepBack,
            accelerationType: 'fast-rewind',
            button: rewindBtn
        },
        PointerForward: {
            stepFunc: stepForward,
            accelerationType: 'fast-forward',
            button: forwardBtn
        }
    }
};

const scrollingKeysData = {
    'ArrowUp': {
        direction: 'up',
        factor: 1,
        deltaHeight: function() { return trackHeight * this.factor }
    },
    'ArrowDown': {
        direction: 'down',
        factor: 1,
        deltaHeight: function() { return trackHeight * this.factor }
    },
    'PageUp': {
        direction: 'up',
        factor: 3,
        deltaHeight: function() { return trackHeight * this.factor }
    },
    'PageDown': {
        direction: 'down',
        factor: 3,
        deltaHeight: function() { return trackHeight * this.factor }
    },
    'Home': {
        direction: 'up',
        deltaHeight: function() { return playlistLim.scrollTop }
    },
    'End': {
        direction: 'down',
        deltaHeight: function() {
            return playlistLim.scrollHeight - (playlistLim.scrollTop + playlistLim.clientHeight)
        }
    }
};

const scrollEndStates = new Proxy(
    {
        curPlaylist: true,
        document: true
    },
    {
        set(target, prop, value, receiver) {
            target[prop] = value;

            const isAllScrollsEnded = Object.values(target).every(val => val);

            if (isAllScrollsEnded && highlightActiveElem) {
                clearTimeout(timerReturnFocusDelay);
            
                timerReturnFocusDelay = setTimeout(() => {
                    const isTrackInfoBox = highlightActiveElem.matches('.track-info-box');
                    let isFocusedTrackInView;
                    
                    if (isTrackInfoBox) {
                        const focusedTrack = highlightActiveElem.closest('.track');
                        isFocusedTrackInView = isElementVisibleInScrollableContainer(playlistLim, focusedTrack);
                    }

                    userInitiatedFocus = false;
                    highlightActiveElem.focus({ preventScroll: highlightActiveElem === visPlaylistArea });
                    userInitiatedFocus = true;

                    if (isTrackInfoBox && !isFocusedTrackInView) {
                        const focusedTrack = highlightActiveElem.closest('.track');
                        const selectedTrack = selectedAudio.closest('.track');

                        showScrollElems();
                        scrollAndAlignPlaylist({
                            direction: focusedTrack.offsetTop < selectedTrack.offsetTop ? 'up' : 'down',
                            duration: KEY_SCROLLING_TIME,
                            hide: true
                        });
                    }

                    highlightActiveElem = null;
                }, RETURN_FOCUS_DELAY);
            }

            return Reflect.set(target, prop, value, receiver);
        }
    }
);

const allowedAudioTypes = ['audio/mpeg', 'audio/flac', 'audio/wav'];

///////////////////////////
/// Selected track info ///
///////////////////////////

function showTrackInfo(audio, prevSelectedAudio = null) {
    startInfoDisplay.hidden = true;

    keepSelectedTitleVisible(audio);
    tooltipHoverIntentByElem.get(timeRange).executeTask();

    if (audio !== prevSelectedAudio) {
        if (prevSelectedAudio) {
            clearBuffersContainer();
            disconnectAudioHandlers(prevSelectedAudio);
            removeTemporaryTrack(prevSelectedAudio);
        }

        connectAudioHandlers(audio);
        updateSelectedTrackDisplays(audio);
        visualizeAudioBuffering(audio);

        audio.volume = settedVolume;
    }
    
    if (audio.duration) {
        updateCurrentTime(audio);
        updateDuration(audio);
    } else {
        updateCurrentTime(null, { displayStr: '??:??' });
        updateDuration(null, { displayStr: '??:??' });

        audio.ondurationchange = () => {
            if (audio !== selectedAudio) return;

            updateDuration(audio);
            audio.currentTime = timeLinePos * audio.duration / timeRange.offsetWidth;

            if (acceleration) {
                stopAudioUpdaters();
                startAudioUpdaters(audio);
            } else {
                updateCurrentTime(audio);
            }

            tooltipHoverIntentByElem.get(timeRange).executeTask();
        };
    }

    updateTimeLine(audio);
}

function connectAudioHandlers(audio) {
    audio.onplaying = () => {
        hideLoading(audio);

        if (audio === selectedAudio && playOn && !timePosSeeking) {
            console.log('playing | ' + audio.dataset.title);

            stopAudioUpdaters();
            audio.muted = false;
            indicator.classList.add('active');

            try {
                audio.playbackRate = accelerationData.types[accelerationType].playbackRate;
            } catch(error) {
                console.error(error.name + ': ' + error.message);
        
                if (error.name === 'NotSupportedError') {
                    acceleratePlaying = false;
                    audio.pause();
                }
            }

            startAudioUpdaters(audio);
            saveLastPlayedAudioInfo(audio);
        } else {
            console.log('pause after ready | ' + audio.dataset.title);

            audio.pause();

            if (audio !== selectedAudio) audio.onplaying = null;
        }
    };
    
    audio.onended = () => {
        if (timePosSeeking) return;
        if (timerFinishPlay) return;
        if (acceleration && accelerationType === 'fast-rewind') return;

        if (acceleration && accelerationType === 'fast-forward') {
            console.log(`track ended in ${accelerationType} | ${audio.dataset.title}`);
        } else if (!acceleration) {
            console.log('track ended | ' + audio.dataset.title);
        }

        finishTrack(audio);
    };

    audio.onpause = () => {
        indicator.classList.remove('active');
    };

    audio.onwaiting = () => {
        console.log('waiting | ' + audio.dataset.title);

        stopAudioUpdaters();
        showLoading(audio);
        audio.muted = true;

        if (acceleration) startAudioUpdaters(audio);
    };
    
    audio.onseeking = () => {
        clearTimeout(timerSeekTimeout);

        timerSeekTimeout = setTimeout(() => {
            if (!audio.seeking) return;

            showLoading(audio);

            audio.onseeked = () => {
                hideLoading(audio);

                audio.onseeked = null;
            };
        }, LAG); // Audio ready state update delay
    };
        
    audio.onprogress = () => {
        visualizeAudioBuffering(audio);
    };
}

function disconnectAudioHandlers(audio) {
    if (audio.paused) audio.onplaying = null;
    audio.onended = null;
    audio.onpause = null;
    audio.onwaiting = null;
    audio.onseeking = null;
    audio.onprogress = null;
}

function removeTemporaryTrack(audio) {
    if (audio.hasAttribute('data-temp-storage')) {
        clearAudioCache(audio);
        audio.parentElement.remove();
    }
}

function updateSelectedTrackDisplays(audio) {
    clearTitlesMovingTimers();
    
    trackTitleDisplay.style.left = '';
    artistNameDisplay.style.left = '';

    trackTitleDisplay.textContent = audio.dataset.title;
    artistNameDisplay.textContent = audio.dataset.artist;

    moveDisplayTitles(trackTitleDisplay, artistNameDisplay);
}

function moveDisplayTitles(...titles) {
    for (const title of titles) {
        const boxWidth = audioPlayer.querySelector('.selected-track').offsetWidth;
        const titleWidth = title.offsetWidth;
        if (titleWidth <= boxWidth) return;

        title.style.left = 0;

        let timerTitleMove = setTimeout(() => {
            const diffWidth = boxWidth - titleWidth;
            let pos = 0;

            timerTitleMove = requestAnimationFrame(function shiftTitle() {
                title.style.left = --pos + 'px';

                if (pos <= diffWidth) {
                    timerTitleMove = setTimeout(moveDisplayTitles, 1500, title);
                } else {
                    timerTitleMove = requestAnimationFrame(shiftTitle);
                }
                titleMoveTimers[title.id + '-timer'] = timerTitleMove;
            });
            titleMoveTimers[title.id + '-timer'] = timerTitleMove;
        }, 1000);
        titleMoveTimers[title.id + '-timer'] = timerTitleMove;
    }
}

function clearTitlesMovingTimers() {
    for (const key in titleMoveTimers) {
        cancelAnimationFrame(titleMoveTimers[key]);
        clearInterval(titleMoveTimers[key]);
        delete titleMoveTimers[key];
    }
}

function visualizeAudioBuffering(audio) {
    const buffered = audio.buffered;
    const duration = audio.duration;
    if (buffered.length === 0 || isNaN(duration)) return;

    clearBuffersContainer();

    const buffersFragment = document.createDocumentFragment();
    let isAudioFullyBuffered = false;

    for (let i = 0; i < buffered.length; i++) {
        const start = buffered.start(i);
        const end = buffered.end(i);

        if (start === 0 && end === duration) isAudioFullyBuffered = true;

        const buffer = document.createElement('div');
        buffer.className = 'buffering';
        buffer.style.left = (start / duration * 100) + '%';
        buffer.style.width = ((end - start) / duration * 100) + '%';
        buffersFragment.appendChild(buffer);
    }

    buffersContainer.appendChild(buffersFragment);

    if (isAudioFullyBuffered && !audio.hasAttribute('data-fully-loaded')) {
        console.log('audio is fully buffered | ' + audio.dataset.title);

        audio.setAttribute('data-fully-loaded', '');
        audio.backgroundPreloadRequest?.abort();
    }
}

function clearBuffersContainer() {
    buffersContainer.innerHTML = '';
}

///////////////////////////////////////////////
/// Audio player controls - Play/Pause/Stop ///
///////////////////////////////////////////////

playPauseBtn.onclick = playPauseAction;

function playPauseAction() {
    if (!selectedAudio) {
        selectedAudio = currOrderedAudios[0];
        if (!selectedAudio) return;

        setSelecting(selectedAudio);
        if (timeRangeEnter) enterTimeRange();
        showTrackInfo(selectedAudio);
    } else {
        highlightSelected(selectedAudio);
    }

    clearFinPlayTimer();
    stopAudioUpdaters();

    if (playOn) {
        console.log('pause (knob) | ' + selectedAudio.dataset.title);

        setPauseState();
        pauseAudio(selectedAudio);
        if (acceleration && !timePosSeeking) startAudioUpdaters(selectedAudio);
    } else {
        console.log('play (knob) | ' + selectedAudio.dataset.title);

        setPlayState();
        playAudio(selectedAudio);
    }
}

function pauseAudio(audio) {
    clearSkipUpdatingTrackTimer();

    if (audio.readyState >= 3) {
        audio.pause();
        updateCurrentTime(audio);
    }
}

function playAudio(audio) { // playOn = true
    indicator.classList.remove('active');

    if (
        audio.parentElement.querySelector('.update-marker') &&
        !audio.hasAttribute('data-fully-loaded') &&
        !audio.parentElement.hasAttribute('data-downloading') &&
        !audio.backgroundPreloadRequest
    ) {
        timerSkipUpdatingTrack = setTimeout(stepForward, 2e3);
        audio.setAttribute('data-updating-playing', '');
        return;
    }

    if (!audio.src) {
        const trackUrl = createTrackUrl(audio);
        audio.src = trackUrl;

        cacheAudio(audio);
        if (!audio.duration) showLoading(audio);
        runPlaying(audio);
    } else {
        if (audio.duration && audio.paused) {
            runPlaying(audio);
        } else if (acceleration) {
            startAudioUpdaters(audio);
        }
    }

    function runPlaying(audio) {
        audio.muted = true;
        audio.preservesPitch = false;
        acceleratePlaying = true;

        audio.play().catch(error => {
            if (error.name !== 'AbortError') {
                console.log(`+ error playing audio: ${error.name}`);
                console.error(error);
            }
            //clearAudioCache(audio);
        });
    }
}

function createTrackUrl(audio) {
    const { tracklistId, id: trackId, version } = audio.dataset;
    const timestamp = new Date().getTime();
    return `/audio/tracklist/${tracklistId}/track/${trackId}?v=${version}&t=${timestamp}`;
}

stopBtn.onclick = stopAction;

function stopAction() {
    if (!selectedAudio) return;
    if (timerFinishPlay) return;

    console.log('stop (knob) | ' + selectedAudio.dataset.title);

    stopAudioUpdaters();
    if (playOn) pauseAudio(selectedAudio);
    finishPlaying();
}

function setPlayState() {
    playOn = true;
    playPauseBtn.classList.replace('icon-play', 'icon-pause');
}

function setPauseState() {
    playOn = false;
    playPauseBtn.classList.replace('icon-pause', 'icon-play');
}

function cacheAudio(audio) {
    cachedAudioPool.add(audio);

    if (cachedAudioPool.size > MAX_LOADED_AUDIOS) {
        let audioToClear = cachedAudioPool.values().next().value;
        if (audioToClear === selectedAudio) audioToClear = cachedAudioPool.values().next().next().value;
        clearAudioCache(audioToClear);
    }
}

function clearAudioCache(audio) {
    audio.backgroundPreloadRequest?.abort();
    URL.revokeObjectURL(audio.src);
    audio.removeAttribute('src');
    audio.load();
    
    audio.removeAttribute('data-fully-loaded');
    cachedAudioPool.delete(audio);

    hideLoading(audio);
}

function setFullAudioSource(audio, blob) {
    console.log('+ set full audio source | ' + audio.dataset.title);

    const currentTime = audio.currentTime;
    const urlObject = URL.createObjectURL(blob);

    audio.src = urlObject;
    audio.load();
    audio.currentTime = currentTime;

    audio.setAttribute('data-fully-loaded', '');
    if (!cachedAudioPool.has(audio)) cacheAudio(audio);
    
    if (audio === selectedAudio && playOn) audio.play();
}

function clearSkipUpdatingTrackTimer() {
    clearTimeout(timerSkipUpdatingTrack);
    timerSkipUpdatingTrack = null;
}

/////////////////////////////////////
/// Audio player controls - FW/RW ///
/////////////////////////////////////

// Pointer step/acceleration handlers
for (const button of [rewindBtn, forwardBtn]) {
    const key = 'Pointer' + button.id[0].toUpperCase() + button.id.slice(1);

    button.onpointerdown = function(event) {
        if (event.button !== 0) return;

        this.setPointerCapture(event.pointerId);

        downKeyStepAccAction(key);
    };
    
    button.onpointerup = function() {
        upKeyStepAccAction(key);
    };

    button.oncontextmenu = (event) => {
        if (event.pointerType !== 'mouse') return false;
    }

    button.onpointercancel = () => {
        clearTimeout(timerAccelerateAudioDelay);
        if (acceleration) stopAcceleration();

        curAccelerateKey = null;
        activeStepAccKeys.clear();
        canceledStepAccKeys.clear();
    };
}

function downKeyStepAccAction(key) {
    clearTimeout(timerAccelerateAudioDelay);
    activeStepAccKeys.add(key);
    if (!selectedAudio) return;

    timerAccelerateAudioDelay = setTimeout(runAcceleration, ACCELERATION_DELAY);
}

function upKeyStepAccAction(key) {
    if (!activeStepAccKeys.size) return;

    clearTimeout(timerAccelerateAudioDelay);
    activeStepAccKeys.delete(key);

    if (activeStepAccKeys.size) {
        if (acceleration) {
            if (key === curAccelerateKey) {
                runAcceleration();
            } else {
                if (!canceledStepAccKeys.has(key)) {
                    if (!timePosSeeking) accelerationData.keys[key].stepFunc();
                } else {
                    canceledStepAccKeys.delete(key);
                }
            }
        } else {
            if (!timePosSeeking) accelerationData.keys[key].stepFunc();
            timerAccelerateAudioDelay = setTimeout(runAcceleration, ACCELERATION_DELAY);
        }
    } else {
        if (acceleration) {
            stopAcceleration();
        } else {
            if (!timePosSeeking) accelerationData.keys[key].stepFunc();
        }

        curAccelerateKey = null;
        canceledStepAccKeys.clear();
    }
}

function runAcceleration() {
    if (timerFinishPlay) return;

    canceledStepAccKeys.clear();
    activeStepAccKeys.forEach(activeKey => canceledStepAccKeys.add(activeKey));
    
    curAccelerateKey = Array.from(activeStepAccKeys)[activeStepAccKeys.size - 1];
    const keyAccType = accelerationData.keys[curAccelerateKey].accelerationType;

    if (keyAccType !== accelerationType) {
        if (acceleration) stopAcceleration();
        accelerationType = keyAccType;
        if (selectedAudio) accelerate(selectedAudio);
    }
}

function stepBack() {
    if (!selectedAudio) {
        selectedAudio = currOrderedAudios[currOrderedAudios.length - 1];
        if (!selectedAudio) return;

        console.log('step-rewind track selecting | ' + selectedAudio.dataset.title);
        
        setSelecting(selectedAudio);
        if (timeRangeEnter) enterTimeRange();
        showTrackInfo(selectedAudio);
        return;
    }

    if (
        (selectedAudio.duration && selectedAudio.currentTime <= 3) ||
        (!selectedAudio.duration && !timeLinePos)
    ) {
        if (!currOrderedAudios.length) return; // Playlist is cleared, selected audio is in the temporary track box

        clearFinPlayTimer();
        stopAudioUpdaters();
    
        if (playOn) pauseAudio(selectedAudio);

        const prevSelectedAudio = selectedAudio;
        const idx = currOrderedAudios.indexOf(prevSelectedAudio);
        const prevAudio = currOrderedAudios[idx - 1] || currOrderedAudios[currOrderedAudios.length - 1];
        
        removeSelecting(prevSelectedAudio);
        selectedAudio = prevAudio;
        setSelecting(selectedAudio);

        console.log('step-rewind track selecting | ' + selectedAudio.dataset.title);

        prevSelectedAudio.currentTime = 0;
        selectedAudio.currentTime = 0;
        timeLinePos = 0;
        
        showTrackInfo(selectedAudio, prevSelectedAudio);

        if (playOn) {
            playAudio(selectedAudio);
        } else if (acceleration) {
            startAudioUpdaters(selectedAudio);
        }
    } else {
        console.log('skip to start | ' + selectedAudio.dataset.title);

        clearFinPlayTimer();

        selectedAudio.currentTime = 0;
        timeLinePos = 0;

        keepSelectedTitleVisible(selectedAudio);
        if (selectedAudio.duration) updateCurrentTime(selectedAudio);
        updateTimeLine(selectedAudio);
    }
}

function stepForward() {
    if (!selectedAudio) {
        selectedAudio = currOrderedAudios[0];
        if (!selectedAudio) return;

        console.log('step-forward track selecting | ' + selectedAudio.dataset.title);

        setSelecting(selectedAudio);
        if (timeRangeEnter) enterTimeRange();
        showTrackInfo(selectedAudio);
        return;
    }

    if (!currOrderedAudios.length) return; // Playlist is cleared, selected audio is in the temporary track box

    clearFinPlayTimer();
    stopAudioUpdaters();

    if (playOn) pauseAudio(selectedAudio);
    
    const prevSelectedAudio = selectedAudio;
    const idx = currOrderedAudios.indexOf(prevSelectedAudio);
    const nextAudio = currOrderedAudios[idx + 1] || currOrderedAudios[0];

    removeSelecting(prevSelectedAudio);
    selectedAudio = nextAudio;
    setSelecting(selectedAudio);

    console.log('step-forward track selecting | ' + selectedAudio.dataset.title);

    prevSelectedAudio.currentTime = 0;
    selectedAudio.currentTime = 0;
    timeLinePos = 0;

    showTrackInfo(selectedAudio, prevSelectedAudio);

    if (playOn) {
        playAudio(selectedAudio);
    } else if (acceleration) {
        startAudioUpdaters(selectedAudio);
    }
}

function accelerate(audio) {
    console.log(`start ${accelerationType} acceleration`);

    acceleration = true;

    const accBtn = accelerationData.types[accelerationType].button;
    accBtn.className = accelerationData.types[accelerationType].classIcons.accOn;

    stopAudioUpdaters();

    try {
        audio.playbackRate = accelerationData.types[accelerationType].playbackRate;
    } catch(error) {
        console.error(error.name + ': ' + error.message);

        if (error.name === 'NotSupportedError') {
            acceleratePlaying = false;
            if (playOn && audio.readyState >= 3) audio.pause();
        }
    }

    console.log('playbackRate = ' + audio.playbackRate);

    if (!timePosSeeking) startAudioUpdaters(audio);

    highlightSelected(selectedAudio);
}

function stopAcceleration() {
    console.log(`stop ${accelerationType} acceleration`);

    stopAudioUpdaters();

    const accBtn = accelerationData.types[accelerationType].button;
    accBtn.className = accelerationData.types[accelerationType].classIcons.accOff;

    acceleration = false;
    accelerationType = 'none';
    acceleratePlaying = true;

    selectedAudio.playbackRate = accelerationData.types[accelerationType].playbackRate;

    if (selectedAudio.duration && (!playOn || selectedAudio.readyState < 3)) {
        selectedAudio.currentTime = timeLinePos / timeRange.offsetWidth * selectedAudio.duration;
    }

    updateTimeLine(selectedAudio);

    if (playOn) {
        if (selectedAudio.paused) {
            playAudio(selectedAudio);
        } else if (selectedAudio.readyState >= 3) {
            startAudioUpdaters(selectedAudio);
        }
    } else {
        if (selectedAudio.duration) {
            updateCurrentTime(selectedAudio);
        }
    }

    highlightSelected(selectedAudio);
}

function stopAccelerationAndClear() {
    if (!activeStepAccKeys.size) return;

    clearTimeout(timerAccelerateAudioDelay);
    if (acceleration) stopAcceleration();

    curAccelerateKey = null;
    activeStepAccKeys.clear();
    canceledStepAccKeys.clear();
}

///////////////////////////////////////
/// Audio player controls - Shuffle ///
///////////////////////////////////////

shuffleBtn.onclick = shuffleAction;

function shuffleAction() {
    const playlistOrder = shuffleBtn.firstElementChild.classList.toggle('active') ? 'random' : 'original';
    playlist.setAttribute('data-order', playlistOrder);

    setPlaylistOrder();

    if (selectedAudio) {
        highlightSelected(selectedAudio);
    } else {
        curPlaylist.scrollTo({
            left: 0,
            top: 0,
            behavior: 'smooth'
        });
    }
};

function setPlaylistOrder() {
    console.log(`${playlist.dataset.order} playlist order`);

    currOrderedAudios = origOrderedAudios.slice();
    if (playlist.dataset.order === 'random') shuffle(currOrderedAudios);

    curPlaylist.value = generateCurrentPlaylistText();
}

function refreshCurrentPlaylist() {
    if (currOrderedAudios.length) {
        curPlaylist.value = generateCurrentPlaylistText();
    } else {
        curPlaylist.value = 'Playlist cleared';
    }
}

function generateCurrentPlaylistText() {
    let curPlaylistText = `Current playlist (${playlist.dataset.order} order):\n\n`;

    curPlaylistText += currOrderedAudios.map((audio, idx) => {
        const { artist, title, alt, dup } = audio.dataset;
        const altText = alt ? ` [alt-${alt}]` : '';
        const dupText = dup ? ` (${dup})` : '';
        return `${idx + 1}. ${artist} \u2013 ${title}${altText}${dupText}`;
    }).join('\n');

    return breakLine(curPlaylistText);
}

function breakLine(curPlaylistText) {
    fixedCurPlaylistStrings.clear();

    const cols = curPlaylist.cols;
    const strings = curPlaylistText.split(/\n/);

    for (const str of strings) {
        let fixedStr = '';
        let shiftLength = 0;

        while (str.length + shiftLength - fixedStr.length > cols) {
            const startIdx = fixedStr.length - shiftLength;
            const endIdx = startIdx + cols;
            let subStr = str.slice(startIdx, endIdx);

            if (subStr.at(0) === ' ') {
                shiftLength--;
                continue;
            }

            let spaceIdx = subStr.lastIndexOf(' ');
            if (spaceIdx === -1) {
                spaceIdx = subStr.length;
                shiftLength++;
            }

            subStr = subStr.slice(0, spaceIdx) + '\n';
            fixedStr += subStr;
        }

        fixedStr += str.slice(fixedStr.length - shiftLength);
        fixedStr = fixedStr.replace(/\n\s/, '\n');
        if (str !== strings.at(-1)) fixedStr += '\n';

        fixedCurPlaylistStrings.set(str, fixedStr);
    }

    return Array.from(fixedCurPlaylistStrings.values()).join('');
}

//////////////////////////////////////
/// Audio player controls - Repeat ///
//////////////////////////////////////

repeatBtn.onclick = repeatAction;

function repeatAction() {
    const circleBackground = repeatBtn.firstElementChild;
    const repeatImg = circleBackground.firstElementChild;
    const repeatStates = ['none', 'playlist', 'track'];
    const idx = repeatStates.indexOf(repeatBtn.dataset.repeat);
    const repeat = repeatStates[idx + 1] || repeatStates[0];

    repeatBtn.setAttribute('data-repeat', repeat);

    console.log('repeat: ' + repeatBtn.dataset.repeat);

    switch (repeat) {
        case 'none':
            circleBackground.classList.remove('active');
            repeatImg.src = 'img/icons/repeat_playlist.png';
            repeatImg.alt = 'Repeat Playlist';
            break;
        case 'playlist':
            circleBackground.classList.add('active');
            repeatImg.src = 'img/icons/repeat_playlist.png';
            repeatImg.alt = 'Repeat Playlist';
            break;
        case 'track':
            circleBackground.classList.add('active');
            repeatImg.src = 'img/icons/repeat_track.png';
            repeatImg.alt = 'Repeat Track';
            break;
    }

    highlightSelected(selectedAudio);
}

//////////////////////////////////////
/// Audio player controls - Volume ///
//////////////////////////////////////

function changeVolumeAction(changeType, keyRepeat) {
    if (changeType !== 'increase' && changeType !== 'reduce') return;

    if (settedVolume && !keyRepeat) savedVolume = settedVolume;

    const STEP = 2;
    const stepPos = changeType === 'increase' ? STEP : -STEP;
    const xPos = settedVolume * (volumeRange.offsetWidth - volumeBar.offsetWidth);
    const volumePos = moveVolumeAt(xPos + stepPos);
    setVolume(volumePos);

    showVolumeIcon(settedVolume);
    volumeBar.classList.toggle('active', settedVolume);
    
    tooltipHoverIntentByElem.get(volumeRange).executeTask();
    highlightSelected(selectedAudio);
}

volumeBtn.onclick = volumeAction;

function volumeAction() {
    const isActive = volumeBtn.classList.contains('active');
    if (isActive) savedVolume = settedVolume;
    
    const xPos = isActive ? 0 : savedVolume * (volumeRange.offsetWidth - volumeBar.offsetWidth);
    const volumePos = moveVolumeAt(xPos);
    setVolume(volumePos);

    showVolumeIcon(settedVolume);
    volumeBar.classList.toggle('active', !!settedVolume);

    tooltipHoverIntentByElem.get(volumeRange).executeTask();
    highlightSelected(selectedAudio);
}

volumeRange.onclick = null;

volumeRange.oncontextmenu = () => {
    if (isTouchDevice) return false;
}

volumeRange.onpointerdown = function(event) {
    if (event.pointerType === 'mouse' && !event.target.closest('#volume-range')) return;

    if (settedVolume) savedVolume = settedVolume;

    changeVolume(event.clientX);

    volumeBar.setPointerCapture(event.pointerId);

    volumeBar.onpointermove = (event) => changeVolume(event.clientX);

    volumeBar.onpointerup = () => {
        if (!settedVolume) volumeBar.classList.remove('active');

        volumeBar.onpointermove = null;
        volumeBar.onpointerup = null;
    };

    function changeVolume(clientX) {
        volumeBar.classList.add('active');

        const xPos = clientX - volumeRange.getBoundingClientRect().left - volumeBar.offsetWidth / 2;
        const volumePos = moveVolumeAt(xPos);
        setVolume(volumePos);
        
        showVolumeIcon(settedVolume);
    }
};

function moveVolumeAt(x) {
    x = Math.max(x, 0);
    x = Math.min(x, volumeRange.offsetWidth - volumeBar.offsetWidth);

    volumeLine.style.width = x + volumeBar.offsetWidth / 2 + 'px';
    volumeBar.style.left = x + 'px';

    return x;
}
    
function setVolume(pos) {
    settedVolume = pos / (volumeRange.offsetWidth - volumeBar.offsetWidth);
    localStorage.setItem('audio_player_volume', settedVolume);

    if (selectedAudio) selectedAudio.volume = settedVolume;
}

function showVolumeIcon(vol) {
    volumeBtn.className = vol === 0 ? 'icon-volume-off' :
        vol <= 0.5 ? 'icon-volume-down active' :
        vol <= 0.9 ? 'icon-volume active' :
        'icon-volume-up active'
    ;
}
    
function executeVolumeRangeTask() {
    tooltip.textContent = calcVolumeTooltip();
    positionTooltip(volumeBar.getBoundingClientRect(), this.y1, 10);

    function calcVolumeTooltip() {
        return (settedVolume * 100).toFixed(0) + '%';
    }
}

////////////////////////////////////
/// Track time and position info ///
////////////////////////////////////

timeRange.onclick = null;

timeRange.oncontextmenu = () => {
    if (isTouchDevice) return false;
}

timeRange.onpointerenter = enterTimeRange;

function enterTimeRange() {
    timeRangeEnter = true;

    timeRange.onpointermove = moveOverTimeRange;

    timeRange.onpointerleave = function() {
        timeRangeEnter = false;
        timeBar.hidden = true;
        this.style.cursor = '';

        this.onpointerdown = null;
        this.onpointermove = null;
        this.onpointerleave = null;
    };

    if (!selectedAudio) return;

    // Limit the number of requests when updating the current time of the selected audio
    const throttledSetCurrentTime = throttle((audio, time) => audio.currentTime = time, SET_CURRENT_TIME_THROTTLE_DELAY);

    timeBar.hidden = false;
    timeRange.style.cursor = 'pointer';

    timeRange.onpointerdown = function(event) {
        if (event.button !== 0) return;

        document.getSelection().empty();

        this.setPointerCapture(event.pointerId);
        this.pointerId = event.pointerId;

        clearFinPlayTimer();
        stopAudioUpdaters();

        if (playOn) {
            console.log('pause (pointer down on timeline) | ' + selectedAudio.dataset.title);

            pauseAudio(selectedAudio);
        }

        timePosSeeking = true;

        moveOverTimeRange = moveOverTimeRange.bind(this);
        moveOverTimeRange(event);

        this.onpointerup = function() {
            timePosSeeking = false;

            if (playOn) {
                playAudio(selectedAudio);
            } else if (acceleration) {
                startAudioUpdaters(selectedAudio);
            }

            this.onpointerup = null;
            delete this.pointerId;
        };
    };

    function moveOverTimeRange(event) {
        const x = findXPos(event.clientX);
        const timeBarPos = x < this.offsetWidth ? x : x - 1;

        timeBar.style.left = timeBarPos + 'px';

        if (timePosSeeking) {
            document.getSelection().empty();

            timeLinePos = x;
            updateTimePosition(x);
        }
    }

    function findXPos(clientX) {
        let x = clientX - timeRange.getBoundingClientRect().left;
        if (x < 0) x = 0;
        if (x > timeRange.offsetWidth) x = timeRange.offsetWidth;
        return x;
    }

    function updateTimePosition(xPos) {
        if (selectedAudio.duration) {
            const newTime = xPos * selectedAudio.duration / timeRange.offsetWidth;
            throttledSetCurrentTime(selectedAudio, newTime);
            
            updateCurrentTime(selectedAudio, { useTimelinePos: true });
        }

        updateTimeLine(selectedAudio, { useTimelinePos: true });
    }
}

function executeTimeRangeTask() {
    if (!selectedAudio) return;

    tooltip.textContent = calcTimeRangeTooltip(this.x1);
    positionTooltip(timeBar.getBoundingClientRect(), this.y1, 5);

    function calcTimeRangeTooltip(xPos) {
        if (!selectedAudio.duration) return '??:??';
    
        let calculatedTime = xPos * selectedAudio.duration / timeRange.offsetWidth;
        if (calculatedTime < 0) calculatedTime = 0;
        if (calculatedTime > selectedAudio.duration) calculatedTime = selectedAudio.duration;
    
        let mins = Math.floor(calculatedTime / 60);
        let secs = Math.floor(calculatedTime - mins * 60);
    
        if (mins < 10) mins = '0' + mins;
        if (secs < 10) secs = '0' + secs;
    
        return calculatedTime = mins + ':' + secs;
    }
}

////////////////////////////////////////
/// Updating track time and position ///
////////////////////////////////////////

function updateCurrentTime(audio = null, { displayStr = '**:**', useTimelinePos = false, roundTime = false } = {}) {
    if (audio) {
        const currentTime = useTimelinePos ?
            timeLinePos / timeRange.offsetWidth * audio.duration :
            audio.currentTime
        ;
        //console.log(currentTime + ' | ' + audio.dataset.title);
        let mins = roundTime ?
            Math.floor(Math.round(currentTime) / 60) :
            Math.floor(currentTime / 60)
        ;
        let secs = roundTime ?
            Math.round(currentTime % 60) :
            Math.floor(currentTime % 60)
        ;
    
        if (mins < 10) mins = '0' + mins;
        if (secs < 10) secs = '0' + secs;

        displayStr = mins + ':' + secs;
    }

    [...curTimeDisplay.children].forEach((signBox, idx) => signBox.textContent = displayStr[idx] || '');
}

function updateDuration(audio = null, { displayStr = '**:**' } = {}) {
    if (audio) {
        let mins = Math.floor(audio.duration / 60);
        let secs = Math.round(audio.duration % 60);
    
        if (mins < 10) mins = '0' + mins;
        if (secs < 10) secs = '0' + secs;
    
        displayStr = mins + ':' + secs;
    }

    [...durationDisplay.children].forEach((signBox, idx) => signBox.textContent = displayStr[idx] || '');
}

function updateTimeLine(audio, { useTimelinePos = false } = {}) {
    const timeLineWidthRatio = (useTimelinePos || !audio.duration) ?
        timeLinePos / timeRange.offsetWidth :
        audio.currentTime / audio.duration;
    
    timeLine.style.width = `calc(${timeLineMrgnLeft}px + ${timeLineWidthRatio * 100}%)`;
    if (!useTimelinePos && audio.duration) timeLinePos = timeLineWidthRatio * timeRange.offsetWidth;
}

function startAudioUpdaters(audio) {
    if (audio.duration) startCurrentTimeUpdater(audio);
    startTimeLineUpdater(audio, !!audio.duration);
}

function startCurrentTimeUpdater(audio) {
    updateCurrentTime(audio);

    let lastTime = Math.floor(audio.currentTime);

    requestCheckCurTime = requestAnimationFrame(function checkCurTime() {
        const curTime = Math.floor(audio.currentTime);

        if (curTime !== lastTime) {
            updateCurrentTime(audio);
            lastTime = curTime;
        }

        requestCheckCurTime = requestAnimationFrame(checkCurTime);
    });
}

function startTimeLineUpdater(audio, hasDuration) {
    const rateFactor = acceleration ? ACCELERATION_FACTOR : 1;
    const timeLineUpdInterval = TIMELINE_UPDATE_INTERVAL / rateFactor;
    const TIMELINE_ADAPTIVE_STEP = TIMELINE_UPDATE_INTERVAL / 1000 / audio.duration * timeRange.offsetWidth;
    const isAcceleratingTimeUpdate = hasDuration ? 
        (acceleration && (!playOn || audio.readyState < 3 || !acceleratePlaying)) :
        acceleration
    ;
    const throttledUpdateAudioTime = throttle(() => {
        audio.currentTime = timeLinePos / timeRange.offsetWidth * audio.duration;
    }, SET_CURRENT_TIME_THROTTLE_DELAY);
    
    timerTimeLineUpd = setInterval(() => {
        if (isAcceleratingTimeUpdate) {
            const accSign = accelerationData.types[accelerationType].accelerationSign;

            timeLinePos += (hasDuration ? TIMELINE_ADAPTIVE_STEP : TIMELINE_FIXED_STEP) * accSign;
            if (hasDuration) throttledUpdateAudioTime();

            const isTrackFinished = timeLinePos >= timeRange.offsetWidth || timeLinePos <= 0;
            
            if (isTrackFinished) {
                console.log(`track ended in ${accelerationType} (${hasDuration ? 'no playback' : 'no duration'}) |\
                    ${audio.dataset.title}`);
        
                finishTrack(audio);
                return;
            }
        }

        updateTimeLine(audio, { useTimelinePos: isAcceleratingTimeUpdate });
    }, timeLineUpdInterval);
}

function stopAudioUpdaters() {
    cancelAnimationFrame(requestCheckCurTime);
    clearInterval(timerTimeLineUpd);
}

//////////////////////
/// Finish playing ///
//////////////////////

function finishTrack(audio) {
    stopAudioUpdaters();

    if (audio.duration && (!playOn || audio.readyState < 3 || !acceleratePlaying)) {
        audio.currentTime = timeLinePos / timeRange.offsetWidth * audio.duration;
    }

    // Round the current time to the audio duration and extend the timeline over the entire range
    updateCurrentTime(audio, { roundTime: true });
    updateTimeLine(audio);

    if (repeatBtn.dataset.repeat === 'track') {
        playFollowingAudio(audio);
    } else {
        const isFastRewindAcc = acceleration && accelerationType === 'fast-rewind';
        const idx = currOrderedAudios.findIndex(aud => aud === audio);
        let followingAudio = isFastRewindAcc ?
            currOrderedAudios[idx - 1] :
            currOrderedAudios[idx + 1]
        ;

        if (followingAudio) {
            playFollowingAudio(followingAudio);
        } else {
            if (isFastRewindAcc) {
                followingAudio = currOrderedAudios[currOrderedAudios.length - 1];
                
                if (followingAudio) playFollowingAudio(followingAudio);
            } else {
                const shuffleInfo = shuffleBtn.firstElementChild.classList.contains('active') ? 'shuffle ' : '';

                if (repeatBtn.dataset.repeat === 'playlist') {
                    followingAudio = currOrderedAudios[0];

                    if (followingAudio) {
                        console.log(`repeat ${shuffleInfo}playlist`);

                        playFollowingAudio(followingAudio);
                    } else {
                        console.log(`${shuffleInfo}playlist ended`);

                        finishPlaying();
                    }
                } else if (repeatBtn.dataset.repeat === 'none') {
                    console.log(`${shuffleInfo}playlist ended`);

                    finishPlaying();
                }
            }
        }
    }

    function playFollowingAudio(followingAudio) {
        const prevSelectedAudio = selectedAudio;

        removeSelecting(prevSelectedAudio);
        selectedAudio = followingAudio;
        setSelecting(selectedAudio);

        console.log('following track selecting | ' + selectedAudio.dataset.title);

        if (!acceleration || (acceleration && accelerationType === 'fast-forward')) {
            prevSelectedAudio.currentTime = 0;
            selectedAudio.currentTime = 0;
            timeLinePos = 0;
        } else if (acceleration && accelerationType === 'fast-rewind') { 
            if (selectedAudio.duration) selectedAudio.currentTime = selectedAudio.duration;
            timeLinePos = timeRange.offsetWidth;
        }

        showTrackInfo(selectedAudio, prevSelectedAudio);

        if (playOn) {
            playAudio(selectedAudio);
        } else if (acceleration) {
            startAudioUpdaters(selectedAudio);
        }
    }
}

function finishPlaying() {
    console.log('finish playing');
    
    setPauseState();
    clearTitlesMovingTimers();
    clearTimeout(timerAccelerateAudioDelay);
    if (acceleration) stopAcceleration();

    scrollEndStates.curPlaylist = false;
    scrollEndStates.document = false;

    timerFinishPlay = setTimeout(() => {
        stopAccelerationAndClear();

        trackTitleDisplay.textContent = '';
        artistNameDisplay.textContent = '';

        updateCurrentTime(null, { displayStr: '--:--' });
        updateDuration(null, { displayStr: '--:--' });

        tooltipHoverIntentByElem.get(timeRange).dismissTask();
        timePosSeeking = false;
        timeLine.style.width = timeLineMrgnLeft + 'px';
        timeRange.style.cursor = '';
        timeBar.hidden = true;
        timeRange.onpointerdown = null;
        timeRange.onpointerup = null;
        if (timeRange.pointerId) {
            timeRange.releasePointerCapture(timeRange.pointerId);
            delete timeRange.pointerId;
        }

        selectedAudio.currentTime = 0;
        timeLinePos = 0;
        
        removeSelecting(selectedAudio);
        clearBuffersContainer();
        disconnectAudioHandlers(selectedAudio);
        removeTemporaryTrack(selectedAudio);
        selectedAudio = null;

        (function resetScrollPositionsAndReturnFocus() {
            let isPlaylistScrollingToTop = false;

            if (playlistLim.scrollTop) {
                scrollAndAlignPlaylist({
                    direction: 'up',
                    deltaHeight: playlistLim.scrollTop,
                    align: false,
                    hide: true
                });
    
                isPlaylistScrollingToTop = true;
            }

            if (!highlightActiveElem) highlightActiveElem = document.activeElement;

            curPlaylist.select();
            curPlaylist.setSelectionRange(0, 0);
            if (curPlaylist !== highlightActiveElem) curPlaylist.blur();
    
            if (isPlaylistScrollingToTop) {
                eventManager.addOnceEventListener(document, 'endScrollingPlaylist', resetScrollbarPositions);
            } else {
                resetScrollbarPositions();
            }
        })();

        timerFinishPlay = null;
    }, PLAYLIST_FINISH_DELAY);
    
    highlightSelected(selectedAudio);

    /// Functions ///

    function resetScrollbarPositions() {
        // Current playlist
        curPlaylist.scrollTo({
            left: 0,
            top: 0,
            behavior: 'smooth'
        });
    
        if (curPlaylist.scrollTop) {
            eventManager.addOnceEventListener(curPlaylist, 'scrollend', () => scrollEndStates.curPlaylist = true);
        } else {
            scrollEndStates.curPlaylist = true;
        }
    
        // Document
        window.scrollTo({
            left: window.scrollX,
            top: 0,
            behavior: 'smooth'
        });
    
        if (window.scrollY) {
            window.targetScrollPosY = 0;
            eventManager.addOnceEventListener(document, 'scrollend', () => scrollEndStates.document = true);
        } else {
            scrollEndStates.document = true;
        }
    }
}

function clearFinPlayTimer() {
    if (timerFinishPlay) moveDisplayTitles(trackTitleDisplay, artistNameDisplay);

    clearTimeout(timerFinishPlay);
    timerFinishPlay = null;
}

////////////////
/// Playlist ///
////////////////

visPlaylistArea.onpointerover = (event) => {
    if (!event.target.closest('.artist-name') && !event.target.closest('.track-title')) return;

    const track = event.target.closest('.track');
    const relTarget = event.relatedTarget;
    if (track.contains(relTarget) && (relTarget.closest('.artist-name') || relTarget.closest('.track-title'))) return;

    const actionableElems = playlist.hoveredTrackInfo = Array.from(track.querySelectorAll('.artist-name, .track-title'));

    actionableElems.forEach(elem => {
        elem.classList.add('hover');
        elem.parentElement.classList.add('visible');
    });

    adjustTrackInfoLimitersWidth(actionableElems);

    track.addEventListener('pointerout', function removeHovers(event) {
        const relTarget = event.relatedTarget;
        if (track.contains(relTarget) && (relTarget.closest('.artist-name') || relTarget.closest('.track-title'))) return;
        
        actionableElems.forEach(elem => {
            elem.classList.remove('hover');
            elem.parentElement.classList.remove('visible');
        });

        if (!removingTracksCount) playlistLim.style.width = '';
        delete playlist.hoveredTrackInfo;

        track.removeEventListener('pointerout', removeHovers);
    });
};

function adjustTrackInfoLimitersWidth(actionableElems) {
    if (removingTracksCount) return;

    const maxTrackInfo = actionableElems.reduce(
        (maxElem, elem) => maxElem.offsetWidth > elem.offsetWidth ? maxElem : elem
    );
    
    const playlistLimLeft = playlistLim.getBoundingClientRect().left + window.scrollX;
    const maxTrackInfoLim = maxTrackInfo.parentElement;
    const playlistWidth = playlist.offsetWidth;
    let maxTrackInfoLeft = maxTrackInfo.getBoundingClientRect().left + window.scrollX;
    let maxTrackInfoWidth = maxTrackInfo.offsetWidth;

    if (maxTrackInfoLeft - playlistLimLeft + maxTrackInfoWidth + commonSpacing <= playlistWidth) {
        playlistLim.style.width = '';
        return;
    }

    const docWidth = getDocWidth();
    const shift = isTouchDevice ? 1 : 0; // Bug on some mobile devices

    if (maxTrackInfoLim.hasAttribute('data-animating')) {
        playlistLim.style.width = docWidth - playlistLimLeft - shift + 'px';

        eventManager.addOnceEventListener(maxTrackInfoLim, 'transitionend', () => {
            if (maxTrackInfo.classList.contains('hover')) {
                if (maxTrackInfoLim.classList.contains('visible')) {
                    maxTrackInfoLeft = maxTrackInfo.getBoundingClientRect().left + window.scrollX;
                    maxTrackInfoWidth = maxTrackInfo.offsetWidth;

                    extendWidth();
                } else { // Works on touchscreen
                    playlistLim.style.width = '';
                }
            }
        });
    } else {
        extendWidth();
    }

    function extendWidth() {
        if (maxTrackInfoLeft - playlistLimLeft + maxTrackInfoWidth + commonSpacing > playlistWidth) {
            playlistLim.style.width = maxTrackInfoLeft - playlistLimLeft + maxTrackInfoWidth + commonSpacing + 'px';
        }
        if (maxTrackInfoLeft + maxTrackInfoWidth + commonSpacing > docWidth) {
            playlistLim.style.width = docWidth - playlistLimLeft - shift + 'px';
        }
    }
}

// Playlist focus and text select handlers
visPlaylistArea.addEventListener('pointerdown', function (event) {
    const outOfVisibleArea = event.clientX > this.getBoundingClientRect().right;
    if (outOfVisibleArea) preventFocus(this);

    if (event.pointerType === 'mouse' && event.button === 1) return;

    if (event.target.closest('.track-info-box')) {
        const trackInfoBox = event.target.closest('.track-info-box');

        if (
            event.target.closest('.artist-name') ||
            event.target.closest('.track-title') ||
            event.target.closest('.load-info')
        ) {
            preventFocus(this);
            preventFocus(trackInfoBox);

            // Prohibiting text selection on the touchscreen
            if (
                isTouchDevice && event.isPrimary &&
                (event.target.closest('.artist-name') || event.target.closest('.track-title'))
            ) {
                const maxTrackInfo = event.target;
                maxTrackInfo.style.userSelect = 'none';

                document.addEventListener('pointerup', () => maxTrackInfo.style.userSelect = '', { once: true });
            }
        } else { // Focus handling
            if (document.activeElement === trackInfoBox) {
                event.preventDefault();
                setTimeout(() => trackInfoBox.focus());
            } else {
                trackInfoBox.removeAttribute('tabindex');
                this.focus({preventScroll: true});
                setTimeout(() => trackInfoBox.setAttribute('tabindex', 0));
            }
        }
    } else if (event.target.matches('.remove-track')) {
        preventFocus(this);
    }

    function preventFocus(elem) {
        elem.removeAttribute('tabindex');
        setTimeout(() => elem.setAttribute('tabindex', 0));
    }
});

visPlaylistArea.onclick = (event) => {
    // Artist name or track title
    if (event.target.closest('.artist-name') || event.target.closest('.track-title')) {
        const track = event.target.closest('.track');
        selectPlaylistTrack(track);
    }

    // Remove track button
    if (event.target.closest('.remove-track')) {
        const track = event.target.closest('.track');
        removeTrackFromPlaylist(track, event.type);
    }
};

// Selecting track in playlist by clicking/touching
function selectPlaylistTrack(track) {
    if (document.getSelection().toString().length) return;

    const newAudio = track.querySelector('audio');

    console.log('playlist track selecting | ' + newAudio.dataset.title);

    setPlayState();
    
    if (!selectedAudio) {
        selectedAudio = newAudio;

        setSelecting(selectedAudio);
        if (timeRangeEnter) enterTimeRange();
        showTrackInfo(selectedAudio);
        playAudio(selectedAudio);
        return;
    }

    clearFinPlayTimer();
    stopAudioUpdaters();
    
    if (playOn) pauseAudio(selectedAudio);

    if (newAudio !== selectedAudio) {
        const prevSelectedAudio = selectedAudio;

        removeSelecting(prevSelectedAudio);
        selectedAudio = newAudio;
        setSelecting(selectedAudio);

        prevSelectedAudio.currentTime = 0;
        selectedAudio.currentTime = 0;
        timeLinePos = 0;
    
        showTrackInfo(selectedAudio, prevSelectedAudio);
    } else {
        selectedAudio.currentTime = 0;
        timeLinePos = 0;

        showTrackInfo(selectedAudio, selectedAudio);
    }

    playAudio(selectedAudio);
}

// Removing track from playlist
function removeTrackFromPlaylist(track, eventType = null) {
    if (track.classList.contains('removing')) return;

    removingTracksCount++;

    if (scrollablePlaylist) showScrollElems();

    const docWidth = getDocWidth();
    const playlistLimLeft = playlistLim.getBoundingClientRect().left + window.scrollX;
    playlistLim.style.width = docWidth - playlistLimLeft + 'px';
    
    // If a track is being added, set the current property values when starting the removal animation
    if (track.classList.contains('not-ready')) {
        const trackCompStyle = getComputedStyle(track);

        // transformMatrix ==> 'matrix(scaleX(), skewY(), skewX(), scaleY(), translateX(), translateY())'
        const transformMatrix = trackCompStyle.transform;
        const numberRegexp = /-?\d+\.?\d*/g;
        const numberPattern = transformMatrix.match(numberRegexp); // [x, 0, 0, y, 0, 0]
        const curScaleXY = numberPattern[0] + ', ' + numberPattern[3];
        track.style.transform = `scale(${curScaleXY})`;

        const curOpacity = trackCompStyle.opacity;
        track.style.opacity = curOpacity;

        const curHeight = trackCompStyle.height;
        track.style.height = curHeight;

        track.classList.remove('not-ready');
        track.classList.remove('adding');
    }
        
    // Inactivate track menu items
    const trackMenu = audioPlayer.querySelector('.track-menu');
            
    if (trackMenu?.referencedTrack === track) {
        [...trackMenu.children].forEach(menuItem => menuItem.classList.add('inactive'));
    }

    track.classList.remove('pending-removal');
    track.classList.add('removing');

    eventManager.addOnceEventListener(track, 'animationend', () => {
        const audio = track.querySelector('audio');

        console.log('remove track from playlist | ' + audio.dataset.title);

        removingTracksCount--;

        // If focused elem === track title => set focus on another elem
        const trackInfoBox = track.querySelector('.track-info-box');

        if (eventType !== 'click' && document.activeElement === trackInfoBox) {
            const followingTrack = track.nextElementSibling || track.previousElementSibling;
            const nextFocusedElem = followingTrack ?
                followingTrack.querySelector('.track-info-box') :
                tracklistsContainer.querySelector('.tracklist-section');

            if (
                !settingsArea.hidden &&
                selectedAudio &&
                selectedAudio !== audio &&
                !selectedAudio.hasAttribute('data-temp-storage')
            ) {
                highlightActiveElem = nextFocusedElem;
            } else {
                nextFocusedElem.focus();
            }
        }

        // Removing track element from playlist
        if (audio === selectedAudio) {
            if (
                track.hasAttribute('data-deleted') &&
                !audio.hasAttribute('data-fully-loaded') &&
                !track.hasAttribute('data-downloading') &&
                !audio.backgroundPreloadRequest
            ) {
                if (currOrderedAudios.length > 1) {
                    stepForward();
                } else {
                    stopAction();
                }

                if (cachedAudioPool.has(audio)) clearAudioCache(audio);
                track.remove();
            } else {
                track.classList.remove('removing');
                audio.setAttribute('data-temp-storage', '');
                tempTrackStorage.appendChild(track);

                const loadInfo = track.querySelector('.load-info');
                loadInfo?.remove();
            }
        } else {
            if (cachedAudioPool.has(audio)) clearAudioCache(audio);
            track.remove();
        }

        // Cutting audio from arrays
        const origIdx = origOrderedAudios.indexOf(audio);
        origOrderedAudios.splice(origIdx, 1);
        playlistTracks.splice(origIdx, 1);

        const curIdx = currOrderedAudios.indexOf(audio);
        currOrderedAudios.splice(curIdx, 1);

        // Cutting string from curPlaylist textarea
        if (settingsArea.hasAttribute('data-enabled')) refreshCurrentPlaylist();

        // Last removed track
        if (!removingTracksCount) {
            // Saving playlist tracks
            savePlaylistTracks();

            // Recounting duplicates and updating them in the playlist and curPlaylist textarea
            markPlaylistDuplicateNames();
            refreshPlaylistDuplicateNames(origIdx, { artistNames: false, trackTitles: true });
            refreshCurrentPlaylist();

            // Change the playlist limiter width to default value
            if (playlist.hoveredTrackInfo) {
                adjustTrackInfoLimitersWidth(playlist.hoveredTrackInfo);
            } else {
                playlistLim.style.width = '';
            }

            // Highlight selected audio
            if (highlightActiveElem || eventType === 'click') highlightSelected(selectedAudio);

            // Hide scroll elements after a while and align playlist (bug)
            stopScrolling(KEY_SCROLLING_TIME);

            // Trigger for adding track animations
            document.dispatchEvent(eventEndTracksRemoving);
        }

        checkPlaylistScrollability();
        checkScrollElementsVisibility();
    });
}

// Track context menu
visPlaylistArea.oncontextmenu = function(event) {
    if (!event.target.closest('.artist-name') && !event.target.closest('.track-title')) return;

    event.preventDefault();
    document.getSelection().empty();

    const track = event.target.closest('.track');
    const audio = track.querySelector('audio');
    const trackUpdateMarker = track.querySelector('.update-marker');

    const trackMenu = document.createElement('div');
    trackMenu.className = 'track-menu';
    trackMenu.referencedTrack = track;
    audioPlayer.appendChild(trackMenu);
    
    const downloadItem = document.createElement('div');
    downloadItem.className = 'menu-item download';
    if (trackUpdateMarker) downloadItem.classList.add('inactive');
    downloadItem.textContent = `Save audio as ${audio.dataset.format.toUpperCase()}`;
    trackMenu.appendChild(downloadItem);

    const cancelItem = document.createElement('div');
    cancelItem.className = 'menu-item cancel';
    if (!track.hasAttribute('data-downloading') || trackUpdateMarker) cancelItem.classList.add('inactive');
    cancelItem.textContent = 'Cancel audio download';
    trackMenu.appendChild(cancelItem);

    const audioPlayerRect = audioPlayer.getBoundingClientRect(); // audioPlayer - parent element for trackMenu

    let x = event.clientX - audioPlayerRect.left;
    x = Math.min(x, document.documentElement.clientWidth - audioPlayerRect.left - trackMenu.offsetWidth);
    trackMenu.style.left = x + 'px';

    let y = event.clientY - audioPlayerRect.top;
    y = Math.min(y, document.documentElement.clientHeight - audioPlayerRect.top - trackMenu.offsetHeight);
    trackMenu.style.top = y + 'px';

    downloadItem.addEventListener('click', clickDownloadItem);
    cancelItem.addEventListener('click', clickCancelItem);
    document.addEventListener('pointerdown', removeTrackMenu);

    /// Handlers and Functions ///

    function clickDownloadItem() {
        if (downloadItem.classList.contains('inactive')) return;
        
        removeTrackMenu();

        const loadInfo = track.querySelector('.load-info');
        if (loadInfo) loadInfo.remove();

        if (playlist.contains(track)) downloadAudio(track);
    }

    function clickCancelItem() {
        if (cancelItem.classList.contains('inactive')) return;

        removeTrackMenu();
        finishAudioDownload({ isDownloadCancelled: true });
    }
    
    function removeTrackMenu(event) {
        if (event?.target.closest('.track-menu')) return;

        trackMenu.remove();

        downloadItem.removeEventListener('click', clickDownloadItem);
        cancelItem.removeEventListener('click', clickCancelItem);
        document.removeEventListener('pointerdown', removeTrackMenu);
    }

    async function downloadAudio(track) {
        track.setAttribute('data-downloading', '');

        const trackInfoBox = track.querySelector('.track-info-box');
            
        const loadInfo = document.createElement('div');
        loadInfo.className = 'load-info';
        trackInfoBox.appendChild(loadInfo);

        const progress = document.createElement('div');
        progress.className = 'progress';
        loadInfo.appendChild(progress);

        const status = document.createElement('div');
        status.className = 'status';
        status.textContent = 'Waiting for loading...';
        progress.appendChild(status);

        const displayProgress = document.createElement('div');
        displayProgress.className = 'display-progress';
        displayProgress.textContent = '0%';
        loadInfo.appendChild(displayProgress);

        try {
            const trackUrl = createTrackUrl(audio);
            const response = await fetch(trackUrl);
    
            if (response.ok) {
                status.textContent = 'Loading...';

                const reader = response.body.getReader();
                const contentLength = +response.headers.get('Content-Length');
                const binaryData = new Uint8Array(contentLength);
                let receivedLength = 0;
                let isAllDataReceived, receivedData;
            
                while(track.hasAttribute('data-downloading') && playlist.contains(track) && trackInfoBox.contains(loadInfo)) {
                    ({ done: isAllDataReceived, value: receivedData } = await reader.read());
                    if (isAllDataReceived) break;
            
                    binaryData.set(receivedData, receivedLength);
                    receivedLength += receivedData.length;

                    const percentComplete = receivedLength / contentLength * 100;
                    progress.style.width = `calc(${percentComplete}%)`;
                    displayProgress.textContent = Math.floor(percentComplete) + '%';
                }

                if (!isAllDataReceived) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    console.log('+ cancel download');
                    status.textContent = 'Download cancelled';
                    return await reader.cancel();
                }

                status.textContent = 'Complete download';

                const mimeType = response.headers.get('Content-Type');
                const audioBlob = new Blob([binaryData], { type: mimeType });

                const { artist, title, format } = audio.dataset;
                const trackName = sanitizeFileName(`${artist} - ${title}.${format}`);

                if (!audio.hasAttribute('data-fully-loaded')) setFullAudioSource(audio, audioBlob);

                orderedDownloads.push(() => saveFile(audioBlob, trackName));
                if (orderedDownloads.length === 1) orderedDownloads[0]();
            } else {
                console.error('Response status: ' + response.status);
                status.textContent = 'Download failed';
                alert('Download error! Response status: ' + response.status);
                finishAudioDownload();
            }
        } catch(error) {
            console.error('Fetch error:', error);
            status.textContent = 'Download failed';
            finishAudioDownload();
        }

        /// Functions ///

        async function saveFile(blob, fileName) {
            // Обнаружение поддержки браузером File System Access API.
            // API должен поддерживаться и приложение не запущено в iframe.
            const supportsFileSystemAccess =
                'showSaveFilePicker' in window &&
                (() => {
                    try {
                        return window.self === window.top;
                    } catch {
                        return false;
                    }
                })();

            if (supportsFileSystemAccess) { // File System Access API поддерживается
                try {
                    // Показать диалог сохранения файла
                    const handle = await window.showSaveFilePicker({ suggestedName: fileName });
                    
                    // Записать blob в файл
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();

                    status.textContent = 'Audio file is saved';
                    finishAudioDownload();
                    return;
                } catch(error) {
                    console.error(error.name + ': ' + error.message);
    
                    if (error.name === 'AbortError') { // Закрытие диалогового окна, не предлагать второй вариант
                        status.textContent = 'Audio file saving canceled';
                        finishAudioDownload();
                        return;
                    } else if (error.name === 'SecurityError') { // Длительное ожидание после действия пользователя
                        console.log('File System Access API failed due to long load time. Using link download method.');
                    }
                }
            }

            // Доступ API к файловой системе не поддерживается или ошибка в процессе => Загрузка через ссылку
            const link = document.createElement('a');
            link.download = fileName;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);

            eventManager.addOnceEventListener(window, 'focus', finishAudioDownload);
        }
    }

    async function finishAudioDownload({ isDownloadCancelled = false } = {}) {
        await new Promise(resolve => setTimeout(resolve, 100));

        track.removeAttribute('data-downloading');

        const trackMenu = audioPlayer.querySelector('.track-menu');

        if (trackMenu?.referencedTrack === track) {
            const cancelItem = trackMenu.querySelector('.menu-item.cancel');
            cancelItem.classList.add('inactive');
        }

        const loadInfo = track.querySelector('.load-info');

        if (track.classList.contains('pending-removal')) {
            if (isDownloadCancelled) {
                const trackId = audio.dataset.id;
                const trackState = { action: 'delete' };
                loadFullSelectedAudio({ [trackId]: trackState });
            }

            removeTrackFromPlaylist(track);

        } else if (track.classList.contains('awaiting-download')) {
            track.classList.remove('awaiting-download');

            const origIdx = origOrderedAudios.indexOf(track.querySelector('audio'));
            const isFileUpdated = track.dataset.isFileUpdated === 'true';
            const newTrackData = JSON.parse(track.dataset.newTrackData);

            delete track.dataset.isFileUpdated;
            delete track.dataset.newTrackData;

            if (trackMenu?.referencedTrack === track) {
                const downloadItem = trackMenu.querySelector('.download');
                downloadItem.textContent = `Save audio as ${newTrackData.format.toUpperCase()}`;
            }

            if (isFileUpdated && isDownloadCancelled) {
                const trackId = audio.dataset.id;
                const trackState = { action: 'update', isFile: true };
                loadFullSelectedAudio({ [trackId]: trackState });
            }

            migrateTrackData(newTrackData, playlistTracks[origIdx]);
            updatePlaylistTrackInfo(track, newTrackData, isFileUpdated);
            markPlaylistDuplicateNames();
            refreshPlaylistDuplicateNames(origIdx, { artistNames: true, trackTitles: true });
            refreshCurrentPlaylist();

            const updatedLoadInfo = track.referencedUpdatedTrack?.querySelector('.load-info');

            if (updatedLoadInfo) {
                hideLoadStatus(updatedLoadInfo);
                loadInfo.remove();
            } else {
                hideLoadStatus(loadInfo);
            }
        } else {
            hideLoadStatus(loadInfo);
        }

        highlightSelected(selectedAudio);

        if (!isDownloadCancelled) {
            orderedDownloads.shift();
            if (orderedDownloads.length) orderedDownloads[0]();
        }

        /// Functions ///

        function hideLoadStatus(loadInfo) {
            const loadInfoStyle = getComputedStyle(loadInfo);
            const transitionProperties = loadInfoStyle.transitionProperty.split(', ');
            const transitionDurations = loadInfoStyle.transitionDuration.split(', ');
            const opacityIdx = transitionProperties.indexOf('opacity');
            const hideDelay = ~opacityIdx ? parseFloat(transitionDurations[opacityIdx]) * 1000 : 0;
        
            loadInfo.style.opacity = 0;
            setTimeout(() => loadInfo.remove(), hideDelay);
        }
    }
};

//////////////////////////
/// Playlist scrolling ///
//////////////////////////

playlistLim.onscroll = () => {
    playlistLimScrollDirection = playlistLim.scrollTop > playlistLimScrollTop ? 'down' : 'up';
    playlistLimScrollTop = playlistLim.scrollTop;
};

playlistContainer.onpointerenter = () => {
    cursorOverPlaylist = true;

    if (!scrollablePlaylist) return;

    clearTimeout(timerHideScrollElems);
    checkReachingPlaylistBoundaries('all');
    showScrollElems();

    const activeElem = document.activeElement;
    const key = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
    const isDocScrollbar = isDocScrollbarCheck();

    if (!accelerateScrolling) return;
    if (!isDocScrollbar) return;
    if (activeElem === visPlaylistArea) return;
    if (activeElem !== visPlaylistArea && !activeElem.matches('.tracklist-section') &&
        activeElem.scrollHeight > activeElem.clientHeight) return;
    if (activeElem.matches('input[type="number"]') && (key === 'ArrowUp' || key === 'ArrowDown')) return;
    if (pointerModeScrolling) return;

    startScrolling(key);
};

playlistContainer.onpointerleave = () => {
    cursorOverPlaylist = false;

    if (!scrollablePlaylist) return;
    if (pointerModeScrolling) return;

    if (!activeScrollKeys.size) {
        if (!removingTracksCount) hideScrollElems();
    } else {
        const activeElem = document.activeElement;
        if (activeElem === visPlaylistArea) return;

        const isDocScrollbar = isDocScrollbarCheck();
        const key = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
        const direction = scrollingKeysData[key].direction;
        const isReachingLimits = checkReachingPlaylistBoundaries(direction);
        const isProhibitedActiveElem = 
            (activeElem.matches('input[type="number"]') && (key === 'ArrowUp' || key === 'ArrowDown')) ||
            (!activeElem.matches('.tracklist-section') && activeElem.scrollHeight > activeElem.clientHeight)
        ;

        if (isDocScrollbar) {
            if (accelerateScrolling && !isReachingLimits && !isProhibitedActiveElem) {
                stopScrolling(KEY_SCROLLING_TIME);
            } else {
                if (!removingTracksCount) hideScrollElems();
            }
        } else {
            if (isProhibitedActiveElem && !removingTracksCount) hideScrollElems();
        }
    }
};

// Works if document.activeElement = document.body
visPlaylistArea.addEventListener('blur', () => {
    if (!scrollablePlaylist) return;
    if (!accelerateScrolling) return;
    if (cursorOverPlaylist) return;
    if (pointerModeScrolling) return;

    setTimeout(() => {
        const activeElem = document.activeElement;
        const isDocScrollbar = isDocScrollbarCheck();

        if (!isDocScrollbar) return;
        if (activeElem !== document.body) return;
        if (visPlaylistArea.classList.contains('focused')) return;
        
        stopScrolling(KEY_SCROLLING_TIME);
    });
});

visPlaylistArea.onwheel = (event) => {
    if (!scrollablePlaylist) return;

    event.preventDefault();
    
    scrollAndAlignPlaylist({
        direction: (event.deltaY > 0) ? 'down' : 'up',
        deltaHeight: trackHeight * wheelScrollStep,
        wheel: true
    });
};

// Pointer Mode Scrolling
visPlaylistArea.onpointerdown = function(event) {
    if (event.pointerType === 'mouse' && event.button !== 1) return;
    if (isTouchDevice && !event.isPrimary) return;
    if (!scrollablePlaylist) return;
    if (pointerModeScrolling) return;

    const outOfVisibleArea = event.clientX > this.getBoundingClientRect().right;
    if (outOfVisibleArea) return;

    event.preventDefault();
    document.getSelection().empty();

    this.setPointerCapture(event.pointerId);

    if (event.pointerType === 'mouse') {
        document.body.classList.add('pointer-scroll-mode');

        eventManager.addOnceEventListener(this, 'pointerup', runPointerModeScrolling);
    } else if (isTouchDevice) {
        eventManager.addOnceEventListener(this, 'pointermove', runPointerModeScrolling);
    }

    function runPointerModeScrolling(event) {
        console.log('pointer mode scrolling on');
    
        pointerModeScrolling = true;

        this.focus({ preventScroll: true });
    
        const sensingDistance = 30;
        const centerY = event.clientY;
        let currentY = centerY;
        let lastCurrentY = currentY;
        let activeDirection, deltaHeight;

        document.addEventListener('pointermove', pointerMoveInPointerModeScrolling);
        
        function pointerMoveInPointerModeScrolling(event) {
            cancelAnimationFrame(requestScrollInPointerMode);
    
            // if pointermove was caused by the dispatchEvent method => event.clientY === null
            currentY = event.clientY || lastCurrentY;
    
            if (currentY <= centerY - sensingDistance) {
                activeDirection = 'up';

                if (event.pointerType === 'mouse') {
                    document.body.classList.remove('scroll-down');
                    document.body.classList.add('scroll-up');
                }
            } else if (currentY >= centerY + sensingDistance) {
                activeDirection = 'down';

                if (event.pointerType === 'mouse') {
                    document.body.classList.remove('scroll-up');
                    document.body.classList.add('scroll-down');
                }
            } else {
                activeDirection = null;

                if (event.pointerType === 'mouse') {
                    document.body.classList.remove('scroll-up', 'scroll-down');
                }
            }
    
            if ( // Scrolling in progress
                (activeDirection === 'up' && playlistLim.scrollTop > 0) ||
                (activeDirection === 'down' && playlistLim.scrollHeight - playlistLim.scrollTop > playlistLim.clientHeight)
            ) {
                requestScrollInPointerMode = requestAnimationFrame(function scrollInPointerMode() {
                    if (!activeScrollInPointerMode) {
                        cancelAnimationFrame(requestAligningScroll);
                        activeScrollAndAlign = false;
                        activeScrollInPointerMode = true;
                    }
            
                    const range = 200;
                    const maxSpeed = 1;
                    const minSpeed = maxSpeed / maxDeltaHeight;
                    let maxDeltaHeight = playlistLim.scrollHeight / 30;
                    if (maxDeltaHeight < 40) maxDeltaHeight = 40;
                    const y = Math.abs(centerY - currentY) - sensingDistance;
                    let speed = minSpeed + (maxSpeed - minSpeed) * (y / range) ** 3;
                    if (speed > maxSpeed) speed = maxSpeed;
                    deltaHeight = maxDeltaHeight * speed;
            
                    playlistLim.scrollTop += (activeDirection === 'down') ? deltaHeight :
                        (activeDirection === 'up') ? -deltaHeight : 0;
            
                    const isReachingLimits = checkReachingPlaylistBoundaries(activeDirection);
    
                    if (isReachingLimits) {
                        activeScrollInPointerMode = false;
                    } else {
                        requestScrollInPointerMode = requestAnimationFrame(scrollInPointerMode);
                    }
                });
            } else { // No scrolling action
                if (
                    !activeScrollOnKeyRepeat &&
                    !activeDirection &&
                    activeScrollInPointerMode &&
                    (Math.abs(lastCurrentY - centerY) >= sensingDistance)
                ) {
                    scrollAndAlignPlaylist({
                        duration: 400 / deltaHeight
                    });
                    
                    activeScrollInPointerMode = false;
                }
            }
    
            lastCurrentY = currentY;
        }
    
        // Cancellation pointerModeScrolling
        cancelPointerModeScrolling = cancelPointerModeScrolling.bind(this);

        if (event.pointerType === 'mouse') {
            eventManager.addOnceEventListener(document, 'pointerdown', cancelPointerModeScrolling);
        } else if (isTouchDevice) {
            eventManager.addOnceEventListener(this, 'pointerup', cancelPointerModeScrolling);
        }
        
        function cancelPointerModeScrolling(event) {
            console.log('pointer mode scrolling off');
            
            if (event.pointerType === 'mouse' && event.button === 1) {
                event.preventDefault();
            }
    
            // Before pointerModeScrolling === false to prevent additional alignment
            if (!event.target.closest('#visible-playlist-area')) {
                this.blur();
            }
    
            pointerModeScrolling = false;
    
            cancelAnimationFrame(requestScrollInPointerMode);
    
            if (!accelerateScrolling) {
                alignPlaylist();
            } else {
                const isDocScrollbar = isDocScrollbarCheck();
                if (isDocScrollbar && !cursorOverPlaylist) alignPlaylist();
            }
    
            if (event.pointerType === 'mouse') {
                document.body.classList.remove('pointer-scroll-mode', 'scroll-up', 'scroll-down');
            }
        
            document.removeEventListener('pointermove', pointerMoveInPointerModeScrolling);
    
            function alignPlaylist() {
                const duration = activeScrollInPointerMode ? (400 / deltaHeight) : 0;
    
                scrollAndAlignPlaylist({
                    duration,
                    hide: true,
                    hideDelay: duration
                });
            }
        }
    }
};

function keepSelectedTitleVisible(audio) {
    if (audio.hasAttribute('data-temp-storage')) return;

    clearTimeout(timerReturnFocusDelay);

    let isScrollAndAlignPlaylistActive = false;

    // Playlist scroll alignment
    if (scrollablePlaylist) {
        const initScrolled = playlistLim.scrollTop;
        const visibleHeight = playlistLim.clientHeight;
        const selTrackPlaylistTop = origOrderedAudios.indexOf(audio) * trackHeight;
        let direction, deltaHeight;

        if (selTrackPlaylistTop < initScrolled) {
            direction = 'up';
            deltaHeight = initScrolled - selTrackPlaylistTop;
        }

        if (selTrackPlaylistTop + trackHeight > initScrolled + visibleHeight) {
            direction = 'down';
            deltaHeight = trackHeight + selTrackPlaylistTop - (initScrolled + visibleHeight);
        }

        if (direction && deltaHeight) { // The track title IS NOT FULL in the visible area of the playlist
            isScrollAndAlignPlaylistActive = true;
            
            showScrollElems();
            scrollAndAlignPlaylist({
                direction,
                deltaHeight,
                align: false,
                hide: true
            });
        } else {
            cancelAnimationFrame(requestAligningScroll);
            activeScrollAndAlign = false;

            if (initScrolled % trackHeight) {
                isScrollAndAlignPlaylistActive = true;

                showScrollElems();
                scrollAndAlignPlaylist({
                    hide: true
                });
            }
        }
    }

    // Window scroll alignment
    eventManager.removeOnceEventListener(document, 'endScrollingPlaylist', 'scrollAndAlignDocument');

    scrollEndStates.curPlaylist = false; // Gotta be close to scrollEndStates.document

    const isPlaylistInView = isPlaylistInViewCheck();

    if (!isPlaylistInView) {
        scrollEndStates.document = false;

        if (isScrollAndAlignPlaylistActive) {
            eventManager.addOnceEventListener(document, 'endScrollingPlaylist', scrollAndAlignDocument);
        } else {
            scrollAndAlignDocument();
        }
    }

    highlightSelected(audio);

    function scrollAndAlignDocument() {
        const track = selectedAudio.parentElement;
        const trackRect = track.getBoundingClientRect();
        const initScrolled = window.scrollY;
        const winHeight = getWinHeight();
        const heightShift = scrollablePlaylist ? playlistScrollArrowBoxHeight : 0;
        let y = initScrolled;
    
        if (trackRect.top < heightShift) {
            y = trackRect.top - heightShift + initScrolled;
            y = Math.floor(y); // For removing arrow box
        } else if (trackRect.bottom > winHeight - heightShift) {
            y = trackRect.bottom + heightShift - winHeight + initScrolled;
            y = Math.ceil(y); // For removing arrow box
        }
    
        window.scrollTo({
            left: window.targetScrollPosX !== undefined ? window.targetScrollPosX : window.scrollX,
            top: y,
            behavior: 'smooth'
        });
    
        if (y !== initScrolled) {
            window.targetScrollPosY = y;
            eventManager.addOnceEventListener(document, 'scrollend', () => scrollEndStates.document = true);
        } else {
            scrollEndStates.document = true;
        }
    }
}

function downKeyScrollAction(event) {
    const key = event.code;
    if (activeScrollKeys.has(key)) return;

    activeScrollKeys.add(key);

    if (activeScrollKeys.size === 1) {
        timerAccelerateScrolling = setTimeout(() => {
            timerAccelerateScrolling = null;
            accelerateScrolling = true;

            const canPlaylistScrolling = canPlaylistScrollingCheck(key);

            if (canPlaylistScrolling) {
                event.preventDefault();
                startScrolling(key);
                if (pointerModeScrolling) document.dispatchEvent(eventPointerMove);
            };
        }, 500);
    } else if (timerAccelerateScrolling) {
        clearTimeout(timerAccelerateScrolling);
        timerAccelerateScrolling = null;
        accelerateScrolling = true;
    }

    const canPlaylistScrolling = canPlaylistScrollingCheck(key);

    if (canPlaylistScrolling) {
        event.preventDefault();
        startScrolling(key);
    } else {
        if (activeScrollOnKeyRepeat) {stopScrolling(KEY_SCROLLING_TIME);}
        if (pointerModeScrolling) document.dispatchEvent(eventPointerMove);
    }
}

function repeatKeyScrollAction(event) {
    const key = event.code;
    const canPlaylistScrolling = canPlaylistScrollingCheck(key);
    if (canPlaylistScrolling) event.preventDefault();
}

function upKeyScrollAction(event) {
    if (!activeScrollKeys.size) return;

    if (timerAccelerateScrolling) {
        clearTimeout(timerAccelerateScrolling);
        timerAccelerateScrolling = null;
    }

    if (pointerModeScrolling) document.dispatchEvent(eventPointerMove);

    const key = event.code;
    activeScrollKeys.delete(key);

    if (activeScrollKeys.size) {
        const prevKey = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
        const canPlaylistScrolling = canPlaylistScrollingCheck(prevKey);

        if (canPlaylistScrolling) {
            event.preventDefault();
            startScrolling(prevKey);
        } else {
            if (activeScrollOnKeyRepeat) stopScrolling(KEY_SCROLLING_TIME);
        }
    } else { // The last active scroll key has been released
        if (accelerateScrolling) accelerateScrolling = false;

        const canPlaylistScrolling = canPlaylistScrollingCheck(null);
        if (!canPlaylistScrolling) return;

        const direction = scrollingKeysData[key].direction;
        const isReachingLimits = checkReachingPlaylistBoundaries(direction);

        if (
            isReachingLimits &&
            !cursorOverPlaylist &&
            !pointerModeScrolling &&
            !playlist.hasAttribute('adding-tracks')
        ) {
            hideScrollElems();
        }

        if (activeScrollOnKeyRepeat && !activeScrollInPointerMode && !isReachingLimits) {
            stopScrolling(HIDE_SCROLL_ELEMENTS_DELAY);
        }
    }
}

function canPlaylistScrollingCheck(key) {
    const activeElem = document.activeElement;

    if (!scrollablePlaylist) return false;
    if (activeElem !== visPlaylistArea && !activeElem.matches('.tracklist-section') &&
        activeElem.scrollHeight > activeElem.clientHeight) return false;
    if (activeElem.matches('input[type="number"]') && (key === 'ArrowUp' || key === 'ArrowDown')) return false;

    const isDocScrollbar = isDocScrollbarCheck();

    if (isDocScrollbar) {
        if (
            activeElem === visPlaylistArea ||
            cursorOverPlaylist ||
            pointerModeScrolling
        ) {
            return true;
        } else {
            return false;
        }
    } else {
        return true;
    }
}

function startScrolling(key) {
    clearTimeout(timerHideScrollElems);
    showScrollElems();

    if (!accelerateScrolling) {
        scrollAndAlignPlaylist({
            direction: scrollingKeysData[key].direction,
            deltaHeight: scrollingKeysData[key].deltaHeight(),
            duration: KEY_SCROLLING_TIME,
            align: (key === 'Home' || key === 'End') ? false : true,
            hide: true
        });
    } else {
        requestScrollOnKeyRepeat = requestAnimationFrame(scrollOnKeyRepeat);
    }
}

function stopScrolling(hideDelay) {
    if (!scrollablePlaylist) return;

    scrollAndAlignPlaylist({
        duration: KEY_SCROLLING_TIME,
        hide: true,
        hideDelay
    });
}

function stopScrollingAndClean() {
    if (!activeScrollKeys.size) return;

    stopScrolling(KEY_SCROLLING_TIME);

    activeScrollKeys.clear();
    accelerateScrolling = false;

    if (timerAccelerateScrolling) {
        clearTimeout(timerAccelerateScrolling);
        timerAccelerateScrolling = null;
    }
}

function scrollOnKeyRepeat() {
    if (!activeScrollKeys.size) return;
    if (!accelerateScrolling) return;

    cancelAnimationFrame(requestAligningScroll);
    activeScrollAndAlign = false;
    cancelAnimationFrame(requestScrollOnKeyRepeat);

    const key = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
    const direction = scrollingKeysData[key].direction;

    let isReachingLimits = checkReachingPlaylistBoundaries(direction);
    if (isReachingLimits && !playlist.hasAttribute('adding-tracks')) {
        finalizeScrolling();
        return;
    }

    activeScrollOnKeyRepeat = true;

    const deltaHeight = (key === 'Home' || key === 'End') ?
        playlistLim.scrollHeight / 10 :
        scrollingKeysData[key].factor * 10
    ;

    playlistLim.scrollTop += direction === 'down' ? deltaHeight : (direction === 'up' ? -deltaHeight : 0);

    isReachingLimits = checkReachingPlaylistBoundaries(direction);
    if (isReachingLimits && !playlist.hasAttribute('adding-tracks')) {
        finalizeScrolling();
        return;
    }

    function finalizeScrolling() {
        activeScrollOnKeyRepeat = false;
        document.dispatchEvent(eventEndScrollingPlaylist);
        if (pointerModeScrolling) document.dispatchEvent(eventPointerMove);
    }

    requestScrollOnKeyRepeat = requestAnimationFrame(scrollOnKeyRepeat);
}

function scrollAndAlignPlaylist(options) {
    options = Object.assign(
        {
            direction: playlistLimScrollDirection,
            deltaHeight: 0,
            duration: DEFAULT_SCROLLING_TIME,
            wheel: false,
            align: true,
            hide: false,
            hideDelay: HIDE_SCROLL_ELEMENTS_DELAY
        },
        options
    );

    let {direction, deltaHeight, duration, wheel, align, hide, hideDelay} = options;

    if (
        hide &&
        scrollElemsDisplaying &&
        !cursorOverPlaylist &&
        !pointerModeScrolling
    ) {
        clearTimeout(timerHideScrollElems);

        timerHideScrollElems = setTimeout(() => {
            const activeElem = document.activeElement;
            const key = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
            const isDocScrollbar = isDocScrollbarCheck();

            if (cursorOverPlaylist) return;
            if (pointerModeScrolling) return;
            if (removingTracksCount) return;
            if (
                !isDocScrollbar &&
                activeScrollKeys.size &&
                activeElem.scrollHeight <= activeElem.clientHeight &&
                !(activeElem.matches('input[type="number"]') && (key === 'ArrowUp' || key === 'ArrowDown'))
            ) return;

            hideScrollElems();
        }, hideDelay);
    }
    
    cancelAnimationFrame(requestAligningScroll);
    activeScrollAndAlign = false;
    cancelAnimationFrame(requestScrollOnKeyRepeat);
    activeScrollOnKeyRepeat = false;

    const isReachingLimits = checkReachingPlaylistBoundaries(direction);
    if (isReachingLimits) return;

    const initScrolled = playlistLim.scrollTop;
    const remainder = initScrolled % trackHeight;
    if (!deltaHeight && !remainder) return;

    activeScrollAndAlign = true;
    
    const remainderRatio = remainder / trackHeight;

    if (remainderRatio && align) {
        const k = wheel ? 1 : 0;

        if (direction === 'down') {
            deltaHeight += trackHeight * (k + 1 - remainderRatio);
        }
        if (direction === 'up') {
            deltaHeight += trackHeight * (k + remainderRatio);
        }
    }

    const startTime = performance.now();
    
    requestAligningScroll = requestAnimationFrame(function aligningScroll(time) {
        let timeFraction = (time - startTime) / duration;
        if (timeFraction < 0) {
            requestAligningScroll = requestAnimationFrame(aligningScroll);
            return;
        }
        if (timeFraction > 1) timeFraction = 1;
    
        const progress = timing(timeFraction);
    
        if (direction === 'down') {
            playlistLim.scrollTop = initScrolled + deltaHeight * progress;
        }
        if (direction === 'up') {
            playlistLim.scrollTop = initScrolled - deltaHeight * progress;
        }

        const isReachingLimits = checkReachingPlaylistBoundaries(direction);

        if (isReachingLimits) {
            endScrollAndAlign();
        } else {
            if (timeFraction < 1) {
                requestAligningScroll = requestAnimationFrame(aligningScroll);
            } else {
                endScrollAndAlign();
            }
        }
    });

    /// Functions ///
    
    function timing(timeFraction) {
        return timeFraction;
    }

    function endScrollAndAlign() {
        activeScrollAndAlign = false;
        document.dispatchEvent(eventEndScrollingPlaylist);

        // If the scroll keys are pressed after the wheel or Tab focus has completed scrolling
        if (accelerateScrolling) {
            const key = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
            const canPlaylistScrolling = canPlaylistScrollingCheck(key);
            if (canPlaylistScrolling) startScrolling(key);
        }
    }
}

function checkReachingPlaylistBoundaries(direction) {
    const isTopBoundaryReached = playlistLim.scrollTop === 0;
    playlistScrollArrowUp.classList.toggle('inactive', isTopBoundaryReached);

    const isBottomBoundaryReached = playlistLim.scrollHeight - playlistLim.scrollTop <= playlistLim.clientHeight;
    playlistScrollArrowDown.classList.toggle('inactive', isBottomBoundaryReached);

    return (isTopBoundaryReached && direction === 'up') || (isBottomBoundaryReached && direction === 'down');
}

function showScrollElems() {
    clearTimeout(timerHideScrollElems);

    scrollElemsDisplaying = true;

    playlistScrollArrowUp.hidden = false;
    playlistScrollArrowDown.hidden = false;
}

function hideScrollElems() {
    clearTimeout(timerHideScrollElems);

    scrollElemsDisplaying = false;

    playlistScrollArrowUp.hidden = true;
    playlistScrollArrowDown.hidden = true;
}

function checkPlaylistScrollability() {
    const isScrollable = playlistLim.scrollHeight > playlistLim.clientHeight;
    if (scrollablePlaylist === isScrollable) return;
    
    scrollablePlaylist = isScrollable;
    playlistContainer.classList.toggle('scrollable', isScrollable);
    
    checkReachingPlaylistBoundaries('all');
    
    if (isScrollable) {
        if (cursorOverPlaylist || pointerModeScrolling) showScrollElems();
    } else {
        timerHideScrollElems = setTimeout(hideScrollElems, HIDE_SCROLL_ELEMENTS_DELAY);
    }
}

////////////////////
/// Track titles ///
////////////////////

function showLoading(audio) {
    const track = audio.closest('.track');
    track.classList.add('no-color-transition', 'loading');
    indicator.classList.remove('active');
}
function hideLoading(audio) {
    const track = audio.closest('.track');
    track.classList.remove('loading');
    void track.offsetWidth; // Causes reflow
    track.classList.remove('no-color-transition');
}

function setSelecting(audio) {
    const track = audio.closest('.track');
    track.classList.add('selected');
    checkAnimatedTransition(track);
}
function removeSelecting(audio) {
    const track = audio.closest('.track');
    track.classList.remove('selected');
    checkAnimatedTransition(track);
}

function checkAnimatedTransition(track) {
    if (playlistStyle !== 'smooth') return;

    const actionableElems = Array.from(track.querySelectorAll('.artist-name, .track-title'));
    let isHovered = false;

    actionableElems.forEach(trackInfo => {
        const trackInfoLim = trackInfo.parentElement;
        trackInfoLim.setAttribute('data-animating', '');
        isHovered = trackInfo.classList.contains('hover');

        eventManager.addOnceEventListener(trackInfoLim, 'transitionend', () => {
            trackInfoLim.removeAttribute('data-animating');
        });
    });

    if (isHovered) adjustTrackInfoLimitersWidth(actionableElems);
}

///////////////////////////////////
/// Audio player footer buttons ///
///////////////////////////////////

configBtn.onclick = (event) => {
    changeAudioControlsConfiguration.eventType = event.type;
    const configIdx = configsBank.indexOf(config);
    changeAudioControlsConfiguration(configIdx + 1);
}

colorBtn.onclick = () => {
    const colorIdx = audioPlayerColorsBank.indexOf(audioPlayerColor);
    changeAudioPlayerColor(colorIdx + 1);
};

playlistStyleBtn.onclick = () => {
    const styleIdx = playlistStylesBank.indexOf(playlistStyle);
    changePlaylistStyle(styleIdx + 1);
};

settingsBtn.onclick = settingsAction;

keysInfoBtn.onclick = showKeysInfo;

//////////////////////////
/// Tracklist database ///
//////////////////////////

function calcTracklistDtbsBtnPosition() {
    const minTracklistDtbsBtnHeight = 50;
    const tracklistDtbsBtnCont = tracklistDtbsBtn.parentElement;
    const winHeight = getWinHeight();
    const audioPlayerRect = audioPlayer.getBoundingClientRect();
    const audioPlayerScrolled = audioPlayerRect.top < 0 ? Math.abs(audioPlayerRect.top) : 0;
    const audioPlayerTop = Math.max(audioPlayerRect.top, 0);
    const audioPlayerBottom = audioPlayerRect.bottom > winHeight ? winHeight : audioPlayerRect.bottom;
    const visAudioPlayerHeight = audioPlayerBottom - audioPlayerTop;
    let tracklistDtbsBtnHeight = defTracklistDtbsBtnHeight;

    if (tracklistDtbsBtnHeight > visAudioPlayerHeight - commonBorderRadius * 2) {
        tracklistDtbsBtnHeight = visAudioPlayerHeight - commonBorderRadius * 2;

        if (tracklistDtbsBtnHeight < minTracklistDtbsBtnHeight) {
            tracklistDtbsBtnHeight = minTracklistDtbsBtnHeight;

            if (visAudioPlayerHeight < minTracklistDtbsBtnHeight + commonBorderRadius * 2) {
                const tracklistDtbsBtnTop = audioPlayer.offsetHeight - tracklistDtbsBtnHeight - commonBorderRadius;
                tracklistDtbsBtnCont.style.top = tracklistDtbsBtnTop + 'px';
            }
        } else {
            tracklistDtbsBtnCont.style.top = audioPlayerScrolled + commonBorderRadius + 'px';
        }

        tracklistDtbsBtnCont.style.height = tracklistDtbsBtnHeight + 'px';
    } else {
        const tracklistDtbsBtnTop = audioPlayerScrolled + visAudioPlayerHeight / 2 - tracklistDtbsBtnHeight / 2;
        tracklistDtbsBtnCont.style.top = tracklistDtbsBtnTop + 'px';
        tracklistDtbsBtnCont.style.height = '';
    }
}

tracklistDtbsBtn.onclick = tracklistDatabaseAction;

async function tracklistDatabaseAction() {
    if (!tracklistDelWin.hidden) return;
    if (!tracklistMgrWin.hidden) return;

    let audioPlayerMoveInfo;

    if (
        tracklistDatabase.hasAttribute('data-resizing') ||
        settingsArea.hasAttribute('data-await-run-hide-settings') ||
        settingsArea.hasAttribute('data-waiting-action') ||
        tracklistsContainer.hasAttribute('data-toggling-details') ||
        tracklistsContainer.hasAttribute('data-updating') ||
        (
            audioPlayerMoveInfo = JSON.parse(audioPlayer.getAttribute('data-move-info')),
            audioPlayerMoveInfo && audioPlayerMoveInfo.trigger === 'settingsArea'
        )
    ) {
        tracklistDatabase.setAttribute('data-waiting-action', '');
        return;
    }

    tracklistDtbsTitle.firstElementChild.classList.remove('run-sheen');
    tracklistDtbsBtn.classList.remove('enabled');
    tracklistDtbsBtn.classList.add('waiting');
    defaultSettingsBtn.disabled = true;
    addOptionsCheckbox.disabled = true;

    const isTracklistDtbsStickedLeft = tracklistDatabase.classList.contains('sticked-left');
    const isTracklistDtbsMoved = tracklistDatabase.hasAttribute('data-moving');
    const audioPlayerLeft = audioPlayer.getBoundingClientRect().left + window.scrollX;

    resetTracklistDtbsAndAudioPlayerStates();
    scrollDoc('left', 'smooth');
    runTracklistDatabaseAction();

    /// Functions ///

    function runTracklistDatabaseAction() {
        if (!tracklistDatabase.classList.contains('enabled')) { // Move/show tracklists
            tracklistDatabase.classList.add('enabled');

            focusSavedActiveElement();
            calcTracklistsTextIndent();
            calcTracklistsContainerMaxHeight();
            disableTracklistsContainerScrollBar();
            checkAudioPlayerContainerJustify();
            checkGlobalStates();
    
            const noSpaceForMoving = audioPlayerLeft - tracklistDatabase.offsetWidth === 0;
    
            if (isTracklistDtbsStickedLeft && !noSpaceForMoving) { // Move tracklists
                moveTracklistDatabase();
            } else { // Show tracklists
                toggleTracklistDatabaseVisibility('show');
            }
        } else { // Hide tracklists/move audio player
            if (tracklistDatabase.classList.contains('active')) { // Hide tracklists
                disableTracklistsContainerScrollBar();
                toggleTracklistDatabaseVisibility('hide');
            } else {
                if (isTracklistDtbsMoved) { // Cancel tracklists moving animation (move audio player)
                    moveAudioPlayer();
                } else { // Cancel tracklists hiding animation (show tracklists)
                    toggleTracklistDatabaseVisibility('show');
                }
            }
        }
    }
            
    function moveTracklistDatabase() {
        tracklistDatabase.setAttribute('data-moving', '');

        const curTracklistDtbsWidth = tracklistDatabase.offsetWidth;
        const tracklistDtbsLeft = audioPlayerLeft - curTracklistDtbsWidth;

        tracklistDatabase.style.width = curTracklistDtbsWidth + 'px'; 
        tracklistDatabase.style.marginLeft = tracklistDtbsLeft + 'px';
        void tracklistDatabase.offsetWidth; // Causes a reflow
        tracklistDatabase.classList.add('smooth-moving');
        setTimeout(() => tracklistDatabase.style.marginLeft = '');

        eventManager.addOnceEventListener(tracklistDatabase, 'transitionend', endTracklistDatabaseMoving);
    }

    function endTracklistDatabaseMoving() { // ==> Show
        resetTracklistDtbsAndAudioPlayerStates();
        checkGlobalStates();

        tracklistDatabase.removeAttribute('data-moving');

        scrollDoc('left', 'smooth');
        checkPendingSettingsAction();
        toggleTracklistDatabaseVisibility('show');
    }

    function moveAudioPlayer() {
        saveActiveElementInfo();
        
        tracklistDatabase.classList.remove('enabled');

        audioPlayer.setAttribute('data-move-info', '{"trigger": "tracklistDatabase"}');
        audioPlayerContainer.style.minHeight = '';
        setDocScrollbarYWidth();

        audioPlayer.style.marginLeft = audioPlayerLeft + 'px';
        void audioPlayer.offsetWidth; // Causes a reflow
        audioPlayer.classList.add('smooth-moving');
        audioPlayer.style.marginLeft = canAutoChangeWidth && !settingsArea.hidden ?
            origDocWidth - settingsAreaWidth - audioPlayer.offsetWidth + 'px' :
            ''
        ;

        eventManager.addOnceEventListener(audioPlayer, 'transitionend', endAudioPlayerMoving);
    }

    async function endAudioPlayerMoving() { // ==> Hide
        resetTracklistDtbsAndAudioPlayerStates();
        checkGlobalStates();

        defaultSettingsBtn.disabled = false;
        addOptionsCheckbox.disabled = false;
        tracklistDtbsBtn.classList.remove('waiting', 'enabled');

        if (!settingsArea.hidden && settingsArea.dataset.waitingAction !== 'hideSettings') {
            await scrollDoc('right', 'smooth');
        }

        checkPendingSettingsAction();
        checkStartInfoDisplaying();
    }

    function checkPendingSettingsAction() {
        const actionFunc = settingsArea.dataset.waitingAction;
    
        if (actionFunc) {
            settingsArea.removeAttribute('data-waiting-action');
            settingsArea.setAttribute('data-running-action', '');
    
            setTimeout(window[actionFunc]);
        } else {
            checkAudioPlayerContainerJustify();
        }
    }

    function resetTracklistDtbsAndAudioPlayerStates() {
        tracklistDatabase.removeAttribute('data-moving');
        audioPlayer.removeAttribute('data-move-info');

        tracklistDatabase.style.width = '';
        tracklistDatabase.style.marginLeft = '';
        audioPlayer.style.marginLeft = '';

        tracklistDatabase.classList.remove('smooth-moving');
        audioPlayer.classList.remove('smooth-moving');

        eventManager.removeOnceEventListener(tracklistDatabase, 'transitionend', 'endTracklistDatabaseMoving');
        eventManager.removeOnceEventListener(audioPlayer, 'transitionend', 'endAudioPlayerMoving');

        const firstAnimatedElem = tracklistDtbsTitle;
        const lastAnimatedElem = [...tracklistDatabase.querySelectorAll('.global-controls button')].pop();
        [firstAnimatedElem, lastAnimatedElem].forEach(elem => {
            eventManager.clearEventHandlers(elem, 'transitionstart', 'transitionend');
        });
    }

    function toggleTracklistDatabaseVisibility(animationAction) {
        tracklistDatabase.classList.toggle('active', animationAction === 'show');
        if (animationAction === 'hide') tracklistDatabase.removeAttribute('data-ready');
        
        const visTracklistSections = filterVisibleTracklistSections();
        const globControlBtns = Array.from(tracklistDatabase.querySelectorAll('.global-controls button'));
        const animatedElems = [].concat(tracklistDtbsTitle, visTracklistSections, globControlBtns);
        if (animationAction === 'hide') animatedElems.reverse();
        const animElemsNum = animatedElems.length;
        const globControlBtnsNum = globControlBtns.length;
        const endAnimFunc = animationAction === 'show' ? endShowAnimation : endHideAnimation;

        animateElements({ animatedElems, animElemsNum, globControlBtnsNum, animationAction, endAnimFunc });
    }

    function filterVisibleTracklistSections() {
        return [].filter.call(tracklistsContainer.children,
            tracklistSection => isElementVisibleInScrollableContainer(tracklistsContainer, tracklistSection))
        ;
    }

    async function animateElements({ animatedElems, animElemsNum, globControlBtnsNum, animationAction, endAnimFunc }) {
        let firstIteration = true;

        for (let i = 0; i < animElemsNum; i++) {
            if (i === 0 && !tracklistDatabase.hasAttribute('data-animating')) {
                setAnimationStart(animatedElems[i]);
            }

            if (i === animElemsNum - 1) {
                if (tracklistDatabase.hasAttribute('data-animating')) {
                    setAnimationEnd(animatedElems[i], endAnimFunc);
                } else {
                    endAnimFunc();
                }
            }

            if (animatedElems[i].classList.contains('tracklist-section') && !tracklistsContainer.contains(animatedElems[i])) {
                continue; // Tracklist restructuring after SSE connection restoration
            }
            if (animatedElems[i].classList.contains('show') === (animationAction === 'show')) continue;

            const timeDelay = getAnimationDelay(animationAction, i, firstIteration, animElemsNum, globControlBtnsNum);
            const promiseDelay = await promiseAnimation(timeDelay, animatedElems[i], animationAction);
            if (!promiseDelay) return;

            firstIteration = false;
        }

        function getAnimationDelay(animationAction, i, k, m, n) {
            switch (animationAction) {
                case 'show':
                    return (i === 0 || k) ? 0 : (i === m - n) ? 250 : (i === 1) ? 200 : 100;
                case 'hide':
                    return (i === 0 || k) ? 0 : (i === m - 1) ? 200 : (i === n) ? 250 : 100;
            }
        }
    }

    function promiseAnimation(timeDelay, elem, animationAction) {
        return new Promise((resolve, reject) => {
            if (!timeDelay) {
                runChecking();
            } else {
                setTimeout(runChecking, timeDelay);
            }

            function runChecking() {
                const isChecked = toggleShowClass(elem, animationAction);

                if (isChecked) resolve()
                else reject();
            }
        }).then(
            () => true,
            () => false
        );
    }

    function toggleShowClass(elem, animationAction) {
        const isActive = tracklistDatabase.classList.contains('active');

        if (isActive && animationAction === 'show') {
            elem.classList.add('show');
            return true;
        } else if (!isActive && animationAction === 'hide') {
            elem.classList.remove('show');
            return true;
        }

        return false;
    }

    function toggleShowClassWithoutAnimation(animationAction) {
        const totalTracklists = tracklistsContainer.children.length;

        return !totalTracklists ? true : new Promise((resolve, reject) => {
            const initActiveState = tracklistDatabase.classList.contains('active');
            const batchSize = 25;
            let isCancelled = false;
            let i = 0;

            startClassChangeOptimizing();
            optimizeClassChange();

            /// Functions ///
    
            function optimizeClassChange() {
                if (isCancelled) {
                    endClassChangeOptimizing();
                    return resolve();
                }

                if (i < totalTracklists - batchSize) {
                    setTimeout(() => {
                        const curActiveState = tracklistDatabase.classList.contains('active');
    
                        if (curActiveState === initActiveState) {
                            optimizeClassChange();
                        } else { // Изменение открытия/закрытия базы треклистов
                            endClassChangeOptimizing();
                            return reject();
                        }
                    });
                }

                do {
                    toggleShowClass(tracklistsContainer.children[i++], animationAction);
                } while (i % batchSize !== 0 && i < totalTracklists);
    
                if (i >= totalTracklists) {
                    endClassChangeOptimizing();
                    resolve();
                }
            }

            function startClassChangeOptimizing() {
                tracklistsContainer.setAttribute('data-optimizing', '');
                tracklistsContainer.classList.add('no-transition');
                void tracklistsContainer.offsetHeight; // Causes a reflow

                eventManager.addOnceEventListener(tracklistsContainer, 'sortTracklists', cancelTracklistsOptimizing);
            }

            function endClassChangeOptimizing() {
                tracklistsContainer.removeAttribute('data-optimizing');
                void tracklistsContainer.offsetHeight; // Causes a reflow
                tracklistsContainer.classList.remove('no-transition');

                eventManager.removeOnceEventListener(tracklistsContainer, 'sortTracklists', 'cancelTracklistsOptimizing');
            }

            function cancelTracklistsOptimizing() {
                isCancelled = true;
            }
        }).then(
            () => true,
            () => false
        );
    }

    function setAnimationStart(firstAnimElem) {
        eventManager.addOnceEventListener(firstAnimElem, 'transitionstart', () => {
            tracklistDatabase.setAttribute('data-animating', '');
            tracklistDatabase.style.pointerEvents = 'none';
        });
    }

    function setAnimationEnd(lastAnimElem, endAnimFunc) {
        eventManager.addOnceEventListener(lastAnimElem, 'transitionend', () => {
            tracklistDatabase.removeAttribute('data-animating');
            tracklistDatabase.style.pointerEvents = '';
            endAnimFunc();
        });
    }

    async function endShowAnimation() {
        const isFinished = await toggleShowClassWithoutAnimation('show');
        if (!isFinished) return;

        tracklistDatabase.setAttribute('data-ready', '');

        defaultSettingsBtn.disabled = false;
        addOptionsCheckbox.disabled = false;
        tracklistDtbsBtn.classList.replace('waiting', 'enabled');
        tracklistDtbsTitle.firstElementChild.classList.add('run-sheen');

        enableTracklistsContainerScrollBar();
        checkPendingSettingsAction();
        checkStartInfoDisplaying();
        checkTracklistDatabaseUpdates();
    }

    async function endHideAnimation() {
        const isFinished = await toggleShowClassWithoutAnimation('hide');
        if (!isFinished) return;

        if (tracklistDatabase.offsetHeight > audioPlayer.offsetHeight && window.scrollY) {
            window.scrollTo({
                left: window.scrollX,
                top: 0,
                behavior: 'smooth'
            });

            await new Promise(resolve => {
                eventManager.addOnceEventListener(document, 'scrollend', resolve);
            });
        }

        runEndHideAnimation();

        function runEndHideAnimation() {
            if (isTracklistDtbsStickedLeft) {
                moveAudioPlayer();
            } else {
                checkGlobalStates();
                saveActiveElementInfo();

                audioPlayerContainer.style.minHeight = '';
                defaultSettingsBtn.disabled = false;
                addOptionsCheckbox.disabled = false;
                tracklistDatabase.classList.remove('enabled');
                tracklistDtbsBtn.classList.remove('waiting', 'enabled');

                checkStartInfoDisplaying();
            }
        }
    }

    function saveActiveElementInfo() {
        const activeElem = savedActiveElem || document.activeElement;
        if (tracklistDatabase.contains(activeElem) && !savedActiveElem) savedActiveElem = activeElem;
    }

    function disableTracklistsContainerScrollBar() {
        tracklistsContainer.style.paddingRight = '';
        
        if (tracklistsContainer.classList.contains('scrollable')) {
            tracklistsContainer.style.overflow = 'hidden';

            if (!canAutoChangeWidth) {
                const curPaddingRight = parseInt(getComputedStyle(tracklistsContainer).paddingRight);
                tracklistsContainer.style.paddingRight = curPaddingRight + scrollbarWidth + 'px';
            }
        }
    }
    
    function enableTracklistsContainerScrollBar() {
        tracklistsContainer.style.overflow = '';
        tracklistsContainer.style.paddingRight = '';
    }

    function checkGlobalStates() {
        setDocScrollbarYWidth();
        checkScrollElementsVisibility();
        calcTracklistDtbsBtnPosition();
    }

    function checkStartInfoDisplaying() {
        if (!startInfoDisplay.hasAttribute('data-displayed')) {
            tracklistDatabase.dispatchEvent(eventEndTacklistDtbsAnimation);
        }
    }

    async function checkTracklistDatabaseUpdates() {
        const updatePromises = [];

        for (const tracklistId in tracklistDatabaseUpdates) {
            updatePromises.push(Promise.resolve(updateTracklistDatabase(tracklistId)));
        }

        if (updatePromises.length) {
            beginTracklistDatabaseUpdate();
            await Promise.all(updatePromises);
            completeTracklistDatabaseUpdate();
        }
    }
}

////////////////
/// Settings ///
////////////////

settingsArea.onclick = (event) => {
    if (event.target.closest('.close-button')) hideSettings();
    if (event.target.closest('#default-settings')) resetSettings();
};

window.showSettings = showSettings;
window.hideSettings = hideSettings;

function settingsAction() {
    settingsTitle.firstElementChild.classList.remove('run-sheen');

    if (!settingsArea.hasAttribute('data-enabled')) {
        showSettings();
    } else {
        hideSettings();
    }
}

function showSettings() {
    settingsArea.setAttribute('data-enabled', '');
    settingsArea.removeAttribute('data-await-run-hide-settings');

    eventManager.clearEventHandlers(audioPlayer, 'transitionend');

    if (tracklistDatabase.classList.contains('sticked-left')) {
        if ((
                tracklistDatabase.hasAttribute('data-animating') || // Tracklists are showing/hiding
                tracklistDatabase.hasAttribute('data-moving') || // Tracklists are moving
                tracklistsContainer.hasAttribute('data-optimizing')
            ) &&
            !settingsArea.hasAttribute('data-running-action') // No running pending action
        ) {
            settingsArea.setAttribute('data-waiting-action', 'showSettings');
            settingsArea.removeAttribute('data-enabled'); // No switching during tracklist animations
        } else if (
            tracklistDatabase.classList.contains('active')
        ) {
            animateReducingTracklistDtbsWidth();
        } else {
            if (
                audioPlayerContainer.dataset.windowWidth === 'below-justify-right-min' ||
                audioPlayerContainer.dataset.windowWidth === 'between-justify-right-min-max' ||
                audioPlayer.hasAttribute('data-move-info')
            ) {
                animateMovingAudioPlayer();
            } else {
                runShowSettings();
            }
        }
    } else {
        runShowSettings();
    }

    function animateReducingTracklistDtbsWidth() {
        const docWidth = getDocWidth();
        const audioPlayerRight = audioPlayer.getBoundingClientRect().right + window.scrollX;
        const restDocWidth = docWidth - audioPlayerRight;
        const requiredDocWidth = settingsAreaWidth;
        const curTracklistDtbsWidth = tracklistDatabase.offsetWidth;
    
        if (
            requiredDocWidth > restDocWidth &&
            curTracklistDtbsWidth > minTracklistDtbsWidth
        ) {
            tracklistDatabase.setAttribute('data-resizing', '');
    
            tracklistDatabase.style.width = curTracklistDtbsWidth + 'px';
            void tracklistDatabase.offsetWidth; // Causes a reflow
    
            let newTracklistDtbsWidth = curTracklistDtbsWidth - (requiredDocWidth - restDocWidth);
            if (newTracklistDtbsWidth < minTracklistDtbsWidth) newTracklistDtbsWidth = minTracklistDtbsWidth;
    
            tracklistDatabase.classList.add('smooth-resize');
            tracklistDatabase.style.width = newTracklistDtbsWidth + 'px';
    
            eventManager.removeOnceEventListener(tracklistDatabase, 'transitionend', 'endIncreasingTracklistDtbsWidth');
            eventManager.addOnceEventListener(tracklistDatabase, 'transitionend', endReducingTracklistDtbsWidth);

            function endReducingTracklistDtbsWidth(event) {
                tracklistDatabase.removeAttribute('data-resizing');
                tracklistDatabase.classList.remove('smooth-resize');
                event.target.style.width = '';
   
                runShowSettings();
                checkTracklistDatabaseAction();
            }
        } else {
            runShowSettings();
            checkTracklistDatabaseAction();
        }
    }

    function animateMovingAudioPlayer() {
        audioPlayer.setAttribute('data-move-info', '{"trigger": "settingsArea"}');
        audioPlayer.classList.add('smooth-moving');

        if (audioPlayerContainer.dataset.windowWidth !== 'above-justify-right-max') {
            const winWidth = getWinWidth();
            const minWinWidth = audioPlayer.offsetWidth + settingsAreaWidth;
            const transitionEndPoint = winWidth - minWinWidth;
            audioPlayer.style.marginLeft = transitionEndPoint + 'px';
        } else {
            audioPlayer.style.marginLeft = '';
        }

        eventManager.addOnceEventListener(audioPlayer, 'transitionend', function() {
            audioPlayer.removeAttribute('data-move-info');
            audioPlayer.classList.remove('smooth-moving');
            audioPlayer.style.marginLeft = '';

            runShowSettings();
            checkTracklistDatabaseAction();
        });
    }

    function runShowSettings() {
        settingsArea.hidden = false;

        if (settingsArea.hasAttribute('data-running-action')) {
            settingsArea.removeAttribute('data-running-action');
        } else {
            settingsArea.removeAttribute('data-waiting-action');

            if (!tracklistDatabase.hasAttribute('data-animating')) {
                defaultSettingsBtn.disabled = false;
                addOptionsCheckbox.disabled = false;
                tracklistDtbsBtn.classList.remove('waiting');
            }
        }

        settingsArea.parentElement.classList.add('justify-space-between');

        calcTracklistsContainerMaxHeight();
        setDocScrollbarYWidth();
        checkAudioPlayerContainerJustify();
        checkScrollElementsVisibility();
        calcTracklistDtbsBtnPosition();
        scrollDoc('right', 'smooth');

        settingsArea.classList.add('active');

        eventManager.addOnceEventListener(settingsArea, 'transitionend', function showSettingsTitleSheenFx() {
            settingsTitle.firstElementChild.classList.add('run-sheen');
        });

        if (selectedAudio) {
            highlightSelected(selectedAudio);
        } else { // If stop playback while the settings area is hidden,
            //the scroll position and text selection will not be reset
            const activeElem = document.activeElement;
            
            curPlaylist.select();
            curPlaylist.setSelectionRange(0, 0);
            if (curPlaylist !== activeElem) curPlaylist.blur();

            curPlaylist.scrollTo({
                left: 0,
                top: 0,
                behavior: 'instant'
            });

            activeElem.focus();
        }
    }
}

async function hideSettings() {
    settingsArea.removeAttribute('data-enabled');
    settingsArea.setAttribute('data-await-run-hide-settings', '');

    eventManager.clearEventHandlers(audioPlayer, 'transitionend');
    eventManager.removeOnceEventListener(settingsArea, 'transitionend', 'showSettingsTitleSheenFx');

    if (highlightActiveElem) {
        if (highlightActiveElem.closest('#settings-area')) {
            cancelReturningFocus();
        } else {
            scrollEndStates.curPlaylist = true;
        }
    }
    
    settingsArea.classList.remove('active');
    await scrollDoc('left', 'smooth');
    if (!settingsArea.hasAttribute('data-await-run-hide-settings')) return;

    if (!settingsArea.hidden) { // Hide settings after opasity === 0
        promiseChange(settingsArea, 'transition', 'opacity', settingsBtn, 'KeyF', runHideSettings);
    } else {
        runHideSettings();
    }

    function runHideSettings() {
        settingsArea.removeAttribute('data-await-run-hide-settings');

        if (tracklistDatabase.classList.contains('sticked-left')) {
            if (
                (
                    tracklistDatabase.hasAttribute('data-animating') || // Tracklists are showing/hiding
                    tracklistDatabase.hasAttribute('data-moving') || // Tracklists are moving
                    tracklistsContainer.hasAttribute('data-optimizing')
                ) &&
                !settingsArea.hasAttribute('data-running-action')// No running pending action
            ) {
                settingsArea.setAttribute('data-waiting-action', 'hideSettings');
                settingsArea.setAttribute('data-enabled', ''); // No switching during tracklist animations
            } else if (
                tracklistDatabase.classList.contains('active')
            ) {
                animateIncreasingTracklistDtbsWidth();
            } else {
                if (
                    (
                        audioPlayerContainer.dataset.windowWidth === 'between-justify-right-min-max' ||
                        audioPlayer.hasAttribute('data-move-info')
                    ) &&
                    !settingsArea.hasAttribute('data-running-action')
                ) {
                    animateMovingAudioPlayer();
                } else {
                    endHideSettings();
                    checkTracklistDatabaseAction();
                }
            }
        } else {
            endHideSettings();
            checkTracklistDatabaseAction();
        }
    
        function animateIncreasingTracklistDtbsWidth() {
            const curTracklistDtbsWidth = tracklistDatabase.offsetWidth;
            tracklistDatabase.style.width = curTracklistDtbsWidth + 'px';
            
            endHideSettings();
    
            const docWidth = getDocWidth();
            const requiredDocWidth = minTracklistDtbsWidth + audioPlayer.offsetWidth + docScrollArrowsContainer.offsetWidth;
        
            if (
                docWidth > requiredDocWidth &&
                curTracklistDtbsWidth < maxTracklistDtbsWidth
            ) {
                tracklistDatabase.setAttribute('data-resizing', '');
        
                let newTracklistDtbsWidth = curTracklistDtbsWidth + docWidth - requiredDocWidth;
                if (newTracklistDtbsWidth > maxTracklistDtbsWidth) newTracklistDtbsWidth = maxTracklistDtbsWidth;
        
                tracklistDatabase.classList.add('smooth-resize');
                tracklistDatabase.style.width = newTracklistDtbsWidth + 'px';

                eventManager.removeOnceEventListener(tracklistDatabase, 'transitionend',
                    'endReducingTracklistDtbsWidth');
                eventManager.addOnceEventListener(tracklistDatabase, 'transitionend',
                    endIncreasingTracklistDtbsWidth);

                function endIncreasingTracklistDtbsWidth(event) {
                    tracklistDatabase.removeAttribute('data-resizing');
                    tracklistDatabase.classList.remove('smooth-resize');
                    event.target.style.width = '';
    
                    checkGlobalStates();
                    checkTracklistDatabaseAction();
                }
            } else {
                tracklistDatabase.style.width = '';
                checkGlobalStates();
                checkTracklistDatabaseAction();
            }
        }
    
        function animateMovingAudioPlayer() {
            audioPlayer.setAttribute('data-move-info', '{"trigger": "settingsArea"}');

            if (!settingsArea.hidden) {
                const audioPlayerLeft = audioPlayer.getBoundingClientRect().left + window.scrollX;

                endHideSettings();
    
                audioPlayer.classList.remove('smooth-moving');
                audioPlayer.style.marginLeft = audioPlayerLeft + 'px';
                void audioPlayer.offsetWidth; // Causes a reflow
                audioPlayer.classList.add('smooth-moving');
            } else {
                checkGlobalStates();
            }
            
            audioPlayer.style.marginLeft = '';

            eventManager.addOnceEventListener(audioPlayer, 'transitionend', function() {
                audioPlayer.removeAttribute('data-move-info');
                audioPlayer.classList.remove('smooth-moving');

                checkTracklistDatabaseAction();
            });
        }
    
        function endHideSettings() {
            settingsArea.hidden = true;

            if (settingsArea.hasAttribute('data-running-action')) {
                settingsArea.removeAttribute('data-running-action');
            } else {
                settingsArea.removeAttribute('data-waiting-action');

                if (!tracklistDatabase.hasAttribute('data-animating')) {
                    defaultSettingsBtn.disabled = false;
                    addOptionsCheckbox.disabled = false;
                    tracklistDtbsBtn.classList.remove('waiting');
                }
            }

            settingsArea.parentElement.classList.remove('justify-space-between');
    
            checkGlobalStates();
        }
    }
    
    function checkGlobalStates() {
        calcTracklistsContainerMaxHeight();
        setDocScrollbarYWidth();
        checkAudioPlayerContainerJustify(); // Causes a reflow
        checkScrollElementsVisibility();
        calcTracklistDtbsBtnPosition();
    }
}

function checkAudioPlayerContainerJustify() {
    const winWidth = getWinWidth();
    const isDocScrollbar = isDocScrollbarCheck();
    const curScrollbarYWidth = isDocScrollbar ? scrollbarWidth : 0;
    const maxWinWidthForSettings = settingsAreaWidth * 2 + audioPlayer.offsetWidth + curScrollbarYWidth;
    const minWinWidthForSettings = audioPlayer.offsetWidth + settingsAreaWidth;

    if (winWidth < minWinWidthForSettings) {
        audioPlayerContainer.setAttribute('data-window-width', 'below-justify-right-min');
    } else if (winWidth >= minWinWidthForSettings && winWidth <= maxWinWidthForSettings) {
        audioPlayerContainer.setAttribute('data-window-width', 'between-justify-right-min-max');
    } else if (winWidth > maxWinWidthForSettings) {
        audioPlayerContainer.setAttribute('data-window-width', 'above-justify-right-max');
    }

    if (
        audioPlayerContainer.dataset.windowWidth === 'between-justify-right-min-max' &&
        !settingsArea.hidden &&
        !tracklistDatabase.classList.contains('enabled')
    ) {
        audioPlayerContainer.classList.add('justify-right');
    } else {
        audioPlayerContainer.classList.remove('justify-right');

        // Works when the window width has changed or
        // the settings are shown with window width === 'below-justify-right-min'
        if (
            winWidth < minWinWidthForSettings &&
            !tracklistDatabase.classList.contains('enabled') &&
            !settingsArea.hidden
        ) {
            scrollDoc('right', 'instant');
        }
    }
}

function highlightSelected(audio) {
    if (!audio) return;
    if (audio.hasAttribute('data-temp-storage')) return;
    if (!settingsArea.classList.contains('active')) return;
    if (keysInfoWin.classList.contains('active')) return;

    //console.log('+ highlight');

    // Searching string
    const artist = audio.dataset.artist.replace(/[\\+*?^$()[\]{}=!<>|:-]/g, '\\$&');
    const title = audio.dataset.title.replace(/[\\+*?^$()[\]{}=!<>|:-]/g, '\\$&');
    const alt = audio.dataset.alt ? ` \\[alt-${audio.dataset.alt}\\]` : '';
    const dup = audio.dataset.dup ? ` \\(${audio.dataset.dup}\\)` : '';
    const regexp = new RegExp(`^\\d+\\.\\s${artist}\\s\u2013\\s${title}${alt}${dup}$`);
    const keyStr = Array.from(fixedCurPlaylistStrings.keys()).find(str => str.match(regexp));
    const fixedStr = fixedCurPlaylistStrings.get(keyStr);

    // Highlighting
    const startPos = curPlaylist.value.indexOf(fixedStr);
    const strLength = fixedStr.length;
    const lineBreak = fixedStr.at(-1) === '\n' ? 1 : 0;
    const endPos = startPos + strLength - lineBreak;
    
    if (!highlightActiveElem) highlightActiveElem = document.activeElement;

    curPlaylist.select();
    curPlaylist.setSelectionRange(startPos, endPos, 'forward');
    if (curPlaylist !== highlightActiveElem) curPlaylist.blur();

    // Scrolling to center textarea
    let deltaScroll;

    if (curPlaylist.scrollHeight > curPlaylist.clientHeight) {
        const curPlaylistStyle = getComputedStyle(curPlaylist);
        const rowHeight = parseFloat(curPlaylistStyle.lineHeight);
        const visibleRows = curPlaylist.clientHeight / rowHeight;
        const selectedRows = curPlaylist.value.slice(startPos, endPos).split(/\n/).length;
        const stringsTop = curPlaylist.value.slice(0, startPos).split(/\n/);
        const rowsTop = stringsTop.length - 1;

        deltaScroll = (rowsTop - Math.ceil((visibleRows - selectedRows) / 2)) * rowHeight;

        curPlaylist.scrollTo({
            left: 0,
            top: deltaScroll,
            behavior: 'smooth'
        });
    }

    // Checking scroll duration to return focus to the last active element
    if (!acceleration && !timerFinishPlay) {
        const scrollHeight = curPlaylist.scrollHeight;
        const clientHeight = curPlaylist.clientHeight;
        const lastScrollTop = curPlaylist.scrollTop;
        let isScrollActive = false;

        if (deltaScroll && deltaScroll !== lastScrollTop) {
            isScrollActive = (deltaScroll > 0 && scrollHeight - deltaScroll > clientHeight) ||
                (deltaScroll > 0 && lastScrollTop < scrollHeight - clientHeight) ||
                (deltaScroll < 0 && lastScrollTop > 0)
            ;
        }

        if (isScrollActive) {
            eventManager.addOnceEventListener(curPlaylist, 'scrollend', () => scrollEndStates.curPlaylist = true);
        } else {
            scrollEndStates.curPlaylist = true;
        }
    }
}

function cancelReturningFocus() {
    clearTimeout(timerReturnFocusDelay);
    highlightActiveElem = null;
}

function getSettingsAreaWidth() {
    settingsArea.hidden = false;
    const width = settingsArea.offsetWidth;
    settingsArea.hidden = true;
    return width;
}

function resetSettings() {
    changeAudioControlsConfiguration(null);
    changeAudioPlayerColor(null);
    changePlaylistStyle(null);
    changeInitialVolume(null);
    changeNumberOfVisibleTracks(null);
    changeScrollElemsOpacity(null);
    changeWheelScrollStep(null);
    changeAddOptionsDisplaying(null);
    createSortedTracklistSections(null);
}

////////////////////////
/// Keys information ///
////////////////////////

function keysInfoAction() {
    if (!keysInfoWin.classList.contains('active')) {
        showKeysInfo();
    } else {
        hideKeysInfo();
    }
}

function showKeysInfo() {
    activateModalWindow(keysInfoWin);
}

function hideKeysInfo() {
    keysInfoWin.classList.remove('active');
    promiseChange(keysInfoWin, 'transition', 'opacity', keysInfoBtn, 'KeyI', () => deactivateModalWindow(keysInfoWin));
}

// Closing key info by clicking
keysInfoWin.onclick = (event) => {
    if (event.target === keysInfoBtn) return;
    if (event.target.closest('.keys-info') && !event.target.closest('.close-button')) return;

    hideKeysInfo();
};

///////////////////////
/// Global handlers ///
///////////////////////

// Checking document sizes
function getDocWidth() {
    return Math.max(
        document.body.scrollWidth, document.documentElement.scrollWidth,
        document.body.offsetWidth, document.documentElement.offsetWidth,
        document.body.clientWidth, document.documentElement.clientWidth
    );
}

function getDocHeight() {
    return Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight, document.documentElement.offsetHeight,
        document.body.clientHeight, document.documentElement.clientHeight
    );
}

// Checking window sizes
function getWinWidth() {
    return isTouchDevice ? window.innerWidth : document.documentElement.clientWidth;
}

function getWinHeight() {
    return isTouchDevice ? window.innerHeight : document.documentElement.clientHeight;
}

// Check Y-scrollbar
function isDocScrollbarCheck() {
    const winHeight = getWinHeight();
    const docHeight = getDocHeight();

    return docHeight > winHeight;
}

// Deleting temporary global variables
document.addEventListener('scrollend', () => {
    delete window.targetScrollPosX;
    delete window.targetScrollPosY;
});

// Moving document left/right
function scrollDoc(direction, behavior = 'auto') {
    let x;
    
    if (direction === 'right') {
        const docWidth = getDocWidth();
        const winWidth = getWinWidth();
        const restDocWidth = docWidth - winWidth - window.scrollX;
        if (!restDocWidth) return;

        x = docWidth;
    } else if (direction === 'left') {
        if (!window.scrollX) return;

        x = 0;
    } else {
        console.error('Invalid document scroll direction.');
        return;
    }
    
    window.targetScrollPosX = x;
    
    window.scrollTo({
        left: x,
        top: window.targetScrollPosY !== undefined ? window.targetScrollPosY : window.scrollY,
        behavior
    });

    return new Promise(resolve => eventManager.addOnceEventListener(document, 'scrollend', resolve));
}

// Remove elem activity if elem is NOT in focus
document.addEventListener('pointerdown', (event) => {
    if (event.target.matches('input:not([type="checkbox"])')) return;
    if (event.target.tagName === 'TEXTAREA') return;
    if (event.target.closest('#visible-playlist-area')) return;

    const initActiveElem = document.activeElement;

    document.addEventListener('pointerup', () => {
        const curActiveElem = document.activeElement;
        if (curActiveElem !== initActiveElem) curActiveElem.blur();
    }, { once: true });
});

// Highlighting selected track in current playlist
document.addEventListener('click', (event) => {
    if (document.activeElement === curPlaylist) {
        if (highlightActiveElem) {
            cancelReturningFocus();
            stopScrolling(KEY_SCROLLING_TIME);
        }
    }

    if (document.activeElement === document.body) {
        if (highlightActiveElem) cancelReturningFocus();

        // Continuing scrolling the playlist if there is no doc scrollbar and active elem === body
        setTimeout(() => {
            const isDocScrollbar = isDocScrollbarCheck();
            if (!accelerateScrolling || isDocScrollbar) return;

            const key = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
            startScrolling(key);
        });
    }

    if (event.target.closest('#settings-area')) return;
    if (event.target.closest('#keys-info-window')) return;
    if (event.target.closest('#visible-playlist-area')) return;
    if (event.target.closest('i')) return;
    if (event.target.closest(`
        #tracklist-database .tracklist-title,
        #tracklist-database input[type="checkbox"],
        #tracklist-database label,
        #tracklist-database button
    `)) return;
    
    highlightSelected(selectedAudio);
});

// Number inputs
let inputTicking = false;

settingsArea.querySelectorAll('input[type="number"]').forEach(input => {
    input.onkeydown = (event) => {
        if ( //Filtering keys
            (event.key >= '0' && event.key <= '9') ||
            (!event.shiftKey && (event.code === 'ArrowUp' || event.code === 'ArrowDown')) ||
            event.code === 'ArrowLeft' || event.code === 'ArrowRight' ||
            event.code === 'Delete' || event.code === 'Backspace' ||
            event.code === 'Tab' || event.key === 'Enter' ||
            (event.ctrlKey && (event.code === 'KeyX' || event.code === 'KeyC' || event.code === 'KeyV'))
        ) {
            // Optimization for keyrepeat (ArrowUp, ArrowDown)
            if ((event.code === 'ArrowUp' || event.code === 'ArrowDown') && event.repeat) {
                if (!inputTicking) {
                    inputTicking = true;
                    setTimeout(() => inputTicking = false, 50);
                } else {
                    event.preventDefault();
                }
            }

            return true;
        } else {
            return false;
        }
    };
});

// Stop scrolling on context menu
document.oncontextmenu = () => {
    if (accelerateScrolling) stopScrollingAndClean();
};

// Document blur
document.body.onblur = () => {
    setTimeout(() => {
        stopScrollingAndClean();
        stopAccelerationAndClear();
        removeButtonHighlightings();
    });
};

// Focus handler
document.addEventListener('focus', function(event) {
    const selector = 'input, button, textarea, [tabindex]';
    if (!event.target.matches(selector)) return;

    document.getSelection().empty();
    handleFocus(event.target);
}, true);

function handleFocus(elem) {
    if (accelerateScrolling) {
        if (!scrollablePlaylist) return;

        const isDocScrollbar = isDocScrollbarCheck();
        const key = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
        const direction = scrollingKeysData[key].direction;
        const isReachingLimits = checkReachingPlaylistBoundaries(direction);

        // Quickly hide playlist scroll elements
        if (
            isReachingLimits &&
            elem !== visPlaylistArea &&
            isDocScrollbar &&
            !cursorOverPlaylist &&
            !pointerModeScrolling
        ) {
            hideScrollElems();
        }

        // Start/stop scrolling
        if (
            !highlightActiveElem && (
                (elem.matches('input[type="number"]') && (key === 'ArrowUp' || key === 'ArrowDown')) ||
                (!elem.matches('.tracklist-section') && elem.scrollHeight > elem.clientHeight) ||
                (elem !== visPlaylistArea && isDocScrollbar && !cursorOverPlaylist && !pointerModeScrolling)
            )
        ) {
            stopScrolling(KEY_SCROLLING_TIME);
        } else if (
                elem === visPlaylistArea ||
                elem !== curPlaylist && (
                    !isDocScrollbar ||
                    cursorOverPlaylist ||
                    pointerModeScrolling
                )
        ) {
            startScrolling(key);
        }
    }

    // Cancelling returning focus on highlightActiveElem
    if (userInitiatedFocus && highlightActiveElem && elem !== curPlaylist) cancelReturningFocus();

    // Check reaching playlist limits when focusing on the last track via Tab
    if (elem.matches('.track-info-box') && scrollablePlaylist) {
        checkReachingPlaylistBoundaries('all');
    }

    if (pointerModeScrolling) document.dispatchEvent(eventPointerMove);
}

// Alignment after auto scrolling focused track title
visPlaylistArea.addEventListener('keydown', function(event) {
    if (event.code !== 'Tab') return;
    if (!scrollablePlaylist) return;
    if (activeScrollAndAlign) return;

    let track;
    if (event.target === this) track = playlist.firstElementChild;
    if (event.target.matches('.track-info-box')) {
        const lastTrack = event.target.closest('.track');
        track = event.shiftKey ? lastTrack.previousElementSibling : lastTrack.nextElementSibling;
    }
    if (!track) return;

    // Scrolling the document to center the selected track in the window
    const isPlaylistInView = isPlaylistInViewCheck();

    if (!isPlaylistInView) {
        const trackRect = track.getBoundingClientRect();
        const winHeight = getWinHeight();
        let y;

        if (trackRect.top < playlistScrollArrowBoxHeight) {
            y = (Math.round(trackRect.bottom) > playlistScrollArrowBoxHeight) ?
                trackRect.top - playlistScrollArrowBoxHeight :
                trackRect.top - winHeight / 2 + trackRect.height / 2
            ;
        }
        if (trackRect.bottom > winHeight - playlistScrollArrowBoxHeight) {
            y = (Math.round(trackRect.top) < winHeight - playlistScrollArrowBoxHeight) ? 
                playlistScrollArrowBoxHeight - (winHeight - trackRect.bottom) :
                trackRect.bottom - winHeight / 2 - trackRect.height / 2
            ;
        }
        
        if (y) {
            window.scrollBy({
                left: 0,
                top: Math.ceil(y),
                behavior: 'instant'
            });
        }
    }

    // Showing scroll elements and aligning the playlist after auto-scrolling
    if (
        track.offsetTop < playlistLim.scrollTop ||
        track.offsetTop + track.offsetHeight > playlistLim.scrollTop + playlistLim.offsetHeight
    ) {
        setTimeout(() => {
            showScrollElems();
            scrollAndAlignPlaylist({
                direction: (event.shiftKey || track === playlist.firstElementChild) ? 'up' : 'down',
                duration: KEY_SCROLLING_TIME,
                hide: true
            });
        });
    }
});

// Check element visibility in scrollable container
function isElementVisibleInScrollableContainer(container, element) {
    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;
    
    const elementTop = element.offsetTop;
    const elementBottom = elementTop + element.offsetHeight;
    
    const isElementTopVisible = elementTop > containerTop && elementTop < containerBottom;
    const isElementBottomVisible = elementBottom > containerTop && elementBottom < containerBottom;
    const isElementFillsAllVisibleSpace = elementTop < containerTop && elementBottom > containerBottom;
    
    return isElementTopVisible || isElementBottomVisible || isElementFillsAllVisibleSpace;
}

// Creating tooltips
function initTooltipHoverIntentConnections() {
    const tooltipElems = audioPlayerContainer.querySelectorAll('[data-tooltip]');
    tooltipElems.forEach(elem => connectTooltipHoverIntent(elem));
}

function connectTooltipHoverIntent(tooltipElem) {
    setAdditionalAttributes(tooltipElem);
    
    const hoverIntent = new HoverIntent({
        elem: tooltipElem,

        repeatTask: (tooltipElem === timeRange || tooltipElem === volumeRange) ? true : false,

        executeTask() {
            tooltip.textContent = this.elem.dataset.tooltip;
            positionTooltip(this.elemRect, this.y1, 0);
        },

        dismissTask() {
            tooltip.style.opacity = '';
            tooltip.style.transform = '';
        }
    });

    tooltipHoverIntentByElem.set(tooltipElem, hoverIntent);
        
    const specialStrategy = executeTaskHoverIntentStrategies[tooltipElem.id];
    if (specialStrategy) hoverIntent.setExecuteTaskStrategy(specialStrategy);
}

function positionTooltip(targElemRect, elemCursorY, shiftY) {
    let x = targElemRect.left + targElemRect.width / 2 - tooltip.offsetWidth / 2;
    x = Math.max(x, 0);
    x = Math.min(x, document.documentElement.clientWidth - tooltip.offsetWidth);

    let y = targElemRect.top - tooltip.offsetHeight - shiftY;
    if (y < 0) y = targElemRect.top + elemCursorY + 24;

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
    
    tooltip.style.opacity = 1;
    tooltip.style.transform = 'translateY(0)';
}

function setAdditionalAttributes(tooltipElem) {
    tooltipElem.setAttribute('aria-label', tooltipElem.getAttribute('data-tooltip'));

    if (tooltipElem.tagName !== 'BUTTON' && !tooltipElem.classList.contains('update-marker')) {
        tooltipElem.setAttribute('role', 'button');
    }
}

// Promise change on pointer or key event
function promiseChange(animatedElem, animationType, animatedProp, btn, key, func) {
    // animatedProp is used for partial time to resolve the promise.
    // If the full animation time is needed, set it to "null".
    new Promise((resolve, reject) => {
        const animatedElemStyle = getComputedStyle(animatedElem || cssRoot);
        let animatedTime = animatedElem ?
            parseFloat(animatedElemStyle[`${animationType}Duration`]) * 1000 :
            parseInt(animatedElemStyle.getPropertyValue('--transition-time-primary'))
        ;

        if (animatedProp) {
            const curAnimatedPropValue = parseFloat(animatedElemStyle[animatedProp]);
            animatedTime *= curAnimatedPropValue;
        }

        const timerResolvePromise = setTimeout(resolvePromise, animatedTime);

        btn.addEventListener('click', rejectPromise);
        document.addEventListener('keyup', rejectPromise);

        /// Functions ///

        function resolvePromise() {
            removeListeners();
            resolve();
        }

        function rejectPromise(event) {
            if (event.type === 'keyup' && event.code !== key) return;

            clearTimeout(timerResolvePromise);
            removeListeners();
            reject();
        }

        function removeListeners() {
            btn.removeEventListener('click', rejectPromise);
            document.removeEventListener('keyup', rejectPromise);
        }
    }).then(
        func,
        () => {}
    );
}

// Highlighting the pressed button
function highlightButton(key, btn, actionFunc, ...args) {
    highlightedBtns.set(key, btn);

    if (actionFunc === downKeyStepAccAction) {
        const keyAccType = accelerationData.keys[key].accelerationType;
        if (keyAccType !== accelerationType) btn.classList.add('key-pressed');
        actionFunc(...args);
    } else {
        btn.classList.add('key-pressed');
    }

    document.addEventListener('keyup', function removeKeyPressedFx(event) {
        if (event.code !== key) return;
        document.removeEventListener('keyup', removeKeyPressedFx);
        if (!highlightedBtns.has(key)) return;

        highlightedBtns.delete(key);
        const isBtnStillHighlighted = [...highlightedBtns.values()].some(hltBtn => hltBtn === btn);
        if (!isBtnStillHighlighted) btn.classList.remove('key-pressed');

        // Run action function
        if (actionFunc === downKeyStepAccAction) {
            upKeyStepAccAction(key);
        } else {
            actionFunc(...args);
        }
    });
}

function removeButtonHighlightings() {
    for (const [key, btn] of highlightedBtns) {
        btn.classList.remove('key-pressed');
        highlightedBtns.delete(key);
    }
}

// Scroll event
let scrollTicking = false;

document.addEventListener('scroll', function () {
    if (!scrollTicking) {
        requestAnimationFrame(function () {
            calcTracklistsContainerMaxHeight();
            calcTracklistDtbsBtnPosition();
            checkScrollElementsVisibility();

            scrollTicking = false;
        });
    }
    
    scrollTicking = true;
});

// Resize event
let resizeTick = false;

window.addEventListener('resize', () => {
    if (!resizeTick) {
        requestAnimationFrame(function () {
            scrollbarWidth = getScrollbarWidth();
            calcTracklistsContainerMaxHeight();
            setDocScrollbarYWidth();
            checkAudioPlayerContainerJustify();
            checkScrollElementsVisibility();
            checkTracklistDatabasePositionX();
            calcTracklistDtbsBtnPosition();

            resizeTick = false;
        });
    }
    
    resizeTick = true;
});
  
function checkScrollElementsVisibility() {
    const playlistContainerRect = playlistContainer.getBoundingClientRect();
    const playlistLimRect = playlistLim.getBoundingClientRect();
    const winHeight = getWinHeight();
    const isDocScrollbar = isDocScrollbarCheck();
    const isPlaylistInView = isPlaylistInViewCheck(playlistContainerRect);
    const heightShift = (isPlaylistInView || scrollablePlaylist) ? 0 : playlistScrollArrowBoxHeight;
    const docScrollArrowUpBox = docScrollArrowUp.parentElement;
    const docScrollArrowDownBox = docScrollArrowDown.parentElement;
    let playlistLimVisibleTop = 0;
    let playlistLimVisibleBottom = 0;

    // Checking playlist top
    if (playlistContainerRect.top < -heightShift) {
        if (scrollablePlaylist) playlistLimVisibleTop = -playlistLimRect.top + playlistScrollArrowBoxHeight;
        docScrollArrowUpBox.hidden = false;
    } else {
        docScrollArrowUpBox.hidden = true;
    }

    // Checking playlist bottom
    if (playlistContainerRect.bottom > winHeight + heightShift) {
        if (scrollablePlaylist) playlistLimVisibleBottom = playlistLimRect.bottom - winHeight + playlistScrollArrowBoxHeight;
        docScrollArrowDownBox.hidden = false;
    } else {
        docScrollArrowDownBox.hidden = true;
    }

    // Fixing the doc arrows container's height if only the doc arrow up is visible
    const shouldFixHeight = !docScrollArrowUpBox.hidden && docScrollArrowDownBox.hidden;
    docScrollArrowsContainer.classList.toggle('fixed-height', shouldFixHeight);

    // Fixing the doc arrows container's width if the doc arrows are hidden,
    // the audio player is not in view and a touch device is detected
    const shouldFixWidth = canAutoChangeWidth && isDocScrollbar && docScrollArrowUpBox.hidden && docScrollArrowDownBox.hidden;
    docScrollArrowsContainer.classList.toggle('fixed-width', shouldFixWidth);

    // Adding a transparent mask to the playlist
    playlistLim.style.maskImage = (!playlistLimVisibleTop && !playlistLimVisibleBottom) ?
        'none' :
        `linear-gradient(
            transparent ${playlistLimVisibleTop}px,
            var(--color-primary) ${playlistLimVisibleTop}px,
            var(--color-primary) calc(100% - ${playlistLimVisibleBottom}px),
            transparent calc(100% - ${playlistLimVisibleBottom}px)
        )`
    ;
}

function isPlaylistInViewCheck(playlistContainerRect) {
    const winHeight = getWinHeight();

    playlistContainerRect ??= playlistContainer.getBoundingClientRect();
    if (playlistContainerRect.top < 0) return false;
    if (playlistContainerRect.bottom > winHeight) return false;

    return true;
}

function setDocScrollbarYWidth() {
    if (!scrollbarWidth) return;

    const isDocScrollbar = isDocScrollbarCheck();
    const curDocScrollbarYWidth = (isDocScrollbar ? scrollbarWidth : 0) + 'px';
    const savedDocScrollbarYWidth = cssRoot.style.getPropertyValue('--document-scrollbar-y-width');

    if (curDocScrollbarYWidth !== savedDocScrollbarYWidth) {
        cssRoot.style.setProperty('--document-scrollbar-y-width', curDocScrollbarYWidth);
    }
}

// Playlist scroll arrows handlers
playlistScrollArrowUp.onclick = () => {
    if (playlistScrollArrowUp.classList.contains('inactive')) return;

    playlistScrollArrowDown.classList.remove('inactive');

    playlistLim.scrollTo({
        left: 0,
        top: 0,
        behavior: 'smooth'
    });

    eventManager.clearEventHandlers(playlistLim, 'scrollend');
    eventManager.addOnceEventListener(playlistLim, 'scrollend', () => checkReachingPlaylistBoundaries('up'));
};

playlistScrollArrowDown.onclick = () => {
    if (playlistScrollArrowDown.classList.contains('inactive')) return;

    playlistScrollArrowUp.classList.remove('inactive');

    playlistLim.scrollTo({
        left: 0,
        top: playlistLim.scrollHeight,
        behavior: 'smooth'
    });

    eventManager.clearEventHandlers(playlistLim, 'scrollend');
    eventManager.addOnceEventListener(playlistLim, 'scrollend', () => checkReachingPlaylistBoundaries('down'));
};

// Outer scroll arrows handlers
docScrollArrowUp.addEventListener('click', () => {
    const y = 0;
    window.targetScrollPosY = y;

    window.scrollTo({
        left: window.targetScrollPosX !== undefined ? window.targetScrollPosX : window.scrollX,
        top: y,
        behavior: 'smooth'
    });
});

docScrollArrowDown.addEventListener('click', () => {
    const y = Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight, document.documentElement.offsetHeight,
        document.body.clientHeight, document.documentElement.clientHeight
    );
    window.targetScrollPosY = y;

    window.scrollTo({
        left: window.targetScrollPosX !== undefined ? window.targetScrollPosX : window.scrollX,
        top: y,
        behavior: 'smooth'
    });
});

// Modal window on/off
function activateModalWindow(modalWindow) {
    const activeElem = document.activeElement;
    if (!savedActiveElem && activeElem !== document.body) savedActiveElem = activeElem;

    tracklistDatabase.setAttribute('inert', '');
    audioPlayer.setAttribute('inert', '');
    settingsArea.parentElement.setAttribute('inert', '');
    if (modalWindow !== keysInfoWin) keysInfoWin.setAttribute('inert', '');

    modalWindow.hidden = false;
    void modalWindow.offsetWidth;  // Causes a reflow
    modalWindow.classList.add('active');

    const staticArea = modalWindow.querySelector('.static-area');
    if (staticArea) {
        const staticAreaHeight = getComputedStyle(staticArea).height;
        modalWindow.style.setProperty('--static-area-height', staticAreaHeight);
    }
}

function deactivateModalWindow(modalWindow) {
    modalWindow.hidden = true;
    modalWindow.style.removeProperty('--static-area-height');

    if (tracklistDelWin.hidden && tracklistMgrWin.hidden) {
        keysInfoWin.removeAttribute('inert');

        if (keysInfoWin.hidden) {
            tracklistDatabase.removeAttribute('inert');
            audioPlayer.removeAttribute('inert');
            settingsArea.parentElement.removeAttribute('inert');
    
            if (savedActiveElem &&
                (!tracklistDatabase.contains(savedActiveElem) || tracklistDatabase.classList.contains('enabled'))
            ) {
                if (savedActiveElem.tabIndex !== -1) savedActiveElem.focus();
                savedActiveElem = null;
            }
    
            highlightSelected(selectedAudio);
        }
    }
}

// Focus saved active element
function focusSavedActiveElement() {
    if (savedActiveElem && tracklistDelWin.hidden && tracklistMgrWin.hidden && keysInfoWin.hidden) {
        if (savedActiveElem.tabIndex !== -1) savedActiveElem.focus();
        savedActiveElem = null;
    }
}

// Set delay for group animations
function setAnimationDelay(action, idx, func) {
    const key = action + '_' + uuidv4();
    const delay = idx * 20;
    
    animationDelays[key] = setTimeout(function() {
        delete animationDelays[key];
        func();
    }, delay);
}

function cancelAllAnimationDelays(action) {
    Object.keys(animationDelays).forEach(key => {
        if (key.startsWith(action)) {
            clearTimeout(animationDelays[key]);
            delete animationDelays[key];
        }
    });
}

// Formatting text
function sanitizePathSegment(str) {
    return str.trim()
        .replace(/[/\\?%*:|"<>;\x00-\x1F]/g, '-')
        .replace(/\s+/g, '_')
    ;
}

function sanitizeFileName(fileName) {
    return fileName.replace(/[/\\?%*:|"<>;\x00-\x1F]/g, '-');
}
function correctText(str) {
    return str.trim()
        .replace(/\s+/g, ' ')
        .replace(/[\u2013\u2014\u2212]/g, '-')
    ;
}

function restoreText(str) {
    return str
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\s-\s/g, ' \u2013 ')
        .replace(/\|/g, '<wbr>$&<wbr>')
        .replace(/\//g, '<wbr>$&<wbr>')
        .replace(/\\/g, '<wbr>$&<wbr>')
        .replace(/(<wbr>)+/g, '<wbr>')
        .replace(/^<wbr>|<wbr>$/g, '')
    ;
}

function clearTextFromHtml(str) {
    return str.replace(/<.*?>/gi, '');
}

function getTrackName(trackData, sanitize) {
    const fileName = `${trackData.order}. ${trackData.artist} - ${trackData.title}.${trackData.format}`;
    return sanitize ? sanitizePathSegment(fileName) : fileName;
}

// Additinal
function cleanObject(object) {
    Object.keys(object).forEach(key => delete object[key]);
}

////////////////
/// Requests ///
////////////////

async function fetchWithTimeout(url, options, timeout = 10e3) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    options.signal = controller.signal;
    
    try {
        const response = await fetch(url, options);
        clearTimeout(timeoutId);
        return response;
    } catch(error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

async function requestTracklistTitleValidation(requestData) {
    const url = '/audio/tracklist/title';
    const TIMEOUT = 1e3;
    const MAX_RETRIES = 3;
    let attempts = 0;

    return attemptFetch();

    async function attemptFetch() {
        try {
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestData)
            }, TIMEOUT);

            const data = await response.json();
    
            if (response.ok) {
                return data.permission;
            } else {
                throw new Error(`server responded with status ${response.status}`);
            }
        } catch(error) {
            console.error(`Error validating tracklist title:`, error.message);
    
            if (attempts < MAX_RETRIES) {
                attempts++;
                console.log(`Attempt ${attempts}: Retrying to validate tracklist title...`);
                await new Promise(resolve => setTimeout(resolve, error.name === 'AbortError' ? 0 : 1e3));
                return attemptFetch();
            } else {
                console.error('Error validating tracklist title after several attempts:', error);
                return false;
            }
        }
    }
}

function requestStartUpdateSession(requestData) {
    const url = '/audio/tracklist/start-update-session';
    const TIMEOUT = 3e3;
    const MAX_RETRIES = 3;
    let attempts = 0;

    return attemptFetch();

    async function attemptFetch() {
        try {
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestData)
            }, TIMEOUT);
    
            if (response.ok) {
                return await response.json();
            } else {
                throw new Error(`server responded with status ${response.status}`);
            }
        } catch(error) {
            console.error(`Error starting update session:`, error.message);
    
            if (attempts < MAX_RETRIES) {
                attempts++;
                console.log(`Attempt ${attempts}: Retrying to start update session...`);
                await new Promise(resolve => setTimeout(resolve, error.name === 'AbortError' ? 0 : 1e3));
                return attemptFetch();
            } else {
                console.error('Error starting update session after several attempts:', error);
                return null;
            }
        }
    }
}

function requestEndUpdateSession(requestData) {
    const url = '/audio/tracklist/end-update-session';
    const TIMEOUT = 3e3;
    const MAX_RETRIES = 3;
    let attempts = 0;

    return attemptFetch();

    async function attemptFetch() {
        try {
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestData)
            }, TIMEOUT);
    
            if (response.ok) {
                const data = await response.json();
                return data.updatesData;
            } else if (response.status === 408) { // Timeout
                console.error(response.status, 'Tracklist update session has timed out.');
                return null;
            } else {
                throw new Error(`server responded with status ${response.status}`);
            }
        } catch(error) {
            console.error(`Error ending update session:`, error.message);
    
            if (attempts < MAX_RETRIES) {
                attempts++;
                console.log(`Attempt ${attempts}: Retrying to end update session...`);
                await new Promise(resolve => setTimeout(resolve, error.name === 'AbortError' ? 0 : 1e3));
                return attemptFetch();
            } else {
                console.error('Error ending update session after several attempts:', error);
                return null;
            }
        }
    }
}

async function requestTrackDeletion(requestData) {
    const { sessionId, operationId, tracklistId, trackId, trackFormItem, handleResult } = requestData;

    const deletionRequestData = {
        sessionId,
        operationId,
        url: `/audio/tracklist/${tracklistId}/track/${trackId}`,
        handleResult,
        resultData: { trackId, action: 'delete', ...(trackFormItem && { trackFormItem }) }
    };
    
    return requestDeletion(deletionRequestData);
}
    
async function requestTracklistDeletion(requestData) {
    const { sessionId, operationId, tracklistId, handleResult } = requestData;

    const deletionRequestData = {
        sessionId,
        operationId,
        url: `/audio/tracklist/${tracklistId}`,
        handleResult
    };
    
    return requestDeletion(deletionRequestData);
}

async function requestDeletion(requestData) {
    const { sessionId, operationId, url, handleResult, resultData = {} } = requestData;
    const TIMEOUT = 3e3;

    try {
        const response = await fetchWithTimeout(url, {
            method: 'DELETE',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-Session-Id': sessionId,
                'X-Operation-Id': operationId,
                'Accept': 'application/json'
            }
        }, TIMEOUT);
    
        const data = await response.json();

        if (data.successMessage) {
            console.log(response.status, data.successMessage);
            return handleResult(true, resultData);
        } else if (data.errorMessage) {
            throw { statusCode: response.status, message: data.errorMessage };
        }
    } catch(error) {
        if (error.name === 'AbortError') {
            console.log(`Operation (ID: ${operationId}) timed out. Trying status check...`);

            const { operationStatus, responseData } = await requestOperationStatus(sessionId, operationId);
            const isSuccess = ['success', 'post-processing'].includes(operationStatus);

            if (responseData) {
                if (isSuccess) {
                    const { statusCode, successMessage } = responseData;
                    console.log(statusCode, successMessage);
                } else {
                    const { statusCode, errorMessage } = responseData;
                    console.error(statusCode, errorMessage);

                    resultData.error = responseData;
                }
            }

            return handleResult(isSuccess, resultData);
        } else {
            const { statusCode, message } = error;
            console.error.apply(console, statusCode ? [statusCode, message] : [message]);

            resultData.error = error;
            return handleResult(false, resultData);
        }
    }
}

async function prepareTrackManageRequest(requestData) {
    const { sessionId, operationId, isExisting, tracklistId, trackId, file, trackFormData, trackFormItem,
        updateUploadProgress, handleResult } = requestData;
    let progressUpdater = null;
    
    if (file) {
        const uploadFormRow = trackFormItem.querySelector('.form-row.upload');
        const uploadProgress = uploadFormRow?.querySelector('.upload-progress');
        const displayProgress = uploadFormRow?.querySelector('.display-progress');
        const trkUploadElems = { uploadFormRow, uploadProgress, displayProgress };
    
        progressUpdater = (percentComplete) => updateUploadProgress(trkUploadElems, percentComplete);
    }

    const manageRequestData = {
        sessionId,
        operationId,
        url: `/audio/tracklist/${tracklistId}/track/${trackId}`,
        method: isExisting ? 'PATCH' : 'POST',
        file,
        fileType: 'audio',
        formData: trackFormData,
        updateUploadProgress: progressUpdater,
        handleResult,
        resultData: { trackId, action: isExisting ? 'update' : 'create', isFile: !!file, trackFormItem }
    };
    
    return await requestManage(manageRequestData);
}
    
async function prepareTracklistManageRequest(requestData) {
    const { sessionId, operationId, isExisting, tracklistId, tracklistFormData, file, updateCoverOnly, tracklistForm,
        updateUploadProgress, handleResult } = requestData;
    let progressUpdater = null;

    if (file) {
        const uploadFormRow = tracklistForm.querySelector('.form-row.upload');
        const uploadProgress = uploadFormRow?.querySelector('.upload-progress');
        const displayProgress = uploadFormRow?.querySelector('.display-progress');
        const trlUploadElems = { uploadFormRow, uploadProgress, displayProgress };
    
        progressUpdater = (percentComplete) => updateUploadProgress(trlUploadElems, percentComplete);
    }

    const manageRequestData = {
        sessionId,
        operationId,
        additionalHeaders: updateCoverOnly ? { 'X-Update-Cover-Only': true } : {},
        url: `/audio/tracklist/${tracklistId}`,
        method: isExisting ? 'PATCH' : 'POST',
        file,
        fileType: 'image',
        formData: tracklistFormData,
        updateUploadProgress: progressUpdater,
        handleResult,
        resultData: { tracklistId, isFile: !!file, tracklistForm }
    };
    
    return await requestManage(manageRequestData);
}

async function requestManage(requestData) {
    const { sessionId, operationId, additionalHeaders = {}, url, method, file, fileType, formData, updateUploadProgress,
        handleResult, resultData } = requestData;
    const TIMEOUT = 3e3;

    const totalSize = file ? file.size : 0;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    const n = totalChunks || 1;

    const headers = {
        'X-Requested-With': 'XMLHttpRequest',
        'X-Session-Id': sessionId,
        'X-Operation-Id': operationId,
        'X-File-Upload': !!file,
        'Accept': 'application/json',
        ...additionalHeaders
    };
    if (file) {
        headers['X-File-Type'] = fileType;
        headers['X-Total-File-Size'] = totalSize;
        headers['X-Total-Chunks'] = totalChunks;
    }

    for (let i = 0; i < n; i++) {
        let uploadedSize;

        if (file) {
            const start = i * CHUNK_SIZE;
            const end = uploadedSize = Math.min(start + CHUNK_SIZE, totalSize);
            const chunk = file.slice(start, end);
            
            headers['X-Chunk-Index'] = i;
            headers['X-Chunk-Hash'] = await generateClientFileHash(chunk);
            if (i === totalChunks - 1) headers['X-Total-File-Hash'] = await generateClientFileHash(file);

            formData.set('fileChunk', chunk);
        }

        try {
            const response = await fetchWithTimeout(url, {
                method,
                headers,
                body: formData
            }, TIMEOUT);

            if (response.ok && file) {
                const percentComplete = (uploadedSize / totalSize) * 100;
                updateUploadProgress(percentComplete);
            }

            const data = await response.json();

            if (data.successMessage) {
                console.log(response.status, data.successMessage);
                return handleResult(true, resultData);
            } else if (data.errorMessage) {
                throw { statusCode: response.status, message: data.errorMessage };
            }
        } catch(error) {
            if (error.name === 'AbortError') {
                console.log(`Operation (ID: ${operationId}) timed out. Trying status check...`);

                const { operationStatus, responseData } = await requestOperationStatus(sessionId, operationId);

                if (operationStatus === 'chunk-success') {
                    const percentComplete = (uploadedSize / totalSize) * 100;
                    updateUploadProgress(percentComplete);
                    continue;
                } else if (operationStatus === 'chunk-fail') {
                    i--; // Повторная загрузка текущего чанка
                    continue;
                } else {
                    const isSuccess = ['success', 'post-processing'].includes(operationStatus);

                    if (responseData) {
                        if (isSuccess) {
                            const { statusCode, successMessage } = responseData;
                            console.log(statusCode, successMessage);

                            if (file) {
                                const percentComplete = (uploadedSize / totalSize) * 100;
                                updateUploadProgress(percentComplete);
                            }
                        } else {
                            const { statusCode, errorMessage } = responseData;
                            console.error(statusCode, errorMessage);

                            resultData.error = responseData;
                        }
                    }

                    return handleResult(isSuccess, resultData);
                }
            } else {
                const { statusCode, message } = error;
                console.error.apply(console, statusCode ? [statusCode, message] : [message]);

                if (statusCode === 503) { // operation status === 'chunk-fail'
                    i--; // Повторная загрузка текущего чанка
                    console.log(`Retrying chunk ${i} upload after 1 second...`);
                    await new Promise(resolve => setTimeout(resolve, 1e3));
                    continue;
                } else {
                    resultData.error = error;
                    return handleResult(false, resultData);
                }
            }
        }
    }
}

async function requestOperationStatus(sessionId, operationId) {
    const url = `/audio/tracklist-update-session/${sessionId}/operation/${operationId}/status`;
    const TIMEOUT = 1e3;
    const RETRY_DELAY = 1e3;
    const MAX_RETRIES = 3;
    let attempts = 0;
        
    return attemptFetch();

    async function attemptFetch() {
        try {
            const response = await fetchWithTimeout(url, {}, TIMEOUT);

            if (response.ok) {
                const operationData = await response.json();
                const { operationStatus } = operationData;
            
                console.log(`Status of operation (ID: ${operationId}): ${operationStatus}`);
        
                if (['initial', 'chunk-uploading', 'in-progress'].includes(operationStatus)) {
                    console.log(`Retrying operation status check after ${RETRY_DELAY / 1e3} seconds...`);
                    attempts = 0;
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    return attemptFetch();
                } else {
                    return operationData;
                }
            } else {
                throw new Error(`server responded with status ${response.status}`);
            }
        } catch(error) {
            console.error(`Error checking operation status (ID: ${operationId}): ${error.message}`);
            
            if (attempts < MAX_RETRIES) {
                attempts++;
                console.log(`Operation ID ${operationId}). Attempt ${attempts}: Retrying status check...`);
                await new Promise(resolve => setTimeout(resolve, error.name === 'AbortError' ? 0 : 1e3));
                return attemptFetch();
            } else {
                console.error('Error checking operation status after several attempts:', error);
                return { operationStatus: 'unknown' };
            }
        }
    }
}

function requestBackgroundPreloadTrack(audio) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const trackUrl = createTrackUrl(audio);
        xhr.open('GET', trackUrl, true);
        xhr.responseType = 'blob';
        
        xhr.onload = () => {
            if (xhr.status === 200) {
                resolve(xhr.response);
            } else {
                reject(new Error(`Failed to background preload audio track: ${xhr.statusText}`));
            }
        };
        
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.onabort = () => reject(new Error('Request aborted'));

        xhr.send();

        audio.backgroundPreloadRequest = xhr;
    });
}

//////////////////////////////
/// Touch device detection ///
//////////////////////////////

const isTouchDevice = isTouchDeviceCheck();

function isTouchDeviceCheck() {
    if (
        ('ontouchstart' in window) ||
        (window.DocumentTouch && document instanceof DocumentTouch)
    ) {
        return true;
    }
  
    const prefixes = ' -webkit- -moz- -o- -ms- '.split(' ');
    const query = ['(', prefixes.join('touch-enabled),('), 'heartz', ')'].join('');

    return window.matchMedia(query).matches;
}

const canAutoChangeWidth = canAutoChangeWidthCheck();

function canAutoChangeWidthCheck() {
    document.body.style.width = document.body.offsetWidth + 50 + 'px';

    const docWidth = getDocWidth();
    const winWidth = window.innerWidth;

    document.body.style.width = '';

    return docWidth <= winWidth;
}

/////////////////////////////
/// Buttons configuration ///
/////////////////////////////

const configsBank = ['classic', 'stylish'];
let config = localStorage.getItem('buttons_configuration');

customElements.define('audio-controls', class extends HTMLElement {
    connectedCallback() {
        this.attachShadow({mode: 'open'});
    }

    static get observedAttributes() {
        return ['config'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        console.log('buttons ' + name + ' = ' + newValue);

        localStorage.setItem('buttons_configuration', newValue);

        if (oldValue) {
            configBtn.parentElement.classList.remove('rotate');

            const rotateTime = (changeAudioControlsConfiguration.eventType === 'keydown') ? LAG : 0;
            setTimeout(() => {
                configBtn.parentElement.classList.add('rotate');

                promiseChange(configBtn.parentElement, 'animation', null, configBtn, 'KeyZ', () => {
                    configBtn.parentElement.classList.remove('rotate');
                });
            }, rotateTime);
        }

        switch (newValue) {
            case 'classic':
                audioPlayer.insertAdjacentHTML('beforeend', configClassic);
                break;
            case 'stylish':
                audioPlayer.insertAdjacentHTML('beforeend', configStylish);
                break;
        }
        
        const tmplConfig = document.getElementById('tmpl-' + newValue);
        this.shadowRoot.innerHTML = '';
        this.shadowRoot.appendChild(tmplConfig.content.cloneNode(true));
        tmplConfig.remove();
    }
});

function changeAudioControlsConfiguration(idx) {
    config = configsBank[idx] || configsBank[0];
    audioControls.setAttribute('config', config);

    if (visibleTracksCheckbox.checked) {
        calcTracklistsContainerMaxHeight();
        setDocScrollbarYWidth();
        checkScrollElementsVisibility();
        calcTracklistDtbsBtnPosition();
    } else if (changeAudioControlsConfiguration.eventType) {
        changeNumberOfVisibleTracks(numOfVisTracks);
    }

    delete changeAudioControlsConfiguration.eventType;

    highlightSelected(selectedAudio);
}

////////////////////////////////
/// Number of visible tracks ///
////////////////////////////////

const visibleTracksInput = document.getElementById('visible-tracks-input');
const visibleTracksCheckbox = document.getElementById('visible-tracks-checkbox');
let numOfVisTracks = localStorage.getItem('number_of_visible_tracks');

function initVisibleTracksCheckbox() {
    const isChecked = localStorage.getItem('visible_tracks_checkbox_checked');
    visibleTracksCheckbox.checked = isChecked === 'true';
}

visibleTracksCheckbox.onchange = function() {
    const value = this.checked ? visibleTracksInput.value : null;
    changeNumberOfVisibleTracks(value);
};

visibleTracksInput.oninput = () => {
    changeNumberOfVisibleTracks(visibleTracksInput.value);
};

function changeNumberOfVisibleTracks(value) {
    const label = visibleTracksCheckbox.parentElement.querySelector('label');
    
    if (value === null || !visibleTracksCheckbox.checked) {
        visibleTracksCheckbox.checked = false;
        visibleTracksInput.disabled = true;
        label.setAttribute('for', visibleTracksCheckbox.id);

        value = DEFAULTS_DATA[`visible-tracks__${config}-config`];
    } else {
        visibleTracksCheckbox.checked = true;
        visibleTracksInput.disabled = false;
        label.setAttribute('for', visibleTracksInput.id);
    
        const minValue = +visibleTracksInput.min;
        const maxValue = +visibleTracksInput.max;
        value = Math.max(minValue, Math.min(maxValue, Math.round(+value)));
    }

    numOfVisTracks = value;
    if (visibleTracksInput.value !== value.toString()) visibleTracksInput.value = value;
    playlistLim.style.setProperty('--visible-tracks', value);
    localStorage.setItem('number_of_visible_tracks', value);
    localStorage.setItem('visible_tracks_checkbox_checked', visibleTracksCheckbox.checked);

    scrollDoc('right', 'instant');
    calcTracklistsContainerMaxHeight();
    setDocScrollbarYWidth();
    checkAudioPlayerContainerJustify();
    checkPlaylistScrollability();
    checkScrollElementsVisibility();
    calcTracklistDtbsBtnPosition();

    if (accelerateScrolling) {
        const isDocScrollbar = isDocScrollbarCheck();

        if (isDocScrollbar) {
            stopScrolling(KEY_SCROLLING_TIME);
        } else {
            const key = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
            if (key === 'ArrowUp' || key === 'ArrowDown') return;
            
            startScrolling(key);
        }
    }

    if (pointerModeScrolling) document.dispatchEvent(eventPointerMove);
}

/////////////////////////////
/// Audio player coloring ///
/////////////////////////////

const audioPlayerColorsBank = ['black', 'white'];
let audioPlayerColor = localStorage.getItem('audio_player_color');

function changeAudioPlayerColor(idx) {
    highlightSelected(selectedAudio);

    audioPlayerContainer.classList.remove('color-' + audioPlayerColor);
    audioPlayerColor = audioPlayerColorsBank[idx] || audioPlayerColorsBank[0];
    localStorage.setItem('audio_player_color', audioPlayerColor);
    audioPlayerContainer.classList.add('color-' + audioPlayerColor);

    console.log('audio player color = ' + audioPlayerColor);

    audioPlayer.classList.add('changing-color');
    promiseChange(null, null, null, colorBtn, 'KeyX', () => audioPlayer.classList.remove('changing-color'));
}

//////////////////////
/// Playlist style ///
//////////////////////

const playlistStylesBank = ['smooth', 'strict'];
let playlistStyle = localStorage.getItem('playlist_style');

function changePlaylistStyle(idx) {
    highlightSelected(selectedAudio);

    if (selectedAudio) removeSelecting(selectedAudio);
    playlist.classList.remove(playlistStyle);
    playlistStyle = playlistStylesBank[idx] || playlistStylesBank[0];
    localStorage.setItem('playlist_style', playlistStyle);
    playlist.classList.add(playlistStyle);
    if (selectedAudio) setSelecting(selectedAudio);

    console.log('playlist style = ' + playlistStyle);

    switch (playlistStyle) {
        case "smooth": // Font
            playlistStyleBtn.className = 'icon-align-center';
            break;
        case "strict": // Borders
            playlistStyleBtn.className = 'icon-align-left';
            break;
    }
}

//////////////////////
/// Initial volume ///
//////////////////////

let settedVolume = localStorage.getItem('audio_player_volume');
let savedVolume;

function changeInitialVolume(value) {
    if (value === null) value = DEFAULTS_DATA['audio-player-volume'];
    savedVolume = +value || DEFAULTS_DATA['audio-player-volume'];

    const xPos = +value * (volumeRange.offsetWidth - volumeBar.offsetWidth);
    const volumePos = moveVolumeAt(xPos);
    setVolume(volumePos);

    showVolumeIcon(settedVolume);
    volumeBar.classList.toggle('active', settedVolume);
    
    tooltipHoverIntentByElem.get(volumeRange).executeTask();
}

///////////////////////////////
/// Scroll elements opacity ///
///////////////////////////////

const scrollElemsOpacityInput = document.getElementById('scroll-elements-opacity-input');
let scrollElemsOpacity = localStorage.getItem('scroll_elements_opacity');

scrollElemsOpacityInput.oninput = () => {
    changeScrollElemsOpacity(scrollElemsOpacityInput.value);
};

function changeScrollElemsOpacity(value) {
    if (value === null) {
        value = DEFAULTS_DATA['scroll-elements-opacity'];
    } else {
        const minValue = +scrollElemsOpacityInput.min;
        const maxValue = +scrollElemsOpacityInput.max;
        value = Math.max(minValue, Math.min(maxValue, Math.round(+value)));
    }

    scrollElemsOpacity = value;
    if (scrollElemsOpacityInput.value !== value.toString()) scrollElemsOpacityInput.value = value;
    localStorage.setItem('scroll_elements_opacity', value);

    audioPlayerContainer.style.setProperty('--scroll-elements-opacity', value / 100);
}

/////////////////////////
/// Wheel scroll step ///
/////////////////////////

const wheelScrollStepInput = document.getElementById('wheel-scroll-step-input');
let wheelScrollStep = localStorage.getItem('wheel_scroll_step');

wheelScrollStepInput.oninput = () => {
    changeWheelScrollStep(wheelScrollStepInput.value);
};

function changeWheelScrollStep(value) {
    if (value === null) {
        value = DEFAULTS_DATA['wheel-scroll-step'];
    } else {
        const minValue = +wheelScrollStepInput.min;
        const maxValue = +wheelScrollStepInput.max;
        value = Math.max(minValue, Math.min(maxValue, Math.round(+value)));
    }

    wheelScrollStep = value;
    if (wheelScrollStepInput.value !== value.toString()) wheelScrollStepInput.value = value;
    localStorage.setItem('wheel_scroll_step', value);
}

//////////////////////////
/// Tracklist database ///
//////////////////////////

addOptionsCheckbox.onchange = function() {
    changeAddOptionsDisplaying(this.checked);
};

function initAddOptionsCheckbox() {
    const isChecked = localStorage.getItem('add_options_checkbox_checked');
    addOptionsCheckbox.checked = isChecked === 'true';
    changeAddOptionsDisplaying(addOptionsCheckbox.checked);
}

function changeAddOptionsDisplaying(isChecked) {
    if (isChecked === null) isChecked = addOptionsCheckbox.checked = false;
    localStorage.setItem('add_options_checkbox_checked', isChecked);

    if (isChecked) {
        audioPlayerContainer.classList.add('add-options-active');
    } else {
        audioPlayerContainer.classList.remove('add-options-active');

        tracklistDatabase.querySelectorAll('input[type="checkbox"]').forEach(chBox => {
            chBox.checked = true;
            if (chBox.matches('[id$="all"]')) chBox.classList.remove('partial-list');
        });
    }

    calcTracklistsTextIndent();
}

function calcTracklistsTextIndent(list = null) {
    if (!tracklistDatabase.classList.contains('enabled')) return;

    if (list) {
        calcOrderWidth(list);
    } else {
        const addOptionsActivity = audioPlayerContainer.classList.contains('add-options-active') ? 'active' : 'inactive';
        if (tracklistsContainer.dataset.textIndentForAddOptions === addOptionsActivity) return;

        for (const tracklistSection of tracklistsContainer.children) {
            const list = tracklistSection.querySelector('.list');
            calcOrderWidth(list);
        }

        tracklistsContainer.setAttribute('data-text-indent-for-add-options', addOptionsActivity);
    }

    /// Functions ///

    function calcOrderWidth(list) {
        if (!list.children.length) return;

        let maxOrderWidth = 0;

        for (const li of list.children) {
            const order = li.querySelector('.order');

            order.style.display = 'inline';
            const orderWidth = order.offsetWidth;
            order.style.display = '';

            if (orderWidth > maxOrderWidth) maxOrderWidth = orderWidth;
        }

        list.style.setProperty('--order-width', maxOrderWidth + 'px');
    }
}

// Highlight the button element when pressing the label element
tracklistDatabase.addEventListener('pointerdown', (event) => {
    const manageTrklLabel = event.target.closest('label[for^="edit-tracklist"] + label');
    if (!manageTrklLabel) return;

    manageTrklLabel.previousElementSibling.classList.add('key-pressed');

    document.addEventListener('pointerup', () => {
        manageTrklLabel.previousElementSibling.classList.remove('key-pressed');
    }, { once: true });
});

tracklistDatabase.onchange = handleTracklistCheckboxChange;

tracklistDatabase.onclick = (event) => {
    let target;

    // Sort tracklists
    if (event.target.closest('#sort-tracklists')) {
        const trlsSortOrderIdx = trlsSortOrderBank.indexOf(trlsSortOrder);
        createSortedTracklistSections(trlsSortOrderIdx + 1);
        return;
    }
    // Create new tracklist
    if (event.target === createTracklistBtn) {
        showTracklistManager(null);
        return;
    }
    // Expand all tracklist details
    if (event.target === expandAllTrlDetailsBtn) {
        toggleAllTracklistDetails('expand');
        return;
    }
    // Collapse all tracklist details
    if (event.target === collapseAllTrlDetailsBtn) {
        toggleAllTracklistDetails('collapse');
        return;
    }
    // Clear playlist button
    if (event.target === clearPlaylistBtn) {
        clearPlaylist();
        return;
    }
    // Delete tracklist button
    if (target = event.target.closest('i[class*="delete-tracklist-tracks"]')) {
        const tracklistSection = target.closest('.tracklist-section');
        showTracklistDeletion(tracklistSection);
        return;
    }
    // Tracklist title
    if (target = event.target.closest('.tracklist-title')) {
        const tracklistSection = target.closest('.tracklist-section');
        toggleTracklistDetails(tracklistSection);
        return;
    }
    // Replace/add to playlist buttons
    if (target = event.target.closest('i[class*="tracklist-to-playlist"]')) {
        const tracklistSection = target.closest('.tracklist-section');
        const clearPlaylist = target.hasAttribute('data-clear') ? true : false;
        addTracklistToPlaylist(tracklistSection, clearPlaylist);
        return;
    }
    // Manage current tracklist
    if (target = event.target.closest('button[id^="edit-tracklist"]')) {
        const tracklistSection = target.closest('.tracklist-section');
        showTracklistManager(tracklistSection);
        return;
    }
};

function handleTracklistCheckboxChange(event) {
    if (event.target.tagName !== 'INPUT' || event.target.type !== 'checkbox') return;

    const tracklistDetails = event.target.closest('.tracklist-details');
    const listCheckboxes = tracklistDetails.querySelectorAll('.list input[type="checkbox"]');

    if (event.target.closest('header.strip')) {
        const checkboxAll = event.target;

        listCheckboxes.forEach(chBox => chBox.checked = checkboxAll.checked);
        checkboxAll.classList.remove('partial-list');
    } else if (event.target.closest('.list')) {
        const checkboxAll = tracklistDetails.querySelector('header.strip input[type="checkbox"]');
        const checkedListCheckboxes = tracklistDetails.querySelectorAll('.list input[type="checkbox"]:checked');
        const isAllCheckBoxesChecked = listCheckboxes.length === checkedListCheckboxes.length;

        checkboxAll.checked = isAllCheckBoxesChecked;
        checkboxAll.classList.toggle('partial-list', checkedListCheckboxes.length && !isAllCheckBoxesChecked)
    }
}

function toggleAllTracklistDetails(targetState) {
    if (!tracklistDatabase.hasAttribute('data-ready')) return;

    for (const tracklistSection of tracklistsContainer.children) {
        if (tracklistSection.classList.contains('updating')) continue;

        toggleTracklistDetails(tracklistSection, { targetState, applyToAll: true });
    }
}

function toggleTracklistDetails(tracklistSection, { targetState = '', applyToAll = false } = {}) {
    if (!tracklistDatabase.hasAttribute('data-ready')) return;

    const tracklistDetails = tracklistSection.querySelector('.tracklist-details');

    if (tracklistDetails.style.height === '0px' && targetState === 'collapse') return;
    if (tracklistDetails.style.height !== '0px' && targetState === 'expand') return;

    tracklistsContainer.setAttribute('data-toggling-details', '');
    tracklistsContainer.classList.add('no-transition'); // Instant tracklist position changes when the scrollbar toggles

    cancelAnimationFrame(requestCheckScrollabilities);
    eventManager.removeOnceEventListener(tracklistDetails, 'transitionend', 'endDetailsTransition');
    audioPlayerContainer.style.minHeight = '';

    if (tracklistDetails.style.height === '0px') {
        tracklistDetails.style.height = tracklistDetails.scrollHeight + 'px';
    } else {
        tracklistDetails.style.height = tracklistDetails.scrollHeight + 'px';
        void tracklistDetails.offsetHeight; // Causes a reflow
        tracklistDetails.style.height = 0;
    }

    toggleTracklistActivitiesFocusability(tracklistDetails);

    const isExpanded = tracklistDetails.style.height !== '0px';
    tracklistSection.setAttribute('aria-expanded', String(isExpanded));

    activeToggledTrlDetails.add(tracklistDetails);
    requestCheckScrollabilities = requestAnimationFrame(checkScrollabilities);
    eventManager.addOnceEventListener(tracklistDetails, 'transitionend', endDetailsTransition);
    eventManager.addOnceEventListener(tracklistsContainer, 'sortTracklists', cancelDetailsTransition);

    /// Event Handlers and Callbacks ///
    
    function checkScrollabilities() {
        setDocScrollbarYWidth();
        setTracklistsContainerScrollability();
        if (!applyToAll && isExpanded) scrollToViewAnimatedElement(tracklistsContainer, tracklistSection, commonSpacing);
        
        requestCheckScrollabilities = requestAnimationFrame(checkScrollabilities);
    }

    function endDetailsTransition() {
        if (isExpanded) {
            tracklistDetails.style.height = 'auto';
            if (!applyToAll) scrollToViewAnimatedElement(tracklistsContainer, tracklistSection, commonSpacing);
        }

        activeToggledTrlDetails.delete(tracklistDetails);

        if (!activeToggledTrlDetails.size) {
            cancelAnimationFrame(requestCheckScrollabilities);
            requestCheckScrollabilities = null;

            eventManager.removeOnceEventListener(tracklistsContainer, 'sortTracklists', 'cancelDetailsTransition');

            tracklistsContainer.removeAttribute('data-toggling-details');
            tracklistsContainer.classList.remove('no-transition');
            
            checkTracklistDatabaseAction();
        }
    }

    function cancelDetailsTransition() {
        cancelAnimationFrame(requestCheckScrollabilities);
        requestCheckScrollabilities = null;
        
        for (const trlDetails of activeToggledTrlDetails) {
            eventManager.removeOnceEventListener(trlDetails, 'transitionend', 'endDetailsTransition');
        }
        activeToggledTrlDetails.clear();

        checkTracklistDatabaseAction();
    }
}

function clearPlaylist() {
    console.log('clear playlist');

    createPlaylist([], true);
}

function addTracklistToPlaylist(tracklistSection, clearPlaylist) {
    if (!tracklistDatabase.hasAttribute('data-ready')) return;
    if (clearPlaylist && removingTracksCount && origOrderedAudios.length > 100) return;
    
    const checkboxAll = tracklistSection.querySelector('header.strip input[type="checkbox"]');
    const noTracksChecked = !checkboxAll.checked && !checkboxAll.classList.contains('partial-list');
    const list = tracklistSection.querySelector('.list');
    const noTrackInTracklist = !list.children.length;
    const tracksData = (noTracksChecked || noTrackInTracklist) ? [] : getSelectedTracksData(list);

    if (
        (!noTracksChecked && !noTrackInTracklist) ||
        (clearPlaylist && origOrderedAudios.length)
    ) {
        console.log('playlist changed');
    }

    createPlaylist(tracksData, clearPlaylist);

    if (!clearPlaylist) highlightSelected(selectedAudio);
}

function getSelectedTracksData(list) {
    return [].reduce.call(list.children, (tracksData, tracklistTrack) => {
        const isChecked = tracklistTrack.querySelector('input[type="checkbox"]').checked;
        if (isChecked) tracksData.push({ ...tracklistTrack.dataset });
        return tracksData;
    }, []);
}

/////////////////
/// Demo Mode ///
/////////////////

function isDemoMode() {
    const hostname = window.location.hostname;
    
    // Проверка на localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
    
    // Проверка на локальные IP (192.168.x.x, 10.x.x.x и т.д.)
    const isLocalIp = /^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);
    if (isLocalIp) return false;

    // Рабочий IP => Демо-режим
    return true;
}

function showDemoWarning() {
    alert(`Внимание! Приложение работает в демо-режиме. Изменение данных невозможно.`);
}

//////////////////////////
/// Tracklist Deletion ///
//////////////////////////

function tracklistDeletionAction(tracklistSection) {
    if (!tracklistDatabase.hasAttribute('data-ready')) return;
    if (tracklistDelWin.hasAttribute('data-locked')) return;

    if (tracklistDelWin.hidden && tracklistMgrWin.hidden) {
        showTracklistDeletion(tracklistSection);
    } else if (tracklistDelWin.classList.contains('active')) {
        hideTracklistDeletion();
    }
}

function showTracklistDeletion(tracklistSection) {
    if (!tracklistsCollection) return;

    document.getSelection().empty();

    tracklistDelWin.tracklistSection = tracklistSection;

    const manageMode = 'delete';
    const trlRemovalConfirm = tracklistDelWin.querySelector('.tracklist-removal-confirm');
    const trlRemovalCheckbox = trlRemovalConfirm.querySelector('input[type="checkbox"]');
    const emptyTrlRemovalConfirm = tracklistDelWin.querySelector('.empty-tracklist-removal-confirm');
    const okBtn = tracklistDelWin.querySelector('.ok-button');
    const cancelBtn = tracklistDelWin.querySelector('.cancel-button');
    const closeBtn = tracklistDelWin.querySelector('.close-button');

    const tracklistId = tracklistSection.dataset.id;
    const tracklistTitle = tracklistSection.dataset.tracklistTitle;
    const list = tracklistSection.querySelector('.list');
    const checkboxAll = tracklistSection.querySelector('header.strip input[type="checkbox"]');

    const noTracksChecked = !checkboxAll.checked && !checkboxAll.classList.contains('partial-list');
    const totalTracks = list.children.length;
    const pendDelTracks = {};

    if (totalTracks) {
        if (noTracksChecked) {
            okBtn.disabled = true;
        } else {
            const delTracks = tracklistDelWin.querySelector('.deleting-tracks');
            const delTracksFragment = document.createDocumentFragment();

            for (const tracklistTrack of list.children) {
                const checkbox = tracklistTrack.querySelector('input[type="checkbox"]');
                if (!checkbox.checked) continue;

                const li = document.createElement('li');
                li.textContent = tracklistTrack.textContent.replace(/\d+\./, '');
                delTracksFragment.appendChild(li);

                const trackId = tracklistTrack.dataset.id;
                pendDelTracks[trackId] = { action: 'delete' };
            }

            delTracks.appendChild(delTracksFragment);
        }
    }

    const pendDelTrackIds = Object.keys(pendDelTracks);
    const pendDelTracksNum = pendDelTrackIds.length;
    const delTracksInfo = !pendDelTracksNum ? 'No' : (pendDelTracksNum < totalTracks) ? pendDelTracksNum : 'All';

    tracklistDelWin.querySelector('.deleting-tracks-number').textContent = delTracksInfo;
    tracklistDelWin.querySelector('.plural-suffix').textContent = pendDelTracksNum === 1 ? '' : 's';
    tracklistDelWin.querySelector('.target-tracklist').innerHTML = restoreText(tracklistTitle);

    if (delTracksInfo === 'No') {
        tracklistDelWin.querySelector('#tracklist-deletion-description').classList.add('period');

        if (totalTracks) {
            tracklistDelWin.querySelector('.warning-info').hidden = true;
        } else {
            emptyTrlRemovalConfirm.hidden = false;
        }
    } else if (delTracksInfo === 'All') {
        trlRemovalConfirm.hidden = false;
    }

    tracklistDelWin.onclick = (event) => {
        if (event.target.closest('.ok-button')) {
            launchTracklistUpdateSession();
            return;
        }

        if (tracklistDelWin.hasAttribute('data-locked')) return;

        if (
            event.target.closest('.close-button') ||
            event.target.closest('.cancel-button') ||
            (!event.target.closest('.dialog-box') && !document.getSelection().toString().length)
        ) {
            hideTracklistDeletion();
            return;
        }
    };

    activateModalWindow(tracklistDelWin);

    /// Functions ///

    async function launchTracklistUpdateSession() {
        if (isDemoMode()) {
            showDemoWarning();
            return;
        }

        console.log(`%cdelete tracks from "${tracklistTitle}" tracklist`, `
            color: #fafafa;
            background-color: rgba(196, 13, 43, 0.9);
        `);
        
        prepareDeletion();

        const shouldDeleteTracklist = (!trlRemovalConfirm.hidden && trlRemovalCheckbox.checked) ||
            !emptyTrlRemovalConfirm.hidden;
        
        const sessionUpdateData = await requestStartUpdateSession({
            clientId,
            manageMode,
            tracklistId,
            pendingTracklistActions: shouldDeleteTracklist ? ['delete'] : [],
            pendingTracks: pendDelTracks
        });
        let sessionId, assignedOperationIds;

        if (sessionUpdateData) {
            ({ sessionId, assignedOperationIds } = sessionUpdateData);

            registerTracklistUpdate(tracklistId, pendDelTracks);
            setUpdateMarkers(manageMode, tracklistId, pendDelTracks);
            loadFullSelectedAudio(pendDelTracks);

            const trackStates = await deleteTracks();
            const deletedTracks = Object.keys(trackStates.successful).length;
            const isTracklistEmpty = deletedTracks === totalTracks;
            if (shouldDeleteTracklist && isTracklistEmpty) await deleteTracklist();
    
            const updatesData = await requestEndUpdateSession({ sessionId, clientId, isAborted: false });

            if (updatesData) {
                const { tracklistActions, trackActions } = updatesData;
                const { successful: successfulTrlActions } = tracklistActions;
                const { successful: successfulTracks, rejected: rejectedTracks } = trackActions;
                const hasCompletedUpdates = successfulTrlActions.length || Object.keys(successfulTracks).length;
    
                unregisterTracklistUpdate(tracklistId, successfulTracks, rejectedTracks);
                updatePlaylistTracks(updatesData);
    
                if (hasCompletedUpdates) {
                    console.log('Completed tracklist updates confirmed and distributed:', updatesData);
    
                    updateTracklistsCollection(updatesData);
                    enqueueTracklistDatabaseUpdate(tracklistId, updatesData);
                } else {
                    console.log('No tracklist updates found:', updatesData);
    
                    removeRejectedTracklistTracksUpdateMarkers(manageMode, tracklistSection, rejectedTracks);
                    removeTracklistUpdateMarkers(tracklistId, tracklistSection);
                    removeTracklistDatabaseUpdateMarker();
                }
            }
        }

        await hideTracklistDeletion();
        await updateTracklistDatabase(tracklistId);
        completeTracklistDatabaseUpdate();

        /// Functions ///

        function prepareDeletion() {
            tracklistDelWin.setAttribute('data-locked', '');
            beginTracklistDatabaseUpdate();
            trlRemovalCheckbox.disabled = true;
            okBtn.disabled = true;
            cancelBtn.disabled = true;
            closeBtn.disabled = true;
        }
    
        async function deleteTracks() {
            const requestPromises = pendDelTrackIds.map(deleteTrack);
            const deleteResults = await Promise.allSettled(requestPromises);

            return deleteResults.reduce((acc, { status, value, reason }) => {
                if (status === 'fulfilled' && value) {
                    const { trackId, action } = value;
                    acc.successful[trackId] = { action };
                } else if (status === 'rejected') {
                    acc.rejected.push(reason);
                }
                return acc;
            }, { successful: {}, rejected: [] });

            /// Functions ///

            async function deleteTrack(trackId) {
                const prepareData = {
                    sessionId,
                    operationId: assignedOperationIds[trackId],
                    tracklistId,
                    trackId,
                    handleResult: (isSuccess, resultData) => isSuccess ?
                        Promise.resolve(resultData) :
                        Promise.reject(resultData)
                };
                return await requestTrackDeletion(prepareData);
            }
        }

        async function deleteTracklist() {
            const prepareData = {
                sessionId,
                operationId: assignedOperationIds[tracklistId],
                tracklistId,
                handleResult: (isSuccess) => isSuccess
            };
            return await requestTracklistDeletion(prepareData);
        }
    }
}

function hideTracklistDeletion() {
    const trlRemovalConfirm = tracklistDelWin.querySelector('.tracklist-removal-confirm');
    const trlRemovalCheckbox = trlRemovalConfirm.querySelector('input[type="checkbox"]');

    tracklistDelWin.onclick = null;

    tracklistDelWin.classList.remove('active');

    return new Promise(resolve => {
        eventManager.addOnceEventListener(tracklistDelWin, 'transitionend', () => {
            deactivateModalWindow(tracklistDelWin);
    
            tracklistDelWin.removeAttribute('data-locked');
            tracklistDelWin.querySelector('#tracklist-deletion-description').classList.remove('period');
            tracklistDelWin.querySelector('.deleting-tracks-number').textContent = '';
            tracklistDelWin.querySelector('.target-tracklist').textContent = '';
            tracklistDelWin.querySelector('.deleting-tracks').innerHTML = '';
            trlRemovalConfirm.hidden = true;
            trlRemovalCheckbox.checked = true;
            trlRemovalCheckbox.disabled = false;
            tracklistDelWin.querySelector('.empty-tracklist-removal-confirm').hidden = true;
            tracklistDelWin.querySelector('.warning-info').hidden = false;
            tracklistDelWin.querySelector('.ok-button').disabled = false;
            tracklistDelWin.querySelector('.cancel-button').disabled = false;
            tracklistDelWin.querySelector('.close-button').disabled = false;
            delete tracklistDelWin.tracklistSection;

            resolve();
        });
    });
}

/////////////////////////
/// Tracklist Manager ///
/////////////////////////

function tracklistManagerAction(tracklistSection) {
    if (!tracklistDatabase.hasAttribute('data-ready')) return;
    if (tracklistMgrWin.hasAttribute('data-locked')) return;

    if (tracklistMgrWin.hidden && tracklistDelWin.hidden) {
        showTracklistManager(tracklistSection);
    } else if (tracklistMgrWin.classList.contains('active')) {
        hideTracklistManager();
    }
}

function showTracklistManager(tracklistSection) {
    if (!tracklistsCollection) return;

    document.getSelection().empty();
    
    const manageMode = tracklistSection ? 'edit' : 'create';
    tracklistMgrWin.setAttribute('data-mode', manageMode);
    if (manageMode === 'edit') tracklistMgrWin.tracklistSection = tracklistSection;

    const tracklistMgrScrollArea = tracklistMgrWin.querySelector('.scrollable-area');
    const tracklistMgrTitle = tracklistMgrWin.querySelector('#tracklist-manager-title');
    const tracklistMgrDescr = tracklistMgrWin.querySelector('#tracklist-manager-description');
    const tracklistForm = tracklistMgrWin.querySelector('.tracklist-form');
    const trackForms = tracklistMgrWin.querySelector('.track-forms');
    const dropZone = tracklistMgrWin.querySelector('.drop-zone');
    const addTrackFormItemBtn = dropZone.firstElementChild;
    const trlRemovalConfirm = tracklistMgrWin.querySelector('.tracklist-removal-confirm');
    const trlRemovalCheckbox = trlRemovalConfirm.querySelector('input[type="checkbox"]');
    const totalUploadRow = tracklistMgrWin.querySelector('.total-upload-row');
    const totalUploadProgress = totalUploadRow.querySelector('.upload-progress');
    const totalDisplayProgress = totalUploadRow.querySelector('.display-progress');
    const okBtn = tracklistMgrWin.querySelector('.ok-button');
    const cancelBtn = tracklistMgrWin.querySelector('.cancel-button');
    const closeBtn = tracklistMgrWin.querySelector('.close-button');

    tracklistForm.innerHTML = `
        <p class="tracklist-title-edit form-row text">
            <label for="input-tracklist-title" class="label-text">Tracklist title:</label
            ><input id="input-tracklist-title" name="tracklist-title" type="text" placeholder="Enter tracklist title"
            ><button class="reset inactive" tabindex="-1"><i class="icon-ccw"></i></button
            ><span class="state">
                <i class="icon-check ok" hidden></i>
                <i class="icon-cancel fail" hidden></i>
                <i class="icon-spin5 animate-spin wait"></i>
            </span>
        </p>
        <p class="tracklist-cover-edit form-row file">
            <span class="label-text">Tracklist cover:<br>
                <span class="add-info">(optional, 120x120px)</span>
            </span
            ><label for="input-tracklist-cover" class="file-name" tabindex="0"></label
            ><input id="input-tracklist-cover" name="cover-file" type="file" data-optional
                accept="image/jpeg, image/png, image/gif, image/svg+xml, image/webp, image/avif"
            ><button class="reset inactive" tabindex="-1"><i class="icon-ccw"></i></button
            ><span class="state">
                <i class="icon-check ok" hidden></i>
                <i class="icon-cancel fail" hidden></i>
            </span>
        </p>
    `;

    const tracklistTitleInput = tracklistForm.querySelector('.tracklist-title-edit > input[type="text"]');
    const tracklistCoverInput = tracklistForm.querySelector('.tracklist-cover-edit > input[type="file"]');
    const coverFileName = tracklistCoverInput.parentElement.querySelector('.file-name');

    const delTrackFieldsetById = new Map();
    const postDialogSelectionTimers = new Map();
    const uploadProgressIndicators = new Map();
    let allInputs = [tracklistTitleInput, tracklistCoverInput];
    let sessionStatus = 'data-collecting';
    let trackFormItemCount = 0;
    let trackFormAnimationCount = 0;
    let shouldDeleteTracklist = false;
    let isValidationInProgress = true;
    let tracklistId;

    switch (manageMode) {
        case 'edit':
            tracklistId = tracklistSection.dataset.id;
            const tracklistData = tracklistsCollection.get(tracklistId);
            const { tracklistTitle, cover: coverName } = tracklistData;
            const sanitezedTracklistTitle = sanitizePathSegment(tracklistTitle);
    
            tracklistMgrTitle.textContent = 'Manage Existing Tracklist';
            tracklistMgrDescr.innerHTML = `
                Edit tracklist
                <span class="target-tracklist">
                    <span class="quotes">«</span>${restoreText(tracklistTitle)}<span class="quotes">»</span>
                </span>
                with new tracks and sequences.
            `;
    
            tracklistTitleInput.value = tracklistTitle;
            tracklistTitleInput.setAttribute('data-original-value', tracklistTitle);

            const baseUrl = window.location.protocol + '//' + window.location.host + '/';
            const coverSrc = coverName ? `${sanitezedTracklistTitle}/${coverName}` : '';
            let coverUrl = null;
            
            if (coverSrc) {
                coverUrl = baseUrl + '.../' + coverSrc;
                tracklistCoverInput.setAttribute('data-existing-file', coverUrl);
            }
    
            coverFileName.textContent = coverUrl || 'Select a file';
            coverFileName.classList.toggle('missing', !coverUrl);
    
            fileByInput.set(tracklistCoverInput, coverUrl);
    
            const list = tracklistSection.querySelector('.list');

            if (list.children.length) {
                for (let i = 0; i < list.children.length; i++) {
                    const tracklistTrack = list.children[i];
                    const trackSrc = `${sanitezedTracklistTitle}/${getTrackName(tracklistTrack.dataset, true)}`;
                    const trackUrl = `${baseUrl}.../${trackSrc}`;
        
                    setAnimationDelay('create-track-fieldset', i * 5, () => addTrackFormItem(tracklistTrack, trackUrl));
                }
            } else {
                validateFormInputs(allInputs);
            }

            break;

        case 'create':
            tracklistMgrTitle.textContent = 'Create Tracklist';
            tracklistMgrDescr.textContent = 'Set up a new tracklist with ease.';

            coverFileName.textContent = 'Select a file';
            coverFileName.classList.add('missing');

            fileByInput.set(tracklistCoverInput, null);

            trlRemovalConfirm.hidden = true;

            break;
    }

    const debouncedValidateFormInput = debounceFormInputValidation(validateFormInputs, INPUT_VALIDATION_DELAY);

    tracklistMgrWin.oninput = (event) => {
        const formInput = event.target;
        if (!formInput.matches('input[type="text"], input[type="file"]')) return;
        if (sessionStatus === 'data-checking') return;

        if (formInput === tracklistTitleInput) {
            waitInputValidation(formInput);
            debouncedValidateFormInput(formInput);
        } else {
            validateFormInputs([formInput]);
        }
    };

    tracklistMgrWin.onkeydown = (event) => {
        if (event.key === 'Enter') {
            if (sessionStatus === 'data-checking') return;
            
            if (event.target.matches('.file-name')) {
                const label = event.target;
                const input = document.getElementById(label.getAttribute('for'));
                if (input && input.type === 'file') input.click();
                return;
            }
            
            if (event.target.matches('input[type="text"]')) {
                if (okBtn && !okBtn.disabled) okBtn.click()
                else validateFormInputs([event.target]);
                return;
            }

            if (event.target.matches('.restore-button')) {
                restoreTrackFormItem(event.target);
                return;
            }
        }
    };

    // Confirm changes
    okBtn.onclick = launchTracklistUpdateSession;

    tracklistMgrWin.onclick = (event) => {
        if (tracklistMgrWin.hasAttribute('data-locked')) return;

        let target;

        // Add new track item
        if (event.target.closest('.add-track-form-item')) {
            addTrackFormItem(null, null, true);
            return;
        }
        // Check input file
        // Useful if the file is not selected or the new file matches the old one (event 'oninput' not works)
        if (target = event.target.closest('input[type="file"]')) {
            validateFileSelection(target);
            return;
        }
        // Reset input state
        if (target = event.target.closest('.reset')) {
            resetInputState(target);
            return;
        }
        // Change track item order
        if (target = event.target.closest('.direction')) {
            changeTrackFormItemOrder(target);
            return;
        }
        // Remove new track item
        if (target = event.target.closest('.remove-track-form-item')) {
            removeTrackFormItem(target);
            return;
        }
        // Restore form of the existing track
        if (target = event.target.closest('.restore-button')) {
            restoreTrackFormItem(target);
            return;
        }
        // Cancel and hide tracklist manager
        if (
            event.target.closest('.close-button') ||
            event.target.closest('.cancel-button') ||
            (!event.target.closest('.dialog-box') && !document.getSelection().toString().length)
        ) {
            hideTracklistManager();
            return;
        }
    };

    dropZone.ondragenter = function(event) {
        if (event.relatedTarget && event.relatedTarget.closest('.drop-zone')) return;
        dropZone.classList.add('active');
    };
    dropZone.ondragleave = function(event) {
        if (event.relatedTarget && event.relatedTarget.closest('.drop-zone')) return;
        dropZone.classList.remove('active');
    };
    dropZone.ondragover = function(event) {
        event.preventDefault();
    };
    dropZone.ondrop = function(event) {
        event.preventDefault();
        dropZone.classList.remove('active');

        const files = event.dataTransfer.files;

        for (let i = 0; i < files.length; i++) {
            if (allowedAudioTypes.includes(files[i].type)) {
                setAnimationDelay('create-track-fieldset', i * 5, () => addTrackFormItem(null, files[i]));
            } else {
                console.log('Unsupported file type:', files[i].name);
            }
        }
    };

    if (manageMode === 'edit') {
        trlRemovalCheckbox.onchange = function() {
            if (this.checked) {
                shouldDeleteTracklist = true;
                isValidationInProgress = false;
                tracklistMgrScrollArea.setAttribute('data-form-changed', '');
                tracklistMgrWin.querySelector('.dialog-box').classList.add('warning');
                disableActiveFormElements(...tracklistForm.children, ...trackForms.children);
                dropZone.classList.add('inactive');
                addTrackFormItemBtn.classList.add('inactive');
                okBtn.disabled = false;
            } else {
                shouldDeleteTracklist = false;
                tracklistMgrWin.querySelector('.dialog-box').classList.remove('warning');
                enableActiveFormElements(...tracklistForm.children, ...trackForms.children);
                updateDirectionButtons();
                dropZone.classList.remove('inactive');
                addTrackFormItemBtn.classList.remove('inactive');
                waitInputValidation(tracklistTitleInput);
                validateFormInputs(allInputs);
            }
        };
    }

    activateModalWindow(tracklistMgrWin);

    /// Functions ///

    async function addTrackFormItem(tracklistTrack, file) {
        if (!tracklistMgrWin.classList.contains('active')) return;

        trackFormItemCount++;

        const trackStatus = tracklistTrack ? 'existing' : 'new';
        const newTrackClass = !tracklistTrack ? ' class="new-track"' : '';
        let legendOrderClass = 'order';

        const trackFormItem = document.createElement('li');
        trackFormItem.id = `track-form-item[${trackFormItemCount}]`;
        trackFormItem.setAttribute('data-status', trackStatus);
        trackFormItem.setAttribute('data-order', trackFormItemCount);
        if (trackStatus === 'existing') {
            const { id: trackId, order: origOrder } = tracklistTrack.dataset;
            trackFormItem.setAttribute('data-id', trackId);
            trackFormItem.setAttribute('data-original-order', origOrder);
            if (Number(origOrder) !== trackFormItemCount) legendOrderClass += ' changed';
        }
        trackFormItem.innerHTML = `
            <div class="content-box">
                <fieldset${newTrackClass}>
                    <legend>Track <span class="${legendOrderClass}">${trackFormItemCount}</span> (${trackStatus})</legend>

                    <div class="track-form">
                        <p class="form-row text">
                            <label for="input-track[${trackFormItemCount}]-artist" class="label-text">Artist name:</label
                            ><input id="input-track[${trackFormItemCount}]-artist" name="artist" type="text"
                                placeholder="File's tag auto-fills the field"
                            ><button class="reset inactive" tabindex="-1"><i class="icon-ccw"></i></button
                            ><span class="state">
                                <i class="icon-check ok" hidden></i>
                                <i class="icon-cancel fail" hidden></i>
                            </span>
                        </p>
                        <p class="form-row text">
                            <label for="input-track[${trackFormItemCount}]-title" class="label-text">Track title:</label
                            ><input id="input-track[${trackFormItemCount}]-title" name="title" type="text"
                                placeholder="File's tag auto-fills the field"
                            ><button class="reset inactive" tabindex="-1"><i class="icon-ccw"></i></button
                            ><span class="state">
                                <i class="icon-check ok" hidden></i>
                                <i class="icon-cancel fail" hidden></i>
                            </span>
                        </p>
                        <p class="form-row file">
                            <span class="label-text">Music file:</span
                            ><label for="input-track[${trackFormItemCount}]-file" class="file-name" tabindex="0"></label
                            ><input id="input-track[${trackFormItemCount}]-file" name="track-file" type="file"
                                accept="${allowedAudioTypes.join(', ')}"
                            ><button class="reset inactive" tabindex="-1"><i class="icon-ccw"></i></button
                            ><span class="state">
                                <i class="icon-check ok" hidden></i>
                                <i class="icon-cancel fail" hidden></i>
                            </span>
                        </p>
                    </div>

                    <div class="track-order-panel">
                        <button class="direction up" data-tooltip="Move track up">
                            <i class="icon-up-dir"></i>
                        </button>
                        <button class="direction down" data-tooltip="Move track down">
                            <i class="icon-down-dir"></i>
                        </button>
                    </div>
                    
                    <button class="remove-track-form-item" data-tooltip="Cancel track adding">
                        <i class="icon-minus-circled"></i>
                    </button>
                </fieldset>
            </div>
        `;

        const artistNameInput = trackFormItem.querySelector('input[name="artist"]');
        const trackTitleInput = trackFormItem.querySelector('input[name="title"]');
        const fileInput = trackFormItem.querySelector('input[name="track-file"]');

        allInputs.push(artistNameInput, trackTitleInput, fileInput);

        if (trackStatus === 'existing') {
            const artistName = tracklistTrack.dataset.artist;
            artistNameInput.value = artistName;
            artistNameInput.setAttribute('data-original-value', artistName);

            const trackTitle = tracklistTrack.dataset.title;
            trackTitleInput.value = trackTitle;
            trackTitleInput.setAttribute('data-original-value', trackTitle);

            fileInput.setAttribute('data-existing-file', file);
        }

        if (file instanceof File) await extractFileTags(fileInput, file);

        updateFileInput(fileInput, file);

        const tooltipElems = trackFormItem.querySelectorAll('[data-tooltip]');
        tooltipElems.forEach(elem => connectTooltipHoverIntent(elem));

        trackForms.appendChild(trackFormItem);

        // Show animation
        disableActiveFormElements(trackFormItem);

        const trackFormItemHeight = trackFormItem.offsetHeight;
        trackFormItem.classList.add('show');
        trackFormItem.style.setProperty('--track-form-item-height', trackFormItemHeight + 'px');
        trackFormAnimationCount++;

        requestAnimationFrame(function callback() {
            scrollToViewAnimatedElement(tracklistMgrScrollArea, trackFormItem);

            if (!tracklistMgrWin.classList.contains('active')) return;
            if (!trackFormItem.classList.contains('show')) return;
            if (trackFormItem.nextElementSibling) return;

            requestAnimationFrame(callback);
        });

        eventManager.addOnceEventListener(trackFormItem, 'animationend', () => {
            trackFormAnimationCount--;

            trackFormItem.classList.remove('show');
            trackFormItem.style.removeProperty('--track-form-item-height');

            enableActiveFormElements(trackFormItem);
            updateDirectionButtons(trackFormItem);

            if (trackStatus === 'existing' && !trackFormAnimationCount) {
                validateFormInputs(allInputs);

                setTimeout(() => {
                    tracklistMgrScrollArea.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                }, 200);
            } else if (trackStatus === 'new') {
                validateFormInputs([artistNameInput, trackTitleInput, fileInput]);
            }
        });
    }

    function removeTrackFormItem(removeBtn) {
        trackFormItemCount--;
        trackFormAnimationCount++;

        const delTrackFormItem = removeBtn.closest('[id^="track-form-item"]');
        const fileInput = delTrackFormItem.querySelector('input[type="file"]');
        const delTrackFormItemOrder = Number(delTrackFormItem.dataset.order);
        const activeElem = document.activeElement;

        disableActiveFormElements(delTrackFormItem);

        const delTrackFormItemInputs = new Set(delTrackFormItem.querySelectorAll('input'));
        allInputs = allInputs.filter(input => !delTrackFormItemInputs.has(input));

        if (delTrackFormItem.dataset.status === 'existing') {
            const artist = delTrackFormItem.querySelector('input[name="artist"]').dataset.originalValue;
            const title = delTrackFormItem.querySelector('input[name="title"]').dataset.originalValue;
            const tracklistTitle = tracklistTitleInput.dataset.originalValue;
            let transformationsCompleted = 0;

            const delInfoBox = document.createElement('div');
            delInfoBox.className = 'content-box';
            delInfoBox.innerHTML = `
                <p class="delete-info">
                    The existing track
                    <span class="target-text">
                        <span class="quotes">«</span>${restoreText(artist + ' - ' + title)}<span class="quotes">»</span>
                    </span>
                    <span class="status-text">will be deleted</span>
                    from the tracklist
                    <span class="target-text">
                        <span class="quotes">«</span>${restoreText(tracklistTitle)}<span class="quotes">»</span>
                    </span>.
                    <span class="restore-text">
                        <button class="restore-button inactive" tabindex="-1">Restore</button>
                        the form.
                    </span>
                </p>
            `;
            delTrackFormItem.appendChild(delInfoBox);
            
            const delInfoBoxHeight = delInfoBox.offsetHeight;
            delInfoBox.classList.add('expand');
            delInfoBox.style.position = 'absolute';
            delInfoBox.style.setProperty('--content-box-height', delInfoBoxHeight + 'px');

            eventManager.addOnceEventListener(delInfoBox, 'animationend', () => {
                transformationsCompleted++;
                if (transformationsCompleted === 2) completeAnimationSequence();
            });

            const fieldsetBox = delTrackFormItem.firstElementChild;
            const fieldsetBoxHeight = fieldsetBox.offsetHeight;
            fieldsetBox.style.height = fieldsetBoxHeight + 'px';
            fieldsetBox.classList.add('collapse');
            fieldsetBox.style.setProperty('--content-box-height', delInfoBoxHeight + 'px');

            eventManager.addOnceEventListener(fieldsetBox, 'animationend', () => {
                transformationsCompleted++;
                if (transformationsCompleted === 2) completeAnimationSequence();
            });

            function completeAnimationSequence() {
                trackFormAnimationCount--;

                delInfoBox.classList.remove('expand');
                delInfoBox.style.position = '';
                delInfoBox.style.removeProperty('--content-box-height');

                fieldsetBox.classList.remove('collapse');
                fieldsetBox.style.height = '';
                fieldsetBox.style.removeProperty('--content-box-height');

                delTrackFormItem.setAttribute('data-status', 'removable');
                delTrackFormItem.setAttribute('data-order', 'none');
                delTrackFormItem.removeAttribute('id');

                const file = fileByInput.get(fileInput);
                fileByInput.set(delInfoBox.firstElementChild, file);
                fileByInput.delete(fileInput);

                const delTrackId = delTrackFormItem.dataset.id;
                const fieldsetBoxFragment = document.createDocumentFragment();
                fieldsetBoxFragment.appendChild(fieldsetBox);
                delTrackFieldsetById.set(delTrackId, fieldsetBoxFragment);

                if (shouldDeleteTracklist) return;

                enableActiveFormElements(delTrackFormItem);
                reCalcTrackFormItemsOrder();
                validateFormInputs([]); // After reordering

                if (activeElem === removeBtn) delInfoBox.querySelector('.restore-button').focus();
            }
        } else if (delTrackFormItem.dataset.status === 'new') {
            const fixedHeight = delTrackFormItem.offsetHeight;
            delTrackFormItem.style.height = fixedHeight + 'px';
            delTrackFormItem.classList.add('hide');

            eventManager.addOnceEventListener(delTrackFormItem, 'animationend', () => {
                trackFormAnimationCount--;

                fileByInput.delete(fileInput);
                
                const prevTrackFormItem = delTrackFormItem.previousElementSibling;
                const nextTrackFormItem = delTrackFormItem.nextElementSibling;

                delTrackFormItem.remove();

                if (shouldDeleteTracklist) return;

                reCalcTrackFormItemsOrder();
                validateFormInputs([]); // After reordering

                if (nextTrackFormItem) {
                    updateDirectionButtons(nextTrackFormItem);
                    if (activeElem === removeBtn) nextTrackFormItem.querySelector('.remove-track-form-item').focus();
                } else if (prevTrackFormItem) {
                    updateDirectionButtons(prevTrackFormItem);
                    if (activeElem === removeBtn) prevTrackFormItem.querySelector('.remove-track-form-item').focus();
                } else {
                    if (activeElem === removeBtn) addTrackFormItemBtn.focus();
                }
            });
        }

        function reCalcTrackFormItemsOrder() {
            [].forEach.call(trackForms.children, trackFormItem => {
                if (trackFormItem.dataset.status === 'removable') return;
    
                const trackFormItemOrder = Number(trackFormItem.dataset.order);
                if (trackFormItemOrder < delTrackFormItemOrder) return;
    
                const newOrder = trackFormItemOrder - 1;
                setTrackFormItemOrder(trackFormItem, newOrder);
            });
        }
    }

    function restoreTrackFormItem(restoreBtn) {
        trackFormItemCount++;
        trackFormAnimationCount++;

        const resTrackFormItem = restoreBtn.closest('[data-status="removable"]');
        const delInfoBox = resTrackFormItem.firstElementChild;
        const file = fileByInput.get(delInfoBox.firstElementChild);
        const activeElem = document.activeElement;

        restoreBtn.classList.add('inactive');
        restoreBtn.removeAttribute('tabindex');
        restoreBtn.blur();

        const delInfoBoxHeight = delInfoBox.offsetHeight;
        delInfoBox.style.height = delInfoBoxHeight + 'px';
        delInfoBox.classList.add('collapse');
        delInfoBox.style.position = 'absolute';

        eventManager.addOnceEventListener(delInfoBox, 'animationend', () => delInfoBox.remove());

        const resTrackId = resTrackFormItem.dataset.id;
        const fieldsetBoxFragment = delTrackFieldsetById.get(resTrackId);
        const fieldsetBox = fieldsetBoxFragment.firstElementChild;
        delTrackFieldsetById.delete(resTrackId);
        resTrackFormItem.appendChild(fieldsetBoxFragment);

        const fieldsetBoxHeight = fieldsetBox.offsetHeight;
        fieldsetBox.classList.add('expand');
        fieldsetBox.style.height = delInfoBoxHeight + 'px';
        fieldsetBox.style.setProperty('--content-box-height', fieldsetBoxHeight + 'px');

        requestAnimationFrame(function callback() {
            scrollToViewAnimatedElement(tracklistMgrScrollArea, resTrackFormItem);

            if (!tracklistMgrWin.classList.contains('active')) return;
            if (!fieldsetBox.classList.contains('expand')) return;

            requestAnimationFrame(callback);
        });

        eventManager.addOnceEventListener(fieldsetBox, 'animationend', () => {
            trackFormAnimationCount--;

            fieldsetBox.classList.remove('expand');
            fieldsetBox.style.height = '';
            fieldsetBox.style.removeProperty('--content-box-height');

            resTrackFormItem.setAttribute('data-status', 'existing');

            const fileInput = fieldsetBox.querySelector('input[type="file"]');
            fileByInput.set(fileInput, file);
            fileByInput.delete(delInfoBox.firstElementChild);

            enableActiveFormElements(resTrackFormItem);
            updateDirectionButtons(resTrackFormItem);

            allInputs.push(...resTrackFormItem.querySelectorAll('input'));

            const trackFormItems = Array.from(trackForms.children);
            const resTrackFormItemIdx = trackFormItems.indexOf(resTrackFormItem);
            const prevTrackFormItemIdx = trackFormItems
                .slice(0, resTrackFormItemIdx)
                .findLastIndex(trackFormItem => trackFormItem.dataset.status !== 'removable');
            const resOrder = prevTrackFormItemIdx >= 0 ? Number(trackFormItems[prevTrackFormItemIdx].dataset.order) + 1 : 1;

            for (let i = resTrackFormItemIdx; i < trackFormItems.length; i++) {
                if (trackFormItems[i].dataset.status === 'removable') continue;

                const curOrder = Number(trackFormItems[i].dataset.order);
                const newOrder = trackFormItems[i] === resTrackFormItem ? resOrder : curOrder + 1;
                setTrackFormItemOrder(trackFormItems[i], newOrder);
            }

            const allResTrackFormItemInputs = resTrackFormItem.querySelectorAll('input');
            validateFormInputs([...allResTrackFormItemInputs]); // After reordering

            if (activeElem === restoreBtn) resTrackFormItem.querySelector('input').focus();
        });
    }

    function changeTrackFormItemOrder(dirBtn) {
        if (trackFormAnimationCount) return;

        const direction = dirBtn.classList.contains('up') ? 'up' : 'down';
        const activeElem = document.activeElement;

        const movedTrackFormItem = dirBtn.closest('[id^="track-form-item"]');
        const swapTrackFormItem = (direction === 'up') ?
            movedTrackFormItem.previousElementSibling :
            movedTrackFormItem.nextElementSibling;

        if (!swapTrackFormItem) return;

        trackFormAnimationCount++;

        disableActiveFormElements(movedTrackFormItem, swapTrackFormItem);

        const heightDifference = (direction === 'up')?
            movedTrackFormItem.offsetHeight - swapTrackFormItem.offsetHeight :
            swapTrackFormItem.offsetHeight - movedTrackFormItem.offsetHeight;

        trackForms.style.setProperty('--track-form-items-height-difference', `${heightDifference}px`);

        movedTrackFormItem.classList.add(`move-${direction}`);
        swapTrackFormItem.classList.add(`move-${direction === 'up' ? 'down' : 'up'}`);

        eventManager.addOnceEventListener(movedTrackFormItem, 'animationend', () => {
            trackFormAnimationCount--;

            if (direction === 'up') {
                swapTrackFormItem.before(movedTrackFormItem);
            } else {
                swapTrackFormItem.after(movedTrackFormItem);
            }

            movedTrackFormItem.classList.remove('move-up', 'move-down');
            swapTrackFormItem.classList.remove('move-up', 'move-down');
            trackForms.style.removeProperty('--track-form-items-height-difference');

            enableActiveFormElements(movedTrackFormItem, swapTrackFormItem);
            updateDirectionButtons(movedTrackFormItem);
    
            if (swapTrackFormItem.dataset.status !== 'removable') {
                const movedTrackFormItemOrder = Number(movedTrackFormItem.dataset.order);
                const swapTrackFormItemOrder = Number(swapTrackFormItem.dataset.order);
    
                setTrackFormItemOrder(movedTrackFormItem, swapTrackFormItemOrder);
                setTrackFormItemOrder(swapTrackFormItem, movedTrackFormItemOrder);
            }

            const allMovedTrackFormItemInputs = movedTrackFormItem.querySelectorAll('input');
            const allSwapTrackFormItemInputs = swapTrackFormItem.querySelectorAll('input');
            validateFormInputs([...allMovedTrackFormItemInputs, ...allSwapTrackFormItemInputs]); // After reordering
    
            if (activeElem === dirBtn) {
                if (!dirBtn.classList.contains('inactive')) {
                    dirBtn.focus();
                } else {
                    const activeDirBtn = movedTrackFormItem.querySelector('.direction:not(.inactive)');
                    activeDirBtn?.focus();
                }
            }
        });
    }

    function setTrackFormItemOrder(trackFormItem, order) {
        const legendOrder = trackFormItem.querySelector('legend > .order');
        const origOrder = trackFormItem.dataset.originalOrder;

        trackFormItem.id = `track-form-item[${order}]`;
        trackFormItem.dataset.order = order;
        legendOrder.textContent = order;
        if (origOrder) legendOrder.classList.toggle('changed', Number(origOrder) !== order);

        trackFormItem.querySelectorAll('input').forEach(input => {
            const oldInputId = input.id;
            const newInputId = oldInputId.replace(/\[\d+\]/, `[${order}]`);
            input.parentElement.querySelector(`label[for="${oldInputId}"]`).htmlFor = newInputId;
            input.id = newInputId;
        });
    }

    function updateDirectionButtons(selTrackFormItem = null) {
        if (shouldDeleteTracklist) return;

        if (selTrackFormItem) {
            const prevTrackFormItem = selTrackFormItem.previousElementSibling;
            const nextTrackFormItem = selTrackFormItem.nextElementSibling;
    
            for (const trackFormItem of [prevTrackFormItem, selTrackFormItem, nextTrackFormItem]) {
                if (!trackFormItem || trackFormItem.dataset.status === 'removable') continue;
                refreshButtonsActivity(trackFormItem);
            };
        } else {
            for (const trackFormItem of trackForms.children) {
                if (trackFormItem.dataset.status === 'removable') continue;
                refreshButtonsActivity(trackFormItem);
            }
        }

        function refreshButtonsActivity(trackFormItem) {
            const upDirBtn = trackFormItem.querySelector('.direction.up');
            const isFirst = trackFormItem === trackForms.firstElementChild;
            upDirBtn.classList.toggle('inactive', isFirst);
            upDirBtn.setAttribute('tabindex', isFirst ? -1: 0);

            const downDirBtn = trackFormItem.querySelector('.direction.down');
            const isLast = trackFormItem === trackForms.lastElementChild;
            downDirBtn.classList.toggle('inactive', isLast);
            downDirBtn.setAttribute('tabindex', isLast ? -1: 0);
        }
    }

    // Useful if the file is not selected or the new file matches the old one (event 'oninput' not works)
    function validateFileSelection(fileInput) {
        const oldFile = fileInput.files[0];

        // Opening the file save dialog window
        eventManager.addOnceEventListener(window, 'blur', function runFileValidation() {
            resetPostDialogSelectionTimer(fileInput); // Reset timer and delete it from Map

            // Closing the file save dialog window
            eventManager.addOnceEventListener(window, 'focus', function processFileSelection() {
                const timerFileInput = setTimeout(async () => {
                    resetPostDialogSelectionTimer(fileInput); // Only delete timer from Map

                    const newFile = fileInput.files[0];

                    if (!newFile && !!fileByInput.get(fileInput)) { // New file not selected, old file exists
                        fileByInput.set(fileInput, null);
                        validateFormInputs([fileInput]);
                    } else if (fileInput.name === 'track-file') { // For updating text fields if new file === old file
                        const isSameFile = !!oldFile && newFile.name === oldFile.name &&
                            newFile.size === oldFile.size && newFile.lastModified === oldFile.lastModified;
                        if (isSameFile) validateFormInputs([fileInput]);
                    }
                }, 100);

                postDialogSelectionTimers.set(fileInput, timerFileInput);
            });
        });
    }

    async function checkFileSelection(fileInput) {
        eventManager.removeOnceEventListener(window, 'blur', 'runFileValidation');
        eventManager.removeOnceEventListener(window, 'focus', 'processFileSelection');

        const file = fileInput.files[0];

        if (file) {
            resetPostDialogSelectionTimer(fileInput);

            const fileInputData = {
                'cover-file': {
                    fileType: 'cover',
                    maxFileSize: MAX_COVER_FILE_SIZE
                },
                'track-file': {
                    fileType: 'track',
                    maxFileSize: MAX_TRACK_FILE_SIZE
                }
            };
            const { fileType, maxFileSize } = fileInputData[fileInput.name];

            if (file.size <= maxFileSize) {
                if (fileType === 'track') await extractFileTags(fileInput, file);
                return true;
            } else {
                const limitSize = maxFileSize / 1024 / 1024 + 'MB';
                alert(`The size of the uploaded ${fileType} file exceeds the maximum allowed limit of ${limitSize}!`);
                fileInput.value = '';
                return false;
            }
        } else {
            return !postDialogSelectionTimers.get(fileInput);
        }
    }

    function extractFileTags(fileInput, file) {
        return new Promise((resolve, reject) => {
            jsmediatags.read(file, {
                onSuccess: function(tag) {
                    const trackForm = fileInput.closest('.track-form');
                    const artistNameInput = trackForm.querySelector('input[name="artist"]');
                    const trackTitleInput = trackForm.querySelector('input[name="title"]');
                    /*if (!artistNameInput.value.length) */artistNameInput.value = tag.tags.artist;
                    /*if (!trackTitleInput.value.length) */trackTitleInput.value = tag.tags.title;
                    resolve();
                },
                onError: reject
            });
        }).catch(error => console.error(`Error reading file "${file.name}" tags:`, error.type, error.info));
    }

    function resetPostDialogSelectionTimer(fileInput) {
        const timerId = postDialogSelectionTimers.get(fileInput);
        clearTimeout(timerId);
        postDialogSelectionTimers.delete(fileInput);
    }

    function debounceFormInputValidation(func, delay) {
        const debouncedFunc = debounce(func, delay);
        
        return function(input) {
            if (input.value.trim() === '') {
                func.call(this, [input]);
            } else {
                debouncedFunc.call(this, [input]);
            }
        };
    }

    async function validateFormInputs(inputs = []) {
        if (shouldDeleteTracklist) return;

        if (inputs.length === 1) {
            if (inputs[0] === tracklistTitleInput && !isValidationInProgress) return;

            if (inputs[0].matches('input[type="file"]')) {
                const shouldVerify = await checkFileSelection(inputs[0]);
                if (!shouldVerify) return; // Cancel duplicate check
    
                if (inputs[0] !== tracklistCoverInput) {
                    inputs = Array.from(inputs[0].closest('.track-form').querySelectorAll('input'));
                }
            }
        }

        for (const input of inputs) {
            switch (input.type) {
                case 'text':
                    await validateTextInput(input);
                    break;
                case 'file':
                    validateFileInput(input);
                    break;
            }
        }

        const isWarning = allInputs.some(input => input.classList.contains('warning'));
        const isFormChanged = checkFormChanges();

        okBtn.disabled = isWarning || !isFormChanged;
        tracklistMgrScrollArea.toggleAttribute('data-form-changed', isFormChanged);
        if (inputs.includes(tracklistTitleInput)) isValidationInProgress = false;
    }

    async function validateTextInput(textInput) {
        const origValue = textInput.dataset.originalValue || '';
        const curValue = correctText(textInput.value);
        const isSameValue = curValue === origValue;
        let isValid = false;
        
        if (curValue) {
            if (textInput === tracklistTitleInput) { // Tracklist title
                isValid = isSameValue || await requestTracklistTitleValidation({
                    origTracklistTitle: origValue,
                    newTracklistTitle: curValue
                });
            } else { // Artist name/track title
                isValid = true;
            }
        }

        updateInputState(textInput, isSameValue, isValid);
    }

    function validateFileInput(fileInput) {
        const existingFile = fileInput.dataset.existingFile || null;
        const file = fileInput.files[0] || (fileByInput.has(fileInput) ? fileByInput.get(fileInput) : existingFile);
        const isSameValue = file === existingFile;

        updateFileInput(fileInput, file);
        updateInputState(fileInput, isSameValue, !!file);
    }

    function updateFileInput(fileInput, file) {
        fileByInput.set(fileInput, file);

        const fileName = fileInput.parentElement.querySelector('.file-name');
        fileName.textContent = file instanceof File ? file.name : (file || 'Select a file');
        fileName.classList.toggle('missing', !file);
    }

    function waitInputValidation(input) {
        isValidationInProgress = true;

        input.classList.remove('warning');

        const formRow = input.parentElement;
        formRow.querySelector('.ok').hidden = true;
        formRow.querySelector('.fail').hidden = true;
        formRow.querySelector('.wait').hidden = false;

        const resetBtn = formRow.querySelector('.reset');
        resetBtn.classList.remove('inactive');
        resetBtn.setAttribute('tabindex', 0);
    }

    function updateInputState(input, isSameValue, isValid) {
        input.toggleAttribute('data-value-changed', !isSameValue);

        const formRow = input.parentElement;

        const resetBtn = formRow.querySelector('.reset');
        resetBtn.classList.toggle('inactive', isSameValue);
        resetBtn.setAttribute('tabindex', isSameValue ? -1 : 0);

        if (!input.hasAttribute('data-optional')) {
            input.classList.toggle('warning', !isValid);
            formRow.querySelector('.ok').hidden = isSameValue || !isValid;
            formRow.querySelector('.fail').hidden = isValid;
            if (input === tracklistTitleInput) formRow.querySelector('.wait').hidden = true;
        }
    }

    function resetInputState(resetBtn) {
        const input = resetBtn.parentElement.querySelector('input');
        
        switch (input.type) {
            case 'text':
                input.value = input.dataset.originalValue || '';
                input.focus();
                break;
            case 'file':
                input.value = '';

                const existingFile = input.dataset.existingFile || null;
                fileByInput.set(input, existingFile);

                const fileName = input.parentElement.querySelector('.file-name');
                fileName.focus();
                break;
        }

        if (input === tracklistTitleInput) waitInputValidation(input);
        validateFormInputs([input]);
    }

    function checkFormChanges() {
        return shouldDeleteTracklist ||

            [].some.call(trackForms.children, trackFormItem => 
                trackFormItem.dataset.status !== 'existing' ||
                trackFormItem.dataset.originalOrder !== trackFormItem.dataset.order
            ) ||

            allInputs.some(input => {
                switch (input.type) {
                    case 'text':
                        return correctText(input.value) !== (input.dataset.originalValue || '');
                    case 'file':
                        return fileByInput.get(input) !== (input.dataset.existingFile || null);
                }
            })
        ;
    }

    function enableActiveFormElements(...formItems) {
        if (shouldDeleteTracklist) return;

        const selector = 'fieldset.new-track, legend > .order, input, .file-name, .state > i, .remove-track-form-item,\
            .restore-button';
        const activeFormElements = formItems.flatMap(childElem => Array.from(childElem.querySelectorAll(selector)));

        activeFormElements.forEach(elem => {
            elem.classList.remove('inactive');

            if (elem.matches('input')) {
                elem.disabled = false;
            } else {
                if (elem.hasAttribute('tabindex')) elem.setAttribute('tabindex', 0);
            }
        });
    }

    function disableActiveFormElements(...formItems) {
        const selector = 'fieldset.new-track, legend > .order, input, .file-name, .reset, .state > i, .direction,\
            .remove-track-form-item, .restore-button';
        const activeFormElements = formItems.flatMap(childElem => Array.from(childElem.querySelectorAll(selector)));

        activeFormElements.forEach(elem => {
            elem.classList.add('inactive');

            if (elem.matches('input')) {
                elem.disabled = true;
            } else {
                if (elem.matches('.restore-button') && sessionStatus === 'preparing') {
                    elem.parentElement.remove();
                } else if (elem.tabIndex >= 0) { // Works on default focused elements
                    elem.setAttribute('tabindex', -1);
                    elem.blur();
                }
            }
        });
    }

    async function launchTracklistUpdateSession() {
        if (isDemoMode()) {
            showDemoWarning();
            return;
        }
        
        sessionStatus = 'data-checking';

        if (!shouldDeleteTracklist) validateFormInputsFinally();
        await waitForAsyncTasksCompletion();

        if (okBtn.disabled || !tracklistMgrWin.classList.contains('active')) {
            sessionStatus = 'data-collecting';
            return;
        }

        console.log(`%c${manageMode[0].toUpperCase() + manageMode.slice(1)} tracklist "${
            tracklistTitleInput.dataset.originalValue || correctText(tracklistTitleInput.value)
        }"`, `
            color: #fafafa;
            background-color: rgba(0, 38, 255, 0.9);
        `);

        sessionStatus = 'preparing';

        prepareUpdating();

        const shouldChangeTrlTitle = tracklistTitleInput.hasAttribute('data-value-changed');
        const shouldChangeTrlCover = tracklistCoverInput.hasAttribute('data-value-changed');

        const pendingTracklistActions = [];
        if (shouldDeleteTracklist) pendingTracklistActions.push('delete');
        if (shouldChangeTrlTitle) pendingTracklistActions.push('titleChange');
        if (shouldChangeTrlCover) pendingTracklistActions.push('coverChange');

        const { trackFormItems, pendingTracks, newTrackCount, requestTracksData } = await processFormsData();
        const sessionUpdateData = await requestStartUpdateSession({
            clientId,
            manageMode,
            tracklistId,
            pendingTracklistActions,
            pendingTracks,
            newTrackCount
        });
        let sessionId, assignedOperationIds, newTracklistId, newTrackIds;

        console.log('Session update data:', sessionUpdateData);

        if (sessionUpdateData) {
            ({ sessionId, assignedOperationIds, newTracklistId, newTrackIds } = sessionUpdateData);
            if (!tracklistId) tracklistId = newTracklistId;

            sessionStatus = 'processing';

            registerTracklistUpdate(tracklistId, pendingTracks);
            setUpdateMarkers(manageMode, tracklistId, pendingTracks);
            loadFullSelectedAudio(pendingTracks);
            
            let isAborted = false;
            let isAbortHandled = false;

            cancelBtn.onclick = async () => {
                console.log('Tracklist update session is aborted.');

                cancelBtn.disabled = true;
                
                isAborted = true;
                sessionStatus = await closeUpdateSession(isAborted);
                isAbortHandled = true;
            };

            switch (manageMode) {
                case 'create':
                    const isTracklistCreated = await manageTracklist();
    
                    if (isTracklistCreated) {
                        await manageTracks();
                    } else {
                        trackFormItems.forEach(trackFormItem => {
                            trackFormItem.classList.add('error');
                            trackFormItem.querySelector('.form-row.upload > .state > .fail').hidden = false;
                        });
                    }
    
                    break;
                    
                case 'edit':
                    if (shouldChangeTrlTitle || shouldChangeTrlCover) await manageTracklist();

                    const trackStates = await manageTracks();
    
                    if (shouldDeleteTracklist) {
                        const successfulTracksNum = Object.keys(trackStates.successful).length;
                        const totalTracks = trackFormItems.length;
                        const isTracklistEmpty = successfulTracksNum === totalTracks;

                        await deleteTracklist(isTracklistEmpty);
                    }
    
                    break;
            }

            if (!totalUploadRow.hidden) updateTotalUploadProgress(true);

            if (!isAborted) {
                sessionStatus = await closeUpdateSession(isAborted);
            } else {
                while (!isAbortHandled) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        } else {
            sessionStatus = 'fail';

            tracklistMgrWin.querySelector('.dialog-box').classList.add('warning');
            tracklistForm.classList.replace('pending', 'error');
            tracklistForm.classList.replace('deleting', 'error');

            trackFormItems.forEach(trackFormItem => {
                trackFormItem.classList.replace('pending', 'error');

                if (trackFormItem.dataset.status === 'removable') {
                    trackFormItem.querySelector('.status-text').textContent = 'has not been deleted';
                }

                const uploadFormRow = trackFormItem.querySelector('.form-row.upload');
                if (uploadFormRow) uploadFormRow.querySelector('.state > .fail').hidden = false;
            });

            if (!totalUploadRow.hidden) updateTotalUploadProgress(true);
        }
    
        console.log('Tracklist update session status: ' + sessionStatus);

        okBtn.onclick = async () => {
            await hideTracklistManager(false);
            await updateTracklistDatabase(tracklistId);
            completeTracklistDatabaseUpdate();
        };

        okBtn.disabled = false;
        cancelBtn.disabled = true;

        /// Functions ///

        function validateFormInputsFinally() {
            if (isValidationInProgress) {
                validateFormInputs(allInputs.filter(input => input !== tracklistTitleInput));
            } else {
                waitInputValidation(tracklistTitleInput);
                validateFormInputs(allInputs);
            }
        }

        async function waitForAsyncTasksCompletion() {
            while (trackFormAnimationCount || isValidationInProgress || postDialogSelectionTimers.size) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        function prepareUpdating() {
            tracklistMgrWin.setAttribute('data-locked', '');
            beginTracklistDatabaseUpdate();
            disableActiveFormElements(...tracklistForm.children, ...trackForms.children);
            dropZone.hidden = true;
            trlRemovalCheckbox.disabled = true;
            okBtn.disabled = true;
            closeBtn.disabled = true;
        }

        async function closeUpdateSession(isAborted) {
            const updatesData = await requestEndUpdateSession({ sessionId, clientId, isAborted });
            if (!updatesData) return 'unknown';

            const { tracklistActions, trackActions } = updatesData;
            const { successful: successfulTrlActions, rejected: rejectedTrlActions } = tracklistActions;
            const { successful: successfulTracks, rejected: rejectedTracks } = trackActions;
            const hasCompletedUpdates = successfulTrlActions.length || Object.keys(successfulTracks).length;
            const areAllUpdatesCompleted = hasCompletedUpdates && !rejectedTrlActions.length &&
                !Object.keys(rejectedTracks).length;

            unregisterTracklistUpdate(tracklistId, successfulTracks, rejectedTracks);
            updatePlaylistTracks(updatesData);

            if (hasCompletedUpdates) {
                console.log('Completed tracklist updates confirmed and distributed:', updatesData);

                updateTracklistsCollection(updatesData);
                enqueueTracklistDatabaseUpdate(tracklistId, updatesData, { waitConfirm: true });
            } else {
                console.log('No tracklist updates found:', updatesData);

                removeRejectedTracklistTracksUpdateMarkers(manageMode, tracklistSection, rejectedTracks);
                removeTracklistUpdateMarkers(tracklistId, tracklistSection);
                removeTracklistDatabaseUpdateMarker();
            }

            return areAllUpdatesCompleted ? 'success' : hasCompletedUpdates ? 'partial' : 'fail';
        }

        async function processFormsData() {
            if (shouldDeleteTracklist) {
                tracklistForm.classList.add('deleting');
                removeAllTrackFormItems(); // trackForms.children will change if new track forms have been added
                await waitForAsyncTasksCompletion();
            } else {
                if (shouldChangeTrlTitle || shouldChangeTrlCover) tracklistForm.classList.add('pending');
                createUploadProgressIndicators();
            }

            const trackFormItems = Array.from(trackForms.children);
            const pendingTracks = {};
            const requestTracksData = [];
            let newTrackCount = 0;

            trackFormItems.forEach(trackFormItem => {
                const { status: trackStatus, id: trackId, order, originalOrder } = trackFormItem.dataset;
                const prepareData = { trackId, trackFormItem, handleResult };

                if (trackStatus === 'removable') {
                    trackFormItem.classList.add('pending');

                    pendingTracks[trackId] = { action: 'delete' };
                } else {
                    const trackFormData = new FormData();
                    let file;

                    if (trackStatus === 'new' || order !== originalOrder) trackFormData.append('order', order);

                    trackFormItem.querySelectorAll('input').forEach(input => {
                        if (input.hasAttribute('data-value-changed')) {
                            switch (input.type) {
                                case 'text':
                                    trackFormData.append(input.name, correctText(input.value));
                                    return;
                                case 'file':
                                    file = fileByInput.get(input);

                                    const format = file.name.split('.').pop().toLowerCase();
                                    trackFormData.append('format', format);
                                    return;
                            }
                        }
                    });

                    if (![...trackFormData.entries()].length) return;

                    trackFormItem.classList.add('pending');

                    const isExisting = trackStatus === 'existing';

                    if (isExisting) {
                        pendingTracks[trackId] = { action: 'update', isFile: !!file };
                    } else {
                        newTrackCount++;
                    }

                    Object.assign(prepareData, { isExisting, trackFormData, file, updateUploadProgress });
                }
                
                requestTracksData.push({ trackStatus, prepareData });
            });

            return { trackFormItems, pendingTracks, newTrackCount, requestTracksData };

            /// Functions ///

            function removeAllTrackFormItems() {
                for (const trackFormItem of trackForms.children) {
                    if (trackFormItem.dataset.status === 'removable') continue;

                    const removeBtn = trackFormItem.querySelector('.remove-track-form-item');
                    removeTrackFormItem(removeBtn);
                }
            }

            function createUploadProgressIndicators() {
                for (const [input, file] of fileByInput.entries()) {
                    if (input.hasAttribute('data-value-changed') && file instanceof File) {
                        const uploadFormRow = createUploadFormRow();
                        input.parentElement.after(uploadFormRow);
                        uploadProgressIndicators.set(uploadFormRow, 0);
                    }
                }

                if (uploadProgressIndicators.size) totalUploadRow.hidden = false;

                /// Functions ///

                function createUploadFormRow() {
                    const uploadFormRow = document.createElement('div');
                    uploadFormRow.className = 'form-row upload';
                    uploadFormRow.innerHTML = `
                        <span class="label-text">Upload progress:</span
                        ><div class="upload-range">
                            <div class="upload-progress"></div>
                        </div
                        ><span class="display-progress">0%</span
                        ><span class="state">
                            <i class="icon-check ok" hidden></i>
                            <i class="icon-cancel fail" hidden></i>
                        </span>
                    `;
                    return uploadFormRow;
                }
            }

            function handleResult(isSuccess, resultData) {
                const { trackFormItem, action, isFile } = resultData;

                trackFormItem.classList.replace('pending', isSuccess ? 'success' : 'error');

                if (action === 'delete') {
                    const statusText = `has ${isSuccess ? '' : 'not '}been deleted`;
                    trackFormItem.querySelector('.status-text').textContent = statusText;
                } else if (isFile) {
                    const trkUploadFormRow = trackFormItem.querySelector('.form-row.upload');
                    const completeIconClass = isSuccess ? 'ok' : 'fail';
                    trkUploadFormRow.querySelector(`.state > .${completeIconClass}`).hidden = false;
                }
                
                delete resultData.trackFormItem;
                return isSuccess ? Promise.resolve(resultData) : Promise.reject(resultData);
            }
        }

        async function manageTracks() {
            const requestPromises = requestTracksData.map(processRequestTrackData);
            const updateResults = await Promise.allSettled(requestPromises);

            return updateResults.reduce((acc, { status, value, reason }) => {
                if (status === 'fulfilled' && value) {
                    const { trackId, action, isFile } = value;
                    acc.successful[trackId] = { action };
                    if (action === 'update') acc.successful[trackId].isFile = isFile;
                } else if (status === 'rejected') {
                    acc.rejected.push(reason);
                }
                return acc;
            }, { successful: {}, rejected: [] });

            /// Functions ///

            async function processRequestTrackData(processData) {
                const { trackStatus, prepareData } = processData;

                prepareData.sessionId = sessionId;
                prepareData.tracklistId = tracklistId;

                if (!prepareData.trackId) prepareData.trackId = newTrackIds.shift();
                prepareData.operationId = assignedOperationIds[prepareData.trackId];

                if (trackStatus === 'removable') {
                    return await requestTrackDeletion(prepareData);
                } else if (trackStatus === 'existing' || trackStatus === 'new') {
                    return await prepareTrackManageRequest(prepareData);
                }
            }
        }

        async function deleteTracklist(isTracklistEmpty) {
            if (isTracklistEmpty) {
                const operationId = assignedOperationIds[tracklistId];
                const prepareData = { sessionId, operationId, tracklistId, handleResult };
                return await requestTracklistDeletion(prepareData);
            } else {
                return handleResult(false);
            }
            
            function handleResult(isSuccess) {
                tracklistForm.classList.replace('deleting', isSuccess ? 'success-deleted' : 'error');
                return isSuccess;
            }
        }

        async function manageTracklist() {
            tracklistForm.classList.add('pending');

            const tracklistFormData = new FormData();
            let file;
            
            if (shouldChangeTrlTitle) tracklistFormData.append('tracklistTitle', correctText(tracklistTitleInput.value));

            if (shouldChangeTrlCover) {
                file = fileByInput.get(tracklistCoverInput);

                if (file && file instanceof File) {
                    const format = file.name.split('.').pop().toLowerCase();
                    tracklistFormData.append('format', format);
                } else {
                    tracklistFormData.append('shouldRemoveCover', true);
                }
            }

            const prepareData = {
                sessionId,
                operationId: assignedOperationIds[tracklistId],
                isExisting: manageMode === 'edit',
                tracklistId,
                tracklistFormData,
                file,
                updateCoverOnly: !shouldChangeTrlTitle && shouldChangeTrlCover,
                tracklistForm,
                updateUploadProgress,

                handleResult: (isSuccess, resultData) => {
                    const { tracklistForm, isFile } = resultData;

                    tracklistForm.classList.replace('pending', isSuccess ? 'success' : 'error');

                    if (isFile) {
                        const trlUploadFormRow = tracklistForm.querySelector('.form-row.upload');
                        const completeIconClass = isSuccess ? 'ok' : 'fail';
                        trlUploadFormRow.querySelector(`.state > .${completeIconClass}`).hidden = false;
                    }
                    
                    return isSuccess;
                }
            };

            return await prepareTracklistManageRequest(prepareData);
        }

        function updateUploadProgress(uploadElems, progress) {
            const { uploadFormRow, uploadProgress, displayProgress } = uploadElems;

            uploadProgress.style.width = progress + '%';
            displayProgress.textContent = Math.floor(progress) + '%';

            uploadProgressIndicators.set(uploadFormRow, progress);
            updateTotalUploadProgress(false);
        }

        function updateTotalUploadProgress(isFinal) {
            const totalProgress = Array.from(uploadProgressIndicators.values())
                .reduce((sum, val) => sum += val, 0) / uploadProgressIndicators.size;

            if (!isFinal) {
                totalUploadProgress.style.width = totalProgress + '%';
                totalDisplayProgress.textContent = Math.floor(totalProgress) + '%';
            } else {
                const completeIconClass = totalProgress >= 100 ? 'ok' : 'fail';
                totalUploadRow.querySelector(`.state > .${completeIconClass}`).hidden = false;
            }
        }
    }
}

async function hideTracklistManager(requestConfirmation = true) {
    const tracklistMgrScrollArea = tracklistMgrWin.querySelector('.scrollable-area');
    const isFormChanged = tracklistMgrScrollArea.hasAttribute('data-form-changed');

    if (requestConfirmation && isFormChanged) {
        const isConfirmed = confirm('Changes have been detected in the tracklist manager form. ' +
            'Do you wish to close the dialog window? Any entered data will be lost.');
        if (isConfirmed) runHideTracklistManager();
    } else {
        await runHideTracklistManager();
    }

    function runHideTracklistManager() {
        const tracklistForm = tracklistMgrWin.querySelector('.tracklist-form');
        const trackForms = tracklistMgrWin.querySelector('.track-forms');
        const dropZone = tracklistMgrWin.querySelector('.drop-zone');
        const trlRemovalConfirm = tracklistMgrWin.querySelector('.tracklist-removal-confirm');
        const trlRemovalCheckbox = trlRemovalConfirm.querySelector('input[type="checkbox"]');
        const totalUploadRow = tracklistMgrWin.querySelector('.total-upload-row');
        const okBtn = tracklistMgrWin.querySelector('.ok-button');
        const cancelBtn = tracklistMgrWin.querySelector('.cancel-button');
    
        tracklistMgrWin.oninput = tracklistMgrWin.onkeydown = tracklistMgrWin.onclick = null;
        okBtn.onclick = cancelBtn.onclick = null;
        dropZone.ondragenter = dropZone.ondragleave = dropZone.ondragover = dropZone.ondrop = null;
        trlRemovalCheckbox.onchange = null;
    
        tracklistMgrWin.classList.remove('active');

        return new Promise(resolve => {
            eventManager.addOnceEventListener(tracklistMgrWin, 'transitionend', () => {
                if (tracklistMgrWin.classList.contains('active')) return;
        
                deactivateModalWindow(tracklistMgrWin);
        
                cancelAllAnimationDelays('create-track-fieldset');
                trackForms.querySelectorAll('[id^="track-form-item"], .content-box').forEach(elem => {
                    eventManager.clearEventHandlers(elem);
                });
                eventManager.clearEventHandlers(window, 'blur', 'focus');
                fileByInput.clear();
        
                tracklistMgrWin.removeAttribute('data-locked');
                tracklistMgrWin.removeAttribute('data-mode');
                delete tracklistMgrWin.tracklistSection;
                tracklistMgrWin.querySelector('.dialog-box').classList.remove('warning');
                tracklistMgrScrollArea.removeAttribute('data-form-changed');
                tracklistMgrWin.querySelector('#tracklist-manager-title').innerHTML = '';
                tracklistMgrWin.querySelector('#tracklist-manager-description').innerHTML = '';
                tracklistForm.className = 'tracklist-form';
                tracklistForm.innerHTML = '';
                trackForms.innerHTML = '';
                trackForms.style.removeProperty('--track-form-items-height-difference');
                dropZone.hidden = false;
                dropZone.classList.remove('inactive');
                dropZone.firstElementChild.classList.remove('inactive');
                trlRemovalConfirm.hidden = false;
                trlRemovalCheckbox.checked = false;
                trlRemovalCheckbox.disabled = false;
                totalUploadRow.hidden = true;
                totalUploadRow.querySelector('.upload-progress').style.width = '';
                totalUploadRow.querySelector('.display-progress').textContent = '0%';
                totalUploadRow.querySelector('.state > .ok').hidden = true;
                totalUploadRow.querySelector('.state > .fail').hidden = true;
                okBtn.disabled = true;
                cancelBtn.disabled = false;
                tracklistMgrWin.querySelector('.close-button').disabled = false;

                resolve();
            });
        });
        
    }
}

function registerTracklistUpdate(tracklistId, pendingTracks, successfulTracks = {}, rejectedTracks = {}) {
    if (!tracklistUpdateRegistry[tracklistId]) {
        tracklistUpdateRegistry[tracklistId] = { count: 0, tracks: new Set() };
    }
    
    tracklistUpdateRegistry[tracklistId].count++;

    for (const trackId in pendingTracks) {
        if (trackId in successfulTracks || trackId in rejectedTracks) continue; // Works with processing update notifications
        tracklistUpdateRegistry[tracklistId].tracks.add(trackId);
    }

    console.log('Tracklist update registry:', tracklistUpdateRegistry);
}

function unregisterTracklistUpdate(tracklistId, successfulTracks = {}, rejectedTracks = {}) {
    if (!tracklistUpdateRegistry[tracklistId]) return;

    tracklistUpdateRegistry[tracklistId].count--;

    if (!tracklistUpdateRegistry[tracklistId].count) {
        delete tracklistUpdateRegistry[tracklistId];
        return;
    }

    for (const trackId of tracklistUpdateRegistry[tracklistId].tracks.keys()) {
        if (trackId in successfulTracks || trackId in rejectedTracks) {
            tracklistUpdateRegistry[tracklistId].tracks.delete(trackId);
        }
    }
}

function setUpdateMarkers(manageMode, tracklistId, pendingTracks, successfulTracks = {}, rejectedTracks = {}) {
    // Tracklist database marker
    if (!tracklistDtbsTitle.querySelector('.update-marker')) {
        const tracklistDtbsUpdateMarker = createUpdateMarker({ tooltipText: 'Tracklist database is updating...' });
        tracklistDtbsTitle.append(tracklistDtbsUpdateMarker);
    }

    const tracklistSection = tracklistsContainer.querySelector(`.tracklist-section[data-id="${tracklistId}"]`);

    if (tracklistSection) { // Can be found during tracklist creation if the collection loads before the update completes
        // Tracklist section marker
        const tracklistTitle = tracklistSection.querySelector(`[id="tracklist[${tracklistId}]-title"]`);

        if (!tracklistTitle.querySelector('.update-marker')) {
            const tracklistUpdateMarker = createUpdateMarker({ tooltipText: 'Tracklist is updating...' });
            tracklistTitle.append(tracklistUpdateMarker);
        }

        // Tracklist tracks markers
        if (!Object.keys(pendingTracks).length) return;

        const list = tracklistSection.querySelector('.list');

        [...list.children].forEach(li => {
            const { id: trackId, title } = li.dataset;
            if (!pendingTracks[trackId]) return;
            if (trackId in successfulTracks || trackId in rejectedTracks) return; // Works with processing update notifications
            if (li.querySelector('.update-marker')) return;

            createMarkedLastTitleWord(li, title);
        });
    }

    // Playlist tracks markers
    if (manageMode === 'create') return;
    if (!Object.keys(pendingTracks).length) return;

    const trackMenu = audioPlayer.querySelector('.track-menu');

    origOrderedAudios.forEach(audio => {
        const track = audio.parentElement;
        const trackId = audio.dataset.id;
        if (!pendingTracks[trackId]) return;
        if (trackId in successfulTracks || trackId in rejectedTracks) return; // Works with processing update notifications

        const trackAdditionals = track.querySelector('.additionals');
        if (trackAdditionals.querySelector('.update-marker')) return;
        
        const trackUpdateMarker = createUpdateMarker({ tooltipText: 'Track is updating...' });
        trackAdditionals.append(trackUpdateMarker);
            
        if (trackMenu?.referencedTrack === track) {
            [...trackMenu.children].forEach(menuItem => menuItem.classList.add('inactive'));
        }
    });
}

function createUpdateMarker({ tooltipText = '' } = {}) {
    const updateMarker = document.createElement('i');
    updateMarker.className = 'icon-attention update-marker';
    updateMarker.setAttribute('data-tooltip', tooltipText);

    connectTooltipHoverIntent(updateMarker);

    return updateMarker;
}

function removeRejectedTracklistTracksUpdateMarkers(manageMode, tracklistSection, rejectedTracks) {
    if (manageMode === 'create') return;
    if (!tracklistSection) return;
    if (!Object.keys(rejectedTracks).length) return;

    const list = tracklistSection.querySelector('.list');

    [...list.children].forEach(li => {
        const { id: trackId, title } = li.dataset;
        if (!rejectedTracks[trackId]) return;

        const trackTitle = li.querySelector('.track-title');
        if (!trackTitle.querySelector('.update-marker')) return;
        
        trackTitle.innerHTML = restoreText(title);
    });
}

function removeTracklistUpdateMarkers(tracklistId, tracklistSection) {
    if (tracklistUpdateRegistry[tracklistId]) return;
    if (tracklistDatabaseUpdates[tracklistId]?.updates.length > 1) return;
    if (!tracklistSection) return;
    if (!tracklistsContainer.contains(tracklistSection)) return;

    const tracklistTitle = tracklistSection.querySelector(`[id="tracklist[${tracklistId}]-title"]`);
    const tracklistUpdateMarker = tracklistTitle.querySelector('.update-marker');
    if (tracklistUpdateMarker) tracklistUpdateMarker.remove();
}

function removeTracklistDatabaseUpdateMarker() {
    if (Object.keys(tracklistUpdateRegistry).length) return;
    if (Object.keys(tracklistDatabaseUpdates).length) return;

    const tracklistDtbsUpdateMarker = tracklistDtbsTitle.querySelector('.update-marker');
    if (tracklistDtbsUpdateMarker) tracklistDtbsUpdateMarker.remove();
}

async function loadFullSelectedAudio(pendingTracks) {
    if (!selectedAudio) return;

    const audio = selectedAudio;
    if (audio.hasAttribute('data-temp-storage')) return;

    const trackId = audio.dataset.id;
    const trackState = pendingTracks[trackId];
    if (!trackState) return;

    const { action, isFile } = trackState;
    if (action === 'update' && !isFile) return;

    if (audio.hasAttribute('data-fully-loaded')) return;
    if (audio.parentElement.hasAttribute('data-downloading')) return;

    audio.backgroundPreloadRequest?.abort();

    console.log('+ start background audio loading | ' + audio.dataset.title);

    try {
        const audioBlob = await requestBackgroundPreloadTrack(audio);
        setFullAudioSource(audio, audioBlob);
    } catch(error) {
        if (error.message !== 'Request aborted') console.error('Error preloading track:', error);
    } finally {
        console.log('+ delete audio.backgroundPreloadRequest');

        delete audio.backgroundPreloadRequest;
    }
}

function updateTracklistsCollection(updatesData) {
    const { tracklistActions, tracklistId, tracklistData } = updatesData;

    if (tracklistActions.successful.includes('delete')) {
        tracklistsCollection.delete(tracklistId);
    } else {
        tracklistsCollection.set(tracklistId, tracklistData);
    }
}

function updatePlaylistTracks(updatesData) {
    const { manageMode, trackActions, tracklistData } = updatesData;
    if (manageMode === 'create') return;

    const { successful: successfulTracks, rejected: rejectedTracks } = trackActions;

    if (!Object.values(successfulTracks)
        .concat(Object.values(rejectedTracks))
        .filter(trackState => ['delete', 'update'].includes(trackState.action))
        .length) return;

    const trackMenu = audioPlayer.querySelector('.track-menu');
    let startIdx = origOrderedAudios.length - 1;
    let delCount = 0;

    origOrderedAudios.forEach((audio, idx) => {
        const track = audio.parentElement;
        const trackId = audio.dataset.id;
        if (!successfulTracks[trackId] && !rejectedTracks[trackId]) return;

        if (audio === selectedAudio && playOn) clearSkipUpdatingTrackTimer();

        const trackUpdateMarker = track.querySelector('.update-marker');
        if (trackUpdateMarker) trackUpdateMarker.remove();

        if (trackMenu?.referencedTrack === track) {
            const downloadItem = trackMenu.querySelector('.download');
            downloadItem.classList.remove('inactive');

            if (track.hasAttribute('data-downloading')) {
                const cancelItem = trackMenu.querySelector('.cancel');
                cancelItem.classList.remove('inactive');
            }
        }

        const trackState = successfulTracks[trackId];

        if (trackState) {
            startIdx = Math.min(startIdx, idx);

            switch (trackState.action) {
                case 'delete':
                    track.setAttribute('data-deleted', '');
                    if (track.hasAttribute('data-downloading')) track.classList.add('pending-removal');

                    if (track.classList.contains('pending-removal')) return;
                    if (track.classList.contains('removing')) return;

                    delCount++;
                    track.classList.add('pending-removal');
                    setAnimationDelay('remove-track-from-playlist', delCount, () => removeTrackFromPlaylist(track));

                    break;

                case 'update':
                    const newTrackData = tracklistData.tracks.find(trkData => trkData.id === trackId);
                    const isFileUpdated = trackState.isFile;

                    if (track.hasAttribute('data-downloading')) {
                        track.classList.add('awaiting-download');
                        track.dataset.isFileUpdated = isFileUpdated;
                        track.dataset.newTrackData = JSON.stringify(newTrackData);
                    } else {
                        migrateTrackData(newTrackData, playlistTracks[idx]);
                        updatePlaylistTrackInfo(track, newTrackData, isFileUpdated);

                        if (trackMenu?.referencedTrack === track) {
                            const downloadItem = trackMenu.querySelector('.download');
                            downloadItem.textContent = `Save audio as ${newTrackData.format.toUpperCase()}`;
                        }
                    }

                    break;
            }
        }

        if (audio === selectedAudio && playOn && audio.hasAttribute('data-updating-playing')) {
            console.log('+ play again');

            clearFinPlayTimer();
            stopAudioUpdaters();

            pauseAudio(audio);
            playAudio(audio);
        }

        audio.removeAttribute('data-updating-playing');
    });

    markPlaylistDuplicateNames();
    refreshPlaylistDuplicateNames(startIdx, { artistNames: true, trackTitles: true });
    refreshCurrentPlaylist();
}

async function updatePlaylistTrackInfo(track, newTrackData, isFileUpdated) {
    const audio = track.querySelector('audio');

    if (audio === selectedAudio) {
        if (isFileUpdated && !audio.hasAttribute('data-updating-playing')) {
            // Clean up the selected track
            hideLoading(audio);
            removeSelecting(audio);

            // Clone and replace the audio data of the selected track
            const updatedTrack = track.cloneNode(true);
            const updatedAudio = updatedTrack.querySelector('audio');

            migrateTrackData(newTrackData, updatedAudio.dataset);

            updatedAudio.removeAttribute('src');
            updatedAudio.removeAttribute('data-fully-loaded');
            delete updatedAudio.backgroundPreloadRequest;
            updatedAudio.load();
            
            const origIdx = origOrderedAudios.indexOf(audio);
            origOrderedAudios.splice(origIdx, 1, updatedAudio);
            const curIdx = currOrderedAudios.indexOf(audio);
            currOrderedAudios.splice(curIdx, 1, updatedAudio);

            // Insert the updated track version in place of the original
            const nextPlaylistTrack = track.nextElementSibling;
            
            if (nextPlaylistTrack) {
                nextPlaylistTrack.before(updatedTrack);
            } else {
                playlist.appendChild(updatedTrack);
            }

            // Link to delete load-info of the new track version after uploading the old one
            track.referencedUpdatedTrack = updatedTrack;

            // Remove the old track version in the temporary storage
            audio.setAttribute('data-temp-storage', '');
            tempTrackStorage.appendChild(track);
        } else {
            migrateTrackData(newTrackData, audio.dataset);
            updateSelectedTrackDisplays(audio);

            if (isFileUpdated && cachedAudioPool.has(audio)) {
                clearAudioCache(audio);
                clearBuffersContainer();
            }
        }
    } else {
        migrateTrackData(newTrackData, audio.dataset);
        if (isFileUpdated && cachedAudioPool.has(audio)) clearAudioCache(audio);
    }
}

function migrateTrackData(data, target) {
    target.artist = data.artist;
    target.title = data.title;
    target.format = data.format;
    target.order = Number(data.order);
    target.version = data.version;
}

async function updateTracklistDatabase(tracklistId) {
    const trlUpdatesRecord = tracklistDatabaseUpdates[tracklistId];
    if (!trlUpdatesRecord) return;
    if (trlUpdatesRecord.inProgress) return;

    const updatesData = trlUpdatesRecord.updates[0];
    if (updatesData.waitConfirm && !tracklistMgrWin.hidden) return;

    const { isExternalUpdate, manageMode, tracklistData, tracklistActions } = updatesData;
    const [isTracklistDeleted, isTrlTitleChanged, isTrlCoverChanged] = ['delete', 'titleChange', 'coverChange']
        .map(action => tracklistActions.successful.includes(action))
    ;
    let tracklistSection = tracklistsContainer.querySelector(`.tracklist-section[data-id="${tracklistId}"]`);
    let isCreatedTracklistExists = false;

    if (manageMode === 'delete' || manageMode === 'edit') {
        if (!tracklistSection) {
            // Коллекция треклистов загружена клиентом до окончания создания треликста и сразу изменяется.
            // При отправке апдейта клиентам, ещё не получившим новый треклист, тот не будет находиться в базе треклистов.
            delete tracklistDatabaseUpdates[tracklistId];
            return;
        }
    } else if (manageMode === 'create') {
        if (tracklistSection) {
            // Коллекция треклистов загружена клиентом до окончания создания треликста.
            // При отправке ему апдейта с созданием треклиста, этот треклист уже будет присутствовать в базе треклистов.
            isCreatedTracklistExists = true;
        } else {
            tracklistSection = createTracklistSection(tracklistId, tracklistData, { isNewTracklist: true });
        }
    }

    const tracklistDetails = tracklistSection.querySelector('.tracklist-details');
    const list = tracklistDetails.querySelector('.list');
    const isExpanded = tracklistSection.ariaExpanded === 'true';

    let activeTracklistTrackId = null;
    let isUpdatingCancelled = false;
    let mutationObserver;

    trlUpdatesRecord.inProgress = true;
    tracklistSection.classList.add('updating');

    await new Promise(resolve => setTimeout(resolve, 200));

    try {
        if (isTracklistDeleted) {
            if (isExpanded) await toggleTracklistTracksSize('shrink');
            await toggleTracklistSectionVisibility('hide');
            await toggleTracklistSectionSize('shrink');
            saveActiveElementInfo();
            deleteTracklistSection();
            applyActiveElementInfo();
            refreshTracklistDatabaseUpdateMarkers();

        } else if (manageMode === 'delete') { // Only tracks are deleting
            if (isExpanded) await toggleTracklistTracksSize('shrink');
            saveActiveElementInfo();
            applyChangesToTracks();
            applyActiveElementInfo();
            setNoSizeToTracklistTracks();
            refreshTracklistDatabaseUpdateMarkers();
            if (!isExpanded && !isExternalUpdate) await expandTracklistDetails();
            await toggleTracklistTracksSize('grow');

        } else if (manageMode === 'edit') {
            if (isTrlTitleChanged || isTrlCoverChanged) {
                const { shouldChangePosition, refreshedSortedTrlData, trlsContainerObserveData } =
                    predictTracklistSectionShift();
                if (trlsContainerObserveData) ({ mutationObserver } = trlsContainerObserveData);

                if (isExpanded) await toggleTracklistTracksSize('shrink');
                await toggleTracklistSectionVisibility('hide');
                if (shouldChangePosition) await toggleTracklistSectionSize('shrink');
                saveActiveElementInfo();
                const hasPositionChanged = insertTracklistSection(refreshedSortedTrlData, trlsContainerObserveData);
                applyChangesToTracklist();
                applyChangesToTracks();
                applyActiveElementInfo();
                if (hasPositionChanged && !isExternalUpdate) {
                    await scrollToTracklistSection(shouldChangePosition);
                } else {
                    setNoSizeToTracklistTracks();
                }
                if (shouldChangePosition) await toggleTracklistSectionSize('grow');
                refreshTracklistDatabaseUpdateMarkers();
                await toggleTracklistSectionVisibility('show');
                if (!isExpanded && !isExternalUpdate) await expandTracklistDetails();
                await toggleTracklistTracksSize('grow');

            } else { // Only tracks are changing
                if (isExpanded) await toggleTracklistTracksSize('shrink');
                saveActiveElementInfo();
                applyChangesToTracks();
                applyActiveElementInfo();
                setNoSizeToTracklistTracks();
                refreshTracklistDatabaseUpdateMarkers();
                if (!isExpanded && !isExternalUpdate) await expandTracklistDetails();
                await toggleTracklistTracksSize('grow');
            }

        } else if (manageMode === 'create') {
            if (isCreatedTracklistExists) { // Tracklist cover and/or tracks are changing
                if (isExpanded) await toggleTracklistTracksSize('shrink');
                await toggleTracklistSectionVisibility('hide');
                saveActiveElementInfo();
                applyChangesToTracklist();
                applyChangesToTracks();
                applyActiveElementInfo();
                setNoSizeToTracklistTracks();
                refreshTracklistDatabaseUpdateMarkers();
                await toggleTracklistSectionVisibility('show');
                await toggleTracklistTracksSize('grow');

            } else {
                const refreshedSortedTrlData = refreshTracklistSort();
                insertTracklistSection(refreshedSortedTrlData);
                calcTracklistsTextIndent(list);
                if (!isExternalUpdate) {
                    await scrollToTracklistSection();
                } else {
                    setNoSizeToTracklistTracks();
                }
                await toggleTracklistSectionSize('grow');
                refreshTracklistDatabaseUpdateMarkers();
                await toggleTracklistSectionVisibility('show');
                if (!isExternalUpdate) await expandTracklistDetails();
                await toggleTracklistTracksSize('grow');
            }
        }
    } catch(error) {
        if (mutationObserver) mutationObserver.disconnect();

        if (isUpdatingCancelled) {
            console.log(`The update of the tracklist database was cancelled at the stage: "${error.message}".`);
            delete tracklistDatabaseUpdates[tracklistId];
        } else {
            console.error('A tracklist database update error has occurred:', error);
        }
    } finally {
        console.log('Tracklist Database Updates:', tracklistDatabaseUpdates);

        if (isUpdatingCancelled) return;

        calcTracklistsContainerMaxHeight();
        setDocScrollbarYWidth();

        trlUpdatesRecord.inProgress = false;
        trlUpdatesRecord.updates.shift();

        if (trlUpdatesRecord.updates.length) {
            await updateTracklistDatabase(tracklistId);
        } else {
            tracklistSection.classList.remove('updating');
            delete tracklistDatabaseUpdates[tracklistId];

            removeTracklistDatabaseUpdateMarker(); // After tracklist update record deletion
        }
    }

    /// Functions ///

    function predictTracklistSectionShift() {
        if (isTrlTitleChanged || trlsSortOrder === 'dateUpdated') {
            const trlsContainerObserveData = startMutationObservation(tracklistsContainer);
            const refreshedSortedTrlData = refreshTracklistSort();
            const { newTracklistIdx, tracklistIdx } = refreshedSortedTrlData;
            const shouldChangePosition = newTracklistIdx !== tracklistIdx;
            return { shouldChangePosition, refreshedSortedTrlData, trlsContainerObserveData };
        } else {
            return { shouldChangePosition: false };
        }
    }

    function startMutationObservation(elem) {
        let needsResort = false; // Before the declaration of mutationObserver

        const mutationObserver = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (
                    mutation.type === 'childList' ||
                    (mutation.type === 'attributes' && mutation.attributeName === 'data-needs-resort')
                ) {
                    needsResort = true;
                    break;
                }
            }
        });
        mutationObserver.observe(elem, { childList: true, attributes: true, attributeFilter: ['data-needs-resort'] });

        return {
            get needsResort() { return needsResort },
            mutationObserver
        };
    }

    function refreshTracklistSort() {
        const { tracklistTitle, dateUpdated } = tracklistData;
        const currentTracklistsOrder = Array.from(tracklistsContainer.children).map(trlSection => [
            trlSection.dataset.id,
            trlSection === tracklistSection ? { tracklistTitle, dateUpdated } : trlSection.dataset
        ]);
        if (manageMode === 'create') currentTracklistsOrder.push([tracklistId, { tracklistTitle, dateUpdated }]);
        const sortedTracklists = currentTracklistsOrder.sort(sortFunctions[trlsSortOrder]);
        const newTracklistIdx = sortedTracklists.findIndex(([trlId, _]) => trlId === tracklistId);
        const tracklistIdx = [].indexOf.call(tracklistsContainer.children, tracklistSection);

        return { sortedTracklists, newTracklistIdx, tracklistIdx };
    }

    function insertTracklistSection(refreshedSortedTrlData, trlsContainerObserveData = null) {
        if (!refreshedSortedTrlData) return false; // !isTrlTitleChanged && trlsSortOrder !== 'dateUpdated'

        if (trlsContainerObserveData) {
            const { needsResort, mutationObserver } = trlsContainerObserveData;
            if (needsResort) refreshedSortedTrlData = refreshTracklistSort();
            mutationObserver.disconnect();
        }

        const { sortedTracklists, newTracklistIdx, tracklistIdx } = refreshedSortedTrlData;

        /*console.log(`${tracklistSection.dataset.tracklistTitle}(${tracklistIdx}) ==> ` +
            `${tracklistData.tracklistTitle}(${newTracklistIdx})`);
        console.log('curr:', [].map.call(tracklistsContainer.children, trlSection => trlSection.dataset.tracklistTitle));
        console.log('sort:', sortedTracklists.map(([_, trlData]) => trlData.tracklistTitle));*/

        if (manageMode === 'edit' && newTracklistIdx === tracklistIdx) { // Trigger the Mutation Observer
            tracklistsContainer.setAttribute('data-needs-resort', '');
            tracklistsContainer.removeAttribute('data-needs-resort');
            return false;
        }

        const prevTracklistId = newTracklistIdx ? sortedTracklists[newTracklistIdx - 1][0] : null;
        const prevTracklistSection = prevTracklistId ?
            tracklistsContainer.querySelector(`.tracklist-section[data-id="${prevTracklistId}"]`) :
            null
        ;

        if (prevTracklistSection) {
            prevTracklistSection.after(tracklistSection);
        } else {
            tracklistsContainer.prepend(tracklistSection);
        }

        return true;
    }

    function toggleTracklistTracksSize(className) {
        if (!list.children.length) return Promise.resolve();

        const allTracklistTracks = Array.from(list.children);
        if (className === 'shrink') allTracklistTracks.reverse();

        return new Promise((resolve, reject) => {
            const activeResizedTrlTracks = new Set();
            let requestScrollToView = null;

            allTracklistTracks.forEach((tracklistTrack, idx) => {
                activeResizedTrlTracks.add(tracklistTrack);
                setAnimationDelay(`${className}-track-in-tracklist`, idx * 2, () => animateAction(tracklistTrack));
            });

            if (className === 'grow' && !isExternalUpdate) {
                requestScrollToView = requestAnimationFrame(function callback() {
                    scrollToViewAnimatedElement(tracklistsContainer, tracklistSection, commonSpacing);
                    if (activeResizedTrlTracks.size) requestScrollToView = requestAnimationFrame(callback);
                });
            }

            eventManager.addOnceEventListener(tracklistsContainer, 'sortTracklists', cancelTrackResizing, tracklistId);

            /// Event Handlers and Callbacks ///

            function animateAction(tracklistTrack) {
                tracklistTrack.classList.remove('no-size');
                tracklistTrack.style.height = tracklistTrack.offsetHeight + 'px';
                tracklistTrack.classList.add(className);

                eventManager.addOnceEventListener(tracklistTrack, 'animationend', endTrackResizing);
            
                function endTrackResizing() {
                    activeResizedTrlTracks.delete(tracklistTrack);
    
                    if (className === 'grow') {
                        tracklistTrack.classList.remove(className);
                        tracklistTrack.style.height = '';
                    }
    
                    if (!activeResizedTrlTracks.size) {
                        eventManager.removeOnceEventListener(tracklistsContainer, 'sortTracklists', 'cancelTrackResizing',
                            tracklistId);
                        resolve();
                    }
                }
            }

            function cancelTrackResizing() {
                isUpdatingCancelled = true;
                cancelAnimationFrame(requestScrollToView);
                cancelAllAnimationDelays(`${className}-track-in-tracklist`);

                for (const tracklistTrack of activeResizedTrlTracks) {
                    eventManager.removeOnceEventListener(tracklistTrack, 'animationend', 'endTrackResizing');
                }

                reject(new Error('Tracklist Tracks Resizing'));
            }
        });
    }

    function toggleTracklistSectionVisibility(animationAction) {
        tracklistSection.classList.toggle('show', animationAction === 'show');

        return new Promise((resolve, reject) => {
            const transitionProperties = ['left', 'opacity'];
            let endedTransitionsCount = 0;

            tracklistSection.addEventListener('transitionend', endTracklistVisibility);
            eventManager.addOnceEventListener(tracklistsContainer, 'sortTracklists', cancelTracklistVisibility, tracklistId);

            /// Event Handlers ///

            function endTracklistVisibility(event) {
                if (!transitionProperties.includes(event.propertyName)) return;

                endedTransitionsCount++;

                if (endedTransitionsCount === transitionProperties.length) {
                    tracklistSection.removeEventListener('transitionend', endTracklistVisibility);
                    eventManager.removeOnceEventListener(tracklistsContainer, 'sortTracklists', 'cancelTracklistVisibility',
                        tracklistId);
                    resolve();
                }
            }

            function cancelTracklistVisibility() {
                isUpdatingCancelled = true;
                tracklistSection.removeEventListener('transitionend', endTracklistVisibility);
                reject(new Error('Changing the Tracklist Section Visibility'));
            }
        });
    }

    function toggleTracklistSectionSize(className) {
        let requestScrollToView = null;

        if (className === 'grow' && !isExternalUpdate) {
            requestScrollToView = requestAnimationFrame(function callback() {
                scrollToViewAnimatedElement(tracklistsContainer, tracklistSection, commonSpacing);
                if (tracklistSection.classList.contains(className)) requestScrollToView = requestAnimationFrame(callback);
            });
        }

        tracklistSection.style.height = tracklistSection.offsetHeight + 'px';
        tracklistSection.classList.add(className);

        return new Promise((resolve, reject) => {
            eventManager.addOnceEventListener(tracklistSection, 'animationend', endTracklistResizing);
            eventManager.addOnceEventListener(tracklistsContainer, 'sortTracklists', cancelTracklistResizing, tracklistId);

            /// Event Handlers ///

            function endTracklistResizing() {
                tracklistSection.classList.remove(className);
                tracklistSection.style.height = '';
                eventManager.removeOnceEventListener(tracklistsContainer, 'sortTracklists', 'cancelTracklistResizing',
                    tracklistId);
                resolve();
            }

            function cancelTracklistResizing() {
                isUpdatingCancelled = true;
                cancelAnimationFrame(requestScrollToView);
                eventManager.removeOnceEventListener(tracklistSection, 'animationend', 'endTracklistResizing');
                reject(new Error('Tracklist Section Resizing'));
            }
        });
    }

    function expandTracklistDetails() {
        toggleTracklistDetails(tracklistSection, { targetState: 'expand', applyToAll: false });

        return new Promise((resolve, reject) => {
            eventManager.addOnceEventListener(tracklistDetails, 'transitionend', endDetailsTransitionOnUpdate);
            eventManager.addOnceEventListener(tracklistsContainer, 'sortTracklists', cancelDetailsTransitionOnUpdate,
                tracklistId);

            /// Event Handlers ///

            function endDetailsTransitionOnUpdate() {
                eventManager.removeOnceEventListener(tracklistsContainer, 'sortTracklists', 'cancelDetailsTransitionOnUpdate',
                    tracklistId);
                resolve();
            }

            function cancelDetailsTransitionOnUpdate() {
                isUpdatingCancelled = true;
                eventManager.removeOnceEventListener(tracklistDetails, 'transitionend', 'endDetailsTransitionOnUpdate');
                reject(new Error('Tracklist Details Transition'));
            }
        });
    }

    function scrollToTracklistSection(shouldChangePosition = true) {
        if (!isExpanded) tracklistDetails.classList.add('instant-auto-height');

        const trlSectionHeight = tracklistSection.offsetHeight;
        const trlSectionTop = tracklistSection.offsetTop;
        
        setNoSizeToTracklistTracks();
        tracklistDetails.classList.remove('instant-auto-height');
        if (shouldChangePosition) tracklistSection.classList.add('no-size');

        const trlsContHeight = tracklistsContainer.offsetHeight;
        const trlsContScrolled = tracklistsContainer.scrollTop;
        const trlsContMaxScrolled = tracklistsContainer.scrollHeight - trlsContHeight;
        const shiftCenter = Math.max(Math.round(trlsContHeight / 2 - trlSectionHeight / 2), 0);
        const y = Math.min(Math.max(trlSectionTop - shiftCenter, 0), trlsContMaxScrolled);

        if (y !== trlsContScrolled) {
            

            tracklistsContainer.scrollTo({
                top: y,
                behavior: 'smooth'
            });

            return new Promise((resolve, reject) => {
                eventManager.addOnceEventListener(tracklistsContainer, 'scrollend', endScrolling);
                eventManager.addOnceEventListener(tracklistsContainer, 'sortTracklists', cancelScrolling, tracklistId);

                /// Event Handlers ///

                function endScrolling() {
                    tracklistSection.classList.remove('no-size');
                    eventManager.removeOnceEventListener(tracklistsContainer, 'sortTracklists', 'cancelScrolling',
                        tracklistId);
                    resolve();
                }

                function cancelScrolling() {
                    isUpdatingCancelled = true;
                    eventManager.removeOnceEventListener(tracklistsContainer, 'scrollend', 'endScrolling');

                    tracklistsContainer.scrollTo({
                        top: tracklistsContainer.scrollTop,
                        behavior: 'instant'
                    });
                    
                    reject(new Error('Tracklists Container Scrolling'));
                }
            });
        } else {
            tracklistSection.classList.remove('no-size');
            return Promise.resolve();
        }
    }

    function applyChangesToTracklist() {
        const coverImg = tracklistDetails.querySelector('.cover-box > img');

        if (isTrlTitleChanged) {
            const tracklistTitle = restoreText(tracklistData.tracklistTitle);
            tracklistSection.querySelector('.tracklist-title').innerHTML = tracklistTitle;
            coverImg.alt = `${clearTextFromHtml(tracklistTitle)} Cover`;
            tracklistSection.setAttribute('data-tracklist-title', tracklistData.tracklistTitle);
        } 

        if (isTrlCoverChanged) {
            coverImg.src = tracklistData.cover ?
                `/audio/tracklist/${tracklistId}/cover` :
                DEFAULTS_DATA['cover-source']
            ;
        }

        tracklistSection.setAttribute('data-date-updated', tracklistData.dateUpdated);
    }

    function applyChangesToTracks() {
        const checkboxAll = tracklistDetails.querySelector('header.strip input[type="checkbox"]');
        checkboxAll.checked = true;
        checkboxAll.classList.remove('partial-list');

        list.innerHTML = '';

        createTracklistTracks(list, tracklistId, tracklistData.tracks);
        toggleTracklistActivitiesFocusability(tracklistDetails);
        calcTracklistsTextIndent(list);

        tracklistSection.setAttribute('data-date-updated', tracklistData.dateUpdated);
    }

    function setNoSizeToTracklistTracks() {
        [].forEach.call(list.children, tracklistTrack => tracklistTrack.classList.add('no-size'));
    }

    function deleteTracklistSection() {
        tracklistSection.classList.add('no-size');
        tracklistSection.remove();
    }

    function saveActiveElementInfo() {
        const activeElem = savedActiveElem || document.activeElement;
        if (!tracklistSection.contains(activeElem)) return;

        savedActiveElem = isTracklistDeleted ?
            tracklistSection.nextElementSibling || tracklistSection.previousElementSibling || createTracklistBtn :
            activeElem
        ;

        if (list.contains(activeElem)) activeTracklistTrackId = activeElem.closest('li').dataset.id;
    }

    function applyActiveElementInfo() {
        if (activeTracklistTrackId && !isTracklistDeleted) {
            const activeTracklistTrack = list.querySelector(`li[data-id="${activeTracklistTrackId}"]`);

            if (activeTracklistTrack) {
                savedActiveElem = activeTracklistTrack.querySelector('label.design-proxy');
            } else {
                savedActiveElem = tracklistSection;
            }
        }

        focusSavedActiveElement();
    }

    function refreshTracklistDatabaseUpdateMarkers() {
        if (trlUpdatesRecord.updates.length > 1) {
            trlUpdatesRecord.updates.slice(1).forEach(update => {
                const pendingTracks = update.trackActions.pending;
    
                [...list.children].forEach(li => {
                    const { id: trackId, title } = li.dataset;
                    if (!pendingTracks[trackId]) return;
                    if (li.querySelector('.update-marker')) return;
        
                    createMarkedLastTitleWord(li, title);
                });
            });
        } else {
            removeTracklistUpdateMarkers(tracklistId, tracklistSection);
        }
    }
}

function enqueueTracklistDatabaseUpdate(tracklistId, updatesData, options = {}) {
    const { waitConfirm = false, isExternalUpdate = false } = options;

    if (!tracklistDatabaseUpdates[tracklistId]) {
        tracklistDatabaseUpdates[tracklistId] = {
            updates: [],
            inProgress: false
        };
    }

    updatesData.waitConfirm = waitConfirm;
    updatesData.isExternalUpdate = isExternalUpdate;

    tracklistDatabaseUpdates[tracklistId].updates.push(updatesData);
}

function beginTracklistDatabaseUpdate() {
    tracklistsContainer.setAttribute('data-updating', '');
    tracklistDtbsBtn.classList.replace('enabled', 'waiting');
}

function completeTracklistDatabaseUpdate() {
    if (Object.keys(tracklistDatabaseUpdates).length) return; // Check for any tracklist update

    console.log('+ complete tracklist database updating');

    tracklistsContainer.removeAttribute('data-updating');
    tracklistDtbsBtn.classList.replace('waiting', 'enabled');

    checkTracklistDatabaseAction();
}

function toggleTracklistActivitiesFocusability(tracklistDetails) {
    const focusableElems = tracklistDetails.querySelectorAll('label.design-proxy');
    focusableElems.forEach(elem => elem.tabIndex = tracklistDetails.style.height !== '0px' ? 0 : -1);
}

function scrollToViewAnimatedElement(container, element, outlineHeight = 0) {
    const contTop = container.scrollTop;
    const contBottom = contTop + container.offsetHeight;
    const elemTop = element.offsetTop - outlineHeight;
    const elemBottom = element.offsetTop + element.offsetHeight + outlineHeight;

    if (elemBottom > contBottom) {
        container.scrollTop += (elemBottom - contBottom);
    } else if (elemBottom < contBottom && elemTop < contTop) {
        container.scrollTop = elemTop;
    }
}

function checkTracklistDatabaseAction() {
    if (!tracklistDatabase.hasAttribute('data-waiting-action')) return;

    tracklistDatabase.removeAttribute('data-waiting-action');
    tracklistDatabaseAction();
}

function checkTracklistDatabasePositionX() {
    const maxWinWidthForTracklistsDtbs = maxTracklistDtbsWidth * 2 + audioPlayer.offsetWidth;
    tracklistDatabase.classList.toggle('sticked-left', window.innerWidth <= maxWinWidthForTracklistsDtbs);
}

function calcTracklistsContainerMaxHeight() {
    if (!tracklistDatabase.classList.contains('enabled')) return;

    audioPlayerContainer.style.minHeight = '';

    const winHeight = getWinHeight();
    const tracklistDtbsTop = Math.max(tracklistDatabase.getBoundingClientRect().top, 0);
    const restTracklistDtbsHeight = tracklistDatabase.offsetHeight - tracklistsContainer.offsetHeight;
    let maxTracklistsContainerHeight = winHeight - tracklistDtbsTop - restTracklistDtbsHeight -
        (audioPlayerContainerPaddingBottom - siteFooterHeight);

    const audioPlayerContainerBottom = audioPlayerContainer.getBoundingClientRect().bottom;
    const tracklistDtbsBottomHeight = audioPlayerContainerBottom - winHeight - siteFooterHeight;

    if (audioPlayerContainer.offsetHeight > winHeight && tracklistDtbsBottomHeight < 0) {
        maxTracklistsContainerHeight += tracklistDtbsBottomHeight;
    }

    tracklistsContainer.style.maxHeight = maxTracklistsContainerHeight + 'px';
    audioPlayerContainer.style.minHeight = '';

    setTracklistsContainerScrollability();
}

function setTracklistsContainerScrollability() {
    const isScrollable = tracklistsContainer.scrollHeight > tracklistsContainer.offsetHeight;
    const trlsContScrollbarWidth = isScrollable ? `${scrollbarWidth}px` : '';

    tracklistsContainer.classList.toggle('scrollable', isScrollable);
    tracklistsContainer.style.setProperty('--tracklists-container-scrollbar-y-width', trlsContScrollbarWidth);
}

///////////////////////////////////
/// Tracklist database creation ///
///////////////////////////////////

const trlsSortOrderBank = ['dateUpdated', 'alphabetical'];
const sortFunctions = {
    dateUpdated: ([, a], [, b]) => new Date(b.dateUpdated) - new Date(a.dateUpdated),
    alphabetical: ([, a], [, b]) => a.tracklistTitle.localeCompare(b.tracklistTitle)
};
let trlsSortOrder = localStorage.getItem('tracklists_sort_order');

async function createSortedTracklistSections(idx, { syncData = false } = {}) {
    if (!syncData) {
        if (idx && !tracklistDatabase.hasAttribute('data-ready')) return;
        if (idx === null && trlsSortOrder === trlsSortOrderBank[0]) return; // Resetting
    }

    if (
        tracklistsContainer.hasAttribute('data-toggling-details') ||
        tracklistsContainer.hasAttribute('data-updating') ||
        tracklistsContainer.hasAttribute('data-optimizing')  // Tracklist restructuring after SSE connection restoration
    ) {
        tracklistsContainer.dispatchEvent(eventSortTracklists); // Stops all tracklist animations
        await new Promise(resolve => setTimeout(resolve)); // Delay for the completion of tracklist database update animations
    }

    trlsSortOrder = trlsSortOrderBank[idx] || trlsSortOrderBank[0];
    localStorage.setItem('tracklists_sort_order', trlsSortOrder);

    const sortIcon = sortTracklistsBtn.firstElementChild;

    switch (trlsSortOrder) {
        case 'dateUpdated':
            sortIcon.src = 'img/icons/sort_date.png';
            sortIcon.alt = 'Sort Date';
            break;
        case 'alphabetical':
            sortIcon.src = 'img/icons/sort_alphabetical.png';
            sortIcon.alt = 'Sort Alphabetical';
            break;
    }

    console.log('Tracklists rebuilt in sort order: ' + trlsSortOrder);

    if (!tracklistsCollection) return;

    tracklistsContainer.removeAttribute('data-text-indent-for-add-options');
    tracklistsContainer.removeAttribute('data-toggling-details');
    tracklistsContainer.removeAttribute('data-updating');

    removeTracklistDatabaseUpdateMarker();

    for (const trlSection of tracklistsContainer.children) {
        tracklistsExpandedState.set(trlSection.dataset.id, trlSection.ariaExpanded);
    }

    const activeElem = savedActiveElem || document.activeElement;
    if (tracklistsContainer.contains(activeElem)) {
        savedActiveElem = {
            tracklistId: activeElem.closest('.tracklist-section').dataset.id,
            attrFor: activeElem.getAttribute('for')
        };
    }
    
    organizeTracklistSections();

    tracklistsExpandedState.clear();
    calcTracklistsTextIndent();
    calcTracklistsContainerMaxHeight();
    setDocScrollbarYWidth();
    focusSavedActiveElement();
    tracklistsContainer.classList.remove('no-transition'); // After setDocScrollbarYWidth

    /// Functions ///

    function organizeTracklistSections() {
        const allTrlSectionsFragment = document.createDocumentFragment();

        Array.from(tracklistsCollection.entries())
            .sort(sortFunctions[trlsSortOrder])
            .forEach(([key, value]) => {
                const tracklistSection = createTracklistSection(key, value);
                allTrlSectionsFragment.appendChild(tracklistSection);
            });

        tracklistsContainer.innerHTML = '';
        tracklistsContainer.appendChild(allTrlSectionsFragment);
    }
}

function createTracklistSection(tracklistId, tracklistData = {}, { isNewTracklist = false } = {}) {
    const trlSectionFragment = document.createDocumentFragment();
    const { tracklistTitle, dateUpdated, cover, tracks } = tracklistData;
    const isExpanded = tracklistsExpandedState.get(tracklistId) === 'true';
    
    const tracklistSection = document.createElement('section');
    tracklistSection.className = 'tracklist-section';
    if (tracklistDatabase.classList.contains('active') && !isNewTracklist) tracklistSection.classList.add('show');
    tracklistSection.setAttribute('data-id', tracklistId);
    tracklistSection.setAttribute('data-tracklist-title', tracklistTitle);
    tracklistSection.setAttribute('data-date-updated', dateUpdated);
    tracklistSection.setAttribute('aria-labelledby', `tracklist[${tracklistId}]-title`);
    tracklistSection.setAttribute('aria-expanded', isExpanded);
    tracklistSection.setAttribute('aria-controls', `trlDetails[${tracklistId}]`);
    tracklistSection.tabIndex = 0;
    trlSectionFragment.appendChild(tracklistSection);

    const menu = document.createElement('div');
    menu.className = 'tracklist-menu';
    menu.innerHTML = `
        <div class="buttons-box left">
            <i class="icon-close delete-tracklist-tracks" data-tooltip="Delete tracklist tracks"></i>
        </div>
        <div class="tracklist-title-box">
            <h4 id="tracklist[${tracklistId}]-title">
                <span class="tracklist-title" data-tooltip="Show/hide details">
                    ${restoreText(tracklistTitle)}
                </span>
            </h4>
        </div>
        <div class="buttons-box right">
            <i class="icon-list tracklist-to-playlist-replace" data-tooltip="Replace playlist" data-clear></i>
            <i class="icon-list-add tracklist-to-playlist-add" data-tooltip="Add to playlist"></i>
        </div>
    `;
    tracklistSection.appendChild(menu);

    menu.querySelectorAll('[data-tooltip]').forEach(elem => connectTooltipHoverIntent(elem));

    if (tracklistUpdateRegistry[tracklistId]) {
        const tracklistUpdateMarker = createUpdateMarker({ tooltipText: 'Tracklist is updating...' });
        menu.querySelector(`[id="tracklist[${tracklistId}]-title"]`).append(tracklistUpdateMarker);
    }

    const details = document.createElement('div');
    details.className = 'tracklist-details';
    details.style.height = isExpanded ? 'auto' : 0;
    details.setAttribute('id', `trlDetails[${tracklistId}]`);
    tracklistSection.appendChild(details);

    const header = document.createElement('header');
    header.className = 'strip';
    header.innerHTML = `
        <p>
            <input id="checkbox-tracklist[${tracklistId}]-all" type="checkbox" checked
            ><label for="checkbox-tracklist[${tracklistId}]-all" class="design-proxy"></label
            ><label for="checkbox-tracklist[${tracklistId}]-all" class="text"><span>Toggle all tracks</span></label>
        </p>
    `;
    details.appendChild(header);

    const detailsMain = document.createElement('main');
    detailsMain.className = 'details-main';
    details.appendChild(detailsMain);

    const coverBox = document.createElement('div');
    coverBox.className = 'cover-box';
    detailsMain.appendChild(coverBox);

    const coverImg = document.createElement('img');
    coverImg.src = cover ? `/audio/tracklist/${tracklistId}/cover` : DEFAULTS_DATA['cover-source'];
    coverImg.alt = `${clearTextFromHtml(restoreText(tracklistTitle))} Cover`;
    coverBox.appendChild(coverImg);

    const list = document.createElement('ul');
    list.className = 'list';
    detailsMain.appendChild(list);

    createTracklistTracks(list, tracklistId, tracks);

    const footer = document.createElement('footer');
    footer.className = 'strip';
    footer.innerHTML = `
        <p>
            <button id="edit-tracklist[${tracklistId}]"></button>
            <label for="edit-tracklist[${tracklistId}]" class="design-proxy">
                <svg class="edit-tracklist-svg" version="1.1" xmlns="http://www.w3.org/2000/svg"
                    width="120.000000pt" height="81.000000pt" viewBox="0 0 120.000000 81.000000"
                    preserveAspectRatio="xMidYMid meet">

                    <g transform="translate(0.000000,81.000000) scale(0.100000,-0.100000)"
                        fill="currentColor" stroke="none">
                        <path d="M20 790 c-27 -27 -25 -62 3 -88 23 -22 28 -22 361 -22 l337 0 24 25
                            c30 29 31 45 4 79 l-20 26 -345 0 c-331 0 -345 -1 -364 -20z"/>
                        <path d="M16 528 c-21 -30 -20 -61 2 -81 17 -15 57 -17 370 -17 l352 0 15 24
                            c19 29 11 72 -15 86 -11 6 -159 10 -364 10 l-345 0 -15 -22z"/>
                        <path d="M1055 510 l-29 -30 54 -56 55 -55 34 37 33 36 -48 49 c-27 27 -53 49
                            -59 49 -6 0 -24 -14 -40 -30z"/>
                        <path d="M827 282 l-157 -157 0 -58 0 -57 53 0 52 0 165 165 165 165 -50 50
                            c-27 27 -54 50 -60 50 -6 0 -81 -71 -168 -158z"/>
                        <path d="M17 272 c-21 -23 -22 -51 -1 -80 15 -22 19 -22 238 -22 203 0 224 2
                            239 18 22 24 21 65 -1 85 -16 15 -48 17 -239 17 -200 0 -221 -2 -236 -18z"/>
                    </g>
                </svg>
            </label
            ><label for="edit-tracklist[${tracklistId}]" class="text">Manage tracklist</label>
        </p>
    `;
    details.appendChild(footer);

    if (isExpanded) toggleTracklistActivitiesFocusability(details);

    if (savedActiveElem && typeof savedActiveElem === 'object' && savedActiveElem.tracklistId === tracklistId) {
        savedActiveElem = savedActiveElem.attrFor ?
            details.querySelector(`.design-proxy[for="${savedActiveElem.attrFor}"]`) :
            tracklistSection
        ;
    }

    return trlSectionFragment.firstElementChild; // Using firstElementChild is needed for creating a new tracklist
}

function createTracklistTracks(list, tracklistId, tracks) {
    if (!tracks || !tracks.length) return;

    const firstTrackArtist = tracks[0]?.artist;
    const hidenity = tracks.some(trackData => trackData.artist !== firstTrackArtist) ? '' : ' hidden';

    tracks.forEach(trackData => {
        const { order, artist, title } = trackData;
        const li = document.createElement('li');
        li.setAttribute('data-tracklist-id', tracklistId);
        Object.entries(trackData).forEach(([key, value]) => li.setAttribute(`data-${key}`, value));
        li.innerHTML = `
            <input id="checkbox-tracklist[${tracklistId}]-track[${order}]" type="checkbox" checked
            ><label for="checkbox-tracklist[${tracklistId}]-track[${order}]" class="design-proxy"></label
            ><label for="checkbox-tracklist[${tracklistId}]-track[${order}]" class="text"
                ><div class="order">${order}.&nbsp;</div
                ><span class="track-artist"${hidenity}>${restoreText(artist)}</span
                ><span class="hyphen"${hidenity}> &ndash; </span
                ><span class="track-title">${restoreText(title)}</span>
            </label> 
        `;
        list.appendChild(li);

        // Pending update marker
        if (tracklistUpdateRegistry[tracklistId]?.tracks.has(trackData.id)) createMarkedLastTitleWord(li, title);
    });
}

function createMarkedLastTitleWord(li, title) {
    const match = title.match(/(?:\W)?(\w+|\W)$/);
    const lastTitleWorld = match ? match[1] : title;
    const regexp = new RegExp(`${lastTitleWorld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

    const trackTitle = li.querySelector('.track-title');
    trackTitle.innerHTML = `${restoreText(title.replace(regexp, ''))}` +
        `<span class="last-word-box">${restoreText(lastTitleWorld)}</span>`;

    const trackUpdateMarker = createUpdateMarker({ tooltipText: 'Track is updating...' });
    trackTitle.querySelector('.last-word-box').append(trackUpdateMarker);
}

/////////////////////////
/// Playlist creation ///
/////////////////////////

let playlistTracks;

function initiatePlaylistTracks() {
    try {
        const savedPlaylistTracks = JSON.parse(decodeURIComponent(localStorage.getItem('playlist_tracks_data')));

        if (savedPlaylistTracks) {
            return checkPlaylistTracks(savedPlaylistTracks);
        } else if (tracklistsContainer.children.length) {
            // Gaining access to first tracklist after creating tracklist database
            return getSelectedTracksData(tracklistsContainer.firstElementChild.querySelector('.list'));
        } else {
            return [];
        }
    } catch(error) { // May occur when parsing JSON data from local storage
        console.error('Error initializing playlist tracks data:', error);
        return [];
    }
}

function checkPlaylistTracks(tracksDataArray) {
    return tracksDataArray.map(data => {
        const { tracklistId, id: trackId } = data;
        const tracklistData = tracklistsCollection.get(tracklistId);
        if (!tracklistData) return null;

        const trackData = tracklistData.tracks.find(trkData => trkData.id === trackId);
        if (!trackData) return null;

        return Object.assign({ tracklistId }, trackData);
    }).filter(data => data !== null);
}

async function createPlaylist(addedPlaylistTracks, clearPlaylist) {
    if (!Array.isArray(addedPlaylistTracks)) addedPlaylistTracks = [];

    if (addedPlaylistTracks.length) {
        if (!document.body.classList.contains('loading')) playlistTracks = playlistTracks.concat(addedPlaylistTracks);

        savePlaylistTracks();
        markPlaylistDuplicateNames();
    }

    let areTracksRemoving = false;

    if (clearPlaylist && origOrderedAudios.length) {
        playlist.removeAttribute('adding-tracks');
        areTracksRemoving = true;

        if (scrollablePlaylist && playlistLim.scrollTop && !activeScrollKeys.size) {
            await scrollPlaylistToTop();
        }
        
        runRemoveTracks(); // The current playlist will be updated and saved after the removal of each track
    }

    if (addedPlaylistTracks.length) createPlaylistTracks();

    /// Functions ///

    function scrollPlaylistToTop() {
        showScrollElems();
        scrollAndAlignPlaylist({
            direction: 'up',
            deltaHeight: playlistLim.scrollTop,
            align: false,
            hide: true
        });

        return new Promise(resolve => {
            eventManager.addOnceEventListener(document, 'endScrollingPlaylist', () => {
                setTimeout(resolve, 120);
            });
        });
    }
    
    async function createPlaylistTracks() {
        const createdTracksFragment = document.createDocumentFragment();

        const createdTracks = addedPlaylistTracks.map(trackData => {
            const { tracklistId, id: trackId, artist, title, alt, dup } = trackData;

            const track = document.createElement('div');
            track.className = 'track not-ready';
            createdTracksFragment.appendChild(track);
        
            const audio = document.createElement('audio');
            Object.entries(trackData).forEach(([key, value]) => audio.dataset[key] = value);
            audio.setAttribute('preload', 'auto');
            track.appendChild(audio);
    
            origOrderedAudios.push(audio);
    
            const additionals = document.createElement('div');
            additionals.className = 'additionals';
            track.appendChild(additionals);
    
            const removeTrackBtn = document.createElement('i');
            removeTrackBtn.className = 'icon-close remove-track';
            removeTrackBtn.setAttribute('data-tooltip', 'Remove track');
            additionals.appendChild(removeTrackBtn);
    
            connectTooltipHoverIntent(removeTrackBtn);
    
            const loadFig = document.createElement('div');
            loadFig.className = 'loading-figure';
            additionals.appendChild(loadFig);

            if (tracklistUpdateRegistry[tracklistId]?.tracks.has(trackId)) {
                const updateMarker = createUpdateMarker({ tooltipText: 'Track is updating...' });
                additionals.appendChild(updateMarker);
            }
            
            const trackInfoBox = document.createElement('div');
            trackInfoBox.className = 'track-info-box';
            trackInfoBox.tabIndex = 0;
            track.appendChild(trackInfoBox);

            const artistNameLim = document.createElement('div');
            artistNameLim.className = 'artist-name-limiter';
            trackInfoBox.appendChild(artistNameLim);

            const artistName = document.createElement('span');
            artistName.className = 'artist-name';
            artistName.textContent = artist;
            artistNameLim.appendChild(artistName);
        
            const trackTitleLim = document.createElement('div');
            trackTitleLim.className = 'track-title-limiter';
            trackInfoBox.appendChild(trackTitleLim);
        
            const trackTitle = document.createElement('span');
            trackTitle.className = 'track-title';
            const trackTitleFragment = createTrackTitleFragment(title, alt, dup);
            trackTitle.appendChild(trackTitleFragment);
            trackTitleLim.appendChild(trackTitle);

            return track;
        });

        playlist.appendChild(createdTracksFragment);

        setPlaylistOrder();
        
        if (areTracksRemoving || removingTracksCount) {
            await new Promise(resolve => eventManager.addOnceEventListener(document, 'endTracksRemoving', resolve));
        }

        runAddTracks(createdTracks);
    }
            
    function runAddTracks(createdTracks) {
        createdTracks.forEach((track, idx) => {
            setAnimationDelay('add-track-in-playlist', idx, () => {
                playlist.setAttribute('adding-tracks', '');
                track.classList.add('adding');
    
                eventManager.addOnceEventListener(track, 'animationend', () => {
                    if (track.classList.contains('pending-removal')) return;
                    if (track.classList.contains('removing')) return;
    
                    track.classList.remove('adding', 'not-ready');
    
                    checkPlaylistScrollability();
                    checkScrollElementsVisibility();
    
                    if (pointerModeScrolling) document.dispatchEvent(eventPointerMove);
    
                    // Last added track
                    if (idx === createdTracks.length - 1) {
                        playlist.removeAttribute('adding-tracks');
    
                        if (!accelerateScrolling) {
                            stopScrolling(KEY_SCROLLING_TIME);
                        } else if (!activeScrollOnKeyRepeat) {
                            const key = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
                            const canPlaylistScrolling = canPlaylistScrollingCheck(key);
                            if (canPlaylistScrolling) startScrolling(key);
                        }
                    }
                });
            });
        });
    }

    function runRemoveTracks() {
        origOrderedAudios.forEach((audio, idx) => {
            const track = audio.parentElement;

            if (track.classList.contains('pending-removal')) return;
            if (track.classList.contains('removing')) return;

            track.classList.add('pending-removal');
            setAnimationDelay('remove-track-from-playlist', idx, () => removeTrackFromPlaylist(track));
        });
    }
}

function savePlaylistTracks() {
    const savedPlaylistTracks = playlistTracks.map(trackData => ({
        tracklistId: trackData.tracklistId,
        id: trackData.id
    }));
    localStorage.setItem('playlist_tracks_data', encodeURIComponent(JSON.stringify(savedPlaylistTracks)));
}

function markPlaylistDuplicateNames() {
    const checkedTrackIds = new Set();

    for (let i = 0; i < playlistTracks.length; i++) {
        const trackData = playlistTracks[i];
        const { artist, title } = trackData;

        let trackId = trackData.id;
        if (origOrderedAudios[i]?.parentElement.classList.contains('awaiting-download')) {
            trackId += '-awaiting-download';
        }
        if (checkedTrackIds.has(trackId)) continue;

        checkedTrackIds.add(trackId);

        delete trackData.alt;
        delete trackData.dup;

        const altTrackCountsById = new Map();
        let dupCount = 1;
        let altCount = 0;

        for (let j = i + 1; j < playlistTracks.length; j++) {
            if (j >= playlistTracks.length) break;
            
            const comparisonTrackData = playlistTracks[j];
            const { artist: comparisonArtist, title: comparisonTitle } = comparisonTrackData;

            let comparisonTrackId = comparisonTrackData.id;
            if (origOrderedAudios[j]?.parentElement.classList.contains('awaiting-download')) {
                comparisonTrackId += '-awaiting-download';
            }

            if (trackId === comparisonTrackId) {
                comparisonTrackData.dup = ++dupCount;
                delete comparisonTrackData.alt;
            } else if (artist === comparisonArtist && title === comparisonTitle) {
                if (altTrackCountsById.has(comparisonTrackId)) {
                    let { altTrackAltCount, altTrackDupCount } = altTrackCountsById.get(comparisonTrackId);

                    comparisonTrackData.alt = altTrackAltCount;
                    comparisonTrackData.dup = ++altTrackDupCount;
                    altTrackCountsById.set(comparisonTrackId, { altTrackAltCount, altTrackDupCount });
                } else {
                    checkedTrackIds.add(comparisonTrackId);
                    
                    comparisonTrackData.alt = ++altCount;
                    delete comparisonTrackData.dup;
                    altTrackCountsById.set(comparisonTrackId, { altTrackAltCount: altCount, altTrackDupCount: 1 });
                }
            }
        }
    }
}

function refreshPlaylistDuplicateNames(startIdx = 0, { artistNames, trackTitles } = {}) {
    for (let i = startIdx; i < playlistTracks.length; i++) {
        const trackData = playlistTracks[i];
        const audio = origOrderedAudios[i];
        if (!audio) return;

        delete audio.dataset.alt;
        delete audio.dataset.dup;
        Object.entries(trackData).forEach(([key, value]) => audio.dataset[key] = value);

        if (artistNames) refreshArtistName(audio);
        if (trackTitles) refreshTrackTitle(audio);
    }
}

function refreshArtistName(audio) {
    const track = audio.parentElement;
    const artistName = track.querySelector('.artist-name');

    if (artistName.textContent !== audio.dataset.artist) {
        artistName.textContent = audio.dataset.artist;
    }
}

function refreshTrackTitle(audio) {
    const track = audio.parentElement;
    const { title, alt, dup } = audio.dataset;
    const awaitingDownload = track.classList.contains('awaiting-download');
    const pendingRemoval = track.classList.contains('pending-removal');
    
    const trackTitleFragment = createTrackTitleFragment(title, alt, dup, { awaitingDownload, pendingRemoval });

    const trackTitle = track.querySelector('.track-title');
    trackTitle.innerHTML = '';
    trackTitle.appendChild(trackTitleFragment);
}

function createTrackTitleFragment(title, alt, dup, { awaitingDownload = false, pendingRemoval = false } = {}) {
    const trackTitleFragment = document.createDocumentFragment();

    const titleNode = document.createTextNode(title);
    trackTitleFragment.appendChild(titleNode);

    if (alt) {
        const altNode = document.createElement('sup');
        altNode.textContent = `alt-${alt}`;
        trackTitleFragment.appendChild(altNode);
    }

    if (dup) {
        const dupNode = document.createTextNode(` (${dup})`);
        trackTitleFragment.appendChild(dupNode);
    }

    if (awaitingDownload || pendingRemoval) {
        const producedAction = awaitingDownload ? 'update' : 'delete';

        const pendUpdNode = document.createElement('sup');
        pendUpdNode.className = 'warning';
        pendUpdNode.textContent = `*The track will be ${producedAction}d after downloading`;
        trackTitleFragment.appendChild(pendUpdNode);
    }

    return trackTitleFragment;
}

////////////////////////////////////
/// Last played track start info ///
////////////////////////////////////

function showLastPlayedTrackInfo() {
    startInfoDisplay.setAttribute('data-displayed', '');

    if (selectedAudio) return;

    const cookies = document.cookie
        .split(';')
        .reduce((acc, cookie) => {
            const [key, value] = cookie.split('=').map(c => c.trim());
            acc[key] = value;
            return acc;
        }, {});

    const lastPlayedAudio = cookies['last_played_audio'] && decodeURIComponent(cookies['last_played_audio']);
    const lastPlayDate = cookies['date_of_last_play'];
    if (!lastPlayedAudio || !lastPlayDate) return;

    const timeElapsed = new Date() - new Date(lastPlayDate);
    const timeComponents = {
        days: Math.floor(timeElapsed / (1000 * 60 * 60 * 24)),
        hours: Math.floor((timeElapsed / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((timeElapsed / (1000 * 60)) % 60),
        seconds: Math.floor((timeElapsed / 1000) % 60)
    };

    const timeElapsedString = Object.entries(timeComponents)
        .filter(([_, value]) => value)
        .map(([key, value]) => `${value} ${key}`)
        .join(' ');
    
    const startInfo = `Last time you listened to the track
        <span class="track">"${restoreText(lastPlayedAudio)}"</span>
        <span class="time">${timeElapsedString}</span> ago.`;

    startInfoDisplay.innerHTML = startInfo;
    startInfoDisplay.hidden = false;

    setTimeout(() => {
        startInfoDisplay.style.opacity = 1;

        const transTime = parseFloat(getComputedStyle(startInfoDisplay).transitionDuration) * 1000;

        setTimeout(() => {
            startInfoDisplay.scrollTop = startInfoDisplay.scrollHeight;
            
            setTimeout(() => {
                startInfoDisplay.style.opacity = '';
    
                setTimeout(() => startInfoDisplay.hidden = true, transTime);
            }, 1750);
        }, 1750 + transTime);
    }, 750);
}

function saveLastPlayedAudioInfo(audio) {
    const lastPlayedAudio = 'last_played_audio=' +
        encodeURIComponent(audio.dataset.artist + ' - ' + audio.dataset.title);
    const lastPlayDate = 'date_of_last_play=' + new Date().toUTCString();
    const dateExpires = new Date(Date.now() + 864e6).toUTCString(); // Delete cookies after 10 days
    const path = '/';
    
    document.cookie = `${lastPlayedAudio}; path=${path}; expires=${dateExpires}`;
    document.cookie = `${lastPlayDate}; path=${path}; expires=${dateExpires}`;
}

////////////////////
/// Key handlers ///
////////////////////

function connectKeyHandlers() {
    // Document keys, no modifiers or repea
    document.addEventListener('keydown', (event) =>  {
        if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
        if (document.activeElement.matches('input[type="text"]')) return;

        //Playing/pausing audio
        if (event.code === 'KeyW' || event.code === 'Space') {
            event.preventDefault();
            highlightButton(event.code, playPauseBtn, playPauseAction);
            return;
        }
        // Stoping audio
        if (event.code === 'KeyS') {
            highlightButton(event.code, stopBtn, stopAction);
            return;
        }

        // Stepping/accelerating audio
        if (
            (event.code === 'ArrowLeft' || event.code === 'ArrowRight' ||
            event.code === 'KeyA' || event.code === 'KeyD') 
        ) {
            if (
                (event.code === 'ArrowLeft' || event.code === 'ArrowRight') &&
                (document.activeElement.matches('input[type="number"]'))
            ) {
                return;
            }

            const btn = accelerationData.keys[event.code].button;
            highlightButton(event.code, btn, downKeyStepAccAction, event.code);
            return;
        }

        // Randomizing playlist
        if (event.code === 'KeyQ') {
            highlightButton(event.code, shuffleBtn, shuffleAction);
            return;
        }
        // Repeating track/playlist
        if (event.code === 'KeyE') {
            highlightButton(event.code, repeatBtn, repeatAction);
            return;
        }

        // Changing buttons configuration
        if (event.code === 'KeyZ') {
            const idx = configsBank.indexOf(config);
            changeAudioControlsConfiguration.eventType = event.type;
            highlightButton(event.code, configBtn, changeAudioControlsConfiguration, idx + 1);
            return;
        }
        // Changing audio player coloring
        if (event.code === 'KeyX') {
            const idx = audioPlayerColorsBank.indexOf(audioPlayerColor);
            highlightButton(event.code, colorBtn, changeAudioPlayerColor, idx + 1);
            return;
        }
        // Changing playlist style
        if (event.code === 'KeyC') {
            const idx = playlistStylesBank.indexOf(playlistStyle);
            highlightButton(event.code, playlistStyleBtn, changePlaylistStyle, idx + 1);
            return;
        }

        // Showing/hiding settings
        if (event.code === 'KeyF') {
            highlightButton(event.code, settingsBtn, settingsAction);
            return;
        }
        // Showing/hiding keys info
        if (event.code === 'KeyI') {
            highlightButton(event.code, keysInfoBtn, keysInfoAction);
            return;
        }

        // Showing/hiding tracklist database
        if (event.code === 'KeyT') {
            highlightButton(event.code, tracklistDtbsBtn, tracklistDatabaseAction);
            return;
        }
        
        // Hiding tracklist deletion
        if (event.code === 'Delete') {
            if (!tracklistDelWin.classList.contains('active')) return; // Tracklists container key handler works
            const tracklistDelBtn = tracklistDelWin.tracklistSection.querySelector('i[class*="delete-tracklist-tracks"]');
            highlightButton(event.code, tracklistDelBtn, tracklistDeletionAction, null);
            return;
        }

        // Showing tracklist manager (new tracklist) / Hiding tracklist manager (existing/new tracklist)
        if (event.code === 'Insert') {
            if (tracklistsContainer.contains(document.activeElement)) return; // Tracklists container key handler works
            const tracklistMgrBtn = tracklistMgrWin.dataset.mode === 'edit' ?
                tracklistMgrWin.tracklistSection.querySelector('label[for^="edit-tracklist"].design-proxy') :
                createTracklistBtn
            ;
            highlightButton(event.code, tracklistMgrBtn, tracklistManagerAction, null);
            return;
        }

        // Sorting tracklists
        if (event.code === 'KeyV') {
            const trlsSortOrderIdx = trlsSortOrderBank.indexOf(trlsSortOrder);
            highlightButton(event.code, sortTracklistsBtn, createSortedTracklistSections, trlsSortOrderIdx + 1);
            return;
        }
        // Expanding all tracklist details
        if (event.code === 'NumpadAdd') {
            highlightButton(event.code, expandAllTrlDetailsBtn, toggleAllTracklistDetails, 'expand');
            return;
        }
        // Collapsing all tracklist details
        if (event.code === 'NumpadSubtract') {
            highlightButton(event.code, collapseAllTrlDetailsBtn, toggleAllTracklistDetails, 'collapse');
            return;
        }
        // Clearing playlist
        if (event.code === 'Backspace') {
            if (document.activeElement.matches('input[type="number"]')) return;
            highlightButton(event.code, clearPlaylistBtn, clearPlaylist);
            return;
        }

        // Closing keys info and settings by keypressing 'Escape'
        if (event.code === 'Escape') {
            const areas = [ // Order is important!
                { element: tracklistDelWin, action: tracklistDeletionAction },
                { element: tracklistMgrWin, action: tracklistManagerAction },
                { element: keysInfoWin, action: hideKeysInfo },
                { element: settingsArea, action: hideSettings }
            ];
            
            for (const { element, action } of areas) {
                if (!element.classList.contains('active')) continue;
                
                const closeBtn = element.querySelector('.close-button');
                highlightButton(event.code, closeBtn, action);
                break;
            }

            return;
        }

        // Handling the Enter key press for checkboxes and proxy labels
        if (event.key === 'Enter') {
            let target;

            if (target = event.target.closest('input[type="checkbox"]')) {
                if (target.disabled) return;

                target.checked = !target.checked;
                target.dispatchEvent(new Event('change'));
                return;
            }
            
            if (target = event.target.closest('label.design-proxy')) { // Only in the tracklist database
                const elem = document.getElementById(target.getAttribute('for'));
                if (elem.disabled) return;

                if (elem.tagName === 'INPUT' && elem.type === 'checkbox') {
                    elem.checked = !elem.checked;
                    elem.dispatchEvent(new Event('change', { bubbles: true }));
                    return;
                }

                if (elem.tagName === 'BUTTON') {
                    elem.dispatchEvent(new Event('click', { bubbles: true }));
                    return;
                }
            }
        }
    });

    // Сhanging volume
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        if (document.activeElement.matches('input[type="text"]')) return;

        // On/off volume
        if (event.code === 'KeyM' || event.code === 'KeyR') {
            if (event.repeat) return;
            highlightButton(event.code, volumeBtn, volumeAction);
            return;
        }
        // Increasing volume
        if ((event.shiftKey && event.code === 'ArrowUp') || event.code === 'Period') {
            changeVolumeAction('increase', event.repeat);
            return;
        }
        // Reducing volume
        if ((event.shiftKey && event.code === 'ArrowDown') || event.code === 'Comma') {
            changeVolumeAction('reduce', event.repeat);
            return;
        }
    });

    // Scrolling playlist
    document.addEventListener('keydown', (event) =>  {
        if (event.shiftKey && (event.code === 'ArrowUp' || event.code === 'ArrowDown')) return;

        if (
            (event.code === 'ArrowUp' || event.code === 'ArrowDown' ||
            event.code === 'PageUp' || event.code === 'PageDown' ||
            event.code === 'Home' || event.code === 'End') &&
            !event.repeat
        ) {
            downKeyScrollAction(event);
            return;
        }
        if (
            (event.code === 'ArrowUp' || event.code === 'ArrowDown' ||
            event.code === 'PageUp' || event.code === 'PageDown' ||
            event.code === 'Home' || event.code === 'End') &&
            event.repeat
        ) {
            repeatKeyScrollAction(event);
            return;
        }
    });
    document.addEventListener('keyup', (event) =>  {
        if (
            event.code === 'ArrowUp' || event.code === 'ArrowDown' ||
            event.code === 'PageUp' || event.code === 'PageDown' ||
            event.code === 'Home' || event.code === 'End'
        ) {
            upKeyScrollAction(event);
        }
    });

    // Focusing tracks
    visPlaylistArea.addEventListener('keydown', function (event) {
        const trackInfoBox = event.target.closest('.track-info-box');
        if (!trackInfoBox || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;

        // Select track in playlist
        if (event.key === 'Enter') {
            document.getSelection().empty();
            const track = trackInfoBox.closest('.track');
            highlightButton(event.code, playPauseBtn, selectPlaylistTrack, track);
            return;
        }
        // Remove track from playlist
        if (event.key === 'Delete') {
            const track = trackInfoBox.closest('.track');
            const removeTrackBtn = track.querySelector('.remove-track');
            highlightButton(event.code, removeTrackBtn, removeTrackFromPlaylist, track, event.type);
            return;
        }
    });

    // Focusing tracklists
    tracklistsContainer.addEventListener('keydown', (event) => {
        const tracklistSection = event.target.closest('.tracklist-section');
        if (!tracklistSection || event.ctrlKey || event.repeat) return;
        if (tracklistSection.classList.contains('updating')) return;

        // Expanding tracklist details
        if (event.key === 'Enter' && !event.shiftKey) {
            if (tracklistSection !== document.activeElement) return;
            const tracklistTitle = tracklistSection.querySelector('.tracklist-title');
            highlightButton(event.code, tracklistTitle, toggleTracklistDetails, tracklistSection);
            return;
        }
        // Showing tracklist deletion
        if (event.code === 'Delete' && !event.shiftKey) {
            const delBtn = tracklistSection.querySelector('i[class*="delete-tracklist-tracks"]');
            highlightButton(event.code, delBtn, tracklistDeletionAction, tracklistSection);
            return;
        }
        // Clearing playlist and add tracks from tracklist
        if ((event.altKey || event.metaKey) && event.code === 'NumpadAdd') {
            const replaceBtn = tracklistSection.querySelector('i.tracklist-to-playlist-replace');
            highlightButton(event.code, replaceBtn, addTracklistToPlaylist, tracklistSection, true);
            return;
        }
        // Adding tracks from tracklist
        if (event.shiftKey && event.code === 'NumpadAdd') {
            const addBtn = tracklistSection.querySelector('i.tracklist-to-playlist-add');
            highlightButton(event.code, addBtn, addTracklistToPlaylist, tracklistSection, false);
            return;
        }
        // Showing tracklist manager of existing tracklist
        if (event.code === 'Insert') {
            const manageBtn = tracklistSection.querySelector('label[for^="edit-tracklist"].design-proxy');
            highlightButton(event.code, manageBtn, tracklistManagerAction, tracklistSection);
            return;
        }
    });

    // Enable focus on visPlaylistArea when switching focus back from curPlaylist
    curPlaylist.addEventListener('keydown', (event) => {
        if (event.ctrlKey || event.altKey || event.metaKey) return;

        if (event.code === 'Tab' && event.shiftKey) {
            event.preventDefault();
            visPlaylistArea.focus();
        }
    });

    // Temporary check handler
    document.addEventListener('keydown', (event) => {
        if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
        if (event.code === 'KeyG') {
            //console.log(document.activeElement);
            //console.log(highlightActiveElem);
            console.log(eventManager.eventTypesByElement);
            //console.log(fileByInput);
            //console.log(tracklistsCollection);
            //console.log(tooltipHoverIntentByElem);
        }
    });
}

//////////////////////////
/// Server Sent Events ///
//////////////////////////

let clientId = '';

function initializeEventSource() {
    return new Promise(resolve => {
        const url = `/audio/sse-events-stream?clientId=${clientId}`;
        const eventSource = new EventSource(url);

        eventSource.onopen = openHandler;
        eventSource.onerror = errorHandler;
        eventSource.addEventListener('register', registerHandler);
        eventSource.addEventListener('sync', syncHandler);
        eventSource.addEventListener('notify', notifyHandler);
        eventSource.addEventListener('update', updateHandler);

        /// Handlers ///

        function openHandler() {
            console.log('Event Source opened');
        }

        function errorHandler(error) {
            console.error('Error SSE:', error);
    
            if (this.readyState === EventSource.CONNECTING) {
                console.log(`Reconnecting Event Source (readyState=${this.readyState})...`);
            }
        }

        function registerHandler(event) {
            const idData = JSON.parse(event.data);
            clientId = idData.clientId;

            console.log('Client ID: ' + clientId);
        }
        
        function syncHandler(event) {
            const initData = JSON.parse(event.data);
            const { audioPlayerVersion, tracklistsCollection: tracklistsCollectionObj } = initData;
    
            document.querySelector('.audio-player-footer .version').textContent = `v${audioPlayerVersion}`;
            tracklistsCollection = new Map(Object.entries(tracklistsCollectionObj));
    
            console.log(`Received audio player version: v${audioPlayerVersion}`);
            console.log('Received tracklists collection:', tracklistsCollection);

            if (document.body.classList.contains('loading')) {
                const trlsSortOrderIdx = trlsSortOrderBank.indexOf(trlsSortOrder);
                createSortedTracklistSections(trlsSortOrderIdx, { syncData: true });

                playlistTracks = initiatePlaylistTracks();
                createPlaylist(playlistTracks, false);

                resolve();
            } else {
                cleanObject(tracklistUpdateRegistry);
                cleanObject(tracklistDatabaseUpdates);

                const trlsSortOrderIdx = trlsSortOrderBank.indexOf(trlsSortOrder);
                createSortedTracklistSections(trlsSortOrderIdx, { syncData: true });

                playlistTracks = checkPlaylistTracks(playlistTracks);
                createPlaylist(playlistTracks, true);
            }
        }

        function notifyHandler(event) {
            if (!event.data) return;

            const updateNotificationData = JSON.parse(event.data);
            const { manageMode, tracklistId, pendingTracks, successfulTracks, rejectedTracks } = updateNotificationData;
    
            console.log(`Received update notification (Tracklist ID: ${tracklistId}):`, updateNotificationData);
    
            registerTracklistUpdate(tracklistId, pendingTracks, successfulTracks, rejectedTracks);
            setUpdateMarkers(manageMode, tracklistId, pendingTracks, successfulTracks, rejectedTracks);
            loadFullSelectedAudio(pendingTracks);
        }

        async function updateHandler(event) {
            if (!event.data) return;
    
            const updatesData = JSON.parse(event.data);
            const { manageMode, tracklistId, tracklistActions, trackActions } = updatesData;
            const { successful: successfulTrlActions } = tracklistActions;
            const { successful: successfulTracks, rejected: rejectedTracks } = trackActions;
            const hasCompletedUpdates = successfulTrlActions.length || Object.keys(successfulTracks).length;

            unregisterTracklistUpdate(tracklistId, successfulTracks, rejectedTracks);
            updatePlaylistTracks(updatesData);
    
            if (hasCompletedUpdates) {
                console.log('Received tracklist updates data:', updatesData);
            
                updateTracklistsCollection(updatesData);
                enqueueTracklistDatabaseUpdate(tracklistId, updatesData, { isExternalUpdate: true });
            
                if (tracklistDatabase.hasAttribute('data-ready')) {
                    beginTracklistDatabaseUpdate();
                    await updateTracklistDatabase(tracklistId);
                    completeTracklistDatabaseUpdate();
                }
            } else {
                console.log('Received tracklist updates data (no updates found):', updatesData);

                const tracklistSection = tracklistsContainer.querySelector(`.tracklist-section[data-id="${tracklistId}"]`);

                removeRejectedTracklistTracksUpdateMarkers(manageMode, tracklistSection, rejectedTracks);
                removeTracklistUpdateMarkers(tracklistId, tracklistSection);
                removeTracklistDatabaseUpdateMarker();
            }
        }
    });
}

////////////////////////////////////
/// Run initials and window load ///
////////////////////////////////////

runInitials();

function runInitials() {
    checkTracklistDatabasePositionX();
    initVisibleTracksCheckbox();
    initAddOptionsCheckbox();
    initTooltipHoverIntentConnections();
    initAudioPlayerChanges();

    function initAudioPlayerChanges() {
        changeAudioControlsConfiguration(configsBank.indexOf(config));
        changeNumberOfVisibleTracks(numOfVisTracks);
        changeAudioPlayerColor(audioPlayerColorsBank.indexOf(audioPlayerColor));
        changePlaylistStyle(playlistStylesBank.indexOf(playlistStyle));
        changeInitialVolume(settedVolume);
        changeScrollElemsOpacity(scrollElemsOpacity);
        changeWheelScrollStep(wheelScrollStep);
    }
}

eventManager.addOnceEventListener(window, 'load', hidePreload);

async function hidePreload() {
    const pageLoadTime = performance.now();
    const hidePreloadDelay = Math.max(MIN_PAGE_LOAD_TIME - pageLoadTime, 0);

    console.log('Page load time = ' + pageLoadTime);

    await new Promise(resolve => setTimeout(resolve, hidePreloadDelay));
    
    preloader.classList.remove('active');

    eventManager.addOnceEventListener(preloader, 'transitionend', () => {
        preloader.remove();

        audioPlayer.classList.add('show');

        eventManager.addOnceEventListener(audioPlayer, 'animationend', async () => {
            audioPlayer.classList.replace('show', 'active');

            await initializeEventSource();

            const timeDelay = playlistTracks.length ? 750 : 0;
            setTimeout(() => {
                document.body.classList.remove('loading');
                docScrollArrowsContainer.hidden = false;

                connectKeyHandlers();
                tracklistDatabaseAction();

                eventManager.addOnceEventListener(tracklistDatabase, 'endTacklistDtbsAnimation', () => {
                    if (tracklistsCollection) {
                        showLastPlayedTrackInfo();
                    } else {
                        startInfoDisplay.innerHTML = `Tracklists are
                            <span class="warning">not available</span>
                            at the moment.`;
                        startInfoDisplay.hidden = false;
                        setTimeout(() => startInfoDisplay.style.opacity = 1, 750);
                    }
                });
            }, timeDelay);
        });
    });
}
