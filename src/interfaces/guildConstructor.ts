import { VoiceConnection } from '@discordjs/voice';
import { GuildChannel, TextBasedChannel } from 'discord.js';
import Song from './song';

export default interface GuildConstructor {
    guildConnectionTimeouts: NodeJS.Timeout | undefined;
    connection: VoiceConnection | undefined;
    textChannel: TextBasedChannel | undefined;
    shuffle: boolean;
    lastSongIndex: number;
    loop: boolean;
    songs: Song[];
}
