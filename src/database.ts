import * as pg from 'pg';

/**
 * A database connection pool, set during initialization.
 * @property {pg.Pool}
 */
export let database: pg.Pool;

/**
 * Gets the database pool.
 * @returns {pg.Pool}
 */
export function getPool(): pg.Pool {
  return database;
}

/**
 * Gets a database pool connection.
 * @returns {pg.Pool}
 */
export function getConnection(): Promise<pg.PoolClient> {
  return database.connect();
}

/**
 * Initializes the database pool.
 * @param config {pg.PoolConfig}
 */
export function init(config: pg.PoolConfig): void {
  database = new pg.Pool(config);
}
