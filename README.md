# DiscordJS
This is a music bot template designed for Discord, written in TypeScript. This template includes the basic components required to quickly get started with developing your own music bot.

## Features
This music bot template includes the following features:

* Can be used as a Discord bot
* Developed using TypeScript for increased reliability and ease of maintenance
* Supports the following commands:
  * **/play {query}:** Searches for and plays a song from YouTube.
  * **/leave:** Stops the bot and disconnects from the voice channel.
  * **/currentlyplaying:** Displays information about the currently playing song.
  * **/skip:** Skips the currently playing song.
  * **/skipto {number}:** Skips to a specific song in the queue.
  * **/queue:** Displays the current queue of songs.
  * **/shuffle:** Shuffles the current queue of songs.
  * **/repeat:** Repeat the currently playing song.
  
## Installation
To use this music bot template, follow these steps:

* Clone this repository to your local machine
```bash
$ git clone https://github.com/yemreturker/DiscordJS.git
```
* Run npm install to install the required dependencies
```bash
$ npm install
```
* Create a .env file and add your Discord bot token using the format BOT_TOKEN=<your_bot_token>
```bash
$ touch .env
```
* Run npm run build to build bot
```bash
$ npm run build
```
* Run npm run start to start the bot
```bash
$ npm run start
```

## Usage
To use the bot, simply add it to your Discord server and use the commands listed above to play and manage music in your voice channel. You can also modify the bot's source code to add additional functionality as needed.

## License
This project is licensed under the MIT License - see the LICENSE file for details.
