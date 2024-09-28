> [!IMPORTANT]  
> Die hier veröffentlichten Informationen sind möglicherweise veraltet oder unvollständig. Für aktuelle Informationen nutzen Sie bitte die englische Version.
> Letztes Update dieser README: 28.9.2024

<a name="readme-top"></a>

[Englisch](readme.md) | Deutsch | [中文](readme-zh_cn.md) | [日本語](readme-ja_jp.md) | [Русский](readme-ru_ru.md)

![][cover]

Mobile-freundliches Layout, Multi-API (KoboldAI/CPP, Horde, NovelAI, Ooba, OpenAI, OpenRouter, Claude, Scale), VN-ähnlicher Waifu-Modus, Stable Diffusion, TTS, WorldInfo (Lore-Bücher), anpassbare Benutzeroberfläche, automatische Übersetzung und mehr Eingabeoptionen, als du jemals möchtest oder benötigst + die Möglichkeit, Drittanbietererweiterungen zu installieren.

Basierend auf einem Fork von [TavernAI](https://github.com/TavernAI/TavernAI) 1.2.8

## Wichtige Neuigkeiten!

1. Wir haben eine [Dokumentationswebsite](https://docs.sillytavern.app/) erstellt, um die meisten deiner Fragen zu beantworten und dir den Einstieg zu erleichtern.

2. Fehlende Erweiterungen nach dem Update? Seit der Version 1.10.6 wurden die meisten zuvor integrierten Erweiterungen in herunterladbare Add-Ons umgewandelt. Du kannst sie über das integrierte Menü „Erweiterungen und Assets herunterladen“ im Erweiterungsbereich (gestapelte Block-Symbol in der oberen Leiste) herunterladen.

3. Nicht unterstützte Plattform: android arm LEtime-web. 32-Bit Android erfordert eine externe Abhängigkeit, die nicht mit npm installiert werden kann. Verwende den folgenden Befehl, um es zu installieren: `pkg install esbuild`. Führe dann die üblichen Installationsschritte aus.

### Präsentiert von Cohee, RossAscends und der SillyTavern-Community

### Was ist SillyTavern oder TavernAI?

SillyTavern ist eine Benutzeroberfläche, die du auf deinem Computer (und Android-Handys) installieren kannst, mit der du mit textgenerierenden KIs interagieren und mit Charakteren chatten/rollen, die du oder die Community erstellen.

SillyTavern ist ein Fork von TavernAI 1.2.8, der aktiver weiterentwickelt wird und viele wichtige Funktionen hinzugefügt hat. An diesem Punkt können sie als völlig unabhängige Programme betrachtet werden.

## Screenshots

<img width="400" alt="image" src="https://github.com/SillyTavern/SillyTavern/assets/61471128/e902c7a2-45a6-4415-97aa-c59c597669c1"> 
<img width="400" alt="image" src="https://github.com/SillyTavern/SillyTavern/assets/61471128/f8a79c47-4fe9-4564-9e4a-bf247ed1c961">

### Branches

SillyTavern wird mit einem Zwei-Branch-System entwickelt, um allen Nutzern ein reibungsloses Erlebnis zu gewährleisten.

* release -🌟 **Empfohlen für die meisten Nutzer.** Dies ist der stabilste und empfohlene Branch, der nur aktualisiert wird, wenn wichtige Releases veröffentlicht werden. Er ist für die Mehrheit der Nutzer geeignet.
* staging - ⚠️ **Nicht empfohlen für gelegentliche Nutzung.** Dieser Branch hat die neuesten Funktionen, aber sei vorsichtig, da er jederzeit abstürzen kann. Nur für Power-User und Enthusiasten.

Wenn du mit der Verwendung der git-CLI nicht vertraut bist oder nicht verstehst, was ein Branch ist, mach dir keine Sorgen! Der Release-Branch ist immer die bevorzugte Option für dich.

### Was benötige ich zusätzlich zu SillyTavern?

SillyTavern allein ist nutzlos, da es nur eine Benutzeroberfläche ist. Du musst Zugriff auf ein KI-System-Backend haben, das als Rollenspielcharakter agieren kann. Es gibt verschiedene unterstützte Backends: OpenAPI API (GPT), KoboldAI (entweder lokal oder auf Google Colab) und mehr. Du kannst mehr darüber in [den FAQ](https://docs.sillytavern.app/usage/faq/) lesen.

### Brauche ich einen leistungsstarken PC, um SillyTavern auszuführen?

Da SillyTavern nur eine Benutzeroberfläche ist, hat es sehr geringe Hardwareanforderungen und läuft auf allem. Es ist das KI-System-Backend, das leistungsfähig sein muss.

## Fragen oder Vorschläge?

### Wir haben jetzt einen Community-Discord-Server

| [![][discord-shield-badge]][discord-link] | [Tritt unserer Discord-Community bei!](https://discord.gg/sillytavern) Erhalte Unterstützung, teile Lieblingscharaktere und Eingaben. |
| :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |

Oder kontaktiere die Entwickler direkt:

* Discord: cohee oder rossascends
* Reddit: [/u/RossAscends](https://www.reddit.com/user/RossAscends/) oder [/u/sillylossy](https://www.reddit.com/user/sillylossy/)
* [Erstelle ein GitHub-Problem](https://github.com/SillyTavern/SillyTavern/issues)

## Diese Version beinhaltet

* Eine stark modifizierte TavernAI 1.2.8 (mehr als 50 % des Codes neu geschrieben oder optimiert)
* Swipes
* Gruppenchats: Multi-Bot-Räume, damit Charaktere mit dir oder untereinander sprechen können
* Chat-Checkpoints / Verzweigungen
* Erweiterte KoboldAI / TextGen-Generierungseinstellungen mit vielen von der Community erstellten Presets
* Unterstützung für World Info: Erstelle reichhaltige Lore oder speichere Token auf deiner Charakterkarte
* [OpenRouter](https://openrouter.ai) Verbindung für verschiedene APIs (Claude, GPT-4/3.5 und mehr)
* [Oobabooga's TextGen WebUI](https://github.com/oobabooga/text-generation-webui) API-Verbindung
* [AI Horde](https://horde.koboldai.net/) Verbindung
* Anpassung der Eingabeformatierung

## Erweiterungen

SillyTavern hat Unterstützung für Erweiterungen, mit einigen zusätzlichen KI-Modulen, die über die [SillyTavern Extras API](https://github.com/SillyTavern/SillyTavern-extras) gehostet werden

* Autorennotiz / Charakterbias
* Emotionale Ausdrücke von Charakteren (Sprites)
* Automatische Zusammenfassung der Chat-Historie
* Bilder in den Chat senden, und die KI interpretiert den Inhalt
* Stable Diffusion-Bilderzeugung (5 chatbezogene Presets plus „freier Modus“)
* Text-to-Speech für KI-Antwortnachrichten (über ElevenLabs, Silero oder die TTS des Betriebssystems)

Eine vollständige Liste der enthaltenen Erweiterungen und Tutorials zur Nutzung findest du in den [Docs](https://docs.sillytavern.app/).

## UI/CSS/Qualitätsverbesserungen von RossAscends

* Mobile UI optimiert für iOS und unterstützt das Speichern einer Verknüpfung auf dem Startbildschirm sowie das Öffnen im Vollbildmodus.
* HotKeys
  * Hoch = Letzte Nachricht im Chat bearbeiten
  * Strg+Hoch = Letzte NUTZER-Nachricht im Chat bearbeiten
  * Links = nach links wischen
  * Rechts = nach rechts wischen (HINWEIS: Swipe-Hotkeys sind deaktiviert, wenn im Chatfeld etwas eingegeben ist)
  * Strg+Links = lokal gespeicherte Variablen anzeigen (im Browser-Konsolefenster)
  * Eingabetaste (mit ausgewähltem Chatfeld) = sende deine Nachricht an die KI
  * Strg+Eingabetaste = regeneriere die letzte KI-Antwort

* Änderungen des Benutzernamens und das Löschen von Charakteren erzwingen nicht mehr das Neuladen der Seite.

* Umschaltoption, um sich beim Laden der Seite automatisch mit der API zu verbinden.
* Umschaltoption, um beim Laden der Seite automatisch den zuletzt angesehenen Charakter zu laden.
* Besserer Token-Zähler - funktioniert bei nicht gespeicherten Charakteren und zeigt sowohl permanente als auch temporäre Tokens an.

* Bessere Ansicht vergangener Chats
  * Neue Chat-Dateinamen werden in einem lesbaren Format von "(Charakter) - (wann es erstellt wurde)" gespeichert.
  * Die Vorschau der Chats wurde von 40 Zeichen auf 300 Zeichen erhöht.
  * Mehrere Optionen zum Sortieren der Charakterliste (nach Name, Erstellungsdatum, Chat-Größen).

* Standardmäßig wird das linke und rechte Einstellungsfeld geschlossen, wenn du außerhalb davon klickst.
* Ein Klick auf das Schloss im Navigationsfeld hält das Feld geöffnet, und diese Einstellung wird über Sitzungen hinweg gespeichert.
* Der Status des Navigationsfelds (offen oder geschlossen) wird ebenfalls über Sitzungen hinweg gespeichert.

* Anpassbare Chat-Benutzeroberfläche:
  * Einen Ton abspielen, wenn eine neue Nachricht eintrifft
  * Zwischen runden oder rechteckigen Avatar-Stilen wechseln
  * Ein breiteres Chat-Fenster auf dem Desktop haben
  * Optionale halbtransparente, glasähnliche Panels
  * Anpassbare Seitenfarben für 'Haupttext', 'zitierten Text' und 'kursiven Text'.
  * Anpassbare Hintergrundfarbe der Benutzeroberfläche und Unschärfegrad

# ⌛ Installation

> \[!WARNING]
> * INSTALLIERE NICHT IN EINEN VON WINDOWS KONTROLLIERTEN FOLDER (Programme, System32 usw.).
> * FÜHRE START.BAT NICHT MIT ADMIN-BERECHTIGUNGEN AUS
> * INSTALLATION UNTER WINDOWS 7 IST UNMÖGLICH, DA ES NODEJS 18.16 NICHT AUSFÜHREN KANN.

## 🪟 Windows

## Installation über Git
  1. Installiere [NodeJS](https://nodejs.org/en) (die neueste LTS-Version wird empfohlen)
  2. Installiere [Git für Windows](https://gitforwindows.org/)
  3. Öffne den Windows-Explorer (`Win+E`)
  4. Durchsuche oder erstelle einen Ordner, der nicht von Windows kontrolliert oder überwacht wird. (z.B.: C:\MeinBesondererOrdner\)
  5. Öffne ein Eingabeaufforderungsfenster in diesem Ordner, indem du in die 'Adresszeile' oben klickst, `cmd` eintippst und Enter drückst.
  6. Sobald das schwarze Fenster (Eingabeaufforderung) erscheint, tippe EINE der folgenden Befehle ein und drücke Enter:

- für den Release-Branch: `git clone https://github.com/SillyTavern/SillyTavern -b release`
- für den Staging-Branch: `git clone https://github.com/SillyTavern/SillyTavern -b staging`

  7. Sobald alles geklont ist, doppelklicke auf `Start.bat`, um NodeJS die Installation seiner Anforderungen durchführen zu lassen.
  8. Der Server wird dann gestartet und SillyTavern wird in deinem Browser geöffnet.

## Installation über den SillyTavern-Launcher
1. Drücke auf deiner Tastatur **`WINDOWS + R`**, um das Ausführen-Dialogfeld zu öffnen. Führe dann den folgenden Befehl aus, um git zu installieren:
```shell
cmd /c winget install -e --id Git.Git
```
2. Drücke auf deiner Tastatur **`WINDOWS + E`**, um den Datei-Explorer zu öffnen, navigiere dann zu dem Ordner, in dem du den Launcher installieren möchtest. Gib einmal im gewünschten Ordner `cmd` in die Adressleiste ein und drücke Enter. Führe dann den folgenden Befehl aus:
```shell
git clone https://github.com/SillyTavern/SillyTavern-Launcher.git && cd SillyTavern-Launcher && start installer.bat
```

## Installation über GitHub Desktop
(Das ermöglicht die Nutzung von git **nur** in GitHub Desktop; wenn du `git` auch in der Befehlszeile verwenden möchtest, musst du auch [Git für Windows](https://gitforwindows.org/) installieren.)
  1. Installiere [NodeJS](https://nodejs.org/en) (die neueste LTS-Version wird empfohlen)
  2. Installiere [GitHub Desktop](https://central.github.com/deployments/desktop/desktop/latest/win32)
  3. Nach der Installation von GitHub Desktop klicke auf `Ein Repository aus dem Internet klonen....` (Hinweis: Du **musst KEINEN** GitHub-Account für diesen Schritt erstellen)
  4. Klicke im Menü auf den Tab URL, gib diese URL ein `https://github.com/SillyTavern/SillyTavern`, und klicke auf Klonen. Du kannst den lokalen Pfad ändern, um zu ändern, wo SillyTavern heruntergeladen wird.
  6. Um SillyTavern zu öffnen, benutze den Windows-Explorer, um in den Ordner zu browsen, in den du das Repository geklont hast. Standardmäßig wird das Repository hier geklont: `C:\Users\[Dein Windows-Benutzername]\Documents\GitHub\SillyTavern`
  7. Doppelklicke auf die Datei `start.bat`. (Hinweis: Der Teil `.bat` des Dateinamens könnte von deinem Betriebssystem verborgen sein, in diesem Fall sieht es wie eine Datei namens "`Start`" aus. Dies ist das, was du doppelt klickst, um SillyTavern auszuführen)
  8. Nach dem Doppelklicken sollte sich ein großes schwarzes Konsolenfenster öffnen und SillyTavern wird beginnen, was es benötigt, um zu funktionieren, zu installieren.
  9. Nach dem Installationsprozess, wenn alles funktioniert, sollte das Konsolenfenster so aussehen und ein SillyTavern-Tab sollte in deinem Browser geöffnet sein:
  10. Verbinde dich mit einer der [unterstützten APIs](https://docs.sillytavern.app/usage/api-connections/) und beginne zu chatten!

## 🐧 Linux & 🍎 MacOS

Für MacOS / Linux werden all diese Schritte in einem Terminal durchgeführt.

1. Installiere git und nodeJS (die Methode dazu variiert je nach deinem Betriebssystem)
2. Klone das Repo

- für den Release-Branch: `git clone https://github.com/SillyTavern/SillyTavern -b release`
- für den Staging-Branch: `git clone https://github.com/SillyTavern/SillyTavern -b staging`

3. `cd SillyTavern`, um in den Installationsordner zu navigieren.
4. Führe das Skript `start.sh` mit einem dieser Befehle aus:

- `./start.sh`
- `bash start.sh`

## Installation über den SillyTavern-Launcher

### Für Linux-Nutzer
1. Öffne dein bevorzugtes Terminal und installiere git
2. Klone den SillyTavern-Launcher mit: 
```shell
git clone https://github.com/SillyTavern/SillyTavern-Launcher.git && cd SillyTavern-Launcher
```
3. Starte das installer.sh mit: 
```shell
chmod +x install.sh && ./install.sh
```
4. Starte nach der Installation das launcher.sh mit: 
```shell
chmod +x launcher.sh && ./launcher.sh
```

### Für Mac-Nutzer
1. Öffne ein Terminal und installiere brew mit: 
```shell
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
2. Installiere git mit: 
```shell
brew install git
```
3. Klone den Sillytavern-Launcher mit: 
```shell
git clone https://github.com/SillyTavern/SillyTavern-Launcher.git && cd SillyTavern-Launcher
```
4. Starte das installer.sh mit: 
```shell
chmod +x install.sh && ./install.sh
```
5. Starte nach der Installation das launcher.sh mit: 
```shell
chmod +x launcher.sh && ./launcher.sh
```

## 🐋 Installation über Docker

Diese Anweisungen setzen voraus, dass du Docker installiert hast, auf die Eingabeaufforderung zugreifen kannst, um Container zu installieren, und mit deren allgemeiner Funktionsweise vertraut bist.

### Das Bild selbst erstellen

Wir haben einen umfassenden Leitfaden zur Verwendung von SillyTavern in Docker [hier](http://docs.sillytavern.app/installation/docker/) veröffentlicht, der Installationen unter Windows, macOS und Linux abdeckt! Lies ihn dir durch, wenn du das Bild selbst erstellen möchtest.

### Verwendung des GitHub Container Registrys (einfachste Methode)

Du benötigst zwei obligatorische Verzeichniszuordnungen und eine Portzuordnung, um SillyTavern funktionsfähig zu machen. Ersetze in dem Befehl deine Auswahl an den folgenden Stellen:

#### Container-Variablen

##### Volumen-Zuordnungen

- [config] - Das Verzeichnis, in dem die Konfigurationsdateien von SillyTavern auf deinem Host-Rechner gespeichert werden
- [data] - Das Verzeichnis, in dem die Benutzerdaten von SillyTavern (einschließlich Charaktere) auf deinem Host-Rechner gespeichert werden
- [plugins] - (optional) Das Verzeichnis, in dem die Server-Plugins von SillyTavern auf deinem Host-Rechner gespeichert werden

##### Port-Zuordnungen

- [PublicPort] - Der Port, über den der Verkehr exponiert wird. Dies ist obligatorisch, da du von außerhalb des virtuellen Maschinencontainers auf die Instanz zugreifst. EXPONIERE DIES NICHT IM INTERNET, OHNE EINEN GETRENNTEN DIENST FÜR DIE SICHERHEIT ZU IMPLEMENTIEREN.

##### Zusätzliche Einstellungen

- [DockerNet] - Das Docker-Netzwerk, mit dem der Container erstellt werden soll. Wenn du nicht weißt, was das ist, siehe die [offizielle Docker-Dokumentation](https://docs.docker.com/reference/cli/docker/network/).
- [version] - Auf der rechten Seite dieser GitHub-Seite siehst du "Pakete". Wähle das Paket "sillytavern" aus, und du siehst die Bildversionen. Das Bild-Tag "latest" hält dich mit der aktuellen Version auf dem Laufenden. Du kannst auch die Tags "staging" und "release" verwenden, die auf die Nachbilder der jeweiligen Branches zeigen, aber das ist möglicherweise nicht angebracht, wenn du Erweiterungen verwendest, die möglicherweise beschädigt sind, und die möglicherweise Zeit benötigen, um aktualisiert zu werden.

#### Installationsbefehl

1. Öffne deine Eingabeaufforderung
2. Führe den folgenden Befehl aus

`docker create --name='sillytavern' --net='[DockerNet]' -p '8000:8000/tcp' -v '[plugins]':'/home/node/app/plugins':'rw' -v '[config]':'/home/node/app/config':'rw' -v '[data]':'/home/node/app/data':'rw' 'ghcr.io/sillytavern/sillytavern:[version]'`

> Beachte, dass 8000 ein Standard-Listening-Port ist. Vergiss nicht, einen geeigneten Port zu verwenden, wenn du ihn in der Konfiguration änderst.

## 📱 Mobil - Installation über Termux

> \[!NOTE]
> **SillyTavern kann nativ auf Android-Handys mit Termux ausgeführt werden. Bitte ziehe diesen Leitfaden von ArroganceComplex#2659 zurate:**
> * <https://rentry.org/STAI-Termux>

## API-Schlüsselverwaltung

SillyTavern speichert deine API-Schlüssel in einer `secrets.json`-Datei im Verzeichnis für Benutzerdaten (`/data/default-user/secrets.json` ist der Standardpfad).

Standardmäßig werden sie nicht nach der Eingabe und dem Neuladen der Seite im Frontend angezeigt.

Um die Anzeige deiner Schlüssel durch Klicken auf einen Button im API-Block zu aktivieren:

1. Setze den Wert von `allowKeysExposure` in der Datei `config.yaml` auf `true`.
2. Starte den SillyTavern-Server neu.

## Remote-Verbindungen

Meistens ist dies für Leute gedacht, die SillyTavern auf ihren Handys verwenden möchten, während ihr PC den ST-Server im selben WLAN-Netzwerk ausführt.

Es kann jedoch auch verwendet werden, um Remote-Verbindungen von überall zuzulassen.

**WICHTIG: Siehe den offiziellen Leitfaden, wenn du SillyTavern-Benutzerkonten mit (optionalem) Passwortschutz konfigurieren möchtest: [Benutzer](https://docs.sillytavern.app/installation/st-1.12.0-migration-guide/#users).**

### 1. Verwaltung der auf die Whitelist gesetzten IPs

* Erstelle eine neue Textdatei in deinem SillyTavern-Basisinstallationsordner mit dem Namen `whitelist.txt`.
* Öffne die Datei in einem Texteditor und füge eine Liste von IPs hinzu, die die Verbindung herstellen dürfen.

* Sowohl einzelne IPs als auch Wildcard-IP-Bereiche sind akzeptiert. Beispiele: *

```txt
192.168.0.1
192.168.0.20
```

oder

```txt
192.168.0.*
```

(die oben genannte Wildcard-IP-Reichweite ermöglicht es jedem Gerät im lokalen Netzwerk, sich zu verbinden)

CIDR-Masken werden ebenfalls akzeptiert (z. B. 10.0.0.0/24).

* Speichere die `whitelist.txt`-Datei.
* Starte deinen ST-Server neu.

Jetzt können Geräte, die die im Datei angegebene IP haben, sich verbinden.

*Hinweis: `config.yaml` hat ebenfalls ein `whitelist`-Array, das du auf die gleiche Weise verwenden kannst, aber dieses Array wird ignoriert, wenn `whitelist.txt` existiert.*

### 2. Die IP-Adresse für die ST-Hostmaschine erhalten

Nachdem die Whitelist eingerichtet wurde, benötigst du die IP des ST-hostenden Geräts.

Wenn sich das ST-hostende Gerät im selben WLAN-Netzwerk befindet, verwendest du die interne WLAN-IP des ST-Hosts:

* Für Windows: Windows-Taste > tippe `cmd.exe` in die Suchleiste > tippe `ipconfig` in die Konsole ein und drücke Enter > suche nach der Auflistung `IPv4`.

Wenn du (oder jemand anderes) auf dein gehostetes ST zugreifen möchtest, während du nicht im selben Netzwerk bist, benötigst du die öffentliche IP deines ST-hostenden Geräts.

* Während du das ST-hostende Gerät verwendest, greife auf [diese Seite](https://whatismyipaddress.com/) zu und suche nach `IPv4`. Dies ist die Adresse, die du verwenden würdest, um dich von dem entfernten Gerät zu verbinden.

### 3. Das entfernte Gerät mit der ST-Hostmaschine verbinden

Welche IP du auch immer für deine Situation erhalten hast, gib diese IP-Adresse und die Portnummer in den Webbrowser des entfernten Geräts ein.

Eine typische Adresse für einen ST-Host im selben WLAN-Netzwerk würde so aussehen:

`http://192.168.0.5:8000`

Verwende http:// NICHT https://

### Öffnen deines ST für alle IPs

Wir empfehlen dies nicht, aber du kannst `config.yaml` öffnen und `whitelistMode` auf `false` ändern.

Du musst `whitelist.txt` im SillyTavern-Basisinstallationsordner entfernen (oder umbenennen), falls es existiert.

Dies ist normalerweise eine unsichere Praxis, daher verlangen wir, dass du einen Benutzernamen und ein Passwort festlegst, wenn du dies tust.

Der Benutzername und das Passwort werden in `config.yaml` festgelegt.

Nach dem Neustart deines ST-Servers kann sich jedes Gerät mit ihm verbinden, unabhängig von ihrer IP, solange sie den Benutzernamen und das Passwort kennen.

### Immer noch nicht verbinden können?

* Erstelle eine eingehende/ausgehende Firewallregel für den Port, der in `config.yaml` gefunden wird. Verwechsle dies NICHT mit Portweiterleitung auf deinem Router, da sonst jemand deine Chatprotokolle finden könnte, und das ist ein großes No-Go.
* Aktiviere den Typ „Privates Netzwerkprofil“ in Einstellungen > Netzwerk und Internet > Ethernet. Dies ist SEHR wichtig für Windows 11, sonst könntest du dich auch mit den oben genannten Firewall-Regeln nicht verbinden.

## Leistungsprobleme?

Versuche, den No Blur Effect (Schnelle Benutzeroberfläche)-Modus im Benutzer-Einstellungsfeld zu aktivieren.

## Ich mag dein Projekt! Wie kann ich beitragen?

### DO's

1. Sende Pull-Requests
2. Sende Funktionsvorschläge und Fehlerberichte unter Verwendung der etablierten Vorlagen
3. Lies die README-Datei und die integrierte Dokumentation, bevor du irgendetwas fragst

### DONT's

1. Biete Geldspenden an
2. Sende Fehlerberichte, ohne Kontext zu bieten
3. Stelle Fragen, die bereits zahlreiche Male beantwortet wurden

## Wo kann ich die alten Hintergründe finden?

Wir wechseln zu einer 100% Originalinhalts-Policy, daher wurden alte Hintergrundbilder aus diesem Repository entfernt.

Du kannst sie hier archiviert finden:

<https://files.catbox.moe/1xevnc.zip>

## Lizenz und Credits

**Dieses Programm wird in der Hoffnung verteilt, dass es nützlich sein wird,  
aber OHNE IRGENDEINE GARANTIE; nicht einmal die stillschweigende Garantie der  
MARKTFÄHIGKEIT oder EIGNUNG FÜR EINEN BESTIMMTEN ZWECK. Siehe die  
GNU Affero General Public License für weitere Details.**

* TAI Base von Humi: MIT
* Cohee's Modifikationen und abgeleiteter Code: AGPL v3
* RossAscends' Ergänzungen: AGPL v3
* Teile von CncAnons TavernAITurbo-Mod: Unbekannte Lizenz
* kingbri's verschiedene Commits und Vorschläge (<https://github.com/bdashore3>)
* city_unit's Erweiterungen und verschiedene QoL-Features (<https://github.com/city-unit>)
* StefanDanielSchwarz's verschiedene Commits und Fehlerberichte (<https://github.com/StefanDanielSchwarz>)
* Waifu-Modus inspiriert von der Arbeit von PepperTaco (<https://github.com/peppertaco/Tavern/>)
* Danke an die Pygmalion University für das Testen und die Vorschläge für coole Features!
* Danke an oobabooga für die Zusammenstellung von Presets für TextGen
* KoboldAI-Presets von KAI Lite: <https://lite.koboldai.net/>
* Noto Sans-Schriftart von Google (OFL-Lizenz)
* Icon-Theme von Font Awesome <https://fontawesome.com> (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT-Lizenz)
* AI Horde-Clientbibliothek von ZeldaFan0225: <https://github.com/ZeldaFan0225/ai_horde>
* Linux-Startskript von AlpinDale
* Danke an paniphons für die Bereitstellung eines FAQ-Dokuments
* 10K Discord-Nutzer Feier-Hintergrund von @kallmeflocc
* Standardinhalte (Charaktere und Lore-Bücher) bereitgestellt von @OtisAlejandro, @RossAscends und @kallmeflocc
* Koreanische Übersetzung von @doloroushyeonse
* k_euler_a Unterstützung für Horde von <https://github.com/Teashrock>
* Chinesische Übersetzung von [@XXpE3](https://github.com/XXpE3), 中文 ISSUES 可以联系 @XXpE3
* Docker-Leitfaden von [@mrguymiah](https://github.com/mrguymiah) und [@Bronya-Rand](https://github.com/Bronya-Rand)

<!-- LINK GROUP -->
[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-151515?style=flat-square
[cover]: https://github.com/SillyTavern/SillyTavern/assets/18619528/c2be4c3f-aada-4f64-87a3-ae35a68b61a4
[discord-link]: https://discord.gg/sillytavern
[discord-shield]: https://img.shields.io/discord/1100685673633153084?color=5865F2&label=discord&labelColor=black&logo=discord&logoColor=white&style=flat-square
[discord-shield-badge]: https://img.shields.io/discord/1100685673633153084?color=5865F2&label=discord&labelColor=black&logo=discord&logoColor=white&style=for-the-badge
