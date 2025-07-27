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

## 我需要一台性能强大的电脑来运行 SillyTavern 吗？

硬件要求很低：任何可以运行 NodeJS 18 或更高版本的设备都可以运行它。如果您打算在本地计算机上进行 LLM 推理，我们建议使用至少具有 6GB VRAM 的 3000 系列 NVIDIA 显卡，但实际要求可能会根据模型和您使用的后端而有所不同。

## 有问题或建议？

### Discord 服务器

| [![][discord-shield-badge]][discord-link] | [加入我们的 Discord 社区！](https://discord.gg/sillytavern) 获取支持，分享喜爱的角色和 Prompt。 |
| :---------------------------------------- | :---------------------------------------------------------------------------------------------- |

或者直接与开发人员联系：

* Discord: cohee, rossascends, wolfsblvt
* Reddit: [/u/RossAscends](https://www.reddit.com/user/RossAscends/), [/u/sillylossy](https://www.reddit.com/user/sillylossy/), [u/Wolfsblvt](https://www.reddit.com/user/Wolfsblvt/)
* [提交 GitHub 问题](https://github.com/SillyTavern/SillyTavern/issues)

### 我喜欢你的项目！我该如何贡献自己的力量？

1.  发送 Pull Request。学习如何贡献：[CONTRIBUTING.md](../CONTRIBUTING.md)
2.  使用提供的模板发送功能建议和问题报告。
3.  请先阅读整个 readme 文件并查看文档网站，以避免提交重复的问题。

## 屏幕截图

<img width="500" alt="image" src="https://github.com/user-attachments/assets/9b5f32f0-c3b3-4102-b3f5-0e9213c0f50f">
<img width="500" alt="image" src="https://github.com/user-attachments/assets/913fdbaa-7d33-42f1-ae2c-89dca41c53d1">

## 安装

有关详细的安装说明，请访问我们的文档：

* **[Windows 安装指南](https://docs.sillytavern.app/installation/windows/)**
* **[MacOS/Linux 安装指南](https://docs.sillytavern.app/installation/linuxmacos/)**
* **[Android (Termux) 安装指南](https://docs.sillytavern.app/installation/android-(termux)/)**
* **[Docker 安装指南](https://docs.sillytavern.app/installation/docker/)**

## 许可证和致谢

**本程序的分发是希望它能有用，但不提供任何保证；甚至没有对适销性或特定用途适用性的默示保证。有关更多详细信息，请参阅 GNU Affero 通用公共许可证。**

* [TavernAI](https://github.com/TavernAI/TavernAI) 1.2.8 by Humi: MIT 许可证
* CncAnon 的 TavernAITurbo mod 的部分内容经许可使用
* 视觉小说模式的灵感来自 PepperTaco 的工作 (<https://github.com/peppertaco/Tavern/>)
* Noto Sans 字体 by Google (OFL 许可证)
* 图标主题 by Font Awesome <https://fontawesome.com> (图标: CC BY 4.0, 字体: SIL OFL 1.1, 代码: MIT 许可证)
* 默认内容由 @OtisAlejandro (Seraphina 角色和世界书) 和 @kallmeflocc (10K Discord 用户庆祝背景) 提供
* Docker 指南由 [@mrguymiah](https://github.com/mrguymiah) 和 [@Bronya-Rand](https://github.com/Bronya-Rand) 提供
* kokoro-js 库由 [@hexgrad](https://github.com/hexgrad) 提供 (Apache-2.0 许可证)

## 主要贡献者

[![Contributors](https://contrib.rocks/image?repo=SillyTavern/SillyTavern)](https://github.com/SillyTavern/SillyTavern/graphs/contributors)

<!-- LINK GROUP -->
[cover]: https://github.com/user-attachments/assets/01a6ae9a-16aa-45f2-8bff-32b5dc587e44
[discord-link]: https://discord.gg/sillytavern
[discord-shield-badge]: https://img.shields.io/discord/1100685673633153084?color=5865F2&label=discord&labelColor=black&logo=discord&logoColor=white&style=for-the-badge
