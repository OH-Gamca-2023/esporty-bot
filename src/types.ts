export interface Game {
    name: string;
    id: string;
    
    channels: {
        rules: string;
        announcements: string;
        results: string;
        bracket: string;
        questions: string;
        general: string;
        admin: string;

        voice1: string;
        voice2: string;
    };

    category: string;

    roles: {
        admin: string;
        adminColor: string;
        player: string;
        playerColor: string;
    }

    emoji: string | null;
}

export interface Clazz {
    name: string;
    id: string;

    channels: {
        text: string;
        voice1: string;
        voice2: string;
    };

    category: string;

    role: {
        id: string;
        color: string;
    };
}

export type ReactionRole = {
    id: string;
    title: string;
    description: string;
    color: string;
    channelId: string;
    messageId: string;
    options: Option[];
}

export type Option = {
    name: string;
    roleId: string;
    emoji: string;
}