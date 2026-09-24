import crypto from 'node:crypto';

const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

/**
 * @typedef {object} EncryptedData
 * @property {string} salt Hex string of the salt used for key derivation
 * @property {string} iv Hex string of the initialization vector used for encryption
 * @property {string} encrypted Hex string of the encrypted data
 * @property {string} authTag Hex string of the authentication tag from encryption
 */

/**
 * Decrypts data encrypted with AES-256-OCB using the provided key.
 * The key is derived from the password using scrypt.
 * @param {EncryptedData} data Encrypted data in the format { salt, iv, encrypted, authTag }
 * @param {string} keyString Encryption key as a UTF-8 string
 * @returns {any} Decrypted data
 */
export function decryptObjectAes256(data, keyString) {
    const salt = new Uint8Array(Buffer.from(data.salt, 'hex'));
    const iv = new Uint8Array(Buffer.from(data.iv, 'hex'));
    const key = new Uint8Array(crypto.scryptSync(keyString, salt, KEY_LENGTH));
    const decipher = crypto.createDecipheriv('aes-256-ocb', key, iv, { authTagLength: 16 });
    decipher.setAuthTag(new Uint8Array(Buffer.from(data.authTag, 'hex')));
    const decrypted = decipher.update(data.encrypted, 'hex', 'utf8') + decipher.final('utf8');
    return JSON.parse(decrypted);
}

/**
 * Encrypts data using AES-256-OCB with the provided key.
 * The key is derived from the password using scrypt with a random salt.
 * @param {any} data JSON-serializable data to encrypt
 * @param {string} keyString Encryption key as a UTF-8 string
 * @returns {EncryptedData} Encrypted data in the format { salt, iv, encrypted, authTag }
 */
export function encryptObjectAes256(data, keyString) {
    const salt = new Uint8Array(crypto.randomBytes(SALT_LENGTH));
    const iv = new Uint8Array(crypto.randomBytes(12));
    const key = new Uint8Array(crypto.scryptSync(keyString, salt, KEY_LENGTH));
    const cipher = crypto.createCipheriv('aes-256-ocb', key, iv, { authTagLength: 16 });
    const encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex') + cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    const saltString = Buffer.from(salt).toString('hex');
    const ivString = Buffer.from(iv).toString('hex');
    return { salt: saltString, iv: ivString, encrypted, authTag };
}

/**
 * Checks if the given object is an encrypted data object by verifying it has the required properties and that they are valid hex strings.
 * @param {EncryptedData} data Data object to check
 * @returns {boolean} True if the data is in the format of encrypted data, false otherwise
 */
export function isEncryptedData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return false;
    }

    const requiredProps = ['salt', 'iv', 'encrypted', 'authTag'];
    for (const prop of requiredProps) {
        if (!Object.hasOwn(data, prop)) {
            return false;
        }
        const value = data[prop];
        if (typeof value !== 'string' || !/^[0-9a-fA-F]+$/.test(value)) {
            return false;
        }
    }

    return true;
}
