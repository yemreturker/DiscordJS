import { Client, GatewayIntentBits, VoiceState as vs } from 'discord.js';
import { OnGuildCreate, OnGuildDelete } from './events/onGuildChange';
import { OnInteraction } from './events/onInteraction';
import { OnReady } from './events/onReady';
import { OnVoiceStateUpdate } from './events/onVoiceStateUpdate';

const Token = process.env.BOT_TOKEN as string;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

(async () => {
    client.once('ready', async () => await OnReady(client));
    client.on('interactionCreate', async (interaction) => await OnInteraction(interaction));
    client.on('voiceStateUpdate', async (oldState, newState) => await OnVoiceStateUpdate(client, oldState as vs, newState as vs));
    client.on('guildCreate', (guild) => OnGuildCreate(guild));
    client.on('guildDelete', (guild) => OnGuildDelete(guild));
    await client.login(Token);
})();
