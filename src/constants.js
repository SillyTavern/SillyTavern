const PUBLIC_DIRECTORIES = {
    images: 'public/img/',
    backups: 'backups/',
    sounds: 'public/sounds',
    extensions: 'public/scripts/extensions',
};

const SETTINGS_FILE = 'settings.json';

/**
 * @type {import('./users').UserDirectoryList}
 * @readonly
 * @enum {string}
 */
const USER_DIRECTORY_TEMPLATE = Object.freeze({
    root: '',
    thumbnails: 'thumbnails',
    thumbnailsBg: 'thumbnails/bg',
    thumbnailsAvatar: 'thumbnails/avatar',
    worlds: 'worlds',
    user: 'user',
    avatars: 'User Avatars',
    userImages: 'user/images',
    groups: 'groups',
    groupChats: 'group chats',
    chats: 'chats',
    characters: 'characters',
    backgrounds: 'backgrounds',
    novelAI_Settings: 'NovelAI Settings',
    koboldAI_Settings: 'KoboldAI Settings',
    openAI_Settings: 'OpenAI Settings',
    textGen_Settings: 'TextGen Settings',
    themes: 'themes',
    movingUI: 'movingUI',
    extensions: 'extensions',
    instruct: 'instruct',
    context: 'context',
    quickreplies: 'QuickReplies',
    assets: 'assets',
    comfyWorkflows: 'user/workflows',
    files: 'user/files',
    vectors: 'vectors',
    backups: 'backups',
    sysprompt: 'sysprompt',
});

/**
 * @type {import('./users').User}
 * @readonly
 */
const DEFAULT_USER = Object.freeze({
    handle: 'default-user',
    name: 'User',
    created: Date.now(),
    password: '',
    admin: true,
    enabled: true,
    salt: '',
});

const UNSAFE_EXTENSIONS = [
    '.php',
    '.exe',
    '.com',
    '.dll',
    '.pif',
    '.application',
    '.gadget',
    '.msi',
    '.jar',
    '.cmd',
    '.bat',
    '.reg',
    '.sh',
    '.py',
    '.js',
    '.jse',
    '.jsp',
    '.pdf',
    '.html',
    '.htm',
    '.hta',
    '.vb',
    '.vbs',
    '.vbe',
    '.cpl',
    '.msc',
    '.scr',
    '.sql',
    '.iso',
    '.img',
    '.dmg',
    '.ps1',
    '.ps1xml',
    '.ps2',
    '.ps2xml',
    '.psc1',
    '.psc2',
    '.msh',
    '.msh1',
    '.msh2',
    '.mshxml',
    '.msh1xml',
    '.msh2xml',
    '.scf',
    '.lnk',
    '.inf',
    '.reg',
    '.doc',
    '.docm',
    '.docx',
    '.dot',
    '.dotm',
    '.dotx',
    '.xls',
    '.xlsm',
    '.xlsx',
    '.xlt',
    '.xltm',
    '.xltx',
    '.xlam',
    '.ppt',
    '.pptm',
    '.pptx',
    '.pot',
    '.potm',
    '.potx',
    '.ppam',
    '.ppsx',
    '.ppsm',
    '.pps',
    '.ppam',
    '.sldx',
    '.sldm',
    '.ws',
];

const GEMINI_SAFETY = [
    {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
    },
    {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
    },
    {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
    },
    {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
    },
    {
        category: 'HARM_CATEGORY_CIVIC_INTEGRITY',
        threshold: 'BLOCK_NONE',
    },
];

const BISON_SAFETY = [
    {
        category: 'HARM_CATEGORY_DEROGATORY',
        threshold: 'BLOCK_NONE',
    },
    {
        category: 'HARM_CATEGORY_TOXICITY',
        threshold: 'BLOCK_NONE',
    },
    {
        category: 'HARM_CATEGORY_VIOLENCE',
        threshold: 'BLOCK_NONE',
    },
    {
        category: 'HARM_CATEGORY_SEXUAL',
        threshold: 'BLOCK_NONE',
    },
    {
        category: 'HARM_CATEGORY_MEDICAL',
        threshold: 'BLOCK_NONE',
    },
    {
        category: 'HARM_CATEGORY_DANGEROUS',
        threshold: 'BLOCK_NONE',
    },
];

const CHAT_COMPLETION_SOURCES = {
    OPENAI: 'openai',
    WINDOWAI: 'windowai',
    CLAUDE: 'claude',
    SCALE: 'scale',
    OPENROUTER: 'openrouter',
    AI21: 'ai21',
    MAKERSUITE: 'makersuite',
    MISTRALAI: 'mistralai',
    CUSTOM: 'custom',
    COHERE: 'cohere',
    PERPLEXITY: 'perplexity',
    GROQ: 'groq',
    ZEROONEAI: '01ai',
    BLOCKENTROPY: 'blockentropy',
};

/**
 * Path to multer file uploads under the data root.
 */
const UPLOADS_DIRECTORY = '_uploads';

// TODO: this is copied from the client code; there should be a way to de-duplicate it eventually
const TEXTGEN_TYPES = {
    OOBA: 'ooba',
    MANCER: 'mancer',
    VLLM: 'vllm',
    APHRODITE: 'aphrodite',
    TABBY: 'tabby',
    KOBOLDCPP: 'koboldcpp',
    TOGETHERAI: 'togetherai',
    LLAMACPP: 'llamacpp',
    OLLAMA: 'ollama',
    INFERMATICAI: 'infermaticai',
    DREAMGEN: 'dreamgen',
    OPENROUTER: 'openrouter',
    FEATHERLESS: 'featherless',
    HUGGINGFACE: 'huggingface',
};

const INFERMATICAI_KEYS = [
    'model',
    'prompt',
    'max_tokens',
    'temperature',
    'top_p',
    'top_k',
    'repetition_penalty',
    'stream',
    'stop',
    'presence_penalty',
    'frequency_penalty',
    'min_p',
    'seed',
    'ignore_eos',
    'n',
    'best_of',
    'min_tokens',
    'spaces_between_special_tokens',
    'skip_special_tokens',
    'logprobs',
];

const FEATHERLESS_KEYS = [
    'model',
    'prompt',
    'best_of',
    'echo',
    'frequency_penalty',
    'logit_bias',
    'logprobs',
    'max_tokens',
    'n',
    'presence_penalty',
    'seed',
    'stop',
    'stream',
    'suffix',
    'temperature',
    'top_p',
    'user',

    'use_beam_search',
    'top_k',
    'min_p',
    'repetition_penalty',
    'length_penalty',
    'early_stopping',
    'stop_token_ids',
    'ignore_eos',
    'min_tokens',
    'skip_special_tokens',
    'spaces_between_special_tokens',
    'truncate_prompt_tokens',

    'include_stop_str_in_output',
    'response_format',
    'guided_json',
    'guided_regex',
    'guided_choice',
    'guided_grammar',
    'guided_decoding_backend',
    'guided_whitespace_pattern',
];


// https://dreamgen.com/docs/api#openai-text
const DREAMGEN_KEYS = [
    'model',
    'prompt',
    'max_tokens',
    'temperature',
    'top_p',
    'top_k',
    'min_p',
    'repetition_penalty',
    'frequency_penalty',
    'presence_penalty',
    'stop',
    'stream',
    'minimum_message_content_tokens',
];

// https://docs.together.ai/reference/completions
const TOGETHERAI_KEYS = [
    'model',
    'prompt',
    'max_tokens',
    'temperature',
    'top_p',
    'top_k',
    'repetition_penalty',
    'min_p',
    'presence_penalty',
    'frequency_penalty',
    'stream',
    'stop',
];

// https://github.com/jmorganca/ollama/blob/main/docs/api.md#request-with-options
const OLLAMA_KEYS = [
    'num_predict',
    'num_ctx',
    'stop',
    'temperature',
    'repeat_penalty',
    'presence_penalty',
    'frequency_penalty',
    'top_k',
    'top_p',
    'tfs_z',
    'typical_p',
    'seed',
    'repeat_last_n',
    'mirostat',
    'mirostat_tau',
    'mirostat_eta',
    'min_p',
];

const AVATAR_WIDTH = 512;
const AVATAR_HEIGHT = 768;

const OPENROUTER_HEADERS = {
    'HTTP-Referer': 'https://sillytavern.app',
    'X-Title': 'SillyTavern',
};

const FEATHERLESS_HEADERS = {
    'HTTP-Referer': 'https://sillytavern.app',
    'X-Title': 'SillyTavern',
};

const OPENROUTER_KEYS = [
    'max_tokens',
    'temperature',
    'top_k',
    'top_p',
    'presence_penalty',
    'frequency_penalty',
    'repetition_penalty',
    'min_p',
    'top_a',
    'seed',
    'logit_bias',
    'model',
    'stream',
    'prompt',
    'stop',
    'provider',
];

// https://github.com/vllm-project/vllm/blob/0f8a91401c89ac0a8018def3756829611b57727f/vllm/entrypoints/openai/protocol.py#L220
const VLLM_KEYS = [
    'model',
    'prompt',
    'best_of',
    'echo',
    'frequency_penalty',
    'logit_bias',
    'logprobs',
    'max_tokens',
    'n',
    'presence_penalty',
    'seed',
    'stop',
    'stream',
    'suffix',
    'temperature',
    'top_p',
    'user',

    'use_beam_search',
    'top_k',
    'min_p',
    'repetition_penalty',
    'length_penalty',
    'early_stopping',
    'stop_token_ids',
    'ignore_eos',
    'min_tokens',
    'skip_special_tokens',
    'spaces_between_special_tokens',
    'truncate_prompt_tokens',

    'include_stop_str_in_output',
    'response_format',
    'guided_json',
    'guided_regex',
    'guided_choice',
    'guided_grammar',
    'guided_decoding_backend',
    'guided_whitespace_pattern',
];

module.exports = {
    DEFAULT_USER,
    SETTINGS_FILE,
    PUBLIC_DIRECTORIES,
    USER_DIRECTORY_TEMPLATE,
    UNSAFE_EXTENSIONS,
    UPLOADS_DIRECTORY,
    GEMINI_SAFETY,
    BISON_SAFETY,
    TEXTGEN_TYPES,
    CHAT_COMPLETION_SOURCES,
    AVATAR_WIDTH,
    AVATAR_HEIGHT,
    TOGETHERAI_KEYS,
    OLLAMA_KEYS,
    INFERMATICAI_KEYS,
    DREAMGEN_KEYS,
    OPENROUTER_HEADERS,
    OPENROUTER_KEYS,
    VLLM_KEYS,
    FEATHERLESS_KEYS,
    FEATHERLESS_HEADERS,
};
