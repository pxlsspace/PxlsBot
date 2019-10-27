const { Command } = require('../command');

const coordsRegex = /\(?([0-9]+)[., ]{1,2}([0-9]+)[., ]{0,2}([0-9]+)?x?\)?/i;

async function execute (client, message) {
  const args = message.content.split(' ').slice(1);
  let url = false;

  if (!isNaN(args[0]) && !isNaN(args[1])) { // !coords 30 30 28
    url = `https://pxls.space/#x=${args[0]}&y=${args[1]}&scale=${isNaN(args[2]) ? '20' : args[2]}`;
  } else if (args[0].includes(',')) { // !coords (30, 30, 28)
    let exec = coordsRegex.exec(args[0]);
    if (exec && args[0].charAt(0) !== '(') { // abort if we have a paranthesis at pos 0 because the message-coordinate.js hook will handle it for us.
      url = `https://pxls.space/#x=${exec[1]}&y=${exec[2]}&scale=${isNaN(exec[3]) ? '20' : exec[3]}`;
    }
  }

  if (url !== false) {
    return message.channel.send(`<${url}>`);
  } else {
    return Promise.resolve();
  }
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

module.exports = { command };
