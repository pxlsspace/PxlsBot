import * as Discord from 'discord.js';
import * as mariadb from 'mariadb';

import { getDatabase } from '../index';
import { Command } from '../command';
import * as logger from '../logger';
import { getCommands, Color, truncate } from '../utils';

const config = require('../../config');

let database = getDatabase();

let commands: Command[];

/**
 * Inserts an audit log entry.
 * @param {mariadb.Connection} connection The database connection.
 * @param {Discord.Message} message The message.
 * @param {string} commandID The command ID.
 */
export async function insertAuditLog(connection: mariadb.Connection, message: Discord.Message, commandID: string) {
  try {
    await connection.query(`
      INSERT INTO
        auditlog
        (guild_id, user_id, command_id, message)
      VALUES
        (?, ?, ?, ?)
    `, [
      message.guild.id,
      message.author.id,
      commandID,
      message.content
    ]);
  } catch (err) {
    logger.error(err);
    logger.error('Could not insert into "auditlog" table.');
  }
}

async function init() {
  commands = await getCommands(config.commandsPath);
  try {
    const connection = await database.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS auditlog (
        id INT PRIMARY KEY AUTO_INCREMENT,
        guild_id VARCHAR(18) NOT NULL,
        user_id VARCHAR(18) NOT NULL,
        command_id TEXT,
        message TEXT,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
      )
    `);
    await connection.end();
  } catch (err) {
    logger.error('Could not insert "auditlog" table.');
    logger.fatal(err);
  }
}

async function execute(client: Discord.Client, message: Discord.Message) {
  const args = message.content.split(' ');
  const embed = new Discord.RichEmbed();
  embed.setColor(Color.rainbow.skyblue.toColorResolvable());
  if (args.length < 2) {
    try {
      const connection = await database.getConnection();
      const results = await connection.query(`
        SELECT
          *
        FROM
          auditlog
        WHERE
          guild_id = ?
      `, [
        message.guild.id
      ]);
      await connection.end();
      if (results.length < 1) {
        return message.channel.send('This server has no audit log entries.');
      }
      const auditLogs = results;
      const formattedArr: string[] = [];
      for (const auditLog of auditLogs) {
        const user = await client.fetchUser(auditLog.user_id);
        const command = commands.find(cmd => cmd.id === auditLog.command_id);
        const commandID = command.id ?? auditLog.command_id;
        const timestamp = logger.getDateTime(auditLog.timestamp, true);
        formattedArr.push(`
          __**Audit Log #${auditLog.id}:**__ \`${commandID}\`
          **Time:** ${timestamp}
          **User:** ${user.tag}
          (${auditLog.user_id})
        `.trim());
      }

      const messageBuffer: [string[]] = [[]];
      let buffer = 0;
      for (let i = 0; i < formattedArr.length; i++) {
        const formattedStr = formattedArr[i];
        if (buffer + formattedStr.length > 2048) {
          messageBuffer.push([]);
          buffer = 0;
        }
        messageBuffer[messageBuffer.length - 1].push(formattedStr + '\n');
        buffer += formattedStr.length;
      }
      for (const formattedStr of messageBuffer) {
        embed.setDescription(formattedStr);
        message.channel.send(embed);
      }
      return;
    } catch (err) {
      logger.error(err);
      return message.channel.send('Could not display audit log. Details have been logged.');
    }
  }
  if (isNaN(Number(args[1]))) {
    return message.channel.send('You must specify a valid audit log ID - not a number.');
  }
  const id = parseInt(args[1]);
  try {
    const connection = await database.getConnection();
    const results = await connection.query(`
      SELECT
        *
      FROM
        auditlog
      WHERE
        guild_id = ?
        AND id = ?
    `, [
      message.guild.id,
      id
    ]);
    await connection.end();
    if (results.length < 1) {
      return message.channel.send(`Could not find audit log by ID \`${id}\`.`);
    }
    const auditLog = results[0];
    const user = await client.fetchUser(auditLog.user_id);
    const command = commands.find(cmd => cmd.id === auditLog.command_id);
    const commandID = command.id ?? auditLog.command_id;
    embed.setTitle(`Audit Log #${id}`);
    embed.setAuthor(`${user.tag} (${user.id})`, user.displayAvatarURL);
    embed.addField('Command', `\`${commandID}\``);
    embed.addField('Message Text', truncate('```\n' + auditLog.message + '```', 1024, ' ...', true));
    embed.setTimestamp(auditLog.timestamp);
    return message.channel.send(embed);
  } catch (err) {
    logger.error(`Could not search for audit log by ID '${id}'.`);
    logger.error(err);
    return message.channel.send(`Could not search for audit log by ID \`${id}\`.`);
  }
}

export const command = new Command({
  id: 'auditlog',
  name: 'Audit Log',
  category: 'Utility',
  description: 'Display actions taken with the bot.',
  usage: 'auditlog [id]',
  aliases: ['al', 'audit', 'auditlog', 'auditlogs'],
  serverOnly: true,
  permissions: Discord.Permissions.FLAGS.MANAGE_GUILD
});
command.init = init;
command.execute = execute;
