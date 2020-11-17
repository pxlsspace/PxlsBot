import { login } from '../index';
import * as logger from '../logger';
import * as config from '../config';

export const name = 'error';

/**
 * Executed whenever a discord.js WebSocket error occurs.
 * @param {error} err The error.
 */
export function execute(err: Error): void {
  if (err.name === 'ENOTFOUND') {
    logger.error('Lost connection to Discord, will attempt reconnect in 30 seconds...');
    setTimeout(() => {
      void login();
    }, config.get('reconnectTimeout'));
    return;
  }
  logger.error(err);
}
