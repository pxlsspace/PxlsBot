import * as Discord from 'discord.js';

/**
 * Clamps the specified number between min and max.
 * @param x The number to clamp.
 * @param min The minimum value.
 * @param max The maximum value.
 * @returns The clamped number.
 */
export function clamp(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x;
}

/**
 * Shortens a string up to the specified max length, with a string appended at the end.
 * e.g.: ellipsis('abcdefg', 4) => 'abc…'
 * @param str The string to shorten.
 * @param maxLength The maximum length for the shortened string.
 * @param [suffix=…] The string to append at the end in case the input exceeds maxLength.
 * @returns The shortened string.
 */
export function ellipsis(str: string, maxLength: number, suffix = '…'): string {
  return str.length > maxLength ? str.substring(0, maxLength - suffix.length) + suffix : str;
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
   * @param red The red color value.
   * @param green The green color value.
   * @param blue The blue color value.
   * @param alpha The alpha color value.
   * Defaults to 255 if unspecified.
   */
  constructor(red: number, green: number, blue: number, alpha = 255) {
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;
  }

  /**
   * Parses the input hex color to a Color.
   * @param hex The hex color.
   * @returns The parsed color.
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
   * @param x The current value, between 0 and 1.
   * @param min The minimum color.
   * @param max The maximum color.
   * @returns The color value.
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
   * @param other The other color.
   * @param withAlpha The output alpha.
   * @returns The summed color.
   * @see {@link add}
   */
  add(other: Color, withAlpha?: number): Color {
    return Color.add(this, other, withAlpha);
  }

  /**
   * Calculates the sum of the first and second color.
   * @param first The first color.
   * @param second The second color.
   * @param withAlpha The output alpha.
   * Set this param if summing alpha values is undesired.
   * @returns The summed color.
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
   * @param other The other color.
   * @param withAlpha The output alpha.
   * @returns The differed color.
   * @see {@link subtract}
   */
  subtract(other: Color, withAlpha?: number): Color {
    return Color.subtract(this, other, withAlpha);
  }

  /**
  * Calculates the difference of the first and second color.
  * @param first The first color.
  * @param second The second color.
  * @param withAlpha The output alpha.
  * Set this param if summing alpha values is undesired.
  * @returns The differed color.
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
   * @param withAlpha Whether to return with the alpha or not.
   * @returns The color values.
   */
  toArray(): [ number, number, number, number ] {
    return [this.red, this.green, this.blue, this.alpha];
  }

  /**
   * Returns the color values in a Discord.ColorResolvable array.
   * @returns The color values.
   */
  toColorResolvable(): [ number, number, number ] {
    return [this.red, this.green, this.blue];
  }
}

export const USER_MENTION_REGEX = /^<@(?<isNickname>!?)(?<id>\d+)>$/;
export const ROLE_MENTION_REGEX = /^<@&(?<id>\d+)>$/;
export const CHANNEL_MENTION_REGEX = /^<#(?<id>\d+)>$/;

/**
 * @param input The snowflake.
 * @returns Whether the input snowflake is valid or not.
 */
export function isSnowflake(input: string): boolean {
  return !isNaN(Number(input)) && input.length > 0 && input.length <= 20;
}

/**
 * @param input The snowflake or user mention.
 * @returns The extracted snowflake, or null if the input does not represent a user.
 */
export function resolveUserID(input: string): string | null {
  if (isSnowflake(input)) {
    return input;
  }
  const match = USER_MENTION_REGEX.exec(input);
  return match?.groups.id ?? null;
}

/**
 * Finds a user by the input.
 * @param manager The user manager or client that provides a way to find or fetch users.
 * @param input The user-provided input.
 * @returns A promise resolving with the user found, or null if no user was found with the input provided.
 */
export async function findUser(manager: Discord.Client | Discord.UserManager, input: string): Promise<Discord.User | null> {
  if (manager instanceof Discord.Client) {
    manager = manager.users;
  }

  const id = resolveUserID(input);
  return id != null
    // Attempt to fetch by their ID
    ? await manager.fetch(id).catch<null>(() => null)
    // Attempt to fetch by their tag (username#discrim)
    : manager.cache.find((v) => v.tag.toLowerCase() === input.toLowerCase()) ?? null;
}

/**
 * Finds a member by the input.
 * @param manager The guild member manager or guild that provides a way to find or fetch members.
 * @param input The user-provided input.
 * @returns A promise resolving with the member found, or null if no member was found with the input provided.
 */
export async function findMember(manager: Discord.Guild | Discord.GuildMemberManager, input: string): Promise<Discord.GuildMember | null> {
  if (manager instanceof Discord.Guild) {
    manager = manager.members;
  }

  const id = resolveUserID(input);
  return id != null
    // Attempt to fetch by their ID
    ? await manager.fetch(id).catch<null>(() => null)
    // Attempt to fetch by their display name (nickname, if they have one, or username)
    : manager.cache.find(v => v.displayName.toLowerCase() === input.toLowerCase());
}

/**
 * @param input The snowflake or role mention.
 * @returns The extracted snowflake, or null if the input does not represent a role.
 */
export function resolveRoleID(input: string): string | null {
  if (isSnowflake(input)) {
    return input;
  }
  const match = ROLE_MENTION_REGEX.exec(input);
  return match?.groups.id ?? null;
}

/**
 * Finds a role by the input.
 * @param manager The role manager or guild that provides a way to find or fetch roles.
 * @param input The user-provided input.
 * @returns A promise resolving with the role found, or null if no role was found with the input provided.
 */
export async function findRole(manager: Discord.Guild | Discord.RoleManager, input: string): Promise<Discord.Role | null> {
  if (manager instanceof Discord.Guild) {
    manager = manager.roles;
  }

  const id = resolveRoleID(input);
  return id != null
    // Attempt to fetch by its ID
    ? await manager.fetch(id).catch<null>(() => null)
    // Attempt to fetch by its name
    : manager.cache.find(v => v.name.toLowerCase() === input.toLowerCase()) ?? null;
}

/**
 * @param input The snowflake or channel mention.
 * @returns The extracted snowflake, or null if the input does not represent a channel.
 */
export function resolveChannelID(input: string): string | null {
  if (isSnowflake(input)) {
    return input;
  }
  const match = CHANNEL_MENTION_REGEX.exec(input);
  return match?.groups.id ?? null;
}

/**
 * Finds a channel by the input.
 * @param manager The guild channel manager or guild that provides a way to find or fetch guild channels.
 * @param input The user-provided input.
 * @returns The guild channel found, or null if no guild channel was found with the input provided.
 */
export function findGuildChannel(manager: Discord.Guild | Discord.GuildChannelManager, input: string): Discord.GuildChannel | null {
  if (manager instanceof Discord.Guild) {
    manager = manager.channels;
  }

  const id = resolveChannelID(input);
  return (id != null
    // Attempt to fetch by its ID
    ? manager.cache.get(id)
    // Attempt to fetch by its name
    : manager.cache.find(v => v.name.toLowerCase() === input.toLowerCase())
  ) ?? null;
}

/**
 * Truncates the specified text and appends chars to the end, if specified.
 * @param x The text to truncate.
 * @param max The max length of the text.
 * @param chars The characters to append if the length of the text exceeds max.
 * @param inward Whether chars should be appended inwards or outwards.
 * @return The truncated text.
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

/**
 * Splits text into chunks separated by a separator, up to n times.
 *
 * This is similar to s.split(sep, n), but if the text doesn't contain
 * enough of the separator the rest of the string will be the last element
 * of the result.
 * @param s The text to split.
 * @param sep The separator.
 * @param n The amount of times to split.
 * @return An array of 1 to n chunks from the original text.
 */
export function splitN(s: string, sep: string, n: number): string[] {
  const acc: string[] = [];
  let left = s;
  for (let i = 0; i < n; i++) {
    const next = left.indexOf(sep);
    if (next === -1) {
      acc.push(left);
      break;
    }

    acc.push(left.substring(0, next));
    left = left.substr(next + 1);
  }
  acc.push(left);
  return acc;
}

function errorWithReadOnly(): never {
  throw new Error('object is read-only');
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function readOnlyViewOf<T extends object>(obj: T): T {
  return new Proxy(obj, {
    defineProperty: errorWithReadOnly,
    deleteProperty: errorWithReadOnly,
    setPrototypeOf: errorWithReadOnly,
    set: errorWithReadOnly
  });
}
