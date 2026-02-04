/**
 * World Info Entry Template
 * Contains the getWorldEntry function that builds the entry editor template.
 */

import { extension_prompt_roles } from '../../../script.js';
import { debounce, initScrollHeight, resetScrollHeight, navigation_option } from '../../utils.js';
import { debounce_timeout } from '../../constants.js';
import { isMobile } from '../../RossAscends-mods.js';
import { power_user } from '../../power-user.js';
import { getTokenCountAsync } from '../../tokenizers.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../popup.js';
import { t } from '../../i18n.js';
import { world_info_logic, world_info_position, MAX_SCAN_DEPTH } from '../constants.js';
import { world_names, saveSettingsDebounced } from '../state.js';
import { setWIOriginalDataValue, deleteWIOriginalDataValue, duplicateWorldInfoEntry, deleteWorldInfoEntry } from '../entry/index.js';
import { loadWorldInfo, saveWorldInfo } from '../persistence/index.js';
import { moveWorldInfoEntry } from '../integration.js';
import {
    enableKeysInputHelper,
    handleMatchCheckboxHelper,
    updatePosOrdDisplayHelper,
    initCharacterFilterSelect2Helper,
    fillCharacterAndTagOptionsHelper,
    handleCharacterFilterChangeHelper,
    handleProbabilityInputHelper,
    handleProbabilityToggleHelper,
    handleBooleanSelectHelper,
    handleNumberInputHelper,
    handleEntryStateSelectorHelper,
    handleEntryKillSwitchHelper,
    setCommentPlaceholder,
} from './input-helpers.js';

// Templates from DOM - lazily initialized on first use
let WI_ENTRY_HEADER_TEMPLATE = null;
let WI_ENTRY_EDIT_TEMPLATE = null;

/**
 * Gets the entry header template, initializing it from DOM if needed.
 * @returns {JQuery<HTMLElement>} The header template
 */
function getHeaderTemplate() {
    if (!WI_ENTRY_HEADER_TEMPLATE || WI_ENTRY_HEADER_TEMPLATE.length === 0) {
        WI_ENTRY_HEADER_TEMPLATE = $('#entry_edit_template .world_entry');
        if (WI_ENTRY_HEADER_TEMPLATE.length === 0) {
            console.error('[WI] Header template not found! Selector: #entry_edit_template .world_entry');
            console.error('[WI] Template container exists:', $('#entry_edit_template').length > 0);
            console.error('[WI] Document ready state:', document.readyState);
        }
    }
    return WI_ENTRY_HEADER_TEMPLATE;
}

/**
 * Gets the entry edit template, initializing it from DOM if needed.
 * @returns {JQuery<HTMLElement>} The edit template
 */
function getEditTemplate() {
    if (!WI_ENTRY_EDIT_TEMPLATE || WI_ENTRY_EDIT_TEMPLATE.length === 0) {
        WI_ENTRY_EDIT_TEMPLATE = $('#entry_edit_template .world_entry_edit');
        if (WI_ENTRY_EDIT_TEMPLATE.length === 0) {
            console.error('[WI] Edit template not found! Selector: #entry_edit_template .world_entry_edit');
            console.error('[WI] Template container exists:', $('#entry_edit_template').length > 0);
            console.error('[WI] Document ready state:', document.readyState);
        }
    }
    return WI_ENTRY_EDIT_TEMPLATE;
}

/**
 * Builds a jQuery UI autocomplete callback.
 * @param {object} [opt={}] - Optional arguments
 * @param {{entries: Record<string, any>}} [opt.data]   - Your WI data
 * @param {(entry:any)=>string|string[]|null|undefined} [opt.collectValues] - Extract values from one entry
 * @param {() => Iterable<string>} [opt.includeExtras] - Optional global extras to include
 * @param {(ctx:{result:string[], control:JQuery, input:any, haystack:string[]})=>string[]} [opt.postFilter] - Optional final filter step
 */
function buildAutocompleteCallback({ data, collectValues, includeExtras = () => [], postFilter } = {}) {
    return function (control, input, output) {
        const uid = $(control).data('uid');

        // Collect unique values from all *other* entries
        const values = new Set();
        for (const entry of Object.values(data.entries ?? {})) {
            if (entry?.uid == uid) continue;
            const raw = collectValues(entry);
            if (raw == null) continue;
            const arr = Array.isArray(raw) ? raw : [raw];
            for (const v of arr) {
                const s = String(v).trim();
                if (s) values.add(s);
            }
        }

        // Add optional global extras
        for (const v of includeExtras()) {
            const s = String(v).trim();
            if (s) values.add(s);
        }

        // Sort stable & locale-aware
        const haystack = Array.from(values).sort((a, b) => a.localeCompare(b));

        // Case-insensitive contains
        const needle = String(input.term ?? '').toLowerCase();
        let result = haystack.filter(x => x.toLowerCase().includes(needle));

        // Optional final-pass semantics
        if (postFilter) {
            result = postFilter({ result, control: $(control), input, haystack });
        }

        output(result);
    };
}

/**
 * Splits a string into an array of strings, separated by commas and trimmed
 * @param {string} s - The string to split
 * @returns {string[]} An array of strings, separated by commas and trimmed
 */
const splitCsv = s => String(s ?? '').split(/,\s*/).filter(Boolean);

/**
 * Get the inclusion groups for the autocomplete.
 * @param {any} data WI data
 * @returns {(input: any, output: any) => any} Callback function for the autocomplete
 */
function getInclusionGroupCallback(data) {
    return buildAutocompleteCallback({
        data,
        collectValues: entry => entry.group ? splitCsv(entry.group) : [],
        postFilter: ({ result, control, input, haystack }) => {
            const thisGroups = splitCsv(String($(control).val()));
            const needle = String(input.term ?? '').toLowerCase();
            const hasExactMatch = haystack.some(x => x.toLowerCase() === needle);

            return result.filter(x =>
                !thisGroups.includes(x) ||
                (hasExactMatch && thisGroups.filter(g => g === x).length === 1),
            );
        },
    });
}

function getAutomationIdCallback(data) {
    return buildAutocompleteCallback({
        data,
        collectValues: entry => entry.automationId != null ? [String(entry.automationId)] : [],
        includeExtras: () =>
            ('quickReplyApi' in globalThis && globalThis.quickReplyApi?.listAutomationIds)
                ? globalThis.quickReplyApi.listAutomationIds()
                : [],
    });
}

function getOutletNameCallback(data) {
    return buildAutocompleteCallback({
        data,
        collectValues: entry => entry.position === world_info_position.outlet && entry.outletName ? [entry.outletName] : [],
    });
}

/**
 * Create an autocomplete for an input element.
 * @param {JQuery<HTMLElement>} input - Input element to attach the autocomplete to
 * @param {(control: JQuery<HTMLElement>, input: any, output: any) => any} callback - Source data callbacks
 * @param {object} [options={}] - Optional arguments
 * @param {boolean} [options.allowMultiple=false] - Whether to allow multiple comma-separated values
 */
function createEntryInputAutocomplete(input, callback, { allowMultiple = false } = {}) {
    const handleSelect = (event, ui) => {
        event.preventDefault();
        if (!allowMultiple) {
            $(input).val(ui.item.value).trigger('input').trigger('blur');
        } else {
            var terms = String($(input).val()).split(/,\s*/);
            terms.pop();
            terms.push(ui.item.value);
            $(input).val(terms.filter(x => x).join(', ')).trigger('input').trigger('blur');
        }
    };

    $(input).autocomplete({
        minLength: 0,
        source: function (request, response) {
            if (!allowMultiple) {
                callback(input, request, response);
            } else {
                const term = request.term.split(/,\s*/).pop();
                request.term = term;
                callback(input, request, response);
            }
        },
        select: handleSelect,
    });

    $(input).on('focus click', function () {
        $(input).autocomplete('search', allowMultiple ? String($(input).val()).split(/,\s*/).pop() : String($(input).val()));
    });
}

/**
 * Main function to build the WI entry editor template.
 * @param {string} name - The name of the world info file.
 * @param {object} data - The world info data object.
 * @param {object} entry - The entry object to be edited.
 * @param {object} callbacks - Callback functions from the editor.
 * @param {function} callbacks.updateEditor - Function to update the editor with a new entry.
 * @param {function} callbacks.clearEntryList - Function to clear an entry list element.
 */
export async function getWorldEntry(name, data, entry, { updateEditor, clearEntryList }) {
    if (!data.entries[entry.uid]) {
        console.warn('[WI] Entry not found in data:', entry.uid);
        return null;
    }

    const template = getHeaderTemplate();
    if (!template || template.length === 0) {
        console.error('[WI] Cannot create entry - header template not found');
        return null;
    }

    const headerTemplate = template.clone();
    headerTemplate.data('uid', entry.uid);
    headerTemplate.attr('uid', entry.uid);

    if (typeof power_user.wi_key_input_plaintext === 'undefined') power_user.wi_key_input_plaintext = true;

    // Comment
    const commentInput = headerTemplate.find('textarea[name="comment"]');

    //Update the commentInput's placeholder.
    const keys = entry.key.join(', ');
    setCommentPlaceholder(keys, commentInput);

    commentInput.data('uid', entry.uid);
    commentInput.on('input', async function (_, { skipReset = false, noSave = false } = {}) {
        const uid = $(this).data('uid');
        const value = $(this).val();
        !skipReset && await resetScrollHeight(this);
        data.entries[uid].comment = value;
        setWIOriginalDataValue(data, uid, 'comment', data.entries[uid].comment);
        !noSave && await saveWorldInfo(name, data);
    });
    commentInput.val(entry.comment).trigger('input', { skipReset: true, noSave: true });

    // Order
    const orderInput = headerTemplate.find('input[name="order"]');
    orderInput.data('uid', entry.uid);
    orderInput.on('input', async function (_, { noSave = false } = {}) {
        const uid = $(this).data('uid');
        const value = Number($(this).val());
        data.entries[uid].order = !isNaN(value) ? value : 0;
        updatePosOrdDisplayHelper({ template: headerTemplate, data, uid });
        setWIOriginalDataValue(data, uid, 'insertion_order', data.entries[uid].order);
        !noSave && await saveWorldInfo(name, data);
    });
    orderInput.val(entry.order).trigger('input', { noSave: true });
    orderInput.css('width', 'calc(3em + 15px)');

    // Probability
    handleProbabilityInputHelper({ probabilityInput: headerTemplate.find('input[name="probability"]'), data, entry, name });

    // Depth
    handleNumberInputHelper({
        inputElem: headerTemplate.find('input[name="depth"]'),
        entry, entryKey: 'depth', data, name, min: 0, max: MAX_SCAN_DEPTH, clamp: false,
    });
    headerTemplate.find('input[name="depth"]').css('width', 'calc(3em + 15px)');

    // Position
    if (entry.position === undefined) entry.position = 0;
    const positionInput = headerTemplate.find('select[name="position"]');
    positionInput.data('uid', entry.uid);
    positionInput.on('click', e => e.stopPropagation());
    positionInput.on('input', async function (_, { noSave = false } = {}) {
        const uid = $(this).data('uid');
        const value = Number($(this).val());
        data.entries[uid].position = !isNaN(value) ? value : 0;
        const depthInput = headerTemplate.find('input[name="depth"]');
        if (value === world_info_position.atDepth) {
            depthInput.prop('disabled', false);
            depthInput.css('visibility', 'visible');
            const role = Number($(this).find(':selected').data('role'));
            data.entries[uid].role = role;
        } else {
            depthInput.prop('disabled', true);
            depthInput.css('visibility', 'hidden');
            data.entries[uid].role = null;
        }
        updatePosOrdDisplayHelper({ template: headerTemplate, data, uid });
        setWIOriginalDataValue(data, uid, 'position', data.entries[uid].position == 0 ? 'before_char' : 'after_char');
        setWIOriginalDataValue(data, uid, 'extensions.position', data.entries[uid].position);
        setWIOriginalDataValue(data, uid, 'extensions.role', data.entries[uid].role);
        !noSave && await saveWorldInfo(name, data);
    });
    const roleValue = entry.position === world_info_position.atDepth ? String(entry.role ?? extension_prompt_roles.SYSTEM) : '';
    headerTemplate.find(`select[name="position"] option[value="${entry.position}"][data-role="${roleValue}"]`).prop('selected', true).trigger('input', { noSave: true });

    // Tri-state selector
    handleEntryStateSelectorHelper({
        entryStateSelector: headerTemplate.find('select[name="entryStateSelector"]'),
        entry, data, name,
    });

    // Kill switch
    handleEntryKillSwitchHelper({
        entryKillSwitch: headerTemplate.find('div[name="entryKillSwitch"]'),
        entry, data, name, template: headerTemplate,
    });

    // Duplicate/delete/move buttons
    headerTemplate.find('.duplicate_entry_button').data('uid', entry.uid).on('click', async function () {
        const uid = $(this).data('uid');
        const entryDup = duplicateWorldInfoEntry(data, uid);
        if (entryDup) {
            await saveWorldInfo(name, data);
            updateEditor(entryDup.uid);
        }
    });
    headerTemplate.find('.delete_entry_button').data('uid', entry.uid).on('click', async function (e) {
        e.stopPropagation();
        const uid = $(this).data('uid');
        const deleted = await deleteWorldInfoEntry(data, uid);
        if (!deleted) return;
        deleteWIOriginalDataValue(data, uid);
        await saveWorldInfo(name, data);
        updateEditor(navigation_option.previous);
    });
    headerTemplate.find('.move_entry_button').attr('data-uid', entry.uid).attr('data-current-world', name).on('click', async function (e) {
        e.stopPropagation();
        const sourceUid = $(this).attr('data-uid');
        const sourceWorld = $(this).attr('data-current-world');
        const sourceWorldInfo = await loadWorldInfo(sourceWorld);
        if (!sourceWorldInfo) return;
        const sourceName = sourceWorldInfo.entries[sourceUid]?.comment;
        if (sourceName === undefined) return;
        const select = document.createElement('select');
        select.id = 'move_entry_target_select';
        select.classList.add('text_pole', 'wide100p', 'marginTop10');
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = `-- ${t`Select Target Lorebook`} --`;
        select.appendChild(defaultOption);
        let selectableWorldCount = 0;
        world_names.forEach(worldName => {
            if (worldName !== sourceWorld) {
                const option = document.createElement('option');
                option.value = world_names.indexOf(worldName).toString();
                option.textContent = worldName;
                select.appendChild(option);
                selectableWorldCount++;
            }
        });
        if (selectableWorldCount === 0) {
            toastr.warning(t`There are no other lorebooks to move to.`);
            return;
        }
        const wrapper = document.createElement('div');
        wrapper.textContent = t`Move/Copy '${sourceName}' to:`;
        const container = document.createElement('div');
        container.appendChild(wrapper);
        container.appendChild(select);
        let selectedWorldIndex = -1;
        select.addEventListener('change', function () {
            selectedWorldIndex = this.value === '' ? -1 : Number(this.value);
        });
        const popup = new Popup(container, POPUP_TYPE.CONFIRM, '', {
            cancelButton: t`Cancel`,
            customButtons: [
                { text: t`Move`, result: POPUP_RESULT.CUSTOM1 },
                { text: t`Copy`, result: POPUP_RESULT.CUSTOM2 },
            ],
        });
        popup.okButton.style.display = 'none';
        const popupConfirm = await popup.show();
        if (!popupConfirm) return;
        if (selectedWorldIndex === -1) return;
        const selectedValue = world_names[selectedWorldIndex];
        if (!selectedValue) {
            toastr.warning(t`Please select a target lorebook.`);
            return;
        }
        const deleteOriginal = popupConfirm === POPUP_RESULT.CUSTOM1;
        await moveWorldInfoEntry(sourceWorld, selectedValue, sourceUid, { deleteOriginal });
    });

    let drawerInitialized = false;
    let drawerDestroyTimeout = null;
    const editOutlet = headerTemplate.find('.inline-drawer-outlet');

    headerTemplate.find('.inline-drawer').on('inline-drawer-toggle', function () {
        if (drawerDestroyTimeout) {
            clearTimeout(drawerDestroyTimeout);
            drawerDestroyTimeout = null;
        }
        if (drawerInitialized) {
            drawerDestroyTimeout = setTimeout(() => {
                if (editOutlet.is(':visible')) {
                    return;
                }
                drawerInitialized = false;
                clearEntryList(editOutlet);
                drawerDestroyTimeout = null;
            }, debounce_timeout.relaxed);
        } else {
            drawerInitialized = true;
            addEditorDrawerContent();
        }
    });

    function addEditorDrawerContent() {
        const editTemplate = getEditTemplate().clone();

        // UID display
        editTemplate.find('.world_entry_form_uid_value').text(`(UID: ${entry.uid})`);

        // Key inputs
        const keyInput = enableKeysInputHelper({ template: editTemplate, entry, entryPropName: 'key', originalDataValueName: 'keys', name, data });
        const keySecondaryInput = enableKeysInputHelper({ template: editTemplate, entry, entryPropName: 'keysecondary', originalDataValueName: 'secondary_keys', name, data });
        if (!keyInput.isFancy) initScrollHeight(keyInput.control);
        if (!keySecondaryInput.isFancy) initScrollHeight(keySecondaryInput.control);

        // Key input switch
        editTemplate.find('.switch_input_type_icon').on('click', function () {
            power_user.wi_key_input_plaintext = !power_user.wi_key_input_plaintext;
            saveSettingsDebounced();
            const uid = ($(this).parents('.world_entry')).data('uid');
            updateEditor(uid, false);
            $(`.world_entry[uid="${uid}"] .inline-drawer-icon`).trigger('click');
        }).each((_, icon) => {
            $(icon).attr('title', $(icon).data(power_user.wi_key_input_plaintext ? 'tooltip-on' : 'tooltip-off'));
            $(icon).text($(icon).data(power_user.wi_key_input_plaintext ? 'icon-on' : 'icon-off'));
        });

        // Probability toggle
        handleProbabilityToggleHelper({
            probabilityToggle: editTemplate.find('input[name="useProbability"]'),
            data, entry, name,
            probabilityInput: headerTemplate.find('input[name="probability"]'),
        });

        // Comment toggle
        const commentToggle = editTemplate.find('input[name="addMemo"]');
        commentToggle.data('uid', entry.uid);
        commentToggle.on('input', async function (_, { noSave = false } = {}) {
            const uid = $(this).data('uid');
            const value = $(this).prop('checked');
            const commentContainer = $(this).closest('.world_entry').find('.commentContainer');
            data.entries[uid].addMemo = value;
            !noSave && await saveWorldInfo(name, data);
            value ? commentContainer.show() : commentContainer.hide();
        });
        commentToggle.prop('checked', true).trigger('input', { noSave: true });
        commentToggle.parent().hide();

        // Logic AND/NOT
        const selectiveLogicDropdown = editTemplate.find('select[name="entryLogicType"]');
        selectiveLogicDropdown.data('uid', entry.uid);
        selectiveLogicDropdown.on('click', e => e.stopPropagation());
        selectiveLogicDropdown.on('input', async function (_, { noSave = false } = {}) {
            const uid = $(this).data('uid');
            const value = Number($(this).val());
            data.entries[uid].selectiveLogic = !isNaN(value) ? value : world_info_logic.AND_ANY;
            setWIOriginalDataValue(data, uid, 'selectiveLogic', data.entries[uid].selectiveLogic);
            !noSave && await saveWorldInfo(name, data);
        });
        editTemplate.find(`select[name="entryLogicType"] option[value=${entry.selectiveLogic}]`).prop('selected', true).trigger('input', { noSave: true });

        // Selective
        const selectiveInput = editTemplate.find('input[name="selective"]');
        selectiveInput.data('uid', entry.uid);
        selectiveInput.on('input', async function (_, { noSave = false } = {}) {
            const uid = $(this).data('uid');
            const value = $(this).prop('checked');
            data.entries[uid].selective = value;
            setWIOriginalDataValue(data, uid, 'selective', data.entries[uid].selective);
            !noSave && await saveWorldInfo(name, data);
            const keysecondary = $(this).closest('.world_entry').find('.keysecondary');
            const keysecondarytextpole = $(this).closest('.world_entry').find('.keysecondarytextpole');
            const keyprimaryselect = $(this).closest('.world_entry').find('.keyprimaryselect');
            const keyprimaryHeight = keyprimaryselect.outerHeight();
            keysecondarytextpole.css('height', keyprimaryHeight + 'px');
            value ? keysecondary.show() : keysecondary.hide();
        });
        selectiveInput.prop('checked', true).trigger('input', { noSave: true });
        selectiveInput.parent().hide();

        // Character filter
        const characterFilterLabel = editTemplate.find('label[for="characterFilter"] > small');
        characterFilterLabel.text(entry.characterFilter?.isExclude ? 'Exclude Character(s)' : 'Filter to Character(s)');
        const characterExclusionInput = editTemplate.find('input[name="character_exclusion"]');
        characterExclusionInput.data('uid', entry.uid);
        characterExclusionInput.on('input', async function (_, { noSave = false } = {}) {
            const uid = $(this).data('uid');
            const value = $(this).prop('checked');
            const { getContext } = await import('../../extensions.js');
            characterFilterLabel.text(value ? 'Exclude Character(s)' : 'Filter to Character(s)');
            if (data.entries[uid].characterFilter) {
                if (!value && data.entries[uid].characterFilter.names.length === 0 && data.entries[uid].characterFilter.tags.length === 0) {
                    delete data.entries[uid].characterFilter;
                } else {
                    data.entries[uid].characterFilter.isExclude = value;
                }
            } else if (value) {
                Object.assign(data.entries[uid], { characterFilter: { isExclude: true, names: [], tags: [] } });
            }
            if (data.entries[uid]?.characterFilter?.names?.length > 0) {
                for (const name of [...data.entries[uid].characterFilter.names]) {
                    if (!getContext().characters.find(x => x.avatar.replace(/\.[^/.]+$/, '') === name)) {
                        data.entries[uid].characterFilter.names = data.entries[uid].characterFilter.names.filter(x => x !== name);
                    }
                }
            }
            setWIOriginalDataValue(data, uid, 'character_filter', data.entries[uid].characterFilter);
            !noSave && await saveWorldInfo(name, data);
        });
        characterExclusionInput.prop('checked', entry.characterFilter?.isExclude ?? false).trigger('input', { noSave: true });

        const characterFilter = editTemplate.find('select[name="characterFilter"]');
        characterFilter.data('uid', entry.uid);
        initCharacterFilterSelect2Helper(characterFilter);
        fillCharacterAndTagOptionsHelper({ characterFilter, entry });
        handleCharacterFilterChangeHelper({ characterFilter, data, entry, name });

        // Content
        const counter = editTemplate.find('.world_entry_form_token_counter');
        const countTokensDebounced = debounce(async function (counter, value) {
            const numberOfTokens = await getTokenCountAsync(value);
            $(counter).text(numberOfTokens);
        }, debounce_timeout.relaxed);
        const contentInputId = `world_entry_content_${entry.uid}`;
        const contentInput = editTemplate.find('textarea[name="content"]');
        contentInput.data('uid', entry.uid);
        contentInput.attr('id', contentInputId);
        contentInput[0].dataset.macros = '';
        contentInput.on('input', async function (_, { skipCount, noSave } = {}) {
            const uid = $(this).data('uid');
            const value = $(this).val();
            data.entries[uid].content = value;
            setWIOriginalDataValue(data, uid, 'content', data.entries[uid].content);
            !noSave && await saveWorldInfo(name, data);
            if (!skipCount) countTokensDebounced(counter, value);
        });
        contentInput.val(entry.content).trigger('input', { skipCount: true, noSave: true });
        editTemplate.find('.editor_maximize').attr('data-for', contentInputId);

        // Outlet name
        const outletNameInput = editTemplate.find('input[name="outletName"]');
        outletNameInput.data('uid', entry.uid);
        outletNameInput.on('input', async function (_, { noSave = false } = {}) {
            const uid = $(this).data('uid');
            const value = $(this).val();
            data.entries[uid].outletName = value;
            setWIOriginalDataValue(data, uid, 'extensions.outlet_name', data.entries[uid].outletName);
            !noSave && await saveWorldInfo(name, data);
        });
        outletNameInput.val(entry.outletName ?? '').trigger('input', { noSave: true });
        setTimeout(() => createEntryInputAutocomplete(outletNameInput, getOutletNameCallback(data), { allowMultiple: true }), 1);

        // Scan depth
        const scanDepthInput = editTemplate.find('input[name="scanDepth"]');
        scanDepthInput.data('uid', entry.uid);
        scanDepthInput.on('input', async function (_, { noSave = false } = {}) {
            const uid = $(this).data('uid');
            const isEmpty = $(this).val() === '';
            const value = Number($(this).val());
            if (value < 0) {
                $(this).val(0).trigger('input');
                toastr.warning('Scan depth cannot be negative');
                return;
            }
            if (value > MAX_SCAN_DEPTH) {
                $(this).val(MAX_SCAN_DEPTH).trigger('input');
                toastr.warning(`Scan depth cannot exceed ${MAX_SCAN_DEPTH}`);
                return;
            }
            data.entries[uid].scanDepth = !isEmpty && !isNaN(value) && value >= 0 && value <= MAX_SCAN_DEPTH ? Math.floor(value) : null;
            setWIOriginalDataValue(data, uid, 'extensions.scan_depth', data.entries[uid].scanDepth);
            !noSave && await saveWorldInfo(name, data);
        });
        scanDepthInput.val(entry.scanDepth ?? null).trigger('input', { noSave: true });

        // Group
        const groupInput = editTemplate.find('input[name="group"]');
        groupInput.data('uid', entry.uid);
        groupInput.on('input', async function (_, { noSave = false } = {}) {
            const uid = $(this).data('uid');
            const value = String($(this).val()).trim();
            data.entries[uid].group = value;
            setWIOriginalDataValue(data, uid, 'extensions.group', data.entries[uid].group);
            !noSave && await saveWorldInfo(name, data);
        });
        groupInput.val(entry.group ?? '').trigger('input', { noSave: true });
        setTimeout(() => createEntryInputAutocomplete(groupInput, getInclusionGroupCallback(data), { allowMultiple: true }), 1);

        // Inclusion priority
        const groupOverrideInput = editTemplate.find('input[name="groupOverride"]');
        groupOverrideInput.data('uid', entry.uid);
        groupOverrideInput.on('input', async function (_, { noSave = false } = {}) {
            const uid = $(this).data('uid');
            const value = $(this).prop('checked');
            data.entries[uid].groupOverride = value;
            setWIOriginalDataValue(data, uid, 'extensions.group_override', data.entries[uid].groupOverride);
            !noSave && await saveWorldInfo(name, data);
        });
        groupOverrideInput.prop('checked', entry.groupOverride).trigger('input', { noSave: true });

        // Group weight
        handleNumberInputHelper({
            inputElem: editTemplate.find('input[name="groupWeight"]'),
            entry, entryKey: 'groupWeight', data, name, min: 1, max: 10000, clamp: true,
        });

        // Sticky, cooldown, delay
        handleNumberInputHelper({
            inputElem: editTemplate.find('input[name="sticky"]'),
            entry, entryKey: 'sticky', data, name, min: 1, max: 10000, clamp: false,
        });
        handleNumberInputHelper({
            inputElem: editTemplate.find('input[name="cooldown"]'),
            entry, entryKey: 'cooldown', data, name, min: 1, max: 10000, clamp: false,
        });
        handleNumberInputHelper({
            inputElem: editTemplate.find('input[name="delay"]'),
            entry, entryKey: 'delay', data, name, min: 1, max: 10000, clamp: false,
        });

        // Exclude/prevent recursion
        handleMatchCheckboxHelper({ template: editTemplate, entry, fieldName: 'excludeRecursion', data, name });
        handleMatchCheckboxHelper({ template: editTemplate, entry, fieldName: 'preventRecursion', data, name });

        // Delay until recursion
        const delayUntilRecursionInput = editTemplate.find('input[name="delay_until_recursion"]');
        delayUntilRecursionInput.data('uid', entry.uid);
        const delayUntilRecursionLevelInput = editTemplate.find('input[name="delayUntilRecursionLevel"]');
        delayUntilRecursionLevelInput.data('uid', entry.uid);
        delayUntilRecursionInput.on('input', async function (_, { noSave = false } = {}) {
            const uid = $(this).data('uid');
            const toggled = $(this).prop('checked');
            const value = toggled ? data.entries[uid].delayUntilRecursion || true : false;
            if (!toggled) delayUntilRecursionLevelInput.val('');
            data.entries[uid].delayUntilRecursion = value;
            setWIOriginalDataValue(data, uid, 'extensions.delay_until_recursion', data.entries[uid].delayUntilRecursion);
            !noSave && await saveWorldInfo(name, data);
        });
        delayUntilRecursionInput.prop('checked', entry.delayUntilRecursion).trigger('input', { noSave: true });
        delayUntilRecursionLevelInput.on('input', async function (_, { noSave = false } = {}) {
            const uid = $(this).data('uid');
            const content = $(this).val();
            const value = content === '' ? (typeof data.entries[uid].delayUntilRecursion === 'boolean' ? data.entries[uid].delayUntilRecursion : true)
                : content === 1 ? true
                    : !isNaN(Number(content)) ? Number(content)
                        : false;
            data.entries[uid].delayUntilRecursion = value;
            setWIOriginalDataValue(data, uid, 'extensions.delay_until_recursion', data.entries[uid].delayUntilRecursion);
            !noSave && await saveWorldInfo(name, data);
        });
        delayUntilRecursionLevelInput.val(['number', 'string'].includes(typeof entry.delayUntilRecursion) ? entry.delayUntilRecursion : '').trigger('input', { noSave: true });

        // Boolean selects
        handleBooleanSelectHelper({ selectElem: editTemplate.find('select[name="caseSensitive"]'), entry, entryKey: 'caseSensitive', data, name });
        handleBooleanSelectHelper({ selectElem: editTemplate.find('select[name="matchWholeWords"]'), entry, entryKey: 'matchWholeWords', data, name });
        handleBooleanSelectHelper({ selectElem: editTemplate.find('select[name="useGroupScoring"]'), entry, entryKey: 'useGroupScoring', data, name });

        // Match checkboxes
        handleMatchCheckboxHelper({ template: editTemplate, entry, fieldName: 'matchPersonaDescription', data, name });
        handleMatchCheckboxHelper({ template: editTemplate, entry, fieldName: 'matchCharacterDescription', data, name });
        handleMatchCheckboxHelper({ template: editTemplate, entry, fieldName: 'matchCharacterPersonality', data, name });
        handleMatchCheckboxHelper({ template: editTemplate, entry, fieldName: 'matchCharacterDepthPrompt', data, name });
        handleMatchCheckboxHelper({ template: editTemplate, entry, fieldName: 'matchScenario', data, name });
        handleMatchCheckboxHelper({ template: editTemplate, entry, fieldName: 'matchCreatorNotes', data, name });

        // Automation ID
        const automationIdInput = editTemplate.find('input[name="automationId"]');
        automationIdInput.data('uid', entry.uid);
        automationIdInput.on('input', async function (_, { noSave = false } = {}) {
            const uid = $(this).data('uid');
            const value = $(this).val();
            data.entries[uid].automationId = value;
            setWIOriginalDataValue(data, uid, 'extensions.automation_id', data.entries[uid].automationId);
            !noSave && await saveWorldInfo(name, data);
        });
        automationIdInput.val(entry.automationId ?? '').trigger('input', { noSave: true });
        setTimeout(() => createEntryInputAutocomplete(automationIdInput, getAutomationIdCallback(data)), 1);

        // Generation Type Triggers
        const generationTypeTriggers = editTemplate.find('select[name="triggers"]');
        generationTypeTriggers.data('uid', entry.uid);
        generationTypeTriggers.on('input', async function (_, { noSave = false } = {}) {
            const uid = $(this).data('uid');
            const value = $(this).val();
            data.entries[uid].triggers = Array.isArray(value) ? value : [];
            setWIOriginalDataValue(data, uid, 'extensions.triggers', data.entries[uid].triggers);
            !noSave && await saveWorldInfo(name, data);
        });
        if (!isMobile()) {
            generationTypeTriggers.select2({
                placeholder: t`All types (default)`,
                width: '100%',
                closeOnSelect: false,
                allowClear: true,
            });
        }
        generationTypeTriggers
            .val(Array.isArray(entry.triggers) ? entry.triggers : [])
            .trigger('input', { noSave: true })
            .trigger('change');

        // Ignore budget
        const ignoreBudgetInput = editTemplate.find('input[name="ignoreBudget"]');
        ignoreBudgetInput.data('uid', entry.uid);
        ignoreBudgetInput.on('input', async function (_, { noSave = false } = {}) {
            const uid = $(this).data('uid');
            const value = $(this).prop('checked');
            data.entries[uid].ignoreBudget = value;
            setWIOriginalDataValue(data, uid, 'extensions.ignore_budget', data.entries[uid].ignoreBudget);
            !noSave && await saveWorldInfo(name, data);
        });
        ignoreBudgetInput.prop('checked', entry.ignoreBudget ?? false).trigger('input', { noSave: true });

        countTokensDebounced(counter, contentInput.val());

        editTemplate.find('.inline-drawer-content').css('display', 'none');
        editOutlet.append(editTemplate);
    }

    headerTemplate.find('.inline-drawer-content').css('display', 'none');

    return headerTemplate;
}

// Pre-cache templates after DOM is ready (matches original behavior)
$(() => {
    // Force template initialization after DOM ready
    const header = getHeaderTemplate();
    const edit = getEditTemplate();
    console.debug('[WI] Templates initialized:', {
        header: header.length,
        edit: edit.length,
    });
});
