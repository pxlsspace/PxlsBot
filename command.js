const Discord = require('discord.js');

class Command {
  /**
   * Creates a new Command.
   * @class
   * @param {string} name The name of the command.
   * @param {string} category The category of the command.
   * @param {string} description A description of the command.
   * @param {string} usage A usage of the command.
   * @param {string[]} aliases A list of the command aliases.
   * @param {number} permissions The permission bitfield.
   */
  constructor (name, category, description, usage, aliases, serverOnly, permissions) {
    this.name = name;
    this.category = category;
    this.description = description;
    this.usage = usage;
    this.aliases = aliases;
    this.serverOnly = serverOnly;
    this.permissions = permissions;
  }

  /**
   * Returns whether or not the specified member has permission to run this
   * command.
   * @param {Discord.GuildMember} member - The guild member.
   */
  hasPermission (member) {
    if (member instanceof Discord.GuildMember) {
      return member.hasPermission(this.permissions);
    }
    return false;
  }

  /** Executed when the command is initialized. */
  async init () {}

  /**
   * Executed when the command is handled.
   * @override
   * @param {Discord.Client} client - The client.
   * @param {Discord.Message} message - The message.
   * @returns {Discord.Message}
   */
  async execute (client, message) {
    return message.channel.send('Command not implemented.');
  }
}

module.exports = { Command };
