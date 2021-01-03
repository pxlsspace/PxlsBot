import * as Discord from 'discord.js';

import { Client } from '../client';
import { Command, Context } from '../command';
import * as config from '../config';

const coordsInsideRegex = /([0-9]+)[., ]{1,2}([0-9]+)[., ]{0,2}([0-9]+)?x?/i;
const coordsFullRegex = new RegExp(`\\(${coordsInsideRegex.source}\\)`, coordsInsideRegex.flags);

async function handleMessage(message: Discord.Message): Promise<void> {
  if (message.author.bot) {
    return;
  }
  const exec = coordsFullRegex.exec(message.content);
  if (exec && validateCoordinates(exec[1], exec[2], exec[3])) {
    await message.channel.send(`<${config.getGameURL()}/#x=${exec[1]}&y=${exec[2]}&scale=${exec[3] ?? '20'}>`);
  }
}

async function execute({ message, argument }: Context) {
  const args = argument.split(' ');
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
  } else if (args[0].includes(',') && args[0].charAt(0) !== '(') { // abort if we have a paranthesis at pos 0 because the event handler above will handle it for us.
    const exec = coordsInsideRegex.exec(args[0]);
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
    await message.channel.send(`<${config.getGameURL()}/#x=${coords.x}&y=${coords.y}&scale=${coords.scale ?? 20}>`);
  }
}

/**
 * Verifies that the given x/y/scale are finite and <= $maximum
 * @param x The x component
 * @param y The y component
 * @param scale The scale component
 * @param maximum The maximum intval that x/y/scale can be
 * @returns Whether or not the arguments are valid
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

export function setup(client: Client): void {
  client.on('message', (...args) => {
    void handleMessage(...args);
  });

  client.registerCommand(command);
}
