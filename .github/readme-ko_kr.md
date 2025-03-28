> [!IMPORTANT]
> 이곳에 게재된 정보는 오래되거나 불완전할 수 있습니다. 최신 정보는 영어 버전을 이용하십시오.

<a name="readme-top"></a>

![][cover]

<div align="center">

[English](readme.md) | [German](readme-de_de.md) | [中文](readme-zh_cn.md) | [繁體中文](readme-zh_tw.md) | [日本語](readme-ja_jp.md) | [Русский](readme-ru_ru.md) | 한국어

[![GitHub Stars](https://img.shields.io/github/stars/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/network)
[![GitHub Issues](https://img.shields.io/github/issues/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/pulls)

</div>

---

SillyTavern은 많은 LLM API(KoboldAI/CPP, Horde, NovelAI, Ooba, Tabby, OpenAI, OpenRouter, Claude, Mistral 등)에 대한 단일 통합 인터페이스, 모바일 친화적 레이아웃, 비주얼 노벨 모드, Automatic1111 & ComfyUI API 이미지 생성 통합, TTS, 월드 인포 (로어북), 커스텀 가능한 UI, 자동 번역, 필요 이상의 프롬프트 옵션, 그리고 서드파티 확장을 통한 무궁무진한 성장 가능성을 제공합니다.

또한, 자주 묻는 질문에 대한 답변과, 시작하는 데 도움을 주기 위한 [문서 웹사이트](https://docs.sillytavern.app/)가 있습니다.

## SillyTavern이 무엇인가요?

SillyTavern(짧게는 ST)은 텍스트 생성 LLM, 이미지 생성 엔진, TTS 음성 모델 등과 상호작할 수 있는 로컬 설치형 UI 입니다.

2023년 2월, TavernAI 1.2.8의 포크로 시작한 SillyTavern은 현재 100명이 넘는 기여자를 보유하고 있으며, 2년간의 독자적인 개발을 거쳐 숙련된 AI 애호가들을 위한 선도적인 소프트웨어로 자리매김하고 있습니다.


## 우리의 비전

1. 저희는 사용자가 LLM 프롬프트에 대한 최대한의 유용성과 제어 능력을 갖도록 하는 것을 목표로 합니다. 빠르게 배우는 것 역시 재미의 일부입니다!
2. 저희는 어떠한 온라인 및 호스팅 서브시도 제공하지 않으며, 프로그래밍으로 사용자의 데이터를 추적하지 않습니다.
3. SillyTavern은 헌신적인 LLM 커뮤니티가 여러분에게 제공하는 열정적인 프로젝트이며, 언제나 무료이며 오픈소스로 제공될 것입니다.

## 브랜치

SillyTavern은 모든 사용자가 원활한 경험을 할 수 있도록 두 개의 브랜치를 활용하여 개발되고 있습니다.


* `release` -🌟 **대부분의 사용자에게 추천됨.** 가장 안정적이고 권장되는 브랜치이며, 주요 릴리스가 배포될 때만 업데이트됩니다. 대부분의 사용자에게 적합합니다. 일반적으로 한달에 한번 업데이트됩니다.
* `staging` - ⚠️ **일반적인 사용에 추천되지 않음.** 최신 기능을 가지고 있지만, 언제든지 문제가 발생할 수 있습니다. 고급 사용자 및 숙련자 전용입니다. 하루에 여러번 업데이트됩니다.

만약 git CLI 사용에 익숙하지 않거나 브랜치가 무엇인지 모르겠다면 release 브랜치가 더 나은 선택입니다.

## SillyTavern 외에 무엇이 필요한가요?

SillyTavern은 인터페이스 역할만 하기 때문에, 실제로 채팅하려면 LLM 백엔드에 대한 액세스 권한이 필요합니다. 즉시 사용 가능한 채팅을 위해 AI Horde를 사용할 수 있습니다. 그 외에도 OpenAI 호환 API, KoboldAI, Tabby 등 많은 로컬 및 클라우드 기반 LLM 백엔드를 지원합니다. 지원되는 API에 대한 자세한 내용은 [FAQ](https://docs.sillytavern.app/usage/api-connections/)에서 확인할 수 있습니다.

### SillyTavern을 위해서 좋은 성능의 PC가 필요한가요?

하드웨어 요구 사항은 거의 없습니다: NodeJS 18 이상을 실행할 수 있는 모든 환경에서 작동합니다. 다만 로컬 LLM 모델을 사용할 경우, 최소 6GB VRAM 이상의 3000번대 NVIDIA 그래픽 카드를 권장합니다. 자세한 내용은 백엔드 문서를 참고하세요.

### 추천되는 백엔드 (제휴 없음)

* [AI Horde](https://aihorde.net/) - 자원 봉사자들이 호스팅하는 모델을 사용합니다. 추가 설정이 필요하지 않습니다.
* [KoboldCpp](https://github.com/LostRuins/koboldcpp) - 로컬에서 GGUF 모델을 실행하기 위한 커뮤니티에서 선호하는 옵션입니다.
* [tabbyAPI](https://github.com/theroyallab/tabbyAPI) - 인기 있는 경량 로컬  exl2 추론 API입니다.
* [OpenRouter](https://openrouter.ai) - OpenAI, Claude, Meta Llama 등 다양한 클라우드 제공업체와 인기 있는 커뮤니티 모델을 위한 단일 API입니다.

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


## 캐릭터 카드

SillyTavern은 "캐릭터 카드"라는 개념을 중심으로 구축되었습니다. 캐릭터 카드는 LLM의 동작을 설정하는 프롬프트 모음이며, SillyTavern에서 지속적인 대화를 하려면 필수적입니다. 이는 ChatGPT의 GPT 또는 Poe의 봇과 유사하게 작동합니다. 캐릭터 카드의 내용은 추상적인 시나리오, 특정 작업에 맞춰진 도우미, 유명 인사 또는 가상 인물 등 무엇이든 될 수 있습니다.

이름 필드는 유일한 필수 캐릭터 카드 입력 항목입니다. 언어 모델과 중립적인 대화를 시작하려면 "도우미"라고 간단히 이름 지은 새 카드를 만들고 나머지 상자는 비워 두세요. 더 주제가 있는 채팅을 원한다면 언어 모델에 다양한 배경 정보, 행동 및 작문 패턴, 그리고 채팅을 바로 시작할 시나리오를 제공할 수 있습니다.

캐릭터 카드를 선택하지 않고 빠른 대화를 하거나 LLM 연결을 테스트하려면 SillyTavern을 연 후 시작 화면의 입력 창에 프롬프트 입력을 입력하기만 하면 됩니다. 이러한 채팅은 임시적이며 저장되지 않습니다.

캐릭터 카드를 정의하는 방법에 대한 일반적인 아이디어를 얻으려면 기본 캐릭터(Seraphina)를 보거나 "확장 프로그램 및 에셋 다운로드" 메뉴에서 선택된 커뮤니티 제작 카드를 다운로드하세요.


## 핵심 기능

* 고급 텍스트 생성 설정과 다양한 커뮤니티 제작 프리셋
* 월드 인포 지원: 풍부한 설정을 만들거나 캐릭터 카드에 토큰 저장
* 그룹 채팅: 캐릭터가 사용자 혹은 다른 캐릭터와 대화할 수 있는 방
* 다양한 UI 커스텀 옵션: 테마 색, 뱌경 이미지, 커스텀 CSS 등
* 유저 페르소나: AI에게 사용자에 대한 정보를 주어 더욱 몰입감을 높임
* 내장 RAG 지원: AI가 참조할 수 있도록 채팅에 문서를 추가
* 광범위한 채팅 명령어 시스템 및 자체 [스크립트](https://docs.sillytavern.app/usage/st-script/)

## 확장

SillyTavern은 확장(익스텐션)을 지원합니다.

* 캐릭터 감정 표현 (스프라이트)
* 채팅 기록 자동 요약
* 자동 UI 및 채팅 번역
* Stable Diffusion/FLUX/DALL-E 이미지 생성
* AI 응답 메시지 텍스트 음성 변환 (ElevenLabs, Silero 또는 OS 시스템 TTS 사용)
* 프롬프트에 추가적인 현실 세계 맥락을 추가하기 위한 웹 검색 기능
* "확장 프로그램 및 에셋 다운로드" 메뉴에서 더 많은 기능을 다운로드할 수 있습니다.


사용 방법에 대한 튜토리얼은 [Docs](https://docs.sillytavern.app/)에서 확인할 수 있습니다.

# ⌛ Installation

> \[!WARNING]
>
> * **윈도우 제어 폴더에는 설치하지 마십시오 (Program Files, System32 등).**
> * **권리자 권한으로 START.BAT을 실행하지 마십시오.**
> * **Windows 7에서는 NodeJS 18.16을 실행할 수 없으므로 설치가 불가능합니다.**

## 🪟 Windows

### Git을 통해 설치하기

1. [NodeJS](https://nodejs.org/ko) 설치 (최신 LTS 버전 권장)
2. [Git for Windows](https://gitforwindows.org/) 설치
3. 파일 탐색기 열기 (`Win+E`)
4. Windows에서 제어하거나 모니터하지 않는 폴더를 찾거나 만드세요. (ex: C:\MySpecialFolder\)
5. 상단의 주소 표시줄을 클릭하고 `cmd`를 입력한 후 Enter 키를 눌러 해당 폴더 내에서 명령 프롬프트를 여세요.
6. 검은색 창(명령 프롬프트)이 나타나면 다음 중 하나를 입력하고 Enter 키를 누르세요.

* Release 브랜치: `git clone https://github.com/SillyTavern/SillyTavern -b release`
* Staging 브랜치: `git clone https://github.com/SillyTavern/SillyTavern -b staging`

7. clone이 완료되면, `Start.bat`을 더블 클릭하여 NodeJS가 필요한 구성요소를 설치하도록 하세요.
8. 그러면 서버가 시작하고, SillyTavern이 브라우저에 나타납니다.

### GitHub Desktop을 통해 설치하기

(이 방법은 **오직** GitHub Desktop에서만 git 사용이 가능합니다. 명령 프롬프트에서 git을 사용하려면 [Git for Windows](https://gitforwindows.org/)를 설치해야 합니다.)

 

  1. [NodeJS](https://nodejs.org/ko) 설치 (최신 LTS 버전 권장)
  2. [GitHub Desktop](https://central.github.com/deployments/desktop/desktop/latest/win32) 설치
  3. GitHub Desktop을 설치했으면, `Clone a repository from the internet....`를 클릭하세요. (참고: 이 과정에서는 Github 계정이 **필요하지 않습니다**.)
  4. 메뉴에서 URL 탭을 클릭하고, 다음 URL을 입력한 후 복제를 클릭합니다: `https://github.com/SillyTavern/SillyTavern` 리포지토리가 다운로드될 위치를 변경하려면 로컬 경로를 변경할 수 있습니다.
  5. SillyTavern을 열려면 파일 탐색기를 사용하여 리포지토리를 복제한 폴더로 이동합니다. 기본적으로 리포지토리는 다음 위치에 복제됩니다: `C:\Users\[사용자 Windows 사용자 이름]\Documents\GitHub\SillyTavern`
  6. `start.bat` 파일을 더블 클릭 하세요. (참고: `.bat` 확장자 명은 OS 설정에 따라 보이지 않을 수 있습니다, 그럴 때는 파일 이름이 "`Start`" 처럼 보일 수 있습니다. 이 파일을 더블 클릭해 SillyTavern을 실행하세요.)
  7. 더블 클릭하면, 검고 큰 명령 프롬프트 창이 열리고 SillyTavern이 작동하는데 필요한 항목을 설치하기 시작합니다.
  8. 설치 과정이 끝나고 모든 것이 잘 작동한다면, 브라우저에 SillyTavern 탭이 열려 있어야 하고, 명령 프롬프트 창에 다음과 같이 표시되어야 합니다:
  9. Connect to any of the [supported APIs](https://docs.sillytavern.app/usage/api-connections/) and start chatting!

## 🐧 Linux & 🍎 MacOS

MacOS / Linux 에서는 이 모든 작업이 터미널에서 수행됩니다.

1. git과 nodeJS 설치 (이 작업은 OS에 따라 달라집니다.)
2. 리포지토리 clone하기

* Release 브랜치: `git clone https://github.com/SillyTavern/SillyTavern -b release`
*  Staging 브랜치: `git clone https://github.com/SillyTavern/SillyTavern -b staging`

3. `cd SillyTavern` 를 입력해 설치 폴더로 이동하기
4. `start.sh` 스크립트를 아래의 명령어 중 하나로 실행하기:

* `./start.sh`
* `bash start.sh`

## ⚡ SillyTavern Launcher를 통해 설치하기

SillyTavern 런처는 로컬 LLM 사용을 위한 백엔드 설치를 포함하여 다양한 설정을 도와주는 설치 마법사입니다.


### Windows 사용자

1. 키보드에서 **`WINDOWS + R`** 키를 눌러 실행 창을 여세요. 그리고 아래의 명령어를 입력해 git을 설치하세요.

```shell
cmd /c winget install -e --id Git.Git
```

2. 키보드에서 **`WINDOWS + E`** 키를 눌러 파일 탐색기를 열고 런처를 설치할 폴더로 이동합니다. 원하는 폴더에 도착하면 주소 표시줄에 `cmd`를 입력하고 Enter 키를 누릅니다. 그 후 아래의 명령어를 입력합니다.


```shell
git clone https://github.com/SillyTavern/SillyTavern-Launcher.git && cd SillyTavern-Launcher && start installer.bat
```

### Linux 사용자

1. 선호하는 터미널을 열고 git을 설치하세요.
2. SillyTavern-Launcher를 clone 하세요:

```shell
git clone https://github.com/SillyTavern/SillyTavern-Launcher.git && cd SillyTavern-Launcher
```

3. installer.sh를 실행하세요:

```shell
chmod +x install.sh && ./install.sh
```

4. 설치가 끝나면 launcher.sh를 실행하세요:

```shell
chmod +x launcher.sh && ./launcher.sh
```

### Mac 사용자

1. 터미널을 열고 Brew를 설치하세요:

```shell
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2. git을 설치하세요:

```shell
brew install git
```

3. SillyTavern-Launcher를 clone 하세요:

```shell
git clone https://github.com/SillyTavern/SillyTavern-Launcher.git && cd SillyTavern-Launcher
```

4. installer.sh를 실행하세요:

```shell
chmod +x install.sh && ./install.sh
```

5. 설치가 끝나면 launcher.sh를 실행하세요:

```shell
chmod +x launcher.sh && ./launcher.sh
```

## 🐋 Docker를 통해 설치하기

이 방법은 Docker가 설치되어 있고, Docker 설치를 위해 커맨드 라인에 접근할 수 있으며, Docker의 일반적인 작동 방식에 익숙하다고 가정합니다.

### 이미지 직접 빌드하기

SillyTavern을 Docker에서 사용하는 방법에 대한 포괄적인 가이드는 [여기서](http://docs.sillytavern.app/installation/docker/) 확인할 수 있습니다. 이 가이드는 Windows, macOS 및 Linux에서의 설치를 다룹니다! 직접 이미지를 빌드하려면 이 가이드를 읽어보세요.

### GitHub Container Registry 사용하기 (가장 쉬움)

SillyTavern이 작동하려면 두 개의 필수 디렉터리 매핑과 하나의 포트 매핑이 필요합니다. 명령에서 다음 위치의 선택 항목을 바꿔주세요.


#### Container Variables

##### Volume Mappings

* [config] - SillyTavern 구성 파일이 호스트 컴퓨터에 저장될 디렉터리
* [data] - 캐릭터를 포함한 SillyTavern 사용자 데이터가 호스트 컴퓨터에 저장될 디렉터리
* [plugins] - (선택 사항) SillyTavern 서버 플러그인이 호스트 컴퓨터에 저장될 디렉터리

##### Port Mappings

* [PublicPort] - 트래픽을 노출할 포트입니다. 가상 머신 컨테이너 외부에서 인스턴스에 접근하므로 필수 사항입니다. 보안을 위한 별도의 서비스를 구현하지 않고는 인터넷에 노출하지 마십시오.


##### Additional Settings

* [DockerNet] - 컨테이너가 연결되어 생성되어야 하는 Docker 네트워크입니다. 해당 내용을 모르는 경우 [공식 Docker 문서](https://docs.docker.com/reference/cli/docker/network/)를 참조하세요.
* [version] - 이 GitHub 페이지의 오른쪽에서 "Packages"를 선택하면 "sillytavern" 패키지를 볼 수 있습니다. "latest" 이미지 태그는 현재 릴리스와 함께 최신 상태를 유지합니다. 각 브랜치의 야간 이미지를 가리키는 "staging" 및 "release" 태그를 사용할 수도 있지만, 업데이트에 시간이 걸릴 수 있고 중단될 수 있는 확장 프로그램을 사용하는 경우에는 적합하지 않을 수 있습니다.


#### 설치 명령어

1. 커맨드 라인 열기
2. 아래의 명령어 실행

`docker create --name='sillytavern' --net='[DockerNet]' -p '8000:8000/tcp' -v '[plugins]':'/home/node/app/plugins':'rw' -v '[config]':'/home/node/app/config':'rw' -v '[data]':'/home/node/app/data':'rw' 'ghcr.io/sillytavern/sillytavern:[version]'`

> 8000은 기본 리스닝 포트입니다. 구성에서 포트를 변경한 경우 적절한 포트를 사용하는 것을 잊지 마세요.
## 📱 Termux를 통해 Android OS에 설치하기

> \[!NOTE]
> **SillyTavern은 Termux를 사용하여 Android 기기에서 기본적으로 실행할 수 있지만, 이러한 사용 사례에 대한 공식적인 지원은 제공하지 않습니다.**
>
> **ArroganceComplex#2659의 가이드를 참조하세요:**
>
> * <https://rentry.org/STAI-Termux>

**지원되지 않는 플랫폼: android arm LEtime-web.** 32비트 Android는 npm으로 설치할 수 없는 외부 종속성이 필요합니다. 다음 명령어를 사용하여 설치하세요: pkg install esbuild. 그런 다음 일반적인 설치 단계를 진행하세요.


## API 키 관리

SillyTavern은 API 키를 사용자 데이터 디렉터리의 `secrets.json` 파일에 저장합니다 (`/data/default-user/secrets.json`이 기본 경로입니다).



기본적으로 API 키는 저장하고 페이지를 새로 고침한 후에는 인터페이스에서 보이지 않습니다.

키 보기 기능을 활성화하려면 다음 단계를 따르세요:

1. `config.yaml` 파일에서 `allowKeysExposure` 값을 `true로` 설정합니다.
2. SillyTavern 서버를 다시 시작합니다.
3. API 연결 패널 오른쪽 하단에 있는 '숨겨진 API 키 보기' 링크를 클릭합니다.

## 커맨드 라인 인수

`config.yaml`의 일부 설정을 덮어쓰기 위해 SillyTavern 서버 시작 시 커맨드 라인 인수를 전달할 수 있습니다.


### 예시

```shell
node server.js --port 8000 --listen false
# 혹은
npm run start -- --port 8000 --listen false
# 혹은 (Windows 전용)
Start.bat --port 8000 --listen false
```

### 지원되는 인수

| 옵션                  | 설명                                                                                          | 타입     |
|-------------------------|------------------------------------------------------------------------------------------------------|----------|
| `--version`             | 버전 표시                                                                                              | boolean  |
| `--enableIPv6`          | IPv6 활성화                                                                                            | boolean  |
| `--enableIPv4`          | IPv4 활성화                                                                                            | boolean  |
| `--port`                | SillyTavern이 실행될 포트를 설정합니다. 설정되지 않은 경우 yaml config 'port'를 불러옵니다.                    | number   |
| `--dnsPreferIPv6`       | DNS에 IPv6를 우선으로 할당합니다. 설정되지 않은 경우 yaml config를 불러옵니다.                                 | boolean  |
| `--autorun`             | 브라우저에서 SillyTavern을 자동으로 실행합니다. 설정되지 않은 경우 yaml config 'autorun'를 불러옵니다. | boolean  |
| `--autorunHostname`     | 자동 실행 호스트 이름, 'auto'가 최적의 설정일 것입니다.                                                  | string   |
| `--autorunPortOverride` | 자동 실행 포트 덮어쓰기                                                                      | string   |
| `--listen`              | SillyTavern이 모든 네트워크 인터페이스에서 수신 대기합니다. 설정되지 않은 경우 yaml 구성 'listen'을 불러옵니다.	| boolean  |
| `--corsProxy`           | CORS 프록시 활성화. 설정되지 않은 경우 yaml 구성 'enableCorsProxy'을 불러옵니다.	                     | boolean  |
| `--disableCsrf`         | CSRF 보호 비활성화                                                                             | boolean  |
| `--ssl`                 | SSL 활성화                                                                                          | boolean  |
| `--certPath`            | 인증서 파일 경로                                                                       | string   |
| `--keyPath`             | 프라이빗 키 파일 경로                                                                       | string   |
| `--whitelist`           | 화이트리스트 모드 활성화                                                                               | boolean  |
| `--dataRoot`            | 데이터 스토리지의 루트 디렉토리                                                                       | string   |
| `--avoidLocalhost`      | 자동 모드에서 자동 실행 시 'localhost' 사용 방지                                                   | boolean  |
| `--basicAuthMode`       | 기본 인증 활성화                                                                         | boolean  |
| `--requestProxyEnabled` | 외부 리퀘스트 프록시 활성화                                                         | boolean  |
| `--requestProxyUrl`     | 프록시 URL 리퀘스트 (HTTP 혹은 SOCKS 프로토콜)                                                          | string   |
| `--requestProxyBypass`  | 프록시 바이패스 리스트 리퀘스트 (공백으로 구분된 호스트 목록)                                            | array    |

## 원격 연결

대부분의 경우 이는 PC에서 ST 서버를 실행하는 동안 모바일 장치에서 SillyTavern을 사용하려는 사람들을 위한 것입니다. 그러나 원격 연결을 다른 곳에서도 허용하도록 사용할 수 있습니다.

원격 연결 설정 방법에 대한 자세한 가이드는 [Docs](https://docs.sillytavern.app/usage/remoteconnections/)에서 확인할 수 있습니다.

또한 암호 보호 기능이 포함된 SillyTavern 사용자 프로필을 구성할 수 있습니다 (선택 사항): [Users](https://docs.sillytavern.app/installation/st-1.12.0-migration-guide/#users).

## 성능 이슈가 발생하나요?

1. 사용자 설정 패널(UI 테마 전환 카테고리)에서 흐림 효과를 비활성화하고 동작 줄이기를 활성화합니다.
2. 응답 스트리밍을 사용하는 경우 스트리밍 FPS를 더 낮은 값(10-15 FPS 권장)으로 설정합니다.
3. 브라우저에서 렌더링에 GPU 가속을 사용하도록 설정되어 있는지 확인합니다.

## 라이센스 및 크레딧

**이 프로그램은 유용할 것이라는 희망으로 배포되지만, 어떠한 보증도 제공하지 않습니다. 상품성 또는 특정 목적에의 적합성에 대한 묵시적인 보증조차도 제공하지 않습니다. 자세한 내용은 GNU Affero 일반 공중 사용 허가서를 참조하십시오.**

* Humi의 [TavernAI](https://github.com/TavernAI/TavernAI) 1.2.8: MIT 라이선스
* CncAnon의 TavernAITurbo 모드의 일부는 허가를 받아 사용됨
* PepperTaco의 작업(<https://github.com/peppertaco/Tavern/>)에 영감을 받은 비주얼 노벨 모드
* Noto Sans Font by Google (OFL 라이선스)
* Font Awesome의 아이콘 테마 <https://fontawesome.com> (아이콘: CC BY 4.0, 폰트: SIL OFL 1.1, 코드: MIT 라이선스)
* 기본 콘텐츠는 @OtisAlejandro (Seraphina 캐릭터 및 로어북)와 @kallmeflocc (10K 디스코드 사용자 축전 배경화면)가 제공함
* [@mrguymiah](https://github.com/mrguymiah)와 [@Bronya-Rand](https://github.com/Bronya-Rand)의 Docker 가이드

## 상위 기여자

[![Contributors](https://contrib.rocks/image?repo=SillyTavern/SillyTavern)](https://github.com/SillyTavern/SillyTavern/graphs/contributors)

<!-- LINK GROUP -->
[cover]: https://github.com/user-attachments/assets/01a6ae9a-16aa-45f2-8bff-32b5dc587e44
[discord-link]: https://discord.gg/sillytavern
[discord-shield-badge]: https://img.shields.io/discord/1100685673633153084?color=5865F2&label=discord&labelColor=black&logo=discord&logoColor=white&style=for-the-badge
