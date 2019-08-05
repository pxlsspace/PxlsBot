const { client } = require('../index');

const logger = require('../logger');

const config = require('../config');

/** Executed when the client successfully logs in. */
async function execute () {
  logger.info('Logged in as ' + client.user.tag + '.');
  client.user.setPresence(config.presence);
  logger.debug('Presence set to:', config.presence);
}

module.exports = { execute };
