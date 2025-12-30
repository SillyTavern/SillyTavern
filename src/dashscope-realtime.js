import WebSocket from 'ws';

/**
 * DashScope Realtime TTS Client for Voice Design and Voice Clone
 * Implements WebSocket-based synthesis similar to Python SDK's QwenTtsRealtime
 * 
 * Protocol reference:
 * - Connection: wss://dashscope.aliyuncs.com/api-ws/v1/realtime
 * - Model: qwen3-tts-vd-realtime-2025-12-16 (VD) or qwen3-tts-vc-realtime-2025-11-27 (VC)
 * - Audio format: PCM 24kHz 16-bit mono
 */

class DashScopeRealtimeTTS {
    constructor(apiKey, model, voiceId) {
        this.apiKey = apiKey;
        this.model = model;
        this.voiceId = voiceId;
        this.ws = null;
        this.audioChunks = [];
        this.sessionId = null;
        this.completed = false;
        this.error = null;
    }

    /**
     * Connect to DashScope Realtime WebSocket API
     */
    async connect(url = 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime') {
        return new Promise((resolve, reject) => {
            const wsUrl = `${url}?model=${encodeURIComponent(this.model)}&api_key=${encodeURIComponent(this.apiKey)}`;
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.on('open', () => {
                console.debug('[DashScope-RT] WebSocket connection established');
                resolve();
            });
            
            this.ws.on('message', (data) => {
                this.handleMessage(data);
            });
            
            this.ws.on('error', (error) => {
                console.error('[DashScope-RT] WebSocket error:', error);
                this.error = error;
                reject(error);
            });
            
            this.ws.on('close', (code, reason) => {
                console.debug(`[DashScope-RT] WebSocket closed: code=${code}, reason=${reason}`);
            });
        });
    }

    /**
     * Handle WebSocket messages
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            const eventType = message.type;
            
            switch (eventType) {
                case 'session.created':
                    this.sessionId = message.session?.id;
                    console.debug(`[DashScope-RT] Session created: ${this.sessionId}`);
                    break;
                    
                case 'session.updated':
                    console.debug('[DashScope-RT] Session updated');
                    break;
                    
                case 'input_text_buffer.committed':
                    console.debug('[DashScope-RT] Text buffer committed');
                    break;
                    
                case 'response.created':
                    console.debug('[DashScope-RT] Response created');
                    break;
                    
                case 'response.output_item.added':
                    console.debug('[DashScope-RT] Output item added');
                    break;
                    
                case 'response.content_part.added':
                    console.debug('[DashScope-RT] Content part added');
                    break;
                    
                case 'response.audio.delta':
                    // Audio chunk received (base64 encoded)
                    if (message.delta) {
                        const audioBuffer = Buffer.from(message.delta, 'base64');
                        this.audioChunks.push(audioBuffer);
                        console.debug(`[DashScope-RT] Received audio chunk: ${audioBuffer.length} bytes`);
                    }
                    break;
                    
                case 'response.audio.done':
                    console.debug('[DashScope-RT] Audio stream completed');
                    break;
                    
                case 'response.content_part.done':
                    console.debug('[DashScope-RT] Content part completed');
                    break;
                    
                case 'response.output_item.done':
                    console.debug('[DashScope-RT] Output item completed');
                    break;
                    
                case 'response.done':
                    console.debug('[DashScope-RT] Response completed');
                    this.completed = true;
                    break;
                    
                case 'session.finished':
                    console.debug('[DashScope-RT] Session finished');
                    this.completed = true;
                    break;
                    
                case 'error':
                    console.error('[DashScope-RT] Error event:', message);
                    this.error = new Error(message.error?.message || 'Unknown error');
                    this.completed = true;
                    break;
                    
                default:
                    console.debug(`[DashScope-RT] Unknown event type: ${eventType}`);
            }
        } catch (err) {
            console.error('[DashScope-RT] Failed to parse message:', err);
        }
    }

    /**
     * Update session with voice and audio format
     */
    updateSession() {
        const message = {
            type: 'session.update',
            session: {
                voice: this.voiceId,
                response_format: 'pcm', // DashScope supports: mp3, wav, pcm, opus
                mode: 'server_commit',
            },
        };
        
        console.debug('[DashScope-RT] Updating session with voice:', this.voiceId);
        this.ws.send(JSON.stringify(message));
    }

    /**
     * Send text for synthesis
     */
    appendText(text) {
        const message = {
            type: 'input_text_buffer.append',
            text: text,
        };
        
        console.debug('[DashScope-RT] Sending text:', text);
        this.ws.send(JSON.stringify(message));
    }

    /**
     * Commit text buffer to trigger synthesis
     */
    commitTextBuffer() {
        const message = {
            type: 'input_text_buffer.commit',
        };
        
        console.debug('[DashScope-RT] Committing text buffer');
        this.ws.send(JSON.stringify(message));
    }

    /**
     * Finish synthesis and wait for audio
     */
    async finish() {
        // In server_commit mode, we don't need to manually commit
        // Just wait for all audio chunks to arrive
        console.debug('[DashScope-RT] Waiting for synthesis to complete');
        
        // Wait for completion or error
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.close();
                reject(new Error('Synthesis timeout'));
            }, 30000); // 30 second timeout
            
            const checkCompletion = setInterval(() => {
                if (this.completed) {
                    clearInterval(checkCompletion);
                    clearTimeout(timeout);
                    
                    if (this.error) {
                        reject(this.error);
                    } else {
                        resolve(Buffer.concat(this.audioChunks));
                    }
                    
                    this.close();
                }
            }, 100);
        });
    }

    /**
     * Close WebSocket connection
     */
    close() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }
    }

    /**
     * Synthesize text to audio (all-in-one method)
     */
    async synthesize(text, url) {
        try {
            await this.connect(url);
            this.updateSession();
            
            // Small delay to ensure session update is processed
            await new Promise(resolve => setTimeout(resolve, 100));
            
            this.appendText(text);
            
            // Commit text buffer to trigger synthesis (for commit mode)
            // For server_commit mode, this is automatic, but doesn't hurt
            await new Promise(resolve => setTimeout(resolve, 50));
            this.commitTextBuffer();
            
            const audioBuffer = await this.finish();
            
            return audioBuffer;
        } catch (error) {
            console.error('[DashScope-RT] Synthesis failed:', error);
            this.close();
            throw error;
        }
    }
}

/**
 * Convert PCM audio buffer to WAV format
 */
function pcmToWav(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = pcmBuffer.length;
    
    // WAV header (44 bytes)
    const wavHeader = Buffer.alloc(44);
    
    // RIFF chunk descriptor
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36 + dataSize, 4);
    wavHeader.write('WAVE', 8);
    
    // fmt sub-chunk
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    wavHeader.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
    wavHeader.writeUInt16LE(numChannels, 22);
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE(byteRate, 28);
    wavHeader.writeUInt16LE(blockAlign, 32);
    wavHeader.writeUInt16LE(bitsPerSample, 34);
    
    // data sub-chunk
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(dataSize, 40);
    
    return Buffer.concat([wavHeader, pcmBuffer]);
}

export { DashScopeRealtimeTTS, pcmToWav };
