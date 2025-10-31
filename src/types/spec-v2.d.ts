type TavernCardV2 = {
    spec: 'chara_card_v2';
    spec_version: '2.0';
    data: {
        name: string;
        description: string;
        personality: string;
        scenario: string;
        first_mes: string;
        mes_example: string;

        creator_notes: string;
        system_prompt: string;
        post_history_instructions: string;
        alternate_greetings: Array<string>;
        character_book?: CharacterBook;

        tags: Array<string>;
        creator: string;
        character_version: string;
        extensions: Record<string, any>;
    }
}

type CharacterBook = {
    name?: string;
    description?: string;
    scan_depth?: number;
    token_budget?: number;
    recursive_scanning?: boolean;
    extensions: Record<string, any>;
    entries: Array<CharacterBookEntry>;
}

type CharacterBookEntry = {
    keys: Array<string>;
    content: string;
    extensions: Record<string, any>;
    enabled: boolean;
    insertion_order: number;
    case_sensitive?: boolean;

    name?: string;
    priority?: number;

    id?: number;
    comment?: string;
    selective?: boolean;
    secondary_keys?: Array<string>;
    constant?: boolean;
    position?: 'before_char' | 'after_char';
};
