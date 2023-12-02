import { SubMenu } from './SubMenu.js';

export class MenuItem {
    /**@type {String}*/ label;
    /**@type {Object}*/ value;
    /**@type {Function}*/ callback;
    /**@type {MenuItem[]}*/ childList = [];
    /**@type {SubMenu}*/ subMenu;
    /**@type {Boolean}*/ isForceExpanded = false;

    /**@type {HTMLElement}*/ root;

    /**@type {Function}*/ onExpand;




    constructor(/**@type {String}*/label, /**@type {Object}*/value, /**@type {function}*/callback, /**@type {MenuItem[]}*/children = []) {
        this.label = label;
        this.value = value;
        this.callback = callback;
        this.childList = children;
    }


    render() {
        if (!this.root) {
            const item = document.createElement('li'); {
                this.root = item;
                item.classList.add('list-group-item');
                item.classList.add('ctx-item');
                item.title = this.value;
                if (this.callback) {
                    item.addEventListener('click', (evt) => this.callback(evt, this));
                }
                item.append(this.label);
                if (this.childList.length > 0) {
                    item.classList.add('ctx-has-children');
                    const sub = new SubMenu(this.childList);
                    this.subMenu = sub;
                    const trigger = document.createElement('div'); {
                        trigger.classList.add('ctx-expander');
                        trigger.textContent = '⋮';
                        trigger.addEventListener('click', (evt) => {
                            evt.stopPropagation();
                            this.toggle();
                        });
                        item.append(trigger);
                    }
                    item.addEventListener('mouseover', () => sub.show(item));
                    item.addEventListener('mouseleave', () => sub.hide());

                }
            }
        }
        return this.root;
    }


    expand() {
        this.subMenu?.show(this.root);
        if (this.onExpand) {
            this.onExpand();
        }
    }
    collapse() {
        this.subMenu?.hide();
    }
    toggle() {
        if (this.subMenu.isActive) {
            this.expand();
        } else {
            this.collapse();
        }
    }
}
