import { Play, Leave, Queue, NowPlaying, Skip, Repeat, SkipTo, Shuffle, RemoveAt, Back } from './commands/music';
import Command from './interfaces/command';

export const CommandList: Command[] = [Play, Leave, Queue, NowPlaying, Skip, Repeat, SkipTo, Shuffle, RemoveAt, Back];
