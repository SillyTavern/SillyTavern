const context = SillyTavern.getContext();

const DEFAULT_SETTINGS = {
    enabled: false,
};

function initializeDefaultSettings() {
    // @ts-ignore
    context.extensionSettings.mcp = context.extensionSettings.mcp || {};

    let anyChange = false;
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (context.extensionSettings.mcp[key] === undefined) {
            context.extensionSettings.mcp[key] = DEFAULT_SETTINGS[key];
            anyChange = true;
        }
    }

    if (anyChange) {
        context.saveSettingsDebounced();
    }
}

async function handleUIChanges() {
    const settings = await context.renderExtensionTemplateAsync('mcp', 'settings');
    $('#extensions_settings').append(settings);

    $('#mcp_enabled').prop('checked', context.extensionSettings.mcp.enabled).on('change', async function () {
        const enabled = $(this).prop('checked');
        context.extensionSettings.mcp.enabled = enabled;
        context.saveSettingsDebounced();

        // Use MCPClient's handleTools method to manage tool registration
        await context.MCPClient.handleTools(enabled);
    });

    // Initial tool registration if enabled
    await context.MCPClient.handleTools(context.extensionSettings.mcp.enabled);
}

initializeDefaultSettings();
handleUIChanges();
