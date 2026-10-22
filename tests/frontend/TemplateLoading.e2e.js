import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.beforeEach(testSetup.awaitST);

test('concurrent renders share one template request but keep their own data and sanitization', async ({ page }) => {
    let requests = 0;
    await page.route('**/__test_shared_template.html', async route => {
        requests++;
        await new Promise(resolve => setTimeout(resolve, 50));
        await route.fulfill({ contentType: 'text/html', body: '<p>{{name}}</p>{{{content}}}' });
    });
    const results = await page.evaluate(async () => {
        const { renderTemplateAsync } = await import('/scripts/templates.js');
        return Promise.all(Array.from({ length: 24 }, (_, index) => renderTemplateAsync(
            '/__test_shared_template.html',
            { name: `Person <${index}>`, content: '<img src="x" onerror="alert(1)">' },
            true, false, true,
        )));
    });
    expect(requests).toBe(1);
    expect(results).toHaveLength(24);
    for (let index = 0; index < results.length; index++) {
        expect(results[index]).toContain(`Person &lt;${index}&gt;`);
        expect(results[index]).not.toContain('onerror');
    }
});

test('a failed template request can be retried', async ({ page }) => {
    let requests = 0;
    await page.route('**/__test_retry_template.html', route => {
        requests++;
        return route.fulfill(requests === 1
            ? { status: 503, body: 'Temporary error' }
            : { contentType: 'text/html', body: '<p>{{name}}</p>' });
    });
    const result = await page.evaluate(async () => {
        const { renderTemplateAsync } = await import('/scripts/templates.js');
        const first = await renderTemplateAsync('/__test_retry_template.html', { name: 'First' }, true, false, true);
        const retry = await renderTemplateAsync('/__test_retry_template.html', { name: 'Retry' }, true, false, true);
        const cached = await renderTemplateAsync('/__test_retry_template.html', { name: 'Cached' }, true, false, true);
        return { first, retry, cached };
    });
    expect(result.first).toBeUndefined();
    expect(result.retry).toBe('<p>Retry</p>');
    expect(result.cached).toBe('<p>Cached</p>');
    expect(requests).toBe(2);
});
