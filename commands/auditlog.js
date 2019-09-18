const Discord = require('discord.js');

const { Command } = require('../command');
const { getDatabase } = require('../index');
const logger = require('../logger');
const { getCommands, Color, truncate } = require('../utils');

const config = require('../config');

let database = getDatabase();

let commands;

async function insertAuditLog (connection, message, commandID) {
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

async function init () {
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

async function execute (client, message) {
  const args = message.content.split(' ');
  const embed = new Discord.RichEmbed();
  embed.setColor(Color.rainbow.skyblue.toArray());
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
      const formattedArr = [];
      for (let auditLog of auditLogs) {
        const user = await client.fetchUser(auditLog.user_id);
        let command = commands.find(command => {
          return command.id === auditLog.command_id;
        });
        const commandID = typeof command === 'undefined' ? auditLog.command_id : command.id;
        const timestamp = logger.getDateTime(auditLog.timestamp, true);
        formattedArr.push(`
          __**Audit Log #${auditLog.id}:**__ \`${commandID}\`
          **Time:** ${timestamp}
          **User:** ${user.tag}
          (${auditLog.user_id})
        `.trim());
      }

      const messageBuffer = [[]];
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
      for (let formattedStr of messageBuffer) {
        embed.setDescription(formattedStr);
        message.channel.send(embed);
      }
      return;
    } catch (err) {
      logger.error(err);
      return message.channel.send('Could not display audit log. Details have been logged.');
    }
  }
  if (isNaN(args[1])) {
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
    let command = commands.find(command => {
      return command.id === auditLog.command_id;
    });
    const commandID = typeof command === 'undefined' ? auditLog.command_id : command.id;
    embed.setTitle(`Audit Log #${id}`);
    embed.setAuthor(`${user.tag} (${user.id})`, user.displayAvatarURL);
    embed.addField('Command', '`' + (commandID) + '`');
    embed.addField('Message Text', truncate('```\n' + auditLog.message + '```', 1024, ' ...', true));
    embed.setTimestamp(auditLog.timestamp);
    return message.channel.send(embed);
  } catch (err) {
    logger.error(`Could not search for audit log by ID '${id}'.`);
    logger.error(err);
    return message.channel.send(`Could not search for audit log by ID \`${id}\`.`);
  }
}

const command = new Command(
  'auditlog',
  'Audit Log',
  'Utility',
  'Displays actions taken with the bot.',
  'auditlog [ id ]',
  [ 'auditlog', 'auditlogs' ],
  true,
  Discord.Permissions.FLAGS.MANAGE_GUILD
);
command.init = init;
command.execute = execute;

module.exports = { command, insertAuditLog };
