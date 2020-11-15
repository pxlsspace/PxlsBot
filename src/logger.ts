import * as fs from 'fs';
import * as path from 'path';
import { format } from 'util';

import 'colors';

/**
 * Adds a 0 to the beginning of the number if it's less than 10.
 * @param {number} x The number to pad
 * @returns {string} The padded number.
 */
function pad(x: number): string {
  return x < 10 ? '0' + x : x.toString();
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('../config');

/** Returns the date in YYYY-MM-DD format. */
export function getDate(date: Date = new Date()): string {
  return date.getFullYear() + '-' + pad(date.getMonth()) + '-' + pad(date.getDate());
}

/** Returns the time in hh:mm:ss format. */
export function getTime(date: Date = new Date()): string {
  return pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
}

/** Results the date and time in YYYY-MM-DD hh:mm:ss format. */
export function getDateTime(date: Date = new Date(), addTimezone = false): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return getDate(date) + ' ' + getTime(date) + (addTimezone ? ' ' + timezone : '');
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
export async function initLogs(): Promise<void> {
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
export function log(level: string, ...x: unknown[]): void {
  // If log is called without the level, move the thing being logged over to x
  // and default the level to INFO.
  if (typeof Levels[level.toUpperCase()] === 'undefined') {
    x = (<unknown[]> [level]).concat(x);
    level = 'INFO';
  }
  // Defaults x if nothing specific is logged.
  if (x.length === 0) {
    x = ['<nothing>'.gray];
  }
  const date = getDate();
  // Example: [2019-08-01 14:00:00]
  const dateTime = '[' + date + ' ' + getTime() + ']';
  const minimumLevel: string = config.logging.level;
  const levelKeys = Object.keys(Levels);
  if (levelKeys.indexOf(level) >= levelKeys.indexOf(minimumLevel)) {
    console.info(dateTime.yellow, Levels[level] + ':', ...x);
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
export const debug = (...x: unknown[]): void => log('DEBUG', ...x);
/** Logs at INFO level. */
export const info = (...x: unknown[]): void => log('INFO', ...x);
/** Logs at WARN level. */
export const warn = (...x: unknown[]): void => log('WARN', ...x);
/** Logs at ERROR level. */
export const error = (...x: unknown[]): void => log('ERROR', ...x);
/** Logs at FATAL level and exits ungracefully. */
export const fatal = (...x: unknown[]): void => { log('FATAL', ...x); process.exit(1); };
