export const vertexDefaults = {
    vertexai_service_tier: 'auto',
    vertexai_request_type: 'auto',
    vertexai_api_version: 'auto',
    vertexai_timeout: 1200,
    vertexai_auto_continue: true,
    vertexai_argument_streaming: true,
    vertexai_unwrap_content: true,
};

export const vertexSettingsMap = Object.fromEntries(Object.entries(vertexDefaults)
    .map(([key, value]) => [key, [`#${key}`, key, typeof value === 'boolean', true]]));

export function initVertexUI(settings, save) {
    for (const [key, fallback] of Object.entries(vertexDefaults)) {
        const element = document.getElementById(key);
        element?.addEventListener('change', () => {
            settings[key] = typeof fallback === 'boolean' ? element.checked
                : typeof fallback === 'number' ? Number(element.value) : element.value;
            save();
        });
    }
}

let runtime = {};
export function updateVertexRuntime(frame) {
    const output = document.getElementById('vertexai_runtime');
    if (!output) return;
    if (frame === null) {
        runtime = {};
        output.textContent = '正在连接…';
        return;
    }
    if (frame.error) {
        output.textContent = frame.error.message || 'Vertex 请求失败';
        return;
    }
    Object.assign(runtime, frame.vertexMeta || {});
    if (frame.usageMetadata?.trafficType) runtime.trafficType = frame.usageMetadata.trafficType;
    if (frame.vertexMeta?.phase === 'completed') runtime.tokens = frame.usageMetadata?.totalTokenCount;
    const phase = { authentication: '正在认证', waiting_for_vertex: '等待 Vertex', receiving: '接收正文', continuation: '正在续传', completed: '已完成' };
    if (frame.candidates?.some(c => c.content?.parts?.length)) runtime.phase = 'receiving';
    const details = [phase[runtime.phase] || '正在请求'];
    if (runtime.trafficType) details.push(runtime.trafficType);
    if (runtime.segments > 1) details.push(`${runtime.segments} 段`);
    if (Number.isFinite(runtime.tokens)) details.push(`${runtime.tokens} tokens`);
    if (runtime.warning) details.push(runtime.warning);
    const text = details.join(' · ');
    if (output.textContent !== text) output.textContent = text;
}
