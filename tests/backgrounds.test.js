// Mocking necessary imports and globals
global.fetch = jest.fn();
global.toastr = {
    warning: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
};
global.eventSource = {
    on: jest.fn(),
    trigger: jest.fn(),
};

// Mock Image constructor
const mockImageInstances = [];
global.Image = jest.fn(() => {
    const img = {
        onload: null,
        onerror: null,
        src: '',
        naturalWidth: 0,
        naturalHeight: 0,
    };
    mockImageInstances.push(img);
    return img;
});

jest.mock('../public/scripts/script.js', () => ({
    ...jest.requireActual('../public/scripts/script.js'),
    saveSettingsDebounced: jest.fn(),
    getThumbnailUrl: jest.fn((type, file) => `path/to/thumbnail/${type}/${file}`),
    getRequestHeaders: jest.fn(() => ({})),
    getCurrentChatId: jest.fn(() => 'testchat'),
    chat_metadata: {},
    event_types: { CHAT_CHANGED: 'CHAT_CHANGED', FORCE_SET_BACKGROUND: 'FORCE_SET_BACKGROUND' },
}));
jest.mock('../public/scripts/extensions.js', () => ({
    saveMetadataDebounced: jest.fn(),
    openThirdPartyExtensionMenu: jest.fn(),
}));
jest.mock('../public/scripts/utils.js', () => ({
    ...jest.requireActual('../public/scripts/utils.js'),
    flashHighlight: jest.fn(),
    createThumbnail: jest.fn((base64, w, h) => Promise.resolve(`data:image/png;base64,${base64.slice(0,10)}`)),
    getBase64Async: jest.fn(blob => Promise.resolve('dummybase64string')),
}));
jest.mock('../public/scripts/i18n.js', () => ({
    t: jest.fn(key => key),
}));
jest.mock('../public/scripts/popup.js', () => ({
    Popup: {
        show: {
            input: jest.fn(),
            confirm: jest.fn(),
        },
    },
}));
jest.mock('localforage', () => ({
    createInstance: jest.fn(() => ({
        getItem: jest.fn(() => Promise.resolve(null)),
        setItem: jest.fn(() => Promise.resolve()),
        removeItem: jest.fn(() => Promise.resolve()),
    })),
}));

let getBackgroundFromTemplate, initBackgrounds, loadBackgroundSettings, background_settings, getBackgrounds, getChatBackgroundsList;

const setupDOM = () => {
    document.body.innerHTML = `
        <div id="Backgrounds">
            <input id="bg-filter" type="search" />
            <select id="bg_aspect_ratio_filter">
                <option value="none" selected>None</option>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
                <option value="square">Square</option>
            </select>
            <select id="background_fitting"></select>
            <input type="checkbox" id="background_thumbnails_animation" />
            <div id="bg_menu_content"></div>
            <div id="bg_custom_content"></div>
            <div id="bg_chat_hint"></div>
        </div>
        <div id="background_template">
            <div class="bg_example">
                <div class="BGSampleTitle"></div>
            </div>
        </div>
        <div id="bg1"></div>
        <div id="bg_custom"></div>
        <form id="form_bg_download"></form>
    `;
};

const addBackgroundToDOMViaModule = async (name, isCustom = false, containerId = 'bg_menu_content') => {
    // For system backgrounds, `name` is an object {name: 'file.jpg'} as returned by mocked API
    // For custom, `name` is the path string
    const bgData = isCustom ? name : { name: name, type: 'image/png', path:name }; // Simulating API response structure post-revert
    const bgElement = await getBackgroundFromTemplate(bgData, isCustom);
    document.getElementById(containerId).appendChild(bgElement[0]);
    return bgElement[0]; // Return the DOM element for later manipulation if needed
};


const setFilterValue = (selector, value, eventType = 'input') => {
    const element = document.querySelector(selector);
    element.value = value;
    element.dispatchEvent(new Event(eventType));
};

// Helper to simulate image loading
const simulateImageLoad = (element, width, height) => {
    const bgfile = $(element).attr('bgfile');
    const isCustom = $(element).attr('custom') === 'true';
    const expectedSrc = isCustom ? bgfile : `backgrounds/${encodeURIComponent(bgfile)}`;

    const mockImg = mockImageInstances.find(img => img.src.includes(expectedSrc) || img.src.includes(bgfile));

    if (mockImg && mockImg.onload) {
        mockImg.naturalWidth = width;
        mockImg.naturalHeight = height;
        mockImg.onload();
    } else {
        // Fallback for elements that might not have triggered an Image() instance in the test context
        // or if src doesn't match exactly due to encoding/path differences.
        // This directly sets data and calls applyFilters, similar to what onload would do.
        $(element).data('width', width).data('height', height);
        // Manually trigger applyFilters if Image mock wasn't hit,
        // because initBackgrounds wires up applyFilters to be called by Image.onload
        // For robustness, we might need a direct way to call applyFilters from tests if it's not exported
        // For now, we rely on the event listeners set by initBackgrounds which call applyFilters.
        // If applyFilters is not exported, we can trigger a filter change to call it.
        document.querySelector('#bg_aspect_ratio_filter').dispatchEvent(new Event('input'));
    }
};

const simulateImageError = (element) => {
    const bgfile = $(element).attr('bgfile');
     const isCustom = $(element).attr('custom') === 'true';
    const expectedSrc = isCustom ? bgfile : `backgrounds/${encodeURIComponent(bgfile)}`;
    const mockImg = mockImageInstances.find(img => img.src.includes(expectedSrc) || img.src.includes(bgfile));

    if (mockImg && mockImg.onerror) {
        mockImg.onerror();
    } else {
        $(element).data('width', 0).data('height', 0);
        document.querySelector('#bg_aspect_ratio_filter').dispatchEvent(new Event('input'));
    }
};


describe('Background Filtering with Client-Side Dimension Fetching', () => {
    beforeAll(async () => {
        const backgroundsModule = await import('../public/scripts/backgrounds.js');
        getBackgroundFromTemplate = backgroundsModule.getBackgroundFromTemplate;
        initBackgrounds = backgroundsModule.initBackgrounds;
        loadBackgroundSettings = backgroundsModule.loadBackgroundSettings;
        background_settings = backgroundsModule.background_settings;
        getBackgrounds = backgroundsModule.getBackgrounds; // Assuming getBackgrounds is exported for test setup
        getChatBackgroundsList = backgroundsModule.getChatBackgroundsList; // Assuming this is also available or tested via onChatChanged
    });

    beforeEach(async () => {
        setupDOM();
        mockImageInstances.length = 0; // Clear mock image instances for each test

        // API returns no width/height
        global.fetch.mockImplementation((url) => {
            if (url === '/api/backgrounds/all') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        images: [ // Provide data that getBackgrounds would use
                            { name: 'portrait_image_1.jpg', type: 'image/jpeg', path: 'backgrounds/portrait_image_1.jpg' },
                            { name: 'landscape_image_1.jpg', type: 'image/jpeg', path: 'backgrounds/landscape_image_1.jpg' },
                            { name: 'square_image_1.jpg', type: 'image/jpeg', path: 'backgrounds/square_image_1.jpg' },
                            { name: 'portrait_bedroom.png', type: 'image/png', path: 'backgrounds/portrait_bedroom.png' },
                            { name: 'landscape_bedroom.png', type: 'image/png', path: 'backgrounds/landscape_bedroom.png' },
                            { name: 'small_square.gif', type: 'image/gif', path: 'backgrounds/small_square.gif' },
                            { name: 'error_dims.jpg', type: 'image/jpeg', path: 'backgrounds/error_dims.jpg' },
                        ],
                        config: { width: 160, height: 90 },
                    }),
                });
            }
            return Promise.resolve({ ok: false }); // Default for other fetches
        });

        const mockSettings = { background: { ...background_settings }, load_backgrounds_on_start: true };
        loadBackgroundSettings(mockSettings);
        initBackgrounds(); // Sets up event listeners

        // Call getBackgrounds to populate system images and trigger client-side loading logic
        // This will use the fetch mock above.
        await getBackgrounds();
        // Simulate adding a custom background for relevant tests
        // For custom backgrounds, getChatBackgroundsList is typically called or onChatChanged
        // We can directly add one for testing purposes if needed
        const customBgEl = await addBackgroundToDOMViaModule('custom_scenery.jpg', true, 'bg_custom_content');
    });

    const findBgElement = (name) => document.querySelector(`.bg_example[bgfile="${name}"]`);

    test('Initial state: No aspect ratio filter, all items visible (dims 0,0)', async () => {
        setFilterValue('#bg_aspect_ratio_filter', 'none', 'input');
        document.querySelectorAll('#bg_menu_content .bg_example, #bg_custom_content .bg_example').forEach(bg => {
            expect(bg.style.display).not.toBe('none');
        });
    });

    test('Initial state: Portrait filter, all items hidden (dims 0,0)', async () => {
        setFilterValue('#bg_aspect_ratio_filter', 'portrait', 'input');
        document.querySelectorAll('#bg_menu_content .bg_example, #bg_custom_content .bg_example').forEach(bg => {
            expect(bg.style.display).toBe('none');
        });
    });

    test('Progressive loading: Portrait filter, portrait image loads and becomes visible', async () => {
        setFilterValue('#bg_aspect_ratio_filter', 'portrait', 'input');
        const portraitImgEl = findBgElement('portrait_image_1.jpg');
        expect(portraitImgEl.style.display).toBe('none'); // Initially hidden

        simulateImageLoad(portraitImgEl, 800, 1200); // Load dimensions
        expect(portraitImgEl.style.display).not.toBe('none'); // Now visible

        const landscapeImgEl = findBgElement('landscape_image_1.jpg');
        expect(landscapeImgEl.style.display).toBe('none'); // Still hidden
        simulateImageLoad(landscapeImgEl, 1920, 1080); // Load its dimensions
        expect(landscapeImgEl.style.display).toBe('none'); // Should remain hidden with portrait filter
    });

    test('Text filter combined with progressive loading', async () => {
        setFilterValue('#bg-filter', 'bedroom');
        setFilterValue('#bg_aspect_ratio_filter', 'portrait', 'input');

        const portraitBedroomEl = findBgElement('portrait_bedroom.png');
        const landscapeBedroomEl = findBgElement('landscape_bedroom.png');

        expect(portraitBedroomEl.style.display).toBe('none');
        expect(landscapeBedroomEl.style.display).toBe('none');

        simulateImageLoad(portraitBedroomEl, 400, 600); // Portrait
        expect(portraitBedroomEl.style.display).not.toBe('none');

        simulateImageLoad(landscapeBedroomEl, 1200, 600); // Landscape
        expect(landscapeBedroomEl.style.display).toBe('none'); // Hidden by aspect ratio
    });

    test('Image error handling: onerror sets dims to 0,0 and filters accordingly', async () => {
        setFilterValue('#bg_aspect_ratio_filter', 'square', 'input');
        const errorImgEl = findBgElement('error_dims.jpg');
        expect(errorImgEl.style.display).toBe('none'); // Initially hidden

        simulateImageError(errorImgEl); // Trigger error
        expect($(errorImgEl).data('width')).toBe(0);
        expect($(errorImgEl).data('height')).toBe(0);
        expect(errorImgEl.style.display).toBe('none'); // Still hidden with square filter

        setFilterValue('#bg_aspect_ratio_filter', 'none', 'input'); // Change to "None"
        expect(errorImgEl.style.display).not.toBe('none'); // Should become visible
    });

    test('Custom background loading and filtering', async () => {
        setFilterValue('#bg_aspect_ratio_filter', 'landscape', 'input');
        const customBgEl = findBgElement('custom_scenery.jpg');
        expect(customBgEl.style.display).toBe('none'); // Initially hidden (0,0 dims)

        simulateImageLoad(customBgEl, 1600, 900); // Load as landscape
        expect(customBgEl.style.display).not.toBe('none');

        setFilterValue('#bg_aspect_ratio_filter', 'portrait', 'input');
        expect(customBgEl.style.display).toBe('none');
    });

    // Re-add adapted versions of previous test cases
    test('Full filter: Aspect ratio - Portrait (after loads)', async () => {
        simulateImageLoad(findBgElement('portrait_image_1.jpg'), 800, 1200);
        simulateImageLoad(findBgElement('portrait_bedroom.png'), 400, 600);
        simulateImageLoad(findBgElement('landscape_image_1.jpg'), 1920, 1080);
        simulateImageLoad(findBgElement('square_image_1.jpg'), 1000, 1000);
        simulateImageError(findBgElement('error_dims.jpg'));
        simulateImageLoad(findBgElement('custom_scenery.jpg'), 100, 200); // Make it portrait for this test

        setFilterValue('#bg_aspect_ratio_filter', 'portrait', 'input');

        expect(findBgElement('portrait_image_1.jpg').style.display).not.toBe('none');
        expect(findBgElement('portrait_bedroom.png').style.display).not.toBe('none');
        expect(findBgElement('custom_scenery.jpg').style.display).not.toBe('none'); // Now portrait
        expect(findBgElement('landscape_image_1.jpg').style.display).toBe('none');
        expect(findBgElement('square_image_1.jpg').style.display).toBe('none');
        expect(findBgElement('error_dims.jpg').style.display).toBe('none');
    });

    test('getBackgroundFromTemplate for system background with string input', async () => {
        // This test specifically probes the scenario where bg is a string but isCustom is false.
        // Based on current implementation, this might throw an error or behave unexpectedly.
        // The goal is to ensure it handles this gracefully or that the function is robust.

        const mockFilenameString = "system_bg.jpg";
        let bgElementWrapper;
        let errorThrown = null;

        try {
            // Ensure that getBackgroundFromTemplate is called in an environment where jQuery can find #background_template
            // setupDOM() is called in beforeEach, so the template should exist.
            bgElementWrapper = await getBackgroundFromTemplate(mockFilenameString, false);
        } catch (e) {
            errorThrown = e;
        }

        // Assertion: Crucially, ensure the test does not throw a "TypeError: Cannot read properties of undefined (reading 'slice')"
        // If the function was modified to handle string input correctly for isCustom=false:
        expect(errorThrown).toBeNull();

        // If it didn't throw, check attributes. This part assumes the function was modified
        // to handle `bg` as a string directly in the `isCustom = false` path.
        if (!errorThrown && bgElementWrapper) {
            const bgElement = bgElementWrapper[0]; // Get the DOM element from jQuery wrapper
            expect($(bgElement).attr('bgfile')).toBe(mockFilenameString);
            expect($(bgElement).attr('title')).toBe(mockFilenameString);
            expect($(bgElement).find('.BGSampleTitle').text()).toBe("system_bg"); // Filename without extension
            expect($(bgElement).data('width')).toBe(0); // Should default to 0 if not an object with width
            expect($(bgElement).data('height')).toBe(0); // Should default to 0
        }
    });

    test('Full filter: Text filter only (after loads)', async () => {
        simulateImageLoad(findBgElement('portrait_image_1.jpg'), 800, 1200);
        simulateImageLoad(findBgElement('portrait_bedroom.png'), 400, 600);
        simulateImageLoad(findBgElement('landscape_bedroom.png'), 1200, 600);
        simulateImageLoad(findBgElement('custom_scenery.jpg'), 800, 600);


        setFilterValue('#bg_aspect_ratio_filter', 'none', 'input');
        setFilterValue('#bg-filter', 'bedroom');

        expect(findBgElement('portrait_bedroom.png').style.display).not.toBe('none');
        expect(findBgElement('landscape_bedroom.png').style.display).not.toBe('none');
        expect(findBgElement('portrait_image_1.jpg').style.display).toBe('none');
        // title for custom_scenery.jpg is "custom_scenery.jpg"
        expect(findBgElement('custom_scenery.jpg').style.display).toBe('none');
    });

    test('Full filter: Combined text and aspect ratio (Landscape Bedroom, after loads)', async () => {
        simulateImageLoad(findBgElement('portrait_bedroom.png'), 400, 600);
        simulateImageLoad(findBgElement('landscape_bedroom.png'), 1200, 600);
        simulateImageLoad(findBgElement('portrait_image_1.jpg'), 800, 1200);

        setFilterValue('#bg-filter', 'bedroom');
        setFilterValue('#bg_aspect_ratio_filter', 'landscape', 'input');

        expect(findBgElement('landscape_bedroom.png').style.display).not.toBe('none');
        expect(findBgElement('portrait_bedroom.png').style.display).toBe('none');
        expect(findBgElement('portrait_image_1.jpg').style.display).toBe('none');
    });

});
