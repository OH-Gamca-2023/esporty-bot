import { Game } from './../types';
import { CategoryChannel, ChannelType, Client, Guild, GuildChannel, PermissionFlagsBits } from "discord.js";
import { JsonDB } from "../db/JsonDB";
import { create } from '../events/reaction_roles';

export async function execute(parts: string[], config: JsonDB, db: JsonDB, client: Client, guild: Guild) {
    let game;
    switch (parts[1]) {
        case 'create':
        case 'add':
            const name = parts.slice(2).slice(0, -1).join(' ');

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
                            // EmbedLinks is used as a placeholder permission
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
                channels: channels as Game['channels'],
                roles: roles as Game['roles'],
                emoji: parts.slice(-1)[0]
            } as Game);
            break;
        case 'delete':
        case 'remove':
            // require confirmation
            game = db.getData(`/games`).find((game: any) => game.id === parts[2] || game.name === parts[2]) as Game | undefined;
            if (!game) {
                console.log(`Game ${parts[2]} not found.`);
                return;
            }
            console.log(`Deleting game ${game.name} (${game.id})...`)
            let promises: Promise<any>[] = [];
            promises.push(guild.channels.cache.get(game.category)?.delete() || Promise.resolve());

            let role: keyof Game['roles'];
            for (role in game.roles) {
                if(role.endsWith('Color')) continue;
                promises.push(guild.roles.cache.get(game.roles[role])?.delete() || Promise.resolve());
            }

            // delete all channels, in case they were not in the category
            for (const channel of Object.keys(game.channels) as (keyof Game['channels'])[]) {
                promises.push(guild.channels.cache.get(game.channels[channel])?.delete().catch(() => {/* ignored */}) || Promise.resolve());
            }

            db.delete(`/games[${db.getData('/games').findIndex((game: any) => game.id === parts[2] || game.name === parts[2])}]`);

            await Promise.all(promises);

            console.log('Game deleted.');
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
        case 'rr':
            console.log('Creating reaction roles...');
            try {
                const games = db.getData('/games');
                await create("Game selector", parts[2], games.map((game: any) => {
                    return {
                        name: game.name,
                        roleId: game.roles.player,
                        emoji: game.emoji
                    }
                }), db, client, 'React to this message to get the role for the game you want to compete in.');
            } catch (e) {
                console.error(e);
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
    console.log('Usage: game <create|delete|list|recreate|details|rr>');
    console.log(' - Create a game: game create <name> <emoji>');
    console.log(' - Delete a game: game delete <name|id|all>');
    console.log(' - List all games: game list');
    console.log(' - Recreate a game: game recreate <name|id|all>');
    console.log(' - Get details about a game: game details <name|id>');
    console.log(' - Create reaction roles for a games: game rr <channelId>');
}