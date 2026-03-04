export { shuffle, getScrollbarWidth, generateClientFileHash, debounce, throttle, eventManager };

// Counting clicks
function countClick(i, elem) {
    if ((String(i).at(-1) === '2' || String(i).at(-1) === '3' || String(i).at(-1) === '4') && 
        String(i).at(-2) !== '1') {
            elem.innerHTML = `(Нажато ${i} раза)`;
    } else {
        elem.innerHTML = `(Нажато ${i} раз)`;
    }
}

// Scrollbar width
function getScrollbarWidth() {
    const div = document.createElement('div');
    div.style.position = 'absolute'; // Абсолютное позиционирование
    div.style.top = '-9999px';
    div.style.visibility = 'hidden';
    div.style.overflowY = 'scroll';
    div.style.width = '50px';
    div.style.height = '50px';
    document.body.append(div);
    
    const scrollWidth = div.offsetWidth - div.clientWidth;

    div.remove();

    return scrollWidth;
}

//Shuffle array
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
}

// Random number/integer
function randomNumber(min, max) {
    return min + Math.random() * (max - min);
}

function randomInteger(min, max) {
    const random = min + Math.random() * (max + 1 - min);
    return Math.floor(random);
}

// File extension
function getExtension(filename) {
    return filename.split('.').pop();
}

// Generation string ID
function generateClientId() {
    return 'client-' + Date.now() + '-' + Math.floor(Math.random() * 1e5);
}

function generateOperationId() {
    return 'operation-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function generateRandomId(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// File Hash
async function generateClientFileHash(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
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

// Debouce - Выполняет функцию только раз через заданный интервал времени после других вызовов
function debounce(func, delay) {
    let timeoutId;
    
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function debouncePromise(func, delay) {
    const resolveList = [];
    let promise;
    let timeoutId;
    
    return function(...args) {
        clearTimeout(timeoutId);

        if (!promise) {
            promise = new Promise(resolve => resolveList.push(resolve));
        } else {
            resolveList.push(promise);
        }

        timeoutId = setTimeout(async () => {
            const result = await func.apply(this, args);
            resolveList.forEach(res => res(result));
            resolveList.length = 0;
            promise = null;
        }, delay);

        return promise;
    };
}

// Throttle - Выполняет функцию через заданные интервалы времени, игнорируя остальные вызовы
function throttle(func, limitTime) {
    let timerDelay;
    let lastRanTime;

    return function(...args) {
        const context = this;

        if (!lastRanTime) {
            func.apply(context, args);
            lastRanTime = Date.now();
        } else {
            clearTimeout(timerDelay);

            timerDelay = setTimeout(function() {
                if (Date.now() - lastRanTime >= limitTime) {
                    func.apply(context, args);
                    lastRanTime = Date.now();
                }
            }, limitTime - (Date.now() - lastRanTime));
        }
    };
}

function throttlePromise(func, delay) {
    const resolveList = [];
    let timeoutId;
    
    return function(...args) {
        clearTimeout(timeoutId);

        return new Promise(resolve => {
            resolveList.push(resolve);

            timeoutId = setTimeout(async () => {
                const result = await func.apply(this, args);
                resolveList.forEach(res => res(result));
                resolveList.length = 0;
            }, delay);
        });
    };
}

// Cookie
function getCookie(name) {
    const matches = document.cookie.match(new RegExp(
      "(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + "=([^;]*)"
    ));

    return matches ? decodeURIComponent(matches[1]) : undefined;
}

function setCookie(name, value, options = {}) {
    // Example: setCookie('user', 'John', { secure: true, 'max-age': 3600 });
    options = {
        path: '/',
        ...options
    };

    if (options.expires instanceof Date) {
        options.expires = options.expires.toUTCString();
    }

    let updatedCookie = encodeURIComponent(name) + "=" + encodeURIComponent(value);

    for (let optionKey in options) {
        updatedCookie += "; " + optionKey;
        let optionValue = options[optionKey];
        if (optionValue !== true) {
            updatedCookie += "=" + optionValue;
        }
    }

    document.cookie = updatedCookie;
}

function deleteCookie(name) {
    setCookie(name, "", {
        'max-age': -1
    })
}

// An object for managing the addition and automatic removal of one-time event listeners
const eventManager = {
    eventTypesByElement: new Map(),
    
    addOnceEventListener(element, eventType, handler, uniqueId = '') {
        let handlersByEventType = this.eventTypesByElement.get(element);

        if (!handlersByEventType) {
            handlersByEventType = new Map();
            this.eventTypesByElement.set(element, handlersByEventType);
        }
        
        let handlers = handlersByEventType.get(eventType);

        if (!handlers) {
            handlers = new Map();
            handlersByEventType.set(eventType, handlers);
        }

        const handlerName = handler.name;
        let handlerId = uniqueId ? `${handlerName}_${uniqueId}` : handlerName;
        
        if (!handlers.has(handlerId)) {
            if (!handlerId) { // Auto naming of an anonymous handler
                const sortedAnonHandlerNumbers = Array
                    .from(handlers.keys())
                    .filter(key => key.startsWith('anonHandler'))
                    .map(key => Number(key.match(/anonHandler\[(\d+)\]/)[1]))
                    .sort((a, b) => a - b)
                ;

                const lastAnonHandlerNumber = sortedAnonHandlerNumbers[sortedAnonHandlerNumbers.length - 1] || 0;
                handlerId = `anonHandler[${lastAnonHandlerNumber + 1}]`;
            }

            const handleAndRemove = (function(event) {
                if (element !== window && element !== document && element !== event.target) return;

                handler.call(element, event);
                this.removeOnceEventListener(element, eventType, handlerId);
            }).bind(this);

            handlers.set(handlerId, handleAndRemove);
            
            element.addEventListener(eventType, handleAndRemove);
        }
    },
    
    removeOnceEventListener(element, eventType, handlerName, uniqueId = '') {
        const handlersByEventType = this.eventTypesByElement.get(element);

        if (handlersByEventType) {
            const handlers = handlersByEventType.get(eventType);
            const handlerId = uniqueId ? `${handlerName}_${uniqueId}` : handlerName;
            
            if (handlers && handlers.has(handlerId)) {
                const handler = handlers.get(handlerId);

                element.removeEventListener(eventType, handler);

                handlers.delete(handlerId);
                if (!handlers.size) handlersByEventType.delete(eventType);
                if (!handlersByEventType.size) this.eventTypesByElement.delete(element);
            }
        }
    },

    clearEventHandlers(element, ...eventTypes) {
        const handlersByEventType = this.eventTypesByElement.get(element);
        if (!handlersByEventType) return;
        
        if (eventTypes.length) {
            eventTypes.forEach(eventType => {
                if (handlersByEventType.has(eventType)) {
                    removeEventTypeHandlers(this, handlersByEventType, eventType);
                }
            });
        } else {
            for (const eventType of handlersByEventType.keys()) {
                removeEventTypeHandlers(this, handlersByEventType, eventType);
            }
        }

        function removeEventTypeHandlers(eventManager, handlersByEventType, eventType) {
            const handlers = handlersByEventType.get(eventType);
                    
            for (const handler of handlers.values()) {
                element.removeEventListener(eventType, handler);
            }
            
            handlersByEventType.delete(eventType);
            if (!handlersByEventType.size) eventManager.eventTypesByElement.delete(element);
        }
    }
};
