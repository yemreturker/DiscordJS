import { Play, Leave, Queue, CurrentlyPlaying, Skip, Repeat, SkipTo, Shuffle } from './commands/music';
import Command from './interfaces/command';

export const CommandList: Command[] = [Play, Leave, Queue, CurrentlyPlaying, Skip, Repeat, SkipTo, Shuffle];
