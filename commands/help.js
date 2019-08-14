const Discord = require('discord.js');

const { Command } = require('../command');
const { getCommands, Color } = require('../utils');

const config = require('../config');

/**
 * An array of commands, set during initialization.
 * @property {Command[]} commands The commands.
 */
let commands;

/**
 * An array of all the categories used by commands.
 * @property {string[]} categories The categories.
 */
let categories = [];

async function init () {
  commands = await getCommands(config.commandsPath);
  commands.forEach(command => {
    categories[command.category] = categories[command.category] || [];
    categories[command.category].push(command);
  });
}

async function execute (client, message) {
  const args = message.content.split(' ');
  const embed = new Discord.RichEmbed();
  embed.setColor(Color.rainbow.skyblue.toArray());
  if (args.length < 2) {
    // (prefix)help
    const categoryNames = Object.keys(categories);
    for (let category of categoryNames) {
      let commandList = '';
      let categoryCommands = categories[category];
      categoryCommands.forEach(command => {
        commandList += command.name + '\n';
      });
      embed.addField(category, commandList);
    }
    let helpText = `For more information on a specific command, try \`${config.prefix}help [command]\`.`;
    embed.setDescription(helpText);
  } else {
    // (prefix)help [command name/alias]
    const command = commands.find(command => {
      return args[1].toLowerCase() === command.name.toLowerCase() ||
      command.aliases.includes(args[1].toLowerCase());
    });
    if (typeof command === 'undefined') {
      return message.channel.send('Could not a find command with the name or alias "' + args[1] + '".');
    }
    const permissions = new Discord.Permissions(command.permissions);
    let helpText = `
      **Description:** ${command.description}
      **Usage:** ${command.usage}
      **Aliases:** [ '${command.aliases.join('\', \'')}' ]
      **Required Permissions:** ${command.permissions}
      ${permissions.toArray(false).map(v => ' - `' + v + '`\n')}
    `;
    embed.addField(command.name, helpText);
  }
  return message.channel.send(embed);
}

const command = new Command(
  'help',
  'Help',
  'Utility',
  'Returns a list of commands, or if specified, information about a specific command.',
  'help [item identifier]',
  [ 'help', '?' ],
  false,
  0
);
command.init = init;
command.execute = execute;

module.exports = { command };
