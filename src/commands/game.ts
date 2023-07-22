import { Game } from './../types';
import { keys } from 'ts-transformer-keys';
import { CategoryChannel, ChannelType, Client, Guild, GuildChannel, PermissionFlagsBits } from "discord.js";
import { JsonDB } from "../db/JsonDB";

export function execute(parts: string[], config: JsonDB, db: JsonDB, client: Client, guild: Guild) {
    let game;
    switch (parts[1]) {
        case 'create':
            (async () => {
                const name = parts.slice(2).join(' ');

                const id = name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/ /g, '-');
                console.log('Creating game...');

                const category = await guild.channels.create({
                    name: name,
                    type: ChannelType.GuildCategory
                }) as CategoryChannel;

                const channels: { [key: string]: string } = {};
                const roles: { [key: string]: string } = {};

                let color: number;
                do {
                    color = Math.floor(Math.random() * 16777215);
                } while (guild.roles.cache.find((role) => role.color === color));
                roles['admin'] = (await guild.roles.create({
                    name: name + ' Admin',
                    color: color,
                })).id;
                roles['adminColor'] = color.toString(16);
                roles['player'] = (await guild.roles.create({
                    name: name,
                    color: color,
                })).id;
                roles['playerColor'] = color.toString(16);

                for (const channel of ['announcements', 'rules', 'bracket']) {
                    // admin can send messages, player can read messages
                    channels[channel] = (await guild.channels.create({
                        name: channel,
                        type: ChannelType.GuildText,
                        parent: category,
                        permissionOverwrites: [
                            {
                                id: guild.roles.everyone,
                                deny: PermissionFlagsBits.ViewChannel
                            },
                            {
                                id: roles['player'],
                                allow: PermissionFlagsBits.ViewChannel,
                                deny: PermissionFlagsBits.SendMessages
                            },
                            {
                                id: roles['admin'],
                                allow: PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages
                            }
                        ]
                    })).id;
                }

                for (const channel of ['results', 'questions', 'general', 'admin']) {
                    // player can send messages and read messages, admin can as well
                    channels[channel] = (await guild.channels.create({
                        name: channel,
                        type: ChannelType.GuildText,
                        parent: category,
                        permissionOverwrites: [
                            {
                                id: guild.roles.everyone,
                                deny: PermissionFlagsBits.ViewChannel
                            },
                            {
                                id: roles['player'],
                                allow: channel === 'admin' ? PermissionFlagsBits.EmbedLinks : PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages,
                                deny: channel === 'admin' ? PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages : PermissionFlagsBits.EmbedLinks
                            },
                            {
                                id: roles['admin'],
                                allow: PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages
                            }
                        ]
                    })).id;
                }

                for (const channel of ['voice1', 'voice2']) {
                    // player can connect, admin can as well, admin has priority
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
                                id: roles['player'],
                                allow: PermissionFlagsBits.Connect | PermissionFlagsBits.ViewChannel,
                                deny: PermissionFlagsBits.PrioritySpeaker
                            },
                            {
                                id: roles['admin'],
                                allow: PermissionFlagsBits.Connect | PermissionFlagsBits.ViewChannel | PermissionFlagsBits.PrioritySpeaker
                            }
                        ]
                    })).id;
                }


                db.push(`/games[]`, {
                    name: name,
                    id: id,
                    category: category.id,
                    channels: channels,
                    roles: roles
                } as Game);
            })();
            break;
        case 'delete':
            // require confirmation
            game = db.getData(`/games`).find((game: any) => game.id === parts[2] || game.name === parts[2]) as Game | undefined;
            if (game) {
                console.log('Deleting game...');
                const category = guild.channels.cache.get(game.category) as CategoryChannel;
                category.delete();

                let role: keyof Game['roles'];
                for (role in game.roles) {
                    if(role.endsWith('Color')) continue;
                    guild.roles.cache.get(game.roles[role])?.delete();
                }

                // delete all channels, in case they were not in the category
                for (const channel of ['rules', 'announcements', 'results', 'bracket', 'questions', 'general', 'admin', 'voice1', 'voice2'] as (keyof Game['channels'])[]) {
                    try {
                        guild.channels.cache.get(game.channels[channel])?.delete();
                    } catch (e) { 
                        // ignore
                    }
    
                }

                db.delete(`/games[${db.getData('/games').findIndex((game: any) => game.id === parts[2] || game.name === parts[2])}]`);

                console.log('Game deleted.');
            } else {
                console.log('Game not found.');
            }
            break;
        case 'list':
            db.getData('/games').forEach((game: any) => {
                console.log(`${game.name} (${game.id})`);
            });
            break;
        case 'details':
            game = db.getData(`/games`).find((game: any) => game.id === parts[2] || game.name === parts[2]) as Game | undefined;
            if (game) {
                console.log(`Name: ${game.name}`);
                console.log(`ID: ${game.id}`);
                console.log(`Category ID: ${game.category}`);
                console.log(`Channels:`);
                let channel: keyof Game['channels'];
                for (channel in game.channels) {
                    console.log(`\t${channel}: ${game.channels[channel]}`);
                }
                console.log(`Roles:`);
                let role: keyof Game['roles'];
                for (role in game.roles) {
                    console.log(`\t${role}: ${game.roles[role]} [${game.roles[(role + 'Color') as keyof Game['roles']]}]`);
                }
            } else {
                console.log('Game not found.');
            }
            break;
        case 'recreate':
            if(parts.length === 3) {
                recreate(parts[2], db, guild);
            } else {
                console.log('Recreating all games...');
                db.getData('/games').forEach((game: any) => {
                    recreate(game.id, db, guild);
                });
            }
            break;
        default:
            help();
            break;
    }
}

async function recreate(id: string, db: JsonDB, guild: Guild) {
    const game = db.getData(`/games`).find((game: any) => game.id === id || game.name === id) as Game | undefined;
    if (game) {
        console.log('Recreating game', game.name, '...');
        let category = guild.channels.cache.get(game.category) as CategoryChannel | undefined;
        if (!category) {
            category = await guild.channels.create({
                name: game.name,
                type: ChannelType.GuildCategory,
            }) as CategoryChannel;
            game.category = category.id;
        }

        let channel: keyof Game['channels'];
        for (channel in game.channels) {
            let channelObj = guild.channels.cache.get(game.channels[channel]) as GuildChannel | undefined;
            if (!channelObj) {
                channelObj = await guild.channels.create({
                    name: channel,
                    type: ChannelType.GuildText,
                    parent: category
                });
                game.channels[channel] = channelObj.id;
            } else {
                // channel exists, check if it's in the right category
                if (channelObj.parentId !== category.id) {
                    channelObj.setParent(category);
                }
            }
        }

    } else {
        console.log('Game', id, 'not found.');
    }
}

export function help() {
    console.log('Usage: game <create|delete|list|recreate|details> [name|id|all] [id]');
    console.log('all only applicable to delete and recreate');
    console.log('no additional arguments for list');
}