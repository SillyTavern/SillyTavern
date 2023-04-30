import { callPopup } from "../../../script.js";
import { getContext } from "../../extensions.js";
export { MODULE_NAME };

const MODULE_NAME = 'dice';
const UPDATE_INTERVAL = 1000;

function setDiceIcon() {
    const sendButton = document.getElementById('roll_dice');
    /* sendButton.style.backgroundImage = `url(/img/dice-solid.svg)`; */
    sendButton.classList.remove('spin');
}

async function doDiceRoll() {
    let value = $(this).data('value');

    if (value == 'custom') {
        value = await callPopup('Enter the dice formula:<br><i>(for example, <tt>2d6</tt>)</i>', 'input');
    }

    const isValid = droll.validate(value);

    if (isValid) {
        const result = droll.roll(value);
        const context = getContext();
        context.sendSystemMessage('generic', `${context.name1} rolls a ${value}. The result is: ${result.total} (${result.rolls})`);
    }
}

function addDiceRollButton() {
    const buttonHtml = `
        <div id="roll_dice" class="fa-solid fa-dice" /></div>
        `;
    const dropdownHtml = `
    <div id="dice_dropdown">
        <ul class="list-group">
            <li class="list-group-item" data-value="d4">d4</li>
            <li class="list-group-item" data-value="d6">d6</li>
            <li class="list-group-item" data-value="d8">d8</li>
            <li class="list-group-item" data-value="d10">d10</li>
            <li class="list-group-item" data-value="d12">d12</li>
            <li class="list-group-item" data-value="d20">d20</li>
            <li class="list-group-item" data-value="d100">d100</li>
            <li class="list-group-item" data-value="custom">...</li>
        </ul>
    </div>`;

    $('#send_but_sheld').prepend(buttonHtml);
    $(document.body).append(dropdownHtml)
    $('#dice_dropdown li').on('click', doDiceRoll);
    const button = $('#roll_dice');
    const dropdown = $('#dice_dropdown');
    dropdown.hide();
    button.hide();

    let popper = Popper.createPopper(button.get(0), dropdown.get(0), {
        placement: 'top-start',
    });

    $(document).on('click touchend', function (e) {
        const target = $(e.target);
        if (target.is(dropdown)) return;
        if (target.is(button) && !dropdown.is(":visible")) {
            e.preventDefault();

            dropdown.show(200);
            popper.update();
        } else {
            dropdown.hide(200);
        }
    });
}

function addDiceScript() {
    if (!window.droll) {
        const script = document.createElement('script');
        script.src = "/scripts/extensions/dice/droll.js";
        document.body.appendChild(script);
    }
}

async function moduleWorker() {
    const context = getContext();

    context.onlineStatus === 'no_connection'
        ? $('#roll_dice').hide(200)
        : $('#roll_dice').show(200);
}

$(document).ready(function () {
    addDiceScript();
    addDiceRollButton();
    setDiceIcon();
    moduleWorker();
    setInterval(moduleWorker, UPDATE_INTERVAL);
});