const TASK = 'text-classification';

/**
 * @param {import("express").Express} app
 * @param {any} jsonParser
 */
function registerEndpoints(app, jsonParser) {
    const cacheObject = {};

    app.post('/api/extra/classify/labels', jsonParser, async (req, res) => {
        try {
            const module = await import('./transformers.mjs');
            const pipe = await module.default.getPipeline(TASK);
            const result = Object.keys(pipe.model.config.label2id);
            return res.json({ labels: result });
        } catch (error) {
            console.error(error);
            return res.sendStatus(500);
        }
    });

    app.post('/api/extra/classify', jsonParser, async (req, res) => {
        try {
            const { text } = req.body;

            async function getResult(text) {
                if (cacheObject.hasOwnProperty(text)) {
                    return cacheObject[text];
                } else {
                    const module = await import('./transformers.mjs');
                    const pipe = await module.default.getPipeline(TASK);
                    const result = await pipe(text, { topk: 5 });
                    result.sort((a, b) => b.score - a.score);
                    cacheObject[text] = result;
                    return result;
                }
            }

            console.log('Classify input:', text);
            const result = await getResult(text);
            console.log('Classify output:', result);

            return res.json({ classification: result });
        } catch (error) {
            console.error(error);
            return res.sendStatus(500);
        }
    });
}

module.exports = {
    registerEndpoints,
};
