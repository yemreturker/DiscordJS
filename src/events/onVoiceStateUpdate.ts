import { getVoiceConnection } from '@discordjs/voice';
import { VoiceState, Client } from 'discord.js';
import { guildConstructors } from '../commands/music';

export const OnVoiceStateUpdate = async (client: Client, oldState?: VoiceState, newState?: VoiceState) => {
    try {
        if (!oldState || !newState) return;
        if (oldState.channelId === null || typeof oldState.channelId == 'undefined') return;
        if (newState.id !== client.user?.id) return;
        guildConstructors.delete(newState.guild.id || oldState.guild.id);
        const connection = getVoiceConnection(newState.guild.id || oldState.guild.id);
        if (connection) connection.destroy();
    } catch (error) {
        console.error(error);
    }
};
