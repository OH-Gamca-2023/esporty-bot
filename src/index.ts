import { Guild, TextChannel } from 'discord.js';
import { Client } from 'discord.js';
import { JsonDB, Config } from './db/JsonDB';
import * as dotenv from 'dotenv';
import * as fs from 'fs';


dotenv.config();

const config = new JsonDB(new Config('data/config', true, true, '/'));
const db = new JsonDB(new Config('data/data', true, true, '/'));

const client = new Client({ intents: 3276799 });
let guild: Guild;

client.on('ready', async () => {
    console.log(`Logged in as ${client.user!.tag}!`);

    guild = client.guilds.cache.get(await config.getData('/guild_id'))!;
    console.log(`Connected to guild ${guild.name}!`);
    console.log('Type "help" for a list of commands.');

    startConsole();

    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', handleInput);
    process.stdout.write('> ');
});

client.login(process.env.TOKEN);

let inputHistory: string[] = [];

function handleInput(text: string) {
    process.stdin.pause();
    text = text.trim();
    if (text === 'quit' || text === 'exit') {
        done();
    } else {
        handleCommand(text);
    }
    inputHistory.push(text);
    process.stdout.write('\n> ');
    process.stdin.resume();
}

async function done() {
    const consoleChannel = guild.channels.cache.get(config.getData('/channels/console')) as TextChannel;
    await consoleChannel.send('Console closed.');

    console.log('Exiting...');
    process.exit();
}

function handleCommand(text: string) {
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();

    if (command === 'help') {
        if (parts.length === 1) {
            console.log('Available commands:');
            console.log('help');
            fs.readdirSync('./src/commands').forEach((file) => {
                console.log(file.replace('.js', '').replace('.ts', ''));
            });
        } else {
            const command = parts[1];
            delete require.cache[require.resolve(`./commands/${command}.ts`)];
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const commandModule = require(`./commands/${command}.ts`);
            commandModule.help();
        }
    } else {
        if(fs.existsSync(`./src/commands/${command}.ts`)) {
            delete require.cache[require.resolve(`./commands/${command}.ts`)];
            // start command in new thread and only continue when it's done
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const commandModule = require(`./commands/${command}.ts`);
            try {
                commandModule.execute(parts, config, db, client, guild);
            } catch (e) {
                console.error("Error while executing command", command);
                console.error(e);
            }
        } else {
            console.log('Unknown command.');
        }
    }
}

async function startConsole() {
    const consoleChannel = guild.channels.cache.get(await config.getData('/channels/console')) as TextChannel;

    let buffer = '';
    process.stdin.on('data', (data) => {
        buffer += '> ' + data;
        if (!buffer.endsWith('\n')) {
            buffer += '\n';
        }
    });

    process.on('stdout', async (data) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        buffer += data;
    });
    process.on('stderr', async (data) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        buffer += data;
    });
    const originalConsoleLog = console.log;
    console.log = async (...args: any[]) => {
        originalConsoleLog(...args);
        await new Promise((resolve) => setTimeout(resolve, 100));
        buffer += args.join(' ') + '\n';
    };
    const originalConsoleError = console.error;
    console.error = async (...args: any[]) => {
        originalConsoleError(...args);
        await new Promise((resolve) => setTimeout(resolve, 100));
        buffer += args.join(' ') + '\n';
    };

    setInterval(async () => {
        if (buffer.length > 0) {
            await consoleChannel.send(buffer);
            buffer = '';
        }
    }, 3000);

    // on new message in console channel, send it to stdin
    const collector = consoleChannel.createMessageCollector();
    collector.on('collect', (message) => {
        if (message.author.id === client.user!.id) {
            return;
        }
        if (!config.getData('/admin_ids').includes(message.author.id)) {
            message.reply('You are not allowed to use the console.');
            return;
        }

        if (message.content === 'quit' || message.content === 'exit') {
            message.reply('Exit command from remote console is not allowed.\nUse local console to exit or stop the docker container.');
            return;
        }

        process.stdin.emit('data', message.content);
    });

    consoleChannel.send('Console attached.')
}

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});