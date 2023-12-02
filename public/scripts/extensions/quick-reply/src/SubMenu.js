/**
 * @typedef {import('./MenuItem.js').MenuItem} MenuItem
 */

export class SubMenu {
    /**@type {MenuItem[]}*/ itemList = [];
    /**@type {Boolean}*/ isActive = false;

    /**@type {HTMLElement}*/ root;




    constructor(/**@type {MenuItem[]}*/items) {
        this.itemList = items;
    }

    render() {
        if (!this.root) {
            const menu = document.createElement('ul'); {
                this.root = menu;
                menu.classList.add('list-group');
                menu.classList.add('ctx-menu');
                menu.classList.add('ctx-sub-menu');
                this.itemList.forEach(it => menu.append(it.render()));
            }
        }
        return this.root;
    }




    show(/**@type {HTMLElement}*/parent) {
        if (this.isActive) return;
        this.isActive = true;
        this.render();
        parent.append(this.root);
        requestAnimationFrame(() => {
            const rect = this.root.getBoundingClientRect();
            console.log(window.innerHeight, rect);
            if (rect.bottom > window.innerHeight - 5) {
                this.root.style.top = `${window.innerHeight - 5 - rect.bottom}px`;
            }
            if (rect.right > window.innerWidth - 5) {
                this.root.style.left = 'unset';
                this.root.style.right = '100%';
            }
        });
    }
    hide() {
        if (this.root) {
            this.root.remove();
            this.root.style.top = '';
            this.root.style.left = '';
        }
        this.isActive = false;
    }
    toggle(/**@type {HTMLElement}*/parent) {
        if (this.isActive) {
            this.hide();
        } else {
            this.show(parent);
        }
    }
}
