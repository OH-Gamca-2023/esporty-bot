import { ChannelType, Client, Guild, MessageReaction, PartialMessageReaction, PartialUser, TextChannel, User } from "discord.js";
import { JsonDB } from "../db/JsonDB";

let config: JsonDB;
let db: JsonDB;
let client: Client;

const reactionAddListener = async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    if (user.bot) return;
    let reactionRole;
    try {
        reactionRole = db.getData(`/reaction_roles/${reaction.message.id}/${reaction.emoji.identifier}`);
    } catch(err) {
        return;
    }
    if (reactionRole) {
        const member = await reaction.message.guild!.members.fetch(user.id);
        const role = await reaction.message.guild!.roles.fetch(reactionRole);
        if (role) {
            await member.roles.add(role);
            await member.send(`You have been given the role \`${role.name}\` in \`${reaction.message.guild!.name}\`.`);
            console.log(`Added role <@&${reactionRole}> [${role.name}] to <@${member.user.id}> [${member.user.tag}].`);
        } else {
            console.log(`Role ${reactionRole} not found.`);
        }
    }
}

const reactionRemoveListener = async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    let reactionRole;
    try {
        reactionRole = db.getData(`/reaction_roles/${reaction.message.id}/${reaction.emoji.identifier}`);
    } catch(err) {
        return;
    }
    if (reactionRole) {
        const member = await reaction.message.guild!.members.fetch(user.id);
        const role = await reaction.message.guild!.roles.fetch(reactionRole);
        if (role) {
            await member.roles.remove(role);
            await member.send(`You have been removed from the role \`${role.name}\` in \`${reaction.message.guild!.name}\`.`);
            console.log(`Removed role <@&${reactionRole}> [${role.name}] from <@${member.user.id}> [${member.user.tag}].`);
        } else {
            console.log(`Role ${reactionRole} not found.`);
        }
    }
}

export function load(configP: JsonDB, dbP: JsonDB, clientP: Client, guild: Guild) {
    config = configP;
    db = dbP;
    client = clientP;

    client.on('messageReactionAdd', reactionAddListener);
    client.on('messageReactionRemove', reactionRemoveListener);
}

export function unload() {
    client.off('messageReactionAdd', reactionAddListener);
    client.off('messageReactionRemove', reactionRemoveListener);
}

type Option = {
    name: string;
    roleId: string;
    emoji: string;
}

export async function create(title: string, channelId: string, options: Option[], db: JsonDB, client: Client, description?: string, color?: string) {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
        throw new Error('Channel not found');
    } else if (channel.type !== ChannelType.GuildText) {
        throw new Error('Channel is not a text channel');
    }
    color = color || '#000000';
    color = color.startsWith('#') ? color.slice(1) : color;
    const colorNum = parseInt(color, 16);

    const message = await (channel as TextChannel).send({
        embeds: [{
            title: title,
            description: description,
            color: colorNum,
            fields: options.map((option) => {
                return {
                    name: `${option.emoji} ${option.name}`,
                    value: `<@&${option.roleId}>`,
                    inline: true
                }
            }),
            footer: {
                text: 'React to this message to get the role.'
            }
        }]
    });

    const reactions = [] as {identifier: string, roleId: string}[];

    for (const option of options) {
        await message.react(option.emoji).then((reaction) => {
            reactions.push({
                identifier: reaction.emoji.identifier,
                roleId: option.roleId
            });
        }).catch((err) => {
            console.error(`Error reacting with ${option.emoji}: ${err}`);
        });
    }

    const rrObject = {
        title: title,
        description: description,
        color: color,
        channelId: channelId,
    }

    db.push(`/reaction_roles/${message.id}`, rrObject);

    for (const reaction of reactions) {
        db.push(`/reaction_roles/${message.id}/${reaction.identifier}`, reaction.roleId);
    }
}