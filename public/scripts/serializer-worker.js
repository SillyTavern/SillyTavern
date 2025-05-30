self.onmessage = function(e) {
    const { task, data } = e.data;
    let result = null;
    let error = null;

    try {
        if (task === 'stringify') {
            result = JSON.stringify(data);
        } else {
            throw new Error('Unknown task: ' + task);
        }
    } catch (err) {
        error = err.toString();
    }
    self.postMessage({ task, result, error });
};
