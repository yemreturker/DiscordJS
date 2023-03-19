export default interface Song {
    VideoId: string;
    Title: string;
    Author: {
        Name: string;
        URL: string;
    };
    Duration: string | undefined;
    URL: string;
    IconURL: string;
}

export interface SongList {
    listId: string;
    Title: string;
    Author: {
        Name: string;
        URL: string;
    };
    URL: string;
    IconURL: string;
    Songs: Song[];
}
