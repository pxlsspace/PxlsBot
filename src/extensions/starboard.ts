import * as Discord from 'discord.js';
import * as pg from 'pg';

import * as config from './config';
import * as database from '../database';
import { Client } from '../client';
import * as logger from '../logger';
import { ellipsis } from '../utils';

const ZERO_WIDTH_SPACE = '\u200B';
const STAR_EMOJI = '⭐';

interface DatabaseStarboardMessage {
  /* eslint-disable camelcase */
  guild_id: string,
  source_message_id: string,
  board_message_id: string
  /* eslint-enable camelcase */
}

async function makeEmbedForMessage(message: Discord.Message, starCount: number): Promise<Discord.MessageEmbed> {
  message = await message.fetch(); // make sure we have the entire message
  const color = await message.guild.members.fetch(message.author.id)
    .then((member) => member?.displayColor)
    // NOTE(netux): Without the implicit  typecast to a number TSLint thinks `color`
    // has type any for some reason, and whines about it.
    .catch(() => null as number);

  let embedCharacterLength = 0;
  const embed = new Discord.MessageEmbed({
    title: ellipsis(`#${(message.channel as Discord.TextChannel).name}`, 256),
    description: ellipsis(message.content, 2048),
    timestamp: message.createdTimestamp,
    color: color === -1 ? null : color,
    author: {
      name: ellipsis(message.author.tag, 256),
      iconURL: message.author.avatarURL({ size: 32, dynamic: true })
    }
  });
  embedCharacterLength += embed.title.length;
  embedCharacterLength += embed.description.length;
  embedCharacterLength += embed.author?.name.length ?? 0;

  const lastField = {
    name: ZERO_WIDTH_SPACE,
    value: `\\${STAR_EMOJI} ${starCount} • [Link](${message.url})`
  };
  embedCharacterLength += lastField.name.length;
  embedCharacterLength += lastField.value.length;

  // add source message embeds' title and descriptions fields
  for (const [idx, em] of message.embeds.slice(0, 24).entries()) {
    let title = `Embed${message.embeds.length > 1 ? ` #${idx + 1}` : ''}`;
    const emTitle = em.title ?? em.author?.name;
    if (emTitle != null) {
      title = ellipsis(title + ' - ' + emTitle, 256);
    }
    let description = ellipsis(em.description ?? '*<empty>*', 1024);
    const getFieldLength = () => title.length + description.length;
    let exceeded = false;
    if (embedCharacterLength + getFieldLength() > 6000) {
      description = ellipsis(description, description.length - (embedCharacterLength + getFieldLength() - 6000));
      exceeded = true;
    }
    embed.addField(title, description);
    if (exceeded) {
      break;
    }
    embedCharacterLength += getFieldLength();
  }

  // add most prominent image to embed if found
  let prominentImageURL: string;
  if (message.attachments.size > 0) {
    prominentImageURL = message.attachments.first().proxyURL;
  }
  if (prominentImageURL == null) {
    for (const em of message.embeds) {
      if (em.image?.width != null) {
        prominentImageURL = em.image.proxyURL;
        break;
      }
    }
  }
  if (prominentImageURL != null) {
    embed.setImage(prominentImageURL);
  }

  embed.addField(lastField.name, lastField.value);

  return embed;
}

async function removeBoardMessage(connection: pg.PoolClient, guildID: string, sourceMessage: Discord.Message | Discord.PartialMessage, boardMessage?: Discord.Message) {
  return Promise.all([
    boardMessage != null && !boardMessage.deleted ? boardMessage.delete() : Promise.resolve(null),
    connection.query(`
      DELETE FROM
        starboard_messages
      WHERE
        guild_id = $1
        AND source_message_id = $2
    `, [
      guildID,
      sourceMessage.id
    ])
  ]);
}

export async function getStarboardChannel(connection: pg.PoolClient, client: Client, guildID: string): Promise<Discord.TextChannel | null> {
  return config.get(connection, client, guildID, 'starboard_channel');
}

export async function getStarboardThreshold(connection: pg.PoolClient, client: Client, guildID: string): Promise<number> {
  return config.get(connection, client, guildID, 'starboard_threshold');
}

async function getLinkedBoardMessageID(connection: pg.PoolClient, guildID: string, sourceMessageID: string) {
  const { rows } = await database.withConnection((connection) => connection.query(`
    SELECT
      board_message_id
    FROM
      starboard_messages
    WHERE
      guild_id = $1
      AND source_message_id = $2
  `, [
    guildID,
    sourceMessageID
  ]));
  return rows.length > 0 ? (rows[0] as DatabaseStarboardMessage).board_message_id : null;
}

async function getLinkedBoardMessage(
  connection: pg.PoolClient,
  guildID: string,
  sourceMessageID: string,
  boardChannel: Discord.TextChannel
) {
  const id = await getLinkedBoardMessageID(connection, guildID, sourceMessageID);
  if (id == null) {
    return;
  }

  return await boardChannel.messages.fetch(id)
    // NOTE(netux): Without the implicit typecast to a Discord.message, TSLint thinks
    // the return type of this function is any for some reason, and whines about it.
    .catch(() => null as Discord.Message);
}

function canManageStarboard(boardChannel: Discord.TextChannel) {
  const p = Discord.Permissions.FLAGS;
  return boardChannel
    .permissionsFor(boardChannel.client.user)
    .has(p.VIEW_CHANNEL | p.SEND_MESSAGES | p.READ_MESSAGE_HISTORY | p.EMBED_LINKS);
}

export async function setup(client: Client): Promise<void> {
  try {
    await database.withConnection((connection) => connection.query(`
      CREATE TABLE IF NOT EXISTS starboard_messages (
        guild_id VARCHAR(20) NOT NULL,
        source_message_id VARCHAR(20) NOT NULL,
        board_message_id VARCHAR(20) NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS starboard_guild_source_pair
      ON starboard_messages(guild_id, source_message_id);
    `));
  } catch (err) {
    logger.error('Could not insert "starboard_messages" table.');
    logger.fatal(err);
    return;
  }

  const processingQueue: Record<string, Promise<void>> = {};
  async function queueMessageHandling(msgID: string, cb: () => Promise<void>) {
    const promise = processingQueue[msgID] ?? Promise.resolve();
    processingQueue[msgID] = promise;
    await promise.then(() => cb());
  }

  function handleMessageReactionChange(reaction: Discord.MessageReaction): Promise<void> {
    const sourceMessage = reaction.message;
    if (reaction.emoji.name !== STAR_EMOJI || sourceMessage.channel.type === 'dm') {
      return;
    }

    return queueMessageHandling(sourceMessage.id, async () => {
      const guildID = sourceMessage.guild.id;
      try {
        await database.withConnection(async (connection) => {
          const boardChannel = await getStarboardChannel(connection, client, guildID);
          if (boardChannel == null) {
            return;
          }
          if (!canManageStarboard(boardChannel)) {
            // insuficient permissions
            return;
          }
          if (sourceMessage.channel.id === boardChannel.id) {
            // disallow star-ing messages from the starboard itself
            return;
          }

          const [boardMessage, threshold] = await Promise.all([
            await getLinkedBoardMessage(connection, guildID, sourceMessage.id, boardChannel),
            getStarboardThreshold(connection, client, guildID)
          ]);

          reaction = await reaction.fetch(); // make sure we have the entire reaction

          if (reaction.count === 0) {
            // remove board message from channel and database
            await removeBoardMessage(connection, guildID, sourceMessage, boardMessage);
          } else {
            const makeEmbed = () => makeEmbedForMessage(sourceMessage, reaction.count);
            if (boardMessage == null || boardMessage.deleted) {
              if (reaction.count >= threshold) {
                // send board message and try to insert message into database
                const newBoardMessage = await boardChannel.send(await makeEmbed());
                await database.withConnection((connection) => connection.query(`
                  INSERT INTO
                    starboard_messages
                    (guild_id, source_message_id, board_message_id)
                  VALUES ($1, $2, $3)
                  ON CONFLICT (guild_id, source_message_id)
                  DO UPDATE SET
                    board_message_id = $3
                `, [
                  guildID,
                  sourceMessage.id,
                  newBoardMessage.id
                ]));
              }
            } else {
              // update board message with new star count
              await boardMessage.edit(await makeEmbed());
            }
          }
        });
      } catch (err) {
        logger.error(`(starboard) Could not handle star reaction change on guild ${guildID} message ${sourceMessage.channel.id}-${sourceMessage.id}.`);
        logger.error(err);
      }
    });
  }

  client.on('messageReactionAdd', (reaction) => { void handleMessageReactionChange(reaction); });
  client.on('messageReactionRemove', (reaction) => { void handleMessageReactionChange(reaction); });

  async function handleMessageReactionBulkDelete(sourceMessage: Discord.Message | Discord.PartialMessage) {
    const guildID = sourceMessage.guild.id;
    try {
      await database.withConnection(async (connection) => {
        const boardChannel = await getStarboardChannel(connection, client, guildID);
        if (boardChannel == null) {
          return;
        }
        if (!canManageStarboard(boardChannel)) {
          // insufficient
          return;
        }

        const boardMessage = await getLinkedBoardMessage(connection, guildID, sourceMessage.id, boardChannel);
        await removeBoardMessage(connection, guildID, sourceMessage, boardMessage);
      });
    } catch (err) {
      logger.error(`(starboard) Could not handle star reaction bulk delete on guild ${guildID} message ${sourceMessage.channel.id}-${sourceMessage.id}.`);
      logger.error(err);
    }
  }

  client.on('messageReactionRemoveAll', (sourceMessage) => {
    if (sourceMessage.channel.type === 'dm') {
      return;
    }

    void handleMessageReactionBulkDelete(sourceMessage);
  });
  client.on('messageReactionRemoveEmoji', (reaction) => {
    const sourceMessage = reaction.message;
    if (reaction.emoji.name !== STAR_EMOJI || sourceMessage.channel.type === 'dm') {
      return;
    }

    void handleMessageReactionBulkDelete(sourceMessage);
  });
}
