# SillyTavern
## Based on fork of TavernAI 1.2.8
### Brought to you by Cohee and RossAscends

### What is SillyTavern or TavernAI?
Tavern is a user interface you can install on your computer (and Android phones) that allows you to interact text generation AIs and chat/roleplay with characters you or the community create.

SillyTavern is a fork of TavernAI 1.2.8 which is under more active development, and has added many major features. At this point they can be thought of as completely independent programs.

### What do I need other than Tavern?
On its own Tavern is useless, as it's just a user interface. You have to have access to an AI system backend that can act as the roleplay character. There are various supported backends: OpenAPI API (GPT), KoboldAI (either running locally or on Google Colab), and more.

### I'm new to all this. I just want to have a good time easily. What is the best AI backend to use?
The most advanced/intelligent AI backend for roleplaying is to pay for OpenAI's GPT API. It's also among the easiest to use. Objectively, GPT is streets ahead of all other backends. However, OpenAI log all your activity, and your account MAY be banned in the future if you violate their policies (e.g. on adult content). However, there are no reports of anyone being banned yet.
People who value privacy more tend to run a self-hosted AI backend like KoboldAI. Self-hosted backends do not log, but they are much less capable at roleplaying.

### Do I need a powerful PC to run Tavern?
Since Tavern is only a user interface, it has tiny hardware requirements, it will run on anything. It's the AI system backend that needs to be powerful.

### I want to try self-hosted easily. Got a Google Colab?

Try on Colab (runs KoboldAI backend and TavernAI Extras server alongside):  <a target="_blank" href="https://colab.research.google.com/github/Cohee1207/SillyTavern/blob/main/colab/GPU.ipynb">
  <img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/>
</a>

https://colab.research.google.com/github/Cohee1207/SillyTavern/blob/main/colab/GPU.ipynb

If that didn't work, try the legacy link:

https://colab.research.google.com/github/Cohee1207/TavernAI-extras/blob/main/colab/GPU.ipynb

## Mobile support

> **This fork can be ran natively on Android phones using Termux. Please refer to this guide by ArroganceComplex#2659:**

https://rentry.org/TAI_Termux

**.webp character cards import/export is not supported in Termux. Use either JSON or PNG formats instead.**

## This version includes
* A heavily modified TavernAI 1.2.8 (more than 50% of code rewritten or optimized)
* Swipes
* Group chats
* Chat bookmarks (duplicates the current in its curent state)
* Advanced KoboldAI generation settings
* World Info support
* [Oobabooga's TextGen WebUI](https://github.com/oobabooga/text-generation-webui) API connection
* Soft prompts selector for KoboldAI
* Prompt generation formatting tweaking
* Extensibility support via [SillyLossy's TAI-extras](https://github.com/Cohee1207/TavernAI-extras) plugins
    * Character emotional expressions
    * Auto-Summary of the chat history
    * Sending images to chat, and the AI interpreting the content.

## UI Extensions 🚀
| Name             | Description                      | Required <a href="https://github.com/Cohee1207/TavernAI-extras#modules" target="_blank">Extra Modules</a> | Screenshot |
| ---------------- | ---------------------------------| ---------------------------- | ---------- |
| Image Captioning | Send a cute picture to your bot!<br><br>Picture select option will appear beside "Message send" button. | `caption`                    | <img src="https://user-images.githubusercontent.com/18619528/224161576-ddfc51cd-995e-44ec-bf2d-d2477d603f0c.png" style="max-width:200px" />  |
| Character Expressions | See your character reacting to your messages!<br><br>**You need to provide your own character images!**<br><br>1. Create a folder in TavernAI called `public/characters/<name>`, where `<name>` is a name of your character.<br>2. For base emotion classification model, put six PNG files there with the following names: `joy.png`, `anger.png`, `fear.png`, `love.png`, `sadness.png`, `surprise.png`. Other models may provide another options.<br>3. Images only display in desktop mode. | `classify` | <img style="max-width:200px" alt="image" src="https://user-images.githubusercontent.com/18619528/223765089-34968217-6862-47e0-85da-7357370f8de6.png"> |
| Memory | Chatbot long-term memory simulation using automatic message context summarization. | `summarize` |  <img style="max-width:200px" alt="image" src="https://user-images.githubusercontent.com/18619528/223766279-88a46481-1fa6-40c5-9724-6cdd6f587233.png"> |
| D&D Dice | A set of 7 classic D&D dice for all your dice rolling needs.<br><br>*I used to roll the dice.<br>Feel the fear in my enemies' eyes* | None | <img style="max-width:200px" alt="image" src="https://user-images.githubusercontent.com/18619528/226199925-a066c6fc-745e-4a2b-9203-1cbffa481b14.png"> |
| Author's Note | Built-in extension that allows you to append notes that will be added to the context and steer the story and character in a specific direction. Because it's sent after the character description, it has a lot of weight. Thanks Ali឵#2222 for pitching the idea! | None | ![image](https://user-images.githubusercontent.com/128647114/230311637-d809cd9b-af66-4dd1-a310-7a27e847c011.png)

## UI/CSS/Quality of Life tweaks by RossAscends

* Mobile-friendly page design
* HotKeys
  * Ctrl+Up = Connect to API 
  * Ctrl+Left = view locally stored variables (in the browser console window)
  * Ctrl+Enter = Regenerate last AI response.

* User Name Changes and Character Deletion no longer force the page to refresh.

* Toggle option to automatically connect to API on page load.
* Toggle option to automatically load the most recently viewed character on page load.
* Better Token Counter - works on unsaved characters, and shows both permanent and temporary tokens.

* Better Past Chats View
  * New Chat filenames are saved in a readable format of "(character) - (when it was created)"
  * Chat preview increased from 40 character to 300.

* Now, by default the settings panel will close when you click away from it.
* Clicking the Lock on the nav panel will hold the panel open, and this setting be remembered across sessions.
* Nav panel status of open or closed will also be saved across sessions.

* mobile UI optimized for iOS, and supports saving a shortcut to iOS homescreen and opening in fullscreen mode.

## Installation

*NOTE: This branch is intended for local install purposes, and has not been tested on a colab or other cloud notebook service.*

  1. install [NodeJS](https://nodejs.org/en)
  2. download the zip from this github repo
  3. unzip it into a folder of your choice
  4. run start.bat via double clicking or in a command line.
  5. Once the server has prepared everything for you, it will open a tab in your browser.

## Remote connections

Most often this is for people who want use TAI on their mobile phones while at home.
If you want to enable other devices to connect to your TAI server, open 'config.conf' in a text editor, and change: 

```
const whitelistMode = true;
```
to 
```
const whitelistMode = false;
```
Save the file. 
Restart your TAI server. 

You will now be able to connect from other devices. 

***Disclaimer: Anyone else who knows your IP address and TAI port number will be able to as well***

To connect over wifi you'll need your PC's local wifi IP address 
  - (For Windows: windows button > type 'cmd.exe' in the search bar> type 'ipconfig' in the console, hit Enter > "IPv4" listing)
if you want other people on the internet to connect, and check [here](https://whatismyipaddress.com/) for 'IPv4'

## Performance issues?

Try enabling the Fast UI mode on User settings panel.

## Questions or suggestions?
Contact us on Discord: Cohee#1207 or RossAscends#1779

## Screenshots
<img width="400" alt="image" src="https://user-images.githubusercontent.com/18619528/228649245-8061c60f-63dc-488e-9325-f151b7a3ec2d.png">
<img width="400" alt="image" src="https://user-images.githubusercontent.com/18619528/228649856-fbdeef05-d727-4d5a-be80-266cbbc6b811.png">

## License and credits
* TAI Base by Humi: Unknown license
* Cohee's TAI mod: Public domain
* RossAscends' additions: Public domain
* Portions of CncAnon's TavernAITurbo mod: Unknown license
* Thanks Pygmalion University for being awesome testers and suggesting cool features! 
* Thanks oobabooga for compiling presets for TextGen
* poe-api client adapted from https://github.com/ading2210/poe-api (GPL v3)
* GraphQL files for poe: https://github.com/muharamdani/poe (ISC License)
* KoboldAI Presets from KAI Lite: https://lite.koboldai.net/ 