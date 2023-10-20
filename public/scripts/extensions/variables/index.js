import {
    sendSystemMessage,
    substituteParams,
    system_message_types,
    generateRaw,
    saveSettingsDebounced
} from "../../../script.js";
import { registerSlashCommand } from "../../slash-commands.js"
import { extension_settings } from "../../extensions.js";

export { MODULE_NAME }

const MODULE_NAME = "variables_extension";

const DEBUG_PREFIX = "<Variables extension> ";
function FUNC_PREFIX(f){ return `<${f}>`; }
const SEPARATOR = ": ";

const defaultSettings = {
    saved_vars: {},
    tmp_vars: {}
}


function loadSettings() {
    if (extension_settings.variables_extension === undefined){
        extension_settings.variables_extension = {};
    }

    if (Object.keys(extension_settings.variables_extension).length != Object.keys(defaultSettings).length) {
        Object.assign(extension_settings.variables_extension, defaultSettings);
    }

    extension_settings.variables_extension.tmp_vars = {};
    saveSettingsDebounced();
    console.debug(DEBUG_PREFIX, FUNC_PREFIX("loadSettings"), SEPARATOR, "Cleared tmp_vars");

    for (var key of Object.keys(extension_settings.variables_extension.saved_vars)) {
        extension_settings.variables_extension.tmp_vars[key] = extension_settings.variables_extension.saved_vars[key];
    }
    saveSettingsDebounced();
    
    console.debug(DEBUG_PREFIX, FUNC_PREFIX("loadSettings"), SEPARATOR, "Loaded saved variables: " + JSON.stringify(extension_settings.variables_extension.saved_vars));
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
        console.debug(DEBUG_PREFIX, FUNC_PREFIX("registerVariable"), SEPARATOR, sanitizedName+" is saved, saved variable was updated in saved_vars");
    }
    saveSettingsDebounced();
    console.debug(DEBUG_PREFIX, FUNC_PREFIX("registerVariable"), SEPARATOR, sanitizedName+" variable was registered into tmp_vars");
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

/// Commands (Directly related to variables system) ///

registerSlashCommand("setvar", (_, text) => setVariable(_, text), ["var.s"], ` – Creates/Edits a new variable.`, true, true);
async function setVariable(_, text) {
    updateVariables();
    var [varname, vartext] = parseVariableCommand(text);
    registerVariable(varname, vartext);
    console.debug(DEBUG_PREFIX, FUNC_PREFIX("setVariable"), SEPARATOR, varname+" variable was registered into tmp_vars, with text: " + vartext);
}

registerSlashCommand("savevar", (_, text) => saveVariable(text), ["var.sa"], ` – Saves a variable to file.`, true, true);
async function saveVariable(name){
    updateVariables();
    extension_settings.variables_extension.saved_vars[name] = extension_settings.variables_extension.tmp_vars[name];
    saveSettingsDebounced();
    console.debug(DEBUG_PREFIX, FUNC_PREFIX("saveVariable"), SEPARATOR, name+" variable was registered into saved_vars");
}

registerSlashCommand("clonevar", (_, text) => cloneVariable(text), ["var.cl"], ` – Clones/Duplicates a variable.`, true, true);
async function cloneVariable(nameraw){
    updateVariables();
    const appendUniqueKey = (obj, nameraw) => {
        let num = 0;
        while (obj.hasOwnProperty(nameraw + (num > 0 ? `_${num}` : ''))) {
          num++;
        }
        return nameraw + (num > 0 ? `_${num}` : '');
    };
    const name = appendUniqueKey(extension_settings.variables_extension.tmp_vars, nameraw);
    extension_settings.variables_extension.tmp_vars[name] = extension_settings.variables_extension.tmp_vars[nameraw];
    saveSettingsDebounced();
    console.debug(DEBUG_PREFIX, FUNC_PREFIX("cloneVariable"), SEPARATOR, name+" variable was cloned with name "+nameraw);
}

registerSlashCommand("deletevar", (_, text) => deleteVariable(text), ["var.d"], ` – Deletes a variable from file and tmp.`, true, true);
async function deleteVariable(name) {
    delete extension_settings.variables_extension.tmp_vars[name];
    delete extension_settings.variables_extension.saved_vars[name];
    saveSettingsDebounced();
    console.debug(DEBUG_PREFIX, FUNC_PREFIX("deleteVariable"), SEPARATOR, name+" variable was deleted from tmp_vars and saved_vars");
}

registerSlashCommand("listvars", (_, text) => listVariables(), ["var.l"], ` – lists all currently saved variables.`, true, true);
async function listVariables(_) {
    updateVariables();
    if (Object.keys(extension_settings.variables_extension.tmp_vars).length === 0) {
        toastr.warning('No variables set yet!');
        return;
    }

    const variableList = Object.keys(extension_settings.variables_extension.tmp_vars)
        .map(key => `<li>${extension_settings.variables_extension.saved_vars[key] !== undefined ? "(Saved) ~ " : ""}<span class="monospace">"${key}"</span>: "${extension_settings.variables_extension.tmp_vars[key]}"</li>`)
        .join('\n');

    const infoStr = "<small>Variables get reset on SillyTavern restart!</small>";
    const outputString = `Registered variables:\n<ol>${variableList}</ol>\n${infoStr}`;

    sendSystemMessage(system_message_types.GENERIC, outputString);
}

registerSlashCommand("cleartmpvars", (_, text) => clearTmpVariables(), ["var.c"], ` – Deletes all Tmp variables.`, true, true);
async function clearTmpVariables(_) {
    updateVariables();
    extension_settings.variables_extension.tmp_vars = {};
    saveSettingsDebounced();
    console.debug(DEBUG_PREFIX, FUNC_PREFIX("clearTmpVariables"), SEPARATOR, "All tmp_vars were deleted");
}


/// Commands ///
//Note: always place updateVariables(); in the first line of your command!

registerSlashCommand("graw", (_, text) => gen_raw_command(text), ["generate_raw"], ` - Lets you generate things based on a prompt you input. Example: <pre><code>/generate_raw variable_name&#10;Once upon a time</code></pre>when done generating, it will be saved inside the variable.`, true, true);
function gen_raw_command(text) {
    updateVariables();
    const [varname, prompt] = parseVariableCommand(substituteParams(text));
    console.debug(DEBUG_PREFIX, FUNC_PREFIX("gen_raw_command"), SEPARATOR, "Generating with main api...");
    //toastr.info('Generating... please wait!');

    generateRaw(prompt, undefined)
        .then((generatedText) => {
            registerVariable(varname, `${generatedText} ${prompt}`);
            console.debug(DEBUG_PREFIX, FUNC_PREFIX("gen_raw_command"), SEPARATOR, `Done generating! Stored in ${varname} variable, with generatedText: ${generatedText}`);
            //toastr.info('Done generating!');
        })
        .catch((error) => {
            toastr.error('An error occurred: ', error);
        });
}

jQuery(async () => {
    loadSettings();
});