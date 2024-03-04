import { QuickReply } from '../../QuickReply.js';
// eslint-disable-next-line no-unused-vars
import { QuickReplySet } from '../../QuickReplySet.js';
import { MenuHeader } from './MenuHeader.js';
import { MenuItem } from './MenuItem.js';

export class ContextMenu {
    /**@type {MenuItem[]}*/ itemList = [];
    /**@type {Boolean}*/ isActive = false;

    /**@type {HTMLElement}*/ root;
    /**@type {HTMLElement}*/ menu;




    constructor(/**@type {QuickReply}*/qr) {
        // this.itemList = items;
        this.itemList = this.build(qr).children;
        this.itemList.forEach(item => {
            item.onExpand = () => {
                this.itemList.filter(it => it != item)
                    .forEach(it => it.collapse());
            };
        });
    }

    /**
     * @param {QuickReply} qr
     * @param {String} chainedMessage
     * @param {QuickReplySet[]} hierarchy
     * @param {String[]} labelHierarchy
     */
    build(qr, chainedMessage = null, hierarchy = [], labelHierarchy = []) {
        const tree = {
            label: qr.label,
            message: (chainedMessage && qr.message ? `${chainedMessage} | ` : '') + qr.message,
            children: [],
        };
        qr.contextList.forEach((cl) => {
            if (!hierarchy.includes(cl.set)) {
                const nextHierarchy = [...hierarchy, cl.set];
                const nextLabelHierarchy = [...labelHierarchy, tree.label];
                tree.children.push(new MenuHeader(cl.set.name));
                cl.set.qrList.forEach(subQr => {
                    const subTree = this.build(subQr, cl.isChained ? tree.message : null, nextHierarchy, nextLabelHierarchy);
                    tree.children.push(new MenuItem(
                        subTree.label,
                        subTree.message,
                        (evt) => {
                            evt.stopPropagation();
                            const finalQr = Object.assign(new QuickReply(), subQr);
                            finalQr.message = subTree.message.replace(/%%parent(-\d+)?%%/g, (_, index) => {
                                return nextLabelHierarchy.slice(parseInt(index ?? '-1'))[0];
                            });
                            cl.set.execute(finalQr);
                        },
                        subTree.children,
                    ));
                });
            }
        });
        return tree;
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
