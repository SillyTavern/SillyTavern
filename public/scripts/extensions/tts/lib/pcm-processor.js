class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = new Float32Array(24000 * 30); // Pre-allocate buffer for ~30 seconds at 24kHz
        this.writeIndex = 0;
        this.readIndex = 0;
        this.pendingBytes = new Uint8Array(0); // Buffer for incomplete samples
        this.volume = 1.0; // Default volume (1.0 = 100%, 0.5 = 50%, etc.)
        this.port.onmessage = (event) => {
            if (event.data.pcmData) {
                // Combine any pending bytes with new data
                const newData = new Uint8Array(event.data.pcmData);
                const combined = new Uint8Array(this.pendingBytes.length + newData.length);
                combined.set(this.pendingBytes);
                combined.set(newData, this.pendingBytes.length);
                
                // Calculate how many complete 16-bit samples we have
                const completeSamples = Math.floor(combined.length / 2);
                const bytesToProcess = completeSamples * 2;
                
                if (completeSamples > 0) {
                    // Process complete samples
                    const int16Array = new Int16Array(combined.buffer.slice(0, bytesToProcess));
                    
                    // Write directly to circular buffer
                    for (let i = 0; i < int16Array.length; i++) {
                        // Expand buffer if needed
                        if (this.writeIndex >= this.buffer.length) {
                            const newBuffer = new Float32Array(this.buffer.length * 2);
                            // Copy existing data maintaining order
                            let sourceIndex = this.readIndex;
                            let targetIndex = 0;
                            while (sourceIndex !== this.writeIndex) {
                                newBuffer[targetIndex++] = this.buffer[sourceIndex];
                                sourceIndex = (sourceIndex + 1) % this.buffer.length;
                            }
                            this.buffer = newBuffer;
                            this.readIndex = 0;
                            this.writeIndex = targetIndex;
                        }
                        
                        this.buffer[this.writeIndex] = int16Array[i] / 32768.0; // Convert 16-bit to float
                        this.writeIndex = (this.writeIndex + 1) % this.buffer.length;
                    }
                }
                
                // Store any remaining incomplete bytes
                if (combined.length > bytesToProcess) {
                    this.pendingBytes = combined.slice(bytesToProcess);
                } else {
                    this.pendingBytes = new Uint8Array(0);
                }
            } else if (event.data.volume !== undefined) {
                // Set volume (0.0 to 1.0, can go higher for amplification)
                this.volume = Math.max(0, event.data.volume);
            }
        };
    }
    
    process(inputs, outputs, parameters) {
        const output = outputs[0];
        if (output.length > 0 && this.readIndex !== this.writeIndex) {
            const channelData = output[0];
            for (let i = 0; i < channelData.length && this.readIndex !== this.writeIndex; i++) {
                channelData[i] = this.buffer[this.readIndex] * this.volume;
                this.readIndex = (this.readIndex + 1) % this.buffer.length;
            }
        }
        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);
