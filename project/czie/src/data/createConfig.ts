import path from 'node:path';
import { createBaseConfig, createKoaConfig, type KoaConfig } from '@wps/core';
import {
  createLocalAccountConfig,
  createLocalDeptConfig,
  createNoAddUserToWpsConfig,
  type LocalAccountConfig,
  type LocalDeptConfig,
  type NoAddUserToWpsConfig,
} from '@wps/wpssync';
import type { BaseConfig } from '@wps/types-context';

export interface Config
  extends BaseConfig,
    KoaConfig,
    LocalAccountConfig,
    LocalDeptConfig,
    NoAddUserToWpsConfig {}

const dir = path.resolve(__dirname, '../../');

export default (): Config => ({
  ...createBaseConfig(dir),
  ...createKoaConfig(),
  ...createLocalAccountConfig(dir),
  ...createLocalDeptConfig(dir),
  ...createNoAddUserToWpsConfig(),
});
