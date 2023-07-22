
import { ChannelType, Client, Guild } from "discord.js";
import { JsonDB } from "../db/JsonDB";

export function execute(parts: string[], config: JsonDB, db: JsonDB, client: Client, guild: Guild) {
    if (parts.length === 1) {
        help();
    } else {
        switch (parts[1]) {
            case 'all':
                console.log('Purging all...');
            case 'channels':
                console.log('Purging channels...');
                guild.channels.cache.forEach((channel) => {
                    if (channel.type === ChannelType.GuildCategory) {
                        if(!config.getData('/persistent/categories').includes(channel.id)) {
                            channel.delete();
                        }
                    } else if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice) {
                        if(!config.getData('/persistent/channels').includes(channel.id)) {
                            channel.delete();
                        }
                    }
                });
                console.log('Channels purged.');
                if (parts[1] === 'channels') break;
            case 'roles':
                console.log('Purging roles...');
                guild.roles.cache.forEach((role) => {
                    if(!config.getData('/persistent/roles').includes(role.id)) {
                        role.delete();
                    }
                });
                console.log('Roles purged.');
                break;
            default:
                help();
                break;
        }
    }
}

export function help() {
    console.log('Usage: purge <all|channels|roles>');
}