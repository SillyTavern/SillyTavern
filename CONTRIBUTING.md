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
5. Create a git branch (recommended).
6. Make your changes and test them locally.
7. Commit the changes and push the branch to the remote repo.
8. Go to GitHub, and open a pull request, targeting the upstream branch.

## Contribution guidelines

1. Our standards are pretty low, but make sure the code is not too ugly:
  - Run VS Code's autoformat when you're done.
  - Check with ESLint by running `npm run lint`, then fix the errors.
  - Use common sense and follow existing naming conventions.
2. Create pull requests for the staging branch, 99% of contributions should go there. That way people could test your code before the next stable release.
3. You can still send a pull request for release in the following scenarios:
  - Updating README.
  - Updating GitHub Actions.
  - Hotfixing a critical bug.
4. Project maintainers will test and can change your code before merging.
5. Write at least somewhat meaningful PR descriptions. There's no "right" way to do it, but the following may help with outlining a general structure:
  - What is the reason for a change?
  - What did you do to achieve this?
  - How would a reviewer test the change?
6. Mind the license. Your contributions will be licensed under the GNU Affero General Public License. If you don't know what that implies, consult your lawyer.
