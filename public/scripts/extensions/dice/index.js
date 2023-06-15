import { callPopup } from "../../../script.js";
import { getContext } from "../../extensions.js";
import { registerSlashCommand } from "../../slash-commands.js";
export { MODULE_NAME };

const MODULE_NAME = 'dice';
const UPDATE_INTERVAL = 1000;

async function doDiceRoll(customDiceFormula) {
    let value = typeof customDiceFormula === 'string' ? customDiceFormula.trim() : $(this).data('value');

    if (value == 'custom') {
        value = await callPopup('Enter the dice formula:<br><i>(for example, <tt>2d6</tt>)</i>', 'input');x
    }

    if (!value) {
        return;
    }

    const isValid = droll.validate(value);

    if (isValid) {
        const result = droll.roll(value);
        const context = getContext();
        context.sendSystemMessage('generic', `${context.name1} rolls a ${value}. The result is: ${result.total} (${result.rolls})`, { isSmallSys: true });
    } else {
        toastr.warning('Invalid dice formula');
    }
}

function addDiceRollButton() {
    const buttonHtml = `
    <div id="roll_dice" class="list-group-item flex-container flexGap5">
        <div class="fa-solid fa-dice extensionsMenuExtensionButton" title="Roll Dice" /></div>
        Roll Dice
    </div>
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

    $('#extensionsMenu').prepend(buttonHtml);

    $(document.body).append(dropdownHtml)
    $('#dice_dropdown li').on('click', doDiceRoll);
    const button = $('#roll_dice');
    const dropdown = $('#dice_dropdown');
    dropdown.hide();
    button.hide();

    let popper = Popper.createPopper(button.get(0), dropdown.get(0), {
        placement: 'top',
    });

    $(document).on('click touchend', function (e) {
        const target = $(e.target);
        if (target.is(dropdown)) return;
        if (target.is(button) && !dropdown.is(":visible")) {
            e.preventDefault();

            dropdown.fadeIn(250);
            popper.update();
        } else {
            dropdown.fadeOut(250);
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
    $('#roll_dice').toggle(getContext().onlineStatus !== 'no_connection');
}

jQuery(function () {
    addDiceScript();
    addDiceRollButton();
    moduleWorker();
    setInterval(moduleWorker, UPDATE_INTERVAL);
    registerSlashCommand('roll', (_, value) => doDiceRoll(value), ['r'], "<span class='monospace'>(dice formula)</span> – roll the dice. For example, /roll 2d6", false, true);
});
