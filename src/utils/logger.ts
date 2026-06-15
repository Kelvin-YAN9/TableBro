import pino from 'pino';

const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level: logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  },
});

export class Logger {
  static error(message: string, meta?: any) {
    logger.error(meta, message);
  }

  static warn(message: string, meta?: any) {
    logger.warn(meta, message);
  }

  static info(message: string, meta?: any) {
    logger.info(meta, message);
  }

  static debug(message: string, meta?: any) {
    logger.debug(meta, message);
  }
}