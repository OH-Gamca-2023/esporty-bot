import { ChannelType, Client, Guild, MessageReaction, PartialMessageReaction, PartialUser, TextChannel, User } from "discord.js";
import { JsonDB } from "../db/JsonDB";
import { ReactionRole, Option } from "../types";

let config: JsonDB;
let db: JsonDB;
let client: Client;

const reactionAddListener = async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    if (user.bot) return;
    let reactionRole;
    try {
        reactionRole = db.getData(`/reaction_roles_by_message/${reaction.message.id}/${reaction.emoji.identifier}`);
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
        reactionRole = db.getData(`/reaction_roles_by_message/${reaction.message.id}/${reaction.emoji.identifier}`);
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

export async function create(id: string | undefined, title: string, channelId: string, options: Option[], description?: string, color?: string) {
    id = id || Math.random().toString(36).substring(2, 15); // Trusting randomness to not generate the same id twice, the chance of that is tiny
    if (await exists(id)) {
        throw new Error('Reaction role with that id already exists');
    }

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
                text: `${id} | React to this message to get a role`
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
        id: id,
        title: title,
        description: description,
        color: color,
        channelId: channelId,
        messageId: message.id,
        options: options,
    } as ReactionRole;

    db.push(`/reaction_roles/${id}`, rrObject);

    for (const reaction of reactions) {
        db.push(`/reaction_roles_by_message/${message.id}/${reaction.identifier}`, reaction.roleId);
    }
    db.push(`/reaction_roles_by_message/${message.id}/id`, id);
}

export async function remove(id: string) {
    let reactionRole;
    try {
        reactionRole = db.getData(`/reaction_roles/${id}`);
    } catch(err) {
        throw new Error('Reaction role not found');
    }

    try {
        const channel = await client.channels.fetch(reactionRole.channelId);
        if (!channel) {
            throw new Error('Channel not found');
        }

        const message = await (channel as TextChannel).messages.fetch(reactionRole.messageId);
        if (!message) {
            throw new Error('Message not found');
        }
        message.delete();
    } catch(err) {
        console.warn(`Error deleting message: ${err}`);
    }

    db.delete(`/reaction_roles/${id}`);
    db.delete(`/reaction_roles_by_message/${reactionRole.messageId}`);
}

export async function edit(id: string, title?: string, description?: string, color?: string, options?: Option[]) {
    let reactionRole: ReactionRole;
    try {
        reactionRole = db.getData(`/reaction_roles/${id}`);
    } catch(err) {
        throw new Error('Reaction role not found');
    }

    try {
        const channel = await client.channels.fetch(reactionRole.channelId);
        if (!channel) {
            throw new Error('Channel not found');
        }

        const message = await (channel as TextChannel).messages.fetch(reactionRole.messageId);
        if (!message) {
            throw new Error('Message not found');
        }

        const embed = message.embeds[0].toJSON();
        if (title) {
            embed.title = title;
        }
        if (description) {
            embed.description = description;
        }
        if (color) {
            color = color.startsWith('#') ? color.slice(1) : color;
            const colorNum = parseInt(color, 16);
            embed.color = colorNum;
        }
        if (options) {
            embed.fields = options.map((option) => {
                return {
                    name: `${option.emoji} ${option.name}`,
                    value: `<@&${option.roleId}>`,
                    inline: true
                }
            });
        }
        await message.edit({
            embeds: [embed]
        });

        if(options) {
            const oldOptions = reactionRole.options;

            for (const option of oldOptions) {
                if (!options.find((o) => o.emoji === option.emoji)) {
                    console.log(`Removing reaction ${option.emoji}`);
                    let re = message.reactions.cache.get(option.emoji);
                    if(!re) re = message.reactions.cache.get(option.emoji.slice(2, option.emoji.length - 1)); // removes <: and >
                    if(!re) re = message.reactions.cache.get(option.emoji.split(':')[option.emoji.split(':').length - 1].slice(0, -1)); // keeps only id of custom emoji
                    re?.remove();

                    db.delete(`/reaction_roles_by_message/${message.id}/${option.emoji}`);
                }
            }

            for (const option of options) {
                if (!oldOptions.find((o) => o.emoji === option.emoji)) {
                    console.log(`Adding reaction ${option.emoji}`);
                    const reaction = await message.react(option.emoji);

                    db.push(`/reaction_roles_by_message/${message.id}/${reaction.emoji.identifier}`, option.roleId);
                }
            }
        }

        db.push(`/reaction_roles/${id}`, {
            id: id,
            title: title || reactionRole.title,
            description: description || reactionRole.description,
            color: color || reactionRole.color,
            channelId: reactionRole.channelId,
            messageId: reactionRole.messageId,
            options: options || reactionRole.options,
        } as ReactionRole);
    } catch(err) {
        console.warn(`Error editing reaction role:`, err);
    }
}

export async function exists(id: string) {
    try {return db.exists(`/reaction_roles/${id}`);}
    catch (e) {return false;}
}