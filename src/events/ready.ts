import { client } from '../index';
import * as logger from '../logger';

export const name = 'ready';

/** Executed when the client successfully logs in. */
export function execute(): void {
  logger.info('Logged in as ' + client.user.tag + '.');
}
