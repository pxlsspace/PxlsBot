const Discord = require('discord.js');

const { Command } = require('../command');
const { Color } = require('../utils');

async function execute (client, message) {
  const goodPingColor = new Color(0, 255, 0);
  const badPingColor = new Color(255, 0, 0);
  const embed = new Discord.RichEmbed();
  embed.setDescription(`
    **Average Ping:** ${client.ping}ms

    **Pings (most recent first):**
    ${client.pings.map(ping => ' - ' + ping + ' ms\n')}
  `);
  const color = Color.lerp(client.ping / 1000, goodPingColor, badPingColor);
  embed.setColor([ color.red, color.green, color.blue ]);
  return message.channel.send(embed);
}

const command = new Command(
  // Database-friendly ID
  'ping',
  // Name
  'Ping',
  // Category
  'Utility',
  // Description
  'Returns the ping to Discord.',
  // Usage
  'ping',
  // Aliases
  [ 'ping' ],
  // Server Only
  false,
  // Permissions
  0
);
command.execute = execute;

module.exports = { command };
