import { SlashCommandExecutor } from './SlashCommandExecutor.js';

export class SlashCommandBreak extends SlashCommandExecutor {
    get value() {
        return this.unnamedArgumentList[0]?.value;
    }
}
