type ByafLoreItem = {
    key: string;
    value: string;
};

type ByafCharacterImage = {
    path: string;
    label: string;
};

type ByafExampleMessage = {
    characterID: string;
    text: string;
};

type ByafCharacter = {
    schemaVersion: 1;
    id: string;
    name: string;
    displayName: string;
    isNSFW: boolean;
    persona: string;
    createdAt: string;
    updatedAt: string;
    loreItems: Array<ByafLoreItem>;
    images: Array<ByafCharacterImage>;
};

type ByafManifest = {
    schemaVersion: 1;
    createdAt: string;
    characters: string[];
    scenarios: string[];
    author?: {
        name: string;
        backyardURL: string;
    };
};

type ByafAiMessage = {
    type: "ai";
    outputs: Array<{
        createdAt: string;
        updatedAt: string;
        text: string;
        activeTimestamp: string;
    }>;
};

type ByafHumanMessage = {
    type: "human";
    createdAt: string;
    updatedAt: string;
    text: string;
};

type ByafScenario = {
    schemaVersion: 1;
    title?: string;
    model?: string;
    formattingInstructions: string;
    minP: number;
    minPEnabled: boolean;
    temperature: number;
    repeatPenalty: number;
    repeatLastN: number;
    topK: number;
    topP: number;
    exampleMessages: Array<ByafExampleMessage>;
    canDeleteExampleMessages: boolean;
    firstMessages: Array<ByafExampleMessage>;
    narrative: string;
    promptTemplate: "general" | "ChatML" | "Llama3" | "Gemma2" | "CommandR" | "MistralInstruct" | null;
    grammar: string | null;
    messages: Array<ByafAiMessage | ByafHumanMessage>;
    backgroundImage?: string;
};

type ByafChatBackground = {
    name: string;
    data: Buffer;
    paths: string[];
};

type ByafParseResult = {
    card: TavernCardV2,
    images: { filename: string, image: Buffer, label: string }[],
    scenarios: Partial<ByafScenario>[],
    chatBackgrounds: Array<ByafChatBackground>,
    character: ByafCharacter
};
