
import { Client, Guild } from "discord.js";
import { JsonDB } from "../db/JsonDB";
import { loadEvents, loadedEvents, unloadEvent } from "../index";

export function execute(parts: string[], config: JsonDB, db: JsonDB, client: Client, guild: Guild) {
    console.log('Reloading config...');
    config.reload();
    db.reload();
    console.log('Config reloaded.');

    console.log('Reloading events...');
    loadedEvents.forEach((eventModule, name) => unloadEvent(name));
    console.log('Old events unloaded.');
    loadEvents();
    console.log('Events reloaded.');
}

export function help() {
    console.log('Usage: reload');
}