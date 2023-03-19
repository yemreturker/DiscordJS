import { CommandInteraction, Interaction, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';
import GuildConstructor from './guildConstructor';

export default interface Command {
    data: Omit<SlashCommandBuilder, 'addSubcommandGroup' | 'addSubcommand'> | SlashCommandSubcommandsOnlyBuilder;
    run: (interaction: CommandInteraction) => Promise<void>;
}
