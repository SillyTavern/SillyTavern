> [!IMPORTANT]  
> 这里的信息可能已经过时或不完整，仅供您参考。请使用英文版本获取最新信息。

<a name="readme-top"></a>

![][cover]

<div align="center">

[English](readme.md) | [German](readme-de_de.md) | 中文 | [繁體中文](readme-zh_tw.md) | [日本語](readme-ja_jp.md) | [Русский](readme-ru_ru.md) | [한국어](readme-ko_kr.md)

[![GitHub Stars](https://img.shields.io/github/stars/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/forks)
[![GitHub Issues](https://img.shields.io/github/issues/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/pulls)

</div>

---

SillyTavern 为众多 LLM API（KoboldAI/CPP、Horde、NovelAI、Ooba、Tabby、OpenAI、OpenRouter、Claude、Mistral 等）提供统一界面，拥有移动设备友好的布局、视觉小说模式、Automatic1111 & ComfyUI API 图像生成集成、TTS、世界书（lorebooks）、可自定义的 UI、自动翻译、超乎您想象的丰富 Prompt 选项，以及通过第三方扩展实现的无限增长潜力。

我们有一个[文档网站](https://docs.sillytavern.app/)来回答您的大部分问题并帮助您入门。

## SillyTavern 是什么？

SillyTavern（简称 ST）是一个本地安装的用户界面，允许您与文本生成 LLM、图像生成引擎和 TTS 语音模型进行交互。

SillyTavern 于 2023 年 2 月作为 TavernAI 1.2.8 的一个分支开始，如今已拥有超过 200 名贡献者和 2 年的独立开发经验，并继续作为资深 AI 爱好者领先的软件。

## 我们的愿景

1.  我们的目标是尽可能为用户提供 LLM Prompt 的最大效用和控制权。陡峭的学习曲线是乐趣的一部分！
2.  我们不提供任何在线或托管服务，也不会以编程方式跟踪任何用户数据。
3.  SillyTavern 是一个由专注的 LLM 爱好者社区为您带来的充满激情的项目，并且将永远是免费和开源的。

## 分支

SillyTavern 采用双分支进行开发，以确保所有用户都能获得流畅的使用体验。

- `release` -🌟 **推荐给大多数用户。** 这是最稳定、最推荐的分支，只有在重大版本推送时才会更新。适合大多数用户使用。通常每月更新一次。
- `staging` - ⚠️ **不建议随意使用。** 该分支拥有最新功能，但要谨慎，因为它随时可能崩溃。仅适用于高级用户和爱好者。每天更新数次。

如果你不熟悉使用 git 命令行，或者不了解什么是分支，别担心！`release` 分支始终是您的首选。

## 除了 SillyTavern，我还需要什么？

由于 SillyTavern 只是一个界面，您需要接入一个 LLM 后端来进行推理。您可以使用 AI Horde 进行开箱即用的聊天。除此之外，我们还支持许多其他本地和基于云的 LLM 后端：OpenAI 兼容 API、KoboldAI、Tabby 等等。您可以在[文档](https://docs.sillytavern.app/usage/api-connections/)中阅读更多关于我们支持的 API 的信息。

### 我需要一台性能强大的电脑来运行 SillyTavern 吗？

硬件要求很低：任何可以运行 NodeJS 18 或更高版本的设备都可以运行它。如果您打算在本地计算机上进行 LLM 推理，我们建议使用至少具有 6GB VRAM 的 3000 系列 NVIDIA 显卡。有关更多详细信息，请查看您后端的文档。

### 建议的后端（非附属）

- [AI Horde](https://aihorde.net/) - 使用志愿者托管的模型。无需进一步设置。
- [KoboldCpp](https://github.com/LostRuins/koboldcpp) - 社区最喜欢的在本地运行 GGUF 模型的工具。
- [tabbyAPI](https://github.com/theroyallab/tabbyAPI) - 一款流行的、轻量级的、本地托管的 exl2 推理 API。
- [OpenRouter](https://openrouter.ai) - 一个适用于许多云提供商（OpenAI、Claude、Meta Llama 等）以及流行社区模型的单一 API。

## 有问题或建议？

### Discord 服务器

| [![][discord-shield-badge]][discord-link] | [加入我们的 Discord 社区！](https://discord.gg/sillytavern) 获取支持，分享喜爱的角色和 Prompt。 |
| :---------------------------------------- | :---------------------------------------------------------------------------------------------- |

或者直接与开发人员联系：

- Discord: cohee, rossascends, wolfsblvt
- Reddit: [/u/RossAscends](https://www.reddit.com/user/RossAscends/), [/u/sillylossy](https://www.reddit.com/user/sillylossy/), [u/Wolfsblvt](https://www.reddit.com/user/Wolfsblvt/)
- [提交 GitHub 问题](https://github.com/SillyTavern/SillyTavern/issues)

### 我喜欢你的项目！我该如何贡献自己的力量？

1.  发送 Pull Request。学习如何贡献：[CONTRIBUTING.md](../CONTRIBUTING.md)
2.  使用提供的模板发送功能建议和问题报告。
3.  请先阅读整个 readme 文件并查看文档网站，以避免提交重复的问题。

## 屏幕截图

<img width="500" alt="image" src="https://github.com/user-attachments/assets/9b5f32f0-c3b3-4102-b3f5-0e9213c0f50f">
<img width="500" alt="image" src="https://github.com/user-attachments/assets/913fdbaa-7d33-42f1-ae2c-89dca41c53d1">

## 角色卡

SillyTavern 围绕“角色卡”的概念构建。角色卡是设定 LLM 行为的 Prompt 集合，是在 SillyTavern 中进行持久对话所必需的。它们的功能类似于 ChatGPT 的 GPTs 或 Poe 的 bots。角色卡的内容可以是任何东西：一个抽象的场景、一个为特定任务量身定制的助手、一个著名人物或一个虚构角色。

要在不选择角色卡的情况下进行快速对话或仅测试 LLM 连接，只需在打开 SillyTavern 后在欢迎屏幕的输入栏中键入您的 Prompt 输入。这将创建一个空的“助手”角色卡，您可以稍后自定义。

要大致了解如何定义角色卡，请参阅默认角色（Seraphina）或从“下载扩展和资源”菜单中下载选定的社区制作卡片。

## 主要功能

- 高级文本生成设置，包含许多社区制作的预设
- 世界书支持：创建丰富的传说或节省角色卡上的 Token
- 群聊：多机器人房间，供角色与您或彼此交谈
- 丰富的 UI 自定义选项：主题颜色、背景图片、自定义 CSS 等
- 用户角色：让 AI 了解一些关于您的信息，以获得更强的沉浸感
- 内置 RAG 支持：将文档添加到您的聊天中供 AI 参考
- 广泛的聊天命令子系统和自己的[脚本引擎](https://docs.sillytavern.app/usage/st-script/)

## 扩展

SillyTavern 支持扩展。

- 角色情绪表达
- 聊天记录自动摘要
- 自动 UI 和聊天翻译
- Stable Diffusion/FLUX/DALL-E 图像生成
- AI 回复消息的文本转语音（通过 ElevenLabs、Silero 或操作系统的 TTS）
- 网络搜索功能，为您的 Prompt 添加额外的现实世界背景信息
- 更多扩展可从“下载扩展和资源”菜单中下载。

有关如何使用它们的使用教程，请参阅[文档](https://docs.sillytavern.app/)。

## ⌛ 安装

### 🪟 Windows

> \[!WARNING]
>
> - 请勿安装到任何受 Windows 控制的文件夹（Program Files、System32 等）中。
> - 请勿以管理员权限运行 Start.bat
> - 无法在 Windows 7 上安装，因为它无法运行 NodeJS 18.16

#### 通过 Git 安装（推荐）

1.  安装 [NodeJS](https://nodejs.org/en)（建议使用最新的 LTS 版本）
2.  安装 [Git for Windows](https://gitforwindows.org/)
3.  打开 Windows 资源管理器 (`Win+E`)
4.  浏览或创建一个不受 Windows 控制或监控的文件夹（例如：C:\MySpecialFolder\)
5.  通过点击顶部的“地址栏”，输入 `cmd`，然后按 Enter，在该文件夹内打开命令提示符。
6.  弹出黑框（命令提示符）后，键入以下其中一项并按 Enter：

- Release 分支：`git clone https://github.com/SillyTavern/SillyTavern -b release`
- Staging 分支： `git clone https://github.com/SillyTavern/SillyTavern -b staging`

7.  等待所有内容克隆完成后，双击 `Start.bat` 以使 NodeJS 安装其依赖项。
8.  然后服务器将启动，SillyTavern 将在您的浏览器中弹出。

#### 通过 GitHub Desktop 安装

（这**仅**允许在 GitHub Desktop 中使用 git，如果您也想在命令行上使用 `git`，则还需要安装 [Git for Windows](https://gitforwindows.org/)）

1. 安装 [NodeJS](https://nodejs.org/en)（建议使用最新的 LTS 版本）
2. 安装 [GitHub Desktop](https://central.github.com/deployments/desktop/desktop/latest/win32)
3. 安装 GitHub Desktop 后，点击 `Clone a repository from the internet....`（注意：此步骤**无需**创建 GitHub 帐户）
4. 在菜单中，点击 URL 选项卡，输入此 URL `https://github.com/SillyTavern/SillyTavern`，然后点击 Clone。您可以更改本地路径以更改 SillyTavern 的下载位置。
5. 要打开 SillyTavern，请使用 Windows 资源管理器浏览到克隆存储库的文件夹。默认情况下，存储库将克 clone 到此处：`C:\Users\[您的 Windows 用户名]\Documents\GitHub\SillyTavern`
6. 双击 `start.bat` 文件。（注意：文件名的 `.bat` 部分可能被您的操作系统隐藏，在这种情况下，它将显示为一个名为“`Start`”的文件。双击此文件以运行 SillyTavern）
7. 双击后，应打开一个大的黑色命令控制台窗口，SillyTavern 将开始安装其运行所需的组件。
8. 安装过程完成后，如果一切正常，命令控制台窗口应如下所示，并且您的浏览器中应打开一个 SillyTavern 选项卡：
9. 连接到任何[支持的 API](https://docs.sillytavern.app/usage/api-connections/) 并开始聊天！

### 🐧 Linux & 🍎 MacOS

对于 MacOS / Linux，所有这些都将在终端中完成。

1.  安装 git 和 nodeJS（具体方法取决于您的操作系统）
2.  克隆仓库

- Release 分支：`git clone https://github.com/SillyTavern/SillyTavern -b release`
- Staging 分支： `git clone https://github.com/SillyTavern/SillyTavern -b staging`

3.  `cd SillyTavern` 导航到安装文件夹。
4.  使用以下命令之一运行 `start.sh` 脚本：

- `./start.sh`
- `bash start.sh`

## 🐋 通过 Docker 安装

这些说明假定您已安装 Docker，能够访问命令行以安装容器，并熟悉其常规操作。

### 使用 GitHub Container Registry

#### Docker Compose (最简单)

从 [GitHub 仓库](https://github.com/SillyTavern/SillyTavern/blob/release/docker/docker-compose.yml) 获取 `docker-compose.yml` 文件，并在文件所在目录中运行以下命令。这将从 GitHub Container Registry 中拉取最新的 release 镜像并启动容器，自动创建必要的卷。

```shell
docker-compose up
```

根据您的需求自定义 `docker-compose.yml` 文件。默认端口为 8000。如果您想使用环境变量调整服务器配置，请在此处阅读文档：[链接](https://docs.sillytavern.app/administration/config-yaml/#environment-variables)。

#### Docker CLI (高级)

您将需要两个强制性的目录映射和一个端口映射才能使 SillyTavern 正常运行。在命令中，替换以下位置中的选项：

#### 容器变量

##### 卷映射

- `CONFIG_PATH` - SillyTavern 配置文件将存储在主机上的目录
- `DATA_PATH` - SillyTavern 用户数据（包括角色）将存储在主机上的目录
- `PLUGINS_PATH` - (可选) SillyTavern 服务器插件将存储在主机上的目录
- `EXTENSIONS_PATH` - (可选) 全局 UI 扩展将存储在主机上的目录

##### 端口映射

- `PUBLIC_PORT` - 暴露流量的端口。这是强制性的，因为您将从其虚拟机容器外部访问实例。**在未实现单独的安全服务的情况下，请勿将其暴露给互联网。**

##### 附加设置

- `SILLYTAVERN_VERSION` - 在此 GitHub 页面的右侧，您会看到“Packages”。选择“sillytavern”包，您将看到镜像版本。镜像标签“latest”将使您与当前 release 保持同步。您还可以使用指向相应分支的每日镜像的“staging”标签。

#### 运行容器

1.  打开您的命令行
2.  在您要存储配置和数据文件的文件夹中运行以下命令：

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

> 默认情况下，容器将在前台运行。如果要在后台运行它，请将 `-d` 标志添加到 `docker run` 命令中。

### 自己构建镜像

我们有一个关于在 Docker 中使用 SillyTavern 的综合指南[在此处](http://docs.sillytavern.app/installation/docker/)，涵盖了 Windows、macOS 和 Linux 上的安装！如果您希望自己构建镜像，请阅读它。

## ⚡ 通过 SillyTavern Launcher 安装

SillyTavern Launcher 是一个安装向导，可帮助您进行多种选项的设置，包括为本地推理安装后端。

### 对于 Windows 用户

1.  在键盘上：按 **`WINDOWS + R`** 打开“运行”对话框。然后，运行以下命令安装 git：

```shell
cmd /c winget install -e --id Git.Git
```

2.  在键盘上：按 **`WINDOWS + E`** 打开文件资源管理器，然后导航到要安装启动器的文件夹。进入所需文件夹后，在地址栏中键入 `cmd` 并按 Enter。然后，运行以下命令：

```shell
git clone https://github.com/SillyTavern/SillyTavern-Launcher.git && cd SillyTavern-Launcher && start installer.bat
```

### 对于 Linux 用户

1.  打开您喜欢的终端并安装 git
2.  使用以下命令克隆 SillyTavern-Launcher：

```shell
git clone https://github.com/SillyTavern/SillyTavern-Launcher.git && cd SillyTavern-Launcher
```

3.  使用以下命令启动 installer.sh：

```shell
chmod +x install.sh && ./install.sh
```

4.  安装后使用以下命令启动 launcher.sh：

```shell
chmod +x launcher.sh && ./launcher.sh
```

### 对于 Mac 用户

1.  打开终端并使用以下命令安装 brew：

```shell
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2.  使用以下命令安装 git：

```shell
brew install git
```

3.  使用以下命令克隆 SillyTavern-Launcher：

```shell
git clone https://github.com/SillyTavern/SillyTavern-Launcher.git && cd SillyTavern-Launcher
```

4.  使用以下命令启动 installer.sh：

```shell
chmod +x install.sh && ./install.sh
```

5.  安装后使用以下命令启动 launcher.sh：

```shell
chmod +x launcher.sh && ./launcher.sh
```

## 📱 通过 Termux 在 Android OS 上安装

> \[!NOTE]
> **SillyTavern 可以在 Android 设备上使用 Termux 原生运行，但我们不为此用例提供官方支持。**
>
> **请参阅 ArroganceComplex#2659 编写的本指南：**
>
> - <https://rentry.org/STAI-Termux>

**不支持的平台：android arm LEtime-web。** 32 位 Android 需要一个无法通过 npm 安装的外部依赖项。使用以下命令安装它：`pkg install esbuild`。然后运行常规安装步骤。

## 命令行参数

您可以将命令行参数传递给 SillyTavern 服务器启动脚本，以覆盖 `config.yaml` 中的某些设置。

### 示例

```shell
node server.js --port 8000 --listen false
# 或
npm run start -- --port 8000 --listen false
# 或 (仅限 Windows)
Start.bat --port 8000 --listen false
```

### 支持的参数

> \[!TIP]
> 所有参数都不是必需的。如果您不提供它们，SillyTavern 将使用 `config.yaml` 中的设置。

| 选项                             | 描述                                           | 类型    |
| -------------------------------- | ---------------------------------------------- | ------- |
| `--version`                      | 显示版本号                                     | boolean |
| `--configPath`                   | 覆盖 config.yaml 文件的路径                    | string  |
| `--dataRoot`                     | 数据存储的根目录                               | string  |
| `--port`                         | 设置 SillyTavern 将在其下运行的端口            | number  |
| `--listen`                       | SillyTavern 将侦听所有网络接口                 | boolean |
| `--whitelist`                    | 启用白名单模式                                 | boolean |
| `--basicAuthMode`                | 启用基本身份验证                               | boolean |
| `--enableIPv4`                   | 启用 IPv4 协议                                 | boolean |
| `--enableIPv6`                   | 启用 IPv6 协议                                 | boolean |
| `--listenAddressIPv4`            | 要侦听的特定 IPv4 地址                         | string  |
| `--listenAddressIPv6`            | 要侦听的特定 IPv6 地址                         | string  |
| `--dnsPreferIPv6`                | DNS 首选 IPv6                                  | boolean |
| `--ssl`                          | 启用 SSL                                       | boolean |
| `--certPath`                     | 您的证书文件路径                               | string  |
| `--keyPath`                      | 您的私钥文件路径                               | string  |
| `--browserLaunchEnabled`         | 自动在浏览器中启动 SillyTavern                 | boolean |
| `--browserLaunchHostname`        | 自动运行主机名                                 | string  |
| `--browserLaunchPort`            | 覆盖自动运行的端口                             | string  |
| `--browserLaunchAvoidLocalhost`  | 在自动模式下避免使用 'localhost' 进行自动运行   | boolean |
| `--corsProxy`                    | 启用 CORS 代理                                 | boolean |
| `--requestProxyEnabled`          | 为传出请求启用代理                             | boolean |
| `--requestProxyUrl`              | 请求代理 URL（HTTP 或 SOCKS 协议）             | string  |
| `--requestProxyBypass`           | 请求代理绕过列表（以空格分隔的主机列表）        | array   |
| `--disableCsrf`                  | 禁用 CSRF 保护（不推荐）                       | boolean |

## 远程连接

这通常适用于那些想在手机上使用 SillyTavern，而他们的电脑在同一 Wi-Fi 网络上运行 ST 服务器的人。但是，它也可以用于允许从任何地方进行远程连接。

请在[文档](https://docs.sillytavern.app/usage/remoteconnections/)中阅读有关如何设置远程连接的详细指南。

您可能还需要配置 SillyTavern 用户配置文件（可选密码保护）：[用户](https://docs.sillytavern.app/administration/multi-user/)。

## 许可证和致谢

**本程序的分发是希望它能有用，但不提供任何保证；甚至没有对适销性或特定用途适用性的默示保证。有关更多详细信息，请参阅 GNU Affero 通用公共许可证。**

- [TavernAI](https://github.com/TavernAI/TavernAI) 1.2.8 by Humi: MIT 许可证
- CncAnon 的 TavernAITurbo mod 的部分内容经许可使用
- 视觉小说模式的灵感来自 PepperTaco 的工作 (<https://github.com/peppertaco/Tavern/>)
- Noto Sans 字体 by Google (OFL 许可证)
- 图标主题 by Font Awesome <https://fontawesome.com> (图标: CC BY 4.0, 字体: SIL OFL 1.1, 代码: MIT 许可证)
- 默认内容由 @OtisAlejandro (Seraphina 角色和世界书) 和 @kallmeflocc (10K Discord 用户庆祝背景) 提供
- Docker 指南由 [@mrguymiah](https://github.com/mrguymiah) 和 [@Bronya-Rand](https://github.com/Bronya-Rand) 提供
- kokoro-js 库由 [@hexgrad](https://github.com/hexgrad) 提供 (Apache-2.0 许可证)
- 中文翻译由 [@XXpE3](https://github.com/XXpE3) 完成，中文 ISSUES 可以联系 @XXpE3

## 主要贡献者

[![Contributors](https://contrib.rocks/image?repo=SillyTavern/SillyTavern)](https://github.com/SillyTavern/SillyTavern/graphs/contributors)

<!-- LINK GROUP -->

[cover]: https://github.com/user-attachments/assets/01a6ae9a-16aa-45f2-8bff-32b5dc587e44
[discord-link]: https://discord.gg/sillytavern
[discord-shield-badge]: https://img.shields.io/discord/1100685673633153084?color=5865F2&label=discord&labelColor=black&logo=discord&logoColor=white&style=for-the-badge
