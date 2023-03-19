import { Interaction } from 'discord.js';
import GuildConstructor from '../interfaces/guildConstructor';
import { CommandList } from '../_commandList';

export const OnInteraction = async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    for (const command of CommandList) {
        if (interaction.commandName === command.data.name) {
            await command.run(interaction);
        }
    }
};
