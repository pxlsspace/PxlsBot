import { login } from '../index';
import * as logger from '../logger';

const config = require('../../config');

export const name = 'error';

/**
 * Executed whenever a discord.js WebSocket error occurs.
 * @param {error} err The error.
 */
export async function execute (err: Error) {
  if (err.name === 'ENOTFOUND') {
    logger.error('Lost connection to Discord, will attempt reconnect in 30 seconds...');
    setTimeout(async () => {
      await login();
    }, config.reconnectTimeout);
    return;
  }
  logger.error(err);
}
