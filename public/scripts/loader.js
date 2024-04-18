const ELEMENT_ID = 'loader';

export function showLoader() {
    const container = $('<div></div>').attr('id', ELEMENT_ID);
    const loader = $('<div></div>').attr('id', 'load-spinner').addClass('fa-solid fa-gear fa-spin fa-3x');
    container.append(loader);
    $('body').append(container);
}

export async function hideLoader() {
    //Sets up a 2-step animation. Spinner blurs/fades out, and then the loader shadow does the same.
    $('#load-spinner').on('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd', function () {
        $(`#${ELEMENT_ID}`)
            //only fade out the spinner and replace with login screen
            .animate({ opacity: 0 }, 300, function () {
                $(`#${ELEMENT_ID}`).remove();
            });
    });

    $('#load-spinner')
        .css({
            'filter': 'blur(15px)',
            'opacity': '0',
        });
}
