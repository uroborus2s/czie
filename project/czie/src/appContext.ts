import type{  Context,LocalService } from '@wps/types-context';
import { type SqliteService } from '@wps/sqlite';
import { type SyncService } from '@wps/wpssync';
import type {
  KoaAppService,
  RemoteService,
  WpsService,
  RedisService,
} from '@wps/core';
import { type Config } from './data/createConfig';

export interface AppContext extends Context<Config> {
  sqliteService: SqliteService;
  localService: LocalService;
  koaAppService: KoaAppService;
  syncService: SyncService;
  remoteService: RemoteService;
  wpsService: WpsService;
  redisService: RedisService;
}
