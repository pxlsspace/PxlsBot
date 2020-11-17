import * as Discord from 'discord.js';
import { PNG } from 'pngjs';
import fetch from 'node-fetch';

import { Command } from '../command';
import * as logger from '../logger';
import { Color } from '../utils';

interface PxlsInfo {
  canvasCode: string;
  width: number;
  height: number;
  palette: string[];
  heatmapCooldown: number;
}

/**
 * Gets Pxls information.
 * @returns {Promise<PxlsInfo>} The info.
 */
async function getInfo(): Promise<PxlsInfo> {
  const reqURL = 'https://pxls.space/info';
  const response = await fetch(reqURL);
  if (!response.ok) {
    // TODO: Add configurable local fallback
    logger.error('Could not GET', reqURL, response.statusText);
    return null;
  }
  return response.json() as unknown as PxlsInfo;
}

enum BoardType {
  Normal,
  Heatmap,
  Virginmap,
  Placemap
}

/**
 * Gets the board by type.
 * @param type The board type.
 * @returns {Promise<Buffer | null>} The board data.
 */
async function getBoard(type: BoardType): Promise<Buffer | null> {
  // TODO: Configurable board source
  let reqURL = 'https://pxls.space/';
  switch (type) {
    case BoardType.Normal: {
      reqURL += 'boarddata';
      break;
    }
    case BoardType.Heatmap: {
      reqURL += 'heatmap';
      break;
    }
    case BoardType.Virginmap: {
      reqURL += 'virginmap';
      break;
    }
    case BoardType.Placemap: {
      reqURL += 'placemap';
      break;
    }
  }
  const response = await fetch(reqURL);
  if (!response.ok) {
    // TODO: Add configurable local fallback
    logger.error('Could not GET', reqURL, response.statusText);
    return null;
  }
  return response.buffer();
}

const heatmapColor = new Color(205, 92, 92);
const virginmapColor = new Color(0, 255, 0);
const placemapColor = Color.rainbow.white;

async function execute(client: Discord.Client, message: Discord.Message): Promise<void> {
  const args = message.content.split(' ');
  const embed = new Discord.MessageEmbed();
  embed.setTimestamp();
  let type: BoardType;
  if (/h(eat)?m(ap)?/.test(args[1]?.toLowerCase())) {
    embed.setColor(heatmapColor.toColorResolvable());
    embed.setTitle('Pxls Heatmap');
    type = BoardType.Heatmap;
  } else if (/v(irgin)?m(ap)?/.test(args[1]?.toLowerCase())) {
    embed.setColor(virginmapColor.toColorResolvable());
    embed.setTitle('Pxls Virginmap');
    type = BoardType.Virginmap;
  } else if (/p(lace)?m(ap)?/.test(args[1]?.toLowerCase())) {
    embed.setColor(placemapColor.toColorResolvable());
    embed.setTitle('Pxls Placemap');
    type = BoardType.Placemap;
  } else {
    embed.setColor(new Color(0, 127, 255).toColorResolvable());
    embed.setTitle('Pxls Board');
    type = BoardType.Normal;
  }
  const info = await getInfo();
  if (info == null) {
    embed.setDescription('Could not get Pxls information.');
    await message.channel.send(embed);
    return;
  }
  const boardData = await getBoard(type);
  if (boardData == null) {
    embed.setDescription('Could not get the board data.');
    await message.channel.send(embed);
    return;
  }
  const colorPalette = info.palette.map(hex => Color.fromHex(hex));
  const png = new PNG({
    width: info.width,
    height: info.height,
    inputHasAlpha: true
  });
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (y * png.width + x) << 2;
      const pixel = boardData[idx >> 2];
      /* eslint-disable space-infix-ops, computed-property-spacing, no-multi-spaces */
      switch (type) {
        case BoardType.Normal: {
          if (pixel === 0xFF) {
            png.data[idx+3] = 0;
          } else {
            const { red, green, blue, alpha } = colorPalette[pixel];
            png.data[idx  ] = red;
            png.data[idx+1] = green;
            png.data[idx+2] = blue;
            png.data[idx+3] = alpha;
          }
          break;
        }
        case BoardType.Heatmap: {
          // TODO: Heatmap opacity
          const { red, green, blue, alpha } = heatmapColor;
          png.data[idx  ] = red * (pixel / 0xFF);
          png.data[idx+1] = green * (pixel / 0xFF);
          png.data[idx+2] = blue * (pixel / 0xFF);
          png.data[idx+3] = alpha;
          break;
        }
        case BoardType.Virginmap: {
          const { red, green, blue, alpha } = pixel === 0xFF ? virginmapColor : Color.rainbow.black;
          png.data[idx  ] = red;
          png.data[idx+1] = green;
          png.data[idx+2] = blue;
          png.data[idx+3] = alpha;
          break;
        }
        case BoardType.Placemap: {
          png.data[idx  ] = 255;
          png.data[idx+1] = 255;
          png.data[idx+2] = 255;
          png.data[idx+3] = pixel === 0xFF ? 0 : 255;
          break;
        }
      }
      /* eslint-enable space-infix-ops, computed-property-spacing, no-multi-spaces */
    }
  }
  const attachment = new Discord.MessageAttachment(PNG.sync.write(png.pack()), 'boarddata.png');
  embed.attachFiles([attachment]);
  embed.setImage('attachment://boarddata.png');
  await message.channel.send(embed);
}

export const command = new Command({
  id: 'board',
  name: 'Board',
  category: 'Pxls',
  description: 'Sends an image of the board.',
  usage: 'board [heatmap | virginmap | placemap]',
  aliases: ['board', 'boarddata', 'boardmap', 'canvas']
});
command.execute = execute;
