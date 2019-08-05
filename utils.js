const fs = require('fs');
const path = require('path');

const { Command } = require('./command');

const logger = require('./logger');

/**
 * Returns a list of event objects from each JavaScript file in the specified
 * directory.
 * @param {string[]} eventsDirectory The event directory.
 * @returns {object[]} The events.
 */
async function getEvents (eventsDirectory) {
  eventsDirectory = path.join(__dirname, eventsDirectory);
  // let files;
  let files = await fs.promises.readdir(eventsDirectory).catch(err => {
    logger.error('Could not read one or more files from ' + eventsDirectory + '.');
    logger.fatal(err);
  });
  files = files.filter(file => file.endsWith('.js'));
  let events = [];
  for (let file of files) {
    file = file.replace('.js', '');
    const pathToFile = path.join(eventsDirectory, file);
    try {
      const required = require(pathToFile);
      if (typeof required.execute === 'function') {
        events.push({
          name: file,
          init: required.init,
          execute: required.execute
        });
      }
    } catch (err) {
      logger.error('Could not require ' + pathToFile + '.');
      logger.fatal(err);
    }
  }
  return events;
}

/**
 * Returns a list of Command instances from each JavaScript file in the
 * specified directory.
 * @param {string} commandsDirectory The command directory.
 * @returns {Command[]} The commands.
 */
async function getCommands (commandsDirectory) {
  commandsDirectory = path.join(__dirname, commandsDirectory);
  let files;
  try {
    files = fs.readdirSync(commandsDirectory);
  } catch (err) {
    logger.error('Could not read one or more files from ' + commandsDirectory + '.');
    logger.fatal(err);
  }
  files = files.filter(file => file.endsWith('.js'));
  let commands = [];
  for (let file of files) {
    const pathToFile = path.join(commandsDirectory, file);
    try {
      const required = require(pathToFile);
      if (required.command instanceof Command) {
        commands.push(required.command);
      }
    } catch (err) {
      logger.error('Could not require ' + pathToFile + '.');
      logger.fatal(err);
    }
  }
  return commands;
}

/**
 * Multiplies the specified numbers.
 * @param {number} x The number to multiply by.
 * @param  {...number} values The numbers to multiply.
 */
function multiplyBy (x, ...values) {
  let multiplied = [];
  values.forEach(value => multiplied.push(value * x));
  return multiplied;
}

/**
 * Clamps the specified number between min and max.
 * @param {number} x The number to clamp.
 * @param {number} min The minimum value.
 * @param {number} max The maximum value.
 */
function clamp (x, min, max) {
  return x < min ? min : x > max ? max : x;
}

class Color {
  /**
   * Create a new Color.
   * Color values must be from 0 to 255.
   * @class
   * @param {number} red The red color value.
   * @param {number} green The green color value.
   * @param {number} blue The blue color value.
   * @param {number} alpha The alpha color value.
   * Defaults to 255 if unspecified.
   */
  constructor (red, green, blue, alpha = 255) {
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;
  }

  /**
   * Returns the color value of x between from and to.
   * @param {number} x The current value, between 0 and 1.
   * @param {Color} min The minimum color.
   * @param {Color} max The maximum color.
   * @returns {Color} The color value.
   */
  static lerp (x, min, max) {
    const rangeR = clamp(min.red + ((max.red - min.red) * x), 0, 255);
    const rangeG = clamp(min.green + ((max.green - min.green) * x), 0, 255);
    const rangeB = clamp(min.blue + ((max.blue - min.blue) * x), 0, 255);
    const rangeA = clamp(min.alpha + ((max.alpha - min.alpha) * x), 0, 255);
    return new Color(rangeR, rangeG, rangeB, rangeA);
  }

  /**
   * Returns the sum of this color and the other color.
   * @param {Color} other The other color.
   * @returns {Color} The summed color.
   * @see {@link add}
   */
  add (other, withAlpha) {
    return Color.add(this, other, withAlpha);
  }

  /**
   * Returns the sum of the first and second color.
   * @param {Color} first The first color.
   * @param {Color} second The second color.
   * @param {number} withAlpha The output alpha.
   * Set this param if summing alpha values is undesired.
   * @returns {Color} The summed color.
   */
  static add (first, second, withAlpha) {
    const red = clamp(first.red + second.red, 0, 255);
    const green = clamp(first.green + second.green, 0, 255);
    const blue = clamp(first.blue + second.blue, 0, 255);
    const alpha = clamp(first.alpha + second.alpha, 0, 255);
    if (typeof withAlpha === 'undefined') {
      return new Color(red, green, blue, alpha);
    }
    return new Color(red, green, blue, withAlpha);
  }

  /**
   * Returns the difference of this color and the other color.
   * @param {Color} other The other color.
   * @returns {Color} The differed color.
   * @see {@link subtract}
   */
  subtract (other, withAlpha) {
    return Color.subtract(this, other, withAlpha);
  }

  /**
  * Returns the difference of the first and second color.
  * @param {Color} first The first color.
  * @param {Color} second The second color.
  * @param {number} withAlpha The output alpha.
  * Set this param if summing alpha values is undesired.
  * @returns {Color} The differed color.
  */
  static subtract (first, second, withAlpha) {
    const red = clamp(first.red - second.red, 0, 255);
    const green = clamp(first.green - second.green, 0, 255);
    const blue = clamp(first.blue - second.blue, 0, 255);
    const alpha = clamp(first.alpha - second.alpha, 0, 255);
    if (!withAlpha) {
      return new Color(red, green, blue);
    }
    return new Color(red, green, blue, alpha);
  }

  /**
   * Returns the color values in an array.
   * @returns {number[]} The color values.
   */
  toArray () {
    return [ this.red, this.green, this.blue, this.alpha ];
  }
}

Color.rainbow = {
  red: new Color(255, 0, 0),
  orange: new Color(255, 127, 0),
  yellow: new Color(255, 255, 0),
  yellowgreen: new Color(127, 255, 0),
  green: new Color(0, 255, 0),
  mint: new Color(0, 255, 127),
  aqua: new Color(0, 255, 255),
  skyblue: new Color(0, 127, 255),
  blue: new Color(0, 0, 255),
  purple: new Color(127, 0, 255),
  magenta: new Color(255, 0, 255),
  hotpink: new Color(255, 0, 127)
};

module.exports = { getEvents, getCommands, multiplyBy, clamp, Color };
