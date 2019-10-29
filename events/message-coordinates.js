const { validateCoordinates } = require('../commands/coordinates');
const coordsRegex = /\(([0-9]+)[., ]{1,2}([0-9]+)[., ]{0,2}([0-9]+)?x?\)/i;

/**
 * Executed whenever a message is received over the WebSocket.
 * @param {Discord.Message} message The message.
 */
async function execute (message) {
  if (message.author.bot) {
    return;
  }
  let exec = coordsRegex.exec(message.content);
  if (exec && validateCoordinates(exec[1], exec[2], exec[3])) {
    return message.channel.send(`<https://pxls.space/#x=${exec[1]}&y=${exec[2]}&scale=${isNaN(exec[3]) ? '20' : exec[3]}>`);
  }
}

module.exports = { name: 'message', execute };
