(function ($) {
    const AttachBody = $.fn.select2.amd.require('select2/dropdown/attachBody');
    const positionDropdown = AttachBody.prototype._positionDropdown;

    AttachBody.prototype._positionDropdown = function () {
        const $results = this.$dropdown.find('.select2-results__options').first();
        const style = this.$dropdown[0].style;
        style.removeProperty('--select2-results-max-height');

        if ($results.length) {
            // Measure at the current width and normal height before choosing a side.
            this._resizeDropdown();
            const $window = $(window);
            const above = this.$container.offset().top - $window.scrollTop();
            const below = $window.height() - above - this.$container.outerHeight(false);
            const overhead = this.$dropdown.outerHeight(false) - $results.outerHeight(false);
            // Select2 requires strictly more space than the dropdown's height to flip.
            const height = Math.max(0, Math.max(above, below) - overhead - 1);
            style.setProperty('--select2-results-max-height', `${height}px`);
        }

        return positionDropdown.apply(this, arguments);
    };
})(window.jQuery);
