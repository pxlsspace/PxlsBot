import * as fs from 'fs/promises';
import * as path from 'path';

import { Client } from './client';
import * as logger from './logger';
import * as database from './database';
import * as config from './config';

const EXTENSION_BASE_PATH = path.resolve(__dirname, './extensions');

export const client = new Client({
  presence: config.get('presence'),
  partials: ['USER', 'CHANNEL', 'GUILD_MEMBER', 'MESSAGE', 'REACTION']
});

/** Attempts to log into Discord. */
export async function login(): Promise<void> {
  await client.login(config.get('token')).catch(err => {
    logger.error(err);
    return exit(1);
  });
}

async function getAvailableExtensionFilePaths(): Promise<string[]> {
  const paths: string[] = [];
  for (const filename of (await fs.readdir(EXTENSION_BASE_PATH))) {
    if (filename.endsWith('.ts')) {
      paths.push(path.join(EXTENSION_BASE_PATH, filename.replace('.ts', '')));
    }
  }
  return paths;
}

/** Initializes everything. */
async function main() {
  await logger.initLogs();
  logger.info('PxlsBot 1.0.0');
  if (config.get('token') == null) {
    logger.fatal('`token` missing in config');
  }

  client.on('ready', () => {
    logger.info('Logged in as ' + client.user.tag + '.');
  });
  client.on('error', (err) => {
    if (err.name === 'ENOTFOUND') {
      logger.error('Lost connection to Discord, will attempt reconnect in 30 seconds...');
      setTimeout(() => {
        void login();
      }, config.get('reconnectTimeout'));
      return;
    }
    logger.error(err);
  });

  database.init(config.get('database'));
  logger.debug('Testing database configuration...');
  try {
    const connection = await database.getConnection();
    connection.release();
    logger.debug('Database successfully pinged.');
  } catch (err) {
    logger.error(err);
    logger.fatal('Could not initialize database connection.');
  }

  logger.info('Loading extensions...');
  try {
    for (const scriptPath of await getAvailableExtensionFilePaths()) {
      try {
        await client.loadExtension(scriptPath);
      } catch (err) {
        logger.error(`Failed to load extension ${path.basename(scriptPath, '.ts')}`, err);
      }
    }
  } catch (err) {
    logger.error(err);
    logger.fatal('Could not read extensions.');
  }

  logger.info('Logging in...');
  await login();
}

/** Attempts to gracefully exit. */
export async function exit(code = 0): Promise<void> {
  logger.info('Exiting...');
  await database.getPool().end().catch((err) => {
    logger.error('Could not gracefully end database pool.', err);
  });
  await client.destroy().catch((err) => {
    logger.error('Could not gracefully destroy client.', err);
  });
  process.exit(code);
}

// Handles CTRL-C
process.on('SIGINT', () => {
  void exit();
});

void main();
