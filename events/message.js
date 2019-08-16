const { client, getDatabase } = require('../index');

const logger = require('../logger');
const { getCommands, getPrefix } = require('../utils');

const config = require('../config');

const database = getDatabase();

/**
 * An array of commands, set during initialization.
 * @property {Command[]} commands The commands.
 */
let commands;

async function init () {
  logger.info('Initializing commands...');
  commands = await getCommands(config.commandsPath);
  commands.forEach(command => command.init());
}

/**
 * Executed whenever a message is received over the WebSocket.
 * @param {Discord.Message} message The message.
 */
async function execute (message) {
  if (message.author.bot) {
    return;
  }
  const args = message.content.split(' ');
  let prefix;
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
    let match;
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
    match.execute(client, message);
  }
}

module.exports = { init, execute };
