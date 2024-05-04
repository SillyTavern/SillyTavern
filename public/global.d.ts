// Global namespace modules
declare var DOMPurify;
declare var droll;
declare var Fuse;
declare var Handlebars;
declare var hljs;
declare var localforage;
declare var moment;
declare var pdfjsLib;
declare var Popper;
declare var showdown;
declare var showdownKatex;
declare var SVGInject;
declare var toastr;
declare var Readability;
declare var isProbablyReaderable;
declare var ePub;
declare var ai;

// Jquery plugins
interface JQuery {
    pagination(method: 'getCurrentPageNum'): number;
    pagination(method: string, options?: any): JQuery;
    pagination(options?: any): JQuery;
    transition(options?: any): JQuery;
    select2(options?: any): JQuery;
    sortable(options?: any): JQuery;
    autocomplete(options?: any): JQuery;
    autocomplete(method: string, options?: any): JQuery;
    slider(options?: any): JQuery;
    slider(method: string, func: string, options?: any): JQuery;
    cropper(options?: any): JQuery;
    izoomify(options?: any): JQuery;
}
