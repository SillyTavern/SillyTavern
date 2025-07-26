> [!IMPORTANT]  
> Приведенная здесь информация может быть устаревшей или неполной и предоставляется только для вашего удобства. Пожалуйста, используйте английскую версию для получения наиболее актуальной информации.

<a name="readme-top"></a>

![][cover]

<div align="center">

[English](readme.md) | [German](readme-de_de.md) | [中文](readme-zh_cn.md) | [繁體中文](readme-zh_tw.md) | [日本語](readme-ja_jp.md) | Русский | [한국어](readme-ko_kr.md)

[![GitHub Stars](https://img.shields.io/github/stars/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/forks)
[![GitHub Issues](https://img.shields.io/github/issues/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/pulls)

</div>

---

SillyTavern предоставляет единый интерфейс для многих LLM API (KoboldAI/CPP, Horde, NovelAI, Ooba, Tabby, OpenAI, OpenRouter, Claude, Mistral и других), мобайл-френдли макет, режим визуальной новеллы, интеграцию с генерацией изображений через API Automatic1111 и ComfyUI, TTS, WorldInfo (лорбуки), кастомизируемый UI, автоперевод, тончайшую настройку промптов, и возможность устанавливать расширения.

Чтобы помочь вам быстрее разобраться в SillyTavern, мы создали [сайт с документацией](https://docs.sillytavern.app/). Ответы на большинство вопросов можно найти там.

## Что такое SillyTavern?

SillyTavern (или сокращенно ST) - это локально устанавливаемый пользовательский интерфейс, который позволяет вам взаимодействовать с LLM для генерации текста, движками для генерации изображений и моделями голоса TTS.

Начавшись в феврале 2023 года как форк TavernAI 1.2.8, SillyTavern теперь насчитывает более 200 контрибьюторов и 2 года независимой разработки, и продолжает служить ведущим программным обеспечением для опытных энтузиастов ИИ.

## Наше видение

1. Мы стремимся предоставить пользователям как можно больше полезности и контроля над их промптами LLM. Крутая кривая обучения - это часть веселья!
2. Мы не предоставляем никаких онлайн или хостинговых услуг, а также программно не отслеживаем данные пользователей.
3. SillyTavern - это проект, созданный преданным сообществом энтузиастов LLM, и он всегда будет бесплатным и с открытым исходным кодом.

## Нужен ли мне мощный компьютер для запуска SillyTavern?

Требования к оборудованию минимальны: он будет работать на всем, что может запустить NodeJS 18 или выше. Если вы собираетесь выполнять инференс LLM на своем локальном компьютере, мы рекомендуем видеокарту NVIDIA 3000-й серии с не менее чем 6 ГБ видеопамяти, но фактические требования могут варьироваться в зависимости от модели и используемого вами бэкенда.

## Вопросы или предложения?

### Сервер в Discord

| [![][discord-shield-badge]][discord-link] | [Вступайте в наше Discord-сообщество!](https://discord.gg/sillytavern) Получайте поддержку, делитесь любимыми персонажами и промптами. |
| :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- |

Или свяжитесь с разработчиками напрямую:

* Discord: cohee, rossascends, wolfsblvt
* Reddit: [/u/RossAscends](https://www.reddit.com/user/RossAscends/), [/u/sillylossy](https://www.reddit.com/user/sillylossy/), [u/Wolfsblvt](https://www.reddit.com/user/Wolfsblvt/)
* [Опубликовать issue на GitHub](https://github.com/SillyTavern/SillyTavern/issues)

### Мне нравится ваш проект! Как я могу внести свой вклад?

1. Отправляйте пулл-реквесты. Узнайте, как внести свой вклад: [CONTRIBUTING.md](../CONTRIBUTING.md)
2. Отправляйте предложения по функциям и отчеты о проблемах, используя предоставленные шаблоны.
3. Прочтите весь этот файл readme и сайт документации, чтобы избежать отправки дублирующихся проблем.

## Скриншоты

<img width="500" alt="image" src="https://github.com/user-attachments/assets/9b5f32f0-c3b3-4102-b3f5-0e9213c0f50f">
<img width="500" alt="image" src="https://github.com/user-attachments/assets/913fdbaa-7d33-42f1-ae2c-89dca41c53d1">

## Установка

Для получения подробных инструкций по установке, пожалуйста, посетите нашу документацию:

* **[Руководство по установке для Windows](https://docs.sillytavern.app/installation/windows/)**
* **[Руководство по установке для MacOS/Linux](https://docs.sillytavern.app/installation/linuxmacos/)**
* **[Руководство по установке для Android (Termux)](https://docs.sillytavern.app/installation/android-(termux)/)**
* **[Руководство по установке Docker](https://docs.sillytavern.app/installation/docker/)**

## Лицензия и благодарности

**Эта программа распространяется в надежде, что она будет полезна, но БЕЗ КАКИХ-ЛИБО ГАРАНТИЙ; даже без подразумеваемой гарантии ТОВАРНОЙ ПРИГОДНОСТИ или ПРИГОДНОСТИ ДЛЯ ОПРЕДЕЛЕННОЙ ЦЕЛИ. Смотрите GNU Affero General Public License для получения более подробной информации.**

* [TavernAI](https://github.com/TavernAI/TavernAI) 1.2.8 от Humi: лицензия MIT
* Части мода CncAnon TavernAITurbo используются с разрешения
* Режим визуальной новеллы вдохновлен работой PepperTaco (<https://github.com/peppertaco/Tavern/>)
* Шрифт Noto Sans от Google (лицензия OFL)
* Тема иконок от Font Awesome <https://fontawesome.com> (Иконки: CC BY 4.0, Шрифты: SIL OFL 1.1, Код: лицензия MIT)
* Стандартный контент от @OtisAlejandro (персонаж Seraphina и лорбук) и @kallmeflocc (фон в честь 10 тысяч пользователей Discord)
* Руководство по Docker от [@mrguymiah](https://github.com/mrguymiah) и [@Bronya-Rand](https://github.com/Bronya-Rand)
* Библиотека kokoro-js от [@hexgrad](https://github.com/hexgrad) (лицензия Apache-2.0)

## Ведущие контрибьюторы

[![Contributors](https://contrib.rocks/image?repo=SillyTavern/SillyTavern)](https://github.com/SillyTavern/SillyTavern/graphs/contributors)

<!-- LINK GROUP -->
[cover]: https://github.com/user-attachments/assets/01a6ae9a-16aa-45f2-8bff-32b5dc587e44
[discord-link]: https://discord.gg/sillytavern
[discord-shield-badge]: https://img.shields.io/discord/1100685673633153084?color=5865F2&label=discord&labelColor=black&logo=discord&logoColor=white&style=for-the-badge
