import { Colors, CommandInteraction, EmbedBuilder, Guild, GuildMember, SlashCommandBuilder } from 'discord.js';
import {
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    getVoiceConnection,
    joinVoiceChannel,
    VoiceConnection,
    VoiceConnectionStatus,
} from '@discordjs/voice';
import Command from '../interfaces/command';
import Song, { SongList } from '../interfaces/song';
import GetTracks from '../utilities/youtubeApi';
import ytdl, { downloadOptions } from 'ytdl-core';
import GuildConstructor from '../interfaces/guildConstructor';

var player = createAudioPlayer();
player.setMaxListeners(0);
export const guildConstructors = new Map<string, GuildConstructor>();
const ytdl_options: downloadOptions = {
    filter: 'audioonly',
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
};

function formatQueueSong(index: number, songTitle: string, songURL: string): string {
    const indexLength = index.toString().length;
    const padding = indexLength === 3 ? ' ' : indexLength === 2 ? '  ' : indexLength === 1 ? '   ' : '    ';
    return `**${index + 1}.)**${padding}[${songTitle}](${songURL})`;
}

const CheckPermissions = async (interaction: CommandInteraction): Promise<boolean> => {
    const permissions = interaction.appPermissions!;
    if (!permissions.has('Connect')) {
        await interaction.reply(`I dont have 'Connect' permission!`).then((message) => setTimeout(() => message.delete(), 5000));
        return false;
    }
    if (!permissions.has('Speak')) {
        await interaction.reply(`I dont have 'Speak' permission!`).then((message) => setTimeout(() => message.delete(), 5000));
        return false;
    }
    return true;
};

const CheckMemberStatus = async (interaction: CommandInteraction, guild: Guild, member: GuildMember): Promise<boolean> => {
    const client = guild.members.cache.get(interaction.client.user.id);
    if (!member.voice.channel || member.voice.channel == null) {
        await interaction
            .reply('You need to be in a voice channel to play music!')
            .then((message) => setTimeout(() => message.delete(), 10000));
        return false;
    }
    if (guild.afkChannelId && member.voice.channelId === guild.afkChannelId) {
        await interaction.reply('You are in afk channel!');
        return false;
    }
    if (client?.voice.channel != null && member.voice.channel.id != client.voice.channel.id) {
        await interaction
            .reply('You need to be in same voice channel with me to use this command!')
            .then((message) => setTimeout(() => message.delete(), 10000));
        return false;
    }
    return true;
};

async function SetGuildConnectionTimeout(guildId: string, callback: () => void, delay: number = 60000) {
    try {
        const timeout = setTimeout(callback, delay);
        guildConstructors.get(guildId)!.guildConnectionTimeouts = timeout;
    } catch (error) {
        console.error(error);
    }
}

async function ClearGuildConnectionTimeout(guildId: string) {
    try {
        const timeout = guildConstructors.get(guildId)!.guildConnectionTimeouts;
        if (timeout) {
            clearTimeout(timeout);
            guildConstructors.get(guildId)!.guildConnectionTimeouts = undefined;
        }
    } catch (error) {
        console.error(error);
    }
}

const OnEnd = async (guildId: string) => {
    try {
        const guildConstructor = guildConstructors.get(guildId)!;
        if (!guildConstructor.loop) guildConstructor.songs.splice(guildConstructor.lastSongIndex, 1);
        if (guildConstructor.songs && guildConstructor.songs.length > 0) {
            if (guildConstructor.shuffle) guildConstructor.lastSongIndex = Math.floor(Math.random() * guildConstructor.songs.length);
            else guildConstructor.lastSongIndex = 0;
            const track = guildConstructor.songs[guildConstructor.lastSongIndex];
            await PlayNext(track, guildId);
        } else {
            await ClearGuildConnectionTimeout(guildId);
            await SetGuildConnectionTimeout(guildId, () => {
                if (guildConstructor.connection!.state.status === VoiceConnectionStatus.Ready) {
                    guildConstructor.textChannel?.send('I am leaving because I have been afk for 1 minute.').then((msg) =>
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

const GetConnection = async (interaction: CommandInteraction, guild: Guild, member: GuildMember): Promise<VoiceConnection> => {
    var connection = getVoiceConnection(guild.id);
    if (!connection) {
        connection = joinVoiceChannel({
            channelId: member.voice!.channel!.id,
            adapterCreator: interaction.guild!.voiceAdapterCreator,
            guildId: interaction.guild!.id,
        });
        player = createAudioPlayer();
        player.setMaxListeners(0);
    }
    return connection;
};

const isSongList = async (tracks: Song | SongList): Promise<boolean> => {
    if ((tracks as SongList).Songs !== undefined) return true;
    else return false;
};

export const Play: Command = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play your favorite songs in a Voice Channel.')
        .addStringOption((option) => option.setName('query').setDescription('What are your wishes?').setRequired(true)),

    run: async (interaction: CommandInteraction) => {
        const guild = interaction.guild!;
        const member = guild.members.cache.get(interaction.user.id)!;
        if (!(await CheckPermissions(interaction))) return;
        if (!(await CheckMemberStatus(interaction, guild, member))) return;
        const connection = await GetConnection(interaction, guild, member);
        if (!guildConstructors.has(guild.id)) {
            guildConstructors.set(guild.id, {
                guildConnectionTimeouts: undefined,
                connection: connection,
                textChannel: interaction.channel!,
                loop: false,
                shuffle: false,
                lastSongIndex: 0,
                songs: [],
            });
        }
        await ClearGuildConnectionTimeout(guild.id);
        const guildConstructor = guildConstructors.get(guild.id)!;
        const query: string = interaction.options.get('query')!.value as string;
        const Tracks = await GetTracks(query);
        if (await isSongList(Tracks)) {
            const songList: SongList = Tracks as SongList;
            const tracks = songList.Songs;
            guildConstructor.songs = guildConstructor.songs.concat(tracks);
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'List added queue!' })
                .setColor(Colors.Purple)
                .setFields({ name: 'Artist', value: `[${songList.Author.Name}](${songList.Author.URL})`, inline: true })
                .setFooter({ text: 'Requested by ' + member.user.username, iconURL: member.user.avatarURL() as string })
                .setThumbnail(songList.IconURL)
                .setTitle(songList.Title)
                .setURL(songList.URL);
            await interaction.reply({ embeds: [embed] });
            if (player.state.status === AudioPlayerStatus.Idle) {
                PlayNext(tracks.at(0)!, guild.id);
                connection.subscribe(player);
            }
        } else {
            const song: Song = Tracks as Song;
            guildConstructor!.songs.push(song);
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
            const songsList = guildConstructor.songs?.map((song, index) => formatQueueSong(index, song.Title, song.URL)).join('\n');
            const embed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.username, iconURL: interaction.client.user.avatarURL() as string })
                .setTitle(guild.name + ' queues! ' + (guildConstructor.loop == true ? 'Loop Active' : ''))
                .setThumbnail(guild.iconURL() as string)
                .setDescription(songsList || 'Song List empty!')
                .setColor(Colors.Purple)
                .setFooter({ text: ('Requested by ' + member.user.username) as string, iconURL: member.user.avatarURL() as string });
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
        }
    },
};

export const CurrentlyPlaying: Command = {
    data: new SlashCommandBuilder().setName('currentlyplaying').setDescription('Show bot currently playing song.'),

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
                .setAuthor({ name: 'Now playing!' + (guildConstructor.loop == true ? 'Loop Active' : '') })
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
                embed.setTitle('Skipped! - Loop mode off');
            } else {
                embed.setTitle('Skipped!');
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
                .setAuthor({ name: guild.client.user.username, iconURL: guild.client.user.avatarURL() as string })
                .setColor(Colors.Purple)
                .setFields({ name: 'Now Playing!', value: `[${song.Title}](${song.URL})` })
                .setFooter({ text: 'Requested by ' + member.user.username, iconURL: member.user.avatarURL() as string })
                .setThumbnail(song.IconURL);
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
                    .setAuthor({ name: guild.name, iconURL: guild.iconURL() as string })
                    .setColor(Colors.Purple)
                    .setFooter({ text: 'Requested by ' + member.user.username, iconURL: member.user.avatarURL() as string })
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
            option.setName('param').setDescription('The song number which you want to skip to.').setRequired(true)
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
            const param = Number(interaction.options.get('param')!.value);
            if (isNaN(param)) {
                await interaction.reply('Param must be a number');
                return;
            }
            if (param > guildConstructor.songs.length) {
                await interaction.reply('Param can not be greater than the queue length');
                return;
            } else if (param < 1) {
                await interaction.reply('Param can not be less than 1. `If you want to skip only 1 song. You can try /skip command!`');
                return;
            }
            guildConstructor.songs.splice(0, param - 2);
            const embed = new EmbedBuilder();
            if (guildConstructor.loop) {
                guildConstructor.loop = false;
                embed.setTitle('Skipped! - Loop mode off');
            } else {
                embed.setTitle('Skipped!');
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
                .setAuthor({ name: guild.client.user.username, iconURL: guild.client.user.avatarURL() as string })
                .setColor(Colors.Purple)
                .setFields({ name: 'Now Playing!', value: `[${song.Title}](${song.URL})` })
                .setFooter({ text: 'Requested by ' + member.user.username, iconURL: member.user.avatarURL() as string })
                .setThumbnail(song.IconURL);
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
                    .setAuthor({ name: guild.name, iconURL: guild.iconURL() as string })
                    .setColor(Colors.Purple)
                    .setFooter({ text: 'Requested by ' + member.user.username, iconURL: member.user.avatarURL() as string })
                    .setDescription(`**Now, Shuffle mode is ${guildConstructor.shuffle ? 'on' : 'off'}**`);
                await interaction.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error(error);
        }
    },
};