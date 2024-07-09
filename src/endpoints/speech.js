const express = require('express');
const { jsonParser } = require('../express-common');

const router = express.Router();

/**
 * Gets the audio data from a base64-encoded audio file.
 * @param {string} audio Base64-encoded audio
 * @returns {Float64Array} Audio data
 */
function getWaveFile(audio) {
    const wavefile = require('wavefile');
    const wav = new wavefile.WaveFile();
    wav.fromDataURI(audio);
    wav.toBitDepth('32f');
    wav.toSampleRate(16000);
    let audioData = wav.getSamples();
    if (Array.isArray(audioData)) {
        if (audioData.length > 1) {
            const SCALING_FACTOR = Math.sqrt(2);

            // Merge channels (into first channel to save memory)
            for (let i = 0; i < audioData[0].length; ++i) {
                audioData[0][i] = SCALING_FACTOR * (audioData[0][i] + audioData[1][i]) / 2;
            }
        }

        // Select first channel
        audioData = audioData[0];
    }

    return audioData;
}

router.post('/recognize', jsonParser, async (req, res) => {
    try {
        const TASK = 'automatic-speech-recognition';
        const { model, audio, lang } = req.body;
        const module = await import('../transformers.mjs');
        const pipe = await module.default.getPipeline(TASK, model);
        const wav = getWaveFile(audio);
        const start = performance.now();
        const result = await pipe(wav, { language: lang || null, task: 'transcribe' });
        const end = performance.now();
        console.log(`Execution duration: ${(end - start) / 1000} seconds`);
        console.log('Transcribed audio:', result.text);

        return res.json({ text: result.text });
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

router.post('/synthesize', jsonParser, async (req, res) => {
    try {
        const wavefile = require('wavefile');
        const TASK = 'text-to-speech';
        const { text, model, speaker } = req.body;
        const module = await import('../transformers.mjs');
        const pipe = await module.default.getPipeline(TASK, model);
        const speaker_embeddings = speaker
            ? new Float32Array(new Uint8Array(Buffer.from(speaker.startsWith('data:') ? speaker.split(',')[1] : speaker, 'base64')).buffer)
            : null;
        const start = performance.now();
        const result = await pipe(text, { speaker_embeddings: speaker_embeddings });
        const end = performance.now();
        console.log(`Execution duration: ${(end - start) / 1000} seconds`);

        const wav = new wavefile.WaveFile();
        wav.fromScratch(1, result.sampling_rate, '32f', result.audio);
        const buffer = wav.toBuffer();

        res.set('Content-Type', 'audio/wav');
        return res.send(Buffer.from(buffer));
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

module.exports = { router };
