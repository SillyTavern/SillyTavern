import { SubMenu } from "./SubMenu.js";

export class MenuHeader {
	/**@type {String}*/ label;

	/**@type {HTMLElement}*/ root;




	constructor(/**@type {String}*/label) {
		this.label = label;
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