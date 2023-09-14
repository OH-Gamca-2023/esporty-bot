
import { CategoryChannel, ChannelType, Client, Guild, PermissionFlagsBits, TextChannel } from "discord.js";
import { JsonDB } from "../db/JsonDB";
import { Clazz } from "../types";

const autoClasses = [
    'Príma A', 'Príma B',
    'Sekunda A',
    'Tercia A',
    'Kvarta A', 'Kvarta B',
    'Kvinta A', 'Kvinta B',
    'Sexta A', 'Sexta B',
    'Septima B',
    'Oktáva',
    'I. A', 'I. B', 'I. C',
    'II. A', 'II. B', 'II. C',
    'III. B', 'III. C',
    'IV. A', 'IV. B', 'IV. C',
    'V. C'
] as string[];

export async function execute(parts: string[], config: JsonDB, db: JsonDB, client: Client, guild: Guild) {
    let clazz: Clazz;
    switch (parts[1]) {
        case 'create':
            await (async () => {
                const name = parts.slice(2).join(' ');

                const id = name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/ /g, '-');
                console.log(`Creating class ${name} (${id})...`);

                const category = await guild.channels.create({
                    name: name,
                    type: ChannelType.GuildCategory
                }) as CategoryChannel;

                const channels: { [key: string]: string } = {};
                const role: { id: string, color: string } = { id: '', color: '' };

                let color: number;
                do {
                    color = Math.floor(Math.random() * 16777215);
                } while (guild.roles.cache.find((role) => role.color === color));
                role.id = (await guild.roles.create({
                    name: name,
                    color: color,
                    mentionable: true
                })).id;
                role.color = color.toString(16);

                channels['text'] = (await guild.channels.create({
                    name: 'general',
                    type: ChannelType.GuildText,
                    parent: category,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone,
                            deny: PermissionFlagsBits.ViewChannel
                        },
                        {
                            id: role.id,
                            allow: PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages
                        },
                    ]
                })).id;

                for (const channel of ['voice1', 'voice2']) {
                    channels[channel] = (await guild.channels.create({
                        name: channel,
                        type: ChannelType.GuildVoice,
                        parent: category,
                        permissionOverwrites: [
                            {
                                id: guild.roles.everyone,
                                deny: PermissionFlagsBits.Connect | PermissionFlagsBits.ViewChannel
                            },
                            {
                                id: role.id,
                                allow: PermissionFlagsBits.Connect | PermissionFlagsBits.ViewChannel,
                            }
                        ]
                    })).id;
                }


                db.push(`/classes[]`, {
                    name: name,
                    id: id,
                    category: category.id,
                    channels: channels,
                    role: role
                } as Clazz);
            })();
            break;
        case 'delete':
            if (parts[2] === 'all') {
                console.log('Deleting all classes...');
                const classes = db.getData('/classes');
                console.log(`Will delete ${classes.length} classes...`);
                let promises: Promise<any>[] = [];
                for (const clazz of classes) {
                    promises.push(execute(['class', 'delete', clazz.id], config, db, client, guild));
                }
                await Promise.all(promises);
                console.log('All classes deleted.');
                break;
            }

            clazz = db.getData('/classes').find((clazz: Clazz) => clazz.name === parts.slice(2).join(' ') || clazz.id === parts.slice(2).join(' '));
            if (clazz) {
                console.log(`Deleting class ${clazz.name} (${clazz.id})...`);

                let promises: Promise<any>[] = [];
                
                promises.push(guild.channels.cache.get(clazz.category)?.delete() || Promise.resolve());

                promises.push(guild.roles.cache.get(clazz.role.id)?.delete() || Promise.resolve());

                for (const channel of Object.keys(clazz.channels) as (keyof Clazz['channels'])[]) {
                    promises.push(guild.channels.cache.get(clazz.channels[channel])?.delete().catch(() => {/* ignored */}) || Promise.resolve());
                }

                await Promise.all(promises);

                db.delete(`/classes[${db.getData('/classes').findIndex((clazz: Clazz) => clazz.name === parts.slice(2).join(' ') || clazz.id === parts.slice(2).join(' '))}]`);
                console.log(`Class ${parts.slice(2).join(' ')} deleted.`);
            } else {
                console.log(`Class ${parts.slice(2).join(' ')} not found!`);
            }

            break;
        case 'autocreate':
            console.log('Automatically creating all classes...');
            await execute(['class', 'delete', 'all'], config, db, client, guild);
            for (const clazz of autoClasses) {
                await execute(['class', 'create', ...clazz.split(' ')], config, db, client, guild);
            }
            break;
        case 'list':
            console.log('Classes:');
            for (const clazz of db.getData('/classes')) {
                console.log(` - ${clazz.name} (${clazz.id})`);
            }
            break;
        case 'listen':
            await (async () => {
                if(parts.length < 3) {
                    console.log('Usage: class listen <channel>');
                    return;
                }
                const rChannel = guild.channels.cache.get(parts[2]);
                if(!rChannel) {
                    console.log('Channel not found!');
                    return;
                }
                if(rChannel.type !== ChannelType.GuildText) {
                    console.log('Channel must be a text channel!');
                    return;
                }
                const channel = rChannel as TextChannel;

                console.log(`Setting up class selector in channel ${channel.name} (${channel.id})...`);

                await channel.bulkDelete(100);
                await channel.send({
                    embeds: [
                        {
                            title: 'Class selector',
                            description: 'Send a message containing the name of your class into this channel.' + 
                                         'The bot will attempt to give you the role of your class.\n' +
                                         '**If you try to join a class you are not in, you will be banned from the server!**',
                            color: 0x000000,
                            fields: [
                                {
                                    name: 'Available classes',
                                    value: db.getData('/classes').map((clazz: Clazz) => clazz.name).join(', ')
                                },
                                {
                                    name: 'Examples of valid messages',
                                    value: 'SeptimaA, septimaa, Septima A, III. A, 3.a, ...'
                                }
                            ]
                        }
                    ]
                });

                // make users with class roles unable to view the channel
                for(const clazz of db.getData('/classes')) {
                    const role = await guild.roles.fetch(clazz.role.id);
                    if(!role) {
                        console.error(`Could not find role ${clazz.role.id}`);
                        continue;
                    }
                    await channel.permissionOverwrites.create(role, {
                        ViewChannel: false
                    });
                    console.log(`Set permission override for role ${role.name} (${role.id})`);
                }

                db.push('/class/listen', channel.id);
                console.log(`Listening to channel ${channel.name} (${channel.id})`);
            })();
            break;
        default:
            help();
    }
}

export function help() {
    console.log('Usage: class <create|delete|autocreate|list>');
    console.log('- Create a new class: class create <name>');
    console.log('- Delete a class: class delete <name|id|all>');
    console.log('- Automatically create all classes: class autocreate');
    console.log('  ⚠️ This will remove all previously created classes!');
    console.log('- List all classes: class list');
}