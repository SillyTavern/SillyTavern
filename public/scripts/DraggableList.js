/**
 * Base Module for draggable lists
 *
 * Markup:
 * <ul id="example">
 *   <li id="example-template" draggable="true">
 *    <span data-dl-property="MyPropertyA"></span>
 *    <span data-dl-property="MyPropertyB"></span>
 *    <span data-dl-property="MyPropertyC"></span>
 *   </li>
 *   <li class="draggable" draggable="true">Example 1</li>
 *   <li class="draggable" draggable="true">Example 2</li>
 *   <li class="draggable" draggable="true">Example 3</li>
 * </ul>
 */
function DraggableListModule(listElement, onSwap) {
    if (!listElement) return;

    this.list = listElement;
    this.onSwap = onSwap;
    this.dragged = null;

    this.init();
}

DraggableListModule.prototype.init = function () {
    this.list.addEventListener("dragstart", (event) => {
        if (event.target.className.includes("draggable")) {
            this.dragged = event.target;
            event.target.style.opacity = '0.5';
        }
    }, false);

    this.list.addEventListener("dragend", (event) => {
        if (event.target.className.includes("draggable")) {
            event.target.style.opacity = "";
        }
    }, false);

    this.list.addEventListener("dragover", (event) => {
        event.preventDefault();
        const draggable = this.getClosestDraggable(event.target) || this.getClosestDroppable(event.target);
        if (draggable) {
            const rect = draggable.getBoundingClientRect();
            const overLocation = event.clientY - rect.top;
            const halfHeight = rect.height / 2;
            if (overLocation < halfHeight) {
                draggable.style.background = "linear-gradient(to top, transparent, transparent 60%, rgb(20,20,20) 75%, rgb(40,40,40) 85%, var(--white50a))";
            } else {
                draggable.style.background = "linear-gradient(to bottom, transparent, transparent 60%, rgb(20,20,20) 75%, rgb(40,40,40) 85%, var(--white50a))";
            }
        }
    }, false);

    this.list.addEventListener("dragleave", (event) => {
        event.preventDefault();
        const draggable = this.getClosestDraggable(event.target) || this.getClosestDroppable(event.target);
        if (draggable) draggable.style.background = "";
    }, false);

    this.list.addEventListener("drop", (event) => {
        event.preventDefault();
        const draggable = this.getClosestDraggable(event.target) || this.getClosestDroppable(event.target);

        if (draggable) {
            draggable.style.background = "";
            const rect = draggable.getBoundingClientRect();
            const dropLocation = event.clientY - rect.top;
            const halfHeight = rect.height / 2;
            if (dropLocation < halfHeight) {
                this.insertBefore(draggable, this.dragged);
            } else {
                this.insertAfter(draggable, this.dragged);
            }
        }
    }, false);
}

DraggableListModule.prototype.getClosestDraggable = function (element) {
    return element !== this.list && element.closest('#' + this.list.id)
        ? element.closest('.draggable')
        : null;
}

DraggableListModule.prototype.getClosestDroppable = function (element) {
    return element !== this.list && element.closest('#' + this.list.id)
        ? element.closest('.dropAllowed')
        : null;
}

DraggableListModule.prototype.insertBefore = function (target, origin) {
    if (!target || !origin) return;
    target.style.background = "";
    origin.style.opacity = "";

    target.parentNode.insertBefore(origin, target);

    this.onSwap(target, origin, 'before');
}

DraggableListModule.prototype.insertAfter = function (target, origin) {
    if (!target || !origin) return;
    console.log("after")
    target.style.background = "";
    origin.style.opacity = "";

    if (target.nextSibling) {
        target.parentNode.insertBefore(origin, target.nextSibling);
    } else {
        target.parentNode.appendChild(origin);
    }

    this.onSwap(target, origin, 'after');
}

/**
 * Draggable Prompt List
 */
function DraggablePromptListModule(listElement, onChange) {
    DraggableListModule.call(this, listElement, onChange);
}

DraggablePromptListModule.prototype = Object.create(DraggableListModule.prototype);

DraggablePromptListModule.prototype.constructor = DraggablePromptListModule;

export {DraggablePromptListModule};