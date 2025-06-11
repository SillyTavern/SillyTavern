> [!IMPORTANT]  
> 此處資訊可能已經過時或不完整，僅供您參考。請使用英文版本以取得最新資訊。

<a name="readme-top"></a>

![][cover]

<div align="center">

[English](readme.md)  | [German](readme-de_de.md) | [中文](readme-zh_cn.md) | 繁體中文 | [日本語](readme-ja_jp.md) | [Русский](readme-ru_ru.md) | [한국어](readme-ko_kr.md)

[![GitHub 星標](https://img.shields.io/github/stars/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/stargazers)
[![GitHub 分支](https://img.shields.io/github/forks/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/network)
[![GitHub 問題](https://img.shields.io/github/issues/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/issues)
[![GitHub 拉取請求](https://img.shields.io/github/issues-pr/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/pulls)

</div>

---

SillyTavern 提供一個統一的前端介面，整合多種大型語言模型的 API（包括：KoboldAI/CPP、Horde、NovelAI、Ooba、Tabby、OpenAI、OpenRouter、Claude、Mistral 等）。同時具備對行動裝置友善的佈局、視覺小說模式（Visual Novel Mode）、Automatic1111 與 ComfyUI 的影像生成 API 整合、TTS（語音合成）、世界資訊（Lorebook）、可自訂 UI、自動翻譯功能，以及強大的提示詞（prompt）設定選項和無限的第三方擴充潛力。

我們擁有一個 [官方文件網站](https://docs.sillytavern.app/) 可以幫助解答絕大多數的使用問題，並幫助您順利入門。

## SillyTavern 是什麼？

SillyTavern（簡稱 ST）是一款本地安裝的使用者介面，讓您能與大型語言模型（LLM）、影像生成引擎以及語音合成模型互動的前端。

SillyTavern 起源於 2023 年 2 月，作為 TavernAI 1.2.8 的分支版本發展至今。目前已有超過 100 位貢獻者，並擁有超過兩年的獨立開發歷史。如今，它已成為 AI 愛好者中備受推崇的軟體之一。

## 我們的願景

1. 我們致力於賦予使用者對 LLM 提示詞的最大控制權與實用性，並認為學習過程中的挑戰是樂趣的一部分。
2. 我們不提供任何線上或託管服務，也不會程式化追蹤任何使用者數據。
3. SillyTavern 是由一群熱衷於 LLM 的開發者社群所打造的專案，並將永遠保持免費與開源。

## 分支介紹

SillyTavern 採用雙分支開發模式，確保為所有使用者提供流暢的體驗。

* `release`（穩定版）：🌟 **推薦給大部分的使用者使用。** 此分支最為穩定，僅在主要版本發布時更新。適合大多數人，通常每月更新一次。
* `staging`（開發版）：⚠️ **不建議普通使用者使用。** 此分支包含最新功能，但可能隨時出現問題。適合進階使用者與愛好者，每日多次更新。

如果您不熟悉 git CLI 或對分支概念不清楚，請放心，對您來說，`release`（穩定版）分支永遠是首選。

## 使用 SillyTavern 需要什麼？

由於 SillyTavern 僅是一個介面，您需要一個 LLM 後端來提供推理能力。您可以使用 AI Horde 以立即開始聊天。此外，我們支持許多其他本地和雲端 LLM 後端，例如 OpenAI 兼容 API、KoboldAI、Tabby 等。更多支持的 API 資訊，請參閱 [常見問題](https://docs.sillytavern.app/usage/api-connections/)。

### 我需要高效能電腦才能運行 SillyTavern 嗎？

SillyTavern 的硬體需求相當低。任何能夠運行 NodeJS 18 或更高版本的設備都可以執行。若您打算在本地機器上進行 LLM 推理，我們建議使用擁有至少 6GB VRAM 的 3000 系列 NVIDIA 顯示卡。更多詳細資訊，請參考您使用的後端文檔。

### 推薦後端（僅為推薦，非官方合作和隸屬關係）

* [AI Horde](https://aihorde.net/)：使用志願者託管的模型，無需進一步設定
* [KoboldCpp](https://github.com/LostRuins/koboldcpp)：社群推崇的選擇，可在本地運行 GGUF 模型
* [tabbyAPI](https://github.com/theroyallab/tabbyAPI)：一個流行且輕量的本地託管 exl2 推理 API
* [OpenRouter](https://openrouter.ai)：提供多個雲端 LLM 提供商（如 OpenAI、Claude、Meta Llama 等）及熱門社群模型的單一 API

## 有任何問題或建議？

### 歡迎加入我們的 Discord 伺服器

| [![][discord-shield-badge]][discord-link] | [加入我們的 Disocrd 伺服器](https://discord.gg/sillytavern) 以獲得技術支援、分享您喜愛的角色與提示詞。 |
| :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |

或直接聯繫開發者：

* Discord: cohee, rossascends, wolfsblvt
* Reddit: [/u/RossAscends](https://www.reddit.com/user/RossAscends/), [/u/sillylossy](https://www.reddit.com/user/sillylossy/), [u/Wolfsblvt](https://www.reddit.com/user/Wolfsblvt/)
* [提交 GitHub 問題](https://github.com/SillyTavern/SillyTavern/issues)

### 我喜歡這個專案，我該如何貢獻呢？

1. **提交拉取要求（Pull Request）**：想了解如何貢獻，請參閱 [CONTRIBUTING.md](../CONTRIBUTING.md)。 
2. **提供功能建議與問題報告**：使用本專案所提供的模板提交建議或問題報告。
3. **仔細閱讀此 README 文件及相關文檔**：請避免提出重複問題或建議。

## 螢幕截圖

<img width="500" alt="image" src="https://github.com/user-attachments/assets/9b5f32f0-c3b3-4102-b3f5-0e9213c0f50f">
<img width="500" alt="image" src="https://github.com/user-attachments/assets/913fdbaa-7d33-42f1-ae2c-89dca41c53d1">

## 角色卡

SillyTavern 的核心概念是「角色卡」（Character Cards）。角色卡是一組設定 LLM 行為的提示詞，用於 SillyTavern 中進行持續性對話。功能類似於 ChatGPT 的 GPT 或 Poe 的聊天機器人。角色卡的內容可以是任何形式：抽象場景、針對特定任務設計的助手、知名人物，或者虛構角色。

角色卡中唯一必填的項目是名稱欄位。若想與語言模型開始一般對話，您只需創建一個名稱為「Assistant」的新卡片，其餘欄位皆可保持空白。若希望進行更具主題性的對話，則可以提供語言模型背景資訊、行為模式、寫作風格以及特定情境來啟動聊天。

如果僅想進行快速對話而不選擇角色卡片，或想測試 LLM 的連線，則可在開啟 SillyTavern 後，於歡迎頁面的輸入欄位中直接輸入您的提示內容。請注意，這類對話是暫時的，不會被永久保存。

若想了解如何設定角色卡，可參考預設角色（如 Seraphina）或從「下載擴充功能 & 資源」（Download Extensions & Assets）選單中下載社群製作的角色卡。

## 核心功能

* 進階文本生成設定：內含許多社群製作的預設設定
* 支援世界資訊（World Info）：創建豐富的背景故事，或節省角色卡中的 Token（符元）使用
* 群組聊天：多角色聊天室，可讓角色與您或彼此對話
* 豐富的 UI 自定義選項：主題顏色、背景圖片、自定義 CSS 等
* 使用者設定：讓 AI 更了解您並提升沉浸感
* 內建 RAG 支持：可將文檔加入對話，供 AI 參考
* 強大的聊天指令子系統：內含 [腳本引擎（Scripting Engine）](https://docs.sillytavern.app/usage/st-script/)

## 擴充功能

SillyTavern 支持多種擴充功能。

* 角色情感表達：使用視覺圖片（立繪）呈現情緒表達
* 聊天記錄自動摘要
* 自動化介面與聊天翻譯
* 穩定擴散（Stable Diffusion）、FLUX 和 DALL-E 的影像生成整合
* 語音合成：AI 回應的訊息可使用 ElevenLabs、Silero 或系統 TTS 語音合成
* 網頁搜尋功能：為提示詞添加真實世界的上下文資訊
* 更多擴展：可從「下載擴充功能 & 資源」（Download Extensions & Assets）選單中下載

想了解如何使用這些擴充功能，請參考：[官方說明文件](https://docs.sillytavern.app/)

# ⌛ 安裝指南

> \[!WARNING]
>
> * 請勿將程式安裝到 Windows 的系統控制資料夾（如 Program Files、System32 等）
> * 請勿以管理員權限執行 Start.bat
> * 無法在 Windows 7 系統上安裝，因為它無法執行 NodeJS 18.16

## 🪟 Windows

### 使用 Git 安裝

1. 安裝 [NodeJS](https://nodejs.org/en)（建議使用最新的 LTS 版本）
2. 安裝 [Git for Windows](https://gitforwindows.org/)
3. 打開 Windows 檔案總管（`Win+E`）
4. 創建／使用一個不受 Windows 系統控制或監控的資料夾（例如：C:\MySpecialFolder\）
5. 在該資料夾內開啟命令提示字元（Command Prompt）：點擊地址欄，輸入 `cmd` 並按下 Enter
6. 當命令提示字元黑框彈出時，輸入以下其中一條指令後，按下 Enter：

* 安裝 Release（穩定版）分支：`git clone https://github.com/SillyTavern/SillyTavern -b release`
* 安裝 Staging（開發板）分支：`git clone https://github.com/SillyTavern/SillyTavern -b staging`

7. 當程式碼下載完成後，雙擊 `Start.bat`，NodeJS 將自動安裝所需的依賴項
8. 本地伺服器啟動後，SillyTavern 將自動在您的瀏覽器中打開

### 使用 GitHub Desktop 安裝

（此方式僅允許通過 GitHub Desktop 使用 git。如果您也希望在命令列中使用 `git`，則需額外安裝 [Git for Windows](https://gitforwindows.org/)）

  1. 安裝 [NodeJS](https://nodejs.org/en)（建議使用最新的 LTS 版本）
  2. 安裝 [GitHub Desktop](https://central.github.com/deployments/desktop/desktop/latest/win32)
  3. 安裝完成後，打開 GitHub Desktop，點擊 `Clone a repository from the internet....` （注意：此步驟 **無需創建 GitHub 帳號**。）
  4. 在彈出選單中，點擊「URL」選項，輸入此網址：`https://github.com/SillyTavern/SillyTavern`，然後點擊「Clone」。您可以更改「Local path」來選擇 SillyTavern 的下載位置
  6. 若想開啟 SillyTavern，需使用 Windows 檔案總管以進入您複製儲存庫的資料夾。預設位置為：`C:\Users\[您的 Windows 使用者名稱]\Documents\GitHub\SillyTavern`
  7. 雙擊 `start.bat` 文件。（請注意：若您的作業系統隱藏了 `.bat` 副檔名，該文件可能顯示為「`Start`」。這就是您需要雙擊運行的文件。）
  8. 雙擊後，將會彈出一個大型黑色的命令提示字元視窗，SillyTavern 會開始安裝其運行所需的文件與依賴
  9. 安裝完成後，若一切正常，命令提示字元視窗應顯示運行中的訊息，且您的瀏覽器會自動打開 SillyTavern 頁籤
  10. 連接到任何 SillyTavern [支援的 APIs](https://docs.sillytavern.app/usage/api-connections/) 並開始聊天吧！

## 🐧 Linux & 🍎 MacOS

對於 MacOS 和 Linux 系統，所有操作都將在終端機（Terminal）中完成。

1. 安裝 git 和 NodeJS（具體方法因操作系統而異）
2. 複製儲存庫（Clone the repo）：

* 安裝 Release（穩定版）分支：`git clone https://github.com/SillyTavern/SillyTavern -b release`
* 安裝 Staging（開發板）分支：`git clone https://github.com/SillyTavern/SillyTavern -b staging`

3. 使用命令 `cd SillyTavern` 以進入安裝資料夾
4. 使用以下其中一條命令，以執行 `start.sh` 腳本：

* `./start.sh`
* `bash start.sh`

## ⚡ 使用 SillyTavern Launcher 安裝

SillyTavern Launcher 是一個安裝嚮導，協助您設定多種選項，包括安裝本地推理（inference）的後端。

### 對於 Windows 使用者

1. 在鍵盤上按下 **`WINDOWS + R`** 打開「執行」對話框，然後輸入以下指令以安裝 git：

```shell
cmd /c winget install -e --id Git.Git
```

2. 在鍵盤上按下 **`WINDOWS + E`** 打開檔案總管，導航至您想要安裝 Launcher 的資料夾。在目標資料夾的地址欄輸入 `cmd` 並按下 Enter。接著執行以下命令：

```shell
git clone https://github.com/SillyTavern/SillyTavern-Launcher.git && cd SillyTavern-Launcher && start installer.bat
```

### 對於 Linux 使用者

1. 打開您喜歡的終端機（Terminal），安裝 git
2. 使用以下指令以複製 Sillytavern-Launcher：

```shell
git clone https://github.com/SillyTavern/SillyTavern-Launcher.git && cd SillyTavern-Launcher
```

3. 執行安裝腳本（installer.sh）：

```shell
chmod +x install.sh && ./install.sh
```

4. 安裝完成後，執行啟動腳本（launcher.sh）：

```shell
chmod +x launcher.sh && ./launcher.sh
```

### 對於 Mac 使用者

1. 打開終端機（Terminal），並使用以下指令安裝 Homebrew：

```shell
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2. 使用 Homebrew 以安裝 git：

```shell
brew install git
```

3. 使用以下指令以複製 Sillytavern-Launcher：

```shell
git clone https://github.com/SillyTavern/SillyTavern-Launcher.git && cd SillyTavern-Launcher
```

4. 執行安裝腳本（installer.sh）：

```shell
chmod +x install.sh && ./install.sh
```

5. 安裝完成後，執行啟動腳本（launcher.sh）：

```shell
chmod +x launcher.sh && ./launcher.sh
```

## 🐋 使用 Docker 安裝

以下指南已假設您安裝 Docker，能夠訪問命令列進行容器安裝，並熟悉 Docker 的基本使用。

### 自行構建映像

我們提供了一份完整的 [SillyTavern Docker 使用指南](http://docs.sillytavern.app/installation/docker/)。該指南涵蓋了 Windows、macOS 和 Linux 的安裝過程。若您希望自行構建映像，建議先閱讀該文檔。

### 使用 GitHub 容器註冊表（最簡易的方式）

您需要設定兩個必要的目錄映射（directory mappings）和一個端口映射（port mapping）來使 SillyTavern 正常運行。在執行指令時，請將以下佔位符替換為您的實際配置：

#### 容器變數

##### 目錄映射（Volume Mappings）

* [config]：用於存放 SillyTavern 設定文件的本地資料夾
* [data]：用於存放 SillyTavern 使用者數據（包括角色）的本地資料夾
* [plugins]（可選）：用於存放 SillyTavern 擴充功能的本地資料夾

##### 端口映射（Port Mappings）

* [PublicPort]：對外流量的訪問端口。這是必需的，因為您將從虛擬機容器外部訪問實例。除非實施了額外的安全服務，否則請勿將此端口暴露於網路

##### 其他設定（Additional Settings）

* [DockerNet]：容器應連接的 Docker 網路。如果您不熟悉此概念，請參閱 [Docker 官方說明文件](https://docs.docker.com/reference/cli/docker/network/)
* [version]：在 GitHub 頁面的右側，您可以找到「Packages」。選擇「sillytavern」包，然後查看映像版本。「latest」標籤會使您保持與當前版本同步。您也可以選擇「staging」或「release」標籤，但這可能不適用於依賴擴充功能的使用者，因為擴充功能可能需要時間進行更新

#### 安裝命令

1. 打開命令列（Command Line）
2. 執行以下指令：

`docker create --name='sillytavern' --net='[DockerNet]' -p '8000:8000/tcp' -v '[plugins]':'/home/node/app/plugins':'rw' -v '[config]':'/home/node/app/config':'rw' -v '[data]':'/home/node/app/data':'rw' 'ghcr.io/sillytavern/sillytavern:[version]'`

> 請注意：默認的監聽端口為 8000。如果您在設定文件中更改了此端口，請務必使用適當的端口號

## 📱 於 Android 系統中使用 Termux 安裝

> \[!NOTE]
> **雖然您可以在 Android 設備上使用 Termux 直接運行 SillyTavern，但這不在我們的官方支持範圍內。**
>
> **請參閱 ArroganceComplex#2659 所提供的指南：**
>
> * <https://rentry.org/STAI-Termux>

**不支援：Android ARM LEtime-web。** 32 位 Android 系統需要額外的依賴項，這無法通過 npm 安裝。請使用以下命令安裝：`pkg install esbuild`。完成後，請按照普通的安裝步驟進行操作

## API 金鑰管理

SillyTavern 將您的 API 金鑰（Keys）保存在使用者數據目錄中的 `secrets.json` 文件內（默認路徑為`/data/default-user/secrets.json`）

默認情況下，API 金鑰在您保存並重新載入頁面後，將不會自介面中顯示

如需啟用查看金鑰功能：

1. 在 `config.yaml` 文件中，將 `allowKeysExposure` 的「值」設為 `true`
2. 重新啟動 SillyTavern 伺服器
3. 點擊 API 連線頁面右下角的「查看隱藏的 API 金鑰（View hidden API keys）」超連結

## 命令列參數（Command-line Arguments）

您可以在啟動 SillyTavern 伺服器時傳遞命令列參數，以覆蓋 `config.yaml` 文件中的某些設定。

### 範例

```shell
node server.js --port 8000 --listen false
# or
npm run start -- --port 8000 --listen false
# or（僅適用於 Windows）
Start.bat --port 8000 --listen false
```

### Supported arguments

| Option                           | Description                                 | Type    |
|----------------------------------|---------------------------------------------|---------|
| `--version`                      | 顯示版本序號                                | boolean |
| `--enableIPv6`                   | 啟用 IPv6                                   | boolean |
| `--enableIPv4`                   | 啟用 IPv4                                   | boolean |
| `--port`                         | 設定 SillyTavern 運行的端口。               | number  |
| `--dnsPreferIPv6`                | 偏好使用 IPv6 解析 DNS。                    | boolean |
| `--browserLaunchEnabled`         | 自動在瀏覽器中啟動 SillyTavern。            | boolean |
| `--browserLaunchHostname`        | 自動啟動時的主機名稱，通常建議保持為 'auto' | string  |
| `--browserLaunchPort`            | 覆蓋自動啟動的端口設定                      | string  |
| `--browserLaunchAvoidLocalhost`  | 在自動模式下避免使用 'localhost'            | boolean |
| `--listen`                       | SillyTavern 是否可監聽所有網路接口。        | boolean |
| `--corsProxy`                    | 啟用 CORS 代理。若未提供，                  | boolean |
| `--disableCsrf`                  | 停用 CSRF 保護                              | boolean |
| `--ssl`                          | 啟用 SSL                                    | boolean |
| `--certPath`                     | 設定您證書文件的路徑                        | string  |
| `--keyPath`                      | 設定您私人金鑰文件的路徑                    | string  |
| `--whitelist`                    | 啟用白名單模式                              | boolean |
| `--dataRoot`                     | 設定數據儲存的根目錄                        | string  |
| `--basicAuthMode`                | 啟用基本身份驗證模式                        | boolean |
| `--requestProxyEnabled`          | 啟用代理以處理外部請求                      | boolean |
| `--requestProxyUrl`              | 設定請求代理的 URL（支持 HTTP 或 SOCKS 協議）| string  |
| `--requestProxyBypass`           | 請求代理的例外主機清單（主機列表需以空格分隔）| array   |

## 遠端連線

遠端連線功能最常用於希望在手機上使用 SillyTavern 的使用者。此時伺服器將由同一 Wi-Fi 網路上的 PC 運行。不過，您也可以設定來自其他網路的遠端連線。

詳細設定指南請參閱 [官方說明文件](https://docs.sillytavern.app/usage/remoteconnections/)。

您還可以選擇設定 SillyTavern 的使用者檔案，並開啟密碼保護（可選）：[使用者設定指南](https://docs.sillytavern.app/installation/st-1.12.0-migration-guide/#users)。

## 遇到任何效能問題？

1. 在「使用者設定」選單（設定介面主題）中，禁用模糊效果（Blur Effect），並開啟「減少動畫效果」（Reduced Motion）
2. 若使用響應串流傳輸，請將串流的 FPS 設定為較低的值（建議設定為 10-15 FPS）
3. 確保瀏覽器已啟用 GPU 加速以進行渲染

## 授權與致謝

**本程式（SillyTavern）的發布是基於其可能對使用者有所幫助的期許，但不提供任何形式的保證；包括但不限於對可銷售性（marketability）或特定用途適用性的隱含保證。如需更多詳情，請參閱 GNU Affero 通用公共許可證。**

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

* [TavernAI](https://github.com/TavernAI/TavernAI) 1.2.8 由 Humi 提供：MIT 許可
* 經授權使用部分來自 CncAnon 的 TavernAITurbo 模組
* 視覺小說模式（Visual Novel Mode）的靈感，來源於 PepperTaco 的貢獻（<https://github.com/peppertaco/Tavern/>）
* Noto Sans 字體由 Google 提供（OFL 許可）
* 主題圖示由 Font Awesome <https://fontawesome.com> 提供（圖示：CC BY 4.0，字體：SIL OFL 1.1，程式碼：MIT 許可）
* 預設資源來源於 @OtisAlejandro（包含角色 Seraphina 與知識書）與 @kallmeflocc（SillyTavern 官方 Discord 伺服器成員突破 10K 的慶祝背景）
* Docker 安裝指南由 [@mrguymiah](https://github.com/mrguymiah) 和 [@Bronya-Rand](https://github.com/Bronya-Rand) 編寫

## 主要貢獻者

[![Contributors](https://contrib.rocks/image?repo=SillyTavern/SillyTavern)](https://github.com/SillyTavern/SillyTavern/graphs/contributors)

<!-- LINK GROUP -->
[cover]: https://github.com/user-attachments/assets/01a6ae9a-16aa-45f2-8bff-32b5dc587e44
[discord-link]: https://discord.gg/sillytavern
[discord-shield-badge]: https://img.shields.io/discord/1100685673633153084?color=5865F2&label=discord&labelColor=black&logo=discord&logoColor=white&style=for-the-badge
