import { branchChat } from './bookmarks.js';
import { SWIPE_DIRECTION, SWIPE_SOURCE } from './constants.js';
import { t } from './i18n.js';
import { callGenericPopup, Popup, POPUP_RESULT, POPUP_TYPE } from './popup.js';
import { power_user } from './power-user.js';
import { getTokenCountAsync } from './tokenizers.js';
import { clamp, timestampToMoment } from './utils.js';
import { chat, deleteSwipe, ensureSwipes, isMessageSwipeable, isSwipingAllowed, swipe, syncMesToSwipe } from '/script.js';

/**
 * Returns whether a swipe picker can be opened for the message.
 * Unlike message swiping, this supports historical AI messages for inspection and branching.
 * @param {number} messageId
 * @returns {boolean}
 */
export function canOpenSwipePickerForMessage(messageId) {
    const message = chat[messageId];

    if (!message) {
        return false;
    }

    if (ensureSwipes(message)) {
        syncMesToSwipe(messageId);
    }

    return Boolean(
        message?.swipes?.length > 1 &&
        !message?.is_user &&
        !(message?.extra?.isSmallSys) &&
        !(message?.extra?.swipeable === false),
    );
}

/**
 * Returns whether the picker can actively jump to a different swipe.
 * Historical AI messages can open the picker, but only the currently swipeable message may jump.
 * @param {number} messageId
 * @returns {boolean}
 */
export function canJumpToSwipeForMessage(messageId) {
    const message = chat[messageId];
    return canOpenSwipePickerForMessage(messageId) && isSwipingAllowed() && isMessageSwipeable(messageId, message);
}

/**
 * Opens a popup for viewing or jumping to a specific swipe on a message.
 * @param {number} messageId
 * @returns {Promise<void>}
 */
async function openSwipePicker(messageId) {
    const message = chat[messageId];

    if (!canOpenSwipePickerForMessage(messageId)) {
        toastr.info(t`This message has no alternate swipes yet.`, t`Jump to Swipe`);
        return;
    }

    const canJumpToSwipe = canJumpToSwipeForMessage(messageId);
    let selectedSwipeId = clamp(Number(message.swipe_id ?? 0), 0, message.swipes.length - 1);
    const swipeIdInputId = `swipe_picker_id_${messageId}`;
    const wrapper = document.createElement('div');
    wrapper.classList.add('flex-container', 'flexFlowColumn', 'flexNoGap', 'wide100p', 'flex1', 'overflowHidden');

    const header = document.createElement('div');
    header.classList.add('swipe_picker_header', 'flex-container', 'alignItemsCenter', 'justifySpaceBetween', 'gap10px');

    const description = document.createElement('h3');
    description.classList.add('margin0', 'justifyLeft');
    description.textContent = t`Swipe Selection`;
    header.appendChild(description);
    wrapper.appendChild(header);

    const listContainer = document.createElement('div');
    listContainer.classList.add('swipe_picker_div', 'flex1', 'marginTop10');
    wrapper.appendChild(listContainer);

    /** @type {Popup} */
    let popup;
    /** @type {HTMLInputElement} */
    let swipeIdInput;
    /** @type {number|null} */
    let branchActionSwipeId = null;

    function syncSwipeIdInput() {
        if (swipeIdInput) {
            swipeIdInput.value = String(selectedSwipeId + 1);
        }
    }

    function setSelectedSwipe(nextSwipeId) {
        selectedSwipeId = clamp(Number(nextSwipeId), 0, message.swipes.length - 1);
        listContainer.querySelectorAll('.swipe_picker_block').forEach((element) => {
            const isSelected = Number(element.getAttribute('data-swipe-id')) === selectedSwipeId;
            if (isSelected) {
                element.setAttribute('highlight', 'true');
            } else {
                element.removeAttribute('highlight');
            }
        });
        syncSwipeIdInput();
    }

    function scrollToSelectedSwipe() {
        const swipeBlock = listContainer.querySelector(`.swipe_picker_block[data-swipe-id="${selectedSwipeId}"]`);
        if (swipeBlock instanceof HTMLElement) {
            const scrollParent = swipeBlock.closest('.swipe_picker_div');
            if (scrollParent instanceof HTMLElement) {
                const blockRect = swipeBlock.getBoundingClientRect();
                const parentRect = scrollParent.getBoundingClientRect();
                if (blockRect.top < parentRect.top) {
                    scrollParent.scrollTop -= (parentRect.top - blockRect.top) + 5;
                } else if (blockRect.bottom > parentRect.bottom) {
                    scrollParent.scrollTop += (blockRect.bottom - parentRect.bottom) + 5;
                }
            }
        }
    }

    function canDeleteSwipeFromPicker(swipeId) {
        if ((message?.swipes?.length ?? 0) <= 1) {
            return false;
        }

        const currentSwipeId = clamp(Number(message.swipe_id ?? 0), 0, message.swipes.length - 1);
        return canJumpToSwipe || swipeId !== currentSwipeId;
    }

    async function renderSwipeList() {
        const swipeBlocks = await Promise.all(message.swipes.map(async (swipe, index) => {
            const swipeText = String(swipe ?? '');
            const template = $('#past_chat_template .select_chat_block_wrapper').clone();
            const block = template.find('.select_chat_block');
            block.removeClass('select_chat_block').addClass('swipe_picker_block');
            const branchButton = template.find('.exportRawChatButton');
            const deleteButton = template.find('.PastChat_cross');
            const swipeInfo = Array.isArray(message.swipe_info) ? message.swipe_info[index] : null;
            const sendDate = swipeInfo?.send_date ? timestampToMoment(swipeInfo.send_date).format('lll') : '';
            const previewText = swipeText.replace(/\s+/g, ' ').trim();
            const tokenCount = swipeInfo?.extra?.token_count ?? await getTokenCountAsync(swipeText, 0);
            const canDeleteSwipe = canDeleteSwipeFromPicker(index);
            const swipeDetails = [];

            if (previewText) {
                swipeDetails.push(`${previewText.length} ${t`chars`}`);
            }

            if (tokenCount) {
                swipeDetails.push(`${tokenCount}t`);
            }

            block.attr({
                file_name: `swipe-${index + 1}`,
                'data-swipe-id': index,
            });

            template.find('.renameChatButton, .exportChatButton').remove();
            branchButton
                .removeAttr('data-format')
                .attr({
                    title: t`Create Branch`,
                    'data-i18n': '[title]Create Branch',
                })
                .removeClass('exportRawChatButton fa-solid fa-file-export')
                .addClass('swipe_picker_branch mes_button fa-regular fa-code-branch')
                .on('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedSwipe(index);
                    branchActionSwipeId = index;
                    await popup.completeCancelled();
                });
            deleteButton
                .removeAttr('file_name')
                .attr('aria-disabled', String(!canDeleteSwipe))
                .removeClass('fa-skull')
                .addClass('swipe_picker_delete fa-trash-can')
                .toggleClass('hoverglow', canDeleteSwipe)
                .toggleClass('disabled', !canDeleteSwipe)
                .each(function () {
                    if (canDeleteSwipe) {
                        $(this)
                            .attr({
                                title: t`Delete Swipe`,
                                'data-i18n': '[title]Delete Swipe',
                            });
                    } else {
                        $(this)
                            .removeAttr('title')
                            .removeAttr('data-i18n');
                    }
                })
                .off('click')
                .on('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    if (!canDeleteSwipe) {
                        return;
                    }

                    const nextSelectedSwipeId = index < selectedSwipeId
                        ? selectedSwipeId - 1
                        : index > selectedSwipeId
                            ? selectedSwipeId
                            : Math.min(selectedSwipeId, message.swipes.length - 2);

                    if (power_user.confirm_message_delete) {
                        const result = await callGenericPopup(t`Are you sure you want to delete swipe #${index + 1}?`, POPUP_TYPE.CONFIRM, null, {
                            okButton: t`Delete Swipe`,
                            cancelButton: t`Cancel`,
                        });

                        if (result !== POPUP_RESULT.AFFIRMATIVE) {
                            return;
                        }
                    }

                    const newSwipeId = await deleteSwipe(index, messageId);
                    if (!Number.isInteger(newSwipeId)) {
                        return;
                    }

                    selectedSwipeId = clamp(nextSelectedSwipeId, 0, message.swipes.length - 1);

                    if (swipeIdInput instanceof HTMLInputElement) {
                        swipeIdInput.max = String(message.swipes.length);
                    }

                    await renderSwipeList();
                });
            template.find('.select_chat_block_filename').text(`#${index + 1}${index === Number(message.swipe_id ?? 0) ? ` ${t`[Current]`}` : ''}`);
            template.find('.chat_messages_date').text(sendDate);
            template.find('.chat_file_size').text(swipeDetails.length ? `(${swipeDetails[0]}${swipeDetails.length > 1 ? ',' : ')'}` : '');
            template.find('.chat_messages_num').text(swipeDetails.length > 1 ? `${swipeDetails.slice(1).join(', ')})` : '');
            template.find('.select_chat_block_mes').text(previewText || t`(empty swipe)`);

            block.on('click', () => setSelectedSwipe(index));
            block.on('dblclick', async () => {
                if (!canJumpToSwipe) {
                    return;
                }

                setSelectedSwipe(index);
                await popup.completeAffirmative();
            });

            return template[0];
        }));

        listContainer.replaceChildren(...swipeBlocks);
        setSelectedSwipe(selectedSwipeId);

        if (swipeBlocks.length === 0) {
            const empty = document.createElement('div');
            empty.classList.add('textAlignCenter', 'opacity50p', 'padding10');
            empty.textContent = t`No swipes available.`;
            listContainer.replaceChildren(empty);
        }
    }

    popup = new Popup(wrapper, POPUP_TYPE.CONFIRM, '', {
        okButton: canJumpToSwipe ? t`Go` : false,
        cancelButton: false,
        customInputs: [{
            id: swipeIdInputId,
            label: t`Swipe ID`,
            type: 'text',
            defaultState: String(selectedSwipeId + 1),
            tooltip: `1-${message.swipes.length}`,
        }],
        wider: true,
        allowVerticalScrolling: true,
        onOpen: function () {
            scrollToSelectedSwipe();
            if (swipeIdInput instanceof HTMLInputElement) {
                swipeIdInput.focus();
                swipeIdInput.select();
            }
        },
        onClosing: function (popup) {
            if (popup.result !== POPUP_RESULT.AFFIRMATIVE) {
                return true;
            }

            const swipeIdInput = popup.dlg.querySelector(`#${swipeIdInputId}`);
            const targetSwipeNumber = Number.parseInt(String(swipeIdInput instanceof HTMLInputElement ? swipeIdInput.value : '').trim(), 10);

            if (!Number.isInteger(targetSwipeNumber) || targetSwipeNumber < 1 || targetSwipeNumber > message.swipes.length) {
                toastr.warning(t`Enter a swipe ID between 1 and ${message.swipes.length}.`, t`Jump to Swipe`);
                if (swipeIdInput instanceof HTMLInputElement) {
                    swipeIdInput.focus();
                    swipeIdInput.select();
                }
                return false;
            }

            setSelectedSwipe(targetSwipeNumber - 1);
            return true;
        },
    });

    popup.dlg.classList.add('swipe_picker_popup');
    popup.closeButton.style.display = 'block';
    popup.closeButton.classList.add('opacity50p', 'hoverglow', 'fontsize120p');
    popup.closeButton.style.position = 'static';
    popup.closeButton.style.top = 'auto';
    popup.closeButton.style.right = 'auto';
    popup.closeButton.style.width = 'auto';
    popup.closeButton.style.height = 'auto';
    popup.closeButton.style.padding = '0';
    popup.closeButton.style.filter = 'none';
    header.appendChild(popup.closeButton);

    swipeIdInput = popup.dlg.querySelector(`#${swipeIdInputId}`);
    const swipeIdLabel = popup.dlg.querySelector(`label[for="${swipeIdInputId}"]`);

    if (swipeIdLabel instanceof HTMLLabelElement) {
        swipeIdLabel.classList.add('flex-container', 'alignItemsCenter', 'justifyCenter', 'gap10px', 'margin0');
        popup.buttonControls.insertBefore(swipeIdLabel, canJumpToSwipe ? popup.okButton : popup.buttonControls.firstChild);
        popup.inputControls.style.display = 'none';
    }

    if (swipeIdInput instanceof HTMLInputElement) {
        swipeIdInput.type = 'number';
        swipeIdInput.min = '1';
        swipeIdInput.max = String(message.swipes.length);
        swipeIdInput.step = '1';
        swipeIdInput.inputMode = 'numeric';
        swipeIdInput.classList.add('flex1', 'width100px', 'textAlignCenter');
        swipeIdInput.setAttribute('autofocus', '');
        syncSwipeIdInput();

        swipeIdInput.addEventListener('input', function () {
            const nextSwipeId = Number.parseInt(this.value, 10);
            if (!Number.isInteger(nextSwipeId) || nextSwipeId < 1 || nextSwipeId > message.swipes.length) {
                return;
            }

            setSelectedSwipe(nextSwipeId - 1);
            scrollToSelectedSwipe();
        });

        swipeIdInput.addEventListener('blur', function () {
            syncSwipeIdInput();
        });
    }

    await renderSwipeList();

    const popupResult = await popup.show();

    if (branchActionSwipeId !== null) {
        await branchChat(messageId, { swipeId: branchActionSwipeId });
        return;
    }

    if (popupResult !== POPUP_RESULT.AFFIRMATIVE) {
        return;
    }

    if (!canJumpToSwipe) {
        return;
    }

    const targetSwipeId = clamp(selectedSwipeId, 0, message.swipes.length - 1);
    const currentSwipeId = clamp(Number(message.swipe_id ?? 0), 0, message.swipes.length - 1);

    if (targetSwipeId === currentSwipeId) {
        toastr.info(t`Already showing swipe #${targetSwipeId + 1}.`, t`Jump to Swipe`);
        return;
    }

    const direction = targetSwipeId > currentSwipeId ? SWIPE_DIRECTION.RIGHT : SWIPE_DIRECTION.LEFT;
    await swipe(null, direction, { source: SWIPE_SOURCE.SWIPE_PICKER, forceMesId: messageId, forceSwipeId: targetSwipeId });
}

export function initSwipePicker() {
    $(document).on('click', '.swipes-counter.swipe-picker-enabled', async function (e) {
        e.preventDefault();
        e.stopPropagation();

        const mesId = Number($(this).closest('.mes').attr('mesid'));
        await openSwipePicker(mesId);
    });
    $(document).on('keydown', '.swipes-counter.swipe-picker-enabled', async function (e) {
        if (e.key !== ' ') {
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        const mesId = Number($(this).closest('.mes').attr('mesid'));
        await openSwipePicker(mesId);
    });
    $(document).on('click', '.mes_swipe_picker', async function (e) {
        e.preventDefault();
        e.stopPropagation();

        const mesId = Number($(this).closest('.mes').attr('mesid'));
        await openSwipePicker(mesId);
    });
}
