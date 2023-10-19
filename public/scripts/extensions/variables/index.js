import {
    sendSystemMessage,
    substituteParams,
    system_message_types,
    generateRaw,
    saveSettingsDebounced
} from "../../../script.js";
import { registerSlashCommand } from "../../slash-commands.js"
import { extension_settings } from "../../extensions.js";

export { MODULE_NAME, listVariables, setVariable, variables, getVariable, registerVariable, parseVariableCommand }

const defaultSettings = {
    saved_vars: {}
}

const MODULE_NAME = "variables_extension";
const DEBUG_PREFIX = "<Variables extension> ";
//console.debug(DEBUG_PREFIX, "fdg");
var variables = {};

function loadSettings() {
    //if (extension_settings.variables_extension === undefined){
        //extension_settings.variables_extension = {};
    //}

    //if (Object.keys(extension_settings.variables_extension).length != Object.keys(defaultSettings).length) {
    //    Object.assign(extension_settings.variables_extension, defaultSettings);
    //}

    for (var key of Object.keys(extension_settings.variables_extension.saved_vars)) {
        variables[key] = extension_settings.variables_extension.saved_vars[key];
    }

    console.debug(DEBUG_PREFIX, "Loaded saved variables: " + JSON.stringify(extension_settings.variables_extension));
}

function getVariable(_, variable) {
    const sanitizedVariable = variable.replace(/\s/g, '_');
    const foundVariable = substituteParams(variables[sanitizedVariable]);
    
    if (foundVariable !== undefined) {
        return foundVariable;
    } else {
        toastr.warning(`${sanitizedVariable} not found!`);
        return "none";
    }
}

function registerVariable(name, variable_text) {
    const sanitizedName = name.replace(/\s/g, '_');
    variables[sanitizedName] = variable_text;
    if (extension_settings.variables_extension.saved_vars[name] !== undefined){
        saveVariable(name);
    }
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
        toastr.error(`Failed to register variable: ${error.message}`);
    }
}

/// commands ///

registerSlashCommand("setvar", (_, text) => setVariable(_, text), ["setvariable"], ` – Edits/Creates a new variable.`, true, true);
async function setVariable(_, text) {
    var [varname, vartext] = parseVariableCommand(text);
    registerVariable(varname, vartext);
}

registerSlashCommand("savevar", (_, text) => saveVariable(text), ["savevariable"], ` – Saves a variable to file.`, true, true);
async function saveVariable(name){
    extension_settings.variables_extension.saved_vars[name] = variables[name];
    saveSettingsDebounced();
}

registerSlashCommand("deletevar", (_, text) => deleteVariable(text), ["deletevariable"], ` – Deletes a variable from file and tmp.`, true, true);
async function deleteVariable(name) {
    const index = variables.indexOf(name);
    if (index > -1) { // only splice array when item is found
        variables.splice(index, 1); // 2nd parameter means remove one item only
    }
    const index2 = variables.indexOf(extension_settings.variables_extension.saved_vars);
    if (index2 > -1) { // only splice array when item is found
        variables.splice(index2, 1); // 2nd parameter means remove one item only
    }
    saveSettingsDebounced();
}

registerSlashCommand("listvars", (_, text) => listVariables(), ["listvariables"], ` – lists all currently saved variables.`, true, true);
async function listVariables(_) {
    if (Object.keys(variables).length === 0) {
        toastr.warning('No variables set yet!');
        return;
    }

    const variableList = Object.keys(variables)
        .map(key => `<li>${extension_settings.variables_extension.saved_vars[key] !== undefined ? "(Saved) ~ " : ""}<span class="monospace">"${key}"</span>: "${variables[key]}"</li>`)
        .join('\n');

    const infoStr = "<small>Variables get reset on SillyTavern restart!</small>";
    const outputString = `Registered variables:\n<ol>${variableList}</ol>\n${infoStr}`;

    sendSystemMessage(system_message_types.GENERIC, outputString);
}

registerSlashCommand("generate_raw", (_, text) => gen_raw_command(text), ["graw"], ` - Lets you generate things based on a prompt you input. Example: <pre><code>/generate_raw variable_name&#10;Once upon a time</code></pre>when done generating, it will be saved inside the variable.`, true, true);
function gen_raw_command(text) {
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