import Song, { SongList } from '../interfaces/song';
import yts from 'yt-search';

async function GetSongInfoById(query: string): Promise<Song> {
    const results = await yts({ videoId: query });

    return {
        VideoId: results.videoId,
        Title: results.title,
        Author: {
            Name: results.author.name,
            URL: results.author.url,
        },
        Duration: results.duration.timestamp,
        URL: results.url,
        IconURL: results.thumbnail,
    };
}

async function GetSongInfoByName(query: string): Promise<Song> {
    const results = (await yts(query)).videos[0];

    return {
        VideoId: results.videoId,
        Title: results.title,
        Author: {
            Name: results.author.name,
            URL: results.author.url,
        },
        Duration: results.duration.timestamp,
        URL: results.url,
        IconURL: results.thumbnail,
    };
}

async function GetPlayListInfo(query: string): Promise<SongList> {
    const tracks = await yts({ listId: query });
    return {
        listId: tracks.listId,
        Title: tracks.title,
        Author: {
            Name: tracks.author.name,
            URL: tracks.author.url,
        },
        URL: tracks.url,
        IconURL: tracks.thumbnail,
        Songs: tracks.videos.map((track) => {
            return {
                VideoId: track.videoId,
                Title: track.title,
                Author: {
                    Name: track.author.name,
                    URL: track.author.url,
                },
                Duration: undefined,
                URL: 'https://music.youtube.com/watch?v=' + track.videoId,
                IconURL: track.thumbnail,
            };
        }),
    };
}

export const enum TrackURLs {
    yt_video = 'youtube.com/watch?v=',
    yt_playList = 'youtube.com/playlist?list=',
    s_track = 'spotify.com/track/',
    s_album = 'spotify.com/album/',
    s_playList = 'spotify.com/playlist/',
}

export default async function GetTracks(query: string): Promise<Song | SongList> {
    if (query.includes(TrackURLs.yt_video)) {
        const regex = /^(https?:\/\/)?(www\.)?(music\.)?youtube\.com\/watch\?v=([A-Za-z0-9_-]+)(&feature=share)?$/;
        const matches = query.match(regex)!;
        const videoId = matches[4];
        return await GetSongInfoById(videoId);
    } else if (query.includes(TrackURLs.yt_playList)) {
        const regex = /^(https?:\/\/)?(www\.)?(music\.)?youtube\.com\/playlist\?list=([A-Za-z0-9_-]+)(&feature=share)?$/;
        const matches = query.match(regex)!;
        const playListId = matches[4];
        return await GetPlayListInfo(playListId);
    } else {
        return await GetSongInfoByName(query);
    }
}
