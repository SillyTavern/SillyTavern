const ELEMENT_ID = 'loader';

export function showLoader() {
    const container = $('<div></div>').attr('id', ELEMENT_ID);
    const loader = $('<div></div>').attr('id', 'load-spinner').addClass('fa-solid fa-gear fa-spin fa-3x')
    container.append(loader);
    $('body').append(container);

}

export function hideLoader() {
    //Sets up a 2-step animation. Spinner blurs/fades out, and then the loader shadow does the same.
    $(`#load-spinner`).on("transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd", function () {
        //console.log('FADING BLUR SCREEN')
        $(`#${ELEMENT_ID}`)
            .animate({ opacity: 0 }, 300, function () {
                //console.log('REMOVING LOADER')
                $(`#${ELEMENT_ID}`).remove()
            })
    })

    //console.log('BLURRING SPINNER')
    $(`#load-spinner`)
        .css({
            'filter': 'blur(15px)',
            'opacity': '0',
        })
}