import { ActivityType, Guild } from 'discord.js';

export const OnGuildCreate = async (guild: Guild) => {
    guild.client.user.setActivity({
        type: ActivityType.Watching,
        name: `${guild.client.guilds.cache.size} guilds!`,
    });
};

export const OnGuildDelete = async (guild: Guild) => {
    guild.client.user.setActivity({
        type: ActivityType.Watching,
        name: `${guild.client.guilds.cache.size} guilds!`,
    });
};
