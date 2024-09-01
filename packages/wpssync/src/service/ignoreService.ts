import type { IgnoreService, ServiceConstructor } from '@wps/types-context';
import { readFileAsObjects } from '@wps/core';
import path from 'node:path';
import process from 'node:process';

export const createIgnoreService: ServiceConstructor = (
  serviceName: string,
  options,
): IgnoreService => {
  const { logger } = options;

  logger.info(`创建服务${serviceName}...`);

  const mainDir = require.main
    ? path.dirname(require.main.filename)
    : process.cwd();
  const fileDir = path.resolve(mainDir, '..');

  const init = () => Promise.resolve();

  const close = () => Promise.resolve();

  const ignores = async () => {
    const ignors = await readFileAsObjects(
      path.join(fileDir, '.accountignore'),
      (line: string) => {
        const parts = line.split('/');
        return { name: parts[0], id: parts[1] };
      },
    );
    return ignors;
  };

  return { init, close, ignores };
};
