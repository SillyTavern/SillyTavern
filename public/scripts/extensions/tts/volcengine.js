import { saveTtsProviderSettings } from './index.js';

export { VolcengineTtsProvider };

class VolcengineTtsProvider {
    settings;
    audioElement = document.createElement('audio');
    defaultSettings = {
        app_id: '',
        access_key: '',
        resource_id: '',
        voice: '',
        speed: 0,
        provider_endpoint: 'https://openspeech.bytedance.com/api/v3/tts/unidirectional',
    };

    processText(text) {
        return text;
    }

    async previewTtsVoice(_) {
        const text = '你好，很高兴认识你';
        const audio = await this.generateTts(text, this.settings.voice);
        const audioElement = new Audio(URL.createObjectURL(await audio.blob()));
        audioElement.play().catch(e => console.error('Error playing audio:', e));
    }

    async fetchTtsVoiceObjects() {
        return [{
            name: this.settings.voice,
            voice_id: this.settings.voice,
            lang: 'zh-CN',
        }];
    }

    getVolcengineRequestHeaders() {
        return {
            'X-Api-App-Key': this.settings.app_id,
            'X-Api-Access-Key': this.settings.access_key,
            'X-Api-Resource-Id': this.settings.resource_id,
        };
    }

    get settingsHtml() {
        let html = `
            <div>火山引擎(豆包)TTS配置项.</div>
            <small>Hint: 火山引擎(豆包)TTS配置项。</small>
            <small>请参照<a href="https://www.volcengine.com/docs/6561/1598757" target="_blank">文档</a>获取配置项.</small>
            <div>
                <label for="volcengine-tts-app-id">App ID:</label>
                <input type="text" class="text_pole" id="volcengine-tts-app-id">
            </div>
            <div>
                <label for="volcengine-tts-access-key">Access Key:</label>
                <input type="text" class="text_pole" id="volcengine-tts-access-key">
            </div>
            <div>
                <label for="volcengine-tts-resource-id">Resource ID:</label>
                <input type="text" class="text_pole" id="volcengine-tts-resource-id">
            </div>
            <div>
                <label data-i18n="volcengine-tts-voice" for="volcengine-tts-voice">音色(Speaker):</label>
                <input type="text" class="text_pole" id="volcengine-tts-voice">
            </div>
            <div>
                <label for="volcengine-tts-speed">语速: <span id="volcengine-tts-speed-output"></span></label>
                <input type="range" class="text_pole" id="volcengine-tts-speed" value="0" min="-50" max="100" step="1">
            </div>
            <div>
                <label for="volcengine-tts-provider-endpoint">请求URL: </label>
                <input type="text" class="text_pole" id="volcengine-tts-provider-endpoint">
            </div>
        `;
        return html;
    }

    async getVoice(voiceName) {
        return {
            name: voiceName,
            voice_id: voiceName,
            lang: 'zh-CN',
        };
    }

    async onRefreshClick() {
        return await this.checkReady();
    }

    onSettingsChange() {
        // Used when provider settings are updated from UI
        this.settings.app_id = $('#volcengine-tts-app-id').val();
        this.settings.access_key = $('#volcengine-tts-access-key').val();
        this.settings.resource_id = $('#volcengine-tts-resource-id').val();
        this.settings.voice = $('#volcengine-tts-voice').val();
        this.settings.speed = $('#volcengine-tts-speed').val();
        this.settings.provider_endpoint = $('#volcengine-tts-provider-endpoint').val();

        saveTtsProviderSettings();
        this.changeTTSSettings();
    }

    async changeTTSSettings() {
        $('#volcengine-tts-speed-output').text(this.settings.speed);
    }

    async loadSettings(settings) {
        // Populate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info('Using default TTS Provider settings');
        }
        // Only accept keys defined in defaultSettings
        this.settings = { ...this.defaultSettings, ...settings };

        // Set initial values from the settings
        $('#volcengine-tts-app-id').val(this.settings.app_id).on('change', this.onSettingsChange.bind(this));
        $('#volcengine-tts-access-key').val(this.settings.access_key).on('change', this.onSettingsChange.bind(this));
        $('#volcengine-tts-resource-id').val(this.settings.resource_id).on('change', this.onSettingsChange.bind(this));
        $('#volcengine-tts-voice').val(this.settings.voice).on('change', this.onSettingsChange.bind(this));
        $('#volcengine-tts-speed').val(this.settings.speed).on('change', this.onSettingsChange.bind(this));
        $('#volcengine-tts-provider-endpoint').val(this.settings.provider_endpoint).on('change', this.onSettingsChange.bind(this));

        await this.checkReady();

        console.info('ITS: Settings loaded');
    }

    async checkReady() {
        await Promise.allSettled([this.changeTTSSettings()]);
    }

    async generateTts(text, speaker) {
        const response = await this.fetchTtsGeneration(text, speaker);
        return response;
    }

    decodeBase64Audio(base64String) {
        // 如果包含data:前缀，先移除它
        const base64Data = base64String.includes('base64,')
            ? base64String.split('base64,')[1]
            : base64String;

        // 解码Base64字符串
        const binaryString = atob(base64Data);

        // 转换为字节数组
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        return bytes.buffer; // 返回ArrayBuffer
    }

    base64ToUint8Array(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    async processAudioStream(response) {
        let audioData = new Uint8Array();
        let totalAudioSize = 0;

        try {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                // 解码并添加到缓冲区
                buffer += decoder.decode(value, { stream: true });

                // 按行分割并处理
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // 保存最后一行不完整的数据

                for (const line of lines) {
                    if (!line.trim()) {
                        continue;
                    }

                    try {
                        const data = JSON.parse(line);

                        // 处理音频数据块
                        if (data.code === 0 && data.data) {
                            try {
                                // 解码base64音频数据
                                const chunkAudio = this.base64ToUint8Array(data.data);
                                const audioSize = chunkAudio.length;
                                totalAudioSize += audioSize;

                                // 合并音频数据
                                const newAudioData = new Uint8Array(audioData.length + audioSize);
                                newAudioData.set(audioData);
                                newAudioData.set(chunkAudio, audioData.length);
                                audioData = newAudioData;

                                console.log(`收到音频块: ${audioSize} 字节, 总计: ${totalAudioSize} 字节`);
                            } catch (e) {
                                console.error('音频数据解码失败:', e);
                            }
                        }

                        // 处理句子数据
                        else if (data.code === 0 && data.sentence) {
                            console.log('句子数据:', data);
                        }

                        // 处理完成信号
                        else if (data.code === 20000000) {
                            if (data.usage) {
                                console.log('使用情况:', data.usage);
                            }
                            console.log('流式响应完成');
                            break;
                        }

                        // 处理错误
                        else if (data.code > 0) {
                            console.error('错误响应:', data);
                            throw new Error(`服务器返回错误: ${data.code}`);
                        }

                    } catch (error) {
                        console.error('JSON解析失败:', error, '原始行:', line);
                    }
                }
            }
            console.log(`音频数据处理完成，总大小: ${totalAudioSize} 字节`);
            return audioData;

        } catch (error) {
            console.error('处理流式响应失败:', error);
            throw error;
        }
    }

    async fetchTtsGeneration(text, voice_speaker) {
        console.info(`Generating new TTS for voice_id ${voice_speaker}`);
        const response = await fetch(`${this.settings.provider_endpoint}`, {
            method: 'POST',
            headers: this.getVolcengineRequestHeaders(),
            body: JSON.stringify({
                'req_params': {
                    'text': text,
                    'model': 'seed-tts-1.1',
                    'speaker': voice_speaker,
                    'audio_params': {
                        'format': 'wav',
                        'speech_rate': Number.parseInt(this.settings.speed),
                    },
                },
            }),
        });
        console.info(response);
        if (!response.ok) {
            console.error(`HTTP ${response.status}: ${await response.json()}, logid: ${response.headers.get('X-Logid')}`);
            throw new Error(`HTTP ${response.status}: ${await response.json()}`);
        }
        if (!response.body) {
            throw new Error('响应没有可读流');
        }
        return {
            blob: async () => {
                return new Blob([await this.processAudioStream(response)], { type: 'audio/wav' });
            },
        };
    }
}
