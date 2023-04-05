## Silly TavernAI mod. Based on fork of TavernAI 1.2.8
### Brought to you by @SillyLossy and @RossAscends

Try on Colab (runs KoboldAI backend and TavernAI Extras server alongside):  <a target="_blank" href="https://colab.research.google.com/github/SillyLossy/TavernAI-extras/blob/main/colab/GPU.ipynb">
  <img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/>
</a>

https://colab.research.google.com/github/SillyLossy/TavernAI-extras/blob/main/colab/GPU.ipynb

## Mobile support

> **This fork can be ran natively on Android phones using Termux. Please refer to this guide by ArroganceComplex#2659:**

https://rentry.org/TAI_Termux

## This branch includes: 
* A heavily modified TavernAI 1.2.8 (more than 50% of code rewritten or optimized)
* Swipes
* Group chats
* Chat bookmarks (duplicates the current in its curent state)
* Advanced KoboldAI generation settings
* World Info support
* [Oobabooga's TextGen WebUI](https://github.com/oobabooga/text-generation-webui) API connection
* Soft prompts selector for KoboldAI
* Prompt generation formatting tweaking
* Extensibility support via [SillyLossy's TAI-extras](https://github.com/SillyLossy/TavernAI-extras) plugins
    * Character emotional expressions
    * Auto-Summary of the chat history
    * Sending images to chat, and the AI interpreting the content.

## UI Extensions 🚀
| Name             | Description                      | Required <a href="https://github.com/SillyLossy/TavernAI-extras#modules" target="_blank">Extra Modules</a> | Screenshot |
| ---------------- | ---------------------------------| ---------------------------- | ---------- |
| Image Captioning | Send a cute picture to your bot!<br><br>Picture select option will appear beside "Message send" button. | `caption`                    | <img src="https://user-images.githubusercontent.com/18619528/224161576-ddfc51cd-995e-44ec-bf2d-d2477d603f0c.png" style="max-width:200px" />  |
| Character Expressions | See your character reacting to your messages!<br><br>**You need to provide your own character images!**<br><br>1. Create a folder in TavernAI called `public/characters/<name>`, where `<name>` is a name of your character.<br>2. For base emotion classification model, put six PNG files there with the following names: `joy.png`, `anger.png`, `fear.png`, `love.png`, `sadness.png`, `surprise.png`. Other models may provide another options.<br>3. Images only display in desktop mode. | `classify` | <img style="max-width:200px" alt="image" src="https://user-images.githubusercontent.com/18619528/223765089-34968217-6862-47e0-85da-7357370f8de6.png"> |
| Memory | Chatbot long-term memory simulation using automatic message context summarization. | `summarize` |  <img style="max-width:200px" alt="image" src="https://user-images.githubusercontent.com/18619528/223766279-88a46481-1fa6-40c5-9724-6cdd6f587233.png"> |
| Floating Prompt | Adds a string to your scenario after certain amount of messages you send. Usage ideas: reinforce certain events during roleplay. Thanks @Ali឵#2222 for suggesting me that! | None | <img style="max-width:200px" src="https://user-images.githubusercontent.com/18619528/224158641-c317313c-b87d-42b2-9702-ea4ba896593e.png" /> | 
| D&D Dice | A set of 7 classic D&D dice for all your dice rolling needs.<br><br>*I used to roll the dice.<br>Feel the fear in my enemies' eyes* | None | <img style="max-width:200px" alt="image" src="https://user-images.githubusercontent.com/18619528/226199925-a066c6fc-745e-4a2b-9203-1cbffa481b14.png"> |

...and...

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

  1. install [NodeJS](nodejs.org)
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
* SillyLossy's TAI mod: Public domain
* RossAscends' additions: Public domain
* Portions of CncAnon's TavernAITurbo mod: Unknown license
* Thanks oobabooga for compiling presets for TextGen
* poe-api client adapted from https://github.com/ading2210/poe-api (GPL v3)