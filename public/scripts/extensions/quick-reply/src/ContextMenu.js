/**
 * @typedef {import('./MenuItem.js').MenuItem} MenuItem
 */

export class ContextMenu {
    /**@type {MenuItem[]}*/ itemList = [];
    /**@type {Boolean}*/ isActive = false;

    /**@type {HTMLElement}*/ root;
    /**@type {HTMLElement}*/ menu;




    constructor(/**@type {MenuItem[]}*/items) {
        this.itemList = items;
        items.forEach(item => {
            item.onExpand = () => {
                items.filter(it => it != item)
                    .forEach(it => it.collapse());
            };
        });
    }

    render() {
        if (!this.root) {
            const blocker = document.createElement('div'); {
                this.root = blocker;
                blocker.classList.add('ctx-blocker');
                blocker.addEventListener('click', () => this.hide());
                const menu = document.createElement('ul'); {
                    this.menu = menu;
                    menu.classList.add('list-group');
                    menu.classList.add('ctx-menu');
                    this.itemList.forEach(it => menu.append(it.render()));
                    blocker.append(menu);
                }
            }
        }
        return this.root;
    }




    show({ clientX, clientY }) {
        if (this.isActive) return;
        this.isActive = true;
        this.render();
        this.menu.style.bottom = `${window.innerHeight - clientY}px`;
        this.menu.style.left = `${clientX}px`;
        document.body.append(this.root);
    }
    hide() {
        if (this.root) {
            this.root.remove();
        }
        this.isActive = false;
    }
    toggle(/**@type {PointerEvent}*/evt) {
        if (this.isActive) {
            this.hide();
        } else {
            this.show(evt);
        }
    }
}
