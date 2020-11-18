import * as Discord from 'discord.js';

import { Command } from '../command';

const coordsRegex = /\(?([0-9]+)[., ]{1,2}([0-9]+)[., ]{0,2}([0-9]+)?x?\)?/i;

async function execute(client: Discord.Client, message: Discord.Message) {
  const args = message.content.split(' ').slice(1);
  if (!args.length) return;

  let coords: {
    x: string | number,
    y: string | number,
    scale: string | number
  };
  if (args.length > 1 && validateCoordinates(args[0], args[1], args[2])) {
    coords = {
      x: args[0],
      y: args[1],
      scale: args[2]
    };
  } else if (args[0].includes(',') && args[0].charAt(0) !== '(') { // abort if we have a paranthesis at pos 0 because the message-coordinate.js hook will handle it for us.
    const exec = coordsRegex.exec(args[0]);
    if (exec == null) return;
    if (validateCoordinates(exec[1], exec[2], exec[3])) {
      coords = {
        x: exec[1],
        y: exec[2],
        scale: exec[3]
      };
    }
  }

  if (typeof coords !== 'undefined') {
    await message.channel.send(`<https://pxls.space/#x=${coords.x}&y=${coords.y}&scale=${coords.scale ?? 20}>`);
  }
}

/**
 * Verifies that the given x/y/scale are finite and <= $maximum
 * @param {string|number} x The x component
 * @param {string|number} y The y component
 * @param {string|number} [scale=20] The scale component
 * @param {number} [maximum=1000000] The maximum intval that x/y/scale can be
 * @returns {boolean} Whether or not the arguments are valid
 */
export function validateCoordinates(x: string | number, y: string | number, scale: string | number, maximum = 1000000): boolean {
  if (Number.isNaN(Number(scale))) {
    scale = 20;
  }
  if (typeof x === 'string') {
    x = parseFloat(x);
  }
  if (typeof y === 'string') {
    y = parseFloat(y);
  }

  return (
    (isFinite(x) && isFinite(y) && scale) &&
    x <= maximum &&
    y <= maximum &&
    scale <= maximum
  );
}

export const command = new Command({
  id: 'coordinates',
  name: 'Coordinates',
  category: 'Utility',
  description: 'Prints Pxls coordinates.',
  usage: 'coords (x) (y) [zoom]',
  aliases: ['coords', 'coordinates']
});
command.execute = execute;
