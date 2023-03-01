const settings_html = `
<hr>
<div id="extensions_block">
    <h3>Extensions</h3>
    <input id="extensions_url" type="text" class="text_pole" />
    <input id="extensions_connect" type="submit" value="Connect" />
</div>
`
const urlKey = 'extensions_url';
const defaultUrl = "http://localhost:5100";

$(document).ready(async function() {
    const url = localStorage.getItem(urlKey) ?? defaultUrl;
    $('#rm_api_block').append(settings_html);
    $("#extensions_url").val(url);
    $("#extensions_connect").on('click', function() {
        const url = $("#extensions_url").val();
        localStorage.setItem(urlKey, url);
        alert('click!');
    });
});