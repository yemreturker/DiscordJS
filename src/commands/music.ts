import {
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    getVoiceConnection,
    joinVoiceChannel,
    VoiceConnectionStatus,
} from '@discordjs/voice';
import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, Colors } from 'discord.js';
import ytdl, { downloadOptions } from 'ytdl-core';
import Command from '../interfaces/command';
import GuildConstructor from '../interfaces/guildConstructor';
import Song, { SongList } from '../interfaces/song';
import GetTracks from '../utilities/youtubeApi';

var player = createAudioPlayer();
player.setMaxListeners(0);
export const guildConstructors = new Map<string, GuildConstructor>();
const ytdl_options: downloadOptions = {
    filter: 'audioonly',
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
};

const OnEnd = async (guildId: string) => {
    try {
        const guildConstructor = guildConstructors.get(guildId)!;
        if (!guildConstructor.loop) {
            guildConstructor.lastSong = guildConstructor.songs.at(guildConstructor.lastSongIndex) || null;
            guildConstructor.songs.splice(guildConstructor.lastSongIndex, 1);
        }
        if (guildConstructor.songs && guildConstructor.songs.length > 0) {
            if (guildConstructor.shuffle) guildConstructor.lastSongIndex = Math.floor(Math.random() * guildConstructor.songs.length);
            else guildConstructor.lastSongIndex = 0;
            const track = guildConstructor.songs[guildConstructor.lastSongIndex];
            await PlayNext(track, guildId);
        } else {
            await ClearGuildConnectionTimeout(guildId);
            await SetGuildConnectionTimeout(guildId, () => {
                if (guildConstructor.connection!.state.status === VoiceConnectionStatus.Ready) {
                    guildConstructor.textChannel?.send('I am leaving because I have been afk for 5 minute.').then((msg) =>
                        setTimeout(() => {
                            msg.delete();
                        }, 5000)
                    );
                    guildConstructor.connection!.destroy();
                }
            });
        }
    } catch (error) {
        console.error(error);
    }
};

const PlayNext = async (track: Song, guildId: string) => {
    try {
        const resource = createAudioResource(ytdl(track.URL, ytdl_options));
        player.play(resource);
        player.on(AudioPlayerStatus.Idle, () => OnEnd(guildId));
    } catch (error) {
        console.error(error);
    }
};

async function SetGuildConnectionTimeout(guildId: string, callback: () => void, delay: number = 1000 * 60 * 5) {
    try {
        guildConstructors.get(guildId)!.guildConnectionTimeouts = setTimeout(callback, delay);
    } catch (error) {
        console.error(error);
    }
}

async function ClearGuildConnectionTimeout(guildId: string) {
    try {
        if (guildConstructors.get(guildId)!.guildConnectionTimeouts) {
            clearTimeout(guildConstructors.get(guildId)!.guildConnectionTimeouts);
            guildConstructors.get(guildId)!.guildConnectionTimeouts = undefined;
        }
    } catch (error) {
        console.error(error);
    }
}

export const Play: Command = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play your favorite songs in a Voice Channel.')
        .addStringOption((option) => option.setName('query').setDescription('What are your wishes?').setRequired(true)),

    run: async (interaction: CommandInteraction) => {
        const guild = interaction.guild!;
        const client = guild.members.cache.get(interaction.client.user.id)!;
        const member = guild.members.cache.get(interaction.user.id)!;
        var connection = getVoiceConnection(guild.id);
        if (!connection) {
            if (!client.roles.cache.has('Connect')) {
                await interaction.reply(`I dont have 'Connect' permission!`).then((msg) => setTimeout(() => msg.delete, 5000));
                return;
            }
            if (!member.voice.channel || !member.voice.channel.id) {
                await interaction.reply(`You must be in any voice channel!`).then((msg) => setTimeout(() => msg.delete, 5000));
                return;
            }
            connection = joinVoiceChannel({
                channelId: member.voice.channel.id,
                adapterCreator: guild.voiceAdapterCreator,
                guildId: guild.id,
            });
            player = createAudioPlayer();
            player.setMaxListeners(0);
        }
        if (!guildConstructors.has(guild.id)) {
            guildConstructors.set(guild.id, {
                guildConnectionTimeouts: undefined,
                connection: connection,
                textChannel: interaction.channel!,
                loop: false,
                shuffle: false,
                lastSongIndex: 0,
                lastSong: null,
                songs: [],
            });
        }
        await ClearGuildConnectionTimeout(guild.id);
        const guildConstructor = guildConstructors.get(guild.id);
        if (!guildConstructor) {
            await interaction.reply('Something went wrong, Please try again!').then((msg) => setTimeout(() => msg.delete, 5000));
            return;
        }
        const query = interaction.options.get('query')?.value as string;
        const tracks = await GetTracks(query);
        if (!tracks || tracks === null) {
            await interaction.reply('Something went wrong, Please try again!').then((msg) => setTimeout(() => msg.delete, 5000));
            return;
        }
        const isSongList = (tracks as SongList).Songs !== undefined ? true : false;
        if (isSongList) {
            const songList = tracks as SongList;
            guildConstructor.songs.concat(songList.Songs);
            const embed = new EmbedBuilder()
                .setAuthor({ name: `${songList.Songs.length} songs added queue!` })
                .setColor(Colors.Purple)
                .setFields({ name: 'Artist', value: `[${songList.Author.Name}](${songList.Author.URL})` })
                .setFooter({ text: 'Requested by ' + member.user.username, iconURL: member.user.avatarURL() as string })
                .setThumbnail(songList.IconURL)
                .setTitle(songList.Title)
                .setURL(songList.URL);
            await interaction.reply({ embeds: [embed] });
            if (player.state.status === AudioPlayerStatus.Idle) {
                PlayNext(songList.Songs.at(0)!, guild.id);
                connection.subscribe(player);
            }
        } else {
            const song: Song = tracks as Song;
            guildConstructor.songs.push(song);
            if (player.state.status === AudioPlayerStatus.Idle) {
                PlayNext(song, guild.id);
                connection.subscribe(player);
                const embed = new EmbedBuilder()
                    .setAuthor({ name: 'Now playing!' })
                    .setColor(Colors.Purple)
                    .setFields(
                        { name: 'Artist', value: `[${song.Author.Name}](${song.Author.URL})`, inline: true },
                        { name: 'Duration', value: song.Duration || '-', inline: true }
                    )
                    .setFooter({ text: 'Requested by ' + member.user.username, iconURL: member.user.avatarURL() as string })
                    .setThumbnail(song.IconURL)
                    .setTitle(song.Title)
                    .setURL(song.URL);
                await interaction.reply({ embeds: [embed] });
            } else {
                const embed = new EmbedBuilder()
                    .setAuthor({ name: 'Added queue!' })
                    .setColor(Colors.Purple)
                    .setFields(
                        { name: 'Artist', value: `[${song.Author.Name}](${song.Author.URL})`, inline: true },
                        { name: 'Duration', value: song.Duration || '-', inline: true }
                    )
                    .setFooter({ text: 'Requested by ' + member.user.username, iconURL: member.user.avatarURL() as string })
                    .setThumbnail(song.IconURL)
                    .setTitle(song.Title)
                    .setURL(song.URL);
                await interaction.reply({ embeds: [embed] });
            }
        }
    },
};

export const Leave: Command = {
    data: new SlashCommandBuilder().setName('leave').setDescription('Bot leaves the voice channel it is on.'),

    run: async (interaction: CommandInteraction) => {
        try {
            const guild = interaction.guild!;
            const guildConstructor = guildConstructors.get(guild.id);
            if (!guildConstructor || !guildConstructor.connection) {
                await interaction.reply('I am not in any voice channel').then((msg) => setTimeout(() => msg.delete(), 5000));
                return;
            }
            if (!guildConstructor.connection) {
                interaction.reply('I am not on any voice channel!').then((msg) => setTimeout(() => msg.delete(), 5000));
                return;
            }
            guildConstructor.connection.destroy();
            guildConstructors.delete(interaction.guild!.id);
            await interaction.reply('👋 Bye!').then((msg) => setTimeout(() => msg.delete(), 5000));
        } catch (error) {
            console.error(error);
        }
    },
};

export const Queue: Command = {
    data: new SlashCommandBuilder().setName('queue').setDescription('Show bot song list.'),

    run: async (interaction: CommandInteraction) => {
        try {
            const guild = interaction.guild!;
            const member = guild.members.cache.get(interaction.user.id)!;
            const guildConstructor = guildConstructors.get(guild.id);
            if (!guildConstructor || !guildConstructor.connection) {
                await interaction.reply('I am not in any voice channel').then((msg) => setTimeout(() => msg.delete(), 5000));
                return;
            }
            function formatQueueSong(index: number, songTitle: string, songURL: string): string {
                const indexLength = index.toString().length;
                const padding = indexLength === 3 ? ' ' : indexLength === 2 ? '  ' : indexLength === 1 ? '   ' : '    ';
                return `**${index + 1}.)**${padding}[${songTitle}](${songURL})`;
            }
            const songsList = guildConstructor.songs?.map((song, index) => formatQueueSong(index, song.Title, song.URL)).join('\n');
            const embed = new EmbedBuilder()
                .setColor(Colors.Purple)
                .setAuthor({ name: guild.name, iconURL: guild.iconURL() as string })
                .setFooter({ text: `Requested by ${member.displayName}`, iconURL: member.displayAvatarURL() as string })
                .setTitle(guild.name + ' queues! ' + (guildConstructor.loop == true ? 'Loop Active' : ''))
                .setThumbnail(guild.client.user.displayAvatarURL() as string)
                .setDescription(songsList || 'Song List empty!');
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
        }
    },
};

export const NowPlaying: Command = {
    data: new SlashCommandBuilder().setName('now-playing').setDescription('Show bot currently playing song.'),

    run: async (interaction: CommandInteraction) => {
        try {
            const guild = interaction.guild!;
            const member = guild.members.cache.get(interaction.user.id)!;
            const guildConstructor = guildConstructors.get(guild.id);
            if (!guildConstructor || !guildConstructor.connection) {
                await interaction.reply('I am not in any voice channel').then((msg) => setTimeout(() => msg.delete(), 5000));
                return;
            }
            const song = guildConstructor.songs.at(guildConstructor.lastSongIndex);
            if (!song) {
                await interaction.reply('Currently I am not playing any song!').then((msg) => setTimeout(() => msg.delete(), 5000));
                return;
            }
            const embed = new EmbedBuilder()
                .setColor(Colors.Purple)
                .setAuthor({ name: 'Now playing!' })
                .setFooter({ text: `Requested by ${member.displayName}`, iconURL: member.displayAvatarURL() as string })
                .setTitle(song.Title)
                .setURL(song.URL)
                .setThumbnail(song.IconURL)
                .setFields(
                    { name: 'Artist', value: `[${song.Author.Name}](${song.Author.URL})`, inline: true },
                    { name: 'Duration', value: song.Duration || '-', inline: true }
                );
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
        }
    },
};

export const Skip: Command = {
    data: new SlashCommandBuilder().setName('skip').setDescription('Skip currently playing song!'),

    run: async (interaction: CommandInteraction) => {
        try {
            const guild = interaction.guild!;
            const member = guild.members.cache.get(interaction.user.id)!;
            const guildConstructor = guildConstructors.get(guild.id);
            if (!guildConstructor || !guildConstructor.connection) {
                await interaction.reply('I am not in any voice channel').then((msg) => setTimeout(() => msg.delete(), 5000));
                return;
            }
            const embed = new EmbedBuilder();
            if (guildConstructor.loop) {
                guildConstructor.loop = false;
                embed.setTitle('Skipped, Now playing! - Loop mode off');
            } else {
                embed.setTitle('Skipped, Now playing!');
            }
            await OnEnd(guild.id);
            const song = guildConstructor.songs.at(guildConstructor.lastSongIndex);
            if (!song) {
                interaction.reply('There is no song in queue!').then((msg) => setTimeout(() => msg.delete(), 5000));
                if (player.state.status === AudioPlayerStatus.Playing) {
                    player.stop();
                }
                return;
            }
            embed
                .setColor(Colors.Purple)
                .setAuthor({ name: 'Skipped, Now playing!' })
                .setFooter({ text: `Requested by ${member.displayName}`, iconURL: member.displayAvatarURL() as string })
                .setTitle(song.Title)
                .setURL(song.URL)
                .setThumbnail(song.IconURL)
                .setFields(
                    { name: 'Artist', value: `[${song.Author.Name}](${song.Author.URL})`, inline: true },
                    { name: 'Duration', value: song.Duration || '-', inline: true }
                );
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
        }
    },
};

export const Repeat: Command = {
    data: new SlashCommandBuilder().setName('repeat').setDescription('Loop the currently playing song.'),

    run: async (interaction: CommandInteraction) => {
        try {
            const guild = interaction.guild!;
            const member = guild.members.cache.get(interaction.user.id)!;
            const guildConstructor = guildConstructors.get(guild.id);
            if (!guildConstructor || !guildConstructor.connection) {
                await interaction.reply('I am not in any voice channel').then((msg) => setTimeout(() => msg.delete(), 5000));
                return;
            }
            const song = guildConstructor.songs.at(0);
            if (!song) {
                await interaction.reply('Currently I am not playing any song!').then((msg) => setTimeout(() => msg.delete(), 5000));
            } else {
                guildConstructor.loop = !guildConstructor.loop;
                const embed = new EmbedBuilder()
                    .setColor(Colors.Purple)
                    .setAuthor({ name: guild.name, iconURL: guild.iconURL() as string })
                    .setFooter({ text: `Requested by ${member.displayName}`, iconURL: member.displayAvatarURL() as string })
                    .setDescription(`**Now, Loop mode is ${guildConstructor.loop ? 'on' : 'off'}**`);
                await interaction.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error(error);
        }
    },
};

export const SkipTo: Command = {
    data: new SlashCommandBuilder()
        .setName('skipto')
        .setDescription('Skip songs to which you want to get song.')
        .addStringOption((option) =>
            option.setName('index').setDescription('The song number which you want to skip to.').setRequired(true)
        ),

    run: async (interaction: CommandInteraction) => {
        try {
            const guild = interaction.guild!;
            const member = guild.members.cache.get(interaction.user.id)!;
            const guildConstructor = guildConstructors.get(guild.id);
            if (!guildConstructor || !guildConstructor.connection) {
                await interaction.reply('I am not in any voice channel').then((msg) => setTimeout(() => msg.delete(), 5000));
                return;
            }
            const index = Number(interaction.options.get('index')!.value);
            if (isNaN(index)) {
                await interaction.reply('Index must be a number!');
                return;
            }
            if (index > guildConstructor.songs.length) {
                await interaction.reply('Index can not be greater than the queue length!');
                return;
            } else if (index < 1) {
                await interaction.reply('Index can not be less than 1. `If you want to skip only 1 song. You can try /skip command!`');
                return;
            }
            guildConstructor.songs.splice(0, index - 2);
            const embed = new EmbedBuilder();
            if (guildConstructor.loop) {
                guildConstructor.loop = false;
                embed.setTitle('Skipped, Now playing! - Loop mode off');
            } else {
                embed.setTitle('Skipped, Now playing!');
            }
            await OnEnd(guild.id);
            const song = guildConstructor.songs.at(0);
            if (!song) {
                interaction.reply('There is no song in queue!').then((msg) => setTimeout(() => msg.delete(), 5000));
                if (player.state.status === AudioPlayerStatus.Playing) {
                    player.stop();
                }
                return;
            }
            embed
                .setColor(Colors.Purple)
                .setAuthor({ name: 'Skipped, Now playing!' })
                .setFooter({ text: `Requested by ${member.displayName}`, iconURL: member.displayAvatarURL() as string })
                .setTitle(song.Title)
                .setURL(song.URL)
                .setThumbnail(song.IconURL)
                .setFields(
                    { name: 'Artist', value: `[${song.Author.Name}](${song.Author.URL})`, inline: true },
                    { name: 'Duration', value: song.Duration || '-', inline: true }
                );
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
        }
    },
};

export const Shuffle: Command = {
    data: new SlashCommandBuilder().setName('shuffle').setDescription('Play the songs in the queue randomly.'),

    run: async (interaction: CommandInteraction) => {
        try {
            const guild = interaction.guild!;
            const member = guild.members.cache.get(interaction.user.id)!;
            const guildConstructor = guildConstructors.get(guild.id);
            if (!guildConstructor || !guildConstructor.connection) {
                await interaction.reply('I am not in any voice channel').then((msg) => setTimeout(() => msg.delete(), 5000));
                return;
            }
            if (guildConstructor.loop) guildConstructor.loop = false;
            if (!guildConstructor.songs || guildConstructor.songs.length <= 0) {
                await interaction.reply('There is no song in queue!').then((msg) => setTimeout(() => msg.delete(), 5000));
            } else {
                guildConstructor.shuffle = !guildConstructor.shuffle;
                const embed = new EmbedBuilder()
                    .setColor(Colors.Purple)
                    .setAuthor({ name: guild.name, iconURL: guild.iconURL() as string })
                    .setFooter({ text: `Requested by ${member.displayName}`, iconURL: member.displayAvatarURL() as string })
                    .setDescription(`**Now, Shuffle mode is ${guildConstructor.shuffle ? 'on' : 'off'}**`);
                await interaction.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error(error);
        }
    },
};

export const RemoveAt: Command = {
    data: new SlashCommandBuilder()
        .setName('remove-at')
        .setDescription('Remove song which you want to remove song from queue.')
        .addStringOption((option) =>
            option.setName('index').setDescription('The song number which you want to remove to queue.').setRequired(true)
        ),

    run: async (interaction: CommandInteraction) => {
        try {
            const guild = interaction.guild!;
            const member = guild.members.cache.get(interaction.user.id)!;
            const guildConstructor = guildConstructors.get(guild.id);
            if (!guildConstructor || !guildConstructor.connection) {
                await interaction.reply('I am not in any voice channel').then((msg) => setTimeout(() => msg.delete(), 5000));
                return;
            }
            if (!guildConstructor.songs || guildConstructor.songs.length <= 0) {
                await interaction.reply('There is no song in queue!').then((msg) => setTimeout(() => msg.delete(), 5000));
            } else {
                const index = Number(interaction.options.get('index')!.value);
                if (isNaN(index)) {
                    await interaction.reply('Index must be a number!');
                    return;
                }
                if (index > guildConstructor.songs.length) {
                    await interaction.reply('Index can not be greater than the queue length!');
                    return;
                } else if (index < 1) {
                    await interaction.reply('Index can not be less than 1!');
                    return;
                }
                const song = guildConstructor.songs.at(index - 1)!;
                guildConstructor.songs.splice(index - 1, 1);
                function formatQueueSong(index: number, songTitle: string, songURL: string): string {
                    const indexLength = index.toString().length;
                    const padding = indexLength === 3 ? ' ' : indexLength === 2 ? '  ' : indexLength === 1 ? '   ' : '    ';
                    return `**${index + 1}.)**${padding}[${songTitle}](${songURL})`;
                }
                const embed = new EmbedBuilder()
                    .setColor(Colors.Purple)
                    .setAuthor({ name: guild.name, iconURL: guild.iconURL() as string })
                    .setFooter({ text: `Requested by ${member.displayName}`, iconURL: member.displayAvatarURL() as string })
                    .addFields({ name: 'Removed from Queue!', value: formatQueueSong(index, song.Title, song.URL) })
                    .setThumbnail(song.IconURL);
                await interaction.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error(error);
        }
    },
};

export const Back: Command = {
    data: new SlashCommandBuilder().setName('back').setDescription('Back to previous song and play it!'),

    run: async (interaction: CommandInteraction) => {
        try {
            const guild = interaction.guild!;
            const member = guild.members.cache.get(interaction.user.id)!;
            const guildConstructor = guildConstructors.get(guild.id);
            if (!guildConstructor || !guildConstructor.connection) {
                await interaction.reply('I am not in any voice channel').then((msg) => setTimeout(() => msg.delete(), 5000));
                return;
            }
            const song = guildConstructor.lastSong;
            if (song != null) {
                PlayNext(song, guild.id);
                const embed = new EmbedBuilder()
                    .setColor(Colors.Purple)
                    .setAuthor({ name: 'Now playing!' })
                    .setFooter({ text: `Requested by ${member.displayName}`, iconURL: member.displayAvatarURL() as string })
                    .setTitle(song.Title)
                    .setURL(song.URL)
                    .setThumbnail(song.IconURL)
                    .setFields(
                        { name: 'Artist', value: `[${song.Author.Name}](${song.Author.URL})`, inline: true },
                        { name: 'Duration', value: song.Duration || '-', inline: true }
                    );
                await interaction.reply({ embeds: [embed] });
            } else {
                await interaction.reply('No song played before!').then((msg) => setTimeout(() => msg.delete(), 5000));
            }
        } catch (error) {
            console.error(error);
        }
    },
};
