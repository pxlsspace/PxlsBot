const { Command } = require('../command');

const coordsRegex = /\(?([0-9]+)[., ]{1,2}([0-9]+)[., ]{0,2}([0-9]+)?x?\)?/i;

async function execute (client, message) {
  const args = message.content.split(' ').slice(1);
  if (!args.length) return Promise.resolve();

  let coords = false;
  if (args.length > 1 && validateCoordinates(args[0], args[1], args[2])) {
    coords = {
      x: args[0],
      y: args[1],
      scale: args[2]
    };
  } else if (args[0].includes(',') && args[0].charAt(0) !== '(') { // abort if we have a paranthesis at pos 0 because the message-coordinate.js hook will handle it for us.
    let exec = coordsRegex.exec(args[0]);
    if (validateCoordinates(exec[1], exec[2], exec[3])) {
      coords = {
        x: exec[1],
        y: exec[2],
        scale: exec[3]
      };
    }
  }

  if (coords === false) return Promise.resolve();
  return message.channel.send(`<https://pxls.space/#x=${coords.x}&y=${coords.y}&scale=${coords.scale != null ? coords.scale : 20}>`);
}

const command = new Command(
  'coordinates',
  'Coordinates',
  'Utility',
  'Prints pxls coordinates',
  'coordinates x y [zoom]',
  [ 'coords' ],
  false,
  0
);
command.execute = execute;

/**
 * Verifies that the given x/y/scale are finite and <= $maximum
 * @param {string|number} x The x component
 * @param {string|number} y The y component
 * @param {string|number} [scale=20] The scale component
 * @param {number} [maximum=1000000] The maximum intval that x/y/scale can be
 * @returns {boolean} Whether or not the arguments are valid
 */
function validateCoordinates (x, y, scale = 20, maximum = 1000000) {
  return ((isFinite(x) && isFinite(y) && isFinite(scale)) && parseFloat(x) <= maximum && parseFloat(y) <= maximum && parseFloat(scale) <= maximum);
}

module.exports = { command, validateCoordinates };
