import * as Discord from 'discord.js';
import * as pg from 'pg';

import * as logger from './logger';
import { EventObject, getEvents } from './utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('../config');

export const client = new Discord.Client();

/**
 * A database connection pool, set during initialization.
 * @property {pg.Pool}
 */
let database: pg.Pool;

/**
 * Gets the database pool.
 * @returns {pg.Pool}
 */
export function getDatabase(): pg.Pool {
  return database;
}

/**
 * An array of event objects, set during initialization.
 * @property {object[]} - The events objects.
 */
export let events: EventObject[];

/** Attempts to log into Discord. */
export async function login(): Promise<void> {
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
  database = new pg.Pool(config.database);
  logger.debug('Testing database configuration...');
  try {
    const connection = await database.connect();
    await connection.release();
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
export async function exit(code = 0): Promise<void> {
  logger.info('Exiting...');
  await database.end().catch(() => {
    logger.error('Could not gracefully end database pool.');
  });
  try {
    client.destroy();
  } catch (err) {
    logger.error('Could not gracefully destroy client.');
  }
  process.exit(code);
}

// Handles CTRL-C
process.on('SIGINT', () => exit());

main();
