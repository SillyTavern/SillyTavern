# Security Policy

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in a public issue, discussion, pull request, screenshot, or chat log.

Use GitHub's private vulnerability reporting flow for [YusufErenGoc/EasierTavern](https://github.com/YusufErenGoc/EasierTavern/security). Open the repository's **Security** tab, select **Advisories**, and choose **Report a vulnerability**. Include:

- the affected revision or version;
- whether the issue occurs in simplified mode, advanced mode, or both;
- clear reproduction steps and expected impact;
- a minimal proof of concept, if appropriate; and
- any known mitigations.

Remove real API keys, personal conversations, and unrelated user data from the report. If GitHub private reporting is unavailable, contact the repository owner privately through the contact method shown on their GitHub profile and provide only enough public information to establish a secure reporting channel.

## Fork and upstream scope

EasierTavern-specific vulnerabilities include problems in the simplified interface, its bridge to the SillyTavern runtime, Turkish localization behavior, and fork-provided launch scripts.

If the same vulnerability is present in an unmodified SillyTavern installation, also use the [SillyTavern security reporting process](https://github.com/SillyTavern/SillyTavern/security). Tell both maintainers that the report affects upstream and fork code so disclosure and remediation can be coordinated. Do not publish the vulnerability while either project is investigating it.

Security issues in AI providers, local inference backends, extensions, browsers, Node.js, or other dependencies should also be reported to the responsible project or vendor.

## Supported versions

This community fork does not promise long-term support for older revisions. Security fixes are applied to the current default branch when resources permit. Before reporting a problem, confirm it still exists in the latest revision without third-party extensions.

## Deployment guidance

EasierTavern is designed primarily for trusted, local use. Do not expose it directly to the public internet without understanding and configuring authentication, network access controls, TLS, reverse-proxy behavior, and the security implications of installed extensions. Keep Node.js and dependencies updated, protect the `data` directory, and never commit secrets or user content.
