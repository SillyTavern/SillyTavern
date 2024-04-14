/*!
*	@name: jquery-izoomify
*   @version: 1.0
*	@author: Carl Lomer Abia
*/

(function ($) {
    var defaults = {
        callback: false,
        target: false,
        duration: 120,
        magnify: 1.2,
        touch: true,
        url: false
    };

    var _izoomify = function (target, duration, magnify, url) {
        var xPos,
            yPos,
            $elTarget = $(target),
            $imgTarget = $elTarget.find('img:first'),
            imgOrigSrc = $imgTarget.attr('src'),
            imgSwapSrc,
            defaultOrigin = 'center top ' + 0 + 'px',
            resultOrigin,
            dUrl = 'data-izoomify-url',
            dMagnify = 'data-izoomify-magnify',
            dDuration = 'data-izoomify-duration',
            eClass = 'izoomify-in',
            eMagnify,
            eDuration;

        function imageSource(imgSource) {
            var _img = new Image();
            _img.src = imgSource;
            return _img.src;
        }

        function getImageAttribute($img, dataAttribute, defaultAttribute) {
            if ($img.attr(dataAttribute)) {
                return $img.attr(dataAttribute);
            }

            return defaultAttribute;
        }

        function getImageSource($img, dataImageSource, defaultImageSource) {
            if ($img.attr(dataImageSource)) {
                return imageSource($img.attr(dataImageSource));
            }

            return defaultImageSource ? imageSource(defaultImageSource) : false;
        }

        function getTouches(e) {
            return e.touches || e.originalEvent.touches;
        }

        imgSwapSrc = getImageSource($imgTarget, dUrl, url);

        eMagnify = getImageAttribute($imgTarget, dMagnify, magnify);

        eDuration = getImageAttribute($imgTarget, dDuration, duration);

        $elTarget
            .addClass(eClass)
            .css({
                'position': 'relative',
                'overflow': 'hidden'
            });

        $imgTarget.css({
            '-webkit-transition-property': '-webkit-transform',
            'transition-property': '-webkit-transform',
            '-o-transition-property': 'transform',
            'transition-property': 'transform',
            'transition-property': 'transform, -webkit-transform',
            '-webkit-transition-timing-function': 'ease',
            '-o-transition-timing-function': 'ease',
            'transition-timing-function': 'ease',
            '-webkit-transition-duration': eDuration + 'ms',
            '-o-transition-duration': eDuration + 'ms',
            'transition-duration': eDuration + 'ms',
            '-webkit-transform': 'scale(1)',
            '-ms-transform': 'scale(1)',
            'transform': 'scale(1)',
            '-webkit-transform-origin': defaultOrigin,
            '-ms-transform-origin': defaultOrigin,
            'transform-origin': defaultOrigin
        });

        return {
            moveStart: function (e, hasTouch) {
                var o = $(target).offset();

                if (hasTouch) {
                    e.preventDefault();
                    xPos = getTouches(e)[0].clientX - o.left;
                    yPos = getTouches(e)[0].clientY - o.top;
                } else {
                    xPos = e.pageX - o.left;
                    yPos = e.pageY - o.top;
                }

                resultOrigin = xPos + 'px ' + yPos + 'px ' + 0 + 'px';

                $imgTarget
                    .css({
                        '-webkit-transform': 'scale(' + eMagnify + ')',
                        '-ms-transform': 'scale(' + eMagnify + ')',
                        'transform': 'scale(' + eMagnify + ')',
                        '-webkit-transform-origin': resultOrigin,
                        '-ms-transform-origin': resultOrigin,
                        'transform-origin': resultOrigin
                    })
                    .attr('src', imgSwapSrc || imgOrigSrc);
            },
            moveEnd: function () {
                this.reset();
            },
            reset: function () {
                resultOrigin = defaultOrigin;

                $imgTarget
                    .css({
                        '-webkit-transform': 'scale(1)',
                        '-ms-transform': 'scale(1)',
                        'transform': 'scale(1)',
                        '-webkit-transform-origin': resultOrigin,
                        '-ms-transform-origin': resultOrigin,
                        'transform-origin': resultOrigin
                    })
                    .attr('src', imgOrigSrc);
            }
        }
    };

    $.fn.izoomify = function (options) {
        return this.each(function () {
            var settings = $.extend({}, defaults, options || {}),
                $target = settings.target && $(settings.target)[0] || this,
                src = this,
                $src = $(src),
                mouseStartEvents = 'mouseover.izoomify mousemove.izoomify',
                mouseEndEvents = 'mouseleave.izoomify mouseout.izoomify',
                touchStartEvents = 'touchstart.izoomify touchmove.izoomify',
                touchEndEvents = 'touchend.izoomify';

            var izoomify = _izoomify($target, settings.duration, settings.magnify, settings.url);

            function startEvent(e, hasTouch) {
                izoomify.moveStart(e, hasTouch);
            }

            function endEvent($src) {
                izoomify.moveEnd();

                if ($src) {
                    $src
                        .off(touchStartEvents)
                        .off(touchEndEvents);
                }
            }

            function resetImage() {
                izoomify.reset();
            }

            $src.one('izoomify.destroy', function () {

                $src.removeClass('izoomify-in');

                resetImage();

                $src
                    .off(mouseStartEvents)
                    .off(mouseEndEvents);

                if (settings.touch) {
                    $src
                        .off(touchStartEvents)
                        .off(touchStartEvents);
                }

                $target.style.position = '';
                $target.style.overflow = '';

            }.bind(this));

            $src
                .on(mouseStartEvents, function (e) {
                    startEvent(e);
                })
                .on(mouseEndEvents, function () {
                    endEvent();
                });

            if (settings.touch) {
                $src
                    .on(touchStartEvents, function (e) {
                        e.preventDefault();
                        startEvent(e, true);
                    })
                    .on(touchEndEvents, function () {
                        endEvent();
                    });
            }

            if ($.isFunction(settings.callback)) {
                settings.callback.call($src);
            }
        });
    };

    $.fn.izoomify.defaults = defaults;
}(window.jQuery));