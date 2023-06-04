const MsEdgeTTS = require('msedge-tts').MsEdgeTTS;

const tts = new MsEdgeTTS(true);

function getVoices() {
    return tts.getVoices();
}

async function generateSpeech(text, voice) {
    await tts.setMetadata(voice, MsEdgeTTS.OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    return new Promise((resolve, reject) => {
        const readable = tts.toStream(text);
        const chunks = [];

        readable.on("data", (data) => {
            chunks.push(data);
        });

        readable.on("close", () => {
            const buffer = Buffer.concat(chunks);
            resolve(buffer);
        });

        readable.on("error", (err) => {
            reject(err);
        });
    });
}

function addEdgeTtsEndpoints(app, jsonParser) {
    app.get("/edge_voices", jsonParser, async (req, res) => {
        const voices = await getVoices();
        return res.send(voices);
    });
    app.post("/edge_speech", jsonParser, async (req, res) => {
        const { text, voice } = req.body;

        if (!text || !voice) {
            return res.sendStatus(400);
        }

        const buffer = await generateSpeech(text, voice);
        res.set("Content-Type", "audio/mpeg");
        return res.send(buffer);
    });
}

module.exports = { addEdgeTtsEndpoints };
