import * as Discord from 'discord.js';
import * as pg from 'pg';
import { DatabaseError } from 'pg-protocol';

import { Client } from '../client';
import * as database from '../database';
import { Command, Context } from '../command';
import * as logger from '../logger';
import { Color } from '../utils';
import * as config from '../config';

import { insertAuditLog } from './auditlog';

export type ConfigValueDefinition<DBObjectType, JSObjectType> = {
  dbType: string,
  default?: JSObjectType,
  stringToDatabase: (client: Client, value: string) => DBObjectType | Promise<DBObjectType>,
  databaseToObject: (client: Client, value: DBObjectType) => JSObjectType | Promise<JSObjectType>,
  objectToString?: (value: JSObjectType) => string | Promise<string>
}

const columns = {
  /* eslint-disable quote-props */
  'prefix': {
    dbType: 'TEXT',
    get default() {
      return config.get('prefix');
    },
    stringToDatabase: (_client, value) => value,
    databaseToObject: (_client, value) => value
  } as ConfigValueDefinition<string, string>
  /* eslint-enable quote-props */
} as const;

type ColumnDBObjectType<CN extends keyof typeof columns> =
  typeof columns[CN] extends ConfigValueDefinition<infer T, unknown> ? T : never;
type ColumnJSObjectType<CN extends keyof typeof columns> =
  typeof columns[CN] extends ConfigValueDefinition<unknown, infer T> ? T : never;

export type DatabaseGuildConfig = {
  // eslint-disable-next-line camelcase
  guild_id: string
} & {
  [CN in keyof typeof columns]: ColumnDBObjectType<CN>
}

/**
 * Returns the value of a config column for the guild.
 * @param {pg.PoolClient} connection The connection.
 * @param {Client} client The Discord Client.
 * @param {string} guildID The guild ID.
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
  const columnDefinition = columns[columnName] as ConfigValueDefinition<DBObjectType, JSObjectType>;
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
      const jsValue = await columnDefinition.databaseToObject(client, dbValue);
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
 * @param {pg.PoolClient} connection The connection.
 * @param {Client} client The Discord Client.
 * @param {string} guildID The guild ID.
 * @returns {Promise<string>} The prefix.
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
  const columnDefinition: ConfigValueDefinition<unknown, typeof value> = columns[columnName];
  return `${columnName} : ${await safeObjectToString(columnDefinition, value)}`;
}

async function execute({ client, message }: Context): Promise<void> {
  const args = message.content.split(' ');
  const embed = new Discord.MessageEmbed();
  embed.setColor(Color.rainbow.skyblue.toColorResolvable());
  if (args.length < 2) {
    // (prefix)config
    try {
      const connection = await database.getConnection();
      const result = await connection.query(`
        SELECT
          *
        FROM
          config
        WHERE
          guild_id = $1
      `, [
        message.guild.id
      ]);
      if (result.rowCount < 1) {
        const prefix = await getPrefix(connection, client, message.guild.id);
        connection.release();
        await message.channel.send(`No configurations were found for the guild. Try creating one with \`${prefix}config create\`.`);
        return;
      }
      connection.release();
      const guildConfig = result.rows[0] as DatabaseGuildConfig;
      const formattedColumnPromises = Object.keys(guildConfig)
        .filter(key => Object.keys(columns).includes(key))
        .map(key => {
          const columnName = key as keyof typeof columns;
          return formatColumn(columnName, guildConfig[columnName] ?? columns[columnName].default);
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
      const connection = await database.getConnection();
      const value: JSObjectType = await get(connection, client, message.guild.id, columnName);
      if (typeof value === 'undefined') {
        const prefix = await getPrefix(connection, client, message.guild.id);
        connection.release();
        await message.channel.send(`No configurations were found for the guild. Try creating one with \`${prefix}config create\`.`);
        return;
      }
      connection.release();
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
    // NOTE(netux): there is probably a better way of do this...
    type DBObjectType = ColumnDBObjectType<typeof columnName>;
    type JSObjectType = ColumnJSObjectType<typeof columnName>;
    const columnDefinition: ConfigValueDefinition<DBObjectType, JSObjectType> = columns[columnName];
    let valDatabaseObj: DBObjectType;
    try {
      valDatabaseObj = await columnDefinition.stringToDatabase(client, args[3]);
    } catch (err) {
      await message.channel.send(`The specified value is invalid: ${err instanceof Error ? err.message : '<unknown error>'}.`);
      return;
    }

    try {
      const connection = await database.getConnection();
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
        const prefix = await getPrefix(connection, client, message.guild.id);
        connection.release();
        await message.channel.send(`No configurations were found for the guild. Try creating one with \`${prefix}config create\`.`);
        return;
      }
      connection.release();
      embed.setColor(Color.rainbow.green.toColorResolvable());
      const valObj: JSObjectType = await columnDefinition.databaseToObject(client, valDatabaseObj);
      embed.setDescription(`Config key \`${columnName}\` has been set to ${await safeObjectToString(columnDefinition, valObj)}.`);
      await message.channel.send(embed);
      return;
    } catch (err) {
      logger.error(err);
      await message.channel.send('Could not set config key. Details have been logged.');
    }
  } else if (action === 'create') {
    try {
      const connection = await database.getConnection();
      await insertAuditLog(connection, message, command.id);
      await connection.query(`
        INSERT INTO
          config
          (guild_id)
        VALUES
          ($1)
      `, [
        message.guild.id
      ]);
      connection.release();
      embed.setColor(Color.rainbow.green.toColorResolvable());
      embed.setDescription('Default configuration has been generated.');
      await message.channel.send(embed);
      return;
    } catch (err) {
      if ((err as DatabaseError).code === '23505') { // Duplicate entry
        await message.channel.send('Config entry already exists.');
      } else {
        logger.error(err);
        await message.channel.send('Could not create config entry. Details have been logged.');
      }
    }
  } else {
    await message.channel.send(`Unknown subcommand \`${action}\`.`);
  }
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
    const connection = await database.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS config (
        guild_id VARCHAR(18) NOT NULL PRIMARY KEY,
        ${Object.entries(columns).map(([name, { dbType }]) => `${name} ${dbType}`).join(',')}
      )
    `);
    connection.release();
  } catch (err) {
    logger.error('Could not insert "config" table.');
    logger.fatal(err);
    return;
  }

  client.getCommandPrefixOffset = async (message: Discord.Message): Promise<number> => {
    let prefix: string;
    try {
      const connection = await database.getConnection();
      if (typeof message.guild === 'undefined') {
        prefix = config.get('prefix');
      } else {
        prefix = await getPrefix(connection, client, message.guild.id);
      }
      connection.release();
    } catch (err) {
      logger.error('Could not get prefix from database.');
      logger.fatal(err);
    }

    const start = message.content.indexOf(prefix);
    return start === -1 ? -1 : start + prefix.length;
  };

  client.registerCommand(command);
}
