export {
  type LocalAccountConfig,
  createLocalService,
  createLocalAccountConfig,
} from './service/localService';

export {
  createLocalDeptConfig,
  createLocalDeptService,
  type LocalDeptConfig,
} from './service/localDeptService';

export {
  createDeletionVerifyService,
  type DeletionVerifyService,
} from './service/deletionVerifyService';

export {
  type DeleteUserService,
  type DeleteUserDBInfo,
  createDeleteUserService,
} from './service/deleteUserService';

export {
  createWriteExIdService,
  type WriteExIdService,
  type LocalOrgConfig,
  createLocalOrgConfig,
} from './service/writeExidService';

export {
  createSyncService,
  type SyncService,
  createNoAddUserToWpsConfig,
  type NoAddUserToWpsConfig,
} from './service/syncService';

export {
  createPrefixSyncToWpsUserService,
  type PrefixSyncToWpsUserService,
} from './service/prefixSyncToWpsUserService';

export {
  createRemoveDuplicatesService,
  type RemoveDuplicatesService,
} from './service/removeDuplicatesService';

export {
  createGroupService,
  type CreateGroupService,
} from './service/createGroupService';

export { equity, type EquityOptions } from './syncUtil';

export { createWpsService } from './service/wpsService';

export { createWpsService as createWpsServiceV2 } from './service/v2/wpsServiceV2';

export {
  createWpsService as createWpsServiceV7,
  type WpsService as WpsServiceV7,
} from './service/v7/wpsServiceV7';

export {
  createSyncService as createSyncServiceV2,
  type SyncService as SyncServiceV2,
} from './service/v2/syncServiceV2';

export { createLocalService as createExLocalService } from './service/v2/exLocalService';

export {
  createAfterSyncService,
  type AfterSyncService,
} from './service/afterSyncService';

export { createIgnoreService } from './service/ignoreService';

export {
  createWpsSubscriptionService,
  type WpsSubscriptionOptions,
  type WpsSubscriptionService,
  type SubOperateFunc,
} from './service/wpsSubscriptionService';
