import { chat_metadata } from "../../../script.js";
import { getContext, extension_settings, saveMetadataDebounced } from "../../extensions.js";
import {
    substituteParams,
    eventSource,
    event_types,
    generateQuietPrompt,
} from "../../../script.js";
import { registerSlashCommand } from "../../slash-commands.js";

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


//###############################//
//#       Task Management       #//
//###############################//

// Accepts optional index. Defaults to adding to end of list.
function addTask(description, index = null) {
    index = index != null ? index: index = globalTasks.length
    globalTasks.splice(index, 0, new ObjectiveTask(
        {description: description}
    ))
    saveState()
}

// Return the task and index or throw an error
function getTaskById(taskId){
    if (taskId == null) {
        throw `Null task id`
    }
    const index = globalTasks.findIndex((task) => task.id === taskId);
    if (index !== -1) {
        return { task: globalTasks[index], index: index };
    } else {
        throw `Cannot find task with ${taskId}`

    }
}

function deleteTask(taskId){
    const { task, index } = getTaskById(taskId)

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
            addTask(task.replace(numberedListPattern,"").trim())
        }
    }
    updateUiTaskList()
    console.info(`Response for Objective: '${globalObjective}' was \n'${taskResponse}', \nwhich created tasks \n${JSON.stringify(globalTasks.map(v => {return v.toSaveState()}), null, 2)} `)
    toastr.success(`Generated ${globalTasks.length} tasks`, 'Done!');
}

// Call Quiet Generate to check if a task is completed
async function checkTaskCompleted() {
    // Make sure there are tasks
    if (jQuery.isEmptyObject(currentTask)) {
        return
    }
    checkCounter = $('#objective-check-frequency').val()

    const prompt = substituteParams(objectivePrompts["checkTaskCompleted"].replace(/{{task}}/gi, currentTask.description));
    const taskResponse = (await generateQuietPrompt(prompt)).toLowerCase()

    // Check response if task complete
    if (taskResponse.includes("true")) {
        console.info(`Character determined task '${JSON.stringify(currentTask.toSaveState())} is completed.`)
        currentTask.completeTask()
    } else if (!(taskResponse.includes("false"))) {
        console.warn(`checkTaskCompleted response did not contain true or false. taskResponse: ${taskResponse}`)
    } else {
        console.debug(`Checked task completion. taskResponse: ${taskResponse}`)
    }
}


// Set a task in extensionPrompt context. Defaults to first incomplete
function setCurrentTask(taskId = null) {
    const context = getContext();
    currentTask = {};

    // Set current task to either the next incomplete task, or the index
    if (taskId === null) {
        currentTask = globalTasks.find(task => !task.completed) || {};
    } else {
        const { _, index } = getTaskById(taskId)
        currentTask = globalTasks[index];
    }

    // Get the task description and add to extension prompt
    const description = currentTask.description || null;

    // Now update the extension prompt

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

let taskIdCounter = 0
function getNextTaskId(){
    // Make sure id does not exist
    while (globalTasks.find(task => task.id == taskIdCounter) != undefined) {
        taskIdCounter += 1
    }
    const nextId = taskIdCounter
    console.log(`TaskID assigned: ${nextId}`)
    taskIdCounter += 1
    return nextId
}
class ObjectiveTask {
    id
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

    constructor ({id=undefined, description, completed=false, parent=null}) {
        this.description = description
        this.parent = parent
        this.children = []
        this.completed = completed

        // Generate a new ID if none specified
        if (id==undefined){
            this.id = getNextTaskId()
        } else {
            this.id=id
        }
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
        <div id="objective-task-label-${this.id}" class="flex1 checkbox_label">
            <input id="objective-task-complete-${this.id}" type="checkbox">
            <span class="text_pole" style="display: block" id="objective-task-description-${this.id}" contenteditable>${this.description}</span>
            <div id="objective-task-delete-${this.id}" class="objective-task-button fa-solid fa-xmark fa-2x" title="Delete Task"></div>
            <div id="objective-task-add-${this.id}" class="objective-task-button fa-solid fa-plus fa-2x" title="Add Task"></div>
        </div><br>
        `;

        // Add the filled out template
        $('#objective-tasks').append(template);

        this.completedCheckbox = $(`#objective-task-complete-${this.id}`);
        this.descriptionSpan = $(`#objective-task-description-${this.id}`);
        this.addButton = $(`#objective-task-add-${this.id}`);
        this.deleteButton = $(`#objective-task-delete-${this.id}`);

        // Add event listeners and set properties
        $(`#objective-task-complete-${this.id}`).prop('checked', this.completed);
        $(`#objective-task-complete-${this.id}`).on('click', () => (this.onCompleteClick()));
        $(`#objective-task-description-${this.id}`).on('keyup', () => (this.onDescriptionUpdate()));
        $(`#objective-task-description-${this.id}`).on('focusout', () => (this.onDescriptionFocusout()));
        $(`#objective-task-delete-${this.id}`).on('click', () => (this.onDeleteClick()));
        $(`#objective-task-add-${this.id}`).on('click', () => (this.onAddClick()));
    }

    onCompleteClick(){
        this.completed = this.completedCheckbox.prop('checked')
        setCurrentTask();
    }

    onDescriptionUpdate(){
        this.description = this.descriptionSpan.text();
    }
    onDescriptionFocusout(){
        setCurrentTask();
    }

    onDeleteClick(){
        deleteTask(this.id);
    }

    onAddClick(){
        const {_, index} = getTaskById(this.id)
        addTask("", index + 1);
        setCurrentTask();
        updateUiTaskList();
    }

    toSaveState() {
        return {
            "id":this.id,
            "description":this.description,
            "completed":this.completed,
            "parent": this.parent,
        }
    }
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
        "currentTask": currentTask.toSaveState(),
        "currentChatId": currentChatId,
        "checkCounter": checkCounter,
        "globalObjective": globalObjective,
        "globalTasks": globalTasks.map(v => {return v.toSaveState()}),
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
    checkCounter = $("#objective-check-frequency").val()
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
    globalTasks = chat_metadata['objective'].tasks.map(task => {
        return new ObjectiveTask({
            id: task.id,
            description: task.description,
            completed: task.completed,
            parent: task.parent,
        })
    });
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

function addManualTaskCheckUi() {
    $('#extensionsMenu').prepend(`
        <div id="objective-task-manual-check-menu-item" class="list-group-item flex-container flexGap5">
            <div id="objective-task-manual-check" class="extensionsMenuExtensionButton fa-regular fa-square-check"/></div>
            Manual Task Check
        </div>`)
    $('#objective-task-manual-check-menu-item').attr('title', 'Trigger AI check of completed tasks').on('click', checkTaskCompleted)
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
            <div class="objective_block flex-container">
                <input id="objective-generate" class="menu_button" type="submit" value="Auto-Generate Tasks" />
                <label class="checkbox_label"><input id="objective-hide-tasks" type="checkbox"> Hide Tasks</label>
            </div>

            <div id="objective-tasks"> </div>
            <div class="objective_block margin-bot-10px">
                <div class="objective_block objective_block_control flex1 flexFlowColumn">
                    <label for="objective-chat-depth">Position in Chat</label>
                    <input id="objective-chat-depth" class="text_pole widthUnset" type="number" min="0" max="99" />
                </div>
                <br>
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

    registerSlashCommand('taskcheck', checkTaskCompleted, [], ' – checks if the current task is completed', true, true);
});
