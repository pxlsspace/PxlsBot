import { client } from '../index';
import * as logger from '../logger';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('../../config');

export const name = 'ready';

/** Executed when the client successfully logs in. */
export async function execute(): Promise<void> {
  logger.info('Logged in as ' + client.user.tag + '.');
  client.user.setPresence(config.presence);
  logger.debug('Presence set to:', config.presence);
}
