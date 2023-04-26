const TAG_COLORS = [
    '#FFB6C1', // Light Pink
    '#FFECB3', // Light Yellow
    '#FFE4B5', // Cream
    '#B2EBF2', // Powder Blue
    '#E0FFFF', // Light Sky Blue
    '#FBB4B9', // Lavender
    '#FFF9C4', // Floral White
    '#DDA0DD', // Plum
    '#DA70D6', // Orchid
    '#D2B48C', // Tan
    '#FAEBD7', // Antique White
    '#FFEFD5', // Papaya Whip
    '#CD853F', // Peru
    '#B2DFEE', // Sky Blue
    '#FFFFC2', // Parchment
    '#FDF5E6', // Old Lace
];

let tags = [
    { name: "tag1", color: "blue" }, 
    { name: "tag2", color: "green" } 
];

$(document).ready(() => {
    $("#tagInput").autocomplete({
        source: tags.map(t => t.name),
        select: function(event, ui) {
            let tagName = ui.item.value;
            let tag = tags.find(t => t.name === tagName);
            if (!tag) {
                tag = {
                    name: tagName,
                    color: TAG_COLORS[Math.floor(Math.random() * colors.length)] 
                };
                tags.push(tag);
            }
            let tagElement = $(`<span class="tag" style="background-color: ${tag.color}">${tag.name}</span>`);
            $("#tagList").append(tagElement);
            $(this).val("");
        }
    });
    
    $("#tagInput").on("input", function(event) {
        let val = $(this).val();
        if (tags.find(t => t.name === val)) return;
        $(this).autocomplete("search", val);
    });
});