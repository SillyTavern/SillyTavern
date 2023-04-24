async function loadNotes(file) {
    const toc = [];
    let hash = location.hash;
    let converter = new showdown.Converter({ tables: true, extensions: [showdownToc({ toc })] } );
    let text = await (await fetch(file)).text();
    let content = document.getElementById('content');
    content.innerHTML = converter.makeHtml(text);

    if (hash) {
        const link = document.createElement('a');
        link.href = hash;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

window.loadNotes = loadNotes;