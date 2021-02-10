import * as pg from 'pg';

/** A database connection pool, set during initialization. */
export let database: pg.Pool;

/** Gets the database pool. */
export function getPool(): pg.Pool {
  return database;
}

/**
 * Gets a database pool connection.
 */
export function getConnection(): Promise<pg.PoolClient> {
  return database.connect();
}

/**
 * Creates a database pool connection, runs a function with this connection,
 * and finally releases the connection once it's done.
 * @param fn The function to run with the connection.
 * @param rest Other arguments passed to the function.
 */
export async function withConnection<A extends unknown[], T = unknown>(
  fn: (connection: pg.PoolClient, ...rest: A) => T,
  ...rest: A
): Promise<T> {
  let connection: pg.PoolClient;
  try {
    connection = await getConnection();
    return fn(connection, ...rest);
  } finally {
    if (connection != null) {
      connection.release();
    }
  }
}

/** Initializes the database pool. */
export function init(config: pg.PoolConfig): void {
  database = new pg.Pool(config);
}
