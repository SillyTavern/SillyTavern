# EasierTavern

EasierTavern is a local, open-source interface for AI-assisted storytelling and character chat. It is a fork of [SillyTavern](https://github.com/SillyTavern/SillyTavern) that keeps the full SillyTavern runtime while adding a calmer, beginner-friendly interface for the tasks most people use every day.

The project does not include an AI model or a hosted AI service. You connect it to a supported cloud API or a locally hosted text-generation backend. Your chats, characters, personas, lorebooks, settings, and API secrets remain in your EasierTavern installation unless a configured provider requires data to be sent to its service.

## Why this fork exists

SillyTavern is exceptionally capable, but its power-user interface can be intimidating for newcomers. EasierTavern adds a focused story workspace on top of the same underlying data and application logic. The simplified and advanced interfaces are two views of one runtime, so you can move between them without reloading the page or maintaining separate data.

EasierTavern is an independent community fork. It is not an official SillyTavern release and is not maintained or endorsed by the SillyTavern team. Issues caused by EasierTavern changes should be reported in the [EasierTavern issue tracker](https://github.com/YusufErenGoc/EasierTavern/issues), not to the upstream project.

## Features

- A simplified, responsive story workspace enabled by default
- Chat creation and history, message editing, deletion, regeneration, continuation, swipes, attachments, and model switching
- Character creation, editing, import, export, avatars, advanced prompts, and lorebook associations
- Persona/profile management with prompt placement and lorebook controls
- Lorebook creation and editing, including global lorebooks, keywords, constant entries, and disabled entries
- Guided AI-provider setup using the same providers, secrets, models, presets, and connection logic as SillyTavern
- English and Turkish interface support, with automatic browser-language detection and a manual language selector
- One-click access to the complete SillyTavern power-user interface, extensions, and advanced settings
- Mobile navigation and a collapsible, wide desktop layout
- User-data backup download from the simplified settings page
- Automatic connection to the last configured server by default
- An optional Windows launcher that starts EasierTavern without leaving a console window open

All features inherited from SillyTavern remain available through **Settings → Advanced mode**. In advanced mode, use the EasierTavern button to return to the simplified interface.

## Requirements

- [Node.js](https://nodejs.org/) 20 or newer (the current LTS release is recommended)
- Git, if you want straightforward updates
- A modern web browser
- Access to a compatible AI provider or a locally running generation backend

You do not need a powerful GPU to run the interface itself. Hardware requirements for local inference depend on the model and backend you choose.

## Installation

### Windows

1. Install Node.js 20 or newer and [Git for Windows](https://git-scm.com/download/win).
2. Open PowerShell or Command Prompt and run:

   ```powershell
   git clone https://github.com/YusufErenGoc/EasierTavern.git
   cd EasierTavern
   ```

3. Run `Start.bat`. It installs the production dependencies and starts the server.
4. Open <http://127.0.0.1:8000> if the browser does not open automatically.

After the first successful start, you may use `Start-Silent.vbs` to start the server with no visible console window. Startup diagnostics are written to `data/easiertavern-silent.log`. Use `Start.bat` when troubleshooting.

### macOS and Linux

1. Install Node.js 20 or newer and Git.
2. Run:

   ```bash
   git clone https://github.com/YusufErenGoc/EasierTavern.git
   cd EasierTavern
   ./start.sh
   ```

3. Open <http://127.0.0.1:8000> if the browser does not open automatically.

If the script is not executable, run `chmod +x start.sh` once. You can also install and start manually with `npm install --no-save --omit=dev --ignore-scripts` followed by `npm start`.

### Docker

The included Compose file can build the fork from the checked-out source:

```bash
cd docker
docker compose up --build -d
```

Then open <http://127.0.0.1:8000>. Do not omit `--build`: the preconfigured registry image name points to upstream SillyTavern, while EasierTavern's interface changes are contained in this repository.

## What changed from upstream installation

The basic Node.js and Docker requirements are inherited from SillyTavern, but this fork changes the first-run experience:

- `/` starts in the EasierTavern simplified interface instead of the upstream interface.
- The original interface is still available through **Settings → Advanced mode** or by opening `/advanced.html`.
- The simplified first run skips the upstream onboarding dialog and starts with auto-connect enabled.
- Turkish is registered as a built-in language option.
- Windows users can use `Start-Silent.vbs` after the normal installation has been verified.
- Updates must come from this repository. Installing an upstream SillyTavern archive or pulling directly from its `release` branch will replace the fork-specific interface.

See [UPDATING.md](UPDATING.md) for safe update and upstream-sync instructions.

## Data and privacy

User data is stored under `data/` by default. Keep that directory out of version control and back it up before updates or migrations. Never commit `config.yaml`, secrets, logs, or user content.

The simplified and advanced interfaces share the same data. Switching modes does not copy or migrate chats. Requests sent to an external AI provider are governed by that provider's privacy policy.

## Project relationship and attribution

EasierTavern is derived from SillyTavern and preserves its GNU Affero General Public License. The upstream project and its contributors provide the application core, provider integrations, extension system, and most of the functionality in this repository. EasierTavern's fork-specific work focuses on the simplified interface, navigation, and launch experience.

- Upstream source: [SillyTavern/SillyTavern](https://github.com/SillyTavern/SillyTavern)
- Upstream documentation: [docs.sillytavern.app](https://docs.sillytavern.app/)
- Fork source and issues: [YusufErenGoc/EasierTavern](https://github.com/YusufErenGoc/EasierTavern)

When a problem also occurs in an unmodified SillyTavern installation, consult the upstream documentation and issue tracker. Please do not ask upstream maintainers to support fork-only behavior.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request. Report security problems privately according to [SECURITY.md](SECURITY.md).

## License

EasierTavern is licensed under the [GNU Affero General Public License v3.0](LICENSE), consistent with the upstream project. Source distributions and network deployments must comply with the license, including its source-availability requirements. Copyright remains with the respective upstream and fork contributors.
