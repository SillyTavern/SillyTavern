import { SubMenu } from "./SubMenu.js";

export class MenuItem {
	/**@type {String}*/ label;
	/**@type {Object}*/ value;
	/**@type {Function}*/ callback;
	/**@type {MenuItem[]}*/ childList = [];

	/**@type {HTMLElement}*/ root;




	constructor(/**@type {String}*/label, /**@type {Object}*/value, /**@type {function}*/callback, /**@type {MenuItem[]}*/children=[]) {
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
					item.addEventListener('click', (evt)=>this.callback(evt, this));
				}
				if (this.childList.length > 0) {
					item.classList.add('ctx-has-children');
					const sub = new SubMenu(this.childList);
					item.addEventListener('pointerover', ()=>sub.show(item));
					item.addEventListener('pointerleave', ()=>sub.hide());
				}
				item.append(this.label);
			}
		}
		return this.root;
	}
}