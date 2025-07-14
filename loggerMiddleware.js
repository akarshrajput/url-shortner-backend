const fs = require("fs");
const path = require("path");

const logFilePath = path.join(__dirname, "logs.txt");

function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;

  fs.appendFile(logFilePath, logEntry, (err) => {
    if (err) {
    }
  });
}

function loggerMiddleware(req, res, next) {
  log(`Request: ${req.method} ${req.originalUrl} from ${req.ip}`);
  res.on("finish", () => {
    log(`Response: ${res.statusCode} for ${req.method} ${req.originalUrl}`);
  });
  next();
}

module.exports = { loggerMiddleware, log };
