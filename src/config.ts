import * as fs from 'fs';
import { join as joinPath } from 'path';

import { PresenceData } from 'discord.js';
import { PoolConfig } from 'pg';

// TODO(netux): switch to convict <https://www.npmjs.com/package/convict>
// once @types/convict fixes nesting issues.
type Config = {
  token: string,
  prefix: string,
  database: PoolConfig,
  eventsPath?: string,
  commandsPath?: string,
  reconnectTimeout?: number,
  gameURL?: {
    secure?: boolean,
    host?: string
  },
  logging?: {
    saveToFile?: boolean,
    level?: string
  },
  presence?: PresenceData
};

let conf: Config;
try {
  const confJSON = fs.readFileSync(joinPath(__dirname, '../config.json'), 'utf-8');
  conf = JSON.parse(confJSON) as Config;
} catch (err) {
  console.error('Cannot read configuration file', err);
  process.exit(1);
}

export function get<K extends keyof Config, D = undefined>(key: K, def: D = undefined): Config[K] | D {
  const value = conf[key];
  return typeof value === 'undefined' ? def : value;
}

export function getGameURL(): string {
  return `http${get('gameURL')?.secure ?? true ? 's' : ''}://${get('gameURL')?.host ?? 'pxls.space'}`;
}
