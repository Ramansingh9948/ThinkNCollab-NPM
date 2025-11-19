                                        

module.exports = {
    description: 'Merge branches',
    builder(yargs) {
        return yargs
            .option('branch', {
                alias: 'b',
                type: 'string',
                description: 'The name of the branch to merge into the current branch',
                demandOption: true,
            });
    },
   handler(argv)
    {
        const { execSync } = require('child_process');
        const branch = argv.branch; 
        try {
            execSync(`git merge ${branch}`, { stdio: 'inherit' });  
            console.log(`Successfully merged branch '${branch}' into the current branch.`);
        } catch (error) {
            console.error(`Failed to merge branch '${branch}':`, error.message);
        }
    }
};
