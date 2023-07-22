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
}

export interface Clazz {
    id: string;
    name: string;
    color: string;
}