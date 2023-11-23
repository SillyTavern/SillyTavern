import { MenuItem } from "./MenuItem.js";

export class ContextMenu {
	/**@type {HTMLElement}*/ root;
	/**@type {HTMLElement}*/ menu;

	/**@type {MenuItem[]}*/ itemList = [];




	constructor(/**@type {MenuItem[]}*/items) {
		this.itemList = items;
	}

	render() {
		if (!this.root) {
			const blocker = document.createElement('div'); {
				this.root = blocker;
				blocker.classList.add('ctx-blocker');
				blocker.addEventListener('click', ()=>this.hide());
				const menu = document.createElement('ul'); {
					this.menu = menu;
					menu.classList.add('list-group');
					menu.classList.add('ctx-menu');
					this.itemList.forEach(it=>menu.append(it.render()));
					blocker.append(menu);
				}
			}
		}
		return this.root;
	}




	show({clientX, clientY}) {
		this.render();
		this.menu.style.bottom = `${window.innerHeight - clientY}px`;
		this.menu.style.left = `${clientX}px`;
		document.body.append(this.root);
	}
	hide() {
		this.root.remove();
	}
}