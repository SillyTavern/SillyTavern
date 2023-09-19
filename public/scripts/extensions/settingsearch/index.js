export { MODULE_NAME };

const MODULE_NAME = 'settingsSearch';
async function addSettingsSearchHTML() {

    const html = `
    <div class="wide100p">
        <div class="justifyLeft">
            <textarea id="settingsSearch" class="wide100p textarea_compact margin-bot-10px" rows="1" placeholder="Search Settings"></textarea>
        </div>
    </div>`

    $("#user-settings-block").prepend(html);
}

async function searchSettings() {
    removeHighlighting(); // Remove previous highlights
    let searchString = $("#settingsSearch").val();
    let searchableText = $("#user-settings-block-content"); // Get the HTML block
    if (searchString.trim() !== "") {
        highlightMatchingElements(searchableText[0], searchString); // Highlight matching elements
    }
}
function isParentHeader(element) {
    return $(element).closest('h4, h3').length > 0;
}
function highlightMatchingElements(element, searchString) {
    $(element).contents().each(function () {
        const isTextNode = this.nodeType === Node.TEXT_NODE;
        const isElementNode = this.nodeType === Node.ELEMENT_NODE;

        if (isTextNode && this.nodeValue.trim() !== "" && !isParentHeader(this)) {
            const parentElement = $(this).parent();
            const elementText = this.nodeValue;

            if (elementText.toLowerCase().includes(searchString.toLowerCase())) {
                parentElement.addClass('highlighted'); // Add CSS class to highlight matched elements
            }
        } else if (isElementNode && !$(this).is("h4")) {
            highlightMatchingElements(this, searchString);
        }
    });
}
function removeHighlighting() {
    $(".highlighted").removeClass("highlighted");  // Remove CSS class from previously highlighted elements
}
jQuery(() => {
    addSettingsSearchHTML();
    $('#settingsSearch').on('input change', searchSettings);
});







