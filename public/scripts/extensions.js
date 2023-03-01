
const settings_html = `
<div class="extensions_block">
    <hr>
    <h3>Extensions</h3>
    <input id="extensions_url" type="text" class="text_pole" />
    <div class="extensions_url_block">
        <input id="extensions_connect" type="submit" value="Connect" />
        <input id="extensions_autoconnect" type="checkbox"/><h4>Auto-connect</h4>
    </div>
    <div id="extensions_status">Not connected</div>
    <div id="extensions_loaded">
        <h4>Active extensions</h4>
        <ul id="extensions_list">
        </ul>
    </div>
</div>
`;

const settings_style = `
<style>
#extensions_url {
    display: block;
}

#extensions_active {
    display: none;
}

.extensions_block h3 {
    margin-bottom: 10px;
}

#extensions_status {
    margin: 10px;
    opacity: 0.85;
    font-weight: 700;
}

.extensions_block input[type="submit"]:hover{
    background-color: green;
}

.extensions_block input[type="submit"] {
    cursor: pointer;
    color: #fff;
    opacity: 0.7;
    padding: 10px;
    font-size: 1rem;
    height: 2.5rem;
    transition: 0.3s;
}

.extensions_block input[type="checkbox"] {
    margin-left: 10px;
}

.extensions_url_block {
    display: flex;
    align-items: center;
    margin: 10px;
}

.extensions_url_block- h4 {
    display: inline;
}

.extensions_block {
    clear: both;
    padding: 0.05px; /* clear fix */
}

.success {
    color: green;
}

.failure {
    color: red;
}
</style>
`;

const urlKey = 'extensions_url';
const autoConnectKey = 'extensions_autoconnect';
const defaultUrl = "http://localhost:5100";
let connectedToApi = false;
let extensions = [];

async function connectClickHandler() {
    const baseUrl = $("#extensions_url").val();
    localStorage.setItem(urlKey, baseUrl);
    await connectToApi(baseUrl);
}

function autoConnectInputHandler() {
    const value = $(this).prop('checked');
    localStorage.setItem(autoConnectKey, value.toString());

    if (value && !connectedToApi) {
        $("#extensions_connect").trigger('click');
    }
}

async function connectToApi(baseUrl) {
    const url = new URL(baseUrl);
    url.pathname = '/api/extensions';
    const getExtensionsResult = await fetch(url, { method: 'GET' });

    if (getExtensionsResult.ok) {
        const data = await getExtensionsResult.json();
        extensions = data.extensions;
        applyExtensions(baseUrl);
    }
    
    updateStatus(getExtensionsResult.ok);
}

function updateStatus(success) {
    connectedToApi = success;
    const _text = success ? 'Connected to API' : 'Could not connect to API';
    const _class = success ? 'success' : 'failed';
    $('#extensions_status').text(_text);
    $('#extensions_status').attr('class', _class);

    if (success && extensions.length) {
        $('#extensions_loaded').show(200);
        $('#extensions_list').empty();

        for (let extension of extensions) {
            $('#extensions_list').append(`<li id="${extension.name}">${extension.metadata.display_name}</li>`);
        }
    }
}

function applyExtensions(baseUrl) {
    const url = new URL(baseUrl);

    if (!Array.isArray(extensions) || extensions.length === 0) {
        return;
    }

    for (let extension of extensions) {
        if (extension.metadata.js) {
            url.pathname = `/api/script/${extension.name}`;
            const src = url.toString();

            if ($(`script[src="${src}"]`).length === 0) {
                const script = document.createElement('script');
                script.type = 'module';
                script.src = src;
                $('body').append(script);
            }

        }

        if (extension.metadata.css) {
            url.pathname = `/api/style/${extension.name}`;
            const href = url.toString();

            if ($(`link[href="${href}"]`).length === 0) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.type = 'text/css';
                link.href = href;
                $('head').append(link);
            }
        }
    }
}

$(document).ready(async function () {
    const url = localStorage.getItem(urlKey) ?? defaultUrl;
    const autoConnect = Boolean(localStorage.getItem(autoConnectKey)) ?? false;
    $('#rm_api_block').append(settings_html);
    $('head').append(settings_style);
    $("#extensions_url").val(url);
    $("#extensions_connect").on('click', connectClickHandler);
    $("#extensions_autoconnect").on('input', autoConnectInputHandler);
    $("#extensions_autoconnect").prop('checked', autoConnect).trigger('input');
});