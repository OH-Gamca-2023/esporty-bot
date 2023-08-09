
import { CategoryChannel, ChannelType, Client, Guild, PermissionFlagsBits } from "discord.js";
import { JsonDB } from "../db/JsonDB";
import { Clazz } from "../types";
import { create } from "../events/reaction_roles";

export async function execute(parts: string[], config: JsonDB, db: JsonDB, client: Client, guild: Guild) {
    switch (parts[1]) {
        case 'add':
            await (async () => {
                const args = parts.slice(2).join(' ');
                const parsed = JSON.parse(args);
                
                await create(parsed.id, parsed.title, parsed.channelId, parsed.options, parsed.description || undefined, parsed.color || undefined);
            })();
            break;
        default:
            help();
            break;
    }
}

export function help() {
    console.log('Usage: rr <add>');
    console.log(' - Add a reaction role. Requires all arguments of `reaction_roles.create` be provided as single json object: rr add <json>'); 
}