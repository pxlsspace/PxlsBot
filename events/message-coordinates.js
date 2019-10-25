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
  if (exec) {
    let url = `https://pxls.space/#x=${exec[1]}&y=${exec[2]}`;
    if (!isNaN(exec[3]))
      url += `&scale=${Math.max(0.5,  parseFloat(exec[3]))}`;
    return message.channel.send(`<${url}>`);
  }
}

module.exports = { name: 'message', execute };
