import { getSortableDelay } from '../../../utils.js';
import { QuickReplySetLink } from './QuickReplySetLink.js';
import { QuickReplySet } from './QuickReplySet.js';

export class QuickReplyConfig {
    /**@type {QuickReplySetLink[]}*/ setList = [];
    /**@type {Boolean}*/ isGlobal;

    /**@type {Function}*/ onUpdate;
    /**@type {Function}*/ onRequestEditSet;

    /**@type {HTMLElement}*/ dom;
    /**@type {HTMLElement}*/ setListDom;




    static from(props) {
        props.setList = props.setList?.map(it=>QuickReplySetLink.from(it))?.filter(it=>it.set) ?? [];
        const instance = Object.assign(new this(), props);
        instance.init();
        return instance;
    }




    init() {
        this.setList.forEach(it=>this.hookQuickReplyLink(it));
    }




    renderSettingsInto(/**@type {HTMLElement}*/root) {
        /**@type {HTMLElement}*/
        const setList = root.querySelector('.qr--setList');
        this.setListDom = setList;
        setList.innerHTML = '';
        root.querySelector('.qr--setListAdd').addEventListener('click', ()=>{
            const qrl = new QuickReplySetLink();
            qrl.set = QuickReplySet.list[0];
            this.hookQuickReplyLink(qrl);
            this.setList.push(qrl);
            setList.append(qrl.renderSettings(this.setList.length - 1));
            this.update();
        });
        // @ts-ignore
        $(setList).sortable({
            delay: getSortableDelay(),
            stop: ()=>this.onSetListSort(),
        });
        this.setList.filter(it=>!it.set.isDeleted).forEach((qrl,idx)=>setList.append(qrl.renderSettings(idx)));
    }


    onSetListSort() {
        this.setList = Array.from(this.setListDom.children).map((it,idx)=>{
            const qrl = this.setList[Number(it.getAttribute('data-order'))];
            qrl.index = idx;
            it.setAttribute('data-order', String(idx));
            return qrl;
        });
        this.update();
    }




    /**
     * @param {QuickReplySetLink} qrl
     */
    hookQuickReplyLink(qrl) {
        qrl.onDelete = ()=>this.deleteQuickReplyLink(qrl);
        qrl.onUpdate = ()=>this.update();
        qrl.onRequestEditSet = ()=>this.requestEditSet(qrl.set);
    }

    deleteQuickReplyLink(qrl) {
        this.setList.splice(this.setList.indexOf(qrl), 1);
        this.update();
    }

    update() {
        if (this.onUpdate) {
            this.onUpdate(this);
        }
    }

    requestEditSet(qrs) {
        if (this.onRequestEditSet) {
            this.onRequestEditSet(qrs);
        }
    }

    toJSON() {
        return {
            setList: this.setList,
        };
    }
}
