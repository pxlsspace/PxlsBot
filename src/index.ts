import * as Discord from 'discord.js';
export const client = new Discord.Client();

import * as mariadb from 'mariadb';

import * as logger from './logger';
import { getEvents } from './utils';

const config = require('../config');

/**
 * A database connection pool, set during initialization.
 * @property {mariadb.Pool}
 */
let database: mariadb.Pool;

/**
 * Gets the database pool.
 * @returns {mariadb.Pool}
 */
export function getDatabase(): mariadb.Pool {
  return database;
}

/**
 * An array of event objects, set during initialization.
 * @property {object[]} - The events objects.
 */
export let events: {
  name: string,
  init: Function,
  execute: Function
}[];

/** Attempts to log into Discord. */
export async function login() {
  await client.login(config.token).catch(err => {
    logger.error(err);
    exit(1);
  });
}

/** Initializes everything. */
async function main() {
  await logger.initLogs();
  logger.info('PxlsBot 1.0.0');
  if (typeof config.token === 'undefined') {
    logger.fatal('`token` missing in config');
  }
  database = mariadb.createPool(config.database);
  logger.debug('Testing database configuration...');
  try {
    const connection = await database.getConnection();
    await connection.ping();
    await connection.end();
    logger.debug('Database successfully pinged.');
  } catch (err) {
    logger.error(err);
    logger.fatal('Could not initialize database connection.');
  }
  logger.info('Initializing events...');
  events = await getEvents(config.eventsPath);
  for (const event of events) {
    if (typeof event.init !== 'undefined') await event.init();
    client.on(event.name, event.execute);
  }
  logger.info('Logging in...');
  await login();
}

/** Attempts to gracefully exit. */
export async function exit(code = 0) {
  logger.info('Exiting...');
  await client.destroy().catch(() => {
    logger.error('Could not gracefully destroy client.');
  });
  process.exit(code);
}

// Handles CTRL-C
process.on('SIGINT', () => exit());

main();
