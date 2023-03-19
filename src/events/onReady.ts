import { ActivityType, Client, REST, Routes } from 'discord.js';
import { CommandList } from '../_commandList';

export const OnReady = async (client: Client) => {
    client.user!.setActivity({
        type: ActivityType.Watching,
        name: `${client.guilds.cache.size} guilds!`,
    });
    await ImportCommands(client);
    console.log(`\n[>] ${client.user?.username} is ready!\n`);
};

export const ImportCommands = async (client: Client) => {
    try {
        const Token = process.env.BOT_TOKEN as string;
        const rest = new REST({ version: '10' }).setToken(Token);
        console.log(`[>] Started refreshing ${CommandList.length} application (/) commands.`);
        const commandData = CommandList.map((command) => command.data.toJSON());
        await rest.put(Routes.applicationCommands(client.user!.id), {
            body: commandData,
        });
    } catch (error) {
        console.error(error);
    }
};
