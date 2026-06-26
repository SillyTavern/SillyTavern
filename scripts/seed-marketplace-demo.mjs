import fs from 'node:fs';
import path from 'node:path';

import { sync as writeFileAtomicSync } from 'write-file-atomic';

const MARKET_STORE_FILE = 'market-assets.json';
const DEFAULT_CREATOR = 'demo-creator';

function printUsage(stream = process.stdout) {
    stream.write(`Usage: npm run marketplace:seed:demo -- --dataRoot <path> [--creator <handle>]

Seeds two listed demo marketplace assets into the explicit SillyTavern data root.
The script updates existing demo asset ids in place and preserves entitlements,
installs, reports, sales counts, and install counts.
`);
}

function parseArgs(argv) {
    const options = {
        dataRoot: process.env.MARKETPLACE_DEMO_DATA_ROOT || '',
        creator: process.env.MARKETPLACE_DEMO_CREATOR || DEFAULT_CREATOR,
        help: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }

        if (arg === '--dataRoot') {
            options.dataRoot = argv[index + 1] || '';
            index += 1;
            continue;
        }

        if (arg.startsWith('--dataRoot=')) {
            options.dataRoot = arg.slice('--dataRoot='.length);
            continue;
        }

        if (arg === '--creator') {
            options.creator = argv[index + 1] || '';
            index += 1;
            continue;
        }

        if (arg.startsWith('--creator=')) {
            options.creator = arg.slice('--creator='.length);
            continue;
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    options.dataRoot = String(options.dataRoot || '').trim();
    options.creator = String(options.creator || '').trim();
    return options;
}

function readStore(storePath) {
    if (!fs.existsSync(storePath)) {
        return {
            version: 1,
            assets: [],
            entitlements: [],
            installs: [],
            reports: [],
        };
    }

    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    return {
        version: 1,
        assets: Array.isArray(parsed.assets) ? parsed.assets : [],
        entitlements: Array.isArray(parsed.entitlements) ? parsed.entitlements : [],
        installs: Array.isArray(parsed.installs) ? parsed.installs : [],
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
    };
}

function createCharacterPayload() {
    return {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
            name: 'Mira the Harbor Oracle',
            description: 'A warm, practical oracle who reads tides, trade winds, and tavern rumors.',
            personality: 'Curious, observant, gently theatrical, and quick to turn clues into useful advice.',
            scenario: 'The user meets Mira in a lantern-lit harbor tavern where every table has a story.',
            first_mes: 'The tide brought you in at an interesting hour. Sit down, traveler. What are we solving tonight?',
            mes_example: '<START>\n{{user}}: Do you really see the future?\n{{char}}: Only the parts careless people leave floating on the surface.',
            creator_notes: 'Demo character seeded by the marketplace setup script.',
            system_prompt: '',
            post_history_instructions: '',
            alternate_greetings: [
                'I saved the corner table. It hears more secrets than the bar does.',
            ],
            tags: ['demo', 'oracle', 'tavern'],
            creator: 'SillyTavern demo seed',
            character_version: '1.0',
            extensions: {},
        },
    };
}

function createWorldBookPayload() {
    return {
        name: 'Clockwork City Lore',
        entries: {
            '0': {
                uid: 0,
                key: ['Clockwork City', 'brass district'],
                keysecondary: [],
                comment: 'Clockwork City overview',
                content: 'Clockwork City is built around a central brass tower that winds the public clocks, canal gates, and night markets every dawn.',
                constant: false,
                vectorized: false,
                selective: true,
                selectiveLogic: 0,
                addMemo: true,
                order: 100,
                position: 0,
                disable: false,
                excludeRecursion: false,
                preventRecursion: false,
                delayUntilRecursion: false,
                probability: 100,
                useProbability: false,
                depth: 4,
                group: '',
                groupOverride: false,
                groupWeight: 100,
                scanDepth: null,
                caseSensitive: null,
                matchWholeWords: null,
                automationId: '',
            },
            '1': {
                uid: 1,
                key: ['night market', 'glass tokens'],
                keysecondary: [],
                comment: 'Night market custom',
                content: 'At the night market, merchants trade in glass tokens stamped with tiny constellations. A cracked token is considered a promise unpaid.',
                constant: false,
                vectorized: false,
                selective: true,
                selectiveLogic: 0,
                addMemo: true,
                order: 110,
                position: 0,
                disable: false,
                excludeRecursion: false,
                preventRecursion: false,
                delayUntilRecursion: false,
                probability: 100,
                useProbability: false,
                depth: 4,
                group: '',
                groupOverride: false,
                groupWeight: 100,
                scanDepth: null,
                caseSensitive: null,
                matchWholeWords: null,
                automationId: '',
            },
        },
    };
}

function createDemoAssets(creator, timestamp) {
    const base = {
        creator_id: creator,
        language: 'en',
        content_rating: 'general',
        visibility: 'public',
        status: 'listed',
        rating_avg: 0,
        rating_count: 0,
        submitted_at: timestamp,
        approved_at: timestamp,
        listed_at: timestamp,
        reviewed_by: 'demo-seed',
        review_notes: '',
        created_at: timestamp,
        updated_at: timestamp,
    };

    return [
        {
            ...base,
            id: 'demo_character_mira',
            type: 'character_card',
            title: 'Mira the Harbor Oracle',
            summary: 'A free demo character card for testing browse, claim, and install flows.',
            description: 'Mira gives a new local marketplace an immediate character to inspect, claim, and install into a user library.',
            price_type: 'free',
            price_coins: 0,
            tags: ['demo', 'character', 'tavern'],
            metadata: {
                seeded_by: 'scripts/seed-marketplace-demo.mjs',
                demo: true,
            },
            normalized_payload: createCharacterPayload(),
        },
        {
            ...base,
            id: 'demo_world_clockwork',
            type: 'world_book',
            title: 'Clockwork City Lore',
            summary: 'A paid demo world book for testing coin grants, purchases, and installs.',
            description: 'Clockwork City gives admins a compact fixed-price asset to validate wallet grants and paid marketplace purchase flows.',
            price_type: 'fixed_price',
            price_coins: 25,
            tags: ['demo', 'world book', 'lore'],
            metadata: {
                seeded_by: 'scripts/seed-marketplace-demo.mjs',
                demo: true,
            },
            normalized_payload: createWorldBookPayload(),
        },
    ];
}

function mergeDemoAsset(existing, next) {
    if (!existing) {
        return {
            ...next,
            sales_count: 0,
            install_count: 0,
        };
    }

    return {
        ...existing,
        ...next,
        sales_count: Number(existing.sales_count || 0),
        install_count: Number(existing.install_count || 0),
        rating_avg: Number(existing.rating_avg || next.rating_avg || 0),
        rating_count: Number(existing.rating_count || next.rating_count || 0),
        created_at: existing.created_at || next.created_at,
        submitted_at: existing.submitted_at || next.submitted_at,
        approved_at: existing.approved_at || next.approved_at,
        listed_at: existing.listed_at || next.listed_at,
        updated_at: next.updated_at,
    };
}

function seedDemoMarketplace(options) {
    if (!options.dataRoot) {
        throw new Error('Missing required --dataRoot <path>');
    }
    if (!options.creator) {
        throw new Error('Missing creator handle');
    }

    const dataRoot = path.resolve(options.dataRoot);
    const storePath = path.join(dataRoot, MARKET_STORE_FILE);
    const timestamp = new Date().toISOString();
    const store = readStore(storePath);
    const demos = createDemoAssets(options.creator, timestamp);
    const byId = new Map(store.assets.map((asset, index) => [asset.id, { asset, index }]));

    let created = 0;
    let updated = 0;

    for (const demo of demos) {
        const existing = byId.get(demo.id);
        const merged = mergeDemoAsset(existing?.asset, demo);
        if (existing) {
            store.assets[existing.index] = merged;
            updated += 1;
        } else {
            store.assets.push(merged);
            created += 1;
        }
    }

    fs.mkdirSync(dataRoot, { recursive: true });
    writeFileAtomicSync(storePath, JSON.stringify(store, null, 4), 'utf8');

    return {
        storePath,
        created,
        updated,
        assets: demos.map(asset => ({
            id: asset.id,
            title: asset.title,
            type: asset.type,
            price_type: asset.price_type,
            price_coins: asset.price_coins,
        })),
    };
}

try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printUsage();
        process.exit(0);
    }

    const result = seedDemoMarketplace(options);
    console.log(`Seeded ${result.assets.length} demo marketplace assets into ${result.storePath}`);
    console.log(`Created: ${result.created}; updated: ${result.updated}`);
    for (const asset of result.assets) {
        const price = asset.price_type === 'free' ? 'free' : `${asset.price_coins} coins`;
        console.log(`- ${asset.id}: ${asset.title} (${asset.type}, ${price})`);
    }
} catch (error) {
    console.error(error.message || error);
    printUsage(process.stderr);
    process.exit(1);
}
