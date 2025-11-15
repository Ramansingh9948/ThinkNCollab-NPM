import chalk from "chalk";

async function help() {
    console.log(chalk.red(" Command | Description "));
    console.log(chalk.green(" `tnc-cli login` | Authenticate with ThinkNCollab"));
    console.log(chalk.green("`tnc-cli logout` | Clear credentials "))
    console.log(chalk.green("`tnc-cli whoami` | Show current user info"))
    console.log(chalk.green("`tnc-cli push --room <id> <path>` | Push files/folders to a room"))
    console.log(chalk.green("`tnc-cli rooms list` | List all accessible rooms"))
    console.log(chalk.green("`tnc-cli rooms info <id>` | Show room details"))
    console.log(chalk.green("`tnc-cli --help` | Show help information "))
    console.log(chalk.green(" `tnc-cli --version` | Show CLI version"))
}
export default help;