# How to contribute to SillyTavern

## Setting up the dev environment

1. Required software: git and node.
2. Recommended editor: Visual Studio Code.
3. You can also use GitHub Codespaces which sets up everything for you.

## Getting the code ready

1. Register a GitHub account.
2. Fork this repository under your account.
3. Clone the fork onto your machine.
4. Open the cloned repository in the code editor.
5. Create a git branch (recommended), review the [git book](https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control) if you haven't.
6. Make your changes and test them locally.
7. Commit the changes and push the branch to the remote repo.
8. Go to GitHub, and open a pull request, targeting the appropriate upstream branch.

## Contribution guidelines

### Maintain code quality

Our standards are pretty low, but make sure the code is not too ugly:

- Run VS Code's autoformat when you're done.
- Check with ESLint by running `npm run lint`, then fix the errors.
- Use common sense and follow existing naming conventions.

### Use the correct target branch

Create pull requests for the `staging` branch, 99% of contributions should go there. That way people could test your code before the next stable release.

You can still send a pull request for `release` in the following scenarios:

- Updating README.
- Updating GitHub Actions.
- Hotfixing a critical bug.

Project maintainers will test and can change your code before merging. To keep our workflow smooth, please ensure the following:

- The "Allow edits from maintainers" option is checked.
- Avoid force-pushing your branch once the PR is out of draft state.

### Make contributions small and testable

To make sure that your contribution remains testable and reviewable, try not to exceed a soft limit of **200 lines of code** (both additions and deletions) per pull request. If you have more to contribute, split it into multiple pull requests.

We can also consider creating a separate feature branch for more substantial changes, but please discuss it with the maintainers first. For example:

- Leave the main larger PR as a draft so it can be used to discuss the implementation.
- Split each group of functions or features into a ~200 line PR so it can be properly reviewed and merged to staging or a feature branch.
- If there are large codependent changes that cannot be split, start with the most utilized dependencies and stub dependent functions.
- Each will be reviewed and tested one by one, merging into the feature branch as they're ready.
- Do not create all branches in advance, as subsequent changes made in previous commits as a result of test/review may create a lot of merge conflicts.

### Provide clear descriptions of your changes

Write at least somewhat meaningful PR descriptions and commit messages. There's no "right" way to do it, but the following may help with outlining a general structure:

- What is the reason for a change?
- What did you do to achieve this?
- How would a reviewer test the change?

### We (likely) don't speak your language

English is the primary language of communication in this project. Please use only English when writing commit messages, PR descriptions, comments and other text. This does not apply to contributions to localization files.

### Legal stuff

Mind the license. Your contributions will be licensed under the GNU Affero General Public License. If you don't know what that implies, consult your lawyer.

## Use of AI coding assistance tools ("Vibe Coding")

We do not prohibit nor encourage the use of AI tools for coding assistance to help you write code, documentation, etc. This includes specialized IDEs, plugins and add-ons, chat interfaces, etc. However, please keep in mind the following:

- No matter who (or what) wrote the code, you are responsible for it. Make sure to carefully review and test everything before committing, and be ready to discuss and fix any issues that may arise during the review.
- Maintainers can reject reviewing and accepting PRs of very low quality, i.e. if the time to fix the issues exceeds the time to write the code from scratch.
- Avoid common mistakes attributed to AI tools, such as: adding/removing unrelated comments, excessive logging, unawareness of the project context and conventions, etc.
- You are allowed, but not required, to trigger AI tools that are added to the project by maintainers (Gemini, Copilot, Codex). Keep in mind that any feedback (comments, suggestions) that these tools generate is not a call to action; make sure to properly assess it before applying.

## Further reading

1. [How to write UI extensions](https://docs.sillytavern.app/for-contributors/writing-extensions/)
2. [How to write server plugins](https://docs.sillytavern.app/for-contributors/server-plugins)
