import {
    sendSystemMessage,
    substituteParams,
    system_message_types,
    generateRaw,
    saveSettingsDebounced
} from "../../../script.js";
import { registerSlashCommand } from "../../slash-commands.js"
import { extension_settings } from "../../extensions.js";

//export { MODULE_NAME, listVariables, getVariable, registerVariable, parseVariableCommand }
export { MODULE_NAME }

const defaultSettings = {
    saved_vars: {},
    tmp_vars: {}
}

const MODULE_NAME = "variables_extension";
const DEBUG_PREFIX = "<Variables extension> ";
//console.debug(DEBUG_PREFIX, "fdg");

function loadSettings() {
    if (extension_settings.variables_extension === undefined){
        extension_settings.variables_extension = {};
    }

    if (Object.keys(extension_settings.variables_extension).length != Object.keys(defaultSettings).length) {
        Object.assign(extension_settings.variables_extension, defaultSettings);
    }

    extension_settings.variables_extension.tmp_vars = {};
    saveSettingsDebounced();

    for (var key of Object.keys(extension_settings.variables_extension.saved_vars)) {
        extension_settings.variables_extension.tmp_vars[key] = extension_settings.variables_extension.saved_vars[key];
    }
    saveSettingsDebounced();
    
    console.debug(DEBUG_PREFIX, "Loaded saved variables: " + JSON.stringify(extension_settings.variables_extension.saved_vars));
}

function updateVariables(){
    for (var key of Object.keys(extension_settings.variables_extension.saved_vars)) {
        extension_settings.variables_extension.tmp_vars[key] = extension_settings.variables_extension.saved_vars[key];
    }
    saveSettingsDebounced();
}

/*
function getVariable(_, variable) {
    const sanitizedVariable = variable.replace(/\s/g, '_');
    const foundVariable = substituteParams(extension_settings.variables_extension.tmp_vars[sanitizedVariable]);
    
    if (foundVariable !== undefined) {
        return foundVariable;
    } else {
        toastr.warning(`${sanitizedVariable} not found!`);
        return "none";
    }
}
*/

function registerVariable(name, variable_text) {
    const sanitizedName = name.replace(/\s/g, '_');
    extension_settings.variables_extension.tmp_vars[sanitizedName] = variable_text;
    if (extension_settings.variables_extension.saved_vars[name] !== undefined){
        saveVariable(name);
    }
    saveSettingsDebounced();
}

function parseVariableCommand(text) {
    if (!text) {
        return;
    }

    const parts = text.split('\n');
    if (parts.length <= 1) {
        toastr.warning('Both variable name and text are required. Separate them with a new line.');
        return;
    }

    const name = parts.shift().trim();
    const variableText = parts.join('\n').trim();

    try {
        return [name, variableText];
    } catch (error) {
        toastr.error(`Failed to parse: ${error.message}`);
    }
}

/// commands ///

registerSlashCommand("setvar", (_, text) => setVariable(_, text), ["setvariable"], ` – Creates/Edits a new variable.`, true, true);
async function setVariable(_, text) {
    updateVariables();
    var [varname, vartext] = parseVariableCommand(text);
    registerVariable(varname, vartext);
}

registerSlashCommand("savevar", (_, text) => saveVariable(text), ["savevariable"], ` – Saves a variable to file.`, true, true);
async function saveVariable(name){
    extension_settings.variables_extension.saved_vars[name] = extension_settings.variables_extension.tmp_vars[name];
    saveSettingsDebounced();
}

registerSlashCommand("deletevar", (_, text) => deleteVariable(text), ["deletevariable"], ` – Deletes a variable from file and tmp.`, true, true);
async function deleteVariable(name) {
    delete extension_settings.variables_extension.tmp_vars[name];
    delete extension_settings.variables_extension.saved_vars[name];
    saveSettingsDebounced();
}

registerSlashCommand("listvars", (_, text) => listVariables(), ["listvariables"], ` – lists all currently saved variables.`, true, true);
async function listVariables(_) {
    updateVariables();
    if (Object.keys(extension_settings.variables_extension.tmp_vars).length === 0) {
        toastr.warning('No variables set yet!');
        return;
    }

    const variableList = Object.keys(extension_settings.variables_extension.tmp_vars)
        .map(key => `<li>${extension_settings.variables_extension.saved_vars[key] !== undefined ? "(Saved) ~ " : ""}<span class="monospace">"${key}"</span>: "${variables[key]}"</li>`)
        .join('\n');

    const infoStr = "<small>Variables get reset on SillyTavern restart!</small>";
    const outputString = `Registered variables:\n<ol>${variableList}</ol>\n${infoStr}`;

    sendSystemMessage(system_message_types.GENERIC, outputString);
}

registerSlashCommand("clearvars", (_, text) => clearTmpVariables(), ["cleartmpvariables"], ` – Deletes all Tmp variables.`, true, true);
async function clearTmpVariables(_) {
    updateVariables();
    extension_settings.variables_extension.tmp_vars = {};
    saveSettingsDebounced();
}


/// Unrelated commands ///
//Note: always place updateVariables(); in the first line of your command!

registerSlashCommand("generate_raw", (_, text) => gen_raw_command(text), ["graw"], ` - Lets you generate things based on a prompt you input. Example: <pre><code>/generate_raw variable_name&#10;Once upon a time</code></pre>when done generating, it will be saved inside the variable.`, true, true);
function gen_raw_command(text) {
    updateVariables();
    const [varname, vartext] = parseVariableCommand(substituteParams(text));
    toastr.info('Generating... please wait!');

    generateRaw(vartext, undefined)
        .then((generatedText) => {
            registerVariable(varname, `${generatedText} ${vartext}`);
            toastr.info('Done generating!');
        })
        .catch((error) => {
            toastr.error('An error occurred: ', error);
        });
}

jQuery(async () => {
    loadSettings();
});