/**
 * Convert a prompt from the ChatML objects to the format used by Claude.
 * @param {object[]} messages Array of messages
 * @param {boolean} addHumanPrefix Add Human prefix
 * @param {boolean} addAssistantPostfix Add Assistant postfix
 * @param {boolean} withSystemPrompt Build system prompt before "\n\nHuman: "
 * @returns {string} Prompt for Claude
 * @copyright Prompt Conversion script taken from RisuAI by kwaroran (GPLv3).
 */
function convertClaudePrompt(messages, addHumanPrefix, addAssistantPostfix, withSystemPrompt) {
	// Find the index of the first message with an assistant role and check for a "'user' role/Human:" before it.
	const firstAssistantIndex = messages.findIndex(message => message.role === "assistant");
	const hasUser = messages.slice(0, firstAssistantIndex).some(message => message.role === "user" || message.content.includes("Human:"));
	
	let requestPrompt = messages.map((v, i) => {
		// Claude doesn't support message names, so we'll just add them to the message content.
		// Now iside the same cycle.
		if (v.name && v.role !== "system") {
			v.content = `${v.name}: ${v.content}`;
			delete v.name;
		}
		
		let prefix = '';
		// Define role prefixes(role : prefix).
		const rolePrefixes = {
			"assistant": "\n\nAssistant: ",
			"user": "\n\nHuman: ",
			"system": v.name === "example_assistant" ? "\n\nA: " : v.name === "example_user" ? "\n\nH: " : "\n\n"
		}
		// For Claude 2.1, add "/n/n" as prefix when the role of the first message is 'system' or 'assistant'. 
		// Otherwise, add "Human: " prefix when the role is 'user' (for compatibility with 2.0 format). 		
		if (i === 0 && ["system", "assistant"].includes(v.role) && withSystemPrompt) {
			prefix = "\n\n";
		// If there is no message with role "user" or prefix "Human:", change the first assistant's prefix.(insert the human's message).
		} else if (i === firstAssistantIndex && !hasUser && withSystemPrompt) {
			prefix = "\n\nHuman: Let's get started.\n\nAssistant: ";
		// For Claude 2.0, add the "Human:" prefix to the first message.
		} else if (i === 0 && addHumanPrefix) {
			prefix = "\n\nHuman: ";
		// Set the correct prefix according to the role.
		} else {
			prefix = rolePrefixes[v.role] || '\n\n';
		}
		return prefix + v.content;
    }).join('');
	
	// Another way to insert 'Human'.
	// If there is no message with role "user" or prefix "Human: ", add the new message before the first message of the assistant.
	// Remember to comment or remove .join('') above before use.
	/**
	if (withSystemPrompt && !hasUser && firstAssistantIndex > -1) {
		requestPrompt.splice(firstAssistantIndex, 0, "\n\nHuman: Let's get started.");
	}
	requestPrompt = requestPrompt.join('');
	*/
	if (addAssistantPostfix) {
		requestPrompt += "\n\nAssistant: ";
	}
	
	return requestPrompt;
}

module.exports = {
    convertClaudePrompt,
};
