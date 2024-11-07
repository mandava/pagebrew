const fs = require('fs-extra');

async function getConfig() {
    const configPath = `${process.cwd()}/pagebrew.config.json`;
    const defaultConfig = require(`${__dirname}/../src/pagebrew-base.config.json`);
    if (!fs.existsSync(configPath)) {
        await createConfig();
    }

    const config = await fs.readJson(configPath);
    return { ...defaultConfig, ...config };
}

async function createConfig() {
    const configPath = `${process.cwd()}/pagebrew.config.json`;
    if (!fs.existsSync(configPath)) {
        const config = require(`${__dirname}/../src/pagebrew.config.json`);
        let inputDir = process.cwd().split('/').pop();
        let inputDirName = inputDir.replace(/\/+$/, '').split('-');

        config.name = inputDirName.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        config.description = `Welcome to ${config.name}`;

        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    }
}


async function updateConfig(newConfig) {
    const configPath = `${process.cwd()}/pagebrew.config.json`;

    if (!fs.existsSync(configPath)) {
        console.error('Config file not found. Please run `pagebrew serve` to create one.');
        process.exit(1);
    }

    const existingConfig = await fs.readJson(configPath);
    const mergedConfig = { ...existingConfig, ...newConfig };
    await fs.writeJson(configPath, mergedConfig, { spaces: 2 });
}

module.exports = { createConfig, getConfig, updateConfig };
