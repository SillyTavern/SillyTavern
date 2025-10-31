import { Buffer } from 'node:buffer';
import express from 'express';
import wavefile from 'wavefile';
import fetch from 'node-fetch';
import { getPipeline } from '../transformers.js';
import { forwardFetchResponse } from '../util.js';

export const router = express.Router();

/**
 * Gets the audio data from a base64-encoded audio file.
 * @param {string} audio Base64-encoded audio
 * @returns {Float64Array} Audio data
 */
function getWaveFile(audio) {
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

router.post('/recognize', async (req, res) => {
    try {
        const TASK = 'automatic-speech-recognition';
        const { model, audio, lang } = req.body;
        const pipe = await getPipeline(TASK, model);
        const wav = getWaveFile(audio);
        const start = performance.now();
        const result = await pipe(wav, { language: lang || null, task: 'transcribe' });
        const end = performance.now();
        console.info(`Execution duration: ${(end - start) / 1000} seconds`);
        console.info('Transcribed audio:', result.text);

        return res.json({ text: result.text });
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

router.post('/synthesize', async (req, res) => {
    try {
        const TASK = 'text-to-speech';
        const { text, model, speaker } = req.body;
        const pipe = await getPipeline(TASK, model);
        const speaker_embeddings = speaker
            ? new Float32Array(new Uint8Array(Buffer.from(speaker.startsWith('data:') ? speaker.split(',')[1] : speaker, 'base64')).buffer)
            : null;
        const start = performance.now();
        const result = await pipe(text, { speaker_embeddings: speaker_embeddings });
        const end = performance.now();
        console.debug(`Execution duration: ${(end - start) / 1000} seconds`);

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

const pollinations = express.Router();

pollinations.post('/voices', async (req, res) => {
    try {
        const model = req.body.model || 'openai-audio';

        const response = await fetch('https://text.pollinations.ai/models');

        if (!response.ok) {
            throw new Error('Failed to fetch Pollinations models');
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error('Invalid data format received from Pollinations');
        }

        const audioModelData = data.find(m => m.name === model);
        if (!audioModelData || !Array.isArray(audioModelData.voices)) {
            throw new Error('No voices found for the specified model');
        }

        const voices = audioModelData.voices;
        return res.json(voices);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

pollinations.post('/generate', async (req, res) => {
    try {
        const text = req.body.text;
        const model = req.body.model || 'openai-audio';
        const voice = req.body.voice || 'alloy';

        const url = new URL(`https://text.pollinations.ai/generate/${encodeURIComponent(text)}`);
        url.searchParams.append('model', model);
        url.searchParams.append('voice', voice);
        url.searchParams.append('referrer', 'sillytavern');
        console.info('Pollinations request URL:', url.toString());

        const response = await fetch(url);

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to generate audio from Pollinations: ${text}`);
        }

        res.set('Content-Type', 'audio/mpeg');
        forwardFetchResponse(response, res);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

router.use('/pollinations', pollinations);
