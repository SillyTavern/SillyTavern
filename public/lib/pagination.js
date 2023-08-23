/*
 * pagination.js 2.6.0
 * A jQuery plugin to provide simple yet fully customisable pagination.
 * https://github.com/superRaytin/paginationjs
 *
 * Homepage: http://pagination.js.org
 *
 * Copyright 2014-2100, superRaytin
 * Released under the MIT license.
 */

(function(global, $) {

  if (typeof $ === 'undefined') {
    throwError('Pagination requires jQuery.');
  }

  var pluginName = 'pagination';

  var pluginHookMethod = 'addHook';

  var eventPrefix = '__pagination-';

  if ($.fn.pagination) {
    throwError('plugin conflicted, the name "pagination" has been taken by another jQuery plugin.');
  }

  $.fn[pluginName] = function(options) {

    if (typeof options === 'undefined') {
      return this;
    }

    var container = $(this);

    var attributes = $.extend({}, $.fn[pluginName].defaults, options);

    var pagination = {

      initialize: function() {
        var self = this;

        // Cache data for current instance
        if (!container.data('pagination')) {
          container.data('pagination', {});
        }

        if (self.callHook('beforeInit') === false) return;

        // Pagination has been initialized, destroy it
        if (container.data('pagination').initialized) {
          $('.paginationjs', container).remove();
        }

        // Whether to disable Pagination at the initialization
        self.disabled = !!attributes.disabled;

        // Model will be passed to the callback function
        var model = self.model = {
          pageRange: attributes.pageRange,
          pageSize: attributes.pageSize
        };

        // Parse dataSource to find available paging data
        self.parseDataSource(attributes.dataSource, function(dataSource) {

          // Asynchronous mode
          self.isAsync = Helpers.isString(dataSource);
          if (Helpers.isArray(dataSource)) {
            model.totalNumber = attributes.totalNumber = dataSource.length;
          }

          // Asynchronous mode and a 'totalNumberLocator' has been specified
          self.isDynamicTotalNumber = self.isAsync && attributes.totalNumberLocator;

          var el = self.render(true);

          // Add extra className to the pagination element
            if (attributes.className) {
            el.addClass(attributes.className);
          }

          model.el = el;

          // Append / prepend pagination element to the container
          container[attributes.position === 'bottom' ? 'append' : 'prepend'](el);

          // Bind events
          self.observer();

          // Mark pagination has been initialized
          container.data('pagination').initialized = true;

          // Call hook after initialization
          self.callHook('afterInit', el);
        });
      },

      render: function(isBoot) {
        var self = this;
        var model = self.model;
        var el = model.el || $('<div class="paginationjs"></div>');
        var isForced = isBoot !== true;

        self.callHook('beforeRender', isForced);

        var currentPage = model.pageNumber || attributes.pageNumber;
        var pageRange = attributes.pageRange || 0;
        var totalPage = self.getTotalPage();

        var rangeStart = currentPage - pageRange;
        var rangeEnd = currentPage + pageRange;

        if (rangeEnd > totalPage) {
          rangeEnd = totalPage;
          rangeStart = totalPage - pageRange * 2;
          rangeStart = rangeStart < 1 ? 1 : rangeStart;
        }

        if (rangeStart <= 1) {
          rangeStart = 1;
          rangeEnd = Math.min(pageRange * 2 + 1, totalPage);
        }

        el.html(self.generateHTML({
          currentPage: currentPage,
          pageRange: pageRange,
          rangeStart: rangeStart,
          rangeEnd: rangeEnd
        }));

        // Whether to hide pagination when there is only one page
        if (attributes.hideOnlyOnePage) {
          el[totalPage <= 1 ? 'hide' : 'show']();
        }

        self.callHook('afterRender', isForced);

        return el;
      },

      getPageLinkTag: function(index) {
        var pageLink = attributes.pageLink;
        return pageLink ? `<a href="${pageLink}">${index}</a>` : `<a>${index}</a>`;
      },

      // Generate HTML for page numbers
      generatePageNumbersHTML: function(args) {
        var self = this;
        var currentPage = args.currentPage;
        var totalPage = self.getTotalPage();
        var getPageLinkTag = self.getPageLinkTag;
        var rangeStart = args.rangeStart;
        var rangeEnd = args.rangeEnd;
        var html = '';
        var i;

        var ellipsisText = attributes.ellipsisText;

        var classPrefix = attributes.classPrefix;
        var pageClassName = attributes.pageClassName || '';
        var activeClassName = attributes.activeClassName || '';
        var disableClassName = attributes.disableClassName || '';

        // Display all page numbers if page range disabled
        if (attributes.pageRange === null) {
          for (i = 1; i <= totalPage; i++) {
            if (i == currentPage) {
              html += `<li class="${classPrefix}-page J-paginationjs-page ${pageClassName} ${activeClassName}" data-num="${i}"><a>${i}</a></li>`;
            } else {
              html += `<li class="${classPrefix}-page J-paginationjs-page ${pageClassName}" data-num="${i}">${getPageLinkTag(i)}</li>`;
            }
          }
          return html;
        }

        if (rangeStart <= 3) {
          for (i = 1; i < rangeStart; i++) {
            if (i == currentPage) {
              html += `<li class="${classPrefix}-page J-paginationjs-page ${pageClassName} ${activeClassName}" data-num="${i}"><a>${i}</a></li>`;
            } else {
              html += `<li class="${classPrefix}-page J-paginationjs-page ${pageClassName}" data-num="${i}">${getPageLinkTag(i)}</li>`;
            }
          }
        } else {
          if (!attributes.hideFirstOnEllipsisShow) {
            html += `<li class="${classPrefix}-page ${classPrefix}-first J-paginationjs-page ${pageClassName}" data-num="1">${getPageLinkTag(1)}</li>`;
          }
          html += `<li class="${classPrefix}-ellipsis ${disableClassName}"><a>${ellipsisText}</a></li>`;
        }

        for (i = rangeStart; i <= rangeEnd; i++) {
          if (i == currentPage) {
            html += `<li class="${classPrefix}-page J-paginationjs-page ${pageClassName} ${activeClassName}" data-num="${i}"><a>${i}</a></li>`;
          } else {
            html += `<li class="${classPrefix}-page J-paginationjs-page ${pageClassName}" data-num="${i}">${getPageLinkTag(i)}</li>`;
          }
        }

        if (rangeEnd >= totalPage - 2) {
          for (i = rangeEnd + 1; i <= totalPage; i++) {
            html += `<li class="${classPrefix}-page J-paginationjs-page ${pageClassName}" data-num="${i}">${getPageLinkTag(i)}</li>`;
          }
        } else {
          html += `<li class="${classPrefix}-ellipsis ${disableClassName}"><a>${ellipsisText}</a></li>`;

          if (!attributes.hideLastOnEllipsisShow) {
            html += `<li class="${classPrefix}-page ${classPrefix}-last J-paginationjs-page ${pageClassName}" data-num="${totalPage}">${getPageLinkTag(totalPage)}</li>`;
          }
        }

        return html;
      },

      // Generate HTML content
      generateHTML: function(args) {
        var self = this;
        var currentPage = args.currentPage;
        var totalPage = self.getTotalPage();
        var getPageLinkTag = self.getPageLinkTag;

        var totalNumber = self.getTotalNumber();

        var pageSize = attributes.pageSize;
        var showPrevious = attributes.showPrevious;
        var showNext = attributes.showNext;
        var showPageNumbers = attributes.showPageNumbers;
        var showNavigator = attributes.showNavigator;
        var showSizeChanger = attributes.showSizeChanger;
        var sizeChangerOptions = attributes.sizeChangerOptions;
        var showGoInput = attributes.showGoInput;
        var showGoButton = attributes.showGoButton;

        var prevText = attributes.prevText;
        var nextText = attributes.nextText;
        var goButtonText = attributes.goButtonText;

        var classPrefix = attributes.classPrefix;
        var disableClassName = attributes.disableClassName || '';
        var ulClassName = attributes.ulClassName || '';
        var prevClassName = attributes.prevClassName || '';
        var nextClassName = attributes.nextClassName || '';

        var html = '';
        var sizeSelect = `<select class="J-paginationjs-size-select">`;
        var goInput = '<input type="text" class="J-paginationjs-go-pagenumber">';
        var goButton = `<input type="button" class="J-paginationjs-go-button" value="${goButtonText}">`;
        var formattedString;

        var formatSizeChanger = typeof attributes.formatSizeChanger === 'function' ? attributes.formatSizeChanger(currentPage, totalPage, totalNumber) : attributes.formatSizeChanger;
        var formatNavigator = typeof attributes.formatNavigator === 'function' ? attributes.formatNavigator(currentPage, totalPage, totalNumber) : attributes.formatNavigator;
        var formatGoInput = typeof attributes.formatGoInput === 'function' ? attributes.formatGoInput(goInput, currentPage, totalPage, totalNumber) : attributes.formatGoInput;
        var formatGoButton = typeof attributes.formatGoButton === 'function' ? attributes.formatGoButton(goButton, currentPage, totalPage, totalNumber) : attributes.formatGoButton;

        var autoHidePrevious = typeof attributes.autoHidePrevious === 'function' ? attributes.autoHidePrevious() : attributes.autoHidePrevious;
        var autoHideNext = typeof attributes.autoHideNext === 'function' ? attributes.autoHideNext() : attributes.autoHideNext;

        var header = typeof attributes.header === 'function' ? attributes.header(currentPage, totalPage, totalNumber) : attributes.header;
        var footer = typeof attributes.footer === 'function' ? attributes.footer(currentPage, totalPage, totalNumber) : attributes.footer;

        // Prepend extra contents to the pagination buttons
        if (header) {
          formattedString = self.replaceVariables(header, {
            currentPage: currentPage,
            totalPage: totalPage,
            totalNumber: totalNumber
          });
          html += formattedString;
        }

        // Whether to display navigator
        if (showNavigator) {
          if (formatNavigator) {
            formattedString = self.replaceVariables(formatNavigator, {
              currentPage: currentPage,
              totalPage: totalPage,
              totalNumber: totalNumber,
              rangeStart: (currentPage - 1) * pageSize + 1,
              rangeEnd: Math.min(currentPage * pageSize, totalNumber)
            });
            html += `<div class="${classPrefix}-nav J-paginationjs-nav">${formattedString}</div>`;
          }
        }

        if (showPrevious || showPageNumbers || showNext) {
          html += '<div class="paginationjs-pages">';

          if (ulClassName) {
            html += `<ul class="${ulClassName}">`;
          } else {
            html += '<ul>';
          }

          // Whether to display Previous button
          if (showPrevious) {
            if (currentPage <= 1) {
              if (!autoHidePrevious) {
                html += `<li class="${classPrefix}-prev ${disableClassName} ${prevClassName}"><a>${prevText}</a></li>`;
              }
            } else {
              html += `<li class="${classPrefix}-prev J-paginationjs-previous ${prevClassName}" data-num="${currentPage - 1}" title="Previous page">${getPageLinkTag(prevText)}</li>`;
            }
          }

          // Whether to display page numbers
          if (showPageNumbers) {
            html += self.generatePageNumbersHTML(args);
          }

          // Whether to display Next button
          if (showNext) {
            if (currentPage >= totalPage) {
              if (!autoHideNext) {
                html += `<li class="${classPrefix}-next ${disableClassName} ${nextClassName}"><a>${nextText}</a></li>`;
              }
            } else {
              html += `<li class="${classPrefix}-next J-paginationjs-next ${nextClassName}" data-num="${currentPage + 1}" title="Next page">${getPageLinkTag(nextText)}</li>`;
            }
          }
          html += `</ul></div>`;
        }

        if (showSizeChanger) {
          if (Helpers.isArray(sizeChangerOptions)) {
            if (sizeChangerOptions.indexOf(pageSize) === -1) {
              sizeChangerOptions.unshift(pageSize);
              sizeChangerOptions.sort((a, b) => a - b);
            }
            for (let i = 0; i < sizeChangerOptions.length; i++) {
              sizeSelect += `<option value="${sizeChangerOptions[i]}"${(sizeChangerOptions[i] === pageSize ? ' selected' : '')}>${sizeChangerOptions[i]} / page</option>`;
            }
            sizeSelect += `</select>`;
            formattedString = sizeSelect;

            if (formatSizeChanger) {
              formattedString = self.replaceVariables(formatSizeChanger, {
                length: sizeSelect,
                total: totalNumber
              });
            }
            html += `<div class="paginationjs-size-changer">${formattedString}</div>`;
          }
        }

        // Whether to display Go input
        if (showGoInput) {
          if (formatGoInput) {
            formattedString = self.replaceVariables(formatGoInput, {
              currentPage: currentPage,
              totalPage: totalPage,
              totalNumber: totalNumber,
              input: goInput
            });
            html += `<div class="${classPrefix}-go-input">${formattedString}</div>`;
          }
        }

        // Whether to display Go button
        if (showGoButton) {
          if (formatGoButton) {
            formattedString = self.replaceVariables(formatGoButton, {
              currentPage: currentPage,
              totalPage: totalPage,
              totalNumber: totalNumber,
              button: goButton
            });
            html += `<div class="${classPrefix}-go-button">${formattedString}</div>`;
          }
        }

        // Append extra contents to the pagination buttons
        if (footer) {
          formattedString = self.replaceVariables(footer, {
            currentPage: currentPage,
            totalPage: totalPage,
            totalNumber: totalNumber
          });
          html += formattedString;
        }

        return html;
      },

      // dataSource is a request URL and a 'totalNumberLocator' function specified
      // execute it to find out 'totalNumber' from the response
      findTotalNumberFromRemoteResponse: function(response) {
        var self = this;
        self.model.totalNumber = attributes.totalNumberLocator(response);
      },

      // Go to the specified page
      go: function(number, callback) {
        var self = this;
        var model = self.model;

        if (self.disabled) return;

        var pageNumber = number;
        pageNumber = parseInt(pageNumber);

        if (!pageNumber || pageNumber < 1) return;

        var pageSize = attributes.pageSize;
        var totalNumber = self.getTotalNumber();
        var totalPage = self.getTotalPage();

        if (totalNumber > 0 && pageNumber > totalPage) return;

        // Pick paging data in synchronous mode
        if (!self.isAsync) {
          render(self.getPagingData(pageNumber));
          return;
        }

        var postData = {};
        var alias = attributes.alias || {};
        var pageSizeName = alias.pageSize ? alias.pageSize : 'pageSize';
        var pageNumberName = alias.pageNumber ? alias.pageNumber : 'pageNumber';
        postData[pageSizeName] = pageSize;
        postData[pageNumberName] = pageNumber;

        var ajaxParams = typeof attributes.ajax === 'function' ? attributes.ajax() : attributes.ajax;

        // If the pageNumber's value starts with 0 via Ajax
        if (ajaxParams && ajaxParams.pageNumberStartWithZero) {
          postData[pageNumberName] = pageNumber - 1;
        }

        var formatAjaxParams = {
          type: 'get',
          cache: false,
          data: {},
          contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
          dataType: 'json',
          async: true
        };

        $.extend(true, formatAjaxParams, ajaxParams);
        $.extend(formatAjaxParams.data, postData);

        formatAjaxParams.url = attributes.dataSource;
        formatAjaxParams.success = function(response) {
          try {
            self.model.originalResponse = response;
            if (self.isDynamicTotalNumber) {
              self.findTotalNumberFromRemoteResponse(response);
            } else {
              self.model.totalNumber = attributes.totalNumber;
            }

            var finalData = self.filterDataWithLocator(response);
            render(finalData);
          } catch (e) {
            if(typeof attributes.onError === 'function') {
              attributes.onError(e, 'ajaxSuccessHandlerError');
            } else {
              throw e;
            }
          }
        };
        formatAjaxParams.error = function(jqXHR, textStatus, errorThrown) {
          attributes.formatAjaxError && attributes.formatAjaxError(jqXHR, textStatus, errorThrown);
          self.enable();
        };

        self.disable();

        if (attributes.ajaxFunction) {
          attributes.ajaxFunction(formatAjaxParams);
        } else {
          $.ajax(formatAjaxParams);
        }

        function render(data) {
          if (self.callHook('beforePaging', pageNumber) === false) return false;

          // Pagination direction
          model.direction = typeof model.pageNumber === 'undefined' ? 0 : (pageNumber > model.pageNumber ? 1 : -1);

          model.pageNumber = pageNumber;

          self.render();

          if (self.disabled && self.isAsync) {
            // enable pagination
            self.enable();
          }

          // cache model data
          container.data('pagination').model = model;

          // format result data before callback invoked
          if (attributes.formatResult) {
            var cloneData = $.extend(true, [], data);
            if (!Helpers.isArray(data = attributes.formatResult(cloneData))) {
              data = cloneData;
            }
          }

          container.data('pagination').currentPageData = data;

          self.doCallback(data, callback);

          self.callHook('afterPaging', pageNumber);

          if (pageNumber == 1) {
            self.callHook('afterIsFirstPage');
          } else if (pageNumber == self.getTotalPage()) {
            self.callHook('afterIsLastPage');
          }
        }
      },

      doCallback: function(data, customCallback) {
        var self = this;
        var model = self.model;

        if (typeof customCallback === 'function') {
          customCallback(data, model);
        } else if (typeof attributes.callback === 'function') {
          attributes.callback(data, model);
        }
      },

      destroy: function() {
        if (this.callHook('beforeDestroy') === false) return;

        this.model.el.remove();
        container.off();

        // Remove style element
        $('#paginationjs-style').remove();

        this.callHook('afterDestroy');
      },

      previous: function(callback) {
        this.go(this.model.pageNumber - 1, callback);
      },

      next: function(callback) {
        this.go(this.model.pageNumber + 1, callback);
      },

      disable: function() {
        var self = this;
        var source = self.isAsync ? 'async' : 'sync';

        if (self.callHook('beforeDisable', source) === false) return;

        self.disabled = true;
        self.model.disabled = true;

        self.callHook('afterDisable', source);
      },

      enable: function() {
        var self = this;
        var source = self.isAsync ? 'async' : 'sync';

        if (self.callHook('beforeEnable', source) === false) return;

        self.disabled = false;
        self.model.disabled = false;

        self.callHook('afterEnable', source);
      },

      refresh: function(callback) {
        this.go(this.model.pageNumber, callback);
      },

      show: function() {
        var self = this;

        if (self.model.el.is(':visible')) return;

        self.model.el.show();
      },

      hide: function() {
        var self = this;

        if (!self.model.el.is(':visible')) return;

        self.model.el.hide();
      },

      // Replace variables for template string
      replaceVariables: function(template, variables) {
        var formattedString;

        for (var key in variables) {
          var value = variables[key];
          var regexp = new RegExp('<%=\\s*' + key + '\\s*%>', 'img');

          formattedString = (formattedString || template).replace(regexp, value);
        }

        return formattedString;
      },

      getPagingData: function(number) {
        var pageSize = attributes.pageSize;
        var dataSource = attributes.dataSource;
        var totalNumber = this.getTotalNumber();

        var start = pageSize * (number - 1) + 1;
        var end = Math.min(number * pageSize, totalNumber);

        return dataSource.slice(start - 1, end);
      },

      getTotalNumber: function() {
        return this.model.totalNumber || attributes.totalNumber || 0;
      },

      getTotalPage: function() {
        return Math.ceil(this.getTotalNumber() / attributes.pageSize);
      },

      getLocator: function(locator) {
        var result;

        if (typeof locator === 'string') {
          result = locator;
        } else if (typeof locator === 'function') {
          result = locator();
        } else {
          throwError('"locator" is incorrect. Expect string or function type.');
        }

        return result;
      },

      // Filter data with "locator"
      filterDataWithLocator: function(dataSource) {
        var locator = this.getLocator(attributes.locator);
        var filteredData;

        // Datasource is an Object, use "locator" to locate available data
        if (Helpers.isObject(dataSource)) {
          try {
            $.each(locator.split('.'), function(index, item) {
              filteredData = (filteredData ? filteredData : dataSource)[item];
            });
          }
          catch (e) {
            // ignore
          }

          if (!filteredData) {
            throwError('dataSource.' + locator + ' is undefined.');
          } else if (!Helpers.isArray(filteredData)) {
            throwError('dataSource.' + locator + ' should be an Array.');
          }
        }

        return filteredData || dataSource;
      },

      parseDataSource: function(dataSource, callback) {
        var self = this;

        if (Helpers.isObject(dataSource)) {
          callback(attributes.dataSource = self.filterDataWithLocator(dataSource));
        } else if (Helpers.isArray(dataSource)) {
          callback(attributes.dataSource = dataSource);
        } else if (typeof dataSource === 'function') {
          attributes.dataSource(function(data) {
            if (!Helpers.isArray(data)) {
              throwError('The parameter of "done" Function should be an Array.');
            }
            self.parseDataSource.call(self, data, callback);
          });
        } else if (typeof dataSource === 'string') {
          if (/^https?|file:/.test(dataSource)) {
            attributes.ajaxDataType = 'jsonp';
          }
          callback(dataSource);
        } else {
          throwError('Unexpected dataSource type');
        }
      },

      callHook: function(hook) {
        var paginationData = container.data('pagination') || {};
        var result;

        var args = Array.prototype.slice.apply(arguments);
        args.shift();

        if (attributes[hook] && typeof attributes[hook] === 'function') {
          if (attributes[hook].apply(global, args) === false) {
            result = false;
          }
        }

        if (paginationData.hooks && paginationData.hooks[hook]) {
          $.each(paginationData.hooks[hook], function(index, item) {
            if (item.apply(global, args) === false) {
              result = false;
            }
          });
        }

        return result !== false;
      },

      observer: function() {
        var self = this;
        var el = self.model.el;

        // Go to specified page number
        container.on(eventPrefix + 'go', function(event, pageNumber, done) {
          if (typeof pageNumber === 'string') {
            pageNumber = parseInt(pageNumber.trim());
          }

          if (!pageNumber) return;

          if (typeof pageNumber !== 'number') {
            throwError('"pageNumber" is incorrect. (Number)');
          }

          self.go(pageNumber, done);
        });

        // Page number button click listener
        el.on('click', '.J-paginationjs-page', function(event) {
          var current = $(event.currentTarget);
          var pageNumber = current.attr('data-num').trim();

          if (!pageNumber || current.hasClass(attributes.disableClassName) || current.hasClass(attributes.activeClassName)) return;

          if (self.callHook('beforePageOnClick', event, pageNumber) === false) return false;

          self.go(pageNumber);

          self.callHook('afterPageOnClick', event, pageNumber);

          if (!attributes.pageLink) return false;
        });

        // Previous button click listener
        el.on('click', '.J-paginationjs-previous', function(event) {
          var current = $(event.currentTarget);
          var pageNumber = current.attr('data-num').trim();

          if (!pageNumber || current.hasClass(attributes.disableClassName)) return;

          if (self.callHook('beforePreviousOnClick', event, pageNumber) === false) return false;

          self.go(pageNumber);

          self.callHook('afterPreviousOnClick', event, pageNumber);

          if (!attributes.pageLink) return false;
        });

        // Next button click listener
        el.on('click', '.J-paginationjs-next', function(event) {
          var current = $(event.currentTarget);
          var pageNumber = current.attr('data-num').trim();

          if (!pageNumber || current.hasClass(attributes.disableClassName)) return;

          if (self.callHook('beforeNextOnClick', event, pageNumber) === false) return false;

          self.go(pageNumber);

          self.callHook('afterNextOnClick', event, pageNumber);

          if (!attributes.pageLink) return false;
        });

        // Go button click listener
        el.on('click', '.J-paginationjs-go-button', function(event) {
          var pageNumber = $('.J-paginationjs-go-pagenumber', el).val();

          if (self.callHook('beforeGoButtonOnClick', event, pageNumber) === false) return false;

          container.trigger(eventPrefix + 'go', pageNumber);

          self.callHook('afterGoButtonOnClick', event, pageNumber);
        });

        // go input enter keyup listener
        el.on('keyup', '.J-paginationjs-go-pagenumber', function(event) {
          if (event.which === 13) {
            var pageNumber = $(event.currentTarget).val();

            if (self.callHook('beforeGoInputOnEnter', event, pageNumber) === false) return false;

            container.trigger(eventPrefix + 'go', pageNumber);

            // Maintain the cursor
            $('.J-paginationjs-go-pagenumber', el).focus();

            self.callHook('afterGoInputOnEnter', event, pageNumber);
          }
        });

        el.on('change', '.J-paginationjs-size-select', function(event) {
          var current = $(event.currentTarget);
          var size = parseInt(current.val());
          var currentPage = self.model.pageNumber || attributes.pageNumber;

          if (typeof size !== 'number') return;

          if (self.callHook('beforeSizeSelectorChange', event, size) === false) return false;

          attributes.pageSize = size;
          self.model.pageSize = size;
          self.model.totalPage = self.getTotalPage();
          if (currentPage > self.model.totalPage) {
            currentPage = self.model.totalPage;
          }
          self.go(currentPage);

          self.callHook('afterSizeSelectorChange', event, size);

          if (!attributes.pageLink) return false;
        });

        // Previous page
        container.on(eventPrefix + 'previous', function(event, done) {
          self.previous(done);
        });

        // Next page
        container.on(eventPrefix + 'next', function(event, done) {
          self.next(done);
        });

        // Disable
        container.on(eventPrefix + 'disable', function() {
          self.disable();
        });

        // Enable
        container.on(eventPrefix + 'enable', function() {
          self.enable();
        });

        // Refresh
        container.on(eventPrefix + 'refresh', function(event, done) {
          self.refresh(done);
        });

        // Show
        container.on(eventPrefix + 'show', function() {
          self.show();
        });

        // Hide
        container.on(eventPrefix + 'hide', function() {
          self.hide();
        });

        // Destroy
        container.on(eventPrefix + 'destroy', function() {
          self.destroy();
        });

        // Whether to load the default page
        var validTotalPage = Math.max(self.getTotalPage(), 1)
        var defaultPageNumber = attributes.pageNumber;
        
        // Default pageNumber should be 1 when totalNumber is dynamic
        if (self.isDynamicTotalNumber) {
          if (attributes.resetPageNumberOnInit) defaultPageNumber = 1;
        }

        if (attributes.triggerPagingOnInit) {
          container.trigger(eventPrefix + 'go', Math.min(defaultPageNumber, validTotalPage));
        }
      }
    };

    // Pagination has been initialized
    if (container.data('pagination') && container.data('pagination').initialized === true) {
      // Handle events
      if (isNumeric(options)) {
        // eg: container.pagination(5)
        container.trigger.call(this, eventPrefix + 'go', options, arguments[1]);
        return this;
      } else if (typeof options === 'string') {
        var args = Array.prototype.slice.apply(arguments);
          args[0] = eventPrefix + args[0];

        switch (options) {
          case 'previous':
          case 'next':
          case 'go':
          case 'disable':
          case 'enable':
          case 'refresh':
          case 'show':
          case 'hide':
          case 'destroy':
            container.trigger.apply(this, args);
            break;
          case 'getSelectedPageNum':
          case 'getCurrentPageNum':
            if (container.data('pagination').model) {
              return container.data('pagination').model.pageNumber;
            } else {
              return container.data('pagination').attributes.pageNumber;
            }
          case 'getTotalPage':
            return Math.ceil(container.data('pagination').model.totalNumber / container.data('pagination').model.pageSize);
          case 'getSelectedPageData':
          case 'getCurrentPageData':
            return container.data('pagination').currentPageData;
          // Whether pagination has been disabled
          case 'isDisabled':
            return container.data('pagination').model.disabled === true;
          default:
            throwError('Unknown action: ' + options);
        }
        return this;
      } else {
        // Uninstall the old instance before initializing a new one
        uninstallPlugin(container);
      }
    } else {
      if (!Helpers.isObject(options)) throwError('Illegal options');
    }

    // Check parameters
    parameterChecker(attributes);

    pagination.initialize();

    return this;
  };

  // Instance defaults
  $.fn[pluginName].defaults = {

    // Data source
    // Array | String | Function | Object
    //dataSource: '',

    // String | Function
    //locator: 'data',

    // Function
    //totalNumberLocator: function() {},

    // Total number of data items
    totalNumber: 0,

    // Default page number
    pageNumber: 1,

    // Number of data items per page
    pageSize: 10,

    // Page range (pages around current page)
    pageRange: 2,

    // Whether to display the 'Previous' button
    showPrevious: true,

    // Whether to display the 'Next' button
    showNext: true,

    // Whether to display the page buttons
    showPageNumbers: true,

    showNavigator: false,

    // Whether to display the 'Go' input
    showGoInput: false,

    // Whether to display the 'Go' button
    showGoButton: false,

    showSizeChanger: false,

    sizeChangerOptions: [10, 20, 50, 100],

    // Page link
    pageLink: '',

    // 'Previous' text
    prevText: '&lsaquo;',

    // 'Next' text
    nextText: '&rsaquo;',

    // Ellipsis text
    ellipsisText: '...',

    // 'Go' button text
    goButtonText: 'Go',

    // Additional class name(s) for the Pagination container
    //className: '',

    classPrefix: 'paginationjs',

    activeClassName: 'active',

    // class name when disabled
    disableClassName: 'disabled',

    //ulClassName: '',

    //pageClassName: '',

    //prevClassName: '',

    //nextClassName: '',

    formatNavigator: 'Total <%= totalNumber %> items',

    formatGoInput: '<%= input %>',

    formatGoButton: '<%= button %>',

    // position in the container
    position: 'bottom',

    // Auto hide previous button when current page is the first
    autoHidePrevious: false,

    // Auto hide next button when current page is the last
    autoHideNext: false,

    //header: '',

    //footer: '',

    //alias: {},

    // Whether to trigger pagination at initialization
    triggerPagingOnInit: true,

    // Whether to reset page number at initialization, it works only if dataSource is a URL and totalNumberLocator is specified
    resetPageNumberOnInit: true,

    // Whether to hide pagination when less than one page
    hideOnlyOnePage: false,

    hideFirstOnEllipsisShow: false,

    hideLastOnEllipsisShow: false,

    // Customize item's innerHTML
    callback: function() {}
  };

  // Hook register
  $.fn[pluginHookMethod] = function(hook, callback) {
    if (arguments.length < 2) {
      throwError('Expect 2 arguments at least.');
    }

    if (typeof callback !== 'function') {
      throwError('callback should be a function.');
    }

    var container = $(this);
    var paginationData = container.data('pagination');

    if (!paginationData) {
      container.data('pagination', {});
      paginationData = container.data('pagination');
    }

    !paginationData.hooks && (paginationData.hooks = {});

    //paginationData.hooks[hook] = callback;
    paginationData.hooks[hook] = paginationData.hooks[hook] || [];
    paginationData.hooks[hook].push(callback);

  };

  // Static method
  $[pluginName] = function(selector, options) {
    if (arguments.length < 2) {
      throwError('Requires two parameters.');
    }

    var container;

    // 'selector' is a jQuery object
    if (typeof selector !== 'string' && selector instanceof jQuery) {
      container = selector;
    } else {
      container = $(selector);
    }

    if (!container.length) return;

    container.pagination(options);

    return container;
  };

  // ============================================================
  // helpers
  // ============================================================

  var Helpers = {};

  // Throw error
  function throwError(content) {
    throw new Error('Pagination: ' + content);
  }

  // Check parameters
  function parameterChecker(args) {
    if (!args.dataSource) {
      throwError('"dataSource" is required.');
    }

    if (typeof args.dataSource === 'string') {
      if (args.totalNumberLocator === undefined) {
        if (args.totalNumber === undefined) {
          throwError('"totalNumber" is required.');
        } else if (!isNumeric(args.totalNumber)) {
          throwError('"totalNumber" is incorrect. Expect numberic type');
        }
      } else {
        if (typeof args.totalNumberLocator !== 'function') {
          throwError('"totalNumberLocator" should be a Function.');
        }
      }
    } else if (Helpers.isObject(args.dataSource)) {
      if (typeof args.locator === 'undefined') {
        throwError('"dataSource" is an Object, please specify a "locator".');
      } else if (typeof args.locator !== 'string' && typeof args.locator !== 'function') {
        throwError('' + args.locator + ' is incorrect. Expect string or function type');
      }
    }

    if (args.formatResult !== undefined && typeof args.formatResult !== 'function') {
      throwError('"formatResult" should be a Function.');
    }

    if (args.onError !== undefined && typeof args.onError !== 'function') {
      throwError('"onError" should be a Function.');
    }
  }

  // uninstall plugin
  function uninstallPlugin(target) {
    var events = ['go', 'previous', 'next', 'disable', 'enable', 'refresh', 'show', 'hide', 'destroy'];

    // off all events
    $.each(events, function(index, value) {
      target.off(eventPrefix + value);
    });

    // reset pagination data
    target.data('pagination', {});

    // remove pagination element
    $('.paginationjs', target).remove();
  }

  // Object type detection
  function getObjectType(object, tmp) {
    return ( (tmp = typeof(object)) == "object" ? object == null && "null" || Object.prototype.toString.call(object).slice(8, -1) : tmp ).toLowerCase();
  }

  function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  }

  $.each(['Object', 'Array', 'String'], function(index, name) {
    Helpers['is' + name] = function(object) {
      return getObjectType(object) === name.toLowerCase();
    };
  });

  /*
   * export via AMD or CommonJS
   * */
  if (typeof define === 'function' && define.amd) {
    define(function() {
      return $;
    });
  }

})(this, window.jQuery);
