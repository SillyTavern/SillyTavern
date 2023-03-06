
const extensions_urlKey = 'extensions_url';
const extensions_autoConnectKey = 'extensions_autoconnect';
let extensions = [];

(function () {
    const settings_html = `
    <div class="extensions_block">
        <hr>
        <h3>Extensions</h3>
        <input id="extensions_url" type="text" class="text_pole" />
        <div class="extensions_url_block">
            <input id="extensions_connect" class="menu_button" type="submit" value="Connect" />
            <span class="expander"></span>
            <input id="extensions_autoconnect" type="checkbox"/><h4>Auto-connect</h4>
        </div>
        <div id="extensions_status">Not connected</div>
        <div id="extensions_settings">
            <h4>Extension settings</h4>
        </div>
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
    
    #extensions_loaded {
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
        width: 90%
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
    
    .expander {
        flex-grow: 1;
    }
    </style>
    `;

    const defaultUrl = "http://localhost:5100";
    let connectedToApi = false;

    async function connectClickHandler() {
        const baseUrl = $("#extensions_url").val();
        localStorage.setItem(extensions_urlKey, baseUrl);
        await connectToApi(baseUrl);
    }

    function autoConnectInputHandler() {
        const value = $(this).prop('checked');
        localStorage.setItem(extensions_autoConnectKey, value.toString());

        if (value && !connectedToApi) {
            $("#extensions_connect").trigger('click');
        }
    }

    async function connectToApi(baseUrl) {
        const url = new URL(baseUrl);
        url.pathname = '/api/extensions';

        try {
            const getExtensionsResult = await fetch(url, { method: 'GET', headers: { 'Bypass-Tunnel-Reminder': 'bypass' } });

            if (getExtensionsResult.ok) {
                const data = await getExtensionsResult.json();
                extensions = data.extensions;
                applyExtensions(baseUrl);
            }

            updateStatus(getExtensionsResult.ok);
        }
        catch {
            updateStatus(false);
        }
    }

    function updateStatus(success) {
        connectedToApi = success;
        const _text = success ? 'Connected to API' : 'Could not connect to API';
        const _class = success ? 'success' : 'failure';
        $('#extensions_status').text(_text);
        $('#extensions_status').attr('class', _class);

        if (success && extensions.length) {
            $('#extensions_loaded').show(200);
            $('#extensions_settings').show(200);
            $('#extensions_list').empty();

            for (let extension of extensions) {
                $('#extensions_list').append(`<li id="${extension.name}">${extension.metadata.display_name}</li>`);
            }
        }
        else {
            $('#extensions_loaded').hide(200);
            $('#extensions_settings').hide(200);
            $('#extensions_list').empty();
        }
    }

    function applyExtensions(baseUrl) {
        const url = new URL(baseUrl);

        if (!Array.isArray(extensions) || extensions.length === 0) {
            return;
        }

        for (let extension of extensions) {
            addExtensionStyle(extension);
            addExtensionScript(extension);
        }

        async function addExtensionStyle(extension) {
            if (extension.metadata.css) {
                try {
                    url.pathname = `/api/style/${extension.name}`;
                    const link = url.toString();

                    const result = await fetch(link, { method: 'GET', headers: { 'Bypass-Tunnel-Reminder': 'bypass' } });
                    const text = await result.text();

                    if ($(`style[id="${link}"]`).length === 0) {
                        const style = document.createElement('style');
                        style.id = link;
                        style.innerHTML = text;
                        $('head').append(style);
                    }
                }
                catch (error) {
                    console.log(error);
                }
            }
        }

        async function addExtensionScript(extension) {
            if (extension.metadata.js) {
                try {
                    url.pathname = `/api/script/${extension.name}`;
                    const link = url.toString();

                    const result = await fetch(link, { method: 'GET', headers: { 'Bypass-Tunnel-Reminder': 'bypass' } });
                    const text = await result.text();

                    if ($(`script[id="${link}"]`).length === 0) {
                        const script = document.createElement('script');
                        script.id = link;
                        script.type = 'module';
                        script.innerHTML = text;
                        $('body').append(script);
                    }
                }
                catch (error) {
                    console.log(error);
                }
            }
        }
    }

    $(document).ready(async function () {
        const url = localStorage.getItem(extensions_urlKey) ?? defaultUrl;
        const autoConnect = localStorage.getItem(extensions_autoConnectKey) == 'true';
        $('#rm_api_block').append(settings_html);
        $('head').append(settings_style);
        $("#extensions_url").val(url);
        $("#extensions_connect").on('click', connectClickHandler);
        $("#extensions_autoconnect").on('input', autoConnectInputHandler);
        $("#extensions_autoconnect").prop('checked', autoConnect).trigger('input');
    });
})();