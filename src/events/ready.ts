import { client } from '../index';
import * as logger from '../logger';

const config = require('../../config');

export const name = 'ready';

/** Executed when the client successfully logs in. */
export async function execute () {
  logger.info('Logged in as ' + client.user.tag + '.');
  client.user.setPresence(config.presence);
  logger.debug('Presence set to:', config.presence);
}
