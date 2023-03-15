## RossAscends mods ported into SillyLossy's TavernAI 1.2.8


<img width="400" alt="image" src="https://user-images.githubusercontent.com/18619528/224549531-ab30db22-fe33-49c5-81a8-945c543a1e05.png">

## This branch includes: 
* Base TavernAI 1.2.8
* SillyLossy's extensive 1.2.8 modifications and functions
   * World Info
   * OobaBooga's TextGen WebUI API connection
   * Soft prompts
   * installing [SillyLossy's TAI-extras](https://github.com/SillyLossy/TavernAI-extras) will give support for
     * Character emotional expressions
     * Auto-Summary of the chat history
     * sending images to chat, and the AI interpreting the content.
   

...and...

## UI/CSS/Quality of Life tweaks by RossAscends

*Many of these were incorporated in SillyLossy's TAI branch already, but I updated them and split the Javascript into a separate file for this release.*

* Mobile-friendly page design
* HotKeys
  * Ctrl+Up = Connect to API 
  * Ctrl+Left = view locally stored variables (in the browser console window)
  * Ctrl+Right = clear locally stored variables.
  * Ctrl+enter = Regenerate last AI response.

* User Name Changes and Character Deletion no longer force the page to refresh.

* Toggle option to automatically connect to API on page load (currently only for Kobold)
* Toggle option to automatically load the most recently viewed character on page load
* Better Token Counter - works on unsaved characters, and shows both permanent and temporary tokens.

* Better Past Chats View
  * New Chat filenames are saved in a readable format of "(character) - (when it was created)"
  * Chat preview increased from 40 character to 300.

* Now, by default the settings panel will close when you click away from it.
* Clicking the Lock on the nav panel will hold the panel open, and this setting be remembered across sessions.
* Nav panel status of open or closed will also be saved across sessions.

* Supports saving a shortcut to iOS homescreens and opening in fullscreen mode from that bookmark.

## Installation

*NOTE: This branch is intended for local install purposes, and has not been tested on a colab or other cloud notebook service.*

  1. install [NodeJS](nodejs.org)
  2. download the zip from this github repo
  3. unzip it into a folder of your choice
  4. run start.bat via double clicking or in a command line.
  5. Once the server has prepared everything for you, it will open a tab in your browser.

## Remote connections

Most often this is for people who want use TAI on their mobile phones while at home.
If you want to enable other devices to connect to your TAI server, open 'config.conf' in a text editor, and change: 

```
const whitelistMode = true;
```
to 
```
const whitelistMode = false;
```
Save the file. 
Restart your TAI server. 

You will now be able to connect from other devices. 

***Disclaimer: Anyone else who knows your IP address and TAI port number will be able to as well***

To connect over wifi you'll need your PC's local wifi IP address 
  - (For Windows: windows button > type 'cmd.exe' in the search bar> type 'ipconfig' in the console, hit Enter > "IPv4" listing)
if you want other people on the internet to connect, and check [here](https://whatismyipaddress.com/) for 'IPv4'

## Questions or suggestions?
Contact me on Discord: RossAscends#1779

## License
* TAI Base: Unknown
* SillyLossy's TAI mod: Public domain
* RossAscends' additions: Public domain
