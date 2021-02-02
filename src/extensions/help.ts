import * as Discord from 'discord.js';

import * as database from '../database';
import { Command, Context } from '../command';
import { Color } from '../utils';
import * as config from '../config';
import { Client } from '../client';

import { getPrefix } from './config';

async function execute({ client, message }: Context): Promise<void> {
  const args = message.content.split(' ');
  const embed = new Discord.MessageEmbed();
  embed.setColor(Color.rainbow.skyblue.toColorResolvable());
  if (args.length < 2) {
    // (prefix)help
    const commandsInCategory: { [category: string]: string[] } = {};
    for (const cmd of client.commands) {
      if (!(cmd.category in commandsInCategory)) {
        commandsInCategory[cmd.category] = [];
      }
      commandsInCategory[cmd.category].push(cmd.name);
    }
    for (const categoryName in commandsInCategory) {
      embed.addField(categoryName, commandsInCategory[categoryName]);
    }
    const categoryNames = new Set<string>();
    for (const cmd of client.commands) {
      categoryNames.add(cmd.category);
    }
    const helpText = `For more information on a specific command, try \`${config.get('prefix')}help [command]\`.`;
    embed.setDescription(helpText);
  } else {
    // (prefix)help [command name/alias]
    const command = client.getCommandByName(args.slice(1).join(' ').toLowerCase());
    if (command == null) {
      await message.channel.send('Could not a find command with the name or alias "' + args[1] + '".');
      return;
    }
    const permissions = new Discord.Permissions(command.permissions);
    const prefix = await database.withConnection(getPrefix, client, message.guild.id);
    const helpText = `
      **Description:** ${command.description}
      **Usage:** \`${prefix}${command.usage}\`
      **Aliases:** [ \`${command.aliases.join('` | `')}\` ]
      **Required Permissions:** ${command.permissions}
      ${permissions.toArray(false).map(v => ' - `' + v + '`').join('\n')}
    `;
    embed.addField(command.name, helpText);
  }
  await message.channel.send(embed);
}

export const command = new Command({
  id: 'help',
  name: 'Help',
  category: 'Utility',
  description: 'Returns a list of commands, or if specified, information about a specific command.',
  usage: 'help [item identifier]',
  aliases: ['help', '?']
});
command.execute = execute;

export function setup(client: Client): void {
  client.registerCommand(command);
}
