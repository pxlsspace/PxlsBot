import * as Discord from 'discord.js';

import { getDatabase } from '../index';
import { Command } from '../command';
import * as logger from '../logger';
import { Color, getPrefix } from '../utils';

import { insertAuditLog } from './auditlog';

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

async function execute(client: Discord.Client, message: Discord.Message) {
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
        return message.channel.send(`No configurations were found for the guild. Try creating one with \`${prefix}config create\`.`);
      }
      connection.release();
      const guildConfig = result.rows[0];
      const formattedKeyValues = Object.keys(guildConfig).filter(key => {
        return columnWhitelist.includes(key);
      }).map(key => {
        return `${key} : \`${guildConfig[key]}\``;
      }).join('\n');
      embed.setDescription(formattedKeyValues);
      return message.channel.send(embed);
    } catch (err) {
      logger.error(err);
      return message.channel.send('Could not get config. Details have been logged.');
    }
  }
  const action = args[1].toLowerCase();
  if (action === 'get') {
    if (args.length < 3) {
      return message.channel.send('You must specify a config key.');
    }
    if (!columnWhitelist.includes(args[2].toLowerCase())) {
      return message.channel.send('The specified config key is not on the column whitelist.');
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
        return message.channel.send(`No configurations were found for the guild. Try creating one with \`${prefix}config create\`.`);
      }
      connection.release();
      const guildConfig = rows[0];
      const formattedKeyValue = Object.keys(guildConfig).filter(key => {
        return key.toLowerCase() === args[2].toLowerCase() &&
          columnWhitelist.includes(key);
      }).map(key => {
        return `${key} : \`${guildConfig[key]}\``;
      }).join();
      embed.setDescription(formattedKeyValue);
      return message.channel.send(embed);
    } catch (err) {
      logger.error(err);
      return message.channel.send('Could not get config key. Details have been logged.');
    }
  } else if (action === 'set') {
    if (args.length < 3) {
      return message.channel.send('You must specify a config key.');
    }
    const key = args[2].toLowerCase();
    if (!columnWhitelist.includes(key)) {
      return message.channel.send('The specified config key is not on the column whitelist.');
    }
    if (args.length < 4) {
      return message.channel.send('You must specify a value.');
    }
    let setVal: unknown = args[3];
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
      return message.channel.send(embed);
    } catch (err) {
      logger.error(err);
      return message.channel.send('Could not set config key. Details have been logged.');
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
      return message.channel.send(embed);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return message.channel.send('Config entry already exists.');
      } else {
        logger.error(err.code);
        return message.channel.send('Could not create config entry. Details have been logged.');
      }
    }
  } else {
    return message.channel.send(`Unknown subcommand \`${action}\`.`);
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
