import * as Discord from 'discord.js';

export default class CommandBuilder {
  public id: string;
  public name: string;
  public category: string;
  public description: string;
  public usage: string;
  public aliases: string[];
  public serverOnly: boolean;
  public permissions: number;

  public init: Function;
  public execute: Function;

  setID(id: string) {
    this.id = id;
    return this;
  }

  setName(name: string) {
    this.name = name;
    return this;
  }

  setCategory(category: string) {
    this.category = category;
    return this;
  }

  setDescription(description: string) {
    this.description = description;
    return this;
  }

  setUsage(usage: string) {
    this.usage = usage;
    return this;
  }

  setAliases(aliases: string[]) {
    this.aliases = aliases;
    return this;
  }

  setServerOnly(serverOnly: boolean) {
    this.serverOnly = serverOnly;
    return this;
  }

  setPermissions(permissions: number) {
    this.permissions = permissions;
    return this;
  }

  setInit(init: () => Promise<void>) {
    this.init = init;
    return this;
  }

  setExecute(execute: (client: Discord.Client, message: Discord.Message) => Promise<any>) {
    this.execute = execute;
    return this;
  }

  /**
   * @param {Discord.GuildMember} member - The guild member.
   * @returns {boolean} Whether or not the specified member has permission to run this command.
   */
  hasPermission(member: Discord.GuildMember): boolean {
    return member.hasPermission(this.permissions);
  }
}
