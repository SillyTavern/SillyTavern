import { POPUP_RESULT, POPUP_TYPE, Popup } from './popup.js';

const ELEMENT_ID = 'loader';

/** @type {Popup} */
let loaderPopup;

export function showLoader() {
    // Two loaders don't make sense
    if (loaderPopup) loaderPopup.complete(POPUP_RESULT.CANCELLED);

    loaderPopup = new Popup(`
        <div id="loader">
            <div id="load-spinner" class="fa-solid fa-gear fa-spin fa-3x"></div>
        </div>`, POPUP_TYPE.DISPLAY, null, { transparent: true });

    // No close button, loaders are not closable
    loaderPopup.closeButton.style.display = 'none';

    loaderPopup.show();
}

export async function hideLoader() {
    if (!loaderPopup) {
        console.warn('There is no loader showing to hide');
        return;
    }

    //Sets up a 2-step animation. Spinner blurs/fades out, and then the loader shadow does the same.
    $('#load-spinner').on('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd', function () {
        $(`#${ELEMENT_ID}`)
            //only fade out the spinner and replace with login screen
            .animate({ opacity: 0 }, 300, function () {
                $(`#${ELEMENT_ID}`).remove();
                loaderPopup.complete(POPUP_RESULT.AFFIRMATIVE);
                loaderPopup = null;
            });
    });

    $('#load-spinner')
        .css({
            'filter': 'blur(15px)',
            'opacity': '0',
        });

}
