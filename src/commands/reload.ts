
import { Client, Guild } from "discord.js";
import { JsonDB } from "../db/JsonDB";

export function execute(parts: string[], config: JsonDB, db: JsonDB, client: Client, guild: Guild) {
    console.log('Reloading config...');
    config.reload();
    db.reload();
    console.log('Config reloaded.');
}

export function help() {
    console.log('Usage: reload');
}