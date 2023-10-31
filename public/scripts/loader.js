const ELEMENT_ID = 'loader';

export function showLoader() {
    const container = $('<div></div>').attr('id', ELEMENT_ID);
    const loader = $('<div></div>').addClass('fa-solid fa-spinner fa-spin fa-3x');
    container.append(loader);
    $('body').append(container);
}

export function hideLoader() {
    $(`#${ELEMENT_ID}`).remove();
}
