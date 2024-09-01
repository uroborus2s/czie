import path from 'node:path';
import sqlite3 from 'sqlite3';
import { type Database, open } from 'sqlite';
import type { ContextService, ServiceConstructor } from '@wps/types-context';

export interface SqliteService extends ContextService {
  getConnect(dbFile: string): Promise<Database>;

  closeConnection(name: string): Promise<unknown>;

  insertData(
    sqlite: Database,
    table: string,
    datas: Array<Record<string, any>>,
  ): Promise<void>;

  createAndInsertTable(
    db: Database,
    tableName: string,
    data: any[],
    primaryKey: string,
  ): Promise<void>;

  createTableFromData(
    db: Database,
    tableName: string,
    data: any[],
    primaryKey: string,
  ): Promise<void>;

  insertDataIntoTable(
    sqlite: Database,
    tableName: string,
    datas: any[],
  ): Promise<void>;
}

export const createSqliteService: ServiceConstructor = (
  serviceName,
  { logger },
): SqliteService => {
  logger.info(`创建${serviceName}对象`);
  const sqliteDbs: Record<string, Database> = {};
  const init = () => Promise.resolve();

  const getConnect = async (dbFile: string) => {
    try {
      const dbName = path.basename(dbFile, '.db');
      let sqliteDB = sqliteDbs[dbName];
      if (!sqliteDB) {
        sqliteDB = await open({
          filename: dbFile,
          driver: sqlite3.Database,
        });
        sqliteDbs[dbName] = sqliteDB;
        logger.info(`Sqlite 数据库${dbFile}连接成功！`);
      }
      return sqliteDB;
    } catch (e: unknown) {
      let msg = `Sqlite 数据库${dbFile}连接失败！错误原因:`;
      if (e instanceof Error) {
        logger.debug(e.stack);
        msg = `${msg}${e.message}`;
      }
      logger.info(msg);
      throw e;
    }
  };

  const closeConnection = async (name: string) => {
    const sqliteDB = sqliteDbs[name];
    if (sqliteDB) {
      try {
        await sqliteDB.close();
        delete sqliteDbs[name];
        logger.info(`${name}数据连接关闭成功！`);
      } catch (e) {
        logger.info(`${name}数据连接关闭失败！`);
      }
    }
    return Promise.resolve();
  };

  const close = () => {
    const dbNames = Object.keys(sqliteDbs);
    if (dbNames && dbNames.length > 0) {
      Promise.all(
        dbNames.map((name) =>
          sqliteDbs[name]
            .close()
            .then(() => logger.info(`${name} 连接关闭成功！`))
            .catch(() => logger.error(`${name} 连接关闭成功！`)),
        ),
      ).catch((reason) => logger.error(reason));
    }
    return Promise.resolve();
  };

  // 检查表是否存在
  const tableExists = async (
    db: Database,
    tableName: string,
  ): Promise<boolean> => {
    const query = `SELECT name
                   FROM sqlite_master
                   WHERE type = 'table'
                     AND name = '${tableName}'`;
    const result = await db.get(query);
    return result !== undefined;
  };

  // 创建表
  const createTableFromData = async (
    db: Database,
    tableName: string,
    data: any[],
    primaryKey: string,
  ) => {
    const columns = Object.keys(data[0])
      .map((key) => {
        if (key === primaryKey) {
          return `${key} TEXT PRIMARY KEY`;
        }
        return `${key} TEXT`;
      })
      .join(', ');
    const createTableQuery = `CREATE TABLE IF NOT EXISTS ${tableName}
                              (
                                  ${columns}
                              )`;

    await db.run(createTableQuery);
    logger.info(
      `Table ${tableName} created successfully with primary key on ${primaryKey}.`,
    );
  };

  // 清空表中的数据
  const clearTable = async (db: Database, tableName: string) => {
    const clearTableQuery = `DELETE
                             FROM ${tableName}`;
    await db.run(clearTableQuery);
    logger.info(`Table ${tableName} cleared successfully.`);
  };

  // 插入数据到表中
  const insertDataIntoTable = async (
    sqlite: Database,
    tableName: string,
    datas: any[],
  ) => {
    for (const data of datas) {
      try {
        const keys = Object.keys(data);
        const placeholders = keys.map(() => '?').join(',');
        const query = await sqlite.prepare(
          `INSERT OR
           REPLACE
           INTO ${tableName} (${keys.join(',')})
           VALUES (${placeholders})`,
        );
        await query.run(Object.values(data));
        await query.finalize();
      } catch (e:any) {
        logger.error(`${JSON.stringify(data)}数据插入失败:${e.message}`);
        throw e
      }
    }

    console.log(`Data inserted into ${tableName} successfully.`);
  };

  const insertData = async (
    sqlite: Database,
    table: string,
    datas: Array<Record<string, any>>,
  ) => {
    if (datas.length > 0) {
      await clearTable(sqlite, table);

      await insertDataIntoTable(sqlite, table, datas);
    }
  };

  // 检查表中是否有数据
  const tableHasData = async (
    db: Database,
    tableName: string,
  ): Promise<boolean> => {
    const query = `SELECT COUNT(*) as count
                   FROM ${tableName}`;
    const result = await db.get(query);
    return result.count > 0;
  };

  /*
   * 创建表并插入数据
   * 如果表不存在，则创建表并插入数据
   * 如果表存在，且有数据，则清空表，然后插入数据
   * 如果表存在，但没有数据，则直接插入数据
   *
   */
  const createAndInsertTable = async (
    db: Database,
    tableName: string,
    data: any[],
    primaryKey: string,
  ) => {
    try {
      // 检查表是否存在
      const exists = await tableExists(db, tableName);

      if (!exists) {
        // 如果表不存在，则创建表
        await createTableFromData(db, tableName, data, primaryKey);
      } else {
        // 如果表存在，检查表中是否有数据
        const hasData = await tableHasData(db, tableName);
        if (hasData) {
          // 如果有数据，先清空表
          await clearTable(db, tableName);
        }
      }
      // 插入数据
      await insertDataIntoTable(db, tableName, data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return {
    close,
    init,
    getConnect,
    closeConnection,
    insertData,
    createAndInsertTable,
    insertDataIntoTable,
    createTableFromData,
  };
};
