import { createAppContext, createCasRouter } from "@wps/core";
import { scheduleJob } from "node-schedule";
import { createSqliteService } from "@wps/sqlite";
import {
  createAfterSyncService,
  createDeleteUserService,
  createDeletionVerifyService,
  createLocalDeptService,
  createLocalService,
  createRemoveDuplicatesService,
  createSyncService,
  createWpsServiceV2 as createWpsService
} from "@wps/wpssync";
import createConfig, { type Config } from "./data/createConfig";
import { type AppContext } from "./appContext";
import { createRemoteService } from "./data/createRemoteService";
import { TemplateCas } from "./api/templateCas";
import path from "node:path";

createAppContext<Config, AppContext>("kmust server", createConfig(), [
  createAfterSyncService,
  createWpsService,
  createSqliteService,
  createLocalService,
  createLocalDeptService,
  createSyncService,
  createRemoteService,
  createDeleteUserService,
  createDeletionVerifyService,
  createRemoveDuplicatesService
])
  .then((appContext) => {
    const { logger, config, koaAppService, syncService, redisService } =
      appContext;

    const templateCas = new TemplateCas({
      logger,
      config,
      redisClient: redisService.redis
    });
    const casRouter = createCasRouter(templateCas);

    koaAppService
      .createWebApp({
        koaStaticServer: path.resolve(__dirname, ".."),
        routers: [casRouter]
      })
      .then();

    const task = async () => {
      await syncService.syncUserAndDeptsV1();
    };
    syncService.syncTask(new Date(), "api同步", task).then();
    scheduleJob("1 45 23 * * *", (fireDate: Date) =>
      syncService.syncTask(fireDate, "api同步", task)
    );
  })
  .catch((reason) => {
    console.log(reason);
  })
  .finally(() => {
  });
