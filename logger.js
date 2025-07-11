const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, 'logs');
require('fs').mkdirSync(logDir, { recursive: true });

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Daily rotate file transport for all logs (including errors)
const dailyRotateTransport = new DailyRotateFile({
  filename: path.join(logDir, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat
});

// Create winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    dailyRotateTransport
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Request logging middleware
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const { method, url, ip, headers } = req;
  const requestId = req.headers['x-request-id'] || generateRequestId();

  // Add request ID to req object for use in other parts of the app
  req.requestId = requestId;

  // Log request start with separator
  logger.info('═══════════════════════════════════════════════════════════🚀 REQUEST STARTED', {
    method,
    url,
    ip,
    userAgent: headers['user-agent'],
    requestId,
    timestamp: new Date().toISOString()
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    const duration = Date.now() - startTime;
    const { statusCode } = res;

    logger.info('✅ REQUEST COMPLETED', {
      method,
      url,
      ip,
      statusCode,
      duration: `${duration}ms`,
      requestId,
      timestamp: new Date().toISOString()
    });
    logger.info('═══════════════════════════════════════════════════════════ REQUEST ENDED 🏁'); // Empty line for better readability
    originalEnd.call(res, chunk, encoding);
  };

  next();
};

// Generate simple request ID
function generateRequestId() {
  return Math.random().toString(36).substr(2, 9);
}

// Export logger and middleware
module.exports = {
  logger,
  requestLogger
};