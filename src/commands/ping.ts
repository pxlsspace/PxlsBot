import * as Discord from 'discord.js';
import CommandBuilder from '../command';
import { Color } from '../utils';

async function execute(client, message) {
  const goodPingColor = new Color(0, 255, 0);
  const badPingColor = new Color(255, 0, 0);
  const embed = new Discord.RichEmbed();
  embed.setDescription(`
    **Average Ping:** ${Math.floor(client.ping)}ms

    **Pings (most recent first):** ${client.pings.map(ping => Math.floor(ping) + 'ms').join(', ')}
  `);
  const color = Color.lerp(client.ping / 1000, goodPingColor, badPingColor);
  embed.setColor(color.toColorResolvable());
  return message.channel.send(embed);
}

export const command = new CommandBuilder()
  .setID('ping')
  .setName('Ping')
  .setCategory('Utility')
  .setDescription('Returns the ping to Discord.')
  .setUsage('ping')
  .setAliases([ 'ping' ])
  .setServerOnly(false)
  .setPermissions(0)
  .setExecute(execute);
