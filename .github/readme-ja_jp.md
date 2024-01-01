[English](readme.md) | [中文](readme-zh_cn.md) | 日本語

![SillyTavern-Banner](https://github.com/SillyTavern/SillyTavern/assets/18619528/c2be4c3f-aada-4f64-87a3-ae35a68b61a4)

モバイルフレンドリーなレイアウト、マルチAPI（KoboldAI/CPP、Horde、NovelAI、Ooba、OpenAI、OpenRouter、Claude、Scale）、VN ライクな Waifu モード、Stable Diffusion、TTS、WorldInfo（伝承本）、カスタマイズ可能な UI、自動翻訳、あなたにとって必要とする以上のプロンプトオプション＋サードパーティの拡張機能をインストールする機能。

[TavernAI](https://github.com/TavernAI/TavernAI) 1.2.8 のフォークに基づいています

## 重要ニュース！

1. 私たちは[ドキュメント website](https://docs.sillytavern.app/) を作成し、ほとんどの質問にお答えしています。

2. アップデートしたらに拡張機能を見失った？リリースバージョン 1.10.6 以降、これまで内蔵されていた拡張機能のほとんどがダウンロード可能なアドオンに変更されました。ダウンロードは、拡張機能パネル（トップバーのスタックドブロックアイコン）にある内蔵の "Download Extensions and Assets" メニューから行えます。

### Cohee、RossAscends、SillyTavern コミュニティがお届けします

### SillyTavern または TavernAI とは何ですか？

SillyTavern は、あなたのコンピュータ（および Android スマホ）にインストールできるユーザーインターフェイスで、テキスト生成 AI と対話したり、あなたやコミュニティが作成したキャラクターとチャットやロールプレイをすることができます。

SillyTavern は TavernAI 1.2.8 のフォークで、より活発な開発が行われており、多くの主要な機能が追加されています。現時点では、これらは完全に独立したプログラムと考えることができます。

### ブランチ

SillyTavern は、すべてのユーザーにスムーズな体験を保証するために、2 つのブランチシステムを使用して開発されています。

* release -🌟 **ほとんどのユーザーにお勧め。** これは最も安定した推奨ブランチで、メジャーリリースがプッシュされた時のみ更新されます。大半のユーザーに適しています。
* staging - ⚠️ **カジュアルな使用にはお勧めしない。** このブランチには最新の機能がありますが、いつ壊れるかわからないので注意してください。パワーユーザーとマニア向けです。

git CLI の使い方に慣れていなかったり、ブランチが何なのかわからなかったりしても、心配はいりません！リリースブランチが常に望ましい選択肢となります。

### Tavern 以外に何が必要ですか？

Tavern は単なるユーザーインターフェイスなので、それだけでは役に立ちません。ロールプレイキャラクターとして機能する AI システムのバックエンドにアクセスする必要があります。様々なバックエンドがサポートされています： OpenAPI API (GPT)、KoboldAI (ローカルまたは Google Colab 上で動作)、その他。詳しくは [FAQ](https://docs.sillytavern.app/usage/faq/) をご覧ください。

### Tavern を実行するには、強力な PC が必要ですか？

Tavern は単なるユーザーインターフェイスであり、必要なハードウェアはごくわずかです。パワフルである必要があるのは、AI システムのバックエンドです。

## モバイルサポート

> **注**

> **このフォークは Termux を使って Android スマホでネイティブに実行できます。ArroganceComplex#2659 のガイドを参照してください:**

<https://rentry.org/STAI-Termux>

## ご質問やご提案

### コミュニティ Discord サーバーを開設しました

サポートを受け、お気に入りのキャラクターやプロンプトを共有する:

### [参加](https://discord.gg/RZdyAEUPvj)

***

開発者と直接連絡を取る:

* Discord: cohee または rossascends
* Reddit: /u/RossAscends または /u/sillylossy
* [GitHub issue を投稿](https://github.com/SillyTavern/SillyTavern/issues)

## このバージョンには以下が含まれる

* 大幅に修正された TavernAI 1.2.8 (コードの 50% 以上が書き換えまたは最適化されています)
* スワイプ
* グループチャット: キャラクター同士が会話できるマルチボットルーム
* チャットチェックポイント / ブランチ
* 高度なKoboldAI / TextGen生成設定と、コミュニティが作成した多くのプリセット
* ワールド情報サポート: 豊富な伝承を作成したり、キャラクターカードにトークンを保存したりできます
* [OpenRouter](https://openrouter.ai) 各種 API(Claude、GPT-4/3.5 など)の接続
* [Oobabooga's TextGen WebUI](https://github.com/oobabooga/text-generation-webui) API 接続
* [AI Horde](https://horde.koboldai.net/) 接続
* プロンプト生成フォーマットの調整

## 拡張機能

SillyTavern は拡張性をサポートしており、[SillyTavern Extras API](https://github.com/SillyTavern/SillyTavern-extras) を介していくつかの追加AIモジュールをホストしています

* 作者ノート/キャラクターバイアス
* キャラクターの感情表現（スプライト）
* チャット履歴の自動サマリー
* チャットに画像を送り、AI が内容を解釈する
* Stable Diffusion 画像生成 (5 つのチャット関連プリセットと 'free mode')
* AI 応答メッセージの音声合成（ElevenLabs、Silero、または OS のシステム TTS 経由）

含まれている拡張機能の完全なリストとその使い方のチュートリアルは [Docs](https://docs.sillytavern.app/) にあります。

## RossAscends による UI/CSS/クオリティオブライフの調整

* iOS 用に最適化されたモバイル UI で、ホーム画面へのショートカット保存とフルスクリーンモードでの起動をサポート。
* ホットキー
  * Up = チャットの最後のメッセージを編集する
  * Ctrl+Up = チャットで最後のユーザーメッセージを編集する
  * Left = 左スワイプ
  * Right = 右スワイプ (注: チャットバーに何か入力されている場合、スワイプホットキーが無効になります)
  * Ctrl+Left = ローカルに保存された変数を見る（ブラウザのコンソールウィンドウにて）
  * Enter (チャットバー選択時) = AI にメッセージを送る
  * Ctrl+Enter = 最後の AI 応答を再生成する

* ユーザー名の変更と文字の削除でページが更新されなくなりました。

* ページロード時に API に自動的に接続するかどうかを切り替えます。
* ページの読み込み時に、最近見た文字を自動的に読み込むかどうかを切り替えます。
* より良いトークンカウンター - 保存されていないキャラクターに対して機能し、永続的なトークンと一時的なトークンの両方を表示する。

* より良い過去のチャット
  * 新しいチャットのファイル名は、"(文字) - (作成日)" という読みやすい形式で保存されます
  * チャットのプレビューが 40 文字から 300 文字に増加。
  * 文字リストの並べ替えに複数のオプション（名前順、作成日順、チャットサイズ順）があります。

* デフォルトでは、左右の設定パネルはクリックすると閉じます。
* ナビパネルのロックをクリックすると、パネルが開いたままになり、この設定はセッションをまたいで記憶されます。
* ナビパネルの開閉状態もセッションをまたいで保存されます。

* カスタマイズ可能なチャット UI:
  * 新しいメッセージが届いたときにサウンドを再生する
  * 丸型、長方形のアバタースタイルの切り替え
  * デスクトップのチャットウィンドウを広くする
  * オプションの半透明ガラス風パネル
  * 'メインテキスト'、'引用テキスト'、'斜体テキスト'のページカラーをカスタマイズ可能。
  * カスタマイズ可能な UI 背景色とぼかし量

## インストール

*注: このソフトウェアはローカルにインストールすることを目的としており、colab や他のクラウドノートブックサービス上では十分にテストされていません。*

> **警告**

> WINDOWS が管理しているフォルダ（Program Files、System32 など）にはインストールしないでください

> START.BAT を管理者権限で実行しないでください

### Windows

Git 経由でのインストール（更新を容易にするため推奨）

きれいな写真付きのわかりやすいガイド:
<https://docs.sillytavern.app/installation/windows/>

  1. [NodeJS](https://nodejs.org/en) をインストールする(最新の LTS 版を推奨)
  2. [GitHub Desktop](https://central.github.com/deployments/desktop/desktop/latest/win32) をインストールする
  3. Windows エクスプローラーを開く (`Win+E`)
  4. Windows によって制御または監視されていないフォルダを参照または作成する。（例: C:\MySpecialFolder\）
  5. 上部のアドレスバーをクリックし、`cmd` と入力して Enter キーを押し、そのフォルダーの中にコマンドプロンプトを開きます。
  6. 黒いボックス（コマンドプロンプト）がポップアップしたら、そこに以下のいずれかを入力し、Enter を押します:

* Release ブランチの場合: `git clone https://github.com/SillyTavern/SillyTavern -b release`
* Staging ブランチの場合: `git clone https://github.com/SillyTavern/SillyTavern -b staging`

  7. すべてをクローンしたら、`Start.bat` をダブルクリックして、NodeJS に要件をインストールさせる。
  8. サーバーが起動し、SillyTavern がブラウザにポップアップ表示されます。

ZIP ダウンロードによるインストール（推奨しない）

  1. [NodeJS](https://nodejs.org/en) をインストールする(最新の LTS 版を推奨)
  2. GitHub のリポジトリから zip をダウンロードする。(`ソースコード(zip)` は [Releases](https://github.com/SillyTavern/SillyTavern/releases/latest) から入手)
  3. お好きなフォルダに解凍してください
  4. `Start.bat` をダブルクリックまたはコマンドラインで実行する。
  5. サーバーがあなたのためにすべてを準備したら、ブラウザのタブを開きます。

### Linux

  1. `node -v` を実行して、Node.js v18 以上（最新の [LTS バージョン](https://nodejs.org/en/download/) を推奨）がインストールされていることを確認してください。
または、[Node Version Manager](https://github.com/nvm-sh/nvm#installing-and-updating) スクリプトを使用して、迅速かつ簡単に Node のインストールを管理します。
  2. `start.sh` スクリプトを実行する。
  3. お楽しみください。

## API キー管理

SillyTavern は API キーをサーバーディレクトリの `secrets.json` ファイルに保存します。

デフォルトでは、入力後にページをリロードしても、フロントエンドには表示されません。

API ブロックのボタンをクリックして、キーを閲覧できるようにする:

1. ファイル `config.yaml` で `allowKeysExposure` の値を `true` に設定する。
2. SillyTavern サーバを再起動します。

## リモート接続

SillyTavern をスマホで使用しながら、同じ Wifi ネットワーク上で ST サーバーを PC で実行したい場合に使用します。

しかし、これはどこからでもリモート接続を許可するために使用することができます。

**重要: SillyTavern はシングルユーザーのプログラムなので、ログインすれば誰でもすべてのキャラクターとチャットを見ることができ、UI 内で設定を変更することができます。**

### 1. ホワイトリスト IP の管理

* SillyTavern のベースインストールフォルダ内に `whitelist.txt` という新しいテキストファイルを作成します。
* テキストエディタでこのファイルを開き、接続を許可したい IP のリストを追加します。

*個々の IP とワイルドカード IP 範囲の両方が受け入れられる。例:*

```txt
192.168.0.1
192.168.0.20
```

または

```txt
192.168.0.*
```

(上記のワイルドカード IP 範囲は、ローカルネットワーク上のどのデバイスでも)

CIDR マスクも受け付ける（例：10.0.0.0/24）。

* `whitelist.txt` ファイルを保存する。
* TAI サーバーを再起動する。

これでファイルに指定された IP を持つデバイスが接続できるようになる。

*注: `config.yaml` にも `whitelist` 配列があり、同じように使うことができるが、`whitelist.txt` が存在する場合、この配列は無視される。*

### 2. ST ホストマシンの IP の取得

ホワイトリストの設定後、ST ホストデバイスの IP が必要になります。

ST ホストデバイスが同じ無線 LAN ネットワーク上にある場合、ST ホストの内部無線 LAN IP を使用します:

* Windows の場合: ウィンドウズボタン > 検索バーに `cmd.exe` と入力 > コンソールに `ipconfig` と入力して Enter > `IPv4` のリストを探す。

同じネットワーク上にいない状態で、ホストしているSTに接続したい場合は、STホスト機器のパブリックIPが必要です。

* ST ホストデバイスを使用中に、[このページ](https://whatismyipaddress.com/)にアクセスし、`IPv4` を探してください。これはリモートデバイスからの接続に使用するものです。

### 3. リモートデバイスを ST ホストマシンに接続します。

最終的に使用する IP が何であれ、その IP アドレスとポート番号をリモートデバイスのウェブブラウザに入力します。

同じ無線 LAN ネットワーク上の ST ホストの典型的なアドレスは以下のようになります:

`http://192.168.0.5:8000`

http:// を使用し、https:// は使用しないでください

### ST をすべての IP に開放する

これはお勧めしませんが、`config.yaml` を開き、`whitelistMode` を `false` に変更してください。

SillyTavern のベースインストールフォルダにある `whitelist.txt` が存在する場合は削除（または名前の変更）する必要があります。

これは通常安全ではないので、これを行う際にはユーザー名とパスワードを設定する必要があります。

ユーザー名とパスワードは `config.yaml` で設定します。

ST サーバを再起動すると、ユーザ名とパスワードさえ知っていれば、IP に関係なくどのデバイスでも ST サーバに接続できるようになる。

### まだ接続できませんか？

* `config.yaml` で見つかったポートに対して、インバウンド/アウトバウンドのファイアウォールルールを作成します。これをルーターのポートフォワーディングと間違えないでください。そうしないと、誰かがあなたのチャットログを見つける可能性があり、それはマジで止めましょう。
* 設定 > ネットワークとインターネット > イーサネットで、プライベートネットワークのプロファイルタイプを有効にします。そうしないと、前述のファイアウォールルールを使っても接続できません。

## パフォーマンスに問題がありますか？

ユーザー設定パネルでブラー効果なし（高速 UI）モードを有効にしてみてください。

## このプロジェクトが好きです！どうすればコントリビュートできますか？

### やるべきこと

1. プルリクエストを送る
2. 確立されたテンプレートを使って機能提案と課題レポートを送る
3. 何か質問する前に、readme ファイルや組み込みのドキュメントを読んでください

### やらないべきこと

1. 金銭の寄付を申し出る
2. 何の脈絡もなくバグ報告を送る
3. すでに何度も回答されている質問をする

## 古い背景画像はどこにありますか？

100％ オリジナルコンテンツのみのポリシーに移行しているため、古い背景画像はこのリポジトリから削除されました。

アーカイブはこちら:

<https://files.catbox.moe/1xevnc.zip>

## スクリーンショット

<img width="400" alt="image" src="https://user-images.githubusercontent.com/18619528/228649245-8061c60f-63dc-488e-9325-f151b7a3ec2d.png">
<img width="400" alt="image" src="https://user-images.githubusercontent.com/18619528/228649856-fbdeef05-d727-4d5a-be80-266cbbc6b811.png">

## ライセンスとクレジット

**このプログラムは有用であることを願って配布されていますが、いかなる保証もありません;
また、商品性または特定目的への適合性についての黙示の保証もありません。
詳細は GNU Affero General Public License をご覧ください。**

* Humi によるTAI Base: 不明ライセンス
* Cohee の修正と派生コード: AGPL v3
* RossAscends の追加: AGPL v3
* CncAnon の TavernAITurbo 改造の一部: 不明ライセンス
* kingbri のさまざまなコミットと提案 (<https://github.com/bdashore3>)
* city_unit の拡張機能と様々な QoL 機能 (<https://github.com/city-unit>)
* StefanDanielSchwarz のさまざまなコミットとバグ報告 (<https://github.com/StefanDanielSchwarz>)
* PepperTaco の作品にインスパイアされた Waifu モード (<https:/fugithub.com/peppertaco/Tavern/>)
* ピグマリオン大学の皆さん、素晴らしいテスターとしてクールな機能を提案してくれてありがとう！
* TextGen のプリセットをコンパイルしてくれた obabooga に感謝
* KAI Lite の KoboldAI プリセット: <https://lite.koboldai.net/>
* Google による Noto Sans フォント（OFLライセンス）
* Font Awesome によるアイコンテーマ <https://fontawesome.com> (アイコン: CC BY 4.0、フォント: SIL OFL 1.1、コード: MIT License)
* ZeldaFan0225 による AI Horde クライアントライブラリ: <https://github.com/ZeldaFan0225/ai_horde>
* AlpinDale による Linux 起動スクリプト
* FAQ を提供してくれた paniphons に感謝
* 10K ディスコード・ユーザー記念背景 by @kallmeflocc
* デフォルトコンテンツ（キャラクターと伝承書）の提供: @OtisAlejandro、@RossAscends、@kallmeflocc
* @doloroushyeonse による韓国語翻訳
* k_euler_a による Horde のサポート <https://github.com/Teashrock>
* [@XXpE3](https://github.com/XXpE3) による中国語翻訳、中国語 ISSUES の連絡先は @XXpE3
