import * as fs from 'fs';
import * as path from 'path';
import * as Discord from 'discord.js';
import * as mariadb from 'mariadb';

import { Command } from './command';
import * as logger from './logger';

const config = require('../config');

/**
 * Returns a list of event objects from each JavaScript file in the specified
 * directory.
 * @param {string} eventsDirectory The event directory.
 * @returns {Promise<{}[]>} The events.
 */
export async function getEvents(eventsDirectory: string): Promise<{
  name: string;
  init: Function;
  execute: Function;
}[]> {
  eventsDirectory = path.join(__dirname, eventsDirectory);
  let files: string[]
  try {
    files = await fs.promises.readdir(eventsDirectory);
  } catch (err) {
    logger.error('Could not read one or more files from ' + eventsDirectory + '.');
    logger.fatal(err);
  }
  files = files.filter(file => file.endsWith('.ts'));
  let events = [];
  for (let file of files) {
    file = file.replace('.ts', '');
    const pathToFile = path.join(eventsDirectory, file);
    try {
      const required = require(pathToFile);
      if (typeof required.execute === 'function') {
        events.push({
          name: required.name || file,
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
 * Returns a list of CommandBuilder instances from each JavaScript file in the
 * specified directory.
 * @param {string} commandsDirectory The command directory.
 * @returns {Promise<CommandBuilder[]>} The commands.
 */
export async function getCommands(commandsDirectory: string): Promise<Command[]> {
  commandsDirectory = path.join(__dirname, commandsDirectory);
  let files;
  try {
    files = fs.readdirSync(commandsDirectory);
  } catch (err) {
    logger.error('Could not read one or more files from ' + commandsDirectory + '.');
    logger.fatal(err);
  }
  files = files.filter(file => file.endsWith('.ts'));
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
 * @return {number[]} The multiplied numbers.
 */
export function multiplyBy(x: number, ...values: number[]): number[] {
  let multiplied: number[] = [];
  values.forEach(value => multiplied.push(value * x));
  return multiplied;
}

/**
 * Clamps the specified number between min and max.
 * @param {number} x The number to clamp.
 * @param {number} min The minimum value.
 * @param {number} max The maximum value.
 * @returns {number} The clamped number.
 */
export function clamp(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x;
}

export class Color {
  public red: number;
  public green: number;
  public blue: number;
  public alpha: number;

  public static rainbow = {
    white: new Color(255, 255, 255),
    gray: new Color(127, 127, 127),
    black: new Color(0, 0, 0),
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
   * Create a new Color.
   * Color values must be from 0 to 255.
   * @class
   * @param {number} red The red color value.
   * @param {number} green The green color value.
   * @param {number} blue The blue color value.
   * @param {number} alpha The alpha color value.
   * Defaults to 255 if unspecified.
   */
  constructor(red: number, green: number, blue: number, alpha: number = 255) {
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;
  }

  /**
   * Parses the input hex color to a Color.
   * @param hex The hex color.
   * @returns {Color} The parsed color.
   */
  static fromHex(hex: string): Color {
    hex = hex.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = parseInt(hex.slice(6, 8), 16) || 255;
    return new Color(r, g, b, a);
  }

  /**
   * Calculates the color value of x between from and to.
   * @param {number} x The current value, between 0 and 1.
   * @param {Color} min The minimum color.
   * @param {Color} max The maximum color.
   * @returns {Color} The color value.
   */
  static lerp(x: number, min: Color, max: Color): Color {
    const rangeR = clamp(min.red + ((max.red - min.red) * x), 0, 255);
    const rangeG = clamp(min.green + ((max.green - min.green) * x), 0, 255);
    const rangeB = clamp(min.blue + ((max.blue - min.blue) * x), 0, 255);
    const rangeA = clamp(min.alpha + ((max.alpha - min.alpha) * x), 0, 255);
    return new Color(rangeR, rangeG, rangeB, rangeA);
  }

  /**
   * Calculates the sum of this color and the other color.
   * @param {Color} other The other color.
   * @param {number?} withAlpha The output alpha.
   * @returns {Color} The summed color.
   * @see {@link add}
   */
  add(other: Color, withAlpha?: number): Color {
    return Color.add(this, other, withAlpha);
  }

  /**
   * Calculates the sum of the first and second color.
   * @param {Color} first The first color.
   * @param {Color} second The second color.
   * @param {number?} withAlpha The output alpha.
   * Set this param if summing alpha values is undesired.
   * @returns {Color} The summed color.
   */
  static add(first: Color, second: Color, withAlpha?: number): Color {
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
   * Calculates the difference of this color and the other color.
   * @param {Color} other The other color.
   * @param {number?} withAlpha The output alpha.
   * @returns {Color} The differed color.
   * @see {@link subtract}
   */
  subtract(other: Color, withAlpha?: number): Color {
    return Color.subtract(this, other, withAlpha);
  }

  /**
  * Calculates the difference of the first and second color.
  * @param {Color} first The first color.
  * @param {Color} second The second color.
  * @param {number?} withAlpha The output alpha.
  * Set this param if summing alpha values is undesired.
  * @returns {Color} The differed color.
  */
  static subtract(first: Color, second: Color, withAlpha?: number): Color {
    const red = clamp(first.red - second.red, 0, 255);
    const green = clamp(first.green - second.green, 0, 255);
    const blue = clamp(first.blue - second.blue, 0, 255);
    const alpha = clamp(first.alpha - second.alpha, 0, 255);
    if (typeof withAlpha === 'undefined') {
      return new Color(red, green, blue);
    }
    return new Color(red, green, blue, alpha);
  }

  /**
   * Returns the color values in an array.
   * @param {boolean} withAlpha Whether to return with the alpha or not.
   * @returns {number[]} The color values.
   */
  toArray(): [ number, number, number, number ] {
      return [ this.red, this.green, this.blue, this.alpha ];
  }

  /**
   * Returns the color values in a Discord.ColorResolvable array.
   * @returns {number[]} The color values.
   */
  toColorResolvable(): [ number, number, number ] {
    return [ this.red, this.green, this.blue ];
  }
}

/**
 * @param {string} input The snowflake.
 * @returns {boolean} Whether the input snowflake is valid or not.
 */
export function isSnowflake(input: string): boolean {
  return !isNaN(Number(input)) && input.length === 18;
}

/**
 * Finds a user, member, role, or channel by the specified input.
 * @param {string} type The type.
 * @param {Discord.Client} client The client.
 * @param {Discord.Message} message The message.
 * @param {string} input The input.
 * @returns {Discord.User | Discord.GuildMember | Discord.Role | Discord.TextChannel | false} The found user, member, role, or channel.
 */
export async function find(type: string, client: Discord.Client, message: Discord.Message, input: string): Promise<Discord.User | Discord.GuildMember | Discord.Role | Discord.TextChannel | false> {
  let retVal;
  if (type === 'user') {
    if (isSnowflake(input)) {
      // Attempt to fetch the user by their ID
      retVal = await client.fetchUser(input).catch(() => false);
    } else {
      // Attempt to find the user by their tag
      retVal = client.users.find(v => {
        return v.tag.toLowerCase() === input.toLowerCase();
      });
    }
  } else if (type === 'member') {
    if (isSnowflake(input)) {
      // Attempt to fetch the member by their ID
      retVal = await message.guild.fetchMember(input).catch(() => false);
    } else {
      // Attempt to fetch the member by their display name or username
      retVal = message.guild.members.find(v => {
        return v.displayName.toLowerCase() === input.toLowerCase();
      });
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
export const findUser = (...x: [Discord.Client, Discord.Message, string]) => find('user', ...x);
/** Finds a member by the input. */
export const findMember = (...x: [Discord.Client, Discord.Message, string]) => find('member', ...x);
/** Finds a role by the input. */
export const findRole = (...x: [Discord.Client, Discord.Message, string]) => find('role', ...x);
/** Finds a channel by the input. */
export const findChannel = (...x: [Discord.Client, Discord.Message, string]) => find('channel', ...x);

/**
 * Returns the configured prefix for the guild, or the default one if none.
 * @param {mariadb.Connection} connection The connection.
 * @param {string} guildID The guild ID.
 * @returns {Promise<string>} The prefix.
 */
export async function getPrefix(connection: mariadb.Connection, guildID: string): Promise<string> {
  let prefix = config.prefix;
  try {
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
    if (results.length > 0) {
      prefix = results[0].prefix || prefix;
    }
    await connection.end();
  } catch (err) {
    logger.error('Error getting prefix.');
    logger.error(err);
  }
  return prefix;
}

/**
 * Truncates the specified text and appends chars to the end, if specified.
 * @param {string} x The text to truncate.
 * @param {number} max The max length of the text.
 * @param {string} chars The characters to append if the length of the text exceeds max.
 * @param {boolean} inward Whether chars should be appended inwards or outwards.
 * @return {string} The truncated text.
 */
export function truncate(x: string, max: number, chars: string, inward: boolean): string {
  let retVal = x;
  if (x.length > max) {
    // If the specified text length is above the maximum
    // append is the chars if it's specified
    const append = typeof chars !== 'undefined' ? chars : '';
    retVal = x.slice(0, max - (inward ? chars.length : 0)) + append;
  }
  return retVal;
}
