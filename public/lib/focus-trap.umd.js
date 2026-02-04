/*!
* focus-trap 8.0.0
* @license MIT, https://github.com/focus-trap/focus-trap/blob/master/LICENSE
*/
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('tabbable')) :
  typeof define === 'function' && define.amd ? define(['exports', 'tabbable'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, (function () {
    var current = global.focusTrap;
    var exports = global.focusTrap = {};
    factory(exports, global.tabbable);
    exports.noConflict = function () { global.focusTrap = current; return exports; };
  })());
})(this, (function (exports, tabbable) { 'use strict';

  function _arrayLikeToArray(r, a) {
    (null == a || a > r.length) && (a = r.length);
    for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
    return n;
  }
  function _arrayWithoutHoles(r) {
    if (Array.isArray(r)) return _arrayLikeToArray(r);
  }
  function asyncGeneratorStep(n, t, e, r, o, a, c) {
    try {
      var i = n[a](c),
        u = i.value;
    } catch (n) {
      return void e(n);
    }
    i.done ? t(u) : Promise.resolve(u).then(r, o);
  }
  function _asyncToGenerator(n) {
    return function () {
      var t = this,
        e = arguments;
      return new Promise(function (r, o) {
        var a = n.apply(t, e);
        function _next(n) {
          asyncGeneratorStep(a, r, o, _next, _throw, "next", n);
        }
        function _throw(n) {
          asyncGeneratorStep(a, r, o, _next, _throw, "throw", n);
        }
        _next(void 0);
      });
    };
  }
  function _createForOfIteratorHelper(r, e) {
    var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
    if (!t) {
      if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e) {
        t && (r = t);
        var n = 0,
          F = function () {};
        return {
          s: F,
          n: function () {
            return n >= r.length ? {
              done: true
            } : {
              done: false,
              value: r[n++]
            };
          },
          e: function (r) {
            throw r;
          },
          f: F
        };
      }
      throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
    }
    var o,
      a = true,
      u = false;
    return {
      s: function () {
        t = t.call(r);
      },
      n: function () {
        var r = t.next();
        return a = r.done, r;
      },
      e: function (r) {
        u = true, o = r;
      },
      f: function () {
        try {
          a || null == t.return || t.return();
        } finally {
          if (u) throw o;
        }
      }
    };
  }
  function _defineProperty(e, r, t) {
    return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
      value: t,
      enumerable: true,
      configurable: true,
      writable: true
    }) : e[r] = t, e;
  }
  function _iterableToArray(r) {
    if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r);
  }
  function _nonIterableSpread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }
  function ownKeys(e, r) {
    var t = Object.keys(e);
    if (Object.getOwnPropertySymbols) {
      var o = Object.getOwnPropertySymbols(e);
      r && (o = o.filter(function (r) {
        return Object.getOwnPropertyDescriptor(e, r).enumerable;
      })), t.push.apply(t, o);
    }
    return t;
  }
  function _objectSpread2(e) {
    for (var r = 1; r < arguments.length; r++) {
      var t = null != arguments[r] ? arguments[r] : {};
      r % 2 ? ownKeys(Object(t), true).forEach(function (r) {
        _defineProperty(e, r, t[r]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) {
        Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
      });
    }
    return e;
  }
  function _regenerator() {
    /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */
    var e,
      t,
      r = "function" == typeof Symbol ? Symbol : {},
      n = r.iterator || "@@iterator",
      o = r.toStringTag || "@@toStringTag";
    function i(r, n, o, i) {
      var c = n && n.prototype instanceof Generator ? n : Generator,
        u = Object.create(c.prototype);
      return _regeneratorDefine(u, "_invoke", function (r, n, o) {
        var i,
          c,
          u,
          f = 0,
          p = o || [],
          y = false,
          G = {
            p: 0,
            n: 0,
            v: e,
            a: d,
            f: d.bind(e, 4),
            d: function (t, r) {
              return i = t, c = 0, u = e, G.n = r, a;
            }
          };
        function d(r, n) {
          for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) {
            var o,
              i = p[t],
              d = G.p,
              l = i[2];
            r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0));
          }
          if (o || r > 1) return a;
          throw y = true, n;
        }
        return function (o, p, l) {
          if (f > 1) throw TypeError("Generator is already running");
          for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) {
            i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u);
            try {
              if (f = 2, i) {
                if (c || (o = "next"), t = i[o]) {
                  if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object");
                  if (!t.done) return t;
                  u = t.value, c < 2 && (c = 0);
                } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1);
                i = e;
              } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break;
            } catch (t) {
              i = e, c = 1, u = t;
            } finally {
              f = 1;
            }
          }
          return {
            value: t,
            done: y
          };
        };
      }(r, o, i), true), u;
    }
    var a = {};
    function Generator() {}
    function GeneratorFunction() {}
    function GeneratorFunctionPrototype() {}
    t = Object.getPrototypeOf;
    var c = [][n] ? t(t([][n]())) : (_regeneratorDefine(t = {}, n, function () {
        return this;
      }), t),
      u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c);
    function f(e) {
      return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e;
    }
    return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine(u), _regeneratorDefine(u, o, "Generator"), _regeneratorDefine(u, n, function () {
      return this;
    }), _regeneratorDefine(u, "toString", function () {
      return "[object Generator]";
    }), (_regenerator = function () {
      return {
        w: i,
        m: f
      };
    })();
  }
  function _regeneratorDefine(e, r, n, t) {
    var i = Object.defineProperty;
    try {
      i({}, "", {});
    } catch (e) {
      i = 0;
    }
    _regeneratorDefine = function (e, r, n, t) {
      function o(r, n) {
        _regeneratorDefine(e, r, function (e) {
          return this._invoke(r, n, e);
        });
      }
      r ? i ? i(e, r, {
        value: n,
        enumerable: !t,
        configurable: !t,
        writable: !t
      }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2));
    }, _regeneratorDefine(e, r, n, t);
  }
  function _toConsumableArray(r) {
    return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread();
  }
  function _toPrimitive(t, r) {
    if ("object" != typeof t || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r);
      if ("object" != typeof i) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }
  function _toPropertyKey(t) {
    var i = _toPrimitive(t, "string");
    return "symbol" == typeof i ? i : i + "";
  }
  function _unsupportedIterableToArray(r, a) {
    if (r) {
      if ("string" == typeof r) return _arrayLikeToArray(r, a);
      var t = {}.toString.call(r).slice(8, -1);
      return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
    }
  }

  var activeFocusTraps = {
    // Returns the trap from the top of the stack.
    getActiveTrap: function getActiveTrap(trapStack) {
      if ((trapStack === null || trapStack === void 0 ? void 0 : trapStack.length) > 0) {
        return trapStack[trapStack.length - 1];
      }
      return null;
    },
    // Pauses the currently active trap, then adds a new trap to the stack.
    activateTrap: function activateTrap(trapStack, trap) {
      var activeTrap = activeFocusTraps.getActiveTrap(trapStack);
      if (trap !== activeTrap) {
        activeFocusTraps.pauseTrap(trapStack);
      }
      var trapIndex = trapStack.indexOf(trap);
      if (trapIndex === -1) {
        trapStack.push(trap);
      } else {
        // move this existing trap to the front of the queue
        trapStack.splice(trapIndex, 1);
        trapStack.push(trap);
      }
    },
    // Removes the trap from the top of the stack, then unpauses the next trap down.
    deactivateTrap: function deactivateTrap(trapStack, trap) {
      var trapIndex = trapStack.indexOf(trap);
      if (trapIndex !== -1) {
        trapStack.splice(trapIndex, 1);
      }
      activeFocusTraps.unpauseTrap(trapStack);
    },
    // Pauses the trap at the top of the stack.
    pauseTrap: function pauseTrap(trapStack) {
      var activeTrap = activeFocusTraps.getActiveTrap(trapStack);
      activeTrap === null || activeTrap === void 0 || activeTrap._setPausedState(true);
    },
    // Unpauses the trap at the top of the stack.
    unpauseTrap: function unpauseTrap(trapStack) {
      var activeTrap = activeFocusTraps.getActiveTrap(trapStack);
      if (activeTrap && !activeTrap._isManuallyPaused()) {
        activeTrap._setPausedState(false);
      }
    }
  };
  var isSelectableInput = function isSelectableInput(node) {
    return node.tagName && node.tagName.toLowerCase() === 'input' && typeof node.select === 'function';
  };
  var isEscapeEvent = function isEscapeEvent(e) {
    return (e === null || e === void 0 ? void 0 : e.key) === 'Escape' || (e === null || e === void 0 ? void 0 : e.key) === 'Esc' || (e === null || e === void 0 ? void 0 : e.keyCode) === 27;
  };
  var isTabEvent = function isTabEvent(e) {
    return (e === null || e === void 0 ? void 0 : e.key) === 'Tab' || (e === null || e === void 0 ? void 0 : e.keyCode) === 9;
  };

  // checks for TAB by default
  var isKeyForward = function isKeyForward(e) {
    return isTabEvent(e) && !e.shiftKey;
  };

  // checks for SHIFT+TAB by default
  var isKeyBackward = function isKeyBackward(e) {
    return isTabEvent(e) && e.shiftKey;
  };
  var delay = function delay(fn) {
    return setTimeout(fn, 0);
  };

  /**
   * Get an option's value when it could be a plain value, or a handler that provides
   *  the value.
   * @param {*} value Option's value to check.
   * @param {...*} [params] Any parameters to pass to the handler, if `value` is a function.
   * @returns {*} The `value`, or the handler's returned value.
   */
  var valueOrHandler = function valueOrHandler(value) {
    for (var _len = arguments.length, params = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      params[_key - 1] = arguments[_key];
    }
    return typeof value === 'function' ? value.apply(void 0, params) : value;
  };
  var getActualTarget = function getActualTarget(event) {
    // NOTE: If the trap is _inside_ a shadow DOM, event.target will always be the
    //  shadow host. However, event.target.composedPath() will be an array of
    //  nodes "clicked" from inner-most (the actual element inside the shadow) to
    //  outer-most (the host HTML document). If we have access to composedPath(),
    //  then use its first element; otherwise, fall back to event.target (and
    //  this only works for an _open_ shadow DOM; otherwise,
    //  composedPath()[0] === event.target always).
    return event.target.shadowRoot && typeof event.composedPath === 'function' ? event.composedPath()[0] : event.target;
  };

  // NOTE: this must be _outside_ `createFocusTrap()` to make sure all traps in this
  //  current instance use the same stack if `userOptions.trapStack` isn't specified
  var internalTrapStack = [];
  var createFocusTrap = function createFocusTrap(elements, userOptions) {
    // SSR: a live trap shouldn't be created in this type of environment so this
    //  should be safe code to execute if the `document` option isn't specified
    var doc = (userOptions === null || userOptions === void 0 ? void 0 : userOptions.document) || document;
    var trapStack = (userOptions === null || userOptions === void 0 ? void 0 : userOptions.trapStack) || internalTrapStack;
    var config = _objectSpread2({
      returnFocusOnDeactivate: true,
      escapeDeactivates: true,
      delayInitialFocus: true,
      isolateSubtrees: false,
      isKeyForward: isKeyForward,
      isKeyBackward: isKeyBackward
    }, userOptions);
    var state = {
      // containers given to createFocusTrap()
      /** @type {Array<HTMLElement>} */
      containers: [],
      // list of objects identifying tabbable nodes in `containers` in the trap
      // NOTE: it's possible that a group has no tabbable nodes if nodes get removed while the trap
      //  is active, but the trap should never get to a state where there isn't at least one group
      //  with at least one tabbable node in it (that would lead to an error condition that would
      //  result in an error being thrown)
      /** @type {Array<{
       *    container: HTMLElement,
       *    tabbableNodes: Array<HTMLElement>, // empty if none
       *    focusableNodes: Array<HTMLElement>, // empty if none
       *    posTabIndexesFound: boolean,
       *    firstTabbableNode: HTMLElement|undefined,
       *    lastTabbableNode: HTMLElement|undefined,
       *    firstDomTabbableNode: HTMLElement|undefined,
       *    lastDomTabbableNode: HTMLElement|undefined,
       *    nextTabbableNode: (node: HTMLElement, forward: boolean) => HTMLElement|undefined
       *  }>}
       */
      containerGroups: [],
      // same order/length as `containers` list

      // references to objects in `containerGroups`, but only those that actually have
      //  tabbable nodes in them
      // NOTE: same order as `containers` and `containerGroups`, but __not necessarily__
      //  the same length
      tabbableGroups: [],
      // references to nodes that are siblings to the ancestors of this trap's containers.
      /** @type {Set<HTMLElement>} */
      adjacentElements: new Set(),
      // references to nodes that were inert or aria-hidden before the trap was activated.
      /** @type {Set<HTMLElement>} */
      alreadySilent: new Set(),
      nodeFocusedBeforeActivation: null,
      mostRecentlyFocusedNode: null,
      active: false,
      paused: false,
      manuallyPaused: false,
      // timer ID for when delayInitialFocus is true and initial focus in this trap
      //  has been delayed during activation
      delayInitialFocusTimer: undefined,
      // the most recent KeyboardEvent for the configured nav key (typically [SHIFT+]TAB), if any
      recentNavEvent: undefined
    };
    var trap; // eslint-disable-line prefer-const -- some private functions reference it, and its methods reference private functions, so we must declare here and define later

    /**
     * Gets a configuration option value.
     * @param {Object|undefined} configOverrideOptions If true, and option is defined in this set,
     *  value will be taken from this object. Otherwise, value will be taken from base configuration.
     * @param {string} optionName Name of the option whose value is sought.
     * @param {string|undefined} [configOptionName] Name of option to use __instead of__ `optionName`
     *  IIF `configOverrideOptions` is not defined. Otherwise, `optionName` is used.
     */
    var getOption = function getOption(configOverrideOptions, optionName, configOptionName) {
      return configOverrideOptions && configOverrideOptions[optionName] !== undefined ? configOverrideOptions[optionName] : config[configOptionName || optionName];
    };

    /**
     * Finds the index of the container that contains the element.
     * @param {HTMLElement} element
     * @param {Event} [event] If available, and `element` isn't directly found in any container,
     *  the event's composed path is used to see if includes any known trap containers in the
     *  case where the element is inside a Shadow DOM.
     * @returns {number} Index of the container in either `state.containers` or
     *  `state.containerGroups` (the order/length of these lists are the same); -1
     *  if the element isn't found.
     */
    var findContainerIndex = function findContainerIndex(element, event) {
      var composedPath = typeof (event === null || event === void 0 ? void 0 : event.composedPath) === 'function' ? event.composedPath() : undefined;
      // NOTE: search `containerGroups` because it's possible a group contains no tabbable
      //  nodes, but still contains focusable nodes (e.g. if they all have `tabindex=-1`)
      //  and we still need to find the element in there
      return state.containerGroups.findIndex(function (_ref) {
        var container = _ref.container,
          tabbableNodes = _ref.tabbableNodes;
        return container.contains(element) || (// fall back to explicit tabbable search which will take into consideration any
        //  web components if the `tabbableOptions.getShadowRoot` option was used for
        //  the trap, enabling shadow DOM support in tabbable (`Node.contains()` doesn't
        //  look inside web components even if open)
        composedPath === null || composedPath === void 0 ? void 0 : composedPath.includes(container)) || tabbableNodes.find(function (node) {
          return node === element;
        });
      });
    };

    /**
     * Gets the node for the given option, which is expected to be an option that
     *  can be either a DOM node, a string that is a selector to get a node, `false`
     *  (if a node is explicitly NOT given), or a function that returns any of these
     *  values.
     * @param {string} optionName
     * @param {Object} options
     * @param {boolean} [options.hasFallback] True if the option could be a selector string
     *  and the option allows for a fallback scenario in the case where the selector is
     *  valid but does not match a node (i.e. the queried node doesn't exist in the DOM).
     * @param {Array} [options.params] Params to pass to the option if it's a function.
     * @returns {undefined | null | false | HTMLElement | SVGElement} Returns
     *  `undefined` if the option is not specified; `null` if the option didn't resolve
     *  to a node but `options.hasFallback=true`, `false` if the option resolved to `false`
     *  (node explicitly not given); otherwise, the resolved DOM node.
     * @throws {Error} If the option is set, not `false`, and is not, or does not
     *  resolve to a node, unless the option is a selector string and `options.hasFallback=true`.
     */
    var getNodeForOption = function getNodeForOption(optionName) {
      var _ref2 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref2$hasFallback = _ref2.hasFallback,
        hasFallback = _ref2$hasFallback === void 0 ? false : _ref2$hasFallback,
        _ref2$params = _ref2.params,
        params = _ref2$params === void 0 ? [] : _ref2$params;
      var optionValue = config[optionName];
      if (typeof optionValue === 'function') {
        optionValue = optionValue.apply(void 0, _toConsumableArray(params));
      }
      if (optionValue === true) {
        optionValue = undefined; // use default value
      }
      if (!optionValue) {
        if (optionValue === undefined || optionValue === false) {
          return optionValue;
        }
        // else, empty string (invalid), null (invalid), 0 (invalid)

        throw new Error("`".concat(optionName, "` was specified but was not a node, or did not return a node"));
      }
      var node = optionValue; // could be HTMLElement, SVGElement, or non-empty string at this point

      if (typeof optionValue === 'string') {
        try {
          node = doc.querySelector(optionValue); // resolve to node, or null if fails
        } catch (err) {
          throw new Error("`".concat(optionName, "` appears to be an invalid selector; error=\"").concat(err.message, "\""));
        }
        if (!node) {
          if (!hasFallback) {
            throw new Error("`".concat(optionName, "` as selector refers to no known node"));
          }
          // else, `node` MUST be `null` because that's what `Document.querySelector()` returns
          //  if the selector is valid but doesn't match anything
        }
      }
      return node;
    };
    var getInitialFocusNode = function getInitialFocusNode() {
      var node = getNodeForOption('initialFocus', {
        hasFallback: true
      });

      // false explicitly indicates we want no initialFocus at all
      if (node === false) {
        return false;
      }
      if (node === undefined || node && !tabbable.isFocusable(node, config.tabbableOptions)) {
        // option not specified nor focusable: use fallback options
        if (findContainerIndex(doc.activeElement) >= 0) {
          node = doc.activeElement;
        } else {
          var firstTabbableGroup = state.tabbableGroups[0];
          var firstTabbableNode = firstTabbableGroup && firstTabbableGroup.firstTabbableNode;

          // NOTE: `fallbackFocus` option function cannot return `false` (not supported)
          node = firstTabbableNode || getNodeForOption('fallbackFocus');
        }
      } else if (node === null) {
        // option is a VALID selector string that doesn't yield a node: use the `fallbackFocus`
        //  option instead of the default behavior when the option isn't specified at all
        node = getNodeForOption('fallbackFocus');
      }
      if (!node) {
        throw new Error('Your focus-trap needs to have at least one focusable element');
      }
      return node;
    };
    var updateTabbableNodes = function updateTabbableNodes() {
      state.containerGroups = state.containers.map(function (container) {
        var tabbableNodes = tabbable.tabbable(container, config.tabbableOptions);

        // NOTE: if we have tabbable nodes, we must have focusable nodes; focusable nodes
        //  are a superset of tabbable nodes since nodes with negative `tabindex` attributes
        //  are focusable but not tabbable
        var focusableNodes = tabbable.focusable(container, config.tabbableOptions);
        var firstTabbableNode = tabbableNodes.length > 0 ? tabbableNodes[0] : undefined;
        var lastTabbableNode = tabbableNodes.length > 0 ? tabbableNodes[tabbableNodes.length - 1] : undefined;
        var firstDomTabbableNode = focusableNodes.find(function (node) {
          return tabbable.isTabbable(node);
        });
        var lastDomTabbableNode = focusableNodes.slice().reverse().find(function (node) {
          return tabbable.isTabbable(node);
        });
        var posTabIndexesFound = !!tabbableNodes.find(function (node) {
          return tabbable.getTabIndex(node) > 0;
        });
        return {
          container: container,
          tabbableNodes: tabbableNodes,
          focusableNodes: focusableNodes,
          /** True if at least one node with positive `tabindex` was found in this container. */
          posTabIndexesFound: posTabIndexesFound,
          /** First tabbable node in container, __tabindex__ order; `undefined` if none. */
          firstTabbableNode: firstTabbableNode,
          /** Last tabbable node in container, __tabindex__ order; `undefined` if none. */
          lastTabbableNode: lastTabbableNode,
          // NOTE: DOM order is NOT NECESSARILY "document position" order, but figuring that out
          //  would require more than just https://developer.mozilla.org/en-US/docs/Web/API/Node/compareDocumentPosition
          //  because that API doesn't work with Shadow DOM as well as it should (@see
          //  https://github.com/whatwg/dom/issues/320) and since this first/last is only needed, so far,
          //  to address an edge case related to positive tabindex support, this seems like a much easier,
          //  "close enough most of the time" alternative for positive tabindexes which should generally
          //  be avoided anyway...
          /** First tabbable node in container, __DOM__ order; `undefined` if none. */
          firstDomTabbableNode: firstDomTabbableNode,
          /** Last tabbable node in container, __DOM__ order; `undefined` if none. */
          lastDomTabbableNode: lastDomTabbableNode,
          /**
           * Finds the __tabbable__ node that follows the given node in the specified direction,
           *  in this container, if any.
           * @param {HTMLElement} node
           * @param {boolean} [forward] True if going in forward tab order; false if going
           *  in reverse.
           * @returns {HTMLElement|undefined} The next tabbable node, if any.
           */
          nextTabbableNode: function nextTabbableNode(node) {
            var forward = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
            var nodeIdx = tabbableNodes.indexOf(node);
            if (nodeIdx < 0) {
              // either not tabbable nor focusable, or was focused but not tabbable (negative tabindex):
              //  since `node` should at least have been focusable, we assume that's the case and mimic
              //  what browsers do, which is set focus to the next node in __document position order__,
              //  regardless of positive tabindexes, if any -- and for reasons explained in the NOTE
              //  above related to `firstDomTabbable` and `lastDomTabbable` properties, we fall back to
              //  basic DOM order
              if (forward) {
                return focusableNodes.slice(focusableNodes.indexOf(node) + 1).find(function (el) {
                  return tabbable.isTabbable(el);
                });
              }
              return focusableNodes.slice(0, focusableNodes.indexOf(node)).reverse().find(function (el) {
                return tabbable.isTabbable(el);
              });
            }
            return tabbableNodes[nodeIdx + (forward ? 1 : -1)];
          }
        };
      });
      state.tabbableGroups = state.containerGroups.filter(function (group) {
        return group.tabbableNodes.length > 0;
      });

      // throw if no groups have tabbable nodes and we don't have a fallback focus node either
      if (state.tabbableGroups.length <= 0 && !getNodeForOption('fallbackFocus') // returning false not supported for this option
      ) {
        throw new Error('Your focus-trap must have at least one container with at least one tabbable node in it at all times');
      }

      // NOTE: Positive tabindexes are only properly supported in single-container traps because
      //  doing it across multiple containers where tabindexes could be all over the place
      //  would require Tabbable to support multiple containers, would require additional
      //  specialized Shadow DOM support, and would require Tabbable's multi-container support
      //  to look at those containers in document position order rather than user-provided
      //  order (as they are treated in Focus-trap, for legacy reasons). See discussion on
      //  https://github.com/focus-trap/focus-trap/issues/375 for more details.
      if (state.containerGroups.find(function (g) {
        return g.posTabIndexesFound;
      }) && state.containerGroups.length > 1) {
        throw new Error("At least one node with a positive tabindex was found in one of your focus-trap's multiple containers. Positive tabindexes are only supported in single-container focus-traps.");
      }
    };

    /**
     * Gets the current activeElement. If it's a web-component and has open shadow-root
     * it will recursively search inside shadow roots for the "true" activeElement.
     *
     * @param {Document | ShadowRoot} el
     *
     * @returns {HTMLElement} The element that currently has the focus
     **/
    var _getActiveElement = function getActiveElement(el) {
      var activeElement = el.activeElement;
      if (!activeElement) {
        return;
      }
      if (activeElement.shadowRoot && activeElement.shadowRoot.activeElement !== null) {
        return _getActiveElement(activeElement.shadowRoot);
      }
      return activeElement;
    };
    var _tryFocus = function tryFocus(node) {
      if (node === false) {
        return;
      }
      if (node === _getActiveElement(document)) {
        return;
      }
      if (!node || !node.focus) {
        _tryFocus(getInitialFocusNode());
        return;
      }
      node.focus({
        preventScroll: !!config.preventScroll
      });
      // NOTE: focus() API does not trigger focusIn event so set MRU node manually
      state.mostRecentlyFocusedNode = node;
      if (isSelectableInput(node)) {
        node.select();
      }
    };
    var getReturnFocusNode = function getReturnFocusNode(previousActiveElement) {
      var node = getNodeForOption('setReturnFocus', {
        params: [previousActiveElement]
      });
      return node ? node : node === false ? false : previousActiveElement;
    };

    /**
     * Finds the next node (in either direction) where focus should move according to a
     *  keyboard focus-in event.
     * @param {Object} params
     * @param {Node} [params.target] Known target __from which__ to navigate, if any.
     * @param {KeyboardEvent|FocusEvent} [params.event] Event to use if `target` isn't known (event
     *  will be used to determine the `target`). Ignored if `target` is specified.
     * @param {boolean} [params.isBackward] True if focus should move backward.
     * @returns {Node|undefined} The next node, or `undefined` if a next node couldn't be
     *  determined given the current state of the trap.
     */
    var findNextNavNode = function findNextNavNode(_ref3) {
      var target = _ref3.target,
        event = _ref3.event,
        _ref3$isBackward = _ref3.isBackward,
        isBackward = _ref3$isBackward === void 0 ? false : _ref3$isBackward;
      target = target || getActualTarget(event);
      updateTabbableNodes();
      var destinationNode = null;
      if (state.tabbableGroups.length > 0) {
        // make sure the target is actually contained in a group
        // NOTE: the target may also be the container itself if it's focusable
        //  with tabIndex='-1' and was given initial focus
        var containerIndex = findContainerIndex(target, event);
        var containerGroup = containerIndex >= 0 ? state.containerGroups[containerIndex] : undefined;
        if (containerIndex < 0) {
          // target not found in any group: quite possible focus has escaped the trap,
          //  so bring it back into...
          if (isBackward) {
            // ...the last node in the last group
            destinationNode = state.tabbableGroups[state.tabbableGroups.length - 1].lastTabbableNode;
          } else {
            // ...the first node in the first group
            destinationNode = state.tabbableGroups[0].firstTabbableNode;
          }
        } else if (isBackward) {
          // REVERSE

          // is the target the first tabbable node in a group?
          var startOfGroupIndex = state.tabbableGroups.findIndex(function (_ref4) {
            var firstTabbableNode = _ref4.firstTabbableNode;
            return target === firstTabbableNode;
          });
          if (startOfGroupIndex < 0 && (containerGroup.container === target || tabbable.isFocusable(target, config.tabbableOptions) && !tabbable.isTabbable(target, config.tabbableOptions) && !containerGroup.nextTabbableNode(target, false))) {
            // an exception case where the target is either the container itself, or
            //  a non-tabbable node that was given focus (i.e. tabindex is negative
            //  and user clicked on it or node was programmatically given focus)
            //  and is not followed by any other tabbable node, in which
            //  case, we should handle shift+tab as if focus were on the container's
            //  first tabbable node, and go to the last tabbable node of the LAST group
            startOfGroupIndex = containerIndex;
          }
          if (startOfGroupIndex >= 0) {
            // YES: then shift+tab should go to the last tabbable node in the
            //  previous group (and wrap around to the last tabbable node of
            //  the LAST group if it's the first tabbable node of the FIRST group)
            var destinationGroupIndex = startOfGroupIndex === 0 ? state.tabbableGroups.length - 1 : startOfGroupIndex - 1;
            var destinationGroup = state.tabbableGroups[destinationGroupIndex];
            destinationNode = tabbable.getTabIndex(target) >= 0 ? destinationGroup.lastTabbableNode : destinationGroup.lastDomTabbableNode;
          } else if (!isTabEvent(event)) {
            // user must have customized the nav keys so we have to move focus manually _within_
            //  the active group: do this based on the order determined by tabbable()
            destinationNode = containerGroup.nextTabbableNode(target, false);
          }
        } else {
          // FORWARD

          // is the target the last tabbable node in a group?
          var lastOfGroupIndex = state.tabbableGroups.findIndex(function (_ref5) {
            var lastTabbableNode = _ref5.lastTabbableNode;
            return target === lastTabbableNode;
          });
          if (lastOfGroupIndex < 0 && (containerGroup.container === target || tabbable.isFocusable(target, config.tabbableOptions) && !tabbable.isTabbable(target, config.tabbableOptions) && !containerGroup.nextTabbableNode(target))) {
            // an exception case where the target is the container itself, or
            //  a non-tabbable node that was given focus (i.e. tabindex is negative
            //  and user clicked on it or node was programmatically given focus)
            //  and is not followed by any other tabbable node, in which
            //  case, we should handle tab as if focus were on the container's
            //  last tabbable node, and go to the first tabbable node of the FIRST group
            lastOfGroupIndex = containerIndex;
          }
          if (lastOfGroupIndex >= 0) {
            // YES: then tab should go to the first tabbable node in the next
            //  group (and wrap around to the first tabbable node of the FIRST
            //  group if it's the last tabbable node of the LAST group)
            var _destinationGroupIndex = lastOfGroupIndex === state.tabbableGroups.length - 1 ? 0 : lastOfGroupIndex + 1;
            var _destinationGroup = state.tabbableGroups[_destinationGroupIndex];
            destinationNode = tabbable.getTabIndex(target) >= 0 ? _destinationGroup.firstTabbableNode : _destinationGroup.firstDomTabbableNode;
          } else if (!isTabEvent(event)) {
            // user must have customized the nav keys so we have to move focus manually _within_
            //  the active group: do this based on the order determined by tabbable()
            destinationNode = containerGroup.nextTabbableNode(target);
          }
        }
      } else {
        // no groups available
        // NOTE: the fallbackFocus option does not support returning false to opt-out
        destinationNode = getNodeForOption('fallbackFocus');
      }
      return destinationNode;
    };

    // This needs to be done on mousedown and touchstart instead of click
    // so that it precedes the focus event.
    var checkPointerDown = function checkPointerDown(e) {
      var target = getActualTarget(e);
      if (findContainerIndex(target, e) >= 0) {
        // allow the click since it occurred inside the trap
        return;
      }
      if (valueOrHandler(config.clickOutsideDeactivates, e)) {
        // immediately deactivate the trap
        trap.deactivate({
          // NOTE: by setting `returnFocus: false`, deactivate() will do nothing,
          //  which will result in the outside click setting focus to the node
          //  that was clicked (and if not focusable, to "nothing"); by setting
          //  `returnFocus: true`, we'll attempt to re-focus the node originally-focused
          //  on activation (or the configured `setReturnFocus` node), whether the
          //  outside click was on a focusable node or not
          returnFocus: config.returnFocusOnDeactivate
        });
        return;
      }

      // This is needed for mobile devices.
      // (If we'll only let `click` events through,
      // then on mobile they will be blocked anyways if `touchstart` is blocked.)
      if (valueOrHandler(config.allowOutsideClick, e)) {
        // allow the click outside the trap to take place
        return;
      }

      // otherwise, prevent the click
      e.preventDefault();
    };

    // In case focus escapes the trap for some strange reason, pull it back in.
    // NOTE: the focusIn event is NOT cancelable, so if focus escapes, it may cause unexpected
    //  scrolling if the node that got focused was out of view; there's nothing we can do to
    //  prevent that from happening by the time we discover that focus escaped
    var checkFocusIn = function checkFocusIn(event) {
      var target = getActualTarget(event);
      var targetContained = findContainerIndex(target, event) >= 0;

      // In Firefox when you Tab out of an iframe the Document is briefly focused.
      if (targetContained || target instanceof Document) {
        if (targetContained) {
          state.mostRecentlyFocusedNode = target;
        }
      } else {
        // escaped! pull it back in to where it just left
        event.stopImmediatePropagation();

        // focus will escape if the MRU node had a positive tab index and user tried to nav forward;
        //  it will also escape if the MRU node had a 0 tab index and user tried to nav backward
        //  toward a node with a positive tab index
        var nextNode; // next node to focus, if we find one
        var navAcrossContainers = true;
        if (state.mostRecentlyFocusedNode) {
          if (tabbable.getTabIndex(state.mostRecentlyFocusedNode) > 0) {
            // MRU container index must be >=0 otherwise we wouldn't have it as an MRU node...
            var mruContainerIdx = findContainerIndex(state.mostRecentlyFocusedNode);
            // there MAY not be any tabbable nodes in the container if there are at least 2 containers
            //  and the MRU node is focusable but not tabbable (focus-trap requires at least 1 container
            //  with at least one tabbable node in order to function, so this could be the other container
            //  with nothing tabbable in it)
            var tabbableNodes = state.containerGroups[mruContainerIdx].tabbableNodes;
            if (tabbableNodes.length > 0) {
              // MRU tab index MAY not be found if the MRU node is focusable but not tabbable
              var mruTabIdx = tabbableNodes.findIndex(function (node) {
                return node === state.mostRecentlyFocusedNode;
              });
              if (mruTabIdx >= 0) {
                if (config.isKeyForward(state.recentNavEvent)) {
                  if (mruTabIdx + 1 < tabbableNodes.length) {
                    nextNode = tabbableNodes[mruTabIdx + 1];
                    navAcrossContainers = false;
                  }
                  // else, don't wrap within the container as focus should move to next/previous
                  //  container
                } else {
                  if (mruTabIdx - 1 >= 0) {
                    nextNode = tabbableNodes[mruTabIdx - 1];
                    navAcrossContainers = false;
                  }
                  // else, don't wrap within the container as focus should move to next/previous
                  //  container
                }
                // else, don't find in container order without considering direction too
              }
            }
            // else, no tabbable nodes in that container (which means we must have at least one other
            //  container with at least one tabbable node in it, otherwise focus-trap would've thrown
            //  an error the last time updateTabbableNodes() was run): find next node among all known
            //  containers
          } else {
            // check to see if there's at least one tabbable node with a positive tab index inside
            //  the trap because focus seems to escape when navigating backward from a tabbable node
            //  with tabindex=0 when this is the case (instead of wrapping to the tabbable node with
            //  the greatest positive tab index like it should)
            if (!state.containerGroups.some(function (g) {
              return g.tabbableNodes.some(function (n) {
                return tabbable.getTabIndex(n) > 0;
              });
            })) {
              // no containers with tabbable nodes with positive tab indexes which means the focus
              //  escaped for some other reason and we should just execute the fallback to the
              //  MRU node or initial focus node, if any
              navAcrossContainers = false;
            }
          }
        } else {
          // no MRU node means we're likely in some initial condition when the trap has just
          //  been activated and initial focus hasn't been given yet, in which case we should
          //  fall through to trying to focus the initial focus node, which is what should
          //  happen below at this point in the logic
          navAcrossContainers = false;
        }
        if (navAcrossContainers) {
          nextNode = findNextNavNode({
            // move FROM the MRU node, not event-related node (which will be the node that is
            //  outside the trap causing the focus escape we're trying to fix)
            target: state.mostRecentlyFocusedNode,
            isBackward: config.isKeyBackward(state.recentNavEvent)
          });
        }
        if (nextNode) {
          _tryFocus(nextNode);
        } else {
          _tryFocus(state.mostRecentlyFocusedNode || getInitialFocusNode());
        }
      }
      state.recentNavEvent = undefined; // clear
    };

    // Hijack key nav events on the first and last focusable nodes of the trap,
    // in order to prevent focus from escaping. If it escapes for even a
    // moment it can end up scrolling the page and causing confusion so we
    // kind of need to capture the action at the keydown phase.
    var checkKeyNav = function checkKeyNav(event) {
      var isBackward = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      state.recentNavEvent = event;
      var destinationNode = findNextNavNode({
        event: event,
        isBackward: isBackward
      });
      if (destinationNode) {
        if (isTabEvent(event)) {
          // since tab natively moves focus, we wouldn't have a destination node unless we
          //  were on the edge of a container and had to move to the next/previous edge, in
          //  which case we want to prevent default to keep the browser from moving focus
          //  to where it normally would
          event.preventDefault();
        }
        _tryFocus(destinationNode);
      }
      // else, let the browser take care of [shift+]tab and move the focus
    };
    var checkTabKey = function checkTabKey(event) {
      if (config.isKeyForward(event) || config.isKeyBackward(event)) {
        checkKeyNav(event, config.isKeyBackward(event));
      }
    };

    // we use a different event phase for the Escape key to allow canceling the event and checking for this in escapeDeactivates
    var checkEscapeKey = function checkEscapeKey(event) {
      if (isEscapeEvent(event) && valueOrHandler(config.escapeDeactivates, event) !== false) {
        event.preventDefault();
        trap.deactivate();
      }
    };
    var checkClick = function checkClick(e) {
      var target = getActualTarget(e);
      if (findContainerIndex(target, e) >= 0) {
        return;
      }
      if (valueOrHandler(config.clickOutsideDeactivates, e)) {
        return;
      }
      if (valueOrHandler(config.allowOutsideClick, e)) {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    //
    // EVENT LISTENERS
    //

    /**
     * Adds listeners to the document necessary for trapping focus and attempts to set focus
     *  to the configured initial focus node. Does nothing if the trap isn't active.
     * @returns {Promise<void>} Resolved (always) once the initial focus node has been focused.
     *  Also resolved if the trap isn't active.
     */
    var addListeners = function addListeners() {
      if (!state.active) {
        return Promise.resolve();
      }

      // There can be only one listening focus trap at a time
      activeFocusTraps.activateTrap(trapStack, trap);

      // Delay ensures that the focused element doesn't capture the event
      // that caused the focus trap activation.
      /** @type {Promise<void>} */
      var promise;
      if (config.delayInitialFocus) {
        // NOTE: Promise constructor callback is called synchronously, which is what we want
        //  since we need to capture the timer ID immediately
        promise = new Promise(function (resolve) {
          state.delayInitialFocusTimer = delay(function () {
            _tryFocus(getInitialFocusNode());
            resolve();
          });
        });
      } else {
        promise = Promise.resolve();
        _tryFocus(getInitialFocusNode());
      }
      doc.addEventListener('focusin', checkFocusIn, true);
      doc.addEventListener('mousedown', checkPointerDown, {
        capture: true,
        passive: false
      });
      doc.addEventListener('touchstart', checkPointerDown, {
        capture: true,
        passive: false
      });
      doc.addEventListener('click', checkClick, {
        capture: true,
        passive: false
      });
      doc.addEventListener('keydown', checkTabKey, {
        capture: true,
        passive: false
      });
      doc.addEventListener('keydown', checkEscapeKey);
      return promise;
    };

    /**
     * Traverses up the DOM from each of `containers`, collecting references to
     * the elements that are siblings to `container` or an ancestor of `container`.
     * @param {Array<HTMLElement>} containers
     */
    var collectAdjacentElements = function collectAdjacentElements(containers) {
      // Re-activate all adjacent elements & clear previous collection.
      if (state.active && !state.paused) {
        trap._setSubtreeIsolation(false);
      }
      state.adjacentElements.clear();
      state.alreadySilent.clear();

      // Collect all ancestors of all containers to avoid redundant processing.
      var containerAncestors = new Set();
      var adjacentElements = new Set();

      // Compile all elements adjacent to the focus trap containers & lineage.
      var _iterator = _createForOfIteratorHelper(containers),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var container = _step.value;
          containerAncestors.add(container);
          var insideShadowRoot = typeof ShadowRoot !== 'undefined' && container.getRootNode() instanceof ShadowRoot;
          var current = container;
          while (current) {
            containerAncestors.add(current);
            var parent = current.parentElement;
            var siblings = [];
            if (parent) {
              siblings = parent.children;
            } else if (!parent && insideShadowRoot) {
              siblings = current.getRootNode().children;
              parent = current.getRootNode().host;
              insideShadowRoot = typeof ShadowRoot !== 'undefined' && parent.getRootNode() instanceof ShadowRoot;
            }

            // Add all the children, we'll remove container lineage later.
            var _iterator2 = _createForOfIteratorHelper(siblings),
              _step2;
            try {
              for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
                var child = _step2.value;
                adjacentElements.add(child);
              }
            } catch (err) {
              _iterator2.e(err);
            } finally {
              _iterator2.f();
            }
            current = parent;
          }
        }

        // Multi-container traps may overlap.
        // Remove elements within container lineages.
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
      containerAncestors.forEach(function (el) {
        adjacentElements["delete"](el);
      });
      state.adjacentElements = adjacentElements;
    };
    var removeListeners = function removeListeners() {
      if (!state.active) {
        return;
      }
      doc.removeEventListener('focusin', checkFocusIn, true);
      doc.removeEventListener('mousedown', checkPointerDown, true);
      doc.removeEventListener('touchstart', checkPointerDown, true);
      doc.removeEventListener('click', checkClick, true);
      doc.removeEventListener('keydown', checkTabKey, true);
      doc.removeEventListener('keydown', checkEscapeKey);
      return trap;
    };

    //
    // MUTATION OBSERVER
    //

    var checkDomRemoval = function checkDomRemoval(mutations) {
      var isFocusedNodeRemoved = mutations.some(function (mutation) {
        var removedNodes = Array.from(mutation.removedNodes);
        return removedNodes.some(function (node) {
          return node === state.mostRecentlyFocusedNode;
        });
      });

      // If the currently focused is removed then browsers will move focus to the
      // <body> element. If this happens, try to move focus back into the trap.
      if (isFocusedNodeRemoved) {
        _tryFocus(getInitialFocusNode());
      }
    };

    // Use MutationObserver - if supported - to detect if focused node is removed
    // from the DOM.
    var mutationObserver = typeof window !== 'undefined' && 'MutationObserver' in window ? new MutationObserver(checkDomRemoval) : undefined;
    var updateObservedNodes = function updateObservedNodes() {
      if (!mutationObserver) {
        return;
      }
      mutationObserver.disconnect();
      if (state.active && !state.paused) {
        state.containers.map(function (container) {
          mutationObserver.observe(container, {
            subtree: true,
            childList: true
          });
        });
      }
    };

    //
    // TRAP DEFINITION
    //

    trap = {
      get active() {
        return state.active;
      },
      get paused() {
        return state.paused;
      },
      activate: function activate(activateOptions) {
        if (state.active) {
          return this;
        }
        var onActivate = getOption(activateOptions, 'onActivate');
        var onPostActivate = getOption(activateOptions, 'onPostActivate');
        var checkCanFocusTrap = getOption(activateOptions, 'checkCanFocusTrap');

        // If a currently-active trap is isolating its subtree, we need to remove
        // that isolation to allow the new trap to find tabbable nodes.
        var preexistingTrap = activeFocusTraps.getActiveTrap(trapStack);
        var revertState = false;
        if (preexistingTrap && !preexistingTrap.paused) {
          var _preexistingTrap$_set;
          // [#1729] method MAY not exist if using `trapStack` option to share stack with older
          //  versions of Focus-trap in the same DOM so use optional chaining here just in case
          //  since this is a trap we may not have created from this instance of the library
          (_preexistingTrap$_set = preexistingTrap._setSubtreeIsolation) === null || _preexistingTrap$_set === void 0 || _preexistingTrap$_set.call(preexistingTrap, false);
          revertState = true;
        }
        try {
          if (!checkCanFocusTrap) {
            updateTabbableNodes();
          }
          state.active = true;
          state.paused = false;
          state.nodeFocusedBeforeActivation = _getActiveElement(doc);
          onActivate === null || onActivate === void 0 || onActivate();
          var finishActivation = /*#__PURE__*/function () {
            var _ref6 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee() {
              return _regenerator().w(function (_context) {
                while (1) switch (_context.n) {
                  case 0:
                    if (checkCanFocusTrap) {
                      updateTabbableNodes();
                    }

                    // NOTE: wait for initial focus node to get focused before we potentially isolate
                    //  the subtrees with aria-hidden while focus is still in some other subtree and
                    //  not yet in the trap, resulting in some browsers (e.g. Chrome) logging to the
                    //  console that they, "Blocked aria-hidden on an element because its descendant
                    //  retained focus..."
                    _context.n = 1;
                    return addListeners();
                  case 1:
                    trap._setSubtreeIsolation(true);
                    updateObservedNodes();
                    onPostActivate === null || onPostActivate === void 0 || onPostActivate();
                  case 2:
                    return _context.a(2);
                }
              }, _callee);
            }));
            return function finishActivation() {
              return _ref6.apply(this, arguments);
            };
          }();
          if (checkCanFocusTrap) {
            checkCanFocusTrap(state.containers.concat()).then(finishActivation, finishActivation);
            return this;
          }
          finishActivation();
        } catch (error) {
          // If our activation throws an exception and the stack hasn't changed,
          // we need to re-enable the prior trap's subtree isolation.
          if (preexistingTrap === activeFocusTraps.getActiveTrap(trapStack) && revertState) {
            var _preexistingTrap$_set2;
            // [#1729] method MAY not exist if using `trapStack` option to share stack with older
            //  versions of Focus-trap in the same DOM so use optional chaining here just in case
            //  since this is a trap we may not have created from this instance of the library
            (_preexistingTrap$_set2 = preexistingTrap._setSubtreeIsolation) === null || _preexistingTrap$_set2 === void 0 || _preexistingTrap$_set2.call(preexistingTrap, true);
          }
          throw error;
        }
        return this;
      },
      deactivate: function deactivate(deactivateOptions) {
        if (!state.active) {
          return this;
        }
        var options = _objectSpread2({
          onDeactivate: config.onDeactivate,
          onPostDeactivate: config.onPostDeactivate,
          checkCanReturnFocus: config.checkCanReturnFocus
        }, deactivateOptions);
        clearTimeout(state.delayInitialFocusTimer); // noop if undefined
        state.delayInitialFocusTimer = undefined;

        // Prior to removing this trap from the trapStack, we need to remove any applications of `inert`.
        // This allows the next trap down to update its tabbable nodes properly.
        //
        // If this trap is not top of the stack, don't change any current isolation.
        if (!state.paused) {
          trap._setSubtreeIsolation(false);
        }
        state.alreadySilent.clear();
        removeListeners();
        state.active = false;
        state.paused = false;
        updateObservedNodes();
        activeFocusTraps.deactivateTrap(trapStack, trap);
        var onDeactivate = getOption(options, 'onDeactivate');
        var onPostDeactivate = getOption(options, 'onPostDeactivate');
        var checkCanReturnFocus = getOption(options, 'checkCanReturnFocus');
        var returnFocus = getOption(options, 'returnFocus', 'returnFocusOnDeactivate');
        onDeactivate === null || onDeactivate === void 0 || onDeactivate();
        var finishDeactivation = function finishDeactivation() {
          delay(function () {
            if (returnFocus) {
              _tryFocus(getReturnFocusNode(state.nodeFocusedBeforeActivation));
            }
            onPostDeactivate === null || onPostDeactivate === void 0 || onPostDeactivate();
          });
        };
        if (returnFocus && checkCanReturnFocus) {
          checkCanReturnFocus(getReturnFocusNode(state.nodeFocusedBeforeActivation)).then(finishDeactivation, finishDeactivation);
          return this;
        }
        finishDeactivation();
        return this;
      },
      pause: function pause(pauseOptions) {
        if (!state.active) {
          return this;
        }
        state.manuallyPaused = true;
        return this._setPausedState(true, pauseOptions);
      },
      unpause: function unpause(unpauseOptions) {
        if (!state.active) {
          return this;
        }
        state.manuallyPaused = false;
        if (trapStack[trapStack.length - 1] !== this) {
          return this;
        }
        return this._setPausedState(false, unpauseOptions);
      },
      updateContainerElements: function updateContainerElements(containerElements) {
        var elementsAsArray = [].concat(containerElements).filter(Boolean);
        state.containers = elementsAsArray.map(function (element) {
          return typeof element === 'string' ? doc.querySelector(element) : element;
        });
        if (config.isolateSubtrees) {
          collectAdjacentElements(state.containers);
        }
        if (state.active) {
          updateTabbableNodes();
          if (!state.paused) {
            trap._setSubtreeIsolation(true);
          }
        }
        updateObservedNodes();
        return this;
      }
    };
    Object.defineProperties(trap, {
      _isManuallyPaused: {
        value: function value() {
          return state.manuallyPaused;
        }
      },
      _setPausedState: {
        value: function value(paused, options) {
          if (state.paused === paused) {
            return this;
          }
          state.paused = paused;
          if (paused) {
            var onPause = getOption(options, 'onPause');
            var onPostPause = getOption(options, 'onPostPause');
            onPause === null || onPause === void 0 || onPause();
            removeListeners();
            trap._setSubtreeIsolation(false);
            updateObservedNodes();
            onPostPause === null || onPostPause === void 0 || onPostPause();
          } else {
            var onUnpause = getOption(options, 'onUnpause');
            var onPostUnpause = getOption(options, 'onPostUnpause');
            onUnpause === null || onUnpause === void 0 || onUnpause();
            var finishUnpause = /*#__PURE__*/function () {
              var _ref7 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2() {
                return _regenerator().w(function (_context2) {
                  while (1) switch (_context2.n) {
                    case 0:
                      updateTabbableNodes();

                      // NOTE: wait for initial focus node to get focused before we potentially isolate
                      //  the subtrees with aria-hidden while focus is still in some other subtree and
                      //  not yet in the trap, resulting in some browsers (e.g. Chrome) logging to the
                      //  console that they, "Blocked aria-hidden on an element because its descendant
                      //  retained focus..."
                      _context2.n = 1;
                      return addListeners();
                    case 1:
                      trap._setSubtreeIsolation(true);
                      updateObservedNodes();
                      onPostUnpause === null || onPostUnpause === void 0 || onPostUnpause();
                    case 2:
                      return _context2.a(2);
                  }
                }, _callee2);
              }));
              return function finishUnpause() {
                return _ref7.apply(this, arguments);
              };
            }();
            finishUnpause();
          }
          return this;
        }
      },
      _setSubtreeIsolation: {
        value: function value(isEnabled) {
          if (config.isolateSubtrees) {
            state.adjacentElements.forEach(function (el) {
              var _el$getAttribute;
              if (isEnabled) {
                switch (config.isolateSubtrees) {
                  case 'aria-hidden':
                    // check both attribute and property to ensure initial state is captured
                    // correctly across different browsers and test environments (like JSDOM)
                    if (el.ariaHidden === 'true' || ((_el$getAttribute = el.getAttribute('aria-hidden')) === null || _el$getAttribute === void 0 ? void 0 : _el$getAttribute.toLowerCase()) === 'true') {
                      state.alreadySilent.add(el);
                    }
                    el.setAttribute('aria-hidden', 'true');
                    break;
                  default:
                    // check both attribute and property to ensure initial state is captured
                    // correctly across different browsers and test environments (like JSDOM)
                    if (el.inert || el.hasAttribute('inert')) {
                      state.alreadySilent.add(el);
                    }
                    el.setAttribute('inert', true);
                    break;
                }
              } else {
                if (state.alreadySilent.has(el)) ; else {
                  switch (config.isolateSubtrees) {
                    case 'aria-hidden':
                      el.removeAttribute('aria-hidden');
                      break;
                    default:
                      el.removeAttribute('inert');
                      break;
                  }
                }
              }
            });
          }
        }
      }
    });

    // initialize container elements
    trap.updateContainerElements(elements);
    return trap;
  };

  exports.createFocusTrap = createFocusTrap;

}));
//# sourceMappingURL=focus-trap.umd.js.map
