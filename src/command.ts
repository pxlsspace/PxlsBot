import * as Discord from 'discord.js';

interface CommandData {
  id: string;
  name: string;
  category: string;
  description: string;
  usage: string;
  aliases: string[];
  serverOnly?: boolean;
  permissions?: number;
}

export class Command implements CommandData {
  public id: string;
  public name: string;
  public category: string;
  public description: string;
  public usage: string;
  public aliases: string[];
  public serverOnly = false;
  public permissions = 0;

  init: () => Promise<void>;
  execute: (client: Discord.Client, message: Discord.Message) => void | Promise<void>;

  constructor(data: CommandData) {
    this.id = data.id;
    this.name = data.name;
    this.category = data.category;
    this.description = data.description;
    this.usage = data.usage;
    this.aliases = data.aliases;
    this.serverOnly = data.serverOnly;
    this.permissions = data.permissions;
  }

  /**
   * @param {Discord.GuildMember} member - The guild member.
   * @returns {boolean} Whether or not the specified member has permission to run this command.
   */
  hasPermission(member: Discord.GuildMember): boolean {
    return member.hasPermission(this.permissions);
  }
}
