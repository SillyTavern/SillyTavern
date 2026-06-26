export function filterAndSortAssets(assets, filters = {}) {
    const search = String(filters.search || '').trim().toLowerCase();
    const type = String(filters.type || '');
    const priceType = String(filters.priceType || '');
    const access = String(filters.access || '');
    const sort = String(filters.sort || 'recent');

    return [...(Array.isArray(assets) ? assets : [])]
        .filter(asset => !type || asset.type === type)
        .filter(asset => !priceType || asset.price_type === priceType)
        .filter(asset => {
            switch (access) {
                case 'available':
                    return asset.status === 'listed' && !asset.owned && !asset.entitled;
                case 'library':
                    return asset.entitled;
                case 'mine':
                    return asset.owned;
                default:
                    return true;
            }
        })
        .filter(asset => {
            if (!search) {
                return true;
            }
            return [
                asset.title,
                asset.summary,
                asset.creator_id,
                asset.language,
                asset.content_rating,
                ...(Array.isArray(asset.tags) ? asset.tags : []),
            ].filter(Boolean).join(' ').toLowerCase().includes(search);
        })
        .sort((a, b) => {
            const recent = String(b.listed_at || b.updated_at || '').localeCompare(String(a.listed_at || a.updated_at || ''));

            switch (sort) {
                case 'popular':
                    return Number(b.sales_count || 0) - Number(a.sales_count || 0)
                        || Number(b.install_count || 0) - Number(a.install_count || 0)
                        || recent;
                case 'price_asc':
                    return Number(a.price_coins || 0) - Number(b.price_coins || 0)
                        || recent;
                case 'price_desc':
                    return Number(b.price_coins || 0) - Number(a.price_coins || 0)
                        || recent;
                default:
                    return recent;
            }
        });
}
