'use strict';

//process.env.UV_THREADPOOL_SIZE = 10;

const { customMimeTypes } = require(`./utilities/mime_types_dictionary.js`);
const log = require(`./utilities/logger.js`).log(module);
const { AbortOperationError, TimeoutOperationError } = require('./utilities/errors.js');

const dotenv = require('dotenv');
const ENV = process.env.NODE_ENV || 'development';
dotenv.config({ path: `./config/.env.${ENV}` });

const https = require('https');
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const mimeTypes = require('mime-types');
const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const multer  = require('multer');
const { pathToRegexp } = require('path-to-regexp');
const { Throttle } = require('stream-throttle');
const { info } = require('console');

const pagesRoot = path.join(__dirname, 'public');
const audioRoot = path.join(__dirname, 'music');
const uploadRoot = path.join(__dirname, 'uploads');
const tracklistsCollectionPath = path.join(__dirname, 'tracklists_collection.json');

function ensureInitialStructure() {
    [audioRoot, uploadRoot].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`[Init] Created directory: ${dir}`);
        }
    });

    if (!fs.existsSync(tracklistsCollectionPath)) {
        fs.writeFileSync(tracklistsCollectionPath, JSON.stringify({}, null, 4), 'utf8');
        console.log(`[Init] Created empty database file: ${tracklistsCollectionPath}`);
    }
}

ensureInitialStructure();

const audioRouterPath = '/audio';

const trackOperations = ['getTrack', 'deleteTrack', 'updateTrack', 'createTrack'];
const tracklistOperations = ['getCover', 'deleteTracklist', 'updateTracklist', 'createTracklist'];

const excludedLogRoutes = [
    pathToRegexp(`${audioRouterPath}/tracklist/:tracklistId/cover`),
    pathToRegexp(`${audioRouterPath}/tracklist/title`)
];
const mediaRequestOperations = {
    'GET': {
        '/tracklist/:tracklistId/track/:trackId': 'getTrack',
        '/tracklist/:tracklistId/cover': 'getCover'
    },
    'DELETE': {
        '/tracklist/:tracklistId/track/:trackId': 'deleteTrack',
        '/tracklist/:tracklistId': 'deleteTracklist'
    },
    'PATCH': {
        '/tracklist/:tracklistId/track/:trackId': 'updateTrack',
        '/tracklist/:tracklistId': 'updateTracklist'
    },
    'POST': {
        '/tracklist/:tracklistId/track/:trackId': 'createTrack',
        '/tracklist/:tracklistId': 'createTracklist',
    }
};

const compiledRoutes = {};

for (const method in mediaRequestOperations) {
    compiledRoutes[method] = Object.entries(mediaRequestOperations[method]).map(([path, opType]) => ({
        regexp: pathToRegexp(path).regexp,
        operation: opType,
        path
    }));
}

const operationFileTypes = {
    updateTrack: 'audio',
    createTrack: 'audio',
    updateTracklist: 'image',
    createTracklist: 'image'
};
const maxFileSizes = {
    audio: 25 * 1024 * 1024, // 25 MB
    image: 1 * 1024 * 1024 // 1 MB
}
const validFileFormats = {
    audio: ['mp3', 'flac', 'wav'],
    image: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'avif', 'jfif', 'pjpeg', 'pjp', 'svgz']
};
const requiredTrackDataKeys = ['order', 'artist', 'title', 'format'];
const requiredTracklistDataKeys = ['tracklistTitle', 'cover', 'tracks'];
const manageModes = ['delete', 'edit', 'create'];
const tracklistActions = ['delete', 'titleChange', 'coverChange'];
const SEND_TRACK_INACTIVITY_TIMEOUT = 30e3;
const UPDATE_SESSION_TIMEOUT = 60e3;
const MAX_SSE_EVENTS = 200;
const sseEvents = [];
let clients = [];

const activeOldTrackFileVersions = {
    /*trackId: {
        1: 'trackPath-1',
        2: 'trackPath-2',
        3: 'trackPath-3'
    }*/
};

const resourceStates = {
    /*trackPath: {
        activeDownloads: 0,
        locked: true/false,
        scheduledForDeletion: true/false
    },
    tracklistPath: {
        locked: true/false,
        coverUpdating: true/false
        newTrackCreations: 0,
        cleanupRequired: true,
        tracklistData,
        scheduledForDeletion: true/false
    }*/
};

const updateSessions = {
    /*sessionId: {
        initiatorId: clientId,
        updatesData: {
            manageMode: 'delete'/'edit'/'create',
            tracklistId,
            tracklistActions: {
                pending: ['delete', 'titleChange', 'coverChange'],
                successful: ['delete', 'titleChange', 'coverChange'],
                rejected: ['delete', 'titleChange', 'coverChange']
            },
            trackActions: {
                pending: {
                    trackId: {
                        action: 'delete'/'update',
                        isFile: true/false
                    }
                },
                successful: {
                    trackId: {
                        action: 'delete'/'update'/'create',
                        isFile: true/false
                    }
                },
                rejected: {
                    trackId: {
                        action: 'delete'/'update'/'create',
                        isFile: true/false
                    }
                }
            }
        },
        operations: {
            assignedIdsMap: {
                tracklistId: operationId-1,
                trackId-1: operationId-2,
                trackId-2: operationId-3
            },
            states: {
                operationId: {
                    operationType: 'deleteTrack'/'deleteTracklist'/'updateTrack'/'updateTracklist'/'creatTrack'/
                        'createTracklist',
                    status: 'initial'/'conflict'/'abort'/'timeout'/'chunk-uploading'/'chunk-success'/'chunk-fail'/
                        'in-progress'/'success'/'post-processing'/'fail'/'unknown',
                    uploadFileData: { initTotalFileSize, initTotalChunks, lastChunkIndex },
                    responseData: { statusCode, successMessage/errorMessage },
                    updateCleanupData: { assembledFilePath, resourcePath }
                }
            }
        },
        hasTracklistOperation: true/false,
        active: true/false,
        aborted: true/false,
        timedOut: true/false,
        timeoutTimer: setTimeout(func, UPDATE_SESSION_TIMEOUT),
        updatesBroadcasted: true/false
    }*/
};

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const audioPlayerVersion = packageJson.version;

let tracklistsCollection = JSON.parse(fs.readFileSync(tracklistsCollectionPath, 'utf8'));
let isTracklistsCollectionLocked = false;

const app = express();
const audioRouter = express.Router();
const limiter = rateLimit({
    windowMs: 1 * 1000, // 1 секунда
    max: 20, // Максимум 20 запросов с одного IP за 1 секунду
    message: `Rate limit exceeded`,
    handler: (req, res, next, options) => {
        info.error(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(options.statusCode).send(`Rate limit exceeded for IP: ${req.ip}`);
    }
});
const throttleRate = 512 * 1024;

app.get(['/', '/home', /^\/index(\.html)?$/], sendMainPage);
app.use(express.static(pagesRoot));

// Logs and errors listeners
app.use(logRequestAndResponseErrors);

// SSE endpoint
audioRouter.get('/sse-events-stream',
    streamSseEvents
);
// Tracklist cover
audioRouter.get('/tracklist/:tracklistId/cover',
    processAudioRoute, extractAudioData, sendTracklistCover
);
// Send track
audioRouter.get('/tracklist/:tracklistId/track/:trackId',
    limiter, processAudioRoute, extractAudioData, sendTrack
);
// Tracklist title validation
audioRouter.post('/tracklist/title',
    express.json(), sendTracklistTitleValidation
);
// Start update session
audioRouter.post('/tracklist/start-update-session',
    express.json(), demoGuard, startTracklistUpdateSession
);
// End update session
audioRouter.post('/tracklist/end-update-session',
    express.json(), demoGuard, endTracklistUpdateSession
);
// Operation status
audioRouter.get('/tracklist-update-session/:sessionId/operation/:operationId/status',
    sendOperationStatus
);
// Operation: Delete track
audioRouter.delete('/tracklist/:tracklistId/track/:trackId',
    demoGuard, processAudioRoute, processHeaders, extractAudioData, verifyResourceLock, deleteTrack
);
// Operation: Delete tracklist
audioRouter.delete('/tracklist/:tracklistId',
    demoGuard, processAudioRoute, processHeaders, extractAudioData, verifyResourceLock, deleteTracklist
);
// Operation: Update track
audioRouter.patch('/tracklist/:tracklistId/track/:trackId',
    demoGuard, processAudioRoute, processHeaders, extractAudioData, verifyResourceLock, uploadFormData, processFileChunk, updateTrack
);
// Operation: Update tracklist
audioRouter.patch('/tracklist/:tracklistId',
    demoGuard, processAudioRoute, processHeaders, extractAudioData, verifyResourceLock, uploadFormData, processFileChunk, updateTracklist
);
// Operation: Create track
audioRouter.post('/tracklist/:tracklistId/track/:trackId',
    demoGuard, processAudioRoute, processHeaders, extractAudioData, verifyResourceLock, uploadFormData, processFileChunk, createTrack
);
// Operation: Create tracklist
audioRouter.post('/tracklist/:tracklistId',
    demoGuard, processAudioRoute, processHeaders, uploadFormData, processFileChunk, createTracklist
);

app.use(audioRouterPath, audioRouter);

app.use(handleUnknownRoute);
app.use(handleGlobalError);

const PROTOCOL = process.env.PROTOCOL || 'http';
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const DOMAIN = process.env.DOMAIN || 'localhost';

const createServer = (protocol, port, host, domain) => {
    let server;

    if (protocol === 'https') {
        const options = {
            key: fs.readFileSync(`./certs/${host}-key.pem`),
            cert: fs.readFileSync(`./certs/${host}.pem`)
        };
        server = https.createServer(options, app);
    } else {
        server = http.createServer(app);
    }

    server.listen(port, host, () => {
        console.log(`Server started at ${protocol}://${domain}:${port}`);
    });
};

createServer(PROTOCOL, PORT, HOST, DOMAIN);

/// Middlewares and Functions ///

function demoGuard(req, res, next) {
    if (ENV === 'production') {
        return next(createGlobalError({
            statusCode: 403,
            clientMessage: 'DEMO MODE: Changes are not allowed'
        }));
    }

    next();
}

function sendMainPage(req, res, next) {
    log.info(`Request: ${req.method}, ${req.originalUrl}`);

    const indexHtmlPath = path.join(pagesRoot, 'index.html');

    fs.access(indexHtmlPath, fs.constants.F_OK, (err) => {
        if (err) {
            return next(createGlobalError({
                error: err,
                details: `Index HTML file not found: ${indexHtmlPath}`,
                statusCode: 404,
                clientMessage: 'Index HTML file not found'
            }));
        }
        
        res.sendFile(indexHtmlPath);
    });
}

function logRequestAndResponseErrors(req, res, next) {
    const shouldLog = !excludedLogRoutes.some(route => route?.regexp.test(req.path));
    if (shouldLog) log.info(`Request: ${req.method}, ${req.originalUrl}`);

    req.connectionAborted = false;

    req.on('aborted', () => {
        log.warn(`Connection interrupted by the client`);
        req.connectionAborted = true;
    });

    req.on('error', (err) => {
        if (!req.connectionAborted) log.error(`Request error: ${err.message}`);
    });

    res.on('error', (err) => {
        if (!req.connectionAborted) log.error(`Response error: ${err.message}`);
    });
    
    next();
}

function sendTracklistCover(req, res, next) {
    const tracklistData = req.tracklistData;
    const coverPath = path.join(audioRoot, sanitizePathSegment(tracklistData.tracklistTitle), tracklistData.cover);

    fs.access(coverPath, fs.constants.F_OK, (err) => {
        if (err) {
            return next(createGlobalError({
                error: err,
                details: `Cover image not found: ${coverPath}`,
                statusCode: 404,
                clientMessage: 'Cover image not found'
            }));
        }

        res.sendFile(coverPath);
    });
}

async function sendTrack(req, res, next) {
    const { tracklistPath, trackId, trackPath, trackStats, fileVersion } = req;
    const commonHeaders = {
        'Content-Type': getContentType(trackPath),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    };
    const range = req.headers.range;
    let cleanupCalled = false;
    let fileStream;

    incrementActiveDownloads(trackPath);

    const cleanup = () => {
        if (cleanupCalled) return;

        cleanupCalled = true;
        clearTimeout(connectionTimeout);
        if (res.finished) log.info(`Sent audio data: ${trackPath}`);
        if (fileStream?.destroyed === false) fileStream.destroy();
        decrementActiveDownloads(trackPath, { trackId, fileVersion, tracklistPath });
    };
    const handleConnectionTimeout = () => {
        log.warn(`Connection timeout for "${trackPath}"`);
        cleanup();
    }
    const resetTimeout = () => {
        clearTimeout(connectionTimeout);
        connectionTimeout = setTimeout(handleConnectionTimeout, SEND_TRACK_INACTIVITY_TIMEOUT);
    };
    let connectionTimeout = setTimeout(handleConnectionTimeout, SEND_TRACK_INACTIVITY_TIMEOUT);

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : trackStats.size - 1;
        const chunkSize = (end - start) + 1;

        if (start >= trackStats.size || end >= trackStats.size || start > end) {
            return next(createGlobalError({
                error: err,
                details: `RangeError for "${trackPath}": The value of "start" is out of range.` +
                    `It must be <= "end" (here: ${trackStats.size}).` +
                    `Received start: ${start}, end: ${end}`,
                statusCode: 416,
                clientMessage: 'Requested range not satisfiable'
            }));
        }

        res.status(206).set({
            'Content-Range': `bytes ${start}-${end}/${trackStats.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            ...commonHeaders
        });

        fileStream = fs.createReadStream(trackPath, { start, end });
    } else {
        res.status(200).set({
            'Content-Length': trackStats.size,
            ...commonHeaders
        });

        fileStream = fs.createReadStream(trackPath);
    }

    fileStream.on('error', (err) => {
        next(createGlobalError({
            error: err,
            details: `File streaming error for "${trackPath}": ${err.message}`,
            statusCode: 500,
            clientMessage: setServerError(err)
        }));
    });
    fileStream.on('data', resetTimeout);
    fileStream.on('end', cleanup);
    req.on('aborted', cleanup);
    ['error', 'finish', 'end', 'close'].forEach((event) => res.on(event, cleanup));

    const throttle = new Throttle({ rate: throttleRate });
    fileStream.pipe(throttle).pipe(res);
}

async function sendTracklistTitleValidation(req, res, next) {
    const { origTracklistTitle, newTracklistTitle } = req.body;

    if (
        origTracklistTitle === undefined || newTracklistTitle === undefined ||
        typeof origTracklistTitle !== 'string' || typeof newTracklistTitle !== 'string'
    ) {
        return next(createGlobalError({
            details: 'Invalid tracklist title data',
            statusCode: 400,
            clientMessage: 'Bad request'
        }));
    }

    try {
        const isTitleAllowed = await validateTracklistTitle(origTracklistTitle, newTracklistTitle);
        res.json({ permission: isTitleAllowed });
    } catch(err) {
        next(createGlobalError({
            statusCode: 500,
            clientMessage: setServerError()
        }));
    }
}

function sendOperationStatus(req, res) {
    const { sessionId, operationId } = req.params;
    const operationState = updateSessions[sessionId]?.operations.states[operationId];
    const operationStatus = operationState?.status || 'unknown';

    const operationData = { operationStatus };
    const responseData = operationState?.responseData;
    if (responseData) operationData.responseData = responseData;

    res.on('finish', () => log.info(`Sent track status: ${operationStatus}`));
    res.json(operationData);
}

function streamSseEvents(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Мгновенная отправка заголовков
    
    // Обработка нового клиента
    let clientId = req.params.clientId;

    try {
        if (!clientId || !clients.find(client => client.id === clientId)) {
            clientId = generateClientId();
            sendClientID(clientId, res);
        }
    
        const newClient = { id: clientId, res };
        clients.push(newClient);
    
        clients.forEach(client => console.log(client.id));
        //console.log(sseEvents);
    
        // Проверка, подключился ли клиент впервые или переподключился
        const lastEventId = req.headers['last-event-id'];

        console.log('+ lastEventId = ' + lastEventId);

        if (!lastEventId) { // Новое соединение
            sendSynchronizedData(res); // Отправка текущей коллекции треклистов
            sendProcessingUpdateNotifications(res); // Отправка уведомлений о происходящих апдейтах
        } else { // Восстановление соединения
            sendMissedEventMessages(lastEventId, res); // Отправка пропущенных уведомлений и апдейтов
        }
    } catch(err) {
        log.error(`Error during SSE stream for client "${clientId}" at the stage "${err.stage}": ${err.message}.`);
        clients = clients.filter(client => client.id !== clientId);
    }
    
    // Обработка отключения клиента
    req.on('close', () => {
        clients = clients.filter(client => client.id !== clientId);
        clients.forEach(client => console.log(client.id));
    });
}

function sendClientID(clientId, res) {
    const lastEventId = sseEvents.length ? sseEvents[sseEvents.length - 1].id : 'initial-event-id';
    
    try {
        res.write(`event: register\n`);
        res.write(`data: ${JSON.stringify({ clientId })}\n`);
        res.write(`id: ${lastEventId}\n\n`);
    } catch(err) {
        err.stage = 'Sending Client ID';
        throw err;
    }
}

function sendSynchronizedData(res) {
    const lastEventId = sseEvents.length ? sseEvents[sseEvents.length - 1].id : 'initial-event-id';

    try {
        res.write(`event: sync\n`);
        res.write(`data: ${JSON.stringify({ audioPlayerVersion, tracklistsCollection })}\n`);
        res.write(`id: ${lastEventId}\n\n`);
    } catch(err) {
        err.stage = 'Sending Tracklists Collection';
        throw err;
    }
}

function sendProcessingUpdateNotifications(res) {
    if (!sseEvents.length) return;

    try {
        Object.values(updateSessions).forEach(sessionRecord => {
            const { updatesBroadcasted, updatesData } = sessionRecord;
            if (updatesBroadcasted) return;
    
            const { manageMode, tracklistId, trackActions } = updatesData;
            const { pending: pendingTracks, successful: successfulTracks, rejected: rejectedTracks } = trackActions;
            const updateNotificationData = { manageMode, tracklistId, pendingTracks, successfulTracks, rejectedTracks };
            const lastEventId = sseEvents[sseEvents.length - 1].id;
    
            res.write(`event: notify\n`);
            res.write(`data: ${JSON.stringify(updateNotificationData)}\n`);
            res.write(`id: ${lastEventId}\n\n`);
        });
    } catch(err) {
        err.stage = 'Sending Processing Update Notifications';
        throw err;
    }
}

function sendMissedEventMessages(lastEventId, res) {
    const lastEventIdx = sseEvents.findIndex(event => event.id === lastEventId);

    if (lastEventIdx === -1) { // При переподключении пропущено слишком много сообщений
        sendSynchronizedData(res); // Отправка текущей коллекции треклистов
        sendProcessingUpdateNotifications(res); // Отправка уведомлений о происходящих апдейтах
        return;
    }

    const missedEvents = sseEvents.slice(lastEventIdx + 1);

    try {
        missedEvents.forEach(event => {
            res.write(`event: ${event.type}\n`);
            res.write(`data: ${JSON.stringify(event.data)}\n`);
            res.write(`id: ${event.id}\n\n`);
        });
    } catch(err) {
        err.stage = 'Sending Missed Events';
        throw err;
    }
}

async function startTracklistUpdateSession(req, res, next) {
    const { clientId, manageMode, tracklistId, pendingTracks } = req.body;
    let { pendingTracklistActions, newTrackCount } = req.body;

    try {
        // Client ID
        if (clientId === undefined) throw new Error('Client ID is missing');
        if (typeof clientId !== 'string') throw new Error('Client ID is not of type "string"');
        if (!clients.find(clientData => clientData.id === clientId)) throw new Error(`Client ID "${clientId}" not found`);

        // Session record
        const isActiveInitiatedSession = Object.values(updateSessions)
            .some(record => record.initiatorId === clientId && !record.updatesBroadcasted);
        if (isActiveInitiatedSession) throw new Error('Update session already initiated by this client');

        // Tracklist manage mode
        if (manageMode === undefined) throw new Error('Tracklist manage mode is missing');
        if (typeof manageMode !== 'string') throw new Error('Tracklist manage mode is not of type "string"');
        if (!manageModes.includes(manageMode)) throw new Error(`Tracklist manage mode "${manageMode}" is not valid`);

        if (['delete', 'edit'].includes(manageMode)) {
            // Tracklist ID
            if (tracklistId === undefined) throw new Error('Tracklist ID is missing');
            if (typeof tracklistId !== 'string') throw new Error('Tracklist ID is not of type "string"');
            if (!isValidUUID('tracklist', tracklistId)) throw new Error(`Tracklist ID "${tracklistId}" is not valid`);

            const error = new Error('Tracklist data not found');
            error.statusCode = 404;
            error.clientMessage = 'Resource not found';

            const tracklistData = tracklistsCollection[tracklistId];
            if (!tracklistData) {
                error.message = 'Tracklist data not found';
                throw error;
            }

            const tracklistName = getTracklistName(tracklistData, true);
            const { path: tracklistPath } = await getAndVerifyPath(audioRoot, tracklistName);
            if (!tracklistPath) {
                error.message = 'Tracklist directory not found';
                throw error;
            }

            validatePendingTracks(pendingTracks, tracklistData.tracks); // Изменяется объект по ссылке pendingTracks
        }

        // Pending tracklist actions
        if (pendingTracklistActions === undefined) throw new Error('Pending tracklist actions are missing');
        if (!Array.isArray(pendingTracklistActions)) throw new Error('Pending tracklist actions are not an array');

        pendingTracklistActions = pendingTracklistActions.filter(action => tracklistActions.includes(action));

        if (pendingTracklistActions.includes('delete') && pendingTracklistActions.length > 1) {
            throw new Error('Invalid combination of pending tracklist actions');
        }

        // Pending modification tracks
        if (pendingTracks === undefined) throw new Error('Pending modification tracks are missing');
        if (typeof pendingTracks !== 'object' || Array.isArray(pendingTracks) || pendingTracks === null) {
            throw new Error('Pending modification tracks are not of type "object"');
        }

        // New track count
        if (newTrackCount !== undefined) {
            newTrackCount = parseNonNegativeInteger(newTrackCount);
            if (newTrackCount === null) throw new Error('New track count is not valid');
        }

        // Available updates checking
        if (!pendingTracklistActions.length && !Object.keys(pendingTracks).length && !newTrackCount) {
            throw new Error('No updates found');
        }
    } catch(err) {
        return next(createGlobalError({
            error: err,
            details: `Error verifying start update session data: ${err.message}`,
            statusCode: err.statusCode || 400,
            clientMessage: err.clientMessage || 'Bad request'
        }));
    }

    // Создание ID нового треклиста, новых треков и каждой операции
    const newTracklistId =  manageMode === 'create' ? generatePrefixedUUID('tracklist') : null;
    const newTrackIds = [];

    if (newTrackCount) {
        for (let i = 1; i <= newTrackCount; i++) {
            const newTrackId = generatePrefixedUUID('track');

            pendingTracks[newTrackId] = { action: 'create' };
            newTrackIds.push(newTrackId);
        }
    }

    const assignedOperationIds = {};
    if (pendingTracklistActions.length) assignedOperationIds[newTracklistId || tracklistId] = generateOperationId();
    Object.keys(pendingTracks).forEach(trackId => assignedOperationIds[trackId] = generateOperationId());

    // Уведомление клиентов об апдейте
    const updateNotificationData = {
        manageMode,
        tracklistId: newTracklistId || tracklistId,
        pendingTracklistActions,
        pendingTracks
    };

    sendDataToAllClients('notify', updateNotificationData, clientId);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Создание сессии апдейта треклиста
    const sessionId = generateUpdateSessionId();

    updateSessions[sessionId] = {
        initiatorId: clientId,
        updatesData: {
            manageMode,
            tracklistId: newTracklistId || tracklistId,
            tracklistActions: {
                pending: pendingTracklistActions,
                successful: [],
                rejected: []
            },
            trackActions: {
                pending: pendingTracks,
                successful: {},
                rejected: {}
            },
        },
        operations: {
            assignedIdsMap: assignedOperationIds,
            states: {}
        },
        hasTracklistOperation: false,
        active: true,
        aborted: false,
        timedOut: false,
        timeoutTimer: setTimeout(() => {
            console.log('+ update session timeout');

            updateSessions[sessionId].timedOut = true;
            closeUpdateSession(sessionId);
        }, UPDATE_SESSION_TIMEOUT),
        updatesBroadcasted: false
    };

    // Отправка данных для апдейтов клиенту-инициатору
    const responseData = { sessionId, assignedOperationIds };
    if (newTracklistId) responseData.newTracklistId = newTracklistId;
    if (newTrackIds.length) responseData.newTrackIds = newTrackIds;

    res.json(responseData);
}

function validatePendingTracks(pendingTracks, existingTracks) {
    pendingTracksLoop: for (const trackId in pendingTracks) {
        if (!isValidUUID('track', trackId)) {
            delete pendingTracks[trackId];
            continue;
        }

        const trackData = existingTracks.find(trackData => trackData.id === trackId);

        if (!trackData) {
            delete pendingTracks[trackId];
            continue;
        }

        const trackState = pendingTracks[trackId];

        if (
            typeof trackState !== 'object' || Array.isArray(trackState) || trackState === null ||
            !Object.keys(trackState).length
        ) {
            delete pendingTracks[trackId];
            continue;
        }

        for (const key in trackState) {
            if (!['action', 'isFile'].includes(key)) {
                delete pendingTracks[trackId];
                continue pendingTracksLoop;
            }

            const value = trackState[key];

            if (key === 'action' && !['delete', 'update'].includes(value)) {
                delete pendingTracks[trackId];
                continue pendingTracksLoop;
            }

            if (key === 'isFile' && typeof value !== 'boolean') {
                delete pendingTracks[trackId];
                continue pendingTracksLoop;
            }
        }

        if (trackState.action === 'update' && trackState.isFile === undefined) {
            delete pendingTracks[trackId];
            continue;
        }
    }
}

async function endTracklistUpdateSession(req, res, next) {
    const { clientId, sessionId, isAborted } = req.body;
    let sessionRecord;

    try {
        // Client ID
        if (clientId === undefined) throw new Error('Client ID is missing');
        if (typeof clientId !== 'string') throw new Error('Client ID is not of type "string"');
        if (!clients.find(clientData => clientData.id === clientId)) throw new Error(`Client ID "${clientId}" not found`);

        // Session ID
        if (sessionId === undefined) throw new Error('Update session ID is missing');
        if (typeof sessionId !== 'string') throw new Error('Update session ID is not of type "string"');

        // Abort session
        if (isAborted === undefined) throw new Error('Abort session flag is missing');
        if (typeof isAborted !== 'boolean') throw new Error('Abort session flag is not of type "boolean"');

        // Session record
        sessionRecord = updateSessions[sessionId];
        if (!sessionRecord) throw new Error('Update session record not found.');
        if (sessionRecord.initiatorId !== clientId) throw new Error('Client ID is mismatch');
        if (sessionRecord.timedOut) {
            const error = new Error('Update session has timed out');
            error.statusCode = 408;
            error.clientMessage = 'Tracklist update session has timed out';
            throw error;
        }
        if (sessionRecord.aborted) throw new Error('Attempted to abort the update session after it has ended');
        if (!sessionRecord.active) throw new Error('Attempted to end the update session after it has ended');
    } catch(err) {
        return next(createGlobalError({
            error: err,
            details: `Error verifying end update session data: ${err.message}`,
            statusCode: err.statusCode || 400,
            clientMessage: err.clientMessage || 'Bad request'
        }));
    }

    clearTimeout(sessionRecord.timeoutTimer);
    if (isAborted) sessionRecord.aborted = true;

    closeUpdateSession(sessionId, res);
}

async function closeUpdateSession(sessionId, senderResponse = null) {
    // Дезактивация сессии
    const sessionRecord = updateSessions[sessionId];
    sessionRecord.active = false;

    // Проверка операций
    const operations = sessionRecord.operations.states;
    let areAllOperationsCompleted = checkOperationCompleting(operations);

    while (!areAllOperationsCompleted) {
        await new Promise(resolve => setTimeout(resolve, 50));
        areAllOperationsCompleted = checkOperationCompleting(operations);
    }

    // Распространение данных апдейта среди клиентов
    const { updatesData, initiatorId, timedOut } = sessionRecord; // После ожидания данные апдейтов изменятся
    const { tracklistId, tracklistActions, trackActions } = updatesData;
    const { pending: pendingTrlActions, successful: successfulTrlActions, rejected: rejectedTrlActions } = tracklistActions;
    const { pending: pendingTracks, successful: successfulTracks, rejected: rejectedTracks } = trackActions;

    pendingTrlActions.forEach(action => {
        if (!successfulTrlActions.includes(action) && !rejectedTrlActions.includes(action)) {
            rejectedTrlActions.push(action);
        }
    });

    for (const trackId in pendingTracks) {
        if (!successfulTracks[trackId] && !rejectedTracks[trackId]) {
            rejectedTracks[trackId] = pendingTracks[trackId];
        }
    }
    
    if (!successfulTrlActions.includes('delete')) updatesData.tracklistData = tracklistsCollection[tracklistId];
        
    sendDataToAllClients('update', updatesData, initiatorId, timedOut);
    if (!timedOut && senderResponse) senderResponse.json({ updatesData });

    // Закрытие сессии с отложенным удалением её записи
    sessionRecord.updatesBroadcasted = true;
    setTimeout(() => delete updateSessions[sessionId], 5e3);
}

function checkOperationCompleting(operations) {
    return Object.values(operations).every(operationState => !isTransientStatus(operationState.status));
}

function sendDataToAllClients(eventType, data, initiatorId, isInitiatorTimedOut = false) {
    const eventId = generateEventId();
    const newEvent = { id: eventId, type: eventType, data };

    sseEvents.push(newEvent);
    if (sseEvents.length > MAX_SSE_EVENTS) sseEvents.shift();

    clients.forEach((client, idx) => {
        const sendData = (client.id === initiatorId && !isInitiatorTimedOut) ? '' : JSON.stringify(data);

        try {
            client.res.write(`event: ${eventType}\n`);
            client.res.write(`data: ${sendData}\n`);
            client.res.write(`id: ${eventId}\n\n`);
        } catch(err) {
            log.error(`Error sending data to client ${client.id}: ${err.message}`);
            clients.splice(idx, 1);
        }
    });
}

function processAudioRoute(req, res, next) {
    const { tracklistId, trackId } = req.params;

    try {
        if (!isValidUUID('tracklist', tracklistId)) throw new Error(`Tracklist ID "${tracklistId}" is not valid`);
        if (trackId && !isValidUUID('track', trackId)) throw new Error(`Track ID "${trackId}" is not valid`);
    } catch(err) {
        return next(createGlobalError({
            error: err,
            details: `Error processing audio root: ${err.message}`,
            statusCode: 400,
            clientMessage: 'Bad request'
        }));
    }

    const { method, path } = req;
    const operationType = getOperationType(method, path);
    
    Object.assign(req, { operationType, tracklistId, trackId });

    next();
}

function getOperationType(method, path) {
    const routes = compiledRoutes[method];
    if (!routes) return undefined;

    const match = routes.find(r => r.regexp.test(path));
    return match ? match.operation : undefined;
}

function processHeaders(req, res, next) {
    try {
        const { operationType, tracklistId, trackId, method } = req;

        // Session ID
        const sessionId = req.headers['x-session-id'];
        if (!sessionId) throw new Error('Update session ID is missing');
        if (!updateSessions[sessionId]) throw new Error('Update session record not found');

        // Operation ID
        const operationId = req.headers['x-operation-id'];
        if (!operationId) throw new Error('Operation ID is missing');

        Object.assign(req, { sessionId, operationId });

        // Session record
        const sessionRecord = updateSessions[sessionId];

        // Session activity
        if (sessionRecord.timedOut) { // Session has timed out during the last file chunk upload
            req.operationStatus = 'timeout';
            req.errorDetails = 'Update session has timed out';
            return handleOperationResponse(req, res, next);
        }

        if (sessionRecord.aborted) { // Session was aborted during the last file chunk upload
            req.operationStatus = 'abort';
            req.errorDetails = 'Update session was aborted';
            return handleOperationResponse(req, res, next);
        }
            
        if (!sessionRecord.active) { // Session has ended
            throw new Error('Attempted to initiate the operation after the session has ended');
        }

        // Tracklist ID matching
        if (sessionRecord.updatesData.tracklistId !== tracklistId) throw new Error('Tracklist ID does not match');

        const isTrackOperation = trackOperations.includes(operationType);
        const isTracklistOperation = tracklistOperations.includes(operationType);

        // Operation ID matching
        const isTrackOpIdMismatch = sessionRecord.operations.assignedIdsMap[trackId] !== operationId;
        const isTracklistOpIdMismatch = sessionRecord.operations.assignedIdsMap[tracklistId] !== operationId;

        if ((isTrackOperation && isTrackOpIdMismatch) || (isTracklistOperation && isTracklistOpIdMismatch)) {
            throw new Error('Operation ID does not match');
        }

        // Operation type matching
        if (isTrackOperation &&
                sessionRecord.updatesData.trackActions.pending[trackId].action !== operationType.replace('Track', '')) {
            throw new Error('Attempted to perform a non-matching operation for pending track');
        }

        if (isTracklistOperation && sessionRecord.hasTracklistOperation) {
            throw new Error('Attempted to perform another tracklist operation in the current update session');
        }

        // Operation state
        if (sessionRecord.operations.states[operationId]) { // Upload next file chunk
            const operationStatus = sessionRecord.operations.states[operationId].status;
            if (!isChunkUploadResultStatus(operationStatus)) throw new Error('Attempted to start a concurrent operation');
        } else { // Register new operation
            sessionRecord.operations.states[operationId] = { operationType, status: 'initial' };
        }

        // File upload
        const isFileUpload = req.isFileUpload = req.headers['x-file-upload'] === 'true';
        if (isFileUpload && method === 'DELETE') throw new Error('The file need not be uploaded for a delete operation');

        // Track file (update)
        if (operationType === 'updateTrack') {
            const shouldUploadFile = sessionRecord.updatesData.trackActions.pending[trackId].isFile;
            
            if (isFileUpload && !shouldUploadFile) {
                throw new Error('Track file does not need to be updated');
            } else if (!isFileUpload && shouldUploadFile) {
                throw new Error('Update track operation requires a track file');
            }
        }

        // Tracklist file (update cover only)
        if (operationType === 'updateTracklist') {
            const updateCoverOnly = req.headers['x-update-cover-only'] === 'true';
            if (updateCoverOnly) req.updateCoverOnly = updateCoverOnly;
        }

        // File upload data
        if (isFileUpload) {
            // File type
            const fileType = req.headers['x-file-type'];
            if (!fileType) throw new Error(`File type is missing`);

            const isValidFileType = operationFileTypes[operationType] === fileType;
            if (!isValidFileType) throw new Error(`Invalid file type`);

            req.fileType = fileType;

            ['x-total-file-size', 'x-total-chunks', 'x-chunk-index'].forEach(key => {
                const value = req.headers[key];
                if (!value) throw new Error(`"${key}" header is missing`);

                const parsedValue = parseNonNegativeInteger(value);
                if (parsedValue === null) throw new Error(`Invalid "${key}" header value (${value})`);
            
                const camelCaseKey = key.slice(2)
                    .split('-')
                    .map((word, idx) => idx > 0 ? word[0].toUpperCase() + word.slice(1) : word)
                    .join('')
                ;
                req[camelCaseKey] = parsedValue;
            });

            const { totalFileSize, totalChunks, chunkIndex } = req;
            const operationState = sessionRecord.operations.states[operationId];

            if (operationState.status === 'initial') {
                if (totalFileSize === 0) throw new Error('File is empty during initialization');
                if (totalChunks === 0) throw new Error('Invalid total chunks during initialization');
                if (chunkIndex !== 0) throw new Error('Invalid chunk index during initialization');

                // File size
                const fileLimit = maxFileSizes[fileType];

                if (totalFileSize > fileLimit) {
                    const error = new Error(`File size (${totalFileSize}) exceeds the limit (${fileLimit})`);
                    error.statusCode = 413;
                    error.clientMessage = 'File size exceeds the limit';
                    throw error;
                }

                operationState.uploadFileData = {
                    initTotalFileSize: totalFileSize,
                    initTotalChunks: totalChunks,
                    lastChunkIndex: chunkIndex
                }
            } else {
                const { initTotalFileSize, initTotalChunks, lastChunkIndex } = operationState.uploadFileData;

                if (totalFileSize !== initTotalFileSize) throw new Error('Invalid total file size');
                if (totalChunks !== initTotalChunks) throw new Error('Invalid total file chunks');
                if (chunkIndex !== lastChunkIndex + 1) throw new Error('Invalid file chunk index');
                
                operationState.uploadFileData.lastChunkIndex = chunkIndex;
            }

            const chunkHash = req.headers['x-chunk-hash'];
            if (!chunkHash) throw new Error('File chunk hash is missing');
            if (!isValidHash(chunkHash)) throw new Error('Invalid file chunk hash');

            req.expectedChunkHash = chunkHash;

            if (chunkIndex === totalChunks - 1) {
                const totalFileHash = req.headers['x-total-file-hash'];
                if (!totalFileHash) throw new Error('Total file hash is missing');
                if (!isValidHash(totalFileHash)) throw new Error('Invalid total file hash');

                req.expectedTotalFileHash = totalFileHash;
            }
        }
    } catch(err) {
        return next(createGlobalError({
            error: err,
            details: `Error processing request headers: ${err.message}`,
            statusCode: err.statusCode || 400,
            clientMessage: err.clientMessage || 'Bad request'
        }));
    }

    next();
}

async function extractAudioData(req, res, next) {
    const { chunkIndex, totalChunks, tracklistId, trackId, operationType } = req;

    // Если загружается файл во время операции, проверять мидлвэар только на первом и последнем чанке
    if (chunkIndex > 0 && chunkIndex < totalChunks - 1) return next();

    try {
        const tracklistData = tracklistsCollection[tracklistId];
        if (!tracklistData) throw new Error('Tracklist data not found');

        const tracklistName = getTracklistName(tracklistData, true);
        const { path: tracklistPath, stats: tracklistStats } = await getAndVerifyPath(audioRoot, tracklistName);
        if (!tracklistPath) throw new Error('Tracklist directory not found');

        Object.assign(req, { tracklistData, tracklistPath, tracklistStats });

        if (trackId) {
            const trackData = tracklistData.tracks.find(trackData => trackData.id === trackId);

            switch (operationType) {
                case 'getTrack':
                    const reqTrackVersion = req.query.v;
                    if (reqTrackVersion === undefined) throw new Error('Requested track version is missing');
                    if (!/^\d+\.\d+$/.test(reqTrackVersion)) throw new Error('Invalid requested track version');

                    const reqFileVersion = reqTrackVersion.split('.')[0];

                    if (!trackData || reqFileVersion !== trackData.version.split('.')[0]) {
                        // Загрузка старой версии трека (если выбранный в плейлисте трек был изменён)
                        const oldTrackPath = getOldTrackFileVersionPath(trackId, reqFileVersion);
    
                        if (oldTrackPath) {
                            const { stats: oldTrackStats } = await getAndVerifyPath(oldTrackPath);
        
                            if (oldTrackStats) {
                                Object.assign(req, {
                                    tracklistPath: path.dirname(oldTrackPath),
                                    trackPath: oldTrackPath,
                                    trackStats: oldTrackStats,
                                    fileVersion: reqFileVersion
                                });
            
                                return next();
                            }
                        }
                    }
                    break;

                case 'createTrack':
                    if (trackData) throw new Error('Track data already exists');
                    return next();
            }

            if (!trackData) throw new Error('Track data not found');

            const trackName = getTrackName(trackData, true);
            const { path: trackPath, stats: trackStats } = await getAndVerifyPath(tracklistPath, trackName);
            if (!trackPath) throw new Error('Track file not found');
    
            Object.assign(req, { trackData, trackPath, trackStats, fileVersion: trackData.version.split('.')[0] });
        }
    } catch(err) {
        return next(createGlobalError({
            error: err,
            details: `Error getting and verifying paths: ${err.message}`,
            statusCode: 404,
            clientMessage: 'Resource not found'
        }));
    }

    next();
}

function verifyResourceLock(req, res, next) {
    const { sessionId, operationId, operationType, tracklistPath, trackPath, updateCoverOnly } = req;

    const operationStatus = updateSessions[sessionId].operations.states[operationId].status;
    if (isChunkUploadResultStatus(operationStatus)) return next();

    const isResourceAvailable = canModifyResource(req);

    if (isResourceAvailable) {
        if (operationType === 'createTrack') {
            incrementNewTrackCreation(tracklistPath);
        } else if (operationType === 'updateTracklist' && updateCoverOnly) {
            lockCoverUpdating(tracklistPath);
        } else {
            lockResource(trackPath || tracklistPath);
        }
    } else {
        req.operationStatus = 'conflict';
        req.errorDetails = 'Operation cancelled: one or more resources are locked';
        return handleOperationResponse(req, res, next);
    }

    next();
}

function canModifyResource(req) {
    const { operationType, tracklistPath, trackPath, updateCoverOnly, tracklistData } = req;

    if (isResourceLocked(tracklistPath)) return false;

    if (['deleteTrack', 'updateTrack'].includes(operationType)) {
        if (isResourceLocked(trackPath)) return false;
    } else if (['deleteTracklist', 'updateTracklist'].includes(operationType)) {
        if (isCoverUpdating(tracklistPath)) return false;

        if (!updateCoverOnly) {
            if (hasActiveNewTrackCreations(tracklistPath)) return false;

            for (const trackData of tracklistData.tracks) {
                const trackName = getTrackName(trackData, true);
                const trackPath = path.join(tracklistPath, trackName);
                if (isResourceLocked(trackPath)) return false;
            }
        }
    }

    return true;
}

function uploadFormData(req, res, next) {
    const multerConfig = multer({
        dest: uploadRoot,
        limits: { fileSize: 64 * 1024 + 1 }, // Ограничение на размер каждого чанка
        fileFilter: function(req, file, cb) {
            const { isFileUpload, body: formFields, fileType } = req;

            if (!isFileUpload) return cb(new Error('File upload attempt detected without proper header value'), false);
            if (!formFields || !Object.keys(formFields).length) return cb(new Error('Form data is incomplete'), false);

            const format = formFields.format;

            if (format && validFileFormats[fileType].includes(format)) {
                cb(null, true);
            } else {
                cb(new Error('Invalid file format'), false);
            }
        }
    });
    const uploadMulterData = multerConfig.single('fileChunk');

    const { sessionId, operationId, chunkIndex, tracklistPath, trackPath } = req;
    const operationState = updateSessions[sessionId].operations.states[operationId];

    operationState.status = 'chunk-uploading';

    // Данные для снятия блокировки с ресурса при ошибке в конфиге multer на первом чанке
    if (chunkIndex === 0) {
        const resourcePath = trackPath || tracklistPath || null; // null возникает при операции createTracklist
        operationState.updateCleanupData = { resourcePath };
    }
    
    uploadMulterData(req, res, (err) => {
        if (err) {
            return next(createGlobalError({
                error: err,
                details: `Error file upload: ${err.message}`,
                statusCode: 400,
                clientMessage: 'Bad request'
            }));
        }

        next();
    });
}

async function processFileChunk(req, res, next) {
    const { sessionId, operationId, chunkIndex, totalChunks, file: chunk, tracklistPath, trackPath, expectedChunkHash,
        expectedTotalFileHash } = req;

    if (!chunk) {
        if (req.isFileUpload) { // Можно проверить только после загрузки чанка файла
            return next(createGlobalError({
                details: 'Track file is missing',
                statusCode: 400,
                clientMessage: 'Bad request'
            }));
        } else {
            return next();
        }
    }

    const operationState = updateSessions[sessionId].operations.states[operationId];
    const assembledFilePath = path.join(uploadRoot, `${operationId}_assembled.tmp`);
    const chunkPath = chunk.path; // Абсолютный путь

    try {
        const chunkHash = await generateServerFileHash(chunkPath);
        if (chunkHash !== expectedChunkHash) throw new Error('File chunk hash does not match');

        if (chunkIndex === 0) {
            const resourcePath = trackPath || tracklistPath || null; // null возникает при операции createTracklist
            operationState.updateCleanupData = { assembledFilePath, resourcePath };
            await fsp.rename(chunkPath, assembledFilePath);
        } else {
            await fsp.access(assembledFilePath);
            const chunkData = await fsp.readFile(chunkPath);
            await fsp.unlink(chunkPath);
            await fsp.appendFile(assembledFilePath, chunkData);
        }
    } catch(err) {
        await deleteExistingFile(chunkPath, 'file chunk');

        req.operationStatus = 'chunk-fail';
        operationState.uploadFileData.lastChunkIndex--;
        
        return next(createGlobalError({
            error: err,
            details: `Error processing file chunk: ${err.message}`,
            statusCode: 503,
            clientMessage: setServerError(err)
        }));
    }

    try {
        const assembledFileStats = await fsp.stat(assembledFilePath);
        const assembledFileSize = assembledFileStats.size;
        const initFileSize = operationState.uploadFileData.initTotalFileSize;
        if (assembledFileSize > initFileSize) {
            throw new Error(`Assembled file size (${assembledFileSize}) exceeds the initial file size (${initFileSize})`);
        }
    } catch(err) {
        return next(createGlobalError({
            error: err,
            details: `Error processing assembled file: ${err.message}`,
            statusCode: 413,
            clientMessage: 'File size exceeds the limit'
        }));
    }

    console.log(`Chunk ${chunkIndex + 1} of ${totalChunks} uploaded`);

    //await new Promise(resolve => setTimeout(resolve, 200)); // Upload throttling

    if (chunkIndex < totalChunks - 1) {
        operationState.status = 'chunk-success';
        res.json({});
    } else {
        try {
            const totalFileHash = await generateServerFileHash(assembledFilePath);
            if (totalFileHash !== expectedTotalFileHash) throw new Error('Total file hash does not match');
        } catch(err) {
            return next(createGlobalError({
                error: err,
                details: `Error processing assembled file hash: ${err.message}`,
                statusCode: 500,
                clientMessage: 'An error occurred during file assembly'
            }));
        }

        delete operationState.updateCleanupData;
        req.uploadFilePath = assembledFilePath;
        next();
    }
}

function handleUnknownRoute(req, res, next) {
    next(createGlobalError({
        details: 'Requested route not found',
        statusCode: 404,
        clientMessage: 'Requested route not found'
    }));
}

/// Operation response ///

function handleOperationResponse(req, res, next) {
    const errorData = {
        error: req.error,
        details: req.errorDetails,
    };
    
    switch (req.operationStatus) {
        case 'conflict':
            next(createGlobalError(Object.assign(errorData, {
                statusCode: 409,
                clientMessage: 'Another operation is already in progress for this resource'
            })));
            break;

        case 'abort':
            next(createGlobalError(Object.assign(errorData, {
                statusCode: 499,
                clientMessage: 'Tracklist update session was aborted by the client'
            })));
            break;

        case 'timeout':
            next(createGlobalError(Object.assign(errorData, {
                statusCode: 408,
                clientMessage: 'Tracklist update session has timed out'
            })));
            break;

        case 'fail':
            next(createGlobalError(Object.assign(errorData, {
                statusCode: 500,
                clientMessage: setServerError()
            })));
            break;

        case 'post-processing':
            sendOperationSuccessResponse(202, req, res);
            break;

        case 'success':
            sendOperationSuccessResponse(200, req, res);
            break;
    }
}

async function handleGlobalError(err, req, res, next) {
    const { details, message, statusCode = 500, clientMessage } = err;
    const errorMessage = clientMessage || setServerError(err);
    const errorDetails = details || message || errorMessage;
    const { method, originalUrl, sessionId, operationId, operationType, operationStatus, tracklistPath, trackPath } = req;
    const isTrackOperation = trackOperations.includes(operationType);
    const isTracklistOperation = tracklistOperations.includes(operationType);
    const resourcePath = (isTrackOperation && trackPath) || (isTracklistOperation && tracklistPath) || 'undefined';
    const requestInfo = `method: ${method}, url: "${originalUrl}", ` +
        `status code: ${statusCode}, client message: "${errorMessage}", ` +
        (operationType ? `operation: "${operationType}", resource path: "${resourcePath}"` : '');
    
    if (errorDetails) log.error({ message: `${errorDetails} (${requestInfo}).`, stack: err.stack || 'No stack' });

    const sessionRecord = sessionId && updateSessions[sessionId];
    const operationState = operationId && sessionRecord?.operations.states[operationId];

    if (operationState) {
        const resource = isTrackOperation ? 'track' : isTracklistOperation ? 'tracklist' : '';
        handleActionResult('rejected', resource, sessionRecord, req);

        operationState.responseData = { statusCode, errorMessage };
        operationState.status = operationStatus || 'fail';

        await cleanupOnUploadFailure(operationState);
    }

    // Ответ клиенту нельзя отправить
    if (
        req.socket.destroyed || req.socket.aborted || req.connectionAborted ||
        res.finished || res.writableEnded || res.destroyed
    ) {
        log.warn(`Cannot send error response, connection issue (${requestInfo}).`);
        return;
    } else if (res.headersSent) {
        log.warn(`Cannot send error response, headers already sent (${requestInfo}).`);
        res.end();
        return;
    }

    // Отправка ответа клиенту
    const isAjaxRequest = req.headers['x-requested-with'] === 'XMLHttpRequest';

    if (isAjaxRequest) {
        res.status(statusCode).json({ errorMessage });
    } else {
        const errorHtmlPath = path.join(pagesRoot, 'error.html');

        fs.readFile(errorHtmlPath, 'utf8', (err, pageContent) => {
            if (err) {
                log.error(`Failed to read "error.html": ${err.message}`);
                res.status(500).send(setServerError(err));
                return;
            }
    
            const updatedPageContent = pageContent
                .replace(/{statusCode}/g, statusCode)
                .replace(/{errorMessage}/g, errorMessage)
            ;
            res.status(statusCode).send(updatedPageContent);
        });
    }
}

function sendOperationSuccessResponse(statusCode, req, res) {
    const { method, originalUrl, sessionId, operationId, operationType, operationStatus, tracklistPath, tracklistData,
        trackPath, trackData } = req;

    const isTrackOperation = trackOperations.includes(operationType);
    const isTracklistOperation = tracklistOperations.includes(operationType);
    const resource = isTrackOperation ? 'track' : isTracklistOperation ? 'tracklist' : '';
    const producedAction = operationType.replace(resource[0].toUpperCase() + resource.slice(1), 'd');
    const resourceName = resource === 'tracklist' ?
        getTracklistName(tracklistData, false) :
        getTrackName(trackData, false)
    ;
    const resourcePath = trackPath || tracklistPath;
    let logInfo = `The ${resource} has been ${producedAction}: "${resourcePath}"`;
    let successMessage = `The ${resource} "${resourceName}" has been successfully ${producedAction}`;

    if (statusCode === 200) {
        logInfo += '.';
        successMessage += '.';
    } else if (statusCode === 202) {
        logInfo += ' (operation in post-process).';
        successMessage += ' (operation in post-process).';
    }

    log.info(logInfo);

    const sessionRecord = updateSessions[sessionId];
    const operationState = sessionRecord.operations.states[operationId];
    const responseData = { statusCode, successMessage };

    handleActionResult('successful', resource, sessionRecord, req);

    operationState.responseData = responseData;
    operationState.status = operationStatus;

    const requestInfo = `method: ${method}, url: ${originalUrl}, message: ${successMessage}, ` + 
        `operation: ${operationType}, resource path: "${resourcePath}"`;

    if (req.connection.destroyed || req.connectionAborted || res.finished) {
        log.warn(`Cannot send success response, connection issue (${requestInfo}).`);
        return;
    }

    if (res.headersSent) {
        log.warn(`Cannot send error response, headers already sent (${requestInfo}).`);
        res.end();
        return;
    }

    res.status(statusCode).json(responseData);
}

function handleActionResult(resultType, resource, sessionRecord, req) {
    const { trackId, operationType, isTrlTitleChanged, isTrlCoverChanged } = req;

    switch (resource) {
        case 'track':
            const trackState = sessionRecord.updatesData.trackActions.pending[trackId];
            sessionRecord.updatesData.trackActions[resultType][trackId] = trackState;
            break;

        case 'tracklist':
            const tracklistResults = sessionRecord.updatesData.tracklistActions[resultType];

            if (operationType === 'deleteTracklist') {
                tracklistResults.push('delete');
            } else {
                if (isTrlTitleChanged) tracklistResults.push('titleChange');
                if (isTrlCoverChanged) tracklistResults.push('coverChange');
            }

            sessionRecord.hasTracklistOperation = true;
            break;

        default:
            log.error(`Resource type "${resource}" is not recognized`);
    }
}

async function cleanupOnUploadFailure(operationState) {
    const { status: operationStatus, updateCleanupData, operationType } = operationState;
    if (isChunkUploadResultStatus(operationStatus)) return;
    if (!updateCleanupData) return;

    const { assembledFilePath, resourcePath } = updateCleanupData;

    if (assembledFilePath) await deleteExistingFile(assembledFilePath, 'assembled file');

    switch (operationType) {
        case 'updateTrack':
            unlockResource(resourcePath);
            break;
        case 'updateTracklist':
            unlockCoverUpdating(resourcePath);
            break;
        case 'createTrack':
            decrementNewTrackCreation(resourcePath);
            break;
        case 'createTracklist':
            break; // resourcePath отсутствует
    }

    delete operationState.updateCleanupData;
}

/// Operations ///

async function deleteTrack(req, res, next) {
    const { sessionId, operationId, operationType, tracklistId, tracklistData, trackData, trackPath } = req;
    const operationData = { operationId, operationType, tracklistId, tracklistData, trackData, trackPath };

    Object.assign(req, await performOperation(sessionId, operationData));
    handleOperationResponse(req, res, next);
}

async function deleteTracklist(req, res, next) {
    const { sessionId, operationId, operationType, tracklistId, tracklistData, tracklistPath } = req;
    const operationData = { operationId, operationType, tracklistId, tracklistData, tracklistPath };

    Object.assign(req, await performOperation(sessionId, operationData));
    handleOperationResponse(req, res, next);
}

async function updateTrack(req, res, next) {
    const { sessionId, operationId, operationType, tracklistId, tracklistData, tracklistPath, trackData, trackPath,
        body: formFields, uploadFilePath: uploadTrackPath } = req;
    const operationData = { operationId, operationType, tracklistId, tracklistData, tracklistPath, trackData,
        trackPath, formFields, uploadTrackPath };

    Object.assign(req, await performOperation(sessionId, operationData));
    handleOperationResponse(req, res, next);
}

async function updateTracklist(req, res, next) {
    const { sessionId, operationId, operationType, tracklistId, tracklistData, tracklistPath, body: formFields,
        uploadFilePath: uploadCoverPath, updateCoverOnly } = req;
    const operationData = { operationId, operationType, tracklistId, tracklistData, tracklistPath, formFields,
        uploadCoverPath, updateCoverOnly };

    Object.assign(req, await performOperation(sessionId, operationData));
    unlockCoverUpdating(tracklistPath);
    handleOperationResponse(req, res, next);
}

async function createTrack(req, res, next) {
    const { sessionId, operationId, operationType, tracklistId, tracklistData, tracklistPath, trackId,
        body: formFields, uploadFilePath: uploadTrackPath } = req;
    const operationData = { operationId, operationType, tracklistId, tracklistData, tracklistPath, trackId,
        formFields, uploadTrackPath };

    Object.assign(req, await performOperation(sessionId, operationData));
    decrementNewTrackCreation(tracklistPath);
    handleOperationResponse(req, res, next);
}

async function createTracklist(req, res, next) {
    const { sessionId, operationId, operationType, tracklistId, body: formFields, uploadFilePath: uploadCoverPath } = req;
    const operationData = { operationId, operationType, tracklistId, formFields, uploadCoverPath };

    Object.assign(req, await performOperation(sessionId, operationData));
    handleOperationResponse(req, res, next);
}

async function performOperation(sessionId, operationData = {}) {
    const { operationId, operationType } = operationData;

    const operationState = updateSessions[sessionId].operations.states[operationId];
    operationState.status = 'in-progress';

    console.log(`+ perform operation: ${operationType}`);

    //await new Promise(resolve => setTimeout(resolve, 5e3));

    switch (operationType) {
        case 'deleteTrack': {
            const { tracklistId, tracklistData, trackData, trackPath } = operationData;
            let error, stage, operationStatus, backupTrackPath;

            try {
                const trackIsDownloading = isTrackDownloading(trackPath);

                if (trackIsDownloading) {
                    scheduleForDeletion(trackPath);
                    setOldTrackFileVersion(trackData.id, trackData.version.split('.')[0], trackPath);
                } else {
                    backupTrackPath = createSuffixedFilePath(trackPath, 'backup');
                    //throw createStageError('copyFile', 'Test Error');
                    await copyFileSafe(sessionId, trackPath, backupTrackPath);
                    //throw createStageError('deleteFile', 'Test Error');
                    await deleteFileSafe(sessionId, trackPath);
                    cleanupResourceState(trackPath);
                }
                
                //throw createStageError('updateCollection', 'Test Error');
                await updateTracklistsCollectionSafe(sessionId, { operationType, tracklistId, tracklistData, trackData });

                stage = 'cleanup';
                operationStatus = trackIsDownloading ? 'post-processing' : 'success';
            } catch(err) {
                error = err;
                stage = err.stage;
                operationStatus = getFailureStatus(err);
            } finally {
                const rollbackSuccessful = await rollbackChanges(operationType, stage,
                    { trackPath, backupTrackPath, trackData });
                if (rollbackSuccessful) unlockResource(trackPath);
            }

            return { operationStatus, ...(error && { error }) };
        }

        case 'deleteTracklist': {
            const { tracklistId, tracklistData, tracklistPath } = operationData;
            let error, stage, operationStatus, coverPath, backupTracklistPath, backupCoverPath;

            if (tracklistData.tracks.length) {
                error = new Error();
                error.details = 'Attempt to delete a tracklist when it contains tracks';
                operationStatus = 'fail';
                unlockResource(tracklistPath);
            } else {
                try {
                    if (tracklistData.cover) {
                        backupTracklistPath = tracklistPath + '_backup';
                        //throw createStageError('createDirectory', 'Test Error');
                        await createDirectorySafe(sessionId, backupTracklistPath);

                        coverPath = path.join(tracklistPath, tracklistData.cover);
                        backupCoverPath = path.join(backupTracklistPath, tracklistData.cover);
                        //throw createStageError('renameFile', 'Test Error');
                        await renameFileSafe(sessionId, coverPath, backupCoverPath);
                    }

                    //throw createStageError('getAllFiles', 'Test Error');
                    const allFilePaths = await getAllFilesSafe(sessionId, tracklistPath);
                    const isAnyTrackDownloading = hasActiveTrackDownloads(allFilePaths);

                    if (isAnyTrackDownloading) {
                        scheduleForDeletion(tracklistPath);
                    } else {
                        //throw createStageError('deleteDirectory', 'Test Error');
                        await deleteDirectorySafe(sessionId, tracklistPath);
                        cleanupResourceState(tracklistPath);
                    }

                    //throw createStageError('updateCollection', 'Test Error');
                    await updateTracklistsCollectionSafe(sessionId, { operationType, tracklistId });

                    stage = 'cleanup';
                    operationStatus = isAnyTrackDownloading ? 'post-processing' : 'success';
                } catch(err) {
                    error = err;
                    stage = err.stage;
                    operationStatus = getFailureStatus(err);
                } finally {
                    const rollbackSuccessful = await rollbackChanges(operationType, stage,
                        { tracklistPath, backupTracklistPath, coverPath, backupCoverPath });
                    if (rollbackSuccessful) unlockResource(tracklistPath);
                }
            }

            return { operationStatus, ...(error && { error }) };
        }

        case 'updateTrack': {
            const { tracklistId, tracklistData, trackData, trackPath, uploadTrackPath } = operationData;
            let error, stage, operationStatus, newTrackData, newTrackPath;

            try {
                //throw createStageError('prepareData', 'Test Error');
                ({ trkData: newTrackData, trkPath: newTrackPath } = await prepareTrackData(sessionId, operationData));

                if (uploadTrackPath) {
                    //throw createStageError('renameFile', 'Test Error');
                    await renameFileSafe(sessionId, uploadTrackPath, newTrackPath);
                } else {
                    //throw createStageError('copyFile', 'Test Error');
                    await copyFileSafe(sessionId, trackPath, newTrackPath);
                }

                //throw createStageError('updateCollection', 'Test Error');
                await updateTracklistsCollectionSafe(sessionId,
                    { operationType, tracklistId, tracklistData, trackData, newTrackData });

                const trackIsDownloading = isTrackDownloading(trackPath);
                if (trackIsDownloading) {
                    scheduleForDeletion(trackPath);
                    setOldTrackFileVersion(trackData.id, trackData.version.split('.')[0], trackPath);
                }

                stage = 'cleanup';
                operationStatus = trackIsDownloading ? 'post-processing' : 'success';
            } catch(err) {
                error = err;
                stage = err.stage;
                operationStatus = getFailureStatus(err);
            } finally {
                const rollbackSuccessful = await rollbackChanges(operationType, stage,
                    { trackPath, uploadTrackPath, newTrackPath });
                if (rollbackSuccessful) unlockResource(trackPath);
            }

            return { operationStatus, ...(error && { error }) };
        }

        case 'updateTracklist': {
            const { tracklistId, tracklistData, tracklistPath, formFields, uploadCoverPath } = operationData;
            const { shouldRemoveCover } = formFields;
            const coverPath = tracklistData.cover ? path.join(tracklistPath, tracklistData.cover) : null;
            let isTrlTitleChanged = false;
            let isTrlCoverChanged = false;
            let error, stage, operationStatus, newTracklistData, newTracklistPath, newCoverPath, backupCoverPath;

            try {
                //throw createStageError('prepareData', 'Test Error');
                ({ trlData: newTracklistData, trlPath: newTracklistPath } = await prepareTracklistData(sessionId,
                    operationData));

                if (uploadCoverPath) {
                    newCoverPath = path.join(tracklistPath, newTracklistData.cover);

                    if (coverPath && await canAccessResource(coverPath)) {
                        backupCoverPath = createSuffixedFilePath(coverPath, 'backup');
                        //throw createStageError('copyFile', 'Test Error');
                        await copyFileSafe(sessionId, coverPath, backupCoverPath);
                        //throw createStageError('deleteFile', 'Test Error');
                        if (newCoverPath !== coverPath) await deleteFileSafe(sessionId, coverPath);
                    }

                    //throw createStageError('renameFile', 'Test Error');
                    await renameFileSafe(sessionId, uploadCoverPath, newCoverPath);

                } else if (shouldRemoveCover && await canAccessResource(coverPath)) {
                    backupCoverPath = createSuffixedFilePath(coverPath, 'backup');
                    //throw createStageError('copyFile', 'Test Error');
                    await copyFileSafe(sessionId, coverPath, backupCoverPath);
                    //throw createStageError('deleteFile', 'Test Error');
                    await deleteFileSafe(sessionId, coverPath);
                }

                if (newTracklistPath !== tracklistPath) {
                    //throw createStageError('getAllFiles', 'Test Error');
                    const allFilePaths = await getAllFilesSafe(sessionId, tracklistPath);
                    const isAnyTrackDownloading = hasActiveTrackDownloads(allFilePaths);

                    if (isAnyTrackDownloading) {
                        //throw createStageError('createDirectory', 'Test Error');
                        await createDirectorySafe(sessionId, newTracklistPath);
                        //throw createStageError('moveFiles', 'Test Error');
                        await moveFilesSafe(sessionId, tracklistPath, newTracklistPath);
                        markForCleanup(tracklistPath, tracklistData);
                    } else {
                        //throw createStageError('renameDirectory', 'Test Error');
                        await renameDirectorySafe(sessionId, tracklistPath, newTracklistPath);
                    }
                }
                
                //throw createStageError('updateCollection', 'Test Error');
                await updateTracklistsCollectionSafe(sessionId, { operationType, tracklistId, newTracklistData });

                if (backupCoverPath && newTracklistPath !== tracklistPath) {
                    backupCoverPath = path.join(newTracklistPath, path.basename(backupCoverPath));
                }

                if (newTracklistPath !== tracklistPath) isTrlTitleChanged = true;
                if (uploadCoverPath || shouldRemoveCover) isTrlCoverChanged = true;

                operationStatus = isMarkedForCleanup(tracklistPath) ? 'post-processing' : 'success';
                stage = 'cleanup';
            } catch(err) {
                error = err;
                stage = err.stage;
                operationStatus = getFailureStatus(err);
            } finally {
                const rollbackSuccessful = await rollbackChanges(operationType, stage,
                    { tracklistPath, newTracklistPath, coverPath, uploadCoverPath, newCoverPath, backupCoverPath });
                if (rollbackSuccessful) unlockResource(tracklistPath);
            }

            return { operationStatus, isTrlTitleChanged, isTrlCoverChanged, ...(error && { error }) };
        }

        case 'createTrack': {
            const { tracklistId, tracklistData, uploadTrackPath } = operationData;
            let error, operationStatus, trackData, trackPath;

            try {
                //throw createStageError('prepareData', 'Test Error');
                ({ trkData: trackData, trkPath: trackPath } = await prepareTrackData(sessionId, operationData));
                
                //throw createStageError('renameFile', 'Test Error');
                await renameFileSafe(sessionId, uploadTrackPath, trackPath);
                //throw createStageError('updateCollection', 'Test Error');
                await updateTracklistsCollectionSafe(sessionId, { operationType, tracklistId, tracklistData, trackData });

                operationStatus = 'success';
            } catch(err) {
                error = err;
                operationStatus = getFailureStatus(err);
                await rollbackChanges(operationType, err.stage, { trackPath, uploadTrackPath });
                return { operationStatus };
            }

            return { operationStatus, trackData, trackPath, ...(error && { error }) };
        }

        case 'createTracklist': {
            const { tracklistId, uploadCoverPath } = operationData;
            let isTrlTitleChanged = false;
            let isTrlCoverChanged = false;
            let error, operationStatus, tracklistData, tracklistPath;

            try {
                //throw createStageError('prepareData', 'Test Error');
                ({ trlData: tracklistData, trlPath: tracklistPath } = await prepareTracklistData(sessionId, operationData));

                //throw createStageError('createDirectory', 'Test Error');
                await createDirectorySafe(sessionId, tracklistPath);

                if (uploadCoverPath) {
                    const coverPath = path.join(tracklistPath, tracklistData.cover);
                    //throw createStageError('renameFile', 'Test Error');
                    await renameFileSafe(sessionId, uploadCoverPath, coverPath);
                }

                //throw createStageError('updateCollection', 'Test Error');
                await updateTracklistsCollectionSafe(sessionId, { operationType, tracklistId, tracklistData });

                isTrlTitleChanged = true;
                if (uploadCoverPath) isTrlCoverChanged = true;

                operationStatus = 'success';
            } catch(err) {
                error = err;
                operationStatus = getFailureStatus(err);
                await rollbackChanges(operationType, err.stage, { tracklistPath, uploadCoverPath });
                return { operationStatus, isTrlTitleChanged, isTrlCoverChanged };
            }

            return { operationStatus, tracklistData, tracklistPath, isTrlTitleChanged, isTrlCoverChanged,
                ...(error && { error }) };
        }
    }
}

async function rollbackChanges(operationType, stage, operationData = {}) {
    console.log(`+ rollback operation: ${operationType}, stage: ${stage}`);

    //await new Promise(resolve => setTimeout(resolve, 5e3));

    try {
        switch (operationType) {
            case 'deleteTrack': {
                const { trackPath, backupTrackPath, trackData } = operationData;
    
                if (stage === 'copyFile') {
                    break;
                } else if (stage === 'deleteFile') {
                    await fsp.unlink(backupTrackPath);
                } else if (stage === 'updateCollection') {
                    if (isScheduledForDeletion(trackPath)) {
                        cancelDeletion(trackPath);
                        removeOldTrackFileVersion(trackData.id, trackData.version.split('.')[0], trackPath)
                    } else {
                        await fsp.rename(backupTrackPath, trackPath);
                    }
                } else if (stage === 'cleanup') {
                    if (backupTrackPath) await fsp.unlink(backupTrackPath);
                }
    
                break;
            }
    
            case 'deleteTracklist': {
                const { tracklistPath, backupTracklistPath, coverPath, backupCoverPath } = operationData;
    
                if (stage === 'createDirectory') {
                    break;
                } else if (stage === 'renameFile') {
                    await fsp.rmdir(backupTracklistPath);
                } else if (stage === 'getAllFiles' || stage === 'deleteDirectory') {
                    if (backupCoverPath) {
                        await fsp.rename(backupCoverPath, coverPath);
                        await fsp.rmdir(backupTracklistPath);
                    }
                } else if (stage === 'updateCollection') {
                    if (isScheduledForDeletion(tracklistPath)) {
                        cancelDeletion(tracklistPath);
                    } else {
                        await fsp.mkdir(tracklistPath, { recursive: true });
                    }
                    if (backupCoverPath) {
                        await fsp.rename(backupCoverPath, coverPath);
                        await fsp.rmdir(backupTracklistPath);
                    }
                } else if (stage === 'cleanup') {
                    if (backupCoverPath) await fsp.rm(backupTracklistPath, { recursive: true, force: true });
                }
    
                break;
            }
    
            case 'updateTrack': {
                const { trackPath, uploadTrackPath, newTrackPath } = operationData;
    
                if (stage === 'prepareData') {
                    if (uploadTrackPath) await fsp.unlink(uploadTrackPath);
                } else if (stage === 'renameFile') {
                    await fsp.unlink(uploadTrackPath);
                } else if (stage === 'copyFile') {
                    break;
                } else if (stage === 'updateCollection') {
                    await fsp.unlink(newTrackPath);
                } else if (stage === 'cleanup') {
                    if (!isScheduledForDeletion(trackPath)) await fsp.unlink(trackPath);
                }
    
                break;
            }
            
            case 'updateTracklist': {
                const { tracklistPath, newTracklistPath, coverPath, uploadCoverPath, newCoverPath, backupCoverPath } =
                    operationData;
    
                if (stage === 'prepareData' || stage === 'copyFile') {
                    if (uploadCoverPath) await fsp.unlink(uploadCoverPath);
                } else if (stage === 'deleteFile') {
                    if (uploadCoverPath) await fsp.unlink(uploadCoverPath);
                    await fsp.unlink(backupCoverPath);
                } else if (stage === 'renameFile') {
                    await fsp.unlink(uploadCoverPath);
                    if (backupCoverPath) await fsp.rename(backupCoverPath, coverPath);
                } else if (stage === 'getAllFiles' || stage === 'createDirectory' || stage === 'renameDirectory') {
                    if (backupCoverPath) await fsp.rename(backupCoverPath, coverPath);
                    if (newCoverPath && newCoverPath !== coverPath) await fsp.unlink(newCoverPath);
                } else if (stage === 'moveFiles') {
                    await rollbackMoveFiles(newTracklistPath, tracklistPath);
                    await fsp.rm(newTracklistPath, { recursive: true, force: true });
                    if (backupCoverPath) await fsp.rename(backupCoverPath, coverPath);
                    if (newCoverPath && newCoverPath !== coverPath) await fsp.unlink(newCoverPath);
                } else if (stage === 'updateCollection') {
                    if (newTracklistPath !== tracklistPath) {
                        if (isMarkedForCleanup(tracklistPath)) {
                            removeMarkForCleanup(tracklistPath);
                            await rollbackMoveFiles(newTracklistPath, tracklistPath);
                            await fsp.rm(newTracklistPath, { recursive: true, force: true });
                        } else {
                            await fsp.rename(newTracklistPath, tracklistPath);
                        }
                    }
                    if (backupCoverPath) await fsp.rename(backupCoverPath, coverPath);
                    if (newCoverPath && newCoverPath !== coverPath) await fsp.unlink(newCoverPath);
                } else if (stage === 'cleanup') {
                    if (backupCoverPath) await fsp.unlink(backupCoverPath);
                    if (isMarkedForCleanup(tracklistPath)) await cleanupUnusedTracklistDirectory(tracklistPath);
                }
    
                break;
            }
    
            case 'createTrack': {
                const { uploadTrackPath, trackPath } = operationData;
    
                if (stage === 'prepareData') {
                    if (uploadTrackPath) await fsp.unlink(uploadTrackPath);
                } else if (stage === 'renameFile') {
                    await fsp.unlink(uploadTrackPath);
                } else if (stage === 'updateCollection') {
                    await fsp.unlink(trackPath);
                }
    
                break;
            }

            case 'createTracklist': {
                const { tracklistPath, uploadCoverPath } = operationData;
    
                if (stage === 'prepareData' || stage === 'createDirectory') {
                    if (uploadCoverPath) await fsp.unlink(uploadCoverPath);
                } else if (stage === 'renameFile') {
                    if (uploadCoverPath) await fsp.unlink(uploadCoverPath);
                    await fsp.rmdir(tracklistPath);
                } else if (stage === 'updateCollection') {
                    await fsp.rm(tracklistPath, { recursive: true, force: true });
                }
    
                break;
            }
        }

        return true;
    } catch(err) {
        log.error({ message: `Rollback error at operation: ${operationType}, stage: ${stage}.`, stack: err.stack });
        return false;
    }
}

async function prepareTrackData(sessionId, operationData = {}) {
    const stage = 'prepareData';

    validateUpdateSession(sessionId, stage);

    const { operationType, tracklistData, tracklistPath, trackId, trackData, trackPath, formFields, uploadTrackPath } =
        operationData;
    const trkData = {};
    let isMetadataUpdated = false;
    
    for (const key in formFields) {
        if (!requiredTrackDataKeys.includes(key)) continue;
        if (key === 'format' && !uploadTrackPath) continue;

        isMetadataUpdated = true;

        const value = formFields[key]; // Все полученные значения полей FormData - строки
        trkData[key] = key === 'order' ? ensureValidTrackOrder(value, operationType, tracklistData.tracks) : value;
    }

    switch (operationType) {
        case 'updateTrack':
            for (const key in trackData) {
                if (trkData[key]) continue;

                const value = trackData[key];

                if (key === 'version') {
                    let [fileVersion, metadataVersion] = value.split('.').map(Number);

                    if (uploadTrackPath) {
                        fileVersion++;
                        metadataVersion = 0;
                    } else if (isMetadataUpdated) {
                        metadataVersion++;
                    }

                    trkData[key] = `${fileVersion}.${metadataVersion}`;
                } else {
                    trkData[key] = value;
                }
            }

            break;

        case 'createTrack':
            const isMissingData = requiredTrackDataKeys.some(key => !trkData.hasOwnProperty(key) || !trkData[key]) ||
                !uploadTrackPath;
        
            if (isMissingData) throw createStageError(stage, 'Not all track data is received');

            trkData.id = trackId;
            trkData.version = '1.0';

            break;
    }

    const trkName = getTrackName(trkData, true);
    const trkPath = path.join(tracklistPath, trkName);

    if (operationType === 'updateTrack' && trkPath === trackPath && !uploadTrackPath) {
        throw createStageError(stage, 'No track data changes detected');
    }

    if (await canAccessResource(trkPath)) {
        throw createStageError(stage, 'The new track path already exists');
    }

    return { trkData, trkPath };
}

function ensureValidTrackOrder(order, operationType, existingTracks) {
    const parsedOrder = parseNonNegativeInteger(order);

    const invalidOrder = parsedOrder === null || parsedOrder < 1 ||
        (operationType === 'createTrack' && existingTracks.some(trkData => trkData.order === parsedOrder));
    if (!invalidOrder) return parsedOrder;

    switch (operationType) {
        case 'updateTrack':
            return trackData.order;
        case 'createTrack':
            const maxOrder = existingTracks.reduce((max, trkData) => Math.max(max, trkData.order), 0);
            return maxOrder + 1;
    }
}

async function prepareTracklistData(sessionId, operationData = {}) {
    const stage = 'prepareData';

    validateUpdateSession(sessionId, stage);

    const { operationType, tracklistId, tracklistData, tracklistPath, formFields, uploadCoverPath, updateCoverOnly } =
        operationData;
    const { tracklistTitle, shouldRemoveCover, format } = formFields;

    if (
        (shouldRemoveCover && shouldRemoveCover !== 'true') ||
        (shouldRemoveCover && uploadCoverPath) ||
        (shouldRemoveCover && !tracklistData.cover) ||
        (operationType === 'createTracklist' && shouldRemoveCover) ||
        (operationType === 'createTracklist' && !tracklistTitle) ||
        (!tracklistTitle && !uploadCoverPath && !shouldRemoveCover) ||
        (!uploadCoverPath && format) ||
        (updateCoverOnly && tracklistTitle) ||
        (updateCoverOnly && !uploadCoverPath && !shouldRemoveCover)
    ) {
        throw createStageError(stage, 'Tracklist form data mismatch');
    }

    const trlData = {};

    if (tracklistTitle) {
        let isTracklistTitleValid;

        try {
            isTracklistTitleValid = await validateTracklistTitle(tracklistData?.tracklistTitle, tracklistTitle);
        } catch(err) {
            throw err;
        }
        
        if (isTracklistTitleValid) {
            trlData.tracklistTitle = tracklistTitle;
        } else {
            throw createStageError(stage, `Tracklist title "${tracklistTitle}" is not valid`);
        }
    }

    if (uploadCoverPath) {
        trlData.cover = `cover.${format}`;
    } else if (operationType === 'createTracklist' || shouldRemoveCover) {
        trlData.cover = '';
    }

    switch (operationType) {
        case 'updateTracklist':
            requiredTracklistDataKeys.forEach(key => {
                if (!trlData.hasOwnProperty(key)) {
                    trlData[key] = key === 'tracks' ? tracklistData.tracks.slice() : tracklistData[key];
                }
            });
            break;
        case 'createTracklist':
            trlData.tracklistId = tracklistId;
            trlData.tracks = [];
            break;
    }

    const trlName = getTracklistName(trlData, true);
    const trlPath = path.join(audioRoot, trlName);

    if (operationType === 'updateTracklist' && trlPath === tracklistPath && !uploadCoverPath && !shouldRemoveCover) {
        throw createStageError(stage, 'No tracklist data changes detected');
    }

    return { trlData, trlPath };
}

async function validateTracklistTitle(origTracklistTitle, newTracklistTitle) {
    const tracklistDirectories = await listDirectoryNames(audioRoot);
    const sanitizedOrigTrlTitle = sanitizePathSegment(origTracklistTitle || '');
    const sanitizedNewTrlTitle = sanitizePathSegment(newTracklistTitle);

    return sanitizedNewTrlTitle !== '' && !tracklistDirectories.some(dirName => {
        return dirName === sanitizedOrigTrlTitle ?
            sanitizedNewTrlTitle === dirName :
            sanitizedNewTrlTitle.toLowerCase() === dirName.toLowerCase()
        ;
    });
}

async function updateTracklistsCollectionSafe(sessionId, operationData = {}) {
    const stage = 'updateCollection';

    while (isTracklistsCollectionLocked) {
        validateUpdateSession(sessionId, stage);
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    validateUpdateSession(sessionId, stage);

    isTracklistsCollectionLocked = true;

    const originalTracklistsCollection = JSON.parse(JSON.stringify(tracklistsCollection));
    const controller = new AbortController();
    const { signal } = controller;
    const timeoutTimer = setTimeout(() => controller.abort(), 5e3); // Таймер блокировки файла треклистов (5 сек)
    const { operationType } = operationData;

    try {
        switch (operationType) {
            case 'deleteTrack': {
                const { tracklistData, trackData } = operationData;
                const trackDataIdx = tracklistData.tracks.indexOf(trackData);
                tracklistData.tracks.splice(trackDataIdx, 1);
                break;
            }

            case 'deleteTracklist': {
                const { tracklistId } = operationData;
                delete tracklistsCollection[tracklistId];
                break;
            }

            case 'updateTrack': {
                const { tracklistData, trackData, newTrackData } = operationData;
                const trackDataIdx = tracklistData.tracks.indexOf(trackData);
                tracklistData.tracks.splice(trackDataIdx, 1, newTrackData);
                if (newTrackData.order !== trackData.order) tracklistData.tracks.sort((a, b) => a.order - b.order);
                break;
            }

            case 'updateTracklist': {
                const { tracklistId, newTracklistData } = operationData;
                tracklistsCollection[tracklistId] = newTracklistData;
                break;
            }

            case 'createTrack': {
                const { tracklistData, trackData } = operationData;
                tracklistData.tracks.push(trackData);
                tracklistData.tracks.sort((a, b) => a.order - b.order);
                break;
            }

            case 'createTracklist': {
                const { tracklistId, tracklistData } = operationData;
                tracklistsCollection[tracklistId] = JSON.parse(JSON.stringify(tracklistData));
                break;
            }
        }

        if (operationType !== 'deleteTracklist') {
            const { tracklistId } = operationData;
            tracklistsCollection[tracklistId].dateUpdated = new Date().toISOString();
        }

        await fsp.writeFile(tracklistsCollectionPath, JSON.stringify(tracklistsCollection, null, 4), { signal });
    } catch(err) {
        tracklistsCollection = originalTracklistsCollection;
        
        err.details = err.name === 'AbortError' ?
            'Too long wait for tracklists collection update' :
            `Failed to update tracklists collection: ${err.message}`
        ;
        err.stage = stage;
        throw err;
    } finally {
        clearTimeout(timeoutTimer);
        isTracklistsCollectionLocked = false;
    }
}

/// Move files in the new directory + rollback ///

async function moveFilesSafe(sessionId, tracklistPath, newTracklistPath) {
    const stage = 'moveFiles';

    validateUpdateSession(sessionId, stage);

    try {
        const fileNames = await fsp.readdir(tracklistPath);
        const filePaths = fileNames.map(fileName => path.join(tracklistPath, fileName));
        const downloadingTrackPaths = [];
        const otherFilePaths = []; // Незагружающиеся файлы треков и кавер-картинки

        validateUpdateSession(sessionId, stage);

        // Разделение файлов на скачивающиеся и остальные
        filePaths.forEach(filePath => {
            if (isTrackDownloading(filePath)) {
                if (isScheduledForDeletion(filePath)) return; // Пропуск ранее назначенных на удаление загружаемых файлов
                downloadingTrackPaths.push(filePath);
            } else {
                otherFilePaths.push(filePath);
            }
        });

        // Параллельное копирование загружающихся файлов в новую директорию
        await Promise.all(downloadingTrackPaths.map(async (filePath) => {
            const newFilePath = path.join(newTracklistPath, path.basename(filePath));
            await fsp.copyFile(filePath, newFilePath);
        }));

        validateUpdateSession(sessionId, stage);

        // Переименование остальных файлов
        for (const filePath of otherFilePaths) {
            validateUpdateSession(sessionId, stage);

            const newFilePath = path.join(newTracklistPath, path.basename(filePath));
            await fsp.rename(filePath, newFilePath);
        }
    } catch(err) {
        err.details = `Error moving the files in the new directory: ${err.message}`;
        err.stage = stage;
        throw err;
    }
}

async function rollbackMoveFiles(newTracklistPath, tracklistPath) {
    let fileNames;

    try {
        fileNames = await fsp.readdir(newTracklistPath);
    } catch(err) {
        throw err;
    }

    if (!fileNames.length) return;
    
    let error;

    await Promise.all(fileNames.map(async (fileName) => {
        const newFilePath = path.join(newTracklistPath, fileName);
        const filePath = path.join(tracklistPath, fileName);
        
        try {
            if (await canAccessResource(filePath)) {
                await fsp.unlink(newFilePath);
            } else {
                await fsp.rename(newFilePath, filePath);
            }
        } catch (err) {
            log.error({ message: `Error processing file "${fileName}".`, stack: err.stack });
            error = err;
        }
    }));

    if (error) throw error;
}

/// Cleanup unused files and directory ///

async function cleanupUnusedTracklistDirectory(tracklistPath) {
    try {
        const fileNames = await fsp.readdir(tracklistPath);
        const filePaths = fileNames.map(fileName => path.join(tracklistPath, fileName));
        const downloadingTrackPaths = new Set(filePaths.filter(isTrackDownloading));
    
        if (downloadingTrackPaths.size) { // Запланировать удаление загружающихся треков и треклиста
            scheduleForDeletion(tracklistPath);

            const { tracklistData } = resourceStates[tracklistPath];
            if (!tracklistData) throw new Error('Tracklist data not found in resourceStates');

            tracklistData.tracks.forEach(trkData => {
                const trackName = getTrackName(trkData, true);
                const trackPath = path.join(tracklistPath, trackName);

                if (downloadingTrackPaths.has(trackPath)) {
                    scheduleForDeletion(trackPath);
                    setOldTrackFileVersion(trkData.id, trkData.version.split('.')[0], trackPath);
                }
            });
        } else { // Удалить папку треклиста со всеми оставшимися файлами
            await fsp.rm(tracklistPath, { recursive: true, force: true });
            cleanupResourceState(tracklistPath);
        }
    } catch(err) {
        throw err;
    }
}

async function cleanupUnusedTrackFile(trackPath, downloadCleanupData) {
    console.log('+ cleanup unused track file: ' + path.basename(trackPath));

    try {
        const { trackId, fileVersion, tracklistPath } = downloadCleanupData;

        await fsp.unlink(trackPath);
        cleanupResourceState(trackPath);
        removeOldTrackFileVersion(trackId, fileVersion, trackPath);

        if (isScheduledForDeletion(tracklistPath)) {
            const allFilePaths = await getAllFilesSafe(null, tracklistPath);
            const isAnyTrackDownloading = hasActiveTrackDownloads(allFilePaths);
            if (isAnyTrackDownloading) return;
            
            console.log('+ cleanup unused tracklist directory: ' + path.basename(tracklistPath));

            await fsp.rm(tracklistPath, { recursive: true, force: true });
            cleanupResourceState(tracklistPath);

            console.log('+ all unused items removed');
        }
    } catch(err) {
        log.error({ message: `Error at operation "cleanupUnusedTrackFile".`, stack: err.stack });
    }
}

/// Resource state ///

function setResourceStates(resourcePath, states) {
    resourceStates[resourcePath] = { ...resourceStates[resourcePath], ...states };
}

function isResourceLocked(resourcePath) {
    return resourceStates[resourcePath]?.locked || false;
}

function lockResource(resourcePath) {
    if (!resourceStates[resourcePath]) resourceStates[resourcePath] = {};
    setResourceStates(resourcePath, { locked: true });
}

function unlockResource(resourcePath) {
    if (!resourceStates[resourcePath]) return;

    setResourceStates(resourcePath, { locked: false });
    auditResourceState(resourcePath);
}

function auditResourceState(resourcePath) {
    if (isResourceLocked(resourcePath)) return; // track/tracklist
    if (isTrackDownloading(resourcePath)) return; // track
    if (isCoverUpdating(resourcePath)) return; // tracklist
    if (hasActiveNewTrackCreations(resourcePath)) return; // tracklist
    if (isScheduledForDeletion(resourcePath)) return; // track/tracklist
    if (isMarkedForCleanup(resourcePath)) return; // tracklist
    
    cleanupResourceState(resourcePath);
}

function cleanupResourceState(resourcePath) {
    delete resourceStates[resourcePath];
}

/// Active track downloads state ///

function incrementActiveDownloads(trackPath) {
    if (!resourceStates[trackPath]?.hasOwnProperty('activeDownloads')) {
        setResourceStates(trackPath, { activeDownloads: 0 });
    }

    resourceStates[trackPath].activeDownloads++;

    console.log(resourceStates);
    console.log(activeOldTrackFileVersions);
}

function decrementActiveDownloads(trackPath, downloadCleanupData) {
    if (!resourceStates[trackPath]?.activeDownloads) return;

    resourceStates[trackPath].activeDownloads--;
    console.log(`${resourceStates[trackPath].activeDownloads} downloads:`, path.basename(trackPath));
    if (isTrackDownloading(trackPath)) return;

    if (isScheduledForDeletion(trackPath)) {
        cleanupUnusedTrackFile(trackPath, downloadCleanupData);
    } else {
        auditResourceState(trackPath);
    }
}

function isTrackDownloading(trackPath) {
    return (resourceStates[trackPath]?.activeDownloads || 0) > 0;
}

function hasActiveTrackDownloads(allFilePaths) {
    return allFilePaths.some(filePath => isTrackDownloading(filePath));
}

/// Cover updating state ///

function lockCoverUpdating(tracklistPath) {
    if (!resourceStates[tracklistPath]) resourceStates[tracklistPath] = {};
    resourceStates[tracklistPath].coverUpdating = true;
}

function unlockCoverUpdating(tracklistPath) {
    if (!resourceStates[tracklistPath]?.coverUpdating) return;

    resourceStates[tracklistPath].coverUpdating = false;
    auditResourceState(tracklistPath);
}

function isCoverUpdating(tracklistPath) {
    return resourceStates[tracklistPath]?.coverUpdating || false;
}

/// New track creation state ///

function incrementNewTrackCreation(tracklistPath) {
    if (!resourceStates[tracklistPath]?.hasOwnProperty('newTrackCreations')) {
        setResourceStates(tracklistPath, { newTrackCreations: 0 });
    }

    resourceStates[tracklistPath].newTrackCreations++;
}

function decrementNewTrackCreation(tracklistPath) {
    if (!resourceStates[tracklistPath]?.newTrackCreations) return;

    resourceStates[tracklistPath].newTrackCreations--;
    auditResourceState(tracklistPath);
}

function hasActiveNewTrackCreations(tracklistPath) {
    return (resourceStates[tracklistPath]?.newTrackCreations || 0) > 0;
}

/// Scheduling for deletion state ///

function scheduleForDeletion(resourcePath) {
    if (!resourceStates[resourcePath]) resourceStates[resourcePath] = {};
    resourceStates[resourcePath].scheduledForDeletion = true;
}

function cancelDeletion(resourcePath) {
    if (!resourceStates[resourcePath]?.scheduledForDeletion) return;

    resourceStates[resourcePath].scheduledForDeletion = false;
    auditResourceState(resourcePath);
}

function isScheduledForDeletion(resourcePath) {
    return resourceStates[resourcePath]?.scheduledForDeletion || false;
}

/// Cleanup required for tracklist ///

function markForCleanup(resourcePath, tracklistData) {
    if (!resourceStates[resourcePath]) resourceStates[resourcePath] = {};
    resourceStates[resourcePath].cleanupRequired = true;
    resourceStates[resourcePath].tracklistData = tracklistData;
}

function removeMarkForCleanup(resourcePath) {
    if (!resourceStates[resourcePath]?.cleanupRequired) return;

    resourceStates[resourcePath].cleanupRequired = false;
    auditResourceState(resourcePath);
}

function isMarkedForCleanup(resourcePath) {
    return resourceStates[resourcePath]?.cleanupRequired || false;
}

/// Old track versions ///

function setOldTrackFileVersion(trackId, fileVersion, trackPath) {
    if (!activeOldTrackFileVersions[trackId]) activeOldTrackFileVersions[trackId] = {};
    activeOldTrackFileVersions[trackId][fileVersion] = trackPath;
}

function removeOldTrackFileVersion(trackId, fileVersion, trackPath) {
    if (!activeOldTrackFileVersions[trackId]) return;

    // Если установлена версия для нового пути, то удаление файла со старого пути удаляет запись о версии.
    // Это возможно при переименовании треклиста, пока скачивается трек, а затем при замене файла этого трека.
    if (activeOldTrackFileVersions[trackId][fileVersion] !== trackPath) return;

    delete activeOldTrackFileVersions[trackId][fileVersion];

    if (!Object.keys(activeOldTrackFileVersions[trackId]).length) {
        delete activeOldTrackFileVersions[trackId];
    }
}

function getOldTrackFileVersionPath(trackId, fileVersion) {
    return activeOldTrackFileVersions[trackId]?.[fileVersion] || null;
}

/// File system ///

async function createDirectorySafe(sessionId, dirPath) {
    const stage = 'createDirectory';
    
    validateUpdateSession(sessionId, stage);

    try {
        await fsp.mkdir(dirPath);
    } catch(err) {
        err.details = `Error creating the directory: ${err.message}`;
        err.stage = stage;
        throw err;
    }
}

async function renameDirectorySafe(sessionId, dirPath, newDirPath) {
    const stage = 'renameDirectory';
    
    validateUpdateSession(sessionId, stage);

    try {
        await fsp.rename(dirPath, newDirPath);
    } catch(err) {
        err.details = `Error renaming the directory: ${err.message}`;
        err.stage = stage;
        throw err;
    }
}

async function deleteDirectorySafe(sessionId, dirPath) {
    const stage = 'renameDirectory';
    
    validateUpdateSession(sessionId, stage);

    try {
        await fsp.rm(dirPath, { recursive: true, force: true });
    } catch(err) {
        err.details = `Error deleting the directory: ${err.message}`;
        err.stage = 'deleteDirectory';
        throw err;
    }
}

async function renameFileSafe(sessionId, filePath, newFilePath) {
    const stage = 'renameFile';
    
    validateUpdateSession(sessionId, stage);

    try {
        await fsp.rename(filePath, newFilePath);
    } catch(err) {
        err.details = `Error renaming the file: ${err.message}`;
        err.stage = stage;
        throw err;
    }
}

async function copyFileSafe(sessionId, filePath, copiedFilePath) {
    const stage = 'copyFile';
    
    validateUpdateSession(sessionId, stage);

    try {
        await fsp.copyFile(filePath, copiedFilePath);
    } catch(err) {
        err.details = `Error copying the file: ${err.message}`;
        err.stage = stage;
        throw err;
    }
}

async function deleteFileSafe(sessionId, filePath) {
    const stage = 'deleteFile';

    validateUpdateSession(sessionId, stage);

    try {
        await fsp.unlink(filePath);
    } catch(err) {
        err.details = `Error deleting the file: ${err.message}`;
        err.stage = stage;
        throw err;
    }
}

async function getAllFilesSafe(sessionId, dirPath) {
    const stage = 'getAllFiles';

    if (sessionId) validateUpdateSession(sessionId, stage);

    try {
        const fileNames = await fsp.readdir(dirPath);
        const filePaths = fileNames.map(fileName => path.join(dirPath, fileName));
        return filePaths;
    } catch(err) {
        err.details = `Error getting the files: ${err.message}`;
        err.stage = stage;
        throw err;
    }
}

async function canAccessResource(resourcePath) {
    try {
        const stats = await fsp.stat(resourcePath);

        if (stats.isDirectory()) {
            await fsp.access(resourcePath, fsp.constants.W_OK | fsp.constants.X_OK); // Права на запись и выполнение
        } else if (stats.isFile()) {
            await fsp.access(resourcePath, fsp.constants.R_OK | fsp.constants.W_OK); // Права на чтение и запись
        }

        return stats;
    } catch {
        return null;
    }
}

async function listDirectoryNames(dirPath) {
    try {
        const items = await fsp.readdir(dirPath, { withFileTypes: true });
        const directories = items
            .filter(item => item.isDirectory())
            .map(item => item.name);
        return directories;
    } catch(err) {
        err.details = `Error reading directory: ${err.message}`;
        err.stage = 'prepareData';
        throw err;
    }
}

async function deleteExistingFile(filePath, fileDescription) {
    if (await canAccessResource(filePath)) {
        try {
            await fsp.unlink(filePath);
        } catch(err) {
            log.error({ message: `Error when deleting ${fileDescription}.`, stack: err.stack });
        }
    }
}

/// Resource path ///

function getTracklistName(tracklistData, sanitize) {
    const tracklistName = tracklistData.tracklistTitle;
    return sanitize ? sanitizePathSegment(tracklistName) : tracklistName;
}

function getTrackName(trackData, sanitize) {
    const { order, artist, title, version, format } = trackData;
    const versionText = sanitize ? ` v${version}` : '';
    const trackName = `${order}. ${artist} - ${title}${versionText}.${format}`;
    return sanitize ? sanitizePathSegment(trackName) : trackName;
}

function sanitizePathSegment(str) {
    return str.trim()
        .replace(/[/\\?%*:|'"<>;\x00-\x1F]/g, '-')
        .replace(/\s+/g, '_')
    ;
}

async function getAndVerifyPath(...pathSegments) {
    if (pathSegments.some(segment => segment === undefined || segment === null)) return {};

    const resourcePath = path.join(...pathSegments);
    const stats = await canAccessResource(resourcePath);
    return stats ? { path: resourcePath, stats } : {};
}

/// Additional functions ///

function generateClientId() {
    return 'client-' + Date.now() + '-' + Math.floor(Math.random() * 1e5);
}

function generateUpdateSessionId() {
    return 'session-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

function generatePrefixedUUID(prefix) {
    const uuid = crypto.randomUUID();
    return `${prefix}-${uuid}`;
}

function generateOperationId() {
    return 'operation-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function generateEventId() {
    return 'event-' + Date.now() + '-' + Math.floor(Math.random() * 1e5);
}

function generateServerFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

function isValidUUID(prefix, id) {
    const uuidRegex = new RegExp(`^${prefix}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`, 'i');
    return uuidRegex.test(id);
}

function isValidHash(hash) {
    return typeof hash === 'string' && hash.length === 64; // Для SHA-256
}

function parseNonNegativeInteger(value) {
    const number = Number(value);
    const isInvalidNumber = Number.isNaN(number) || !Number.isInteger(number) || !Number.isFinite(number) || number < 0;
    return isInvalidNumber ? null : number;
}

function getContentType(trackPath) {
    const mimeType = mimeTypes?.lookup(trackPath);
    if (mimeType) return mimeType;
    
    const extension = path.extname(trackPath).toLowerCase();
    const customType = customMimeTypes[extension];
    if (customType) return customType;
    
    log.warn(`MIME type for ${trackPath} not found. Using default "application/octet-stream".`);
    return 'application/octet-stream';
}

function createSuffixedFilePath(resourcePath, ...suffixes) { // Для файла с расширением
    return suffixes.reduce((acc, suffix) => acc.replace(/(\.[^.]+)$/, `_${suffix}$1`), resourcePath);
}

function setServerError(error) {
    return 'Internal server error' + (error?.code ? `: ${error.code}` : '');
}

function createGlobalError({ error, details, statusCode, clientMessage } = {}) {
    if (!error) error = new Error();
    Object.assign(error, { ...(details && { details }), statusCode, clientMessage });
    return error;
}

function createStageError(stage, details, { abort = false, timeout = false } = {}) {
    const error = abort ? new AbortOperationError() : timeout ? new TimeoutOperationError() : new Error();
    Object.assign(error, { stage, details });
    return error;
}

function validateUpdateSession(sessionId, stage) {
    const sessionRecord = updateSessions[sessionId];

    if (!sessionRecord || sessionRecord.timedOut) {
        throw createStageError(stage, 'Update session has timed out', { timeout: true });
    } else if (sessionRecord.aborted) {
        throw createStageError(stage, 'Update session was aborted', { abort: true });
    } else if (!sessionRecord.active) {
        throw createStageError(stage, 'Update session is inactive');
    }
}

function getFailureStatus(error) {
    return error instanceof AbortOperationError ? 'abort' : error instanceof TimeoutOperationError ? 'timeout' : 'fail';
}

function isTransientStatus(status) {
    return ['initial', 'chunk-uploading', 'in-progress'].includes(status);
}

function isChunkUploadResultStatus(status) {
    return ['chunk-success', 'chunk-fail'].includes(status);
}

function isFinalStatus(status) {
    return ['conflict', 'abort', 'timeout', 'success', 'post-processing', 'fail'].includes(status);
}
