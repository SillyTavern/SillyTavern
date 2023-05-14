# SillyTavern

## Based on a fork of TavernAI 1.2.8

### Brought to you by Cohee, RossAscends and the SillyTavern community

NOTE: We have added [a FAQ](faq.md) to answer most of your questions and help you get started.

### What is SillyTavern or TavernAI?

Tavern is a user interface you can install on your computer (and Android phones) that allows you to interact with text generation AIs and chat/roleplay with characters you or the community create.

SillyTavern is a fork of TavernAI 1.2.8 which is under more active development and has added many major features. At this point, they can be thought of as completely independent programs.

### What do I need other than Tavern?

On its own Tavern is useless, as it's just a user interface. You have to have access to an AI system backend that can act as the roleplay character. There are various supported backends: OpenAPI API (GPT), KoboldAI (either running locally or on Google Colab), and more. You can read more about this in [the FAQ](faq.md).

### Do I need a powerful PC to run Tavern?

Since Tavern is only a user interface, it has tiny hardware requirements, it will run on anything. It's the AI system backend that needs to be powerful.

## Mobile support

> **Note**

> **This fork can be run natively on Android phones using Termux. Please refer to this guide by ArroganceComplex#2659:**

<https://rentry.org/STAI-Termux>

**.webp character cards import/export is not supported in Termux. Use either JSON or PNG formats instead.**

## Questions or suggestions?

### We now have a community Discord server

Get support, share favorite characters and prompts:

### [Join](https://discord.gg/RZdyAEUPvj)

***

Get in touch with the developers directly:

* Discord: Cohee#1207 or RossAscends#1779
* Reddit: /u/RossAscends or /u/sillylossy
* [Post a GitHub issue](https://github.com/Cohee1207/SillyTavern/issues)

## This version includes

* A heavily modified TavernAI 1.2.8 (more than 50% of code rewritten or optimized)
* Swipes
* Group chats: multi-bot rooms for characters to talk to you or each other
* Chat bookmarks / branching (duplicates the dialogue in its current state)
* Advanced KoboldAI / TextGen generation settings with a lot of community-made presets
* World Info support: create a rich lore or save tokens on your character card
* [Oobabooga's TextGen WebUI](https://github.com/oobabooga/text-generation-webui) API connection
* [AI Horde](https://horde.koboldai.net/) connection
* [Poe.com](https://poe.com) (ChatGPT / Claude) connection
* Soft prompts selector for KoboldAI
* Prompt generation formatting tweaking
* webp character card interoperability (PNG is still an internal format)
* Extensibility support via [SillyLossy's TAI-extras](https://github.com/Cohee1207/TavernAI-extras) plugins
  * Author's Note / Character Bias
  * Character emotional expressions
  * Auto-Summary of the chat history
  * Sending images to chat, and the AI interpreting the content.

## UI Extensions 🚀

| Name             | Description                      | Required <a href="https://github.com/Cohee1207/TavernAI-extras#modules" target="_blank">Extra Modules</a> | Screenshot |
| ---------------- | ---------------------------------| ---------------------------- | ---------- |
| Image Captioning | Send a cute picture to your bot!<br><br>Picture select option will appear beside the "Message send" button. | `caption`                    | <img src="https://user-images.githubusercontent.com/18619528/224161576-ddfc51cd-995e-44ec-bf2d-d2477d603f0c.png" style="max-width:200px" />  |
| Character Expressions | See your character reacting to your messages!<br><br>**You need to provide your own character images!**<br><br>1. Create a folder in TavernAI called `public/characters/<name>`, where `<name>` is the name of your character.<br>2. For the base emotion classification model, put six PNG files there with the following names: `joy.png`, `anger.png`, `fear.png`, `love.png`, `sadness.png`, `surprise.png`. Other models may provide other options.<br>3. Images only display in desktop mode. | `classify` | <img style="max-width:200px" alt="image" src="https://user-images.githubusercontent.com/18619528/223765089-34968217-6862-47e0-85da-7357370f8de6.png"> |
| Memory | Chatbot long-term memory simulation using automatic message context summarization. | `summarize` |  <img style="max-width:200px" alt="image" src="https://user-images.githubusercontent.com/18619528/223766279-88a46481-1fa6-40c5-9724-6cdd6f587233.png"> |
| D&D Dice | A set of 7 classic D&D dice for all your dice rolling needs.<br><br>*I used to roll the dice.<br>Feel the fear in my enemies' eyes* | None | <img style="max-width:200px" alt="image" src="https://user-images.githubusercontent.com/18619528/226199925-a066c6fc-745e-4a2b-9203-1cbffa481b14.png"> |
| Author's Note | Built-in extension that allows you to append notes that will be added to the context and steer the story and character in a specific direction. Because it's sent after the character description, it has a lot of weight. Thanks Ali឵#2222 for pitching the idea! | None | ![image](https://user-images.githubusercontent.com/128647114/230311637-d809cd9b-af66-4dd1-a310-7a27e847c011.png) |
| Character Backgrounds | Built-in extension to assign unique backgrounds to specific chats or groups. | None | <img style="max-width:200px" alt="image" src="https://user-images.githubusercontent.com/18619528/233494454-bfa7c9c7-4faa-4d97-9c69-628fd96edd92.png"> |

## UI/CSS/Quality of Life tweaks by RossAscends

* Mobile UI with optimized for iOS, and supports saving a shortcut to home screen and opening in fullscreen mode.
* HotKeys
  * Up = Edit last message in chat
  * Ctrl+Up = Edit last USER message in chat
  * Left = swipe left
  * Right = swipe right (NOTE: swipe hotkeys are disabled when chatbar has something typed into it)
  * Ctrl+Left = view locally stored variables (in the browser console window)
  * Enter (with chat bar selected) = send your message to AI
  * Ctrl+Enter = Regenerate the last AI response

* User Name Changes and Character Deletion no longer force the page to refresh.

* Toggle option to automatically connect to API on page load.
* Toggle option to automatically load the most recently viewed character on page load.
* Better Token Counter - works on unsaved characters, and shows both permanent and temporary tokens.

* Better Past Chats View
  * New Chat filenames are saved in a readable format of "(character) - (when it was created)"
  * Chat preview increased from 40 characters to 300.
  * Multiple options for characters list sorting (by name, creation date, chat sizes).

* By default the left and right settings panel will close when you click away from it.
* Clicking the Lock on the nav panel will hold the panel open, and this setting be remembered across sessions.
* Nav panel status of open or closed will also be saved across sessions.

* Customizable chat UI:
  * Play a sound when a new message arrives
  * Switch between round or rectangle avatar styles
  * Have a wider chat window on the desktop
  * Optional semi-transparent glass-like panels
  * Customizable page colors for 'main text', 'quoted text' 'italics text'.
  * Customizable UI background color and blur amount

## Installation

*NOTE: This software is intended for local install purposes, and has not been thoroughly tested on a colab or other cloud notebook service.*

> **Warning**

> DO NOT INSTALL INTO ANY WINDOWS CONTROLLED FOLDER (Program Files, System32, etc).

> DO NOT RUN START.BAT WITH ADMIN PERMISSIONS

### Windows

Installing via Git (recommended for easy updating)

Easy to follow guide with pretty pictures:
<https://docs.alpindale.dev/pygmalion-extras/sillytavern/#windows-installation>

  1. Install [NodeJS](https://nodejs.org/en) (latest LTS version is recommended)
  2. Install [GitHub Desktop](https://central.github.com/deployments/desktop/desktop/latest/win32)
  3. Open Windows Explorer (`Win+E`)
  4. Browse to or Create a folder that is not controlled or monitored by Windows. (ex: C:\MySpecialFolder\)
  5. Open a Command Prompt inside that folder by clicking in the 'Address Bar' at the top, typing `cmd`, and pressing Enter.
  6. Once the black box (Command Prompt) pops up, type ONE of the following into it and press Enter:
  
  * for Main Branch: `git clone <https://github.com/Cohee1207/SillyTavern> -b main`
  * for Dev Branch: `git clone <https://github.com/Cohee1207/SillyTavern> -b dev`
  
  7. Once everything is cloned, double click `Start.bat` to make NodeJS install its requirements.
  8. The server will then start, and SillyTavern will popup in your browser.

Installing via zip download

  1. install [NodeJS](https://nodejs.org/en) (latest LTS version is recommended)
  2. download the zip from this GitHub repo
  3. unzip it into a folder of your choice
  4. run start.bat via double-clicking or in a command line.
  5. Once the server has prepared everything for you, it will open a tab in your browser.

### Linux

  1. Run the `start.sh` script.
  2. Enjoy.

## API keys management

SillyTavern saves your API keys to a `secrets.json` file in the server directory.

By default they will not be exposed to a frontend after you enter them and reload the page.

In order to enable viewing your keys by clicking a button in the API block:

1. Set the value of `allowKeysExposure` to `true` in `config.conf` file.
2. Restart the SillyTavern server.

## Remote connections

Most often this is for people who want to use SillyTavern on their mobile phones while their PC runs the ST server on the same wifi network.

However, it can be used to allow remote connections from anywhere as well.

**IMPORTANT: SillyTavern is a single-user program, so anyone who logs in will be able to see all characters and chats, and be able to change any settings inside the UI.**

### 1. Managing whitelisted IPs

* Create a new text file inside your SillyTavern base install folder called `whitelist.txt`.
* Open the file in a text editor, add a list of IPs you want to be allowed to connect.

*IP ranges are not accepted. Each IP must be listed individually like this:*
```txt
192.168.0.1
192.168.0.2
192.168.0.3
192.168.0.4
```
* Save the `whitelist.txt` file.
* Restart your TAI server.

Now devices which have the IP specified in the file will be able to connect.

*Note: `config.conf` also has a `whitelist` array, which you can use in the same way, but this array will be ignored if `whitelist.txt` exists.*

### 2. Connecting to ST from a remote device

After the whitelist has been setup, to connect over wifi you'll need the IP of the ST-hosting device. 

If the ST-hosting device is on the same wifi network, you will point your remote device's browser to the ST-host's internal wifi IP: 

* For Windows: windows button > type `cmd.exe` in the search bar > type `ipconfig` in the console, hit Enter > look for `IPv4` listing.

If you (or someone else) wants to connect to your hosted ST while not being on the same network, you will need the public IP of your ST-hosting device.

While using the ST-hosting device, access [this page](https://whatismyipaddress.com/) and look for for `IPv4`. This is what you would use to connect from the remote device.

### Opening your ST to all IPs

We do not reccomend doing this, but you can open `config.conf` and change `whitelist` to `false`.

You must remove (or rename) `whitelist.txt` in the SillyTavern base install folder, if it exists. 

This is usually an insecure practice, so we require you to set a username and password when you do this. 

The username and password are set in `config.conf`.

After restarting your ST server, any device will be able to connect to it, regardless of their IP as long as they know the username and password.

### Still Unable To Connect?

* Create an inbound/outbound firewall rule for the port found in `config.conf`. Do NOT mistake this for portforwarding on your router, otherwise someone could find your chat logs and that's a big no-no.
* Enable the Private Network profile type in Settings > Network and Internet > Ethernet. This is VERY important for Windows 11, otherwise you would be unable to connect even with the aforementioned firewall rules.

## Performance issues?

Try enabling the No Blur Effect (Fast UI) mode on the User settings panel.

## I like your project! How do I contribute?

### DO's

1. Send pull requests
2. Send feature suggestions and issue reports using established templates
3. Read the readme file and built-in documentation before asking anything

### DONT's

1. Offer monetary donations
2. Send bug reports without providing any context
3. Ask the questions that were already answered numerous times

## Where can I find the old backgrounds?

We're moving to 100% original content only policy, so old background images have been removed from this repository.

You can find them archived here:

<https://files.catbox.moe/1xevnc.zip>

## Screenshots

<img width="400" alt="image" src="https://user-images.githubusercontent.com/18619528/228649245-8061c60f-63dc-488e-9325-f151b7a3ec2d.png">
<img width="400" alt="image" src="https://user-images.githubusercontent.com/18619528/228649856-fbdeef05-d727-4d5a-be80-266cbbc6b811.png">

## License and credits

**This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.**

* TAI Base by Humi: Unknown license
* Cohee's modifications and derived code: AGPL v3
* RossAscends' additions: AGPL v3
* Portions of CncAnon's TavernAITurbo mod: Unknown license
* Waifu mode inspired by the work of PepperTaco (<https://github.com/peppertaco/Tavern/>)
* Thanks Pygmalion University for being awesome testers and suggesting cool features!
* Thanks oobabooga for compiling presets for TextGen
* poe-api client adapted from <https://github.com/ading2210/poe-api> (GPL v3)
* GraphQL files for poe: <https://github.com/muharamdani/poe> (ISC License)
* KoboldAI Presets from KAI Lite: <https://lite.koboldai.net/>
* Noto Sans font by Google (OFL license)
* Icon theme by Font Awesome <https://fontawesome.com> (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License)
* Linux startup script by AlpinDale
* Thanks paniphons for providing a FAQ document
