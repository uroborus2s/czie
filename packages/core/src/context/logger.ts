import winston from 'winston';
import dayjs from 'dayjs';

const { createLogger, format, transports } = winston;
const { combine, timestamp, colorize, errors, splat, json } = format;
export const newLogger = (name: string, appid: string, logLevel?: string) => {
  const formats = [];
  if (timestamp)
    formats.push(
      timestamp({ format: () => dayjs().format('YYYY-MM-DD HH:mm:ss') }),
    );
  if (errors) formats.push(errors({ stack: true }));
  if (splat) formats.push(splat());
  if (json) formats.push(json());
  if (colorize) formats.push(colorize({ all: true }));
  return createLogger({
    format: combine?.(...formats),
    defaultMeta: { name, appid },
    transports: [
      new transports.Console({
        level: logLevel,
      }),
    ],
  });
};
