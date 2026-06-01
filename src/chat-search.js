import fs from 'node:fs';
import path from 'node:path';

import { formatBytes, tryParse } from './util.js';

export const CHAT_SEARCH_FILE_CONCURRENCY = 4;

const READ_BUFFER_SIZE = 1024 * 1024;
const PREVIEW_LENGTH = 400;

export function getPreviewMessage(lastMessage) {
    if (!lastMessage) {
        return '';
    }

    return lastMessage.length > PREVIEW_LENGTH
        ? '...' + lastMessage.substring(lastMessage.length - PREVIEW_LENGTH)
        : lastMessage;
}

export function getChatSearchFragments(query) {
    return String(query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export async function mapAsyncLimited(items, limit, mapper) {
    if (items.length === 0) {
        return [];
    }

    const results = new Array(items.length);
    const workerCount = Math.max(1, Math.min(Math.floor(limit), items.length));
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            try {
                results[index] = { status: 'fulfilled', value: await mapper(items[index], index) };
            } catch (reason) {
                results[index] = { status: 'rejected', reason };
            }
        }
    }

    await Promise.all(Array.from({ length: workerCount }, worker));
    return results;
}

function isChatEntry(jsonData) {
    return Boolean(jsonData && (jsonData.name || jsonData.character_name || jsonData.chat_metadata));
}

function updateFromLastLine(result, stats, line, chatFilePath) {
    const jsonData = tryParse(line.replace(/\r$/, ''));

    if (isChatEntry(jsonData)) {
        result.preview_message = getPreviewMessage(jsonData.mes || '[The message is empty]');
        result.last_mes = jsonData.send_date || new Date(Math.round(stats.mtimeMs)).toISOString();
    } else {
        console.warn('Found an invalid or corrupted chat file:', chatFilePath);
        result.valid = false;
    }
}

export async function getChatSearchResult(chatFilePath) {
    const parsedPath = path.parse(chatFilePath);
    const stats = await fs.promises.stat(chatFilePath);
    const result = {
        file_name: parsedPath.name,
        file_size: formatBytes(stats.size),
        message_count: 0,
        last_mes: stats.mtimeMs,
        preview_message: '[The chat is empty]',
        valid: true,
    };

    if (stats.size === 0) {
        return result;
    }

    const fileHandle = await fs.promises.open(chatFilePath, 'r');

    try {
        const buffer = Buffer.allocUnsafe(READ_BUFFER_SIZE);
        let lineCounter = 0;
        let position = 0;
        let previousLineStart = 0;
        let lastLineStart = 0;
        let lastByte = null;

        while (position < stats.size) {
            const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length, position);
            if (bytesRead === 0) {
                break;
            }

            const chunk = buffer.subarray(0, bytesRead);
            let searchOffset = 0;
            let newlineOffset;

            while ((newlineOffset = chunk.indexOf(10, searchOffset)) !== -1) {
                lineCounter++;
                previousLineStart = lastLineStart;
                lastLineStart = position + newlineOffset + 1;
                searchOffset = newlineOffset + 1;
            }

            lastByte = chunk[bytesRead - 1];
            position += bytesRead;
        }

        if (position === 0) {
            return result;
        }

        if (lastByte !== 10) {
            lineCounter++;
        }

        result.message_count = Math.max(0, lineCounter - 1);

        const lastLineStartOffset = lastByte === 10 ? previousLineStart : lastLineStart;
        const lastLineEndOffset = lastByte === 10 ? Math.max(0, position - 1) : position;
        const lastLineLength = lastLineEndOffset - lastLineStartOffset;

        if (lastLineLength <= 0) {
            return result;
        }

        const lastLineBuffer = Buffer.allocUnsafe(lastLineLength);
        const { bytesRead } = await fileHandle.read(lastLineBuffer, 0, lastLineLength, lastLineStartOffset);
        const lastLine = lastLineBuffer.subarray(0, bytesRead).toString('utf8');
        updateFromLastLine(result, stats, lastLine, chatFilePath);
    } finally {
        await fileHandle.close();
    }

    return result;
}
