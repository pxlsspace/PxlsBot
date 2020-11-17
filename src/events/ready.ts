import { client } from '../index';
import * as logger from '../logger';
import * as config from '../config';

export const name = 'ready';

/** Executed when the client successfully logs in. */
export async function execute(): Promise<void> {
  logger.info('Logged in as ' + client.user.tag + '.');
  client.user.setPresence(config.get('presence'));
  logger.debug('Presence set to:', config.get('presence'));
}
