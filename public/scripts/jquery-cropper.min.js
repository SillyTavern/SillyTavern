/*!
 * jQuery Cropper v1.0.1
 * https://fengyuanchen.github.io/jquery-cropper
 *
 * Copyright 2018-present Chen Fengyuan
 * Released under the MIT license
 *
 * Date: 2019-10-19T08:48:33.062Z
 */
!function(e,r){"object"==typeof exports&&"undefined"!=typeof module?r(require("jquery"),require("cropperjs")):"function"==typeof define&&define.amd?define(["jquery","cropperjs"],r):r((e=e||self).jQuery,e.Cropper)}(this,function(c,s){"use strict";if(c=c&&c.hasOwnProperty("default")?c.default:c,s=s&&s.hasOwnProperty("default")?s.default:s,c&&c.fn&&s){var e=c.fn.cropper,d="cropper";c.fn.cropper=function(p){for(var e=arguments.length,a=new Array(1<e?e-1:0),r=1;r<e;r++)a[r-1]=arguments[r];var u;return this.each(function(e,r){var t=c(r),n="destroy"===p,o=t.data(d);if(!o){if(n)return;var f=c.extend({},t.data(),c.isPlainObject(p)&&p);o=new s(r,f),t.data(d,o)}if("string"==typeof p){var i=o[p];c.isFunction(i)&&((u=i.apply(o,a))===o&&(u=void 0),n&&t.removeData(d))}}),void 0!==u?u:this},c.fn.cropper.Constructor=s,c.fn.cropper.setDefaults=s.setDefaults,c.fn.cropper.noConflict=function(){return c.fn.cropper=e,this}}});