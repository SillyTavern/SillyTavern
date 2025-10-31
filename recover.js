import process from 'node:process';
import { setConfigFilePath } from './src/util.js';

const userAccount = process.argv[2];
const userPassword = process.argv[3];
const configPath = './config.yaml';

if (!userAccount) {
    console.error('A tool for recovering lost SillyTavern accounts. Uses a "dataRoot" setting from config.yaml file.');
    console.error('Usage: node recover.js [account] (password)');
    console.error('Example: node recover.js admin password');
    process.exit(1);
}

async function main() {
    setConfigFilePath(configPath);
    const { recoverPassword } = await import('./src/recover-password.js');
    await recoverPassword(configPath, userAccount, userPassword);
}

main();
