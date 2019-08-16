const fs = require('fs');
const path = require('path');

const { Command } = require('./command');
const logger = require('./logger');

const config = require('./config');

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

/**
 * Returns whether or not the input snowflake is valid.
 * @param {string} input The snowflake.
 * @returns {boolean}
 */
function isSnowflake (input) {
  return !isNaN(input) && input.length === 18;
}

/**
 * Finds a user, member, role, or channel by the specified input.
 * @param {Discord.Client} client The client.
 * @param {Discord.Message} message The message.
 * @param {string} input The input.
 * @param {string} type The type.
 * @returns {Discord.User | Discord.GuildMember | Discord.Role | Discord.TextChannel | false}
 */
async function find (client, message, input, type) {
  let retVal;
  if (type === 'user') {
    if (isSnowflake(input)) {
      // Attempt to fetch the user by their ID
      retVal = await client.fetchUser(input).catch(false);
    } else {
      // Attempt to find the user by their tag
      retVal = await client.users.find(v => {
        return v.tag.toLowerCase() === input.toLowerCase();
      }).catch(false);
    }
  } else if (type === 'member') {
    if (isSnowflake(input)) {
      // Attempt to fetch the member by their ID
      retVal = await message.guild.fetchMember(input).catch(false);
    } else {
      // Attempt to fetch the member by their display name or username
      retVal = await message.guild.members.find(v => {
        return v.displayName.toLowerCase() === input.toLowerCase();
      }).catch(false);
    }
  } else if (type === 'role') {
    if (isSnowflake(input)) {
      // Attempt to get the role by the ID
      retVal = message.guild.roles.get(input) || false;
    } else {
      // Attempt to get the role by the name
      // The first role with the matching name will be returned
      retVal = message.guild.roles.find(v => {
        return v.name.toLowerCase() === input.toLowerCase();
      }) || false;
    }
  } else if (type === 'channel') {
    if (isSnowflake(input)) {
      // Attempt to get the channel by the ID
      retVal = message.guild.channels.get(input) || false;
    } else {
      // Attempt to get the channel by the name
      retVal = message.guild.channels.find(v => {
        return v.name.toLowerCase() === input.toLowerCase();
      }) || false;
    }
  }
  return retVal;
}

/** Finds a user by the input. */
const findUser = (...x) => find(...x, 'user');
/** Finds a member by the input. */
const findMember = (...x) => find(...x, 'member');
/** Finds a role by the input. */
const findRole = (...x) => find(...x, 'role');
/** Finds a channel by the input. */
const findChannel = (...x) => find(...x, 'channel');

/**
 * Returns the seconds parsed from the input duration string.
 * @param {string | null} input The duration or null if it could not be parsed.
 * @returns {number}
 */
function parseDuration (input) {
  if (!isNaN(input)) {
    // If a plain number is specified, return that in minutes.
    return parseInt(input) * 60;
  }
  const regex = /([\d]+) ?([a-z]+)/;
  const matches = input.match(new RegExp(regex, 'g'));
  if (matches == null) {
    return null;
  }
  let retVal = 0;
  for (let match of matches) {
    const _match = match.match(regex);
    const amount = parseInt(_match[1]);
    const type = _match[2].toLowerCase();
    if (/mo(nth)?s?/.test(type)) {
      retVal += amount * 60 * 60 * 24 * (365 / 12);
    } else if (/w(ee)?k?s?/.test(type)) {
      retVal += amount * 60 * 60 * 24 * 7;
    } else if (/d(ay)?s?/.test(type)) {
      retVal += amount * 60 * 60 * 24;
    } else if (/h(ou)?r?s?/.test(type)) {
      retVal += amount * 60 * 60;
    } else if (/m(in)?(ute)?s?/.test(type)) {
      retVal += amount * 60;
    } else if (/s(ec)?(ond)?s?/.test(type)) {
      retVal += amount;
    }
  }
  return retVal;
}

/**
 * Returns the configured prefix for the guild, or the default one if none.
 * @param {mariadb.Connection} connection The connection.
 * @param {string} guildID The guild ID.
 * @returns {Promise<string>} The prefix.
 */
async function getPrefix (connection, guildID) {
  const results = await connection.query(`
    SELECT
      prefix
    FROM
      config
    WHERE
      guild_id = ?
  `, [
    guildID
  ]);
  await connection.end();
  let prefix = config.prefix;
  if (results.length > 0) {
    prefix = results[0].prefix || prefix;
  }
  return prefix;
}

module.exports = {
  getEvents,
  getCommands,
  multiplyBy,
  clamp,
  Color,
  isSnowflake,
  findUser,
  findMember,
  findRole,
  findChannel,
  parseDuration,
  getPrefix
};
