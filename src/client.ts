import * as Discord from 'discord.js';

import { Command, Context } from './command';
import * as logger from './logger';
import * as config from './config';
import { readOnlyViewOf, splitN } from './utils';

export type ExtensionFile = {
  // eslint-disable-next-line no-use-before-define
  setup(bot: Client): Promise<void> | void
  // eslint-disable-next-line no-use-before-define
  teardown?(bot: Client): Promise<void> | void
}

export abstract class PrefixHandler {
  abstract get(message: Discord.Message): string;
}

export class Client extends Discord.Client {
  #commands: Command[];
  #extensions: Record<string, ExtensionFile>;

  get commands(): Command[] {
    return readOnlyViewOf(this.#commands);
  }

  get extensions(): Record<string, ExtensionFile> {
    return readOnlyViewOf(this.#extensions);
  }

  constructor(options: Discord.ClientOptions) {
    super(options);

    this.#extensions = {};
    this.#commands = [];
    this.on('message', this.handleMessageCommand.bind(this));
  }

  /**
   * Function used to find if and where the command prefix ends on a message.
   * @param message
   * @returns {Promise<number> | number} the index at which the prefix ends,
   * or -1 if no prefix was found.
   */
  getCommandPrefixOffset(message: Discord.Message): Promise<number> | number {
    const prefix = config.get('prefix', '!');
    const start = message.content.indexOf(prefix);
    return start !== 0 ? -1 : start + prefix.length;
  }

  private async handleMessageCommand(message: Discord.Message) {
    if (message.author.bot) {
      return;
    }
    const prefixOffset = await this.getCommandPrefixOffset(message);
    if (prefixOffset === -1) {
      return;
    }
    const [cmd, args] = splitN(message.content.substring(prefixOffset), ' ', 1);
    let match: Command;
    for (const command of this.#commands) {
      if (command.aliases.includes(cmd)) {
        match = command;
      }
    }
    if (!match) {
      return;
    }
    if (match.serverOnly && !message.guild) {
      await message.channel.send('This command may only be run in a guild.');
      return;
    }
    if (!match.hasPermission(message.member)) {
      logger.debug(`${message.author.tag} attempted to execute command "${match.name}" in guild "${message.guild.name}" without permission.`);
      await message.channel.send('You do not have permission to run this command.');
      return;
    }
    logger.debug(`${message.author.tag} is executing command "${match.name}" in guild "${message.guild.name}".`);
    void message.channel.startTyping();
    await match.execute(new Context(message, match, args));
    message.channel.stopTyping(true);
  }

  isCommandRegistered(command: Command): boolean {
    return this.#commands.some((cmd) =>
      cmd.name === command.name ||
      cmd.aliases.some((cmdAlias) => command.name === cmdAlias || command.aliases.includes(cmdAlias))
    );
  }

  getCommandByName(nameOrAlias: string): Command | null {
    for (const cmd of this.#commands) {
      if (cmd.name === nameOrAlias || cmd.aliases.includes(nameOrAlias)) {
        return cmd;
      }
    }

    return null;
  }

  registerCommand(command: Command): void {
    if (this.isCommandRegistered(command)) {
      throw new Error(`attempted to register command ${command.name} but a command with the same name or alias was already registered.`);
    }
    this.#commands.push(command);
  }

  unregisterCommand(commandOrName: Command | string): void {
    const cmd = commandOrName instanceof Command
      ? commandOrName
      : this.getCommandByName(commandOrName);
    const idx = this.#commands.indexOf(cmd);
    if (idx === -1) {
      throw new Error(`attempted to unregister unknown command ${cmd.name}`);
    }

    this.#commands.splice(idx, 1);
  }

  private async safeTeardownExt(extFile: ExtensionFile) {
    if (typeof extFile.teardown === 'function') {
      return await extFile.teardown(this);
    }
  }

  getExtensionByName(name: string): ExtensionFile | null {
    return this.#extensions[name] ?? null;
  }

  async reloadExtension(name: string): Promise<ExtensionFile> {
    return this.loadExtension(name);
  }

  async loadExtension(path: string): Promise<ExtensionFile> {
    // Remove file from require cache, if its there.
    delete require.cache[path];

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const extFile = require(path) as ExtensionFile;
    if (typeof extFile.setup !== 'function') {
      throw new Error(`extension at ${path} doesn't export a setup function.`);
    }

    this.#extensions[path] = extFile;
    await extFile.setup(this);
    return extFile;
  }

  async unloadExtension(path: string): Promise<void> {
    // Remove file from require cache, if its there.
    delete require.cache[path];

    const extFile = this.#extensions[path];
    if (extFile == null) {
      throw new Error(`attempted to unload extension ${path} which was never loaded.`);
    }

    delete this.#extensions[path];
    return this.safeTeardownExt(extFile);
  }

  async destroy(): Promise<void> {
    super.destroy();
    await Promise.all(Object.values(this.#extensions).map(this.safeTeardownExt.bind(null)));
  }
}
