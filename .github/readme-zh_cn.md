> [!IMPORTANT]  
> 以下信息可能已经过时或不完整，仅供参考。请以英文版本为准，获取最新信息。

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

SillyTavern 为众多 LLM API（KoboldAI/CPP、Horde、NovelAI、Ooba、Tabby、OpenAI、OpenRouter、Claude、Mistral 等）提供统一界面，并支持移动端友好的布局、视觉小说模式、Automatic1111 与 ComfyUI API 图像生成集成、TTS、WorldInfo（Lorebooks）、可自定义 UI、自动翻译、丰富到超乎想象的提示词选项，以及通过第三方扩展不断成长的潜力。

我们提供了[文档网站](https://docs.sillytavern.app/)，可回答您的大部分问题，并帮助您快速入门。

## SillyTavern 是什么？

SillyTavern（简称 ST）是一个可本地安装的用户界面，可用于与文本生成 LLM、图像生成引擎和 TTS 语音模型交互。

SillyTavern 于 2023 年 2 月从 TavernAI 1.2.8 分叉而来，如今已有超过 300 位贡献者，并积累了 3 年的独立开发历程，仍然是资深 AI 爱好者的主流软件之一。

## 我们的愿景

1. 我们致力于让用户尽可能充分地发挥 LLM 提示词的作用，并掌握更高的控制权。陡峭的学习曲线也是乐趣的一部分！
2. 我们不提供任何在线服务或托管服务，也不会通过程序跟踪任何用户数据。
3. SillyTavern 是由热情的 LLM 爱好者社区打造的项目，并将始终保持免费和开源。

## 我需要一台性能强大的电脑来运行 SillyTavern 吗？

硬件要求很低：任何能运行 NodeJS 20 或更高版本的设备都可以运行 SillyTavern。如果您打算在本机进行 LLM 推理，我们建议使用至少配备 6GB 显存的 NVIDIA 3000 系列显卡；不过，实际要求会因所选模型和后端而异。

## 有问题或建议？

### Discord 服务器

| [![][discord-shield-badge]][discord-link] | [加入我们的 Discord 社区！](https://discord.gg/sillytavern) 获取支持，并分享您喜爱的角色和提示词。 |
| :---------------------------------------- | :---------------------------------------------------------------------------------------------- |

也可以直接联系开发者：

* Discord: cohee, rossascends, wolfsblvt
* Reddit: [/u/RossAscends](https://www.reddit.com/user/RossAscends/), [/u/sillylossy](https://www.reddit.com/user/sillylossy/), [u/Wolfsblvt](https://www.reddit.com/user/Wolfsblvt/)
* [提交 GitHub issue](https://github.com/SillyTavern/SillyTavern/issues)

### 我喜欢这个项目！我该如何贡献？

1. 提交 Pull Request。了解如何贡献：[CONTRIBUTING.md](../CONTRIBUTING.md)
2. 使用提供的模板提交功能建议和问题报告。
3. 请先完整阅读本 README 文件并查看文档网站，避免提交重复 issue。

## 屏幕截图

<img width="500" alt="image" src="https://github.com/user-attachments/assets/9b5f32f0-c3b3-4102-b3f5-0e9213c0f50f">
<img width="500" alt="image" src="https://github.com/user-attachments/assets/913fdbaa-7d33-42f1-ae2c-89dca41c53d1">

## 安装

如需详细安装说明，请访问我们的文档：

* **[Windows 安装指南](https://docs.sillytavern.app/installation/windows/)**
* **[MacOS/Linux 安装指南](https://docs.sillytavern.app/installation/linuxmacos/)**
* **[Android (Termux) 安装指南](https://docs.sillytavern.app/installation/android-(termux)/)**
* **[Docker 安装指南](https://docs.sillytavern.app/installation/docker/)**

## 许可证和致谢

**发布本程序是希望它能对您有所帮助，
但不提供任何保证；甚至不包含对
适销性或特定用途适用性的默示保证。
更多详情请参阅 GNU Affero 通用公共许可证。**

* [TavernAI](https://github.com/TavernAI/TavernAI) 1.2.8 by Humi: MIT 许可证
* 经许可使用了 CncAnon 的 TavernAITurbo mod 的部分内容
* 视觉小说模式的灵感来自 PepperTaco 的作品 (<https://github.com/peppertaco/Tavern/>)
* Noto Sans 字体由 Google 提供 (OFL 许可证)
* Lexer/Parser 由 Chevrotain 提供 (Apache-2.0 许可证) <https://github.com/chevrotain/chevrotain>
* 图标主题由 Font Awesome 提供 <https://fontawesome.com> (图标: CC BY 4.0, 字体: SIL OFL 1.1, 代码: MIT 许可证)
* 默认内容由 @OtisAlejandro (Seraphina 角色和 Lorebook) 和 @kallmeflocc (10K Discord 用户纪念背景) 提供
* Docker 指南由 [@mrguymiah](https://github.com/mrguymiah) 和 [@Bronya-Rand](https://github.com/Bronya-Rand) 提供
* kokoro-js 库由 [@hexgrad](https://github.com/hexgrad) 提供 (Apache-2.0 许可证)

## 主要贡献者

[![Contributors](https://contrib.rocks/image?repo=SillyTavern/SillyTavern)](https://github.com/SillyTavern/SillyTavern/graphs/contributors)

<!-- LINK GROUP -->
[cover]: https://github.com/user-attachments/assets/01a6ae9a-16aa-45f2-8bff-32b5dc587e44
[discord-link]: https://discord.gg/sillytavern
[discord-shield-badge]: https://img.shields.io/discord/1100685673633153084?color=5865F2&label=discord&labelColor=black&logo=discord&logoColor=white&style=for-the-badge
