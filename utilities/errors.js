class AbortOperationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AbortOperationError';
    }
}

class TimeoutOperationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TimeoutOperationError';
    }
}

module.exports = { AbortOperationError, TimeoutOperationError };
