import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sources = [
    {
        label: 'Market API',
        basePath: '/api/market',
        file: 'src/endpoints/market.js',
    },
    {
        label: 'Wallet API',
        basePath: '/api/wallet',
        file: 'src/endpoints/wallet.js',
    },
];

const staticRoutes = [
    {
        label: 'Public health API',
        routes: [{ method: 'GET', path: '/api/health' }],
    },
];

function parseArgs(argv) {
    const options = {
        out: process.env.MARKETPLACE_API_REFERENCE_OUT || '',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--out') {
            const outPath = argv[index + 1] || '';
            if (!outPath || outPath.startsWith('--')) {
                throw new Error('Missing value for --out');
            }
            options.out = outPath;
            index += 1;
            continue;
        }
        if (arg.startsWith('--out=')) {
            const outPath = arg.slice('--out='.length);
            if (!outPath) {
                throw new Error('Missing value for --out');
            }
            options.out = outPath;
            continue;
        }
        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }

    options.out = String(options.out || '').trim();
    return options;
}

function printHelp() {
    console.log(`Usage: npm run marketplace:export:api -- [--out ./docs/marketplace-api-reference.md]

Generates a Markdown reference for the current marketplace, wallet, and health MVP APIs.
If --out is omitted, the Markdown is printed to stdout.`);
}

function normalizeRoutePath(routePath) {
    if (routePath === '/' || routePath === '') {
        return '';
    }
    return routePath.startsWith('/') ? routePath : `/${routePath}`;
}

function parseRouterRoutes(source, basePath) {
    const pattern = /router\.(get|post|patch|put|delete)\(\s*['"`]([^'"`]+)['"`]/g;
    const routes = [];
    let match;

    while ((match = pattern.exec(source)) !== null) {
        routes.push({
            method: match[1].toUpperCase(),
            path: `${basePath}${normalizeRoutePath(match[2])}`,
        });
    }

    return routes;
}

function formatRoutes(routes) {
    const methodWidth = Math.max(...routes.map(route => route.method.length), 6);
    return routes
        .map(route => `${route.method.padEnd(methodWidth)} ${route.path}`)
        .join('\n');
}

export async function generateMarketplaceApiReference({ generatedAt = new Date().toISOString() } = {}) {
    const sections = [];

    for (const source of sources) {
        const sourceText = await readFile(path.join(rootDirectory, source.file), 'utf8');
        const routes = parseRouterRoutes(sourceText, source.basePath);
        sections.push({
            label: source.label,
            routes,
        });
    }

    sections.push(...staticRoutes);

    const lines = [
        '# Marketplace API Reference',
        '',
        `Generated at: ${generatedAt}`,
        '',
        'This file is generated from the local MVP route implementation. Regenerate it with `npm run marketplace:export:api`.',
        '',
    ];

    for (const section of sections) {
        lines.push(`## ${section.label}`, '');
        lines.push('```text');
        lines.push(formatRoutes(section.routes));
        lines.push('```', '');
    }

    return `${lines.join('\n').trimEnd()}\n`;
}

export async function run(argv = process.argv.slice(2)) {
    const options = parseArgs(argv);
    if (options.help) {
        printHelp();
        return;
    }

    const markdown = await generateMarketplaceApiReference();
    if (options.out) {
        const outPath = path.resolve(rootDirectory, options.out);
        await mkdir(path.dirname(outPath), { recursive: true });
        await writeFile(outPath, markdown, 'utf8');
        console.log(`Marketplace API reference written to ${path.relative(rootDirectory, outPath)}`);
        return;
    }

    process.stdout.write(markdown);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    run().catch(error => {
        console.error(error.message || error);
        process.exit(1);
    });
}
