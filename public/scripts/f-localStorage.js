////////////////// LOCAL STORAGE HANDLING /////////////////////

/**
 * @deprecated THIS FUNCTION IS OBSOLETE. DO NOT USE
 */
export function SaveLocal(target, val) {
    localStorage.setItem(target, val);
    console.debug('SaveLocal -- ' + target + ' : ' + val);
}
/**
 * @deprecated THIS FUNCTION IS OBSOLETE. DO NOT USE
 */
export function LoadLocal(target) {
    console.debug('LoadLocal -- ' + target);
    return localStorage.getItem(target);

}
/**
 * @deprecated THIS FUNCTION IS OBSOLETE. DO NOT USE
 */
export function LoadLocalBool(target) {
    let result = localStorage.getItem(target) === 'true';
    return result;
}
/**
 * @deprecated THIS FUNCTION IS OBSOLETE. DO NOT USE
 */
export function CheckLocal() {
    console.log('----------local storage---------');
    var i;
    for (i = 0; i < localStorage.length; i++) {
        console.log(localStorage.key(i) + ' : ' + localStorage.getItem(localStorage.key(i)));
    }
    console.log('------------------------------');
}

/**
 * @deprecated THIS FUNCTION IS OBSOLETE. DO NOT USE
 */
export function ClearLocal() { localStorage.clear(); console.log('Removed All Local Storage'); }

/////////////////////////////////////////////////////////////////////////
