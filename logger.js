const fs = require('fs');
const path = require('path');
const { format } = require('util');

require('colors');

const pad = x => x < 10 ? '0' + x : x;

const config = require('./config');

/** Returns the date in YYYY-MM-DD format. */
function getDate () {
  const now = new Date();
  return now.getFullYear() + '-' + pad(now.getMonth()) + '-' + pad(now.getDate());
}

/** Returns the time in hh:mm:ss format. */
function getTime () {
  const now = new Date();
  return pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
}

/** Absolute path to the logs directory. */
const logsPath = path.join(__dirname, 'logs');

/**
 * Whether or not logs can be saved to a file.
 *
 * This is set to false if the script cannot write to the log file.
 */
let canLogToFile = true;

/** Sets canLogToFile to false and logs an error indicating such. */
const cannotSaveToFile = () => {
  canLogToFile = false;
  const date = getDate();
  error('Could not save logs to ' + path.join(logsPath, date + '.log' + '.'));
  error('This error will only occur once during this script\'s lifetime.');
};

/**
 * Creates the 'logs' directory if it doesn't already exist.
 *
 * If config.logging.saveToFile is true, logs will be saved to the file system
 * at ./logs/{YYYY-MM-DD}.log.
 */
async function initLogs () {
  if (!config.logging.saveToFile) {
    return;
  }
  try {
    fs.mkdirSync(logsPath);
  } catch (err) {
    if (err.code !== 'EEXIST') {
      cannotSaveToFile();
      fatal(err);
    }
  }
}

/** Represents the colorized log levels. */
const Levels = Object.freeze({
  DEBUG: 'DEBUG'.bgBlue,
  INFO: 'INFO'.cyan,
  WARN: 'WARN'.bgYellow.white,
  ERROR: 'ERROR'.red,
  FATAL: 'FATAL'.bgRed.white
});

/**
 * Logs to the console, and if configured, a log file.
 * @param {string} level The logging level.
 * @param {...any} x The content to log.
 */
function log (level, ...x) {
  // If log is called without the level, move the thing being logged over to x
  // and default the level to INFO.
  if (typeof Levels[level.toUpperCase()] === 'undefined') {
    x = [level].concat(x);
    level = 'INFO';
  }
  // Defaults x if nothing specific is logged.
  if (x.length === 0) {
    x = ['<nothing>'.gray];
  }
  const date = getDate();
  // Example: [2019-08-01 14:00:00]
  const dateTime = '[' + date + ' ' + getTime() + ']';
  const minimumLevel = config.logging.level;
  const levelKeys = Object.keys(Levels);
  if (levelKeys.indexOf(level) >= levelKeys.indexOf(minimumLevel)) {
    console.log(dateTime.yellow, Levels[level] + ':', ...x);
  }
  if (!canLogToFile) {
    return;
  }
  const pathToLogFile = path.join(logsPath, date + '.log');
  const formatted = format(dateTime, level + ':', ...x) + '\n';
  try {
    fs.appendFileSync(pathToLogFile, formatted);
  } catch (err) {
    cannotSaveToFile();
    error(err);
  }
}

/** Logs at DEBUG level. */
const debug = (...x) => log('DEBUG', ...x);
/** Logs at INFO level. */
const info = (...x) => log('INFO', ...x);
/** Logs at WARN level. */
const warn = (...x) => log('WARN', ...x);
/** Logs at ERROR level. */
const error = (...x) => log('ERROR', ...x);
/** Logs at FATAL level and exits ungracefully. */
const fatal = (...x) => { log('FATAL', ...x); process.exit(1); };

module.exports = { initLogs, log, debug, info, warn, error, fatal };
