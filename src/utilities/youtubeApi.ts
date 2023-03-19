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

export default async function GetTracks(query: string): Promise<Song | SongList> {
    const yt_list1 =
        /^(https?:\/\/)?(www|music\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}&?list=([a-zA-Z0-9_-]+)?&?(ab_channel=[a-zA-Z0-9_-]+)?&?(feature=share)?$/;
    const yt_list2 = /^(https?:\/\/)?(www|music\.)?youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)?&?(feature=share)?$/;
    const yt_video =
        /^(https?:\/\/)?(www|music\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)?&?(ab_channel=[a-zA-Z0-9_-]+)?&?(feature=share)?$/;
    if (yt_list1.test(query)) {
        return await GetPlayListInfo(query.match(yt_list1)![3]);
    } else if (yt_list2.test(query)) {
        return await GetPlayListInfo(query.match(yt_list2)![3]);
    } else if (yt_video.test(query)) {
        return await GetSongInfoById(query.match(yt_video)![3]);
    } else {
        return await GetSongInfoByName(query);
    }
}
