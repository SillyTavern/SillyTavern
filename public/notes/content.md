# SillyTavern Guidebook

[toc]

## Character Design

### Character description

Used to add the character description and the rest that the AI should know.

For example, you can add information about the world in which the action takes place and describe the characteristics for the character you are playing for.

Usually it all takes 200-350 tokens.

### Methods and format

For most Kobold's models the easiest way is to use a free form for description, and in each sentence it is desirable to specify the name of the character.

The entire description should be in one line without hyphenation.  

For example:

`Chloe is a female elf. Chloe wears black-white maid dress with green collar and red glasses. Chloe has medium length black hair. Chloe's personality is...`

But that the AI would be less confused the best way is to use the W++ format.

Details here: [Pro-Tips](https://github.com/KoboldAI/KoboldAI-Client/wiki/Pro-Tips)

### Character tokens

**TL;DR: If you're working with an AI model with a 2048 context token limit, your 1000 token character definition is cutting the AI's 'memory' in half.**

To put this in perspective, a decent response from a good AI can easily be around 200-300 tokens. In this case, the AI would only be able to 'remember' about 3 exchanges worth of chat history.

***

### Why did my character's token counter turn red?

When we see your character has over 1000 tokens in its definitions, we highlight it for you because this can lower the AI's capabilities to provide an enjoyable conversation.

### What happens if my Character has too many tokens?

Don't worry - it won't break anything. At worst, if the Character's permanent tokens are too large, it simply means there will be less room left in the context for other things (see below).

The only negative side effect this can have is the AI will have less 'memory', as it will have less chat history available to process.

This is because every AI model has a limit to the amount of context it can process at one time.

### 'Context'?

This is the information that gets sent to the AI each time you ask it to generate a response:

*   Character definitions
*   Chat history
*   Author's Notes
*   Special Format strings
*   [bracket commands]

SillyTavern automatically calculates the best way to allocate the available context tokens before sending the information to the AI model.

### What are a Character's 'Permanent Tokens'?

These will always be sent to the AI with every generation request:

*   Character Name (keep the name short! Sent at the start of EVERY Character message)
*   Character Description Box
*   Character Personality Box
*   Scenario Box

### What parts of a Character's Definitions are NOT permanent?

*   The first message box - only sent once at the start of the chat.
*   Example messages box - only kept until chat history fills up the context (optionally these can be forced to be kept in context)

### Popular AI Model Context Token Limits

*   Older models below 6B parameters - 1024
*   Pygmalion 6B - 2048
*   Poe.com (Claude-instant or ChatGPT) - 2048
*   OpenAI ChatGPT - 4000-ish?
*   OpenAI GPT-4 - 8000?

### Personality summary

A brief description of the personality. It is added to the chat at a depth of 8-15 messages, so it has a significant impact on the character.

Example:

`Cheerful, cunning, provocative`

Another example:

`Aqua likes to do nothing and also likes to get drunk`

* In Pygmalion model, it is used as a "Personality:" prompt section

### First message

The First Message is an important thing that sets exactly how and in what style the character will communicate.  

It is desirable that the character's first message be long, so that later it would be less likely that the character would respond in with very short messages.  

You can also use asterisks ** to describe the character's actions.

For example:

`*I noticed you came inside, I walked up and stood right in front of you* Welcome. I'm glad to see you here. *I said with toothy smug sunny smile looking you straight in the eye* What brings you...`  


### Examples of dialogue

Describes how the character speaks. Before each example, you need to add the &lt;START&gt; tag.
Use {{char}} instead of the character name.
Use {{user}} instead of the user name.

Example:

```
<START>
{{user}}: Hi Aqua, I heard you like to spend time in the pub.  
{{char}}: *excitedly* Oh my goodness, yes! I just love spending time at the pub! It's so much fun to talk to all the adventurers and hear about their exciting adventures! And you are?  
{{user}}: I'm a new here and I wanted to ask for your advice.  
{{char}}: *giggles* Oh, advice! I love giving advice! And in gratitude for that, treat me to a drink! *gives signals to the bartender*  

<START>
{{user}}: Hello  
{{char}}: *excitedly* Hello there, dear! Are you new to Axel? Don't worry, I, Aqua the goddess of water, am here to help you! Do you need any assistance? And may I say, I look simply radiant today! *strikes a pose and looks at you with puppy eyes*
```

### Scenario

Circumstances and context of the dialogue.

### Replacement tags

_A list of tags that are replaced when sending to generate:_

1. {{user}} and &lt;USER&gt; are replaced by the User's Name  
2. {{char}} and &lt;BOT&gt; are replaced by the Character's Name

### Favorite Character

Mark character as favorite to quickly filter on the side menu bar by pressing the star button.

## World Info

**World Info enhances AI's understanding of the details in your world.**

It functions like a dynamic dictionary that only inserts relevant information from World Info entries when keywords associated with the entries are present in the message text.

The SillyTavern engine activates and seamlessly integrates the appropriate lore into the prompt, providing background information to the AI.

_It is important to note that while World Info helps guide the AI towards your desired lore, it does not guarantee its appearance in the generated output messages._

### Pro Tips

* The AI does not insert keywords into context, so each World Info entry should be a comprehensive, standalone description.
* To create a rich and detailed world lore, entries can be interlinked and reference one another.
* To conserve tokens, it is advisable to keep entry contents concise, with a general recommended limit of 50 tokens per entry.

### World Info Entry

#### Key

A list of keywords that trigger the activation of a World Info entry.

#### Secondary Key

A list of supplementary keywords that are used in conjunction with the main keywords. See [Selective](#selective).

#### Entry Content

The text that is inserted into the prompt upon entry activation.

#### Insertion Order

Numeric value. Defines a priority of the entry if multiple were activated at once. Entries with higher order number will be inserted closer to the end of the context as they will have more impact on the output.

#### Insertion Position

* **Before Chara:** World Info entry is inserted before the character's description and scenario. Has moderate impact on the conversation.
* **After Chara:** World Info entry is inserted after the character's description and scenario. Has greater impact on the conversation.

#### Comment

A supplemental text comment for your convenience, which is not utilized by the AI.

#### Constant

If enabled, the entry would always be present in the prompt.

#### Selective

If enabled, the entry would only be inserted when both a Key **AND** a Secondary Key have been activated.

If no secondary keys provided, this flag is ignored.

### Scan Depth

Defines how many messages in the chat history should be scanned for World Info keys.

If set to 1, then SillyTavern only scans the message you send and the most recent reply.

This stacks up to 10 message pairs it total.

### Budget

**Defines how many tokens could be used by World Info entries at once.**

If the budget was exhausted, then no more entries are activated even if the keys are present in the prompt.

Constant entries will be inserted first. Then entries with higher order numbers.

Entries inserted by direct mentioning of their keys have higher priority than those that were mentioned in other entries contents.

### Recursive scanning

**Entries can activate other entries by mentioning their keywords in the content text.**

For example, if your World Info contains two entries: 

```
Entry #1
Keyword: Bessie
Content: Bessie is a cow and is friend with Rufus.
```

```
Entry #2
Keyword: Rufus
Content: Rufus is a dog.
```

**Both** of them will be pulled into the context if the message text mentions **just Bessie**.

## KoboldAI

### Basic Settings

Standard KoboldAI settings files are used here. To add your own settings, simply add the file .settings in `SillyTavern\public\KoboldAI Settings`

#### Temperature

Value from 0.1 to 2.0. Lower value - the answers are more logical, but less creative. Higher value - the answers are more creative, but less logical.

#### Repetition penalty

Repetition penalty is responsible for the penalty of repeated words. If the character is fixated on something or repeats the same phrase, then increasing this parameter will fix it. It is not recommended to increase this parameter too much for the chat format, as it may break this format. The standard value for chat is approximately 1.0 - 1.05.

#### Repetition penalty range

The range of influence of Repetition penalty in tokens.

#### Amount generation

The maximum amount of tokens that the AI will generate to respond. One word is approximately 3-4 tokens. The larger the parameter value, the longer the generation time takes.

#### Context size

How much will the AI remember. Context size also affects the speed of generation.  

_Important_: The setting of Context Size in SillyTavern GUI overrides the setting for KoboldAI GUI

### Advanced Settings

The settings provided in this section offer a more detailed level of control over the text generation process. It is important to be careful when making changes to these settings without proper consideration, as doing so may result in degraded quality of responses.

#### Single-line mode

In single-line mode the AI generates only one line per request. This allows for quicker generation of shorter prompts, but it does not produce responses that consist of more than one line.

#### Top P Sampling

This setting controls how much of the text generated is based on the most likely options. Only words with the highest probabilities, together summing up to P, are considered. A word is then chosen at random, with a higher chance of selecting words with higher probabilities.

Set value to 1 to disable its effect.

#### Top K Sampling

This setting limits the number of words to choose from to the top K most likely options. Can be used together with Top P sampling.

Set value to 0 to disable its effect.

#### Top A Sampling

This setting allows for a more flexible version of sampling, where the number of words chosen from the most likely options is automatically determined based on the likelihood distribution of the options, but instead of choosing the top P or K words, it chooses all words with probabilities above a certain threshold.

Set value to 0 to disable its effect.

#### Typical Sampling

This setting selects words randomly from the list of possible words, with each word having an equal chance of being selected. This method can produce text that is more diverse but may also be less coherent.

Set value to 1 to disable its effect.

#### Tail Free Sampling

This setting removes the least probable words from consideration during text generation, which can improve the quality and coherence of the generated text.

Set value to 1 to disable its effect.

#### Repetition Penalty Slope

If both this and Repetition Penalty Range are above 0, then repetition penalty will have more effect closer to the end of the prompt. The higher the value, the stronger the effect.

Set value to 1 for linear interpolation or 0 to disable interpolation.

### Soft Prompts

**Soft Prompts allow you to customize the style and behavior of your AI.**

They are created by training the AI with a special type of prompt using a collection of input data. Experimenting with different soft prompts can lead to exciting and unique results. The most successful soft prompts are those that align the AI's output with a literary genre, fictional universe, or the style of a particular author.

#### Common Misconceptions

* Soft prompts do not provide new information to the model, but can effectively influence the model's tone, word choice, and formatting.
* Soft prompts are not a means of compressing a full prompt into a limited token space. Instead, they provide a way to guide the language model's output through data in the context.

## NovelAI

### API Key

To get a NovelAI API key, follow these instructions:

1. Go to the NovelAI website and Login.  
2. Create a new story, or open an existing story.  
3. Open the Network Tools on your web browser. (For Chrome or Firefox, you do this by pressing Ctrl+Shift+I, then switching to the Network tab.)  
4. Generate something. You should see two requests to [api.novelai.net/ai/generate-stream](http://api.novelai.net/ai/generate-stream), which might look something like this:  

![1.png](1.png)

5. Select the second request, then in the Headers tab of the inspection panel, scroll down to the very bottom. Look for a header called Authorization:

![2.png](2.png)

The long string (after "Bearer", not including it) is your API key.

* Proxies and Cloudflare-type services may interfere with connection.

### Settings

The files with the settings are here (SillyTavern\public\NovelAI Settings).  
You can also manually add your own settings files.

#### Temperature

Value from 0.1 to 2.0

Lower value - the answers are more logical, but less creative.

Higher value - the answers are more creative, but less logical.

#### Repetition penalty

Repetition penalty is responsible for the penalty of repeated words.
If the character is fixated on something or repeats the same phrase, then increasing this parameter will fix it.
It is not recommended to increase this parameter too much for the chat format, as it may break this format.

**The standard value for chat is approximately 1.0 - 1.05**

#### Repetition penalty range

The range of influence of Repetition penalty in tokens.

### Models

If your subscription tier is Paper, Tablet or Scroll use only Euterpe model otherwise you can not get an answer from NovelAI API.

## OpenAI 

### API key

**How to get:**

1. Go to [OpenAI](https://platform.openai.com/) and sign in.
2. Use "[View API keys](https://platform.openai.com/account/api-keys)" option to create a new API key.

**Important!**

_Lost API keys can't be restored! Make sure to keep it safe!_

## Poe

### API key

**How to get your access token / cookie:**

1.  Login to [poe.com](https://poe.com)
2.  Open browser DevTools (F12) and navigate to "Application" tab
3.  Find a _p-b_ cookie for poe.com domain and copy its value
4.  Paste cookie value to the box below and click "Connect"
5.  Select a character and start chatting

## Anchors

Anchors are used to increase the length of messages.
There are two types of anchors: _Character Anchor_ and _Style Anchor_.

_Character Anchor_ - affects the character played by the AI by motivating it to write longer messages.

Looks like: `[Elaborate speaker]`

_Style Anchor_ - affects the entire AI model, motivating the AI to write longer messages even when it is not acting as the character.

Looks like: `[Writing style: very long messages]`

***

Anchors Order sets the location of anchors in the prompt, the first anchor in the order is much further back in the context and thus has less influence than second.

The second anchor is only turned on after 8-12 messages, because when the chat still only has a few messages, the first anchor creates enough effect on its own.

Sometimes an AI model may not perceive anchors correctly or the AI model already generates sufficiently long messages. For these cases, you can disable the anchors by unchecking their respective boxes.

_When using Pygmalion models these anchors are automatically disabled, since Pygmalion already generates long enough messages._

## Instruct Mode

Instruct Mode allows you to adjust the prompting for instruction-following models, such as Alpaca, Metharme, WizardLM, etc.

**This is not supported for OpenAI API.**

### Instruct Mode Settings

#### System Prompt

Added to the beginning of each prompt. Should define the instructions for the model to follow.

For example:

```
Write one reply in internet RP style for {{char}}. Be verbose and creative.
```

#### Presets

Provides ready-made presets with prompts and sequences for some well-known instruct models.

*Changing a preset resets your system prompt to default!*

#### Input Sequence

Text added before the user's input.

#### Output Sequence

Text added before the character's reply.

#### System Sequence

Text added before the system prompt.

#### Stop Sequence

Text that denotes the end of the reply. Will be trimmed from the output text.

#### Include Names

If enabled, prepend character and user names to chat history logs after inserting the sequences.

*Always enabled for group chats!*

#### Wrap Sequences with Newline

Each sequence text will be wrapped with newline characters when inserted to the prompt. Required for Alpaca and its derivatives.

## Chat import

**Import chats into SillyTavern**

To import Character.AI chats, use this tool: [https://github.com/0x000011b/characterai-dumper](https://github.com/0x000011b/characterai-dumper).

## Tokenizer

**Important: This section doesn't apply to OpenAI API. SillyTavern will always use a matching tokenizer for OpenAI models.**

A tokenizer is a tool that breaks down a piece of text into smaller units called tokens. These tokens can be individual words or even parts of words, such as prefixes, suffixes, or punctuation. A rule of thumb is that one token generally corresponds to 3~4 characters of text. 

SillyTavern can use the following tokenizers while forming a request to the AI backend:

1. None. Each token is estimated to be ~3.3 characters, rounded up to the nearest integer. **Try this if your prompts get cut off on high context lengths.** This approach is used by KoboldAI Lite.
2. GPT-3 tokenizer. **Use to get more accurate counts on OpenAI character cards.** Can be previewed here: [OpenAI Tokenizer](https://platform.openai.com/tokenizer).
3. (Legacy) GPT-2/3 tokenizer. Used by original TavernAI. **Pick this if you're unsure.** More info: [gpt-2-3-tokenizer](https://github.com/josephrocca/gpt-2-3-tokenizer).
4. Sentencepiece tokenizer. Used by LLaMA model family: Alpaca, Vicuna, Koala, etc. **Pick if you use a LLaMA model.**

## Token Padding

**Important: This section doesn't apply to OpenAI API. SillyTavern will always use a matching tokenizer for OpenAI models.**

SillyTavern cannot use a proper tokenizer provided by the model running on a remote instance of KoboldAI or Oobabooga's TextGen, so all token counts assumed during prompt generation are estimated based on the selected [tokenizer](#Tokenizer) type.

Since the results of tokenization can be inaccurate on context sizes close to the model-defined maximum, some parts of the prompt may be trimmed or dropped, which may negatively affect the coherence of character definitions.

To prevent this, SillyTavern allocates a portion of the context size as padding to avoid adding more chat items than the model can accommodate. If you find that some part of the prompt is trimmed even with the most-matching tokenizer selected, adjust the padding so the description is not truncated.

You can input negative values for reverse padding, which allows allocating more than the set maximum amount of tokens.

## Advanced Formatting

The settings provided in this section allow for more control over the prompt building strategy. Most specifics of the prompt building depend on whether a Pygmalion model is selected or special formatting is force-enabled. The core differences between the formatting schemas are listed below.

### Custom Chat Separator

Overrides the default separators controlled by "Disable example chats formatting" and "Disable chat start formatting" options (see below).

### For _Pygmalion_ formatting

#### Disable description formatting

`**NAME's Persona:** `won't be prepended to the content of your character's Description box.

#### Disable scenario formatting

`**Scenario:** `won't be prepended to the content of your character's Scenario box.

#### Disable personality formatting

`**Personality:** `won't be prepended to the content of your character's Personality box.

#### Disable example chats formatting

`<START>` won't be added at the beginning of each example message block.  
_(If custom separator is not set)_

#### Disable chat start formatting

`<START>` won't be added between the character card and the chat log.  
_(If custom separator is not set)_

#### Always add character's name to prompt

Doesn't do anything (Included in Pygmalion formatting).

### For _non-Pygmalion_ formatting

#### Disable description formatting

Has no effect.

#### Disable scenario formatting

`**Circumstances and context of the dialogue:** `won't be prepended to the content of your character's Scenario box.

#### Disable personality formatting

`**NAME's personality:** `won't be prepended to the content of your character's Personality box.

#### Disable example chats formatting

`This is how **Character** should talk` won't be added at the beginning of each example message block.  
_(If custom separator is not set)_

#### Disable chat start formatting

`Then the roleplay chat between **User** and **Character** begins` won't be added between the character card and the chat log.  
_(If custom separator is not set)_

#### Always add character's name to prompt

Appends character's name to the prompt to force the model to complete the message as the character:

```
** OTHER CONTEXT HERE **
Character: 
```

## Group Chats

### Reply order strategies

Decides how characters in group chats are drafted for their replies.

#### Natural order

Tries to simulate the flow of a real human conversation. The algorithm is as follows:

1. Mentions of the group member names are extracted from the last message in chat.

Only whole words are recognized as mentions! If your character's name is "Misaka Mikoto", they will reply only activate on "Misaka" or "Mikoto", but never to "Misa", "Railgun", etc.

Unless "Allow bot responses to self" setting is enabled, characters won't reply to mentions of their name in their own message!

2. Characters are activated by the "Talkativeness" factor.

Talkativeness defines how often the character speaks if they were not mentioned. Adjust this value on "Advanced definitions" screen in character editor. Slider values are on a linear scale from **0% / Shy** (character never talks unless mentioned) to **100% / Chatty** (character always replies). Default value for new characters is 50% chance.

3. Random character is selected.

If no characters were activated at previous steps, one speaker is selected randomly, ignoring all other conditions.

#### List order

Characters are drafted based on the order they are presented in group members list. No other rules apply.

## Multigen

SillyTavern tries to create faster and longer responses by chaining the generation using smaller batches.

### Default settings:

First batch = 50 tokens

Next batches = 30 tokens

### Algorithm:

1. Generate the first batch (if amount of generation setting is more than batch length).
2. Generate next batch of tokens until one of the stopping conditions is reached.
3. Append the generated text to the next cycle's prompt.

### Stopping conditions:

1. Generated enough text.
2. Character starts speaking for You.
3. &lt;|endoftext|&gt; token reached.
4. No text generated.

## User Settings 

### Message Sound

To play your own custom sound on receiving a new message from bot, replace the following MP3 file in your SillyTavern folder:

`public/sounds/message.mp3`

Plays at 80% volume.

If "Background Sound Only" option is enabled, the sound plays only if SillyTavern window is **unfocused**.

### Formulas Rendering

Enables math formulas rendering using the [showdown-katex](https://obedm503.github.io/showdown-katex/) package.

The following formatting rules are supported:

#### LaTeX syntax
```
$$ formula goes here $$
```

#### Asciimath syntax
```
$ formula goes here $
```

More information: [KaTeX](https://katex.org/)