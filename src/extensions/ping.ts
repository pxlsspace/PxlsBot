import * as Discord from 'discord.js';
import { Client } from '../client';
import { Command, Context } from '../command';
import { Color } from '../utils';

async function execute({ client, message }: Context) {
  const goodPingColor = new Color(0, 255, 0);
  const badPingColor = new Color(255, 0, 0);
  const embed = new Discord.MessageEmbed();
  embed.setDescription(`
    **Average Ping:** ${Math.floor(client.ws.ping)}ms

    **Per Shard:**
    ${message.client.ws.shards.map(shard => `${shard.id}: ${Math.floor(shard.ping)}ms`).join('\n')}
  `);
  const color = Color.lerp(client.ws.ping / 1000, goodPingColor, badPingColor);
  embed.setColor(color.toColorResolvable());
  await message.channel.send(embed);
}

const command = new Command({
  id: 'ping',
  name: 'Ping',
  category: 'Utility',
  description: 'Returns the ping to Discord.',
  usage: 'ping',
  aliases: ['ping']
});
command.execute = execute;

export function setup(client: Client): void {
  client.registerCommand(command);
}
