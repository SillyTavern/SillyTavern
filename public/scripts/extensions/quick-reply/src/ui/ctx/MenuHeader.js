import { MenuItem } from './MenuItem.js';

export class MenuHeader extends MenuItem {
    constructor(/**@type {String}*/label) {
        super(label, null, null);
    }


    render() {
        if (!this.root) {
            const item = document.createElement('li'); {
                this.root = item;
                item.classList.add('list-group-item');
                item.classList.add('ctx-header');
                item.append(this.label);
            }
        }
        return this.root;
    }
}
