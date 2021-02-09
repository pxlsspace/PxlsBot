import * as Discord from 'discord.js';
import * as pg from 'pg';

import { Client } from '../client';
import * as database from '../database';
import { Command, Context } from '../command';
import * as logger from '../logger';
import { Color, findGuildChannel } from '../utils';
import * as config from '../config';

import { insertAuditLog } from './auditlog';

export type ConfigValueDefinition<DBObjectType, JSObjectType> = {
  dbType: string,
  default?: JSObjectType,
  stringToDatabase: (guild: Discord.Guild, value: string) => DBObjectType | Promise<DBObjectType>,
  databaseToObject: (guild: Discord.Guild, value: DBObjectType) => JSObjectType | Promise<JSObjectType>,
  objectToString?: (value: JSObjectType) => string | Promise<string>
}

const columns = {
  /* eslint-disable quote-props */
  'prefix': {
    dbType: 'TEXT',
    get default() {
      return config.get('prefix');
    },
    stringToDatabase: (_guild, value) => value,
    databaseToObject: (_guild, value) => value
  } as ConfigValueDefinition<string, string>,
  'starboard_channel': {
    dbType: 'VARCHAR(20)',
    stringToDatabase: (guild, value) => {
      if (value.toLowerCase() === 'none') {
        return null;
      }

      const channel: Discord.GuildChannel = findGuildChannel(guild, value);
      if (channel == null) {
        throw new Error('channel not found');
      }
      if (!channel.isText()) {
        throw new Error('channel must be a text channel');
      }
      return channel.id;
    },
    databaseToObject: (guild, value) => {
      return guild.channels.resolve(value) as Discord.TextChannel;
    },
    objectToString: (value) => `#${value.name}`
  } as ConfigValueDefinition<string, Discord.TextChannel>,
  'starboard_threshold': {
    dbType: 'SMALLINT',
    default: 4,
    stringToDatabase: (_guild, value) => {
      const val = parseInt(value, 10);
      if (isNaN(val)) {
        throw new Error('not a number');
      }
      if (val <= 1) {
        throw new Error('threshold is too small');
      }
      if (val > 32767) { // SMALLINT max value
        throw new Error('threshold is too big');
      }
      return val;
    },
    databaseToObject: (_guild, value) => value
  } as ConfigValueDefinition<number, number>
  /* eslint-enable quote-props */
} as const;

type ColumnDBObjectType<CN extends keyof typeof columns> =
  typeof columns[CN] extends ConfigValueDefinition<infer T, unknown> ? T : never;
type ColumnJSObjectType<CN extends keyof typeof columns> =
  typeof columns[CN] extends ConfigValueDefinition<unknown, infer T> ? T : never;
type ConfigValueDefinitionOfColumn<CN extends keyof typeof columns> =
  ConfigValueDefinition<ColumnDBObjectType<CN>, ColumnJSObjectType<CN>>;

export type DatabaseGuildConfig = {
  // eslint-disable-next-line camelcase
  guild_id: string
} & {
  [CN in keyof typeof columns]: ColumnDBObjectType<CN>
}

/**
 * Returns the value of a config column for the guild.
 * @param connection The connection.
 * @param client The Discord Client.
 * @param guildID The guild ID.
 * @returns The config value, or undefined if the guild has not setup config and no default is set.
 */
export async function get<CN extends keyof typeof columns>(
  connection: pg.PoolClient,
  client: Client,
  guildID: string,
  columnName: CN
): Promise<ColumnJSObjectType<CN> | undefined> {
  type DBObjectType = ColumnDBObjectType<CN>;
  type JSObjectType = ColumnJSObjectType<CN>;
  const columnDefinition = columns[columnName] as ConfigValueDefinitionOfColumn<typeof columnName>;
  let result: JSObjectType | undefined = columnDefinition.default;
  try {
    const { rows } = await connection.query(`
      SELECT
        ${columnName}
      FROM
        config
      WHERE
        guild_id = $1
    `, [
      guildID
    ]);
    if (rows.length > 0) {
      const dbValue = (rows[0] as DatabaseGuildConfig)[columnName] as DBObjectType;
      const jsValue = await columnDefinition.databaseToObject(client.guilds.resolve(guildID), dbValue);
      result = jsValue ?? columnDefinition.default ?? null;
    }
  } catch (err) {
    logger.error(`Error getting ${columnName} config value for guild ${guildID}.`);
    logger.error(err);
  }
  return result;
}

/**
 * Returns the configured prefix for the guild, or the default one if none.
 * @param connection The connection.
 * @param client The Discord Client.
 * @param guildID The guild ID.
 * @returns The prefix.
 */
export const getPrefix = (
  connection: pg.PoolClient,
  client: Client,
  guildID: string
): Promise<string> => get(connection, client, guildID, 'prefix');

async function safeObjectToString<JSObjectType>(
  columnDefinition: ConfigValueDefinition<unknown, JSObjectType>,
  value: JSObjectType
) {
  return value != null
    ? await columnDefinition.objectToString?.(value) ?? String(value)
    : '<unset>';
}

async function formatColumn(
  columnName: keyof typeof columns,
  value: ColumnJSObjectType<typeof columnName>
) {
  const columnDefinition: ConfigValueDefinitionOfColumn<typeof columnName> = columns[columnName];
  return `${columnName} : ${await safeObjectToString(columnDefinition, value)}`;
}

async function execute({ client, message }: Context): Promise<void> {
  const args = message.content.split(' ');
  const embed = new Discord.MessageEmbed({
    color: Color.rainbow.skyblue.toColorResolvable()
  });
  await database.withConnection(async (connection) => {
    try {
      // Create default configuration if it doesn't exist.
      const { rowCount } = await connection.query(`
        INSERT INTO
          config
          (guild_id)
        VALUES
          ($1)
        ON CONFLICT DO NOTHING
      `, [
        message.guild.id
      ]);
      if (rowCount > 0) {
        await message.channel.send('Default configuration has been generated.');
      }
    } catch (err) {
      logger.error(err);
      await message.channel.send('Could not create config entry. Details have been logged.');
      return;
    }

    if (args.length < 2) {
      // (prefix)config
      try {
        const { rows } = await connection.query(`
          SELECT
            *
          FROM
            config
          WHERE
            guild_id = $1
        `, [
          message.guild.id
        ]);
        if (rows.length === 0) {
          await message.channel.send('No configurations were found for the guild. Try running this command again.');
          return;
        }
        const guildConfig = rows[0] as DatabaseGuildConfig;
        const formattedColumnPromises = Object.keys(guildConfig)
          .filter((key) => Object.keys(columns).includes(key))
          .map(async (key) => {
            const columnName = key as keyof typeof columns;
            const dbValue = guildConfig[columnName];
            const columnDefinition: ConfigValueDefinitionOfColumn<typeof columnName> = columns[columnName];
            const value = await columnDefinition.databaseToObject(message.guild, dbValue);
            return await formatColumn(columnName, value ?? columnDefinition.default);
          });
        embed.setDescription((await Promise.all(formattedColumnPromises)).join('\n'));
        await message.channel.send(embed);
        return;
      } catch (err) {
        logger.error(err);
        await message.channel.send('Could not get config. Details have been logged.');
        return;
      }
    }
    const action = args[1].toLowerCase();
    if (action === 'get') {
      if (args.length < 3) {
        await message.channel.send('You must specify a config key.');
        return;
      }
      const columnName = args[2].toLowerCase() as keyof typeof columns;
      if (!Object.keys(columns).includes(columnName)) {
        await message.channel.send('The specified config key is not on the column whitelist.');
        return;
      }
      type JSObjectType = ColumnJSObjectType<typeof columnName>;
      try {
        const value: JSObjectType = await get(connection, client, message.guild.id, columnName);
        if (typeof value === 'undefined') {
          const prefix = await getPrefix(connection, client, message.guild.id);
          await message.channel.send(`No configurations were found for the guild. Try creating one with \`${prefix}config create\`.`);
          return;
        }
        embed.setDescription(await formatColumn(columnName, value));
        await message.channel.send(embed);
        return;
      } catch (err) {
        logger.error(err);
        await message.channel.send('Could not get config key. Details have been logged.');
      }
    } else if (action === 'set') {
      if (args.length < 3) {
        await message.channel.send('You must specify a config key.');
        return;
      }
      const columnName = args[2].toLowerCase() as keyof typeof columns;
      if (!Object.keys(columns).includes(columnName)) {
        await message.channel.send('The specified config key is not on the column whitelist.');
        return;
      }
      if (args.length < 4) {
        await message.channel.send('You must specify a value.');
        return;
      }
      const columnDefinition: ConfigValueDefinitionOfColumn<typeof columnName> = columns[columnName];
      let valDatabaseObj: ColumnDBObjectType<typeof columnName>;
      try {
        valDatabaseObj = await columnDefinition.stringToDatabase(message.guild, args[3]);
      } catch (err) {
        await message.channel.send(`The specified value is invalid: ${err instanceof Error ? err.message : '<unknown error>'}.`);
        return;
      }

      try {
        await insertAuditLog(connection, message, command.id);
        const { rowCount } = await connection.query(`
          UPDATE
            config
          SET
            ${columnName} = $1
          WHERE
            guild_id = $2
        `, [
          valDatabaseObj,
          message.guild.id
        ]);
        if (rowCount === 0) {
          await message.channel.send('No configurations were found for the guild. Try running this command again.');
          return;
        }
        embed.setColor(Color.rainbow.green.toColorResolvable());
        const valObj: ColumnJSObjectType<typeof columnName> = await columnDefinition.databaseToObject(message.guild, valDatabaseObj);
        embed.setDescription(`Config key \`${columnName}\` has been set to ${await safeObjectToString(columnDefinition, valObj)}.`);
        await message.channel.send(embed);
        return;
      } catch (err) {
        logger.error(err);
        await message.channel.send('Could not set config key. Details have been logged.');
      }
    } else {
      await message.channel.send(`Unknown subcommand \`${action}\`.`);
    }
  });
}
const command = new Command({
  id: 'config',
  name: 'Configure',
  category: 'Utility',
  description: 'Configures bot settings for the guild.',
  usage: 'config [get (key) | set (key) (value)]',
  aliases: ['config', 'configure'],
  serverOnly: true,
  permissions: Discord.Permissions.FLAGS.MANAGE_GUILD
});
command.execute = execute;

export async function setup(client: Client): Promise<void> {
  try {
    await database.withConnection((connection) => connection.query(`
      CREATE TABLE IF NOT EXISTS config (
        guild_id VARCHAR(20) NOT NULL PRIMARY KEY,
        ${Object.entries(columns).map(([name, { dbType }]) => `${name} ${dbType}`).join(',')}
      )
    `));
  } catch (err) {
    logger.error('Could not insert "config" table.');
    logger.fatal(err);
    return;
  }

  client.getCommandPrefixOffset = async (message: Discord.Message): Promise<number> => {
    let prefix: string;
    try {
      if (typeof message.guild === 'undefined') {
        prefix = config.get('prefix');
      } else {
        prefix = await database.withConnection(getPrefix, client, message.guild.id);
      }
    } catch (err) {
      logger.error('Could not get prefix from database.');
      logger.fatal(err);
    }

    const start = message.content.indexOf(prefix);
    return start !== 0 ? -1 : start + prefix.length;
  };

  client.registerCommand(command);
}
