import * as Discord from 'discord.js';

import { getDatabase } from '../index';
import { Command } from '../command';
import { getCommands, Color, getPrefix } from '../utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('../../config');

const database = getDatabase();

/**
 * An array of commands, set during initialization.
 * @property {Command[]} commands The commands.
 */
let commands: Command[];

/**
 * An array of all the categories used by commands.
 * @property {string[]} categories The categories.
 */
const categories: string[] = [];

async function init() {
  commands = await getCommands(config.commandsPath);
  commands.forEach(command => {
    categories[command.category] = categories[command.category] || [];
    categories[command.category].push(command);
  });
}

async function execute(client: Discord.Client, message: Discord.Message) {
  const args = message.content.split(' ');
  const embed = new Discord.RichEmbed();
  embed.setColor(Color.rainbow.skyblue.toColorResolvable());
  if (args.length < 2) {
    // (prefix)help
    const categoryNames = Object.keys(categories);
    for (const category of categoryNames) {
      const categoryCommands = categories[category];
      const commandList = categoryCommands.map(cmd => cmd.name);
      embed.addField(category, commandList);
    }
    const helpText = `For more information on a specific command, try \`${config.prefix}help [command]\`.`;
    embed.setDescription(helpText);
  } else {
    // (prefix)help [command name/alias]
    const command = commands.find(command => {
      return args.slice(1).join(' ').toLowerCase() === command.name.toLowerCase() ||
      command.aliases.includes(args.slice(1).join(' ').toLowerCase());
    });
    if (typeof command === 'undefined') {
      return message.channel.send('Could not a find command with the name or alias "' + args[1] + '".');
    }
    const permissions = new Discord.Permissions(command.permissions);
    let prefix = '';
    const connection = await database.getConnection();
    prefix = await getPrefix(connection, message.guild.id);
    const helpText = `
      **Description:** ${command.description}
      **Usage:** \`${prefix}${command.usage}\`
      **Aliases:** [ \`${command.aliases.join('` | `')}\` ]
      **Required Permissions:** ${command.permissions}
      ${permissions.toArray(false).map(v => ' - `' + v + '`\n')}
    `;
    embed.addField(command.name, helpText);
  }
  return message.channel.send(embed);
}

export const command = new Command({
  id: 'help',
  name: 'Help',
  category: 'Utility',
  description: 'Returns a list of commands, or if specified, information about a specific command.',
  usage: 'help [item identifier]',
  aliases: ['help', '?']
});
command.init = init;
command.execute = execute;
