import * as Discord from 'discord.js';

import { client, getDatabase } from '../index';
import * as logger from '../logger';
import { getCommands, getPrefix } from '../utils';

import Command from '../command';

const config = require('../../config');

const database = getDatabase();

/**
 * An array of commands, set during initialization.
 * @property {Command[]} commands The commands.
 */
let commands: Command[];

export const name = 'message';

export async function init() {
  logger.info('Initializing commands...');
  commands = await getCommands(config.commandsPath);
  commands.forEach(async command => {
    if (typeof command.init !== 'undefined') await command.init();
  });
}

/**
 * Executed whenever a message is received over the WebSocket.
 * @param {Discord.Message} message The message.
 */
export async function execute(message: Discord.Message) {
  if (message.author.bot) {
    return;
  }
  const args = message.content.split(' ');
  let prefix: string;
  try {
    const connection = await database.getConnection();
    prefix = await getPrefix(connection, message.guild.id);
    await connection.end();
  } catch (err) {
    logger.error('Could not get prefix from database.');
    logger.fatal(err);
  }
  if (args[0].toLowerCase().startsWith(prefix)) {
    const cmd = args[0].toLowerCase().replace(prefix, '');
    let match: Command;
    for (let command of commands) {
      if (command.aliases.includes(cmd)) {
        match = command;
      }
    }
    if (!match) {
      return;
    }
    if (match.serverOnly && !message.guild) {
      return message.channel.send('This command may only be run in a guild.');
    }
    if (!match.hasPermission(message.member)) {
      logger.debug(`${message.author.tag} attempted to execute command "${match.name}" in guild "${message.guild.name}" without permission.`);
      return message.channel.send('You do not have permission to run this command.');
    }
    logger.debug(`${message.author.tag} is executing command "${match.name}" in guild "${message.guild.name}".`);
    message.channel.startTyping();
    match.execute(client, message);
    message.channel.stopTyping(true);
  }
}
