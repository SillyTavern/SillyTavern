/**
 * Message Collapser Extension for SillyTavern
 * 
 * Automatically collapse long messages with expand button.
 * Configurable threshold and toggle.
 * 
 * @author Xiao Zhua (小爪)
 * @version 1.0.4
 * @license AGPL-3.0
 */

// ========== Import dependencies ==========
import { eventSource, event_types } from '../../../script.js';
import { extension_settings, saveMetadataDebounced } from '../../extensions.js';

// ========== Extension constants ==========
const MESSAGE_COLLAPSER_ID = 'message-collapse';

/**
 * Default extension settings
 */
const defaultSettings = {
    enabled: true,
    threshold: 1000,
    previewLines: 10,
};

/**
 * Get extension settings with initialization
 */
function getSettings() {
    console.log('[MessageCollapser] Step: getSettings()');
    
    // Priority 1: Try to load from localStorage (most reliable)
    try {
        const local = localStorage.getItem('st_message_collapser_settings');
        if (local) {
            const localSettings = JSON.parse(local);
            console.log('[MessageCollapser] ✓ Loaded from localStorage:', localSettings);
            
            // Merge with defaults to ensure all fields exist
            return { ...defaultSettings, ...localSettings };
        }
    } catch (error) {
        console.warn('[MessageCollapser] Failed to load from localStorage:', error);
    }
    
    // Priority 2: Use extension_settings
    if (!extension_settings) {
        console.warn('[MessageCollapser] Warning: extension_settings is undefined');
        return { ...defaultSettings };
    }
    
    if (!extension_settings[MESSAGE_COLLAPSER_ID]) {
        console.log('[MessageCollapser] Initializing settings for first time');
        extension_settings[MESSAGE_COLLAPSER_ID] = { ...defaultSettings };
    }
    
    const settings = extension_settings[MESSAGE_COLLAPSER_ID];
    
    // Ensure all fields exist (in case of version upgrade)
    if (typeof settings.enabled === 'undefined') {
        settings.enabled = defaultSettings.enabled;
    }
    if (typeof settings.threshold === 'undefined') {
        settings.threshold = defaultSettings.threshold;
    }
    if (typeof settings.previewLines === 'undefined') {
        settings.previewLines = defaultSettings.previewLines;
    }
    
    console.log('[MessageCollapser] Current settings (from extension_settings):', JSON.stringify(settings));
    
    return settings;
}

/**
 * Save extension settings to disk with localStorage backup
 */
async function saveSettingsAsync() {
    console.log('[MessageCollapser] Step: saveSettingsAsync()');
    
    try {
        const settings = extension_settings[MESSAGE_COLLAPSER_ID];
        
        // Priority 1: Save to localStorage (immediate and reliable)
        localStorage.setItem('st_message_collapser_settings', JSON.stringify(settings));
        console.log('[MessageCollapser] ✓ Saved to localStorage:', settings);
        
        // Priority 2: Also trigger SillyTavern save (backup)
        if (typeof saveMetadataDebounced === 'function') {
            saveMetadataDebounced();
            console.log('[MessageCollapser] ✓ Triggered SillyTavern save');
        }
    } catch (error) {
        console.error('[MessageCollapser] Error saving settings:', error);
        throw error;
    }
}

/**
 * Add settings UI to extension panel with retry mechanism
 */
function addSettingsUI() {
    console.log('[MessageCollapser] Step: addSettingsUI()');
    
    const settingsHtml = `
        <div id="message-collapser-settings" style="padding: 15px; border: 2px solid #666; margin-top: 10px; border-radius: 8px; background: #2a2a2a;">
            <h4 style="margin-top: 0; margin-bottom: 15px; color: #fff; font-weight: bold;">Message Collapser Settings</h4>
            
            <div style="margin-bottom: 12px;">
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="mc-enabled" style="width: auto; margin: 0;">
                    <span style="color: #fff; font-weight: 500;">Enable Message Collapser</span>
                </label>
            </div>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; color: #fff; font-weight: 500;">
                    Threshold (characters):
                </label>
                <input type="number" id="mc-threshold" value="1000" min="100" max="5000" step="100" 
                       style="width: 100px; padding: 6px; margin-left: 10px; background: #3a3a3a; color: #fff; border: 1px solid #555; border-radius: 4px;">
            </div>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; color: #fff; font-weight: 500;">
                    Preview Lines:
                </label>
                <input type="number" id="mc-preview" value="10" min="5" max="30" step="1" 
                       style="width: 80px; padding: 6px; background: #3a3a3a; color: #fff; border: 1px solid #555; border-radius: 4px;">
            </div>
            
            <button id="mc-save" class="menu_button" style="padding: 8px 16px; margin-top: 10px; background: #4a9eff; color: #fff; border: none; border-radius: 4px; font-weight: 500; cursor: pointer;">
                Save Settings
            </button>
            
            <div id="mc-status" style="margin-top: 10px; color: #4caf50; font-size: 0.9em; font-weight: 500;"></div>
        </div>
    `;
    
    // Try to find settings container with retry
    function tryAddUI(retryCount = 0) {
        const settingsContainer = document.querySelector('#extensions_settings');
        console.log('[MessageCollapser] Looking for #extensions_settings...', settingsContainer ? 'Found!' : 'Not found');
        
        if (settingsContainer) {
            const div = document.createElement('div');
            div.innerHTML = settingsHtml;
            settingsContainer.appendChild(div);
            console.log('[MessageCollapser] ✓ Settings UI added to DOM');
            
            // Initialize UI with current settings
            initializeUI();
            return;
        }
        
        // Retry up to 5 times with 500ms delay
        if (retryCount < 5) {
            console.log(`[MessageCollapser] Retry ${retryCount + 1}/5 in 500ms...`);
            setTimeout(() => tryAddUI(retryCount + 1), 500);
        } else {
            console.error('[MessageCollapser] ❌ Failed to find #extensions_settings after 5 retries');
        }
    }
    
    // Start with initial attempt
    tryAddUI(0);
}

/**
 * Initialize UI controls with current settings
 */
function initializeUI() {
    console.log('[MessageCollapser] Step: initializeUI()');
    
    const settings = getSettings();
    
    const enabledCheckbox = document.getElementById('mc-enabled');
    const thresholdInput = document.getElementById('mc-threshold');
    const previewInput = document.getElementById('mc-preview');
    const saveButton = document.getElementById('mc-save');
    const statusDiv = document.getElementById('mc-status');
    
    if (!enabledCheckbox || !thresholdInput || !previewInput || !saveButton) {
        console.error('[MessageCollapser] ❌ UI elements not found!');
        return;
    }
    
    // Load current settings
    enabledCheckbox.checked = settings.enabled;
    thresholdInput.value = settings.threshold;
    previewInput.value = settings.previewLines;
    
    console.log('[MessageCollapser] ✓ UI initialized with settings:', settings);
    
    // Save button handler
    saveButton.addEventListener('click', async () => {
        console.log('[MessageCollapser] Save button clicked');
        
        try {
            // Step 1: Update extension_settings (critical!)
            const newThreshold = parseInt(thresholdInput.value);
            const newPreviewLines = parseInt(previewInput.value);
            
            // Validate first
            if (newThreshold < 100 || newThreshold > 5000) {
                alert('Threshold must be between 100 and 5000');
                return;
            }
            
            if (newPreviewLines < 5 || newPreviewLines > 30) {
                alert('Preview lines must be between 5 and 30');
                return;
            }
            
            // Update extension_settings object (this is what gets saved!)
            if (!extension_settings[MESSAGE_COLLAPSER_ID]) {
                extension_settings[MESSAGE_COLLAPSER_ID] = { ...defaultSettings };
            }
            
            extension_settings[MESSAGE_COLLAPSER_ID].enabled = enabledCheckbox.checked;
            extension_settings[MESSAGE_COLLAPSER_ID].threshold = newThreshold;
            extension_settings[MESSAGE_COLLAPSER_ID].previewLines = newPreviewLines;
            
            console.log('[MessageCollapser] Updated extension_settings:', extension_settings[MESSAGE_COLLAPSER_ID]);
            
            // Step 2: Save to localStorage
            await saveSettingsAsync();
            
            // Step 3: Update UI status
            if (statusDiv) {
                statusDiv.textContent = '✓ Settings saved at ' + new Date().toLocaleTimeString();
                setTimeout(() => {
                    if (statusDiv) statusDiv.textContent = '';
                }, 3000);
            }
            
            console.log('[MessageCollapser] ✓ Settings saved successfully');
        } catch (error) {
            console.error('[MessageCollapser] ❌ Error saving settings:', error);
            alert('Failed to save settings: ' + error.message);
        }
    });
}

/**
 * Handle new message received
 */
function onMessageReceived(args) {
    console.log('[MessageCollapser] Event: MESSAGE_RECEIVED', args?.messageId);
    
    try {
        const settings = getSettings();
        
        if (!settings.enabled) {
            console.log('[MessageCollapser] Extension disabled, skipping');
            return;
        }
        
        // Process message after short delay
        setTimeout(() => {
            try {
                const messageId = args?.messageId;
                if (!messageId) {
                    console.warn('[MessageCollapser] No messageId in event');
                    return;
                }
                
                const messageElement = document.querySelector(`[messageid="${messageId}"]`);
                if (!messageElement) {
                    console.warn('[MessageCollapser] Message element not found:', messageId);
                    return;
                }
                
                processMessage(messageElement, settings);
            } catch (error) {
                console.error('[MessageCollapser] Error in message handler:', error);
            }
        }, 100);
    } catch (error) {
        console.error('[MessageCollapser] Error in onMessageReceived:', error);
    }
}

/**
 * Handle chat changed
 */
function onChatChanged() {
    console.log('[MessageCollapser] Event: CHAT_CHANGED');
    
    try {
        const settings = getSettings();
        
        if (!settings.enabled) {
            console.log('[MessageCollapser] Extension disabled, skipping');
            return;
        }
        
        // Process all existing messages after delay
        setTimeout(() => {
            try {
                const messages = document.querySelectorAll('.mes');
                console.log('[MessageCollapser] Processing', messages.length, 'existing messages');
                
                messages.forEach((msg, index) => {
                    try {
                        processMessage(msg, settings);
                    } catch (error) {
                        console.error('[MessageCollapser] Error processing message', index, ':', error);
                    }
                });
            } catch (error) {
                console.error('[MessageCollapser] Error in chat change handler:', error);
            }
        }, 500);
    } catch (error) {
        console.error('[MessageCollapser] Error in onChatChanged:', error);
    }
}

/**
 * Process a single message element
 */
function processMessage(messageElement, settings) {
    try {
        // Skip if already processed
        if (messageElement.querySelector('.collapse-toggle')) {
            return;
        }
        
        // Get message text
        const textElement = messageElement.querySelector('.mes_text');
        if (!textElement) {
            return;
        }
        
        const textContent = textElement.textContent || '';
        console.log('[MessageCollapser] Checking message:', textContent.length, 'chars');
        console.log('[MessageCollapser] Settings - threshold:', settings.threshold, 'previewLines:', settings.previewLines, 'enabled:', settings.enabled);
        
        // Skip if message is short enough
        if (textContent.length <= settings.threshold) {
            console.log('[MessageCollapser] Message too short (', textContent.length, '<=', settings.threshold, '), skipping');
            return;
        }
        
        // Apply collapse
        console.log('[MessageCollapser] Collapsing message (', textContent.length, '>', settings.threshold, ')...');
        collapseMessage(textElement, settings);
    } catch (error) {
        console.error('[MessageCollapser] Error in processMessage:', error);
    }
}

/**
 * Collapse a message element
 */
function collapseMessage(textElement, settings) {
    try {
        const previewLines = settings.previewLines;
        const innerHTML = textElement.innerHTML;
        const lines = innerHTML.split('\n');
        
        console.log('[MessageCollapser] === collapseMessage ===');
        console.log('[MessageCollapser] Message has', lines.length, 'lines');
        console.log('[MessageCollapser] Using previewLines:', previewLines, '(from settings.previewLines)');
        
        // Don't collapse if fewer lines than preview
        if (lines.length <= previewLines) {
            console.log('[MessageCollapser] Not enough lines to collapse (', lines.length, '<=', previewLines, ')');
            return;
        }
        
        // Create collapsed content
        const previewContent = lines.slice(0, previewLines).join('\n');
        
        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'message-collapser-wrapper';
        
        // Create preview container
        const previewContainer = document.createElement('div');
        previewContainer.className = 'message-collapser-preview';
        previewContainer.innerHTML = previewContent;
        
        // Create full content container (hidden)
        const fullContainer = document.createElement('div');
        fullContainer.className = 'message-collapser-full';
        fullContainer.style.display = 'none';
        fullContainer.innerHTML = innerHTML;
        
        // Create toggle button
        const toggleButton = document.createElement('button');
        toggleButton.className = 'collapse-toggle';
        toggleButton.textContent = '📄 Show more';
        toggleButton.type = 'button';
        
        toggleButton.addEventListener('click', () => {
            try {
                const isCollapsed = fullContainer.style.display === 'none';
                if (isCollapsed) {
                    // Expand
                    previewContainer.style.display = 'none';
                    fullContainer.style.display = 'block';
                    toggleButton.textContent = '📄 Show less';
                    console.log('[MessageCollapser] Message expanded');
                } else {
                    // Collapse
                    previewContainer.style.display = 'block';
                    fullContainer.style.display = 'none';
                    toggleButton.textContent = '📄 Show more';
                    console.log('[MessageCollapser] Message collapsed');
                }
            } catch (error) {
                console.error('[MessageCollapser] Error in toggle handler:', error);
            }
        });
        
        // Assemble
        wrapper.appendChild(previewContainer);
        wrapper.appendChild(fullContainer);
        wrapper.appendChild(toggleButton);
        
        // Replace original content
        textElement.innerHTML = '';
        textElement.appendChild(wrapper);
        
        console.log('[MessageCollapser] ✓ Message collapsed successfully');
    } catch (error) {
        console.error('[MessageCollapser] Error in collapseMessage:', error);
    }
}

/**
 * Initialize the extension
 */
function init() {
    console.log('='.repeat(60));
    console.log('[MessageCollapser] v1.0.4 - Starting initialization');
    console.log('='.repeat(60));
    
    try {
        // Step 1: Get settings
        console.log('[MessageCollapser] Step 1/5: Loading settings...');
        const settings = getSettings();
        console.log('[MessageCollapser] ✓ Settings loaded:', settings);
        
        // Step 2: Add settings UI
        console.log('[MessageCollapser] Step 2/5: Adding settings UI...');
        addSettingsUI();
        console.log('[MessageCollapser] ✓ Settings UI added');
        
        // Step 3: Register event listeners
        console.log('[MessageCollapser] Step 3/5: Registering event listeners...');
        console.log('[MessageCollapser] eventSource:', eventSource ? 'OK' : 'MISSING');
        console.log('[MessageCollapser] event_types:', event_types ? 'OK' : 'MISSING');
        
        if (!eventSource || !event_types) {
            throw new Error('eventSource or event_types is undefined');
        }
        
        eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
        console.log('[MessageCollapser] ✓ Registered MESSAGE_RECEIVED listener');
        
        eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
        console.log('[MessageCollapser] ✓ Registered CHAT_CHANGED listener');
        
        // Step 4: Verify dependencies
        console.log('[MessageCollapser] Step 4/5: Verifying dependencies...');
        console.log('[MessageCollapser] extension_settings:', extension_settings ? 'OK' : 'MISSING');
        console.log('[MessageCollapser] saveMetadataDebounced:', typeof saveMetadataDebounced === 'function' ? 'OK' : 'MISSING');
        
        // Step 5: Complete
        console.log('[MessageCollapser] Step 5/5: Initialization complete!');
        console.log('='.repeat(60));
        console.log('[MessageCollapser] ✓✓✓ EXTENSION READY ✓✓✓');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('='.repeat(60));
        console.error('[MessageCollapser] ❌❌❌ INITIALIZATION FAILED ❌❌❌');
        console.error('[MessageCollapser] Error:', error);
        console.error('[MessageCollapser] Error name:', error.name);
        console.error('[MessageCollapser] Error message:', error.message);
        console.error('[MessageCollapser] Error stack:', error.stack);
        console.error('='.repeat(60));
        throw error;
    }
}

// ========== Initialize on document ready ==========
console.log('[MessageCollapser] Script loaded, readyState:', document.readyState);

if (document.readyState === 'loading') {
    console.log('[MessageCollapser] Waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[MessageCollapser] DOMContentLoaded fired!');
        init();
    });
} else {
    console.log('[MessageCollapser] DOM already ready, initializing immediately...');
    init();
}

// Export for external access
export { MESSAGE_COLLAPSER_ID, defaultSettings };
