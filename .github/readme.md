English | [中文](readme-zh_cn.md) | [日本語](readme-ja_jp.md)

![SillyTavern-Banner](https://github.com/SillyTavern/SillyTavern/assets/18619528/c2be4c3f-aada-4f64-87a3-ae35a68b61a4)

Mobile-friendly layout, Multi-API (KoboldAI/CPP, Horde, NovelAI, Ooba, OpenAI, OpenRouter, Claude, Scale), VN-like Waifu Mode, Stable Diffusion, TTS, WorldInfo (lorebooks), customizable UI, auto-translate, and more prompt options than you'd ever want or need + ability to install third-party extensions.

Based on a fork of [TavernAI](https://github.com/TavernAI/TavernAI) 1.2.8

## Important news!

1. We have created a [Documentation website](https://docs.sillytavern.app/) to answer most of your questions and help you get started.

2. Missing extensions after the update? Since the 1.10.6 release version, most of the previously built-in extensions have been converted to downloadable add-ons. You can download them via the built-in "Download Extensions and Assets" menu in the extensions panel (stacked blocks icon in the top bar).

### Brought to you by Cohee, RossAscends, and the SillyTavern community

### What is SillyTavern or TavernAI?

SillyTavern is a user interface you can install on your computer (and Android phones) that allows you to interact with text generation AIs and chat/roleplay with characters you or the community create.

SillyTavern is a fork of TavernAI 1.2.8 which is under more active development and has added many major features. At this point, they can be thought of as completely independent programs.

### Branches

SillyTavern is being developed using a two-branch system to ensure a smooth experience for all users.

* release -🌟 **Recommended for most users.** This is the most stable and recommended branch, updated only when major releases are pushed. It's suitable for the majority of users.
* staging - ⚠️ **Not recommended for casual use.** This branch has the latest features, but be cautious as it may break at any time. Only for power users and enthusiasts.

If you're not familiar with using the git CLI or don't understand what a branch is, don't worry! The release branch is always the preferable option for you.

### What do I need other than Tavern?

On its own Tavern is useless, as it's just a user interface. You have to have access to an AI system backend that can act as the roleplay character. There are various supported backends: OpenAPI API (GPT), KoboldAI (either running locally or on Google Colab), and more. You can read more about this in [the FAQ](https://docs.sillytavern.app/usage/faq/).

### Do I need a powerful PC to run Tavern?

Since Tavern is only a user interface, it has tiny hardware requirements, it will run on anything. It's the AI system backend that needs to be powerful.

## Mobile support

> **Note**

> **This fork can be run natively on Android phones using Termux. Please refer to this guide by ArroganceComplex#2659:**

<https://rentry.org/STAI-Termux>

## Questions or suggestions?

### We now have a community Discord server

Get support, share favorite characters and prompts:

### [Join](https://discord.gg/sillytavern)

***

Get in touch with the developers directly:

* Discord: cohee or rossascends
* Reddit: /u/RossAscends or /u/sillylossy
* [Post a GitHub issue](https://github.com/SillyTavern/SillyTavern/issues)

## This version includes

* A heavily modified TavernAI 1.2.8 (more than 50% of code rewritten or optimized)
* Swipes
* Group chats: multi-bot rooms for characters to talk to you or each other
* Chat checkpoints / branching
* Advanced KoboldAI / TextGen generation settings with a lot of community-made presets
* World Info support: create rich lore or save tokens on your character card
* [OpenRouter](https://openrouter.ai) connection for various APIs (Claude, GPT-4/3.5 and more)
* [Oobabooga's TextGen WebUI](https://github.com/oobabooga/text-generation-webui) API connection
* [AI Horde](https://horde.koboldai.net/) connection
* Prompt generation formatting tweaking

## Extensions

SillyTavern has extensibility support, with some additional AI modules hosted via [SillyTavern Extras API](https://github.com/SillyTavern/SillyTavern-extras)

* Author's Note / Character Bias
* Character emotional expressions (sprites)
* Auto-Summary of the chat history
* Sending images to chat, and the AI interpreting the content
* Stable Diffusion image generation (5 chat-related presets plus 'free mode')
* Text-to-speech for AI response messages (via ElevenLabs, Silero, or the OS's System TTS)

A full list of included extensions and tutorials on how to use them can be found in the [Docs](https://docs.sillytavern.app/).

## UI/CSS/Quality of Life tweaks by RossAscends

* Mobile UI optimized for iOS, and supports saving a shortcut to the home screen and opening in fullscreen mode.
* HotKeys
  * Up = Edit last message in chat
  * Ctrl+Up = Edit last USER message in chat
  * Left = swipe left
  * Right = swipe right (NOTE: swipe hotkeys are disabled when the chat bar has something typed into it)
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
  * Customizable page colors for 'main text', 'quoted text', and 'italics text'.
  * Customizable UI background color and blur amount

## Installation

*NOTE: This software is intended for local install purposes, and has not been thoroughly tested on a colab or other cloud notebook service.*

> **Warning**

> DO NOT INSTALL INTO ANY WINDOWS CONTROLLED FOLDER (Program Files, System32, etc).

> DO NOT RUN START.BAT WITH ADMIN PERMISSIONS

### Windows

Installing via Git (recommended for easy updating)

An easy-to-follow guide with pretty pictures:
<https://docs.sillytavern.app/installation/windows/>

  1. Install [NodeJS](https://nodejs.org/en) (latest LTS version is recommended)
  2. Install [GitHub Desktop](https://central.github.com/deployments/desktop/desktop/latest/win32)
  3. Open Windows Explorer (`Win+E`)
  4. Browse to or Create a folder that is not controlled or monitored by Windows. (ex: C:\MySpecialFolder\)
  5. Open a Command Prompt inside that folder by clicking in the 'Address Bar' at the top, typing `cmd`, and pressing Enter.
  6. Once the black box (Command Prompt) pops up, type ONE of the following into it and press Enter:

* for Release Branch: `git clone https://github.com/SillyTavern/SillyTavern -b release`
* for Staging Branch: `git clone https://github.com/SillyTavern/SillyTavern -b staging`

  7. Once everything is cloned, double-click `Start.bat` to make NodeJS install its requirements.
  8. The server will then start, and SillyTavern will pop up in your browser.

Installing via ZIP download (discouraged)

  1. Install [NodeJS](https://nodejs.org/en) (latest LTS version is recommended)
  2. Download the zip from this GitHub repo. (Get the `Source code (zip)` from [Releases](https://github.com/SillyTavern/SillyTavern/releases/latest))
  3. Unzip it into a folder of your choice
  4. Run `Start.bat` by double-clicking or in a command line.
  5. Once the server has prepared everything for you, it will open a tab in your browser.

### Linux

#### Unofficial Debian/Ubuntu PKGBUILD

> **This installation method is unofficial and not supported by the project. Report any issues to the PKGBUILD maintainer.**  
> The method is intended for Debian-based distributions (Ubuntu, Mint, etc).

1. Install [makedeb](https://www.makedeb.org/).
2. Ensure you have Node.js v18 or higher installed by running `node -v`. If you need to upgrade, you can install a [node.js repo](https://mpr.makedeb.org/packages/nodejs-repo) (you'll might need to edit the version inside the PKGBUILD). As an alternative, install and configure [nvm](https://mpr.makedeb.org/packages/nvm) to manage multiple node.js installations. Finally, you can [install node.js manually](https://nodejs.org/en/download), but you will need to update the PATH variable of your environment.
3. Now build the [sillytavern package](https://mpr.makedeb.org/packages/sillytavern). The build needs to run with the correct node.js version.

#### Manual

  1. Ensure you have Node.js v18 or higher (the latest [LTS version](https://nodejs.org/en/download/) is recommended) installed by running `node -v`.
Alternatively, use the [Node Version Manager](https://github.com/nvm-sh/nvm#installing-and-updating) script to quickly and easily manage your Node installations.
  2. Run the `start.sh` script.
  3. Enjoy.

## API keys management

SillyTavern saves your API keys to a `secrets.json` file in the server directory.

By default, they will not be exposed to a frontend after you enter them and reload the page.

In order to enable viewing your keys by clicking a button in the API block:

1. Set the value of `allowKeysExposure` to `true` in `config.yaml` file.
2. Restart the SillyTavern server.

## Remote connections

Most often this is for people who want to use SillyTavern on their mobile phones while their PC runs the ST server on the same wifi network.

However, it can be used to allow remote connections from anywhere as well.

**IMPORTANT: SillyTavern is a single-user program, so anyone who logs in will be able to see all characters and chats, and be able to change any settings inside the UI.**

### 1. Managing whitelisted IPs

* Create a new text file inside your SillyTavern base install folder called `whitelist.txt`.
* Open the file in a text editor, and add a list of IPs you want to be allowed to connect.

*Both individual IPs and wildcard IP ranges are accepted. Examples:*

```txt
192.168.0.1
192.168.0.20
```

or

```txt
192.168.0.*
```

(the above wildcard IP range will allow any device on the local network to connect)

CIDR masks are also accepted (eg. 10.0.0.0/24).

* Save the `whitelist.txt` file.
* Restart your TAI server.

Now devices which have the IP specified in the file will be able to connect.

*Note: `config.yaml` also has a `whitelist` array, which you can use in the same way, but this array will be ignored if `whitelist.txt` exists.*

### 2. Getting the IP for the ST host machine

After the whitelist has been setup, you'll need the IP of the ST-hosting device.

If the ST-hosting device is on the same wifi network, you will use the ST-host's internal wifi IP:

* For Windows: windows button > type `cmd.exe` in the search bar > type `ipconfig` in the console, hit Enter > look for `IPv4` listing.

If you (or someone else) want to connect to your hosted ST while not being on the same network, you will need the public IP of your ST-hosting device.

* While using the ST-hosting device, access [this page](https://whatismyipaddress.com/) and look for `IPv4`. This is what you would use to connect from the remote device.

### 3. Connect the remote device to the ST host machine

Whatever IP you ended up with for your situation, you will put that IP address and port number into the remote device's web browser.

A typical address for an ST host on the same wifi network would look like this:

`http://192.168.0.5:8000`

Use http:// NOT https://

### Opening your ST to all IPs

We do not recommend doing this, but you can open `config.yaml` and change `whitelistMode` to `false`.

You must remove (or rename) `whitelist.txt` in the SillyTavern base install folder if it exists.

This is usually an insecure practice, so we require you to set a username and password when you do this.

The username and password are set in `config.yaml`.

After restarting your ST server, any device will be able to connect to it, regardless of their IP as long as they know the username and password.

### Still Unable To Connect?

* Create an inbound/outbound firewall rule for the port found in `config.yaml`. Do NOT mistake this for port-forwarding on your router, otherwise, someone could find your chat logs and that's a big no-no.
* Enable the Private Network profile type in Settings > Network and Internet > Ethernet. This is VERY important for Windows 11, otherwise, you would be unable to connect even with the aforementioned firewall rules.

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

We're moving to a 100% original content only policy, so old background images have been removed from this repository.

You can find them archived here:

<https://files.catbox.moe/1xevnc.zip>

## Screenshots

<img width="400" alt="image" src="https://github.com/SillyTavern/SillyTavern/assets/61471128/e902c7a2-45a6-4415-97aa-c59c597669c1"> 
<img width="400" alt="image" src="https://github.com/SillyTavern/SillyTavern/assets/61471128/f8a79c47-4fe9-4564-9e4a-bf247ed1c961">


## License and credits

**This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.**

* TAI Base by Humi: Unknown license
* Cohee's modifications and derived code: AGPL v3
* RossAscends' additions: AGPL v3
* Portions of CncAnon's TavernAITurbo mod: Unknown license
* kingbri's various commits and suggestions (<https://github.com/bdashore3>)
* city_unit's extensions and various QoL features (<https://github.com/city-unit>)
* StefanDanielSchwarz's various commits and bug reports (<https://github.com/StefanDanielSchwarz>)
* Waifu mode inspired by the work of PepperTaco (<https://github.com/peppertaco/Tavern/>)
* Thanks Pygmalion University for being awesome testers and suggesting cool features!
* Thanks oobabooga for compiling presets for TextGen
* KoboldAI Presets from KAI Lite: <https://lite.koboldai.net/>
* Noto Sans font by Google (OFL license)
* Icon theme by Font Awesome <https://fontawesome.com> (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License)
* AI Horde client library by ZeldaFan0225: <https://github.com/ZeldaFan0225/ai_horde>
* Linux startup script by AlpinDale
* Thanks paniphons for providing a FAQ document
* 10K Discord Users Celebratory Background by @kallmeflocc
* Default content (characters and lore books) provided by @OtisAlejandro, @RossAscends and @kallmeflocc
* Korean translation by @doloroushyeonse
* k_euler_a support for Horde by <https://github.com/Teashrock>
* Chinese translation by [@XXpE3](https://github.com/XXpE3), 中文 ISSUES 可以联系 @XXpE3
