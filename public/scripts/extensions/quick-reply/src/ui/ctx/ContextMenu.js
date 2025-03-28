import { QuickReply } from '../../QuickReply.js';
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
                this.itemList.filter(it => it !== item)
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
            icon: qr.icon,
            showLabel: qr.showLabel,
            label: qr.label,
            title: qr.title,
            message: (chainedMessage && qr.message ? `${chainedMessage} | ` : '') + qr.message,
            children: [],
        };
        qr.contextList.forEach((cl) => {
            if (!cl.set) return;
            if (!hierarchy.includes(cl.set)) {
                const nextHierarchy = [...hierarchy, cl.set];
                const nextLabelHierarchy = [...labelHierarchy, tree.label];
                tree.children.push(new MenuHeader(cl.set.name));

                // If the Quick Reply's own set is added as a context menu,
                // show only the sub-QRs that are Invisible but have an icon
                // intent: allow a QR set to be assigned to one of its own QR buttons for a "burger" menu
                // with "UI" QRs either in the bar or in the menu, and "library function" QRs still hidden.
                // - QRs already visible on the bar are filtered out,
                // - hidden QRs without an icon are filtered out,
                // - hidden QRs **with an icon** are shown in the menu
                // so everybody is happy
                const qrsOwnSetAddedAsContextMenu = cl.set.qrList.includes(qr);
                const visible = (subQr) => {
                    return qrsOwnSetAddedAsContextMenu
                        ? subQr.isHidden && !!subQr.icon  // yes .isHidden gets inverted here
                        : !subQr.isHidden;
                };

                cl.set.qrList.filter(visible).forEach(subQr => {
                    const subTree = this.build(subQr, cl.isChained ? tree.message : null, nextHierarchy, nextLabelHierarchy);
                    tree.children.push(new MenuItem(
                        subTree.icon,
                        subTree.showLabel,
                        subTree.label,
                        subTree.title,
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
