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

const regexList = {
    yt_list1:
        /^(https?:\/\/)?(www.|music.|)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)&list=([a-zA-Z0-9_-]+)?(&ab_channel=[a-zA-Z0-9_-]+)?(&feature=share)?$/,
    yt_list2: /^(https?:\/\/)?(www.|music.|)?youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)?&?(feature=share)?$/,
    yt_video: /^(https?:\/\/)?(www.|music.|)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)?&?(ab_channel=[a-zA-Z0-9_-]+)?&?(feature=share)?$/,
};

export default async function GetTracks(query: string): Promise<Song | SongList | null> {
    try {
        if (regexList.yt_list1.test(query)) {
            return await GetPlayListInfo(query.match(regexList.yt_list1)![4]);
        } else if (regexList.yt_list2.test(query)) {
            return await GetPlayListInfo(query.match(regexList.yt_list2)![3]);
        } else if (regexList.yt_video.test(query)) {
            return await GetSongInfoById(query.match(regexList.yt_video)![3]);
        } else {
            return await GetSongInfoByName(query);
        }
    } catch (error) {
        console.error(error);
        return null;
    }
}
