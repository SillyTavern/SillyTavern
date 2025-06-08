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
// Mock script.js utilities that might be called during init or by tested functions
jest.mock('../public/scripts/script.js', () => ({
    ...jest.requireActual('../public/scripts/script.js'), // Import and retain default behavior
    saveSettingsDebounced: jest.fn(),
    getThumbnailUrl: jest.fn((type, file) => `path/to/thumbnail/${type}/${file}`),
    getRequestHeaders: jest.fn(() => ({})),
    getCurrentChatId: jest.fn(() => 'testchat'),
    chat_metadata: {}, // Mock chat_metadata if backgrounds.js interacts with it
    event_types: { CHAT_CHANGED: 'CHAT_CHANGED', FORCE_SET_BACKGROUND: 'FORCE_SET_BACKGROUND' },
}));
jest.mock('../public/scripts/extensions.js', () => ({
    saveMetadataDebounced: jest.fn(),
    openThirdPartyExtensionMenu: jest.fn(),
}));
jest.mock('../public/scripts/utils.js', () => ({
    ...jest.requireActual('../public/scripts/utils.js'),
    flashHighlight: jest.fn(),
    createThumbnail: jest.fn((base64, w, h) => Promise.resolve(`data:image/png;base64,${base64.slice(0,10)}`)), // simplified mock
    getBase64Async: jest.fn(blob => Promise.resolve('dummybase64string')),
}));
jest.mock('../public/scripts/i18n.js', () => ({
    t: jest.fn(key => key), // Simple pass-through mock for translation
}));
jest.mock('../public/scripts/popup.js', () => ({
    Popup: {
        show: {
            input: jest.fn(),
            confirm: jest.fn(),
        },
    },
}));
// Mock localforage if THUMBNAIL_STORAGE is used in a way that affects tests
jest.mock('localforage', () => ({
    createInstance: jest.fn(() => ({
        getItem: jest.fn(() => Promise.resolve(null)),
        setItem: jest.fn(() => Promise.resolve()),
        removeItem: jest.fn(() => Promise.resolve()),
    })),
}));


// Import necessary functions from backgrounds.js AFTER mocks are set up
let getBackgroundFromTemplate, initBackgrounds, loadBackgroundSettings, background_settings;

// Helper function to set up the DOM
const setupDOM = () => {
    document.body.innerHTML = `
        <div id="Backgrounds">
            <input id="bg-filter" type="search" />
            <select id="bg_aspect_ratio_filter">
                <option value="none">None</option>
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

// Helper to add a background item to the DOM
const addBackgroundToDOM = async (name, width, height, isCustom = false, containerId = 'bg_menu_content') => {
    const bgData = isCustom ? name : { name, width, height, path: name, type: 'image/png' };
    const bgElement = await getBackgroundFromTemplate(bgData, isCustom);
    document.getElementById(containerId).appendChild(bgElement[0]);
};

// Helper to simulate filter changes
const setFilterValue = (selector, value, eventType = 'input') => {
    const element = document.querySelector(selector);
    element.value = value;
    element.dispatchEvent(new Event(eventType));
};


describe('Background Filtering', () => {
    beforeAll(async() => {
        // Dynamically import after mocks
        const backgroundsModule = await import('../public/scripts/backgrounds.js');
        getBackgroundFromTemplate = backgroundsModule.getBackgroundFromTemplate;
        initBackgrounds = backgroundsModule.initBackgrounds;
        loadBackgroundSettings = backgroundsModule.loadBackgroundSettings;
        background_settings = backgroundsModule.background_settings;
    });

    beforeEach(() => {
        setupDOM();
        // Mock fetch for /api/backgrounds/all to return empty initially or with defaults
        global.fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ images: [], config: { width: 160, height: 90 } }),
        });
        // Initialize backgrounds to set up event listeners etc.
        // Call loadBackgroundSettings with default settings to avoid issues if it's called internally by initBackgrounds
        const mockSettings = {
            background: { ...background_settings }, // Use a copy of default
            load_backgrounds_on_start: true,
            //... other necessary settings
        };
        loadBackgroundSettings(mockSettings);
        initBackgrounds();

        // Clear any previous fetch calls for specific tests
        global.fetch.mockClear();
        toastr.warning.mockClear();
    });

    const sampleBackgrounds = [
        { name: 'portrait_image_1.jpg', width: 800, height: 1200, type: 'system' }, // Portrait
        { name: 'landscape_image_1.jpg', width: 1920, height: 1080, type: 'system' }, // Landscape
        { name: 'square_image_1.jpg', width: 1000, height: 1000, type: 'system' }, // Square
        { name: 'portrait_bedroom.png', width: 400, height: 600, type: 'system' },   // Portrait
        { name: 'landscape_bedroom.png', width: 1200, height: 600, type: 'system'}, // Landscape
        { name: 'small_square.gif', width: 300, height: 300, type: 'system'},      // Square
        { name: 'custom_scenery.jpg', type: 'custom'}, // Custom, no initial dimensions
        { name: 'error_dims.jpg', width: 0, height: 0, type: 'system'}, // Error/Invalid dimensions
    ];

    const populateTestBackgrounds = async () => {
        for (const bg of sampleBackgrounds) {
            if (bg.type === 'system') {
                await addBackgroundToDOM(bg.name, bg.width, bg.height, false, 'bg_menu_content');
            } else if (bg.type === 'custom') {
                await addBackgroundToDOM(bg.name, 0, 0, true, 'bg_custom_content');
            }
        }
    };

    test('Test Case 1: No filters applied', async () => {
        await populateTestBackgrounds();
        setFilterValue('#bg-filter', '');
        setFilterValue('#bg_aspect_ratio_filter', 'none', 'input'); // Dispatch 'input' as per backgrounds.js

        const allBgs = document.querySelectorAll('#bg_menu_content .bg_example, #bg_custom_content .bg_example');
        allBgs.forEach(bg => {
            expect(bg.style.display).not.toBe('none');
        });
        expect(allBgs.length).toBe(sampleBackgrounds.length);
    });

    test('Test Case 2: Aspect ratio filter - Portrait', async () => {
        await populateTestBackgrounds();
        setFilterValue('#bg_aspect_ratio_filter', 'portrait', 'input');

        expect(document.querySelector('.bg_example[bgfile="portrait_image_1.jpg"]').style.display).not.toBe('none');
        expect(document.querySelector('.bg_example[bgfile="portrait_bedroom.png"]').style.display).not.toBe('none');
        expect(document.querySelector('.bg_example[bgfile="landscape_image_1.jpg"]').style.display).toBe('none');
        expect(document.querySelector('.bg_example[bgfile="square_image_1.jpg"]').style.display).toBe('none');
        // Custom and error_dims should be hidden unless aspect ratio filter is "none"
        expect(document.querySelector('.bg_example[bgfile="custom_scenery.jpg"]').style.display).toBe('none');
        expect(document.querySelector('.bg_example[bgfile="error_dims.jpg"]').style.display).toBe('none');
    });

    test('Test Case 3: Aspect ratio filter - Landscape', async () => {
        await populateTestBackgrounds();
        setFilterValue('#bg_aspect_ratio_filter', 'landscape', 'input');

        expect(document.querySelector('.bg_example[bgfile="landscape_image_1.jpg"]').style.display).not.toBe('none');
        expect(document.querySelector('.bg_example[bgfile="landscape_bedroom.png"]').style.display).not.toBe('none');
        expect(document.querySelector('.bg_example[bgfile="portrait_image_1.jpg"]').style.display).toBe('none');
        expect(document.querySelector('.bg_example[bgfile="square_image_1.jpg"]').style.display).toBe('none');
        expect(document.querySelector('.bg_example[bgfile="custom_scenery.jpg"]').style.display).toBe('none');
        expect(document.querySelector('.bg_example[bgfile="error_dims.jpg"]').style.display).toBe('none');
    });

    test('Test Case 4: Aspect ratio filter - Square', async () => {
        await populateTestBackgrounds();
        setFilterValue('#bg_aspect_ratio_filter', 'square', 'input');

        expect(document.querySelector('.bg_example[bgfile="square_image_1.jpg"]').style.display).not.toBe('none');
        expect(document.querySelector('.bg_example[bgfile="small_square.gif"]').style.display).not.toBe('none');
        expect(document.querySelector('.bg_example[bgfile="portrait_image_1.jpg"]').style.display).toBe('none');
        expect(document.querySelector('.bg_example[bgfile="landscape_image_1.jpg"]').style.display).toBe('none');
        expect(document.querySelector('.bg_example[bgfile="custom_scenery.jpg"]').style.display).toBe('none');
        expect(document.querySelector('.bg_example[bgfile="error_dims.jpg"]').style.display).toBe('none');
    });

    test('Test Case 5: Text filter only', async () => {
        await populateTestBackgrounds();
        setFilterValue('#bg_aspect_ratio_filter', 'none', 'input');
        setFilterValue('#bg-filter', 'bedroom');

        expect(document.querySelector('.bg_example[bgfile="portrait_bedroom.png"]').style.display).not.toBe('none');
        expect(document.querySelector('.bg_example[bgfile="landscape_bedroom.png"]').style.display).not.toBe('none');
        expect(document.querySelector('.bg_example[bgfile="portrait_image_1.jpg"]').style.display).toBe('none');
        expect(document.querySelector('.bg_example[bgfile="square_image_1.jpg"]').style.display).toBe('none');
        // custom_scenery.jpg does not contain "bedroom"
        expect(document.querySelector('.bg_example[bgfile="custom_scenery.jpg"]').style.display).toBe('none');
    });

    test('Test Case 6: Combined text and aspect ratio filter (Portrait Bedroom)', async () => {
        await populateTestBackgrounds();
        setFilterValue('#bg-filter', 'bedroom');
        setFilterValue('#bg_aspect_ratio_filter', 'portrait', 'input');

        expect(document.querySelector('.bg_example[bgfile="portrait_bedroom.png"]').style.display).not.toBe('none');
        expect(document.querySelector('.bg_example[bgfile="landscape_bedroom.png"]').style.display).toBe('none');
        expect(document.querySelector('.bg_example[bgfile="portrait_image_1.jpg"]').style.display).toBe('none'); // No "bedroom"
    });

    test('Test Case 7: Filtering with custom backgrounds (no aspect ratio filter)', async () => {
        await populateTestBackgrounds();
        setFilterValue('#bg_aspect_ratio_filter', 'none', 'input');
        setFilterValue('#bg-filter', 'custom'); // Text filter to isolate custom

        // Custom background has title "custom_scenery.jpg"
        const customBg = document.querySelector('.bg_example[bgfile="custom_scenery.jpg"]');
        expect(customBg.style.display).not.toBe('none');
        // Ensure other non-matching items are hidden
        expect(document.querySelector('.bg_example[bgfile="portrait_image_1.jpg"]').style.display).toBe('none');
    });

    test('Test Case 7b: Filtering with custom backgrounds (specific aspect ratio filter)', async () => {
        await populateTestBackgrounds();
        setFilterValue('#bg_aspect_ratio_filter', 'portrait', 'input');
        setFilterValue('#bg-filter', 'custom');

        // Custom background has 0,0 dimensions, so it shouldn't match "portrait"
        const customBg = document.querySelector('.bg_example[bgfile="custom_scenery.jpg"]');
        expect(customBg.style.display).toBe('none');
    });

    test('Test Case 8: Invalid image dimensions (0x0) with specific aspect ratio filter', async () => {
        await populateTestBackgrounds();
        setFilterValue('#bg_aspect_ratio_filter', 'square', 'input');

        const errorBg = document.querySelector('.bg_example[bgfile="error_dims.jpg"]');
        // Should be hidden as 0x0 doesn't fit "square" (or any specific ratio)
        expect(errorBg.style.display).toBe('none');
    });

    test('Test Case 8b: Invalid image dimensions (0x0) with "None" aspect ratio filter', async () => {
        await populateTestBackgrounds();
        setFilterValue('#bg_aspect_ratio_filter', 'none', 'input');
        setFilterValue('#bg-filter', 'error_dims'); // Isolate this one by text

        const errorBg = document.querySelector('.bg_example[bgfile="error_dims.jpg"]');
        // Should be visible because aspect ratio filter is "none"
        expect(errorBg.style.display).not.toBe('none');
    });
});
