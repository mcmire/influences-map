const LOG_LEVELS = ["debug", "info"];
const LOG_LEVEL =
  process.env.LOG_LEVEL == null ||
  process.env.LOG_LEVEL === "" ||
  !LOG_LEVELS.includes(process.env.LOG_LEVEL)
    ? "info"
    : process.env.LOG_LEVEL;
const LOG_LEVEL_INDEX = LOG_LEVELS.indexOf(LOG_LEVEL);

const logger = {};
LOG_LEVELS.forEach((level) => {
  logger[level] = function (msg) {
    if (LOG_LEVEL_INDEX <= LOG_LEVELS.indexOf(level)) {
      console.log(msg);
    }
  };
});

logger.gt = function (level) {
  const index = LOG_LEVELS.indexOf(level);

  if (index > -1) {
    return index > LOG_LEVEL_INDEX;
  } else {
    throw new Error(`Unknown log level ${level}`);
  }
};

module.exports = logger;
