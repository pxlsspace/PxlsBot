const { login } = require('../index');
const logger = require('../logger');

const config = require('../config');

/**
 * Executed whenever a discord.js WebSocket error occurs.
 * @param {error} err The error.
 */
async function execute (err) {
  if (err.code === 'ENOTFOUND') {
    logger.error('Lost connection to Discord, will attempt reconnect in 30 seconds...');
    setTimeout(async () => {
      await login();
    }, config.reconnectTimeout);
    return;
  }
  logger.error(err);
}

module.exports = { execute };
