import { ChannelType, Client, Guild, Message, User } from "discord.js";
import { JsonDB } from "../db/JsonDB";
import { ReactionRole, Option } from "../types";

let config: JsonDB;
let db: JsonDB;
let client: Client;

const messageListener = async (message: Message) => {
    const user = message.author;
    if (user.bot) return;
    
    try {
        if(db.exists('/class/listen')) {
            const listen = db.getData('/class/listen');
            if(listen === message.channel.id) {
                let content = message.content;
                content = content.toLowerCase().trim();
                content = content.replace(/[^a-z0-9]/g, '');

                let found = false;
                // iterate over all classes and check if any of them match
                for(const clazz of db.getData('/classes')) {
                    // check if class id (with - removed) matches or aliases
                    if(content === clazz.id.replace(/-/g, '') || clazz.aliases?.includes(content)) {
                        found = true;
                        // add role to user
                        const member = await message.guild!.members.fetch(user.id);
                        const role = await message.guild!.roles.fetch(clazz.role.id);
                        if(!role || !member) {
                            console.error(`Could not find role ${clazz.role.id} or member ${user.id}`);
                            user.send(`Sorry, something went wrong. Please contact an admin.`);
                            return;
                        }
                        await member.roles.add(role);
                        // send message
                        user.send(`You have been added to the class ${clazz.name}.`);
                        console.log(`Added ${user.username} to class ${clazz.name} (P \`${content}\` R \`${message.content}\`)`);
                    }
                }

                if (!found) {
                    user.send(`Sorry, I could not find a class with that name.`);
                    console.log(`Could not find class for ${user.username} (P \`${content}\` R \`${message.content}\`)`);
                }
                message.delete();
            }
        }
    } catch (e) { /* ignored */ }
}

export function load(configP: JsonDB, dbP: JsonDB, clientP: Client, guild: Guild) {
    config = configP;
    db = dbP;
    client = clientP;

    client.on('messageCreate', messageListener)
}

export function unload() {
    client.off('messageCreate', messageListener);
}