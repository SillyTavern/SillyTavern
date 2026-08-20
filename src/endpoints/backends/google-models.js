import fetch from 'node-fetch';

const GOOGLE_MODELS_PAGE_SIZE = 1000;

export class GoogleModelsHttpError extends Error {
    /**
     * @param {number} status HTTP status code
     * @param {string} statusText HTTP status text
     */
    constructor(status, statusText) {
        super(`Google AI Studio models endpoint returned ${status} ${statusText}`.trim());
        this.name = 'GoogleModelsHttpError';
        this.status = status;
        this.statusText = statusText;
    }
}

export class GoogleModelsResponseError extends Error {
    /**
     * @param {string} message Error message
     * @param {ErrorOptions} [options] Error options
     */
    constructor(message, options) {
        super(message, options);
        this.name = 'GoogleModelsResponseError';
    }
}

/**
 * Fetches every page of Google AI Studio models and converts supported models.
 *
 * @param {string | URL} modelsUrl Google AI Studio models endpoint
 * @param {typeof fetch} [fetchImpl] Fetch implementation
 * @returns {Promise<object[]>} Models that support content generation
 */
export async function fetchGoogleModels(modelsUrl, fetchImpl = fetch) {
    const requestUrl = new URL(modelsUrl);
    requestUrl.searchParams.set('pageSize', String(GOOGLE_MODELS_PAGE_SIZE));
    requestUrl.searchParams.delete('pageToken');

    const models = [];
    const pageTokens = new Set();
    let pageNumber = 1;

    while (true) {
        let response;

        try {
            response = await fetchImpl(requestUrl.toString());
        } catch (cause) {
            throw new GoogleModelsResponseError(`Failed to fetch Google AI Studio models page ${pageNumber}.`, { cause });
        }

        if (!response.ok) {
            throw new GoogleModelsHttpError(response.status, response.statusText);
        }

        let data;
        try {
            data = await response.json();
        } catch (cause) {
            throw new GoogleModelsResponseError(`Failed to parse Google AI Studio models page ${pageNumber}.`, { cause });
        }

        if (!data || !Array.isArray(data.models)) {
            throw new GoogleModelsResponseError(`Google AI Studio models page ${pageNumber} has an invalid models field.`);
        }

        models.push(...data.models);

        const nextPageToken = data.nextPageToken;
        if (nextPageToken === undefined || nextPageToken === '') {
            break;
        }
        if (typeof nextPageToken !== 'string') {
            throw new GoogleModelsResponseError(`Google AI Studio models page ${pageNumber} has an invalid nextPageToken.`);
        }
        if (pageTokens.has(nextPageToken)) {
            throw new GoogleModelsResponseError(`Google AI Studio models pagination repeated token on page ${pageNumber}.`);
        }

        pageTokens.add(nextPageToken);
        requestUrl.searchParams.set('pageToken', nextPageToken);
        pageNumber++;
    }

    return models
        .filter(model => model?.supportedGenerationMethods?.includes('generateContent'))
        .map((model, index) => {
            if (typeof model.name !== 'string') {
                throw new GoogleModelsResponseError(`Google AI Studio model at index ${index} has an invalid name.`);
            }

            return {
                ...model,
                id: model.name.replace('models/', ''),
            };
        });
}
