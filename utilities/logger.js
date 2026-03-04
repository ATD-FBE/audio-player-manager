const winston = require('winston');
const env = process.env.NODE_ENV || 'development';

exports.log = makeLogger;

function makeLogger(module) {
    let config;

    if (module.filename.match(/server.js$/)) {
        config = {
            level: env === 'development' ? 'info' : 'error',

            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }),
                winston.format.printf(i => `${i.timestamp} ${i.level}: ${i.message}${i.stack ? (' ' + i.stack) : ''}`)
            ),
            
            transports: [
                new winston.transports.File({ filename: '_logs/combined.log' }),
                new winston.transports.File({
                    filename: '_logs/error.log',
                    level: 'error'
                }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        };
    } else {
        config = {
            transports: [
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        };
    }

    return winston.createLogger(config);
}
