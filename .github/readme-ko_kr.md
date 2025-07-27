> [!IMPORTANT]
> 이곳에 게재된 정보는 오래되거나 불완전할 수 있습니다. 최신 정보는 영어 버전을 이용하십시오.

<a name="readme-top"></a>

![][cover]

<div align="center">

[English](readme.md) | [German](readme-de_de.md) | [中文](readme-zh_cn.md) | [繁體中文](readme-zh_tw.md) | [日本語](readme-ja_jp.md) | [Русский](readme-ru_ru.md) | 한국어

[![GitHub Stars](https://img.shields.io/github/stars/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/forks)
[![GitHub Issues](https://img.shields.io/github/issues/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/pulls)

</div>

---

SillyTavern은 많은 LLM API(KoboldAI/CPP, Horde, NovelAI, Ooba, Tabby, OpenAI, OpenRouter, Claude, Mistral 등)에 대한 단일 통합 인터페이스, 모바일 친화적 레이아웃, 비주얼 노벨 모드, Automatic1111 & ComfyUI API 이미지 생성 통합, TTS, 월드 인포 (로어북), 커스텀 가능한 UI, 자동 번역, 필요 이상의 프롬프트 옵션, 그리고 서드파티 확장을 통한 무궁무진한 성장 가능성을 제공합니다.

또한, 자주 묻는 질문에 대한 답변과, 시작하는 데 도움을 주기 위한 [문서 웹사이트](https://docs.sillytavern.app/)가 있습니다.

## SillyTavern이 무엇인가요?

SillyTavern(짧게는 ST)은 텍스트 생성 LLM, 이미지 생성 엔진, TTS 음성 모델 등과 상호작할 수 있는 로컬 설치형 UI 입니다.

2023년 2월, TavernAI 1.2.8의 포크로 시작한 SillyTavern은 현재 200명이 넘는 기여자를 보유하고 있으며, 2년간의 독자적인 개발을 거쳐 숙련된 AI 애호가들을 위한 선도적인 소프트웨어로 자리매김하고 있습니다.

## 우리의 비전

1. 저희는 사용자가 LLM 프롬프트에 대한 최대한의 유용성과 제어 능력을 갖도록 하는 것을 목표로 합니다. 빠르게 배우는 것 역시 재미의 일부입니다!
2. 저희는 어떠한 온라인 및 호스팅 서브시도 제공하지 않으며, 프로그래밍으로 사용자의 데이터를 추적하지 않습니다.
3. SillyTavern은 헌신적인 LLM 커뮤니티가 여러분에게 제공하는 열정적인 프로젝트이며, 언제나 무료이며 오픈소스로 제공될 것입니다.

## SillyTavern을 위해서 좋은 성능의 PC가 필요한가요?

하드웨어 요구 사항은 거의 없습니다: NodeJS 18 이상을 실행할 수 있는 모든 환경에서 작동합니다. 다만 로컬 LLM 모델을 사용할 경우, 최소 6GB VRAM 이상의 3000번대 NVIDIA 그래픽 카드를 권장하지만, 실제 요구 사항은 사용하는 모델과 백엔드에 따라 달라질 수 있습니다.

## 질문이나 제안이 있으신가요?

### 디스코드 서버

| [![][discord-shield-badge]][discord-link] | [저희의 디스코드에 참여하세요!](https://discord.gg/sillytavern) 지원을 받고, 좋아하는 캐릭터와 프롬프트를 공유하세요. |
| :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |

혹은 저희의 개발자들과 직접 연락할 수 있습니다:

* 디스코드: cohee, rossascends, wolfsblvt
* 레딧: [/u/RossAscends](https://www.reddit.com/user/RossAscends/), [/u/sillylossy](https://www.reddit.com/user/sillylossy/), [u/Wolfsblvt](https://www.reddit.com/user/Wolfsblvt/)
* [GitHub issue를 작성하세요](https://github.com/SillyTavern/SillyTavern/issues)

### 이 프로젝트가 마음에 들어요! 어떻게 기여할 수 있을까요?

1. PULL REQUEST를 생성하세요. 기여 방법에 대해서는 [CONTRIBUTING.md](../CONTRIBUTING.md)를 참고하세요.
2. 제공된 탬플릿에 따라 기능 제안이나 이슈 리포트를 생성하세요.
3. 중복된 이슈를 생성하지 않도록 이 README 파일 전체를 읽고 문서 웹사이트를 먼저 확인하세요.

## 스크린샷

<img width="500" alt="image" src="https://github.com/user-attachments/assets/9b5f32f0-c3b3-4102-b3f5-0e9213c0f50f">
<img width="500" alt="image" src="https://github.com/user-attachments/assets/913fdbaa-7d33-42f1-ae2c-89dca41c53d1">

## 설치

자세한 설치 방법은 저희의 문서를 확인하세요:

* **[Windows 설치 가이드](https://docs.sillytavern.app/installation/windows/)**
* **[MacOS/Linux 설치 가이드](https://docs.sillytavern.app/installation/linuxmacos/)**
* **[Android (Termux) 설치 가이드](https://docs.sillytavern.app/installation/android-(termux)/)**
* **[Docker 설치 가이드](https://docs.sillytavern.app/installation/docker/)**

## 라이센스 및 크레딧

**이 프로그램은 유용할 것이라는 희망으로 배포되지만, 어떠한 보증도 제공하지 않습니다. 상품성 또는 특정 목적에의 적합성에 대한 묵시적인 보증조차도 제공하지 않습니다. 자세한 내용은 GNU Affero 일반 공중 사용 허가서를 참조하십시오.**

* Humi의 [TavernAI](https://github.com/TavernAI/TavernAI) 1.2.8: MIT 라이선스
* CncAnon의 TavernAITurbo 모드의 일부는 허가를 받아 사용됨
* PepperTaco의 작업(<https://github.com/peppertaco/Tavern/>)에 영감을 받은 비주얼 노벨 모드
* Noto Sans Font by Google (OFL 라이선스)
* Font Awesome의 아이콘 테마 <https://fontawesome.com> (아이콘: CC BY 4.0, 폰트: SIL OFL 1.1, 코드: MIT 라이선스)
* 기본 콘텐츠는 @OtisAlejandro (Seraphina 캐릭터 및 로어북)와 @kallmeflocc (10K 디스코드 사용자 축전 배경화면)가 제공함
* [@mrguymiah](https://github.com/mrguymiah)와 [@Bronya-Rand](https://github.com/Bronya-Rand)의 Docker 가이드
* [@hexgrad](https://github.com/hexgrad)의 kokoro-js 라이브러리 (Apache-2.0 라이선스)

## 상위 기여자

[![Contributors](https://contrib.rocks/image?repo=SillyTavern/SillyTavern)](https://github.com/SillyTavern/SillyTavern/graphs/contributors)

<!-- LINK GROUP -->
[cover]: https://github.com/user-attachments/assets/01a6ae9a-16aa-45f2-8bff-32b5dc587e44
[discord-link]: https://discord.gg/sillytavern
[discord-shield-badge]: https://img.shields.io/discord/1100685673633153084?color=5865F2&label=discord&labelColor=black&logo=discord&logoColor=white&style=for-the-badge
