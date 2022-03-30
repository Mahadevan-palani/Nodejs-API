require('dotenv').config();
const convict = require('convict');

const config = convict({
  env: {
    format: ['prod', 'dev', 'test', 'loc', 'prf', 'sit', 'uat', 'sit2'],
    default: process.env.ENV_VAL,
    arg: 'NODE_ENV',
    env: 'NODE_ENV'
  },
  SERVER_HOST: {
    format: String,
    default: 'from default',
    arg: 'SERVER_HOST',
    env: 'SERVER_HOST'
  },
  SERVER_PORT: {
    format: Number,
    default: 'from default',
    arg: 'SERVER_PORT',
    env: 'SERVER_PORT'
  }, 
  DB_URL: {
    format: String,
    default: 'from default',
    arg: 'DB_URL',
    env: 'DB_URL'
  },
  KAFKA_SERVER: {
    format: String,
    default: 'from default',
    arg: 'KAFKA_SERVER',
    env: 'KAFKA_SERVER'
  },
  LOG_PATH: {
    format: String,
    default: 'from default',
    arg: 'LOG_PATH',
    env: 'LOG_PATH'
  },
  KAFKA_PARTITION_COUNT: {
    format: Number,
    default: 'from default',
    arg: 'KAFKA_PARTITION_COUNT',
    env: 'KAFKA_PARTITION_COUNT'
  },
  API_MANAGER_URL: {
    format: Array,
    default: 'from default',
    arg: 'API_MANAGER_URL',
    env: 'API_MANAGER_URL'
  },
  RESET_PASSWORD_LINK: {
    format: String,
    default: 'from default',
    arg: 'RESET_PASSWORD_LINK',
    env: 'RESET_PASSWORD_LINK'
  },
  INVESTOR_ONBOARDING_TEMP_LOGIN_URL: {
    format: String,
    default: 'from default',
    arg: 'INVESTOR_ONBOARDING_TEMP_LOGIN_URL',
    env: 'INVESTOR_ONBOARDING_TEMP_LOGIN_URL'
  },
  AGENT_ONBOARDING_TEMP_LOGIN_URL: {
    format: String,
    default: 'from default',
    arg: 'AGENT_ONBOARDING_TEMP_LOGIN_URL',
    env: 'AGENT_ONBOARDING_TEMP_LOGIN_URL'
  },
  ADMIN_ONBOARDING_TEMP_LOGIN_URL: {
    format: String,
    default: 'from default',
    arg: 'ADMIN_ONBOARDING_TEMP_LOGIN_URL',
    env: 'ADMIN_ONBOARDING_TEMP_LOGIN_URL'
  },
  RTN_ALLOTMENT: {
    format: Boolean,
    default: 'from default',
    arg: 'RTN_ALLOTMENT',
    env: 'RTN_ALLOTMENT'
  },
  RTN_CORPORATE_ACTION: {
    format: Boolean,
    default: 'from default',
    arg: 'RTN_CORPORATE_ACTION',
    env: 'RTN_CORPORATE_ACTION'
  }
});

let configFilePath = process.argv[2];

console.log('configFilePath ->', configFilePath)

if (configFilePath) {
  module.exports = require(configFilePath);
} else {
  const env = config.get('env');
  config.loadFile(`./common/config/${env}.json`);

  config.validate({ allowed: 'strict' });

  module.exports = config.getProperties();
}