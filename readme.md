### TavernAI is a adventure chat shell for AI language models
<br><img src="readme/1.png" width="600" />

TavernAI helps the AI model is in the chat format and makes the answers a longer than they usually are for this format. In most cases, the shell fixes the problem when the model tries to answer for the user. 

Through the interface, you can easily create/edit characters, switch presets and change the background on the fly.
## How to install
### In Detail:
* [Detailed installation and connection guide to Colab AI model step by step](https://github.com/TavernAI/TavernAI/wiki/How-to-install)<br>
### Briefly:
1. Download and Install [Node.js v19.1.0](https://nodejs.org/download/release/v19.1.0/)
2. Run Start.bat or use command: *node server.js*
## Connecting to API
### KoboldAI
To use KoboldAI install it locally, or run it through Google Colab. Details: [KoboldAI](https://github.com/KoboldAI/KoboldAI-Client)
### KoboldAI Settings
In most cases, you can use available presets in TavernAI for any models, making minimal changes. Later they will be calibrated more accurately for each model.
<br><br>It is recommended either not to use Repetition Penalty at all, or to set the minimum value in the region of 1.01 - 1.05 for small models. Also, highly strict sample settings force the AI to answer less long and more monosyllabic messages. Accordingly, settings with minimal sampling will produce longer, but less logical messages.
<br><br>It's a little harder for Nerys to understand the chat format than Erebus models.
## Compatibility
Tested on Windows 7/10 x64 (FireFox 108.0, Google Chrome 108.0, Microsoft Edge 108.0)

## Additionally Tips
If the message is not finished, you can simply send the request again, TavernAI will understand that this is a continuation.<br>
<br><img src="readme/2.png" width="600" />
<br>Later, it is planned to make TavernAI combine such messages into one.
## What's next?
* Ability to create an examples of a character's messages
* Wildcards for characters
* Ability to edit all messages
* Displaying whether a message is in context or not
* Access for many chats for one character
* Design presets
## Donation
BTC 1LASziomyYNkZ2zk8Sa4ZLTkvczBMrjyjP<br>
ETH 0x975E5C91042ce8168B3d37b17F99949c5eFB3Dfe<br>
TRX TCiBKCt6xEGrsjpgQA2jDXWJLyUh1KN2Sn
<br><br><br>
