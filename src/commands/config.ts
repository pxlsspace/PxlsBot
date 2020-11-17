import * as Discord from 'discord.js';
import * as pg from 'pg';
import { DatabaseError } from 'pg-protocol';

import { getDatabase } from '../index';
import { Command } from '../command';
import * as logger from '../logger';
import { Color } from '../utils';
import * as config from '../config';

import { insertAuditLog } from './auditlog';

export type DatabaseGuildConfig = {
  /* eslint-disable camelcase */
  guild_id: string,
  prefix: string | null
  /* eslint-enable camelcase */
}

const database = getDatabase();

const columnWhitelist = [
  'prefix'
];

async function init() {
  try {
    const connection = await database.connect();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS config (
        guild_id VARCHAR(18) NOT NULL PRIMARY KEY,
        prefix TEXT
      )
    `);
    connection.release();
  } catch (err) {
    logger.error('Could not insert "config" table.');
    logger.fatal(err);
  }
}

/**
 * Returns the configured prefix for the guild, or the default one if none.
 * @param {pg.PoolClient} connection The connection.
 * @param {string} guildID The guild ID.
 * @returns {Promise<string>} The prefix.
 */
export async function getPrefix(connection: pg.PoolClient, guildID: string): Promise<string> {
  let prefix = config.get('prefix');
  try {
    const result = await connection.query(`
      SELECT
        prefix
      FROM
        config
      WHERE
        guild_id = $1
    `, [
      guildID
    ]);
    if (result.rowCount > 0) {
      prefix = (result.rows[0] as DatabaseGuildConfig).prefix || prefix;
    }
  } catch (err) {
    logger.error('Error getting prefix.');
    logger.error(err);
  }
  return prefix;
}

async function execute(client: Discord.Client, message: Discord.Message): Promise<void> {
  const args = message.content.split(' ');
  const embed = new Discord.MessageEmbed();
  embed.setColor(Color.rainbow.skyblue.toColorResolvable());
  if (args.length < 2) {
    // (prefix)config
    try {
      const connection = await database.connect();
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
        const prefix = await getPrefix(connection, message.guild.id);
        connection.release();
        await message.channel.send(`No configurations were found for the guild. Try creating one with \`${prefix}config create\`.`);
        return;
      }
      connection.release();
      const guildConfig = result.rows[0] as DatabaseGuildConfig;
      const formattedKeyValues = Object.keys(guildConfig).filter(key => {
        return columnWhitelist.includes(key);
      }).map(key => `${key} : \`${guildConfig[key as keyof DatabaseGuildConfig]}\``).join('\n');
      embed.setDescription(formattedKeyValues);
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
    if (!columnWhitelist.includes(args[2].toLowerCase())) {
      await message.channel.send('The specified config key is not on the column whitelist.');
      return;
    }
    try {
      const connection = await database.connect();
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
      if (rows.length < 1) {
        const prefix = await getPrefix(connection, message.guild.id);
        connection.release();
        await message.channel.send(`No configurations were found for the guild. Try creating one with \`${prefix}config create\`.`);
        return;
      }
      connection.release();
      const guildConfig = rows[0] as DatabaseGuildConfig;
      const formattedKeyValue = Object.keys(guildConfig).filter(key => {
        return key.toLowerCase() === args[2].toLowerCase() &&
          columnWhitelist.includes(key);
      }).map(key => `${key} : \`${guildConfig[key as keyof DatabaseGuildConfig]}\``).join('\n');
      embed.setDescription(formattedKeyValue);
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
    const key = args[2].toLowerCase();
    if (!columnWhitelist.includes(key)) {
      await message.channel.send('The specified config key is not on the column whitelist.');
      return;
    }
    if (args.length < 4) {
      await message.channel.send('You must specify a value.');
      return;
    }
    let setVal: string | number = args[3];
    if (!isNaN(Number(args[3]))) {
      setVal = parseFloat(args[3]);
    }
    try {
      const connection = await database.connect();
      await insertAuditLog(connection, message, command.id);
      await connection.query(`
        UPDATE
          config
        SET
          ${key} = $1
        WHERE
          guild_id = $2
      `, [
        setVal,
        message.guild.id
      ]);
      connection.release();
      embed.setColor(Color.rainbow.green.toColorResolvable());
      embed.setDescription(`Config key \`${key}\` has been set to \`${setVal}\`.`);
      await message.channel.send(embed);
      return;
    } catch (err) {
      logger.error(err);
      await message.channel.send('Could not set config key. Details have been logged.');
    }
  } else if (action === 'create') {
    try {
      const connection = await database.connect();
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

export const command = new Command({
  id: 'config',
  name: 'Configure',
  category: 'Utility',
  description: 'Configures bot settings for the guild.',
  usage: 'config [get (key) | set (key) (value)]',
  aliases: ['config', 'configure'],
  serverOnly: true,
  permissions: Discord.Permissions.FLAGS.MANAGE_GUILD
});
command.init = init;
command.execute = execute;
