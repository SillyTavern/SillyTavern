<a name="readme-top"></a>

English | [中文](readme-zh_cn.md) | [日本語](readme-ja_jp.md) | [Русский](readme-ru_ru.md)

![][cover]

SillyTavern provides a mobile-friendly layout, support for 17+ LLM APIs (KoboldAI/CPP, Horde, NovelAI, Ooba, Tabby, OpenAI, OpenRouter, Claude, Mistral and more), Visual Novel Mode, Automatic1111 & ComfyUI API image generation integration, TTS, WorldInfo (lorebooks), customizable UI, auto-translate, more prompt options than you'd ever want or need, and endless growth potential via third-party extensions.

## Important News

1. We have created a [Documentation website](https://docs.sillytavern.app/) to answer most of your questions and help you get started.

2. Missing extensions after the update? Since the 1.10.6 release version, most of the previously built-in extensions have been converted to downloadable add-ons. You can download them via the built-in "Download Extensions and Assets" menu in the extensions panel (stacked blocks icon in the top bar).

3. Unsupported platform: android arm LEtime-web. 32-bit Android requires an external dependency that can't be installed with npm. Use the following command to install it: `pkg install esbuild`. Then run the usual installation steps.

### What is SillyTavern?

SillyTavern is a locally installed user interface that allows you to interact with text generation LLMs, image generation engines, and TTS voice models.

Beginning in February 2023 as a fork of TavernAI 1.2.8, SillyTavern quickly became a leader and trendsetter for LLM frontend software.

With now more than 100 contributors and almost 2 year of independent development, SillyTavern is considered an entirely different program from the original TavernAI.

## Our Vision

**Brought to you by a dedicated community of LLM enthusiasts, SillyTavern will always be free and open-source.**

1. We aim to empower users with as much utility and control over their LLM prompts as possible. The steep learning curve is part of the fun!
2. We do not provide any online or hosted services, nor programatically track any user data.
3. SillyTavern is a passion project, and will always be free and open sourced.

## Screenshots

<img width="400" alt="image" src="https://github.com/SillyTavern/SillyTavern/assets/61471128/e902c7a2-45a6-4415-97aa-c59c597669c1">
<img width="400" alt="image" src="https://github.com/SillyTavern/SillyTavern/assets/61471128/f8a79c47-4fe9-4564-9e4a-bf247ed1c961">

### Branches

SillyTavern is being developed using a two-branch system to ensure a smooth experience for all users.

* `release` -🌟 **Recommended for most users.** This is the most stable and recommended branch, updated only when major releases are pushed. It's suitable for the majority of users. Typically updated once a month.
* `staging` - ⚠️ **Not recommended for casual use.** This branch has the latest features, but be cautious as it may break at any time. Only for power users and enthusiasts. Updates several times daily.

If you're not familiar with using the git CLI or don't understand what a branch is, don't worry! The release branch is always the preferable option for you.

### What do I need other than SillyTavern?

Since SillyTavern is only an interface, you will need access to an LLM backend to provide inference. You can use KoboldAI Horde for instant out-of-the-box chatting. Aside from that, we support many other local and cloud-based LLM backends: OpenAI-compatible API, KoboldAI, Tabby, and many more. You can read more about our supported APIs in [the FAQ](https://docs.sillytavern.app/usage/faq/).

**Suggested Backends (not affiliated):**

* [AI Horde](https://aihorde.net/) - use models hosted by volunteers. Requires no further setup
* [KoboldCpp](https://github.com/LostRuins/koboldcpp) - a community's favorite for running GGUF models locally
* [tabbyAPI](https://github.com/theroyallab/tabbyAPI) - a popular, lightweight, locally-hosted exl2 inference API
* [OpenRouter](https://openrouter.ai) - a single API for many cloud providers (OpenAI, Claude, Meta Llama, etc.) as well as popular community models.

### Do I need a powerful PC to run SillyTavern?

The hardware requirements are minimal: it will run on anything that can run NodeJS 18+. If you intend to do LLM inference on your local machine, we recommend a 3000-series NVIDIA graphics card with at least 6GB of VRAM. Check your backend's documentation for more details.

## Questions or suggestions?

### Discord server

| [![][discord-shield-badge]][discord-link] | [Join our Discord community!](https://discord.gg/sillytavern) Get support, share favorite characters and prompts. |
| :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |

Or get in touch with the developers directly:

* Discord: cohee or rossascends
* Reddit: [/u/RossAscends](https://www.reddit.com/user/RossAscends/) or [/u/sillylossy](https://www.reddit.com/user/sillylossy/)
* [Post a GitHub issue](https://github.com/SillyTavern/SillyTavern/issues)

### I like your project! How do I contribute?

1. Send pull requests. Learn how to contribute: [CONTRIBUTING.md](../CONTRIBUTING.md)
2. Send feature suggestions and issue reports using the provided templates.
3. Read this entire readme file and the check the documentation website first, to avoid sending duplicate issues.

## Key Features

* Advanced text generation settings with many community-made presets
* World Info support: create rich lore or save tokens on your character card
* Group chats: multi-bot rooms for characters to talk to you and/or each other
* Rich UI customization options: theme colors, background images, custom CSS, and more
* User personas: let the AI know a bit about you for greater immersion
* Built-in RAG support: add documents to your chats for the AI to reference

## Extensions

SillyTavern has extensibility support.

* Character emotional expressions (sprites)
* Auto-Summary of the chat history
* Automatic UI and chat translation
* Stable Diffusion/FLUX/DALL-E image generation
* Text-to-speech for AI response messages (via ElevenLabs, Silero, or the OS's System TTS)
* Web Search capabilities for adding additional real world context to your prompts
* Many more available to download from the "Download Extensions & Assets" menu.

Tutorials on how to use them can be found in the [Docs](https://docs.sillytavern.app/).

# ⌛ Installation

> \[!WARNING]
>
> * DO NOT INSTALL INTO ANY WINDOWS CONTROLLED FOLDER (Program Files, System32, etc).
> * DO NOT RUN START.BAT WITH ADMIN PERMISSIONS
> * INSTALLATION ON WINDOWS 7 IS IMPOSSIBLE AS IT CAN NOT RUN NODEJS 18.16

## 🪟 Windows

## Installing via Git

  1. Install [NodeJS](https://nodejs.org/en) (latest LTS version is recommended)
  2. Install [Git for Windows](https://gitforwindows.org/)
  3. Open Windows Explorer (`Win+E`)
  4. Browse to or Create a folder that is not controlled or monitored by Windows. (ex: C:\MySpecialFolder\)
  5. Open a Command Prompt inside that folder by clicking in the 'Address Bar' at the top, typing `cmd`, and pressing Enter.
  6. Once the black box (Command Prompt) pops up, type ONE of the following into it and press Enter:

* for Release Branch: `git clone https://github.com/SillyTavern/SillyTavern -b release`
* for Staging Branch: `git clone https://github.com/SillyTavern/SillyTavern -b staging`

  7. Once everything is cloned, double-click `Start.bat` to make NodeJS install its requirements.
  8. The server will then start, and SillyTavern will pop up in your browser.

## Installing via SillyTavern Launcher

1. On your keyboard: press **`WINDOWS + R`** to open Run dialog box. Then, run the following command to install git:

```shell
cmd /c winget install -e --id Git.Git
```

2. On your keyboard: press **`WINDOWS + E`** to open File Explorer, then navigate to the folder where you want to install the launcher. Once in the desired folder, type `cmd` into the address bar and press enter. Then, run the following command:

```shell
git clone https://github.com/SillyTavern/SillyTavern-Launcher.git && cd SillyTavern-Launcher && start installer.bat
```

## Installing via GitHub Desktop

(This allows git usage **only** in GitHub Desktop, if you want to use `git` on the command line too, you also need to install [Git for Windows](https://gitforwindows.org/))

  1. Install [NodeJS](https://nodejs.org/en) (latest LTS version is recommended)
  2. Install [GitHub Desktop](https://central.github.com/deployments/desktop/desktop/latest/win32)
  3. After installing GitHub Desktop, click on `Clone a repository from the internet....` (Note: You **do NOT need** to create a GitHub account for this step)
  4. On the menu, click the URL tab, enter this URL `https://github.com/SillyTavern/SillyTavern`, and click Clone. You can change the Local path to change where SillyTavern is going to be downloaded.
  6. To open SillyTavern, use Windows Explorer to browse into the folder where you cloned the repository. By default, the repository will be cloned here: `C:\Users\[Your Windows Username]\Documents\GitHub\SillyTavern`
  7. Double-click on the `start.bat` file. (Note: the `.bat` part of the file name might be hidden by your OS, in that case, it will look like a file called "`Start`". This is what you double-click to run SillyTavern)
  8. After double-clicking, a large black command console window should open and SillyTavern will begin to install what it needs to operate.
  9. After the installation process, if everything is working, the command console window should look like this and a SillyTavern tab should be open in your browser:
  10. Connect to any of the [supported APIs](https://docs.sillytavern.app/usage/api-connections/) and start chatting!

## 🐧 Linux & 🍎 MacOS

For MacOS / Linux all of these will be done in a Terminal.

1. Install git and nodeJS (the method for doing this will vary depending on your OS)
2. Clone the repo

* for Release Branch: `git clone https://github.com/SillyTavern/SillyTavern -b release`
* for Staging Branch: `git clone https://github.com/SillyTavern/SillyTavern -b staging`

3. `cd SillyTavern` to navigate into the install folder.
4. Run the `start.sh` script with one of these commands:

* `./start.sh`
* `bash start.sh`

## Installing via SillyTavern Launcher

### For Linux users

1. Open your favorite terminal and install git
2. Git clone the Sillytavern-Launcher with:

```shell
git clone https://github.com/SillyTavern/SillyTavern-Launcher.git && cd SillyTavern-Launcher
```

3. Start the installer.sh with:

```shell
chmod +x install.sh && ./install.sh
```

4. After installation start the launcher.sh with:

```shell
chmod +x launcher.sh && ./launcher.sh
```

### For Mac users

1. Open a terminal and install brew with:

```shell
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2. Install git with:

```shell
brew install git
```

3. Git clone the Sillytavern-Launcher with:

```shell
git clone https://github.com/SillyTavern/SillyTavern-Launcher.git && cd SillyTavern-Launcher
```

4. Start the installer.sh with:

```shell
chmod +x install.sh && ./install.sh
```

5. After installation start the launcher.sh with:

```shell
chmod +x launcher.sh && ./launcher.sh
```

## 🐋 Installing via Docker

These instructions assume you have installed Docker, are able to access your command line for the installation of containers, and familiar with their general operation.

### Building the image yourself

We have a comprehensive guide on using SillyTavern in Docker [here](http://docs.sillytavern.app/installation/docker/) which covers installations on Windows, macOS and Linux! Give it a read if you wish to build the image yourself.

### Using the GitHub Container Registry (easiest)

You will need two mandatory directory mappings and a port mapping to allow SillyTavern to function. In the command, replace your selections in the following places:

#### Container Variables

##### Volume Mappings

* [config] - The directory where SillyTavern configuration files will be stored on your host machine
* [data] - The directory where SillyTavern user data (including characters) will be stored on your host machine
* [plugins] - (optional) The directory where SillyTavern server plugins will be stored on your host machine

##### Port Mappings

* [PublicPort] - The port to expose the traffic on. This is mandatory, as you will be accessing the instance from outside of its virtual machine container. DO NOT expose this to the internet without implementing a separate service for security.

##### Additional Settings

* [DockerNet] - The docker network that the container should be created with a connection to. If you don't know what it is, see the [official Docker documentation](https://docs.docker.com/reference/cli/docker/network/).
* [version] - On the right-hand side of this GitHub page, you'll see "Packages". Select the "sillytavern" package and you'll see the image versions. The image tag "latest" will keep you up-to-date with the current release. You can also utilize "staging" and "release" tags that point to the nightly images of the respective branches, but this may not be appropriate, if you are utilizing extensions that could be broken, and may need time to update.

#### Install command

1. Open your Command Line
2. Run the following command

`docker create --name='sillytavern' --net='[DockerNet]' -p '8000:8000/tcp' -v '[plugins]':'/home/node/app/plugins':'rw' -v '[config]':'/home/node/app/config':'rw' -v '[data]':'/home/node/app/data':'rw' 'ghcr.io/sillytavern/sillytavern:[version]'`

> Note that 8000 is a default listening port. Don't forget to use an appropriate port if you change it in the config.

## 📱 Mobile - Installing via termux

> \[!NOTE]
> **SillyTavern can be run natively on Android phones using Termux. Please refer to this guide by ArroganceComplex#2659:**
>
> * <https://rentry.org/STAI-Termux>

## API keys management

SillyTavern saves your API keys to a `secrets.json` file in the user data directory (`/data/default-user/secrets.json` is the default path).

By default, they will not be exposed to a frontend after you enter them and reload the page.

In order to enable viewing your keys by clicking a button in the API block:

1. Set the value of `allowKeysExposure` to `true` in `config.yaml` file.
2. Restart the SillyTavern server.

## Command-line arguments

You can pass command-line arguments to SillyTavern server startup to override some settings in `config.yaml`.

### Examples

```shell
node server.js --port 8000 --listen false
# or
npm run start -- --port 8000 --listen false
# or (Windows only)
Start.bat --port 8000 --listen false
```

### Supported arguments

| Option                  | Description                                                                                          | Type     | Default                      |
|-------------------------|------------------------------------------------------------------------------------------------------|----------|------------------------------|
| `--version`             | Show version number                                                                                  | boolean  |                              |
| `--enableIPv6`          | Enables IPv6.                                                                                        | boolean  | false                        |
| `--enableIPv4`          | Enables IPv4.                                                                                        | boolean  | true                         |
| `--port`                | Sets the port under which SillyTavern will run. If not provided falls back to yaml config 'port'.    | number   | 8000                         |
| `--dnsPreferIPv6`       | Prefers IPv6 for dns. If not provided falls back to yaml config 'preferIPv6'.                        | boolean  | false                        |
| `--autorun`             | Automatically launch SillyTavern in the browser. If not provided falls back to yaml config 'autorun'.| boolean  | false                        |
| `--autorunHostname`     | The autorun hostname, probably best left on 'auto'.                                                  | string   | null                         |
| `--autorunPortOverride` | Overrides the port for autorun.                                                                      | string   | null                         |
| `--listen`              | SillyTavern is listening on all network interfaces. If not provided falls back to yaml config 'listen'.| boolean  | false                        |
| `--corsProxy`           | Enables CORS proxy. If not provided falls back to yaml config 'enableCorsProxy'.                     | boolean  | false                        |
| `--disableCsrf`         | Disables CSRF protection                                                                             | boolean  | null                         |
| `--ssl`                 | Enables SSL                                                                                          | boolean  | false                        |
| `--certPath`            | Path to your certificate file.                                                                       | string   | "certs/cert.pem"             |
| `--keyPath`             | Path to your private key file.                                                                       | string   | "certs/privkey.pem"          |
| `--whitelist`           | Enables whitelist mode                                                                               | boolean  | null                         |
| `--dataRoot`            | Root directory for data storage                                                                      | string   | null                         |
| `--avoidLocalhost`      | Avoids using 'localhost' for autorun in auto mode.                                                   | boolean  | null                         |
| `--basicAuthMode`       | Enables basic authentication                                                                         | boolean  | null                         |
| `--requestProxyEnabled` | Enables a use of proxy for outgoing requests                                                         | boolean  | null                         |
| `--requestProxyUrl`     | Request proxy URL (HTTP or SOCKS protocols)                                                          | string   | null                         |
| `--requestProxyBypass`  | Request proxy bypass list (space separated list of hosts)                                            | array    | null                         |

## Remote connections

Most often this is for people who want to use SillyTavern on their mobile phones while their PC runs the ST server on the same wifi network.

However, it can be used to allow remote connections from anywhere as well.

**IMPORTANT: Refer to the official guide if you want to configure SillyTavern user accounts with (optional) password protection: [Users](https://docs.sillytavern.app/installation/st-1.12.0-migration-guide/#users).**

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
* Restart your ST server.

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

1. Disable Blur Effect and enable Reduced Motion on the User Settings panel (UI Theme toggles category).
2. If using response streaming, set the streaming FPS to a lower value (10-15 FPS is recommended).

## License and credits

**This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.**

* [TavernAI](https://github.com/TavernAI/TavernAI) 1.2.8 Base by Humi: MIT
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
* Docker guide by [@mrguymiah](https://github.com/mrguymiah) and [@Bronya-Rand](https://github.com/Bronya-Rand)

<!-- LINK GROUP -->
[cover]: https://github.com/SillyTavern/SillyTavern/assets/18619528/c2be4c3f-aada-4f64-87a3-ae35a68b61a4
[discord-link]: https://discord.gg/sillytavern
[discord-shield-badge]: https://img.shields.io/discord/1100685673633153084?color=5865F2&label=discord&labelColor=black&logo=discord&logoColor=white&style=for-the-badge
