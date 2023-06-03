import { chat_metadata } from "../../../script.js";
import { getContext, extension_settings, saveMetadataDebounced } from "../../extensions.js";
import {
    substituteParams,
    eventSource,
    event_types,
} from "../../../script.js";

const MODULE_NAME = "Objective"


let globalObjective = ""
let globalTasks = []
let currentChatId = ""
let currentTask = null
let checkCounter = 0


const objectivePrompts = {
    "createTask": `Pause your roleplay and generate a list of tasks to complete an objective. Your next response must be formatted as a numbered list of plain text entries. Do not include anything but the numbered list. The list must be prioritized in the order that tasks must be completed.

    The objective that you must make a numbered task list for is: [{{objective}}].
    The tasks created should take into account the character traits of {{char}}. These tasks may or may not involve {{user}} directly. Be sure to include the objective as the final task.

    Given an example objective of 'Make me a four course dinner', here is an example output:
    1. Determine what the courses will be
    2. Find recipes for each course
    3. Go shopping for supplies with {{user}}
    4. Cook the food
    5. Get {{user}} to set the table
    6. Serve the food
    7. Enjoy eating the meal with {{user}}
    `,
    "checkTaskCompleted": `Pause your roleplay. Determine if this task is completed: [{{task}}].
    To do this, examine the most recent messages. Your response must only contain either true or false, nothing other words.
    Example output:
    true
    `
}

const extensionPrompt = "Your current task is [{{task}}]. Balance existing roleplay with completing this task."

// Background prompt generation
async function generateQuietPrompt(quiet_prompt) {
    return await new Promise(
        async function promptPromise(resolve, reject) {
            try {
                await getContext().generate('quiet', { resolve, reject, quiet_prompt, force_name2: true, });
            }
            catch {
                reject();
            }
        });
}

//###############################//
//#       Task Management       #//
//###############################//

// Accepts optional index. Defaults to adding to end of list.
function addTask(description, index = null) {
    index = index != null ? index: index = globalTasks.length
    globalTasks.splice(index, 0, new ObjectiveTask(
        index,
        description,
    ))
    saveState()
}

// Get a task either by index or task description. Return current task if none specified
function getTask(index = null, taskDescription = null) {
    let task = {}
    if (index == null && taskDescription == null) {
        task = currentTask
    } else if (index != null) {
        task = globalTasks[index]
    } else if (taskDescription != null) {
        task = globalTasks.find(task => {
            return task.description == description ? true: false
        })
    }
    return task
}

function deleteTask(index){
    globalTasks.splice(index, 1)
    setCurrentTask()
    updateUiTaskList()
}

// Call Quiet Generate to create task list using character context, then convert to tasks. Should not be called much.
async function generateTasks() {
    const prompt = substituteParams(objectivePrompts["createTask"].replace(/{{objective}}/gi, globalObjective));
    console.log(`Generating tasks for objective with prompt`)
    toastr.info('Generating tasks for objective', 'Please wait...');
    const taskResponse = await generateQuietPrompt(prompt)

    // Clear all existing global tasks when generating
    globalTasks = []
    const numberedListPattern = /^\d+\./

    // Create tasks from generated task list
    for (const task of taskResponse.split('\n').map(x => x.trim())) {
        if (task.match(numberedListPattern) != null) {
            addTask(task.replace(numberedListPattern).trim())
        }
    }
    updateUiTaskList()
    console.info(`Response for Objective: '${globalObjective}' was \n'${taskResponse}', \nwhich created tasks \n${JSON.stringify(globalTasks, null, 2)} `)
    toastr.success(`Generated ${globalTasks.length} tasks`, 'Done!');
}

// Call Quiet Generate to check if a task is completed
async function checkTaskCompleted() {
    // Make sure there are tasks 
    if (currentTask == null) {
        return
    }
    checkCounter = $('#objective-check-frequency').val()

    const prompt = substituteParams(objectivePrompts["checkTaskCompleted"].replace(/{{task}}/gi, currentTask.description));
    const taskResponse = (await generateQuietPrompt(prompt)).toLowerCase()

    // Check response if task complete
    if (taskResponse.includes("true")) {
        console.info(`Character determined task '${JSON.stringify(currentTask)} is completed.`)
        currentTask.completeTask()
    } else if (!(taskResponse.includes("false"))) {
        console.warn(`checkTaskCompleted response did not contain true or false. taskResponse: ${taskResponse}`)
    } else {
        console.debug(`Checked task completion. taskResponse: ${taskResponse}`)
    }
}


// Set a task in extensionPrompt context. Defaults to first incomplete
function setCurrentTask(index = null) {
    const context = getContext();
    currentTask = {};

    // Set current task to either the next incomplete task, or the index if valid value is specified
    if (index === null) {
        currentTask = globalTasks.find(task => !task.completed) || {};
    } else {
        if (index >= 0 && index < globalTasks.length){
            toastr.error(`Invalide task index ${index} specified. Must be between 0 and ${globalTasks.length}`)
            return
        }
        currentTask = globalTasks[index];
    }

    // Get the task description and add to extension prompt 
    const { description } = currentTask.description;

    if (description) {
        const extensionPromptText = extensionPrompt.replace(/{{task}}/gi, description);
        context.setExtensionPrompt(MODULE_NAME, extensionPromptText, 1, $('#objective-chat-depth').val());
        console.info(`Current task in context.extensionPrompts.Objective is ${JSON.stringify(context.extensionPrompts.Objective)}`);
    } else {
        context.setExtensionPrompt(MODULE_NAME, '');
        console.info(`No current task`);
    }

    saveState();
}

class ObjectiveTask {
    // Task State
    index
    description
    completed
    parent
    children

    // UI Elements
    taskHtml
    descriptionSpan
    completedCheckbox
    deleteTaskButton
    addTaskButton

    constructor (index, description, parent=null) {
        this.index = index
        this.description = description
        this.parent = parent
    }
    

    // Complete the current task, setting next task to next incomplete task
    completeTask() {
        this.completed = true
        console.info(`Task successfully completed: ${JSON.stringify(this.description)}`)
        setCurrentTask()
        updateUiTaskList()
    }

    // Add a single task to the UI and attach event listeners for user edits
    addUiElement() {
        const template = `
        <div id="objective-task-label-${this.index}" class="flex1 checkbox_label">
            <span>${this.index}</span>
            <input id="objective-task-complete-${this.index}" type="checkbox">
            <span class="text_pole" style="display: block" id="objective-task-description-${this.index}" contenteditable>${this.description}</span>
            <div id="objective-task-delete-${this.index}" class="objective-task-button fa-solid fa-xmark fa-2x" title="Delete Task"></div>
            <div id="objective-task-add-${this.index}" class="objective-task-button fa-solid fa-plus fa-2x" title="Add Task"></div>
        </div><br>
        `;
        
        // Add the filled out template
        $('#objective-tasks').append(template);

        this.completedCheckbox = $(`#objective-task-complete-${this.index}`);
        this.descriptionSpan = $(`#objective-task-description-${this.index}`);
        this.addButton = $(`#objective-task-add-${this.index}`);
        this.deleteButton = $(`#objective-task-delete-${this.index}`);

        // Add event listeners and set properties
        $(`#objective-task-complete-${this.index}`).prop('checked', this.completed);
        $(`#objective-task-complete-${this.index}`).on('click', () => (this.onCompleteClick()));
        $(`#objective-task-description-${this.index}`).on('keyup', () => (this.onDescriptionUpdate()));
        $(`#objective-task-delete-${this.index}`).on('click', () => (this.onDeleteClick()));
        $(`#objective-task-add-${this.index}`).on('click', () => (this.onAddClick()));
    }

    onCompleteClick(){
        this.completed = this.completedCheckbox.val()
        setCurrentTask();
    }

    onDescriptionUpdate(){
        this.description = this.descriptionSpan.val();
    }
    
    onDeleteClick(){
        deleteTask(this.index);
    }

    onAddClick(){
        addTask("", this.index + 1);
        setCurrentTask();
        updateUiTaskList();
    }

    toSaveState() {
        return {
            "index":this.index,
            "description":this.description,
            "completed":this.completed,
        }
    }
}

class TaskManager {
    tasks = {}
    
    constructor (){
    }

    addTask (description, index, parent) {
        if (this.tasks){}
    }

    deleteTask (index) {}
}

//###############################//
//#       UI AND Settings       #//
//###############################//


const defaultSettings = {
    objective: "",
    tasks: [],
    chatDepth: 2,
    checkFrequency: 3,
    hideTasks: false
}

// Convenient single call. Not much at the moment.
function resetState() {
    loadSettings();
}

//
function saveState() {
    const context = getContext();

    if (currentChatId == "") {
        currentChatId = context.chatId
    }

    // Convert globalTasks for saving
    const tasks = globalTasks.map(task => {return task.toSaveState()})

    chat_metadata['objective'] = {
        objective: globalObjective,
        tasks: tasks,
        checkFrequency: $('#objective-check-frequency').val(),
        chatDepth: $('#objective-chat-depth').val(),
        hideTasks: $('#objective-hide-tasks').prop('checked'),
    }

    saveMetadataDebounced();
}

// Dump core state
function debugObjectiveExtension() {
    console.log(JSON.stringify({
        "currentTask": currentTask,
        "currentChatId": currentChatId,
        "checkCounter": checkCounter,
        "globalObjective": globalObjective,
        "globalTasks": globalTasks,
        "extension_settings": chat_metadata['objective'],
    }, null, 2))
}

window.debugObjectiveExtension = debugObjectiveExtension

// Populate UI task list
function updateUiTaskList() {
    $('#objective-tasks').empty()
    // Show tasks if there are any
    if (globalTasks.length > 0){
        for (const task of globalTasks) {
            task.addUiElement()
        }
    } else {
    // Show button to add tasks if there are none
        $('#objective-tasks').append(`
        <input id="objective-task-add-first" type="button" class="menu_button" value="Add Task">
        `)
        $("#objective-task-add-first").on('click', () => {
            addTask("")
            setCurrentTask()
            updateUiTaskList()
        })
    }
}

function addManualTaskCheckUi() {
    $('#extensionsMenu').prepend(`
        <div id="objective-task-manual-check-menu-item" class="list-group-item flex-container flexGap5">
            <div id="objective-task-manual-check" class="extensionsMenuExtensionButton fa-regular fa-square-check"/></div>
            Manual Task Check
        </div>`)
    $('#objective-task-manual-check-menu-item').attr('title', 'Trigger AI check of completed tasks').on('click', checkTaskCompleted)
}

// Trigger creation of new tasks with given objective.
async function onGenerateObjectiveClick() {
    globalObjective = $('#objective-text').val()
    await generateTasks()
    saveState()
}

// Update extension prompts
function onChatDepthInput() {
    saveState()
    setCurrentTask() // Ensure extension prompt is updated
}

// Update how often we check for task completion
function onCheckFrequencyInput() {
    checkCounter =  $("#objective-check-frequency").val()
    $('#objective-counter').text(checkCounter)
    saveState()
}

function onHideTasksInput() {
    $('#objective-tasks').prop('hidden', $('#objective-hide-tasks').prop('checked'))
    saveState()
}

function loadSettings() {
    // Load/Init settings for chatId
    currentChatId = getContext().chatId

    // Bail on home screen
    if (currentChatId == undefined) {
        return
    }

    // Migrate existing settings
    if (currentChatId in extension_settings.objective) {
        chat_metadata['objective'] = extension_settings.objective[currentChatId];
        delete extension_settings.objective[currentChatId];
    }

    if (!('objective' in chat_metadata)) {
        Object.assign(chat_metadata, { objective: defaultSettings });
    }

    // Update globals
    globalObjective = chat_metadata['objective'].objective
    globalTasks = chat_metadata['objective'].tasks.map((task, index) => {return new ObjectiveTask(index, task.description)})
    checkCounter = chat_metadata['objective'].checkFrequency

    // Update UI elements
    $('#objective-counter').text(checkCounter)
    $("#objective-text").text(globalObjective)
    updateUiTaskList()
    $('#objective-chat-depth').val(chat_metadata['objective'].chatDepth)
    $('#objective-check-frequency').val(chat_metadata['objective'].checkFrequency)
    $('#objective-hide-tasks').prop('checked', chat_metadata['objective'].hideTasks)
    onHideTasksInput()
    setCurrentTask()
}

jQuery(() => {
    const settingsHtml = `
    <div class="objective-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
            <b>Objective</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <label for="objective-text"><small>Enter an objective and generate tasks. The AI will attempt to complete tasks autonomously</small></label>
            <textarea id="objective-text" type="text" class="text_pole textarea_compact" rows="4"></textarea>
            <div class="objective_block">
                <input id="objective-generate" class="menu_button" type="submit" value="Generate Tasks" />
                <small>Automatically generate tasks for Objective. Takes a moment.</small>
            </div>
            </br>
            <label class="checkbox_label"><input id="objective-hide-tasks" type="checkbox"> Hide Tasks</label><br>
            <div id="objective-tasks"> </div>
            <div class="objective_block">
                <div class="objective_block objective_block_control flex1">
                    <label for="objective-chat-depth">In-chat @ Depth</label>
                    <input id="objective-chat-depth" class="text_pole widthUnset" type="number" min="0" max="99" />
                </div>
                <div class="objective_block objective_block_control flex1">
                    <label for="objective-check-frequency">Task Check Frequency</label>
                    <input id="objective-check-frequency" class="text_pole widthUnset" type="number" min="0" max="99" />
                    <small>(0 = disabled)</small>
                </div>
            </div>
            <span> Messages until next AI task completion check <span id="objective-counter">0</span></span>
            <hr class="sysHR">
        </div>
    </div>`;

    addManualTaskCheckUi()
    $('#extensions_settings').append(settingsHtml);
    $('#objective-generate').on('click', onGenerateObjectiveClick)
    $('#objective-chat-depth').on('input', onChatDepthInput)
    $("#objective-check-frequency").on('input', onCheckFrequencyInput)
    $('#objective-hide-tasks').on('click', onHideTasksInput)
    loadSettings()

    eventSource.on(event_types.CHAT_CHANGED, () => {
        resetState()
    });

    eventSource.on(event_types.MESSAGE_RECEIVED, () => {
        if (currentChatId == undefined) {
            return
        }
        if ($("#objective-check-frequency").val() > 0) {
            // Check only at specified interval
            if (checkCounter <= 0) {
                checkTaskCompleted();
            }
            checkCounter -= 1
        }
        setCurrentTask();
        $('#objective-counter').text(checkCounter)
    });
});
