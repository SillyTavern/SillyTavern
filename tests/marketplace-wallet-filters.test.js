import { describe, expect, test } from '@jest/globals';

import { filterAndSortAssets } from '../public/scripts/extensions/marketplace-wallet/filters.js';

function makeAsset(overrides) {
    return {
        id: 'asset',
        type: 'character_card',
        title: 'Asset',
        summary: 'Summary',
        creator_id: 'creator',
        tags: [],
        status: 'listed',
        price_type: 'free',
        price_coins: 0,
        sales_count: 0,
        install_count: 0,
        owned: false,
        entitled: false,
        listed_at: '2026-06-26T10:00:00.000Z',
        updated_at: '2026-06-26T10:00:00.000Z',
        ...overrides,
    };
}

describe('marketplace wallet asset filters', () => {
    const assets = [
        makeAsset({
            id: 'free-character',
            title: 'Free Character',
            summary: 'Cozy tavern companion',
            tags: ['friendly'],
            sales_count: 4,
            install_count: 8,
            listed_at: '2026-06-26T12:00:00.000Z',
        }),
        makeAsset({
            id: 'paid-world',
            type: 'world_book',
            title: 'Paid World',
            summary: 'Cyberpunk district lore',
            price_type: 'fixed_price',
            price_coins: 80,
            sales_count: 12,
            install_count: 4,
            listed_at: '2026-06-26T11:00:00.000Z',
        }),
        makeAsset({
            id: 'library-world',
            type: 'world_book',
            title: 'Library World',
            price_type: 'fixed_price',
            price_coins: 40,
            entitled: true,
            sales_count: 2,
            install_count: 1,
            listed_at: '2026-06-26T09:00:00.000Z',
        }),
        makeAsset({
            id: 'my-draft',
            title: 'My Draft',
            status: 'draft',
            owned: true,
            listed_at: '',
            updated_at: '2026-06-26T13:00:00.000Z',
        }),
    ];

    test('filters by type, price, access state, and search text', () => {
        expect(filterAndSortAssets(assets, { type: 'world_book' }).map(asset => asset.id)).toEqual([
            'paid-world',
            'library-world',
        ]);
        expect(filterAndSortAssets(assets, { priceType: 'free' }).map(asset => asset.id)).toEqual([
            'my-draft',
            'free-character',
        ]);
        expect(filterAndSortAssets(assets, { access: 'available' }).map(asset => asset.id)).toEqual([
            'free-character',
            'paid-world',
        ]);
        expect(filterAndSortAssets(assets, { access: 'library' }).map(asset => asset.id)).toEqual([
            'library-world',
        ]);
        expect(filterAndSortAssets(assets, { access: 'mine' }).map(asset => asset.id)).toEqual([
            'my-draft',
        ]);
        expect(filterAndSortAssets(assets, { search: 'cyberpunk' }).map(asset => asset.id)).toEqual([
            'paid-world',
        ]);
        expect(filterAndSortAssets(assets, { search: 'friendly' }).map(asset => asset.id)).toEqual([
            'free-character',
        ]);
    });

    test('sorts by recency, popularity, and price without mutating source assets', () => {
        const originalOrder = assets.map(asset => asset.id);

        expect(filterAndSortAssets(assets).map(asset => asset.id)).toEqual([
            'my-draft',
            'free-character',
            'paid-world',
            'library-world',
        ]);
        expect(filterAndSortAssets(assets, { sort: 'popular' }).map(asset => asset.id)).toEqual([
            'paid-world',
            'free-character',
            'library-world',
            'my-draft',
        ]);
        expect(filterAndSortAssets(assets, { sort: 'price_asc' }).map(asset => asset.id)).toEqual([
            'my-draft',
            'free-character',
            'library-world',
            'paid-world',
        ]);
        expect(filterAndSortAssets(assets, { sort: 'price_desc' }).map(asset => asset.id)).toEqual([
            'paid-world',
            'library-world',
            'my-draft',
            'free-character',
        ]);
        expect(assets.map(asset => asset.id)).toEqual(originalOrder);
    });
});
