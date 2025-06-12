import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import color from 'chalk';
import _ from 'lodash';
import { serverDirectory } from './server-directory.js';
import { keyToEnv, setConfigFilePath } from './util.js';

const keyMigrationMap = [
    {
        oldKey: 'disableThumbnails',
        newKey: 'thumbnails.enabled',
        migrate: (value) => !value,
    },
    {
        oldKey: 'thumbnailsQuality',
        newKey: 'thumbnails.quality',
        migrate: (value) => value,
    },
    {
        oldKey: 'avatarThumbnailsPng',
        newKey: 'thumbnails.format',
        migrate: (value) => (value ? 'png' : 'jpg'),
    },
    {
        oldKey: 'disableChatBackup',
        newKey: 'backups.chat.enabled',
        migrate: (value) => !value,
    },
    {
        oldKey: 'numberOfBackups',
        newKey: 'backups.common.numberOfBackups',
        migrate: (value) => value,
    },
    {
        oldKey: 'maxTotalChatBackups',
        newKey: 'backups.chat.maxTotalBackups',
        migrate: (value) => value,
    },
    {
        oldKey: 'chatBackupThrottleInterval',
        newKey: 'backups.chat.throttleInterval',
        migrate: (value) => value,
    },
    {
        oldKey: 'enableExtensions',
        newKey: 'extensions.enabled',
        migrate: (value) => value,
    },
    {
        oldKey: 'enableExtensionsAutoUpdate',
        newKey: 'extensions.autoUpdate',
        migrate: (value) => value,
    },
    {
        oldKey: 'extras.disableAutoDownload',
        newKey: 'extensions.models.autoDownload',
        migrate: (value) => !value,
    },
    {
        oldKey: 'extras.classificationModel',
        newKey: 'extensions.models.classification',
        migrate: (value) => value,
    },
    {
        oldKey: 'extras.captioningModel',
        newKey: 'extensions.models.captioning',
        migrate: (value) => value,
    },
    {
        oldKey: 'extras.embeddingModel',
        newKey: 'extensions.models.embedding',
        migrate: (value) => value,
    },
    {
        oldKey: 'extras.speechToTextModel',
        newKey: 'extensions.models.speechToText',
        migrate: (value) => value,
    },
    {
        oldKey: 'extras.textToSpeechModel',
        newKey: 'extensions.models.textToSpeech',
        migrate: (value) => value,
    },
    {
        oldKey: 'minLogLevel',
        newKey: 'logging.minLogLevel',
        migrate: (value) => value,
    },
    {
        oldKey: 'cardsCacheCapacity',
        newKey: 'performance.memoryCacheCapacity',
        migrate: (value) => `${value}mb`,
    },
    {
        oldKey: 'cookieSecret',
        newKey: 'cookieSecret',
        migrate: () => void 0,
        remove: true,
    },
    {
        oldKey: 'autorun',
        newKey: 'browserLaunch.enabled',
        migrate: (value) => value,
    },
    {
        oldKey: 'autorunHostname',
        newKey: 'browserLaunch.hostname',
        migrate: (value) => value,
    },
    {
        oldKey: 'autorunPortOverride',
        newKey: 'browserLaunch.port',
        migrate: (value) => value,
    },
    {
        oldKey: 'avoidLocalhost',
        newKey: 'browserLaunch.avoidLocalhost',
        migrate: (value) => value,
    },
];

/**
 * Gets all keys from an object recursively.
 * @param {object} obj Object to get all keys from
 * @param {string} prefix Prefix to prepend to all keys
 * @returns {string[]} Array of all keys in the object
 */
function getAllKeys(obj, prefix = '') {
    if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) {
        return [];
    }

    return _.flatMap(Object.keys(obj), key => {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            return getAllKeys(obj[key], newPrefix);
        } else {
            return [newPrefix];
        }
    });
}

/**
 * Compares the current config.yaml with the default config.yaml and adds any missing values.
 * @param {string} configPath Path to config.yaml
 */
export function addMissingConfigValues(configPath) {
    try {
        const defaultConfig = yaml.parse(fs.readFileSync(path.join(serverDirectory, './default/config.yaml'), 'utf8'));
        let config = yaml.parse(fs.readFileSync(configPath, 'utf8'));

        // Migrate old keys to new keys
        const migratedKeys = [];
        for (const { oldKey, newKey, migrate, remove } of keyMigrationMap) {
            // Migrate environment variables
            const oldEnvKey = keyToEnv(oldKey);
            const newEnvKey = keyToEnv(newKey);
            if (process.env[oldEnvKey] && !process.env[newEnvKey]) {
                const oldValue = process.env[oldEnvKey];
                const newValue = migrate(oldValue);
                process.env[newEnvKey] = newValue;
                delete process.env[oldEnvKey];
                console.warn(color.yellow(`Warning: Using a deprecated environment variable: ${oldEnvKey}. Please use ${newEnvKey} instead.`));
                console.log(`Redirecting ${color.blue(oldEnvKey)}=${oldValue} -> ${color.blue(newEnvKey)}=${newValue}`);
            }

            if (_.has(config, oldKey)) {
                if (remove) {
                    _.unset(config, oldKey);
                    migratedKeys.push({
                        oldKey,
                        newValue: void 0,
                    });
                    continue;
                }

                const oldValue = _.get(config, oldKey);
                const newValue = migrate(oldValue);
                _.set(config, newKey, newValue);
                _.unset(config, oldKey);

                migratedKeys.push({
                    oldKey,
                    newKey,
                    oldValue,
                    newValue,
                });
            }
        }

        // Get all keys from the original config
        const originalKeys = getAllKeys(config);

        // Use lodash's defaultsDeep function to recursively apply default properties
        config = _.defaultsDeep(config, defaultConfig);

        // Get all keys from the updated config
        const updatedKeys = getAllKeys(config);

        // Find the keys that were added
        const addedKeys = _.difference(updatedKeys, originalKeys);

        if (addedKeys.length === 0 && migratedKeys.length === 0) {
            return;
        }

        if (addedKeys.length > 0) {
            console.log('Adding missing config values to config.yaml:', addedKeys);
        }

        if (migratedKeys.length > 0) {
            console.log('Migrating config values in config.yaml:', migratedKeys);
        }

        fs.writeFileSync(configPath, yaml.stringify(config));
    } catch (error) {
        console.error(color.red('FATAL: Could not add missing config values to config.yaml'), error);
    }
}

/**
 * Performs early initialization tasks before the server starts.
 * @param {string} configPath Path to config.yaml
 */
export function initConfig(configPath) {
    setConfigFilePath(configPath);
    addMissingConfigValues(configPath);
}
