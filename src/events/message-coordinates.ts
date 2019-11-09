import * as Discord from 'discord.js';

import { validateCoordinates } from '../commands/coordinates';
const coordsRegex = /\(([0-9]+)[., ]{1,2}([0-9]+)[., ]{0,2}([0-9]+)?x?\)/i;

export const name = 'message';

/**
 * Executed whenever a message is received over the WebSocket.
 * @param {Discord.Message} message The message.
 */
export async function execute (message: Discord.Message) {
  if (message.author.bot) {
    return;
  }
  let exec = coordsRegex.exec(message.content);
  if (exec && validateCoordinates(exec[1], exec[2], exec[3])) {
    return message.channel.send(`<https://pxls.space/#x=${exec[1]}&y=${exec[2]}&scale=${exec[3] ?? '20'}>`);
  }
}
