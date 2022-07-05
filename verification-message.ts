import * as dotenv from 'dotenv';
dotenv.config();

import { GatewayIntentBits } from 'discord-api-types';
import { Client } from "discord.js";

// The Discord bot client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// The object which creates the embed containing the info on how to verify your account
const embeds = [{
    "title": "Welcome to the Unicycling Society of America Discord Server",
    "description": "If you have a USA membership, please follow the steps below to gain access to the members-only channels! [Click here](https://uniusa.org/join-us) to become a member!",
    "color": 16711680,
    "fields": [
        {
            "name": "Step 1",
            "value": "Click the green button labeled `Enter Email` and enter the email associated with your USA account. If your email goes through, continue to step 2."
        },
        {
            "name": "Step 2",
            "value": "Once you've received an email, click the gray button labeled `Enter Verification Code` and enter the 6 digit verification code included in the email."
        },
        {
            "name": "That's it!",
            "value": "We hope you enjoy chatting with other USA members here on Discord! If you need help verifying, send a message in <#993686215704453191>."
        }
    ]
}];

// The object which creates the buttons for triggering the email and verification code modals
const components = [{
    type: 1,
    components: [
        {
            type: 2,
            label: "Enter Email",
            style: 3,
            custom_id: "email"
        },
        {
            type: 2,
            label: "Enter Verification Code",
            style: 2,
            custom_id: "code"
        }
    ]
}];

if (client != null) {
    /**
     * Logs bot into Discord and sends the verification info message
     */
    client.on('ready', async () => {
        // Gets the verification channel from the ID specified in the .env
        const channel = client.channels.cache.get(process.env.VERIFICATION_CHANNEL);
        if (channel?.isText()) {
            await channel.send({ embeds: embeds, components: components }).catch(console.error);
        } else {
            console.log('Error sending message');
        }
        // Logs out of Discord and destroys the bot client
        client.destroy();
    });

    client.login(process.env.TOKEN);
} else {
    console.log('Error creating client');
}