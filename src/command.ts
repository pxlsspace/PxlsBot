import * as Discord from 'discord.js';

import { Client } from './client';

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
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly usage: string;
  readonly aliases: string[];
  readonly serverOnly?: boolean;
  readonly permissions?: number;

  // eslint-disable-next-line no-use-before-define
  execute: (context: Context) => Promise<void> | void;

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
   * @param member - The guild member.
   * @returns Whether or not the specified member has permission to run this command.
   */
  hasPermission(member: Discord.GuildMember): boolean {
    return member.hasPermission(this.permissions);
  }
}

export class Context {
  message: Discord.Message;
  command: Command;
  argument: string;

  get client(): Client {
    return this.message.client as Client;
  }

  constructor(message: Discord.Message, command: Command, argument: string) {
    this.message = message;
    this.command = command;
    this.argument = argument;
  }
}
