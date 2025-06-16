<a name="readme-top"></a>

![][cover]

<div align="center">

English | [German](readme-de_de.md) | [中文](readme-zh_cn.md) | [繁體中文](readme-zh_tw.md) | [日本語](readme-ja_jp.md) | [Русский](readme-ru_ru.md) | [한국어](readme-ko_kr.md)

[![GitHub Stars](https://img.shields.io/github/stars/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/forks)
[![GitHub Issues](https://img.shields.io/github/issues/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/pulls)

</div>

---

SillyTavern provides a single unified interface for many LLM APIs (KoboldAI/CPP, Horde, NovelAI, Ooba, Tabby, OpenAI, OpenRouter, Claude, Mistral and more), a mobile-friendly layout, Visual Novel Mode, Automatic1111 & ComfyUI API image generation integration, TTS, WorldInfo (lorebooks), customizable UI, auto-translate, more prompt options than you'd ever want or need, and endless growth potential via third-party extensions.

We have a [Documentation website](https://docs.sillytavern.app/) to answer most of your questions and help you get started.

## What is SillyTavern?

SillyTavern (or ST for short) is a locally installed user interface that allows you to interact with text generation LLMs, image generation engines, and TTS voice models.

Beginning in February 2023 as a fork of TavernAI 1.2.8, SillyTavern now has over 200 contributors and 2 years of independent development under its belt, and continues to serve as a leading software for savvy AI hobbyists.

## Our Vision

1. We aim to empower users with as much utility and control over their LLM prompts as possible. The steep learning curve is part of the fun!
2. We do not provide any online or hosted services, nor programmatically track any user data.
3. SillyTavern is a passion project brought to you by a dedicated community of LLM enthusiasts, and will always be free and open sourced.

## Branches

SillyTavern is being developed using a two-branch system to ensure a smooth experience for all users.

* `release` -🌟 **Recommended for most users.** This is the most stable and recommended branch, updated only when major releases are pushed. It's suitable for the majority of users. Typically updated once a month.
* `staging` - ⚠️ **Not recommended for casual use.** This branch has the latest features, but be cautious as it may break at any time. Only for power users and enthusiasts. Updates several times daily.

If you're not familiar with using the git CLI or don't understand what a branch is, don't worry! The release branch is always the preferable option for you.

## What do I need other than SillyTavern?

Since SillyTavern is only an interface, you will need access to an LLM backend to provide inference. You can use AI Horde for instant out-of-the-box chatting. Aside from that, we support many other local and cloud-based LLM backends: OpenAI-compatible API, KoboldAI, Tabby, and many more. You can read more about our supported APIs in [the Docs](https://docs.sillytavern.app/usage/api-connections/).

### Do I need a powerful PC to run SillyTavern?

The hardware requirements are minimal: it will run on anything that can run NodeJS 18 or higher. If you intend to do LLM inference on your local machine, we recommend a 3000-series NVIDIA graphics card with at least 6GB of VRAM. Check your backend's documentation for more details.

### Suggested Backends (not affiliated)

* [AI Horde](https://aihorde.net/) - use models hosted by volunteers. Requires no further setup
* [KoboldCpp](https://github.com/LostRuins/koboldcpp) - a community's favorite for running GGUF models locally
* [tabbyAPI](https://github.com/theroyallab/tabbyAPI) - a popular, lightweight, locally-hosted exl2 inference API
* [OpenRouter](https://openrouter.ai) - a single API for many cloud providers (OpenAI, Claude, Meta Llama, etc.) as well as popular community models.

## Questions or suggestions?

### Discord server

| [![][discord-shield-badge]][discord-link] | [Join our Discord community!](https://discord.gg/sillytavern) Get support, share favorite characters and prompts. |
| :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |

Or get in touch with the developers directly:

* Discord: cohee, rossascends, wolfsblvt
* Reddit: [/u/RossAscends](https://www.reddit.com/user/RossAscends/), [/u/sillylossy](https://www.reddit.com/user/sillylossy/), [u/Wolfsblvt](https://www.reddit.com/user/Wolfsblvt/)
* [Post a GitHub issue](https://github.com/SillyTavern/SillyTavern/issues)

### I like your project! How do I contribute?

1. Send pull requests. Learn how to contribute: [CONTRIBUTING.md](../CONTRIBUTING.md)
2. Send feature suggestions and issue reports using the provided templates.
3. Read this entire readme file and check the documentation website first, to avoid sending duplicate issues.

## Screenshots

<img width="500" alt="image" src="https://github.com/user-attachments/assets/9b5f32f0-c3b3-4102-b3f5-0e9213c0f50f">
<img width="500" alt="image" src="https://github.com/user-attachments/assets/913fdbaa-7d33-42f1-ae2c-89dca41c53d1">

## Character Cards

SillyTavern is built around the concept of "character cards". A character card is a collection of prompts that set the behavior of the LLM and is required to have persistent conversations in SillyTavern. They function similarly to ChatGPT's GPTs or Poe's bots. The content of a character card can be anything: an abstract scenario, an assistant tailored for a specific task, a famous personality or a fictional character.

To have a quick conversation without selecting a character card or to just test the LLM connection, simply type your prompt input into the input bar on the Welcome Screen after opening SillyTavern. This will create an empty "Assistant" character card that you can customize later.

To get a general idea on how to define character cards, see the default character (Seraphina) or download selected community-made cards from the "Download Extensions & Assets" menu.

## Key Features

* Advanced text generation settings with many community-made presets
* World Info support: create rich lore or save tokens on your character card
* Group chats: multi-bot rooms for characters to talk to you and/or each other
* Rich UI customization options: theme colors, background images, custom CSS, and more
* User personas: let the AI know a bit about you for greater immersion
* Built-in RAG support: add documents to your chats for the AI to reference
* Extensive chat commands subsystem and own [scripting engine](https://docs.sillytavern.app/usage/st-script/)

## Extensions

SillyTavern has extensibility support.

* Character emotional expressions (sprites)
* Auto-Summary of the chat history
* Automatic UI and chat translation
* Stable Diffusion/FLUX/DALL-E image generation
* Text-to-speech for AI response messages (via ElevenLabs, Silero, or the OS's System TTS)
* Web Search capabilities for adding additional real world context to your prompts
* Many more are available to download from the "Download Extensions & Assets" menu.

Tutorials on how to use them can be found in the [Docs](https://docs.sillytavern.app/).

## ⌛ Installation

### 🪟 Windows

> \[!WARNING]
>
> * DO NOT INSTALL INTO ANY WINDOWS CONTROLLED FOLDER (Program Files, System32, etc).
> * DO NOT RUN START.BAT WITH ADMIN PERMISSIONS
> * INSTALLATION ON WINDOWS 7 IS IMPOSSIBLE AS IT CAN NOT RUN NODEJS 18.16

#### Installing via Git (recommended)

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

#### Installing via GitHub Desktop

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

### 🐧 Linux & 🍎 MacOS

For MacOS / Linux all of these will be done in a Terminal.

1. Install git and nodeJS (the method for doing this will vary depending on your OS)
2. Clone the repo

* for Release Branch: `git clone https://github.com/SillyTavern/SillyTavern -b release`
* for Staging Branch: `git clone https://github.com/SillyTavern/SillyTavern -b staging`

3. `cd SillyTavern` to navigate into the install folder.
4. Run the `start.sh` script with one of these commands:

* `./start.sh`
* `bash start.sh`

## 🐋 Installing via Docker

These instructions assume you have installed Docker, are able to access your command line for the installation of containers, and familiar with their general operation.

### Using the GitHub Container Registry

#### Docker Compose (easiest)

Grab the `docker-compose.yml` file from the [GitHub Repository](https://github.com/SillyTavern/SillyTavern/blob/release/docker/docker-compose.yml) and run the following command in the directory where the file is located. This will pull the latest release image from the GitHub Container Registry and start the container, automatically creating the necessary volumes.

```shell
docker-compose up
```

Customize the `docker-compose.yml` file to your needs. The default port is 8000. If you want to adjust the server configuration using environment variables, read the documentation [here](https://docs.sillytavern.app/administration/config-yaml/#environment-variables).

#### Docker CLI (advanced)

You will need two mandatory directory mappings and a port mapping to allow SillyTavern to function. In the command, replace your selections in the following places:

#### Container Variables

##### Volume Mappings

* `CONFIG_PATH` - The directory where SillyTavern configuration files will be stored on your host machine
* `DATA_PATH` - The directory where SillyTavern user data (including characters) will be stored on your host machine
* `PLUGINS_PATH` - (optional) The directory where SillyTavern server plugins will be stored on your host machine
* `EXTENSIONS_PATH` - (optional) The directory where global UI extensions will be stored on your host machine

##### Port Mappings

* `PUBLIC_PORT` - The port to expose the traffic on. This is mandatory, as you will be accessing the instance from outside of its virtual machine container. DO NOT expose this to the internet without implementing a separate service for security.

##### Additional Settings

* `SILLYTAVERN_VERSION` - On the right-hand side of this GitHub page, you'll see "Packages". Select the "sillytavern" package and you'll see the image versions. The image tag "latest" will keep you up-to-date with the current release. You can also utilize "staging" that points to the nightly image of the respective branch.

#### Running the container

1. Open your Command Line
2. Run the following command in a folder where you want to store the configuration and data files:

```bash
SILLYTAVERN_VERSION="latest"
PUBLIC_PORT="8000"
CONFIG_PATH="./config"
DATA_PATH="./data"
PLUGINS_PATH="./plugins"
EXTENSIONS_PATH="./extensions"

docker run \
  --name="sillytavern" \
  -p "$PUBLIC_PORT:8000/tcp" \
  -v "$CONFIG_PATH:/home/node/app/config:rw" \
  -v "$DATA_PATH:/home/node/app/data:rw" \
  -v "$EXTENSIONS_PATH:/home/node/app/public/scripts/extensions/third-party:rw" \
  -v "$PLUGINS_PATH:/home/node/app/plugins:rw" \
  ghcr.io/sillytavern/sillytavern:"$SILLYTAVERN_VERSION"
```

> By default the container will run in the foreground. If you want to run it in the background, add the `-d` flag to the `docker run` command.

### Building the image yourself

We have a comprehensive guide on using SillyTavern in Docker [here](http://docs.sillytavern.app/installation/docker/) which covers installations on Windows, macOS and Linux! Give it a read if you wish to build the image yourself.

### Common issues with Docker

#### SELinux Permission Issues with Mounted Volumes

Linux distributions with SELinux enabled (such as RHEL, CentOS, Fedora, etc.) may prevent Docker containers from accessing mounted volumes due to security policies. This can result in permission denied errors when the container tries to read or write to the mounted directories.

Two suffixes `:z` or `:Z` can be added to the volume mount. These suffixes tell Docker to relabel file objects on the shared volumes.

* The `z` option is used when the volume content will be shared between containers.
* The `Z` option is used when the volume content should only be used by the current container.

Example:

```yaml
# docker-compose.yml
volumes:
  ## Shared volume
  - ./config:/home/node/app/config:z
  ## Private volume
  - ./data:/home/node/app/data:Z
```

## ⚡ Installing via SillyTavern Launcher

SillyTavern Launcher is an installation wizard that will help you get setup with many options, including installing a backend for local inference.

### For Windows users

1. On your keyboard: press **`WINDOWS + R`** to open Run dialog box. Then, run the following command to install git:

```shell
cmd /c winget install -e --id Git.Git
```

2. On your keyboard: press **`WINDOWS + E`** to open File Explorer, then navigate to the folder where you want to install the launcher. Once in the desired folder, type `cmd` into the address bar and press enter. Then, run the following command:

```shell
git clone https://github.com/SillyTavern/SillyTavern-Launcher.git && cd SillyTavern-Launcher && start installer.bat
```

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

## 📱 Installing via Termux on Android OS

> \[!NOTE]
> **SillyTavern can be run natively on Android devices using Termux, but we do not provide official support for this use case.**
>
> **Please refer to this guide by ArroganceComplex#2659:**
>
> * <https://rentry.org/STAI-Termux>

**Unsupported platform: android arm LEtime-web.** 32-bit Android requires an external dependency that can't be installed with npm. Use the following command to install it: `pkg install esbuild`. Then run the usual installation steps.

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

> \[!TIP]
> None of the arguments are required. If you don't provide them, SillyTavern will use the settings in `config.yaml`.

| Option                          | Description                                                          | Type     |
|---------------------------------|----------------------------------------------------------------------|----------|
| `--version`                     | Show version number                                                  | boolean  |
| `--configPath`                  | Override the path to the config.yaml file                            | string   |
| `--dataRoot`                    | Root directory for data storage                                      | string   |
| `--port`                        | Sets the port under which SillyTavern will run                       | number   |
| `--listen`                      | SillyTavern will listen on all network interfaces                    | boolean  |
| `--whitelist`                   | Enables whitelist mode                                               | boolean  |
| `--basicAuthMode`               | Enables basic authentication                                         | boolean  |
| `--enableIPv4`                  | Enables IPv4 protocol                                                | boolean  |
| `--enableIPv6`                  | Enables IPv6 protocol                                                | boolean  |
| `--listenAddressIPv4`           | Specific IPv4 address to listen to                                   | string   |
| `--listenAddressIPv6`           | Specific IPv6 address to listen to                                   | string   |
| `--dnsPreferIPv6`               | Prefers IPv6 for DNS                                                 | boolean  |
| `--ssl`                         | Enables SSL                                                          | boolean  |
| `--certPath`                    | Path to your certificate file                                        | string   |
| `--keyPath`                     | Path to your private key file                                        | string   |
| `--browserLaunchEnabled`        | Automatically launch SillyTavern in the browser                      | boolean  |
| `--browserLaunchHostname`       | Browser launch hostname                                              | string   |
| `--browserLaunchPort`           | Overrides the port for browser launch                                | string   |
| `--browserLaunchAvoidLocalhost` | Avoids using 'localhost' for browser launch in auto mode             | boolean  |
| `--corsProxy`                   | Enables CORS proxy                                                   | boolean  |
| `--requestProxyEnabled`         | Enables a use of proxy for outgoing requests                         | boolean  |
| `--requestProxyUrl`             | Request proxy URL (HTTP or SOCKS protocols)                          | string   |
| `--requestProxyBypass`          | Request proxy bypass list (space separated list of hosts)            | array    |
| `--disableCsrf`                 | Disables CSRF protection (NOT RECOMMENDED)                           | boolean  |

## Remote connections

Most often this is for people who want to use SillyTavern on their mobile phones while their PC runs the ST server on the same Wi-Fi network. However, it can be used to allow remote connections from anywhere as well.

Read the detailed guide on how to set up remote connections in the [Docs](https://docs.sillytavern.app/usage/remoteconnections/).

You may also want to configure SillyTavern user profiles with (optional) password protection: [Users](https://docs.sillytavern.app/administration/multi-user/).

## License and credits

**This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.**

* [TavernAI](https://github.com/TavernAI/TavernAI) 1.2.8 by Humi: MIT License
* Portions of CncAnon's TavernAITurbo mod used with permission
* Visual Novel Mode inspired by the work of PepperTaco (<https://github.com/peppertaco/Tavern/>)
* Noto Sans font by Google (OFL license)
* Icon theme by Font Awesome <https://fontawesome.com> (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License)
* Default content by @OtisAlejandro (Seraphina character and lorebook) and @kallmeflocc (10K Discord Users Celebratory Background)
* Docker guide by [@mrguymiah](https://github.com/mrguymiah) and [@Bronya-Rand](https://github.com/Bronya-Rand)
* kokoro-js library by [@hexgrad](https://github.com/hexgrad) (Apache-2.0 License)

## Top Contributors

[![Contributors](https://contrib.rocks/image?repo=SillyTavern/SillyTavern)](https://github.com/SillyTavern/SillyTavern/graphs/contributors)

<!-- LINK GROUP -->
[cover]: https://github.com/user-attachments/assets/01a6ae9a-16aa-45f2-8bff-32b5dc587e44
[discord-link]: https://discord.gg/sillytavern
[discord-shield-badge]: https://img.shields.io/discord/1100685673633153084?color=5865F2&label=discord&labelColor=black&logo=discord&logoColor=white&style=for-the-badge
