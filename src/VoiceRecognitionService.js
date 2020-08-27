const speech = require('@google-cloud/speech');
const Bumblebee = require("bumblebee-hotword-node");
const client = new speech.SpeechClient();
const ytdl = require('ytdl-core-discord');

// TODO maybe use single_utterance for shorter queries but will require two hotwords
class VoiceRecognitionService
{
    constructor(connection, voiceReceiverStream)
    {
        // boolean to check if it's currently recording to google speech api
        this.recording = false;
        this._connection = connection;
        this._inputFormat = {
            config:
            {
                encoding: 'LINEAR16',
                audioChannelCount: 1,
                sampleRateHertz: 16000,
                languageCode: 'en-US'
            }};
        this._transcribed = '';
        this.startBumblebee(voiceReceiverStream);
    }

    startBumblebee(voiceReceiverStream)
    {
        // Setting up bumblebee for hotword detection
        this._bumblebee = new Bumblebee()
            .on('hotword', async (hotword) =>
            {
                console.log('hotword detected');
                if (!this.recording)
                {
                    await this.startStream();
                    this.recording = true;
                    // TODO maybe separate logic of connections into different?
                    // Temp fix: if song is playing, pause it and then play it when we're done. Will save the timestamp
                    // const songPlaying = this._connection.client.voiceConnections.get(this._connection.channel.guild.id).playing
                    // if (songPlaying)
                    // {
                    //     console.log('paused song')
                    //     // await songPlaying.stream.pause();
                    //     songPlaying.timeStopped = this._connection.client.voiceConnections.get(this._connection.channel.guild.id).dispatcher.streamTime;
                    // }
                    this._connection.play('ping.wav');

                    setTimeout(async () => {
                        console.log('Disabled Google Stream from Listening');
                        // Temp fix: continue song. Have to retrieve song again.
                        // if (songPlaying)
                        // {
                        //     console.log('resuming song')
                        //     songPlaying.stream = await ytdl(songPlaying.url, {begin: songPlaying.timeStopped});
                        //     this._connection.play(songPlaying.stream, {type: "opus"});
                        // }
                        this.recording = false;
                        this.shutdownStream();
                    }, 5000);
                }
            })
            .on('data', data =>
            {
                if (this.recording)
                {
                    if (this._currentStream.destroyed) throw new Error('Stream was destroyed when attempting to send data from bumblebee to Google')
                    this._currentStream.write(data);
                }
            });

        // TODO add second hotword for short commands like 'skip' or 'pause', separate them.
        this._bumblebee.addHotword('bumblebee');

        this._bumblebee.on('error', (error) =>
        {
            console.log(`"Bumblebee Error: ${error}`);
            this.startBumblebee(voiceReceiverStream);
        })
        this._bumblebee.start({stream: voiceReceiverStream});
    }

    startStream()
    {
        this._currentStream = client.streamingRecognize(this._inputFormat)
            .on('error', error => console.error('Google API error ' + error))
            .on('data', data =>
            {
                this._transcribed = data.results[0].alternatives[0].transcript;
                console.log('Google API Transcribed: ' + this._transcribed);
                this.executeCommand(this._transcribed);
            });
    }

    shutdownStream()
    {
        console.log('Shutting Down Google Stream');
        this._currentStream.end();
    }

    /**
     * Executes command given the transcribed text
     *
     * @param transcribed
     * @returns {Promise<void>}
     */
    async executeCommand(transcribed)
    {

        const client = this._connection.client;
        const stuff = client.voiceConnections.get(this._connection.channel.guild.id);
        stuff.textChannel.send(`<@${stuff.listeningTo.id}> said: \"${(transcribed) ? transcribed : "..."}\"`);
        let arrayed_transcribed = transcribed.split(" ");
        const stringCommand = arrayed_transcribed.shift().toLowerCase();
        const command = client.voiceCommands.get(stringCommand);
        if (command === undefined)
        {
            console.log(`${stringCommand} command not available`);
            return;
        }
        command.execute(client, this._connection.channel.guild, arrayed_transcribed);
    }

    shutdown()
    {
        this._bumblebee.destroy();
        this._connection.disconnect();
    }
}

module.exports = {VoiceRecognitionService};