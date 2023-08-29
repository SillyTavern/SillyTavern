const fs = require('fs');
const path = require('path');
const config = require(path.join(process.cwd(), './config.conf'));
const contentDirectory = path.join(process.cwd(), 'default/content');
const contentLogPath = path.join(contentDirectory, 'content.log');
const contentIndexPath = path.join(contentDirectory, 'index.json');

const unsafeExtensions = [
    ".php",
    ".exe",
    ".com",
    ".dll",
    ".pif",
    ".application",
    ".gadget",
    ".msi",
    ".jar",
    ".cmd",
    ".bat",
    ".reg",
    ".sh",
    ".py",
    ".js",
    ".jse",
    ".jsp",
    ".pdf",
    ".html",
    ".htm",
    ".hta",
    ".vb",
    ".vbs",
    ".vbe",
    ".cpl",
    ".msc",
    ".scr",
    ".sql",
    ".iso",
    ".img",
    ".dmg",
    ".ps1",
    ".ps1xml",
    ".ps2",
    ".ps2xml",
    ".psc1",
    ".psc2",
    ".msh",
    ".msh1",
    ".msh2",
    ".mshxml",
    ".msh1xml",
    ".msh2xml",
    ".scf",
    ".lnk",
    ".inf",
    ".reg",
    ".doc",
    ".docm",
    ".docx",
    ".dot",
    ".dotm",
    ".dotx",
    ".xls",
    ".xlsm",
    ".xlsx",
    ".xlt",
    ".xltm",
    ".xltx",
    ".xlam",
    ".ppt",
    ".pptm",
    ".pptx",
    ".pot",
    ".potm",
    ".potx",
    ".ppam",
    ".ppsx",
    ".ppsm",
    ".pps",
    ".ppam",
    ".sldx",
    ".sldm",
    ".ws",
];

function checkForNewContent() {
    try {
        if (config.skipContentCheck) {
            return;
        }

        const contentLog = getContentLog();
        const contentIndexText = fs.readFileSync(contentIndexPath, 'utf8');
        const contentIndex = JSON.parse(contentIndexText);

        for (const contentItem of contentIndex) {
            // If the content item is already in the log, skip it
            if (contentLog.includes(contentItem.filename)) {
                continue;
            }

            contentLog.push(contentItem.filename);
            const contentPath = path.join(contentDirectory, contentItem.filename);

            if (!fs.existsSync(contentPath)) {
                console.log(`Content file ${contentItem.filename} is missing`);
                continue;
            }

            const contentTarget = getTargetByType(contentItem.type);

            if (!contentTarget) {
                console.log(`Content file ${contentItem.filename} has unknown type ${contentItem.type}`);
                continue;
            }

            const targetPath = path.join(process.cwd(), contentTarget, contentItem.filename);

            if (fs.existsSync(targetPath)) {
                console.log(`Content file ${contentItem.filename} already exists in ${contentTarget}`);
                continue;
            }

            fs.cpSync(contentPath, targetPath, { recursive: true, force: false });
            console.log(`Content file ${contentItem.filename} copied to ${contentTarget}`);
        }

        fs.writeFileSync(contentLogPath, contentLog.join('\n'));
    } catch (err) {
        console.log('Content check failed', err);
    }
}

function getTargetByType(type) {
    switch (type) {
        case 'character':
            return 'public/characters';
        case 'sprites':
            return 'public/characters';
        case 'background':
            return 'public/backgrounds';
        case 'world':
            return 'public/worlds';
        case 'sound':
            return 'public/sounds';
        case 'avatar':
            return 'public/User Avatars';
        case 'theme':
            return 'public/themes';
        default:
            return null;
    }
}

function getContentLog() {
    if (!fs.existsSync(contentLogPath)) {
        return [];
    }

    const contentLogText = fs.readFileSync(contentLogPath, 'utf8');
    return contentLogText.split('\n');
}

module.exports = {
    checkForNewContent,
    unsafeExtensions,
}
