import * as dotenv from 'dotenv';
dotenv.config();

import { GatewayIntentBits } from 'discord-api-types';
import { ButtonInteraction, Client, Interaction, ModalSubmitInteraction } from 'discord.js';
import axios from 'axios';
import fs from 'fs';

// The Discord bot client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// The object which creates a modal for entering your email
const emailModal = {
    title: "Enter Your Email Address",
    customId: "email_modal",
    components: [{
        type: 1,
        components: [{
            type: 4,
            custom_id: "email_field",
            label: "Email",
            style: 1,
            min_length: 6,
            required: true,
            placeholder: "Enter the email address associated with your USA account"
        }]
    }]
}

// The object which creates a modal for entering your verification code
const codeModal = {
    title: "Enter Your Verification Code",
    customId: "code_modal",
    components: [{
        type: 1,
        components: [{
            type: 4,
            custom_id: "code_field",
            label: "Code",
            style: 1,
            min_length: 6,
            max_length: 6,
            required: true,
            placeholder: "Enter the verification code sent to your email"
        }]
    }]
}

// The object which creates a button for the prompt to reenter your email
const reenterButton = [{
    type: 1,
    components: [
        {
            type: 2,
            label: "Reenter Email",
            style: 3,
            custom_id: "email_reenter"
        }
    ]
}];

// The map which contains the verification codes that corresond to the users who requested them
let codes: Map<string, string> = new Map()
// The variable used to store the Wild Apricot token data needed for API calls and refreshing the API token
let token_config: {
    refresh_token: string;
    token: string;
    expiration: number;
}

/**
 * Reads the Wild Apricot token data from config.json
 */
function getTokenConfig() {
    fs.readFile('./config.json', 'utf8', (err, data) => {
        if (err) {
            console.log(`Error reading from file: ${err}`);
        } else {
            console.log(`Token configs read successfully!`);
            // Sets the token_config variable to the data read from config.json
            token_config = JSON.parse(data);
        }
    });
}

/**
 * Uses the current refresh token to get a new Wild Apricot API token
 */
async function refreshToken() {
    // The POST request which refreshes the Wild Apricot API token
    await axios({
        url: `https://oauth.wildapricot.org/auth/token`,
        headers: {
            'Authorization': `Basic ${Buffer.from(process.env.WA_CLIENT_ID + ':' + process.env.WA_CLIENT_SECRET).toString('base64')}`,
            'Content-type': 'application/x-www-form-urlencoded'
        },
        data: `grant_type=refresh_token&refresh_token=${token_config.refresh_token}`,
        method: 'POST'

    }).then(async (response) => {
        // Updates the token_config variable with the new token data
        token_config = {
            refresh_token: response.data.refresh_token,
            token: response.data.access_token,
            expiration: Date.now() + response.data.expires_in * 1000
        }
        await updateTokenConfig();
    });
}

/**
 * Updates config.json to contain the token data contained in the token_config variable
 */
async function updateTokenConfig() {
    fs.writeFile('./config.json', JSON.stringify(token_config), 'utf8', (err) => {
        if (err) {
            console.log(`Error writing file: ${err}`);
        } else {
            console.log(`Token configs updated successfully!`);
        }
    });
}

/**
 * Checks if the specified user has been verified
 * @param interaction the interaction for which this check is being performed for
 * @param user the id of the user whose verification status is being checked
 * @returns whether or not the specified user has been verified
 */
async function isVerified(interaction: Interaction, user: string): Promise<boolean> {
    // Check if the user has the verified role
    if (interaction.guild?.members.cache.get(user)?.roles.cache.has(process.env.VERIFIED_ROLE)) {
        // Notifies the user that they have already been verified if the interaction is repliable
        if (interaction.isRepliable()) {
            await interaction.reply({ content: 'Error: You are already verified!', ephemeral: true }).catch(console.error);
        }
        return true;
    }
    return false;
}

/**
 * Handles Discord button interaction events
 */
async function handleButton(interaction: ButtonInteraction) {
    // The id of the user submitting the modal interaction
    const user = interaction.user.id;
    switch (interaction.customId) {
        // Email button
        case "email":
            // Ensures user has not already verified
            if (!await isVerified(interaction, user)) {
                // Sends followup if user has already entered their email, in case they need to try to resend their email
                if (codes.has(user)) {
                    await interaction.reply({ content: 'You\'ve already entered your email. Would you like to reenter your email and get a new code?', components: reenterButton , ephemeral: true }).catch(console.error);
                } else {
                    // Shows the modal to enter email
                    await interaction.showModal(emailModal).catch(console.error);
                }
            }
            break;
        // Email button when notified that email has already been entered
        case "email_reenter":
            // Ensures user has not already verified
            if (!await isVerified(interaction, user)) {
                // Shows the modal to enter email
                await interaction.showModal(emailModal).catch(console.error);
            }
            break;
        // Verification code button
        case "code":
            // Ensures user has not already verified
            if (!await isVerified(interaction, user)) {
                // Ensures has already entered an email and received a code in their email
                if (codes.has(user)) {
                    // Shows the modal to enter verification code
                    await interaction.showModal(codeModal).catch(console.error);
                } else {
                    await interaction.reply({ content: 'Please press the other button to enter your email first.', ephemeral: true }).catch(console.error);
                }
            }
            break;
    
        default:
            await interaction.reply({ content: 'Error: Unknown interaction', ephemeral: true }).catch(console.error);
            break;
    }
}

/**
 * Searches for a USA member with an active membership status given the specified email
 * @param email The email of the member
 * @returns The object containing member data or null if no member is found or if membership status is lapsed
 */
async function findMember(email: string): Promise<null | any> {
    let member = null;
    // Checks if the Wild Apricot token is valid and refreshes the token if not
    if (Date.now() > token_config.expiration) {
        await refreshToken();
    }
    // Queries all contacts to find a member with the given email and an Active membership status
    // Returns Contacts: [] if no member with Active membership is found
    await axios({
        baseURL: `https://api.wildapricot.org/v2.2/accounts/${process.env.WA_ACCOUNT_ID}`,
        url: `/contacts`,
        params: {
            $async: false,
            $filter: `Email eq ${email} AND Status eq Active`
        },
        headers: {
            'Authorization': `Bearer ${token_config.token}`
        },
        method: 'GET'
    }).then((response) => {
        // Sets member to the first contact with an active membership status (there should never be more than 1) or null if no contacts are returned
        member = response.data.Contacts[0] ?? null
    });

    return member;
}

/**
 * Sends an email containing the verification code to the specificed member through Wild Apricot
 * @param member The object with the member data queried from Wild Apricot
 * @param code The verification code to send to the member
 */
async function sendVerificationEmail(member: any, code: string) {
    // Checks that all the required fields are present in the member object
    if (member.Id && member.DisplayName && member.Email) {
        // Checks if the Wild Apricot token is valid and refreshes the token if not
        if (Date.now() > token_config.expiration) {
            await refreshToken();
        }
        // The POST request which will send the verification email through Wild Apricot
        await axios({
            baseURL: `https://api.wildapricot.org/v2.2/rpc/${process.env.WA_ACCOUNT_ID}`,
            url: `/email/SendEmail`,
            data: {
                "Subject": "USA Discord Verification Code",
                "Body": `<h2>Welcome to the USA Discord Server!></h2><p>Here is your verification code:</p><br><p>${code}</p><br><p>Invite your friends to the Discord: <a href="https://discord.gg/9bDTNyruD2">https://discord.gg/9bDTNyruD2</a></p><p>If you were not expecting this email, you may safely ignore it.</p>`,
                "ReplyToAddress": "no-reply@uniusa.org",
                "ReplyToName": "no-reply",
                "Recipients": [
                    {
                        "Id": member.Id,
                        "Type": "IndividualContactRecipient",
                        "Name": member.DisplayName,
                        "Email": member.Email
                    }
                ]
            },
            headers: {
                'Authorization': `Bearer ${token_config.token}`
            },
            method: 'POST'
        });
    }
}

/**
 * Handles modal submit interactions from Discord for both the email modal and the verification code modal
 * @param interaction The modal submit interaction that triggered this action
 */
async function handleModalSubmit(interaction: ModalSubmitInteraction) {
    // The id of the user submitting the modal interaction
    const user = interaction.user.id;
    switch (interaction.customId) {
        // Email modal interaction
        case "email_modal":
            // Sets the member variable to the result of searching Wild Apricot for the member by email, can be null
            const member = await findMember(interaction.fields.getTextInputValue("email_field"));
            // If member is found, create a 6 digit code, and send the member a verification email
            if (member) {
                const code = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
                codes.set(user, code);
                console.log(code);
                await sendVerificationEmail(member, code);
                await interaction.reply({ content: 'Please check your email for your verification code. Then press the gray button above to enter your code.', ephemeral: true }).catch(console.error);
            } else {
                await interaction.reply({ content: 'You are not a USA member! Visit https://uniusa.org/join-us to become a member before you verify!', ephemeral: true }).catch(console.error);
            }
            break;
        // Verification code modal interaction
        case "code_modal":
            // Checks the codes map to see if the user has been assigned a code
            if (codes.has(user)) {
                // Checks if the code entered matches the code assigned
                if (interaction.fields.getTextInputValue("code_field") === codes.get(user)) {
                    // Gives the verified role to the user
                    await interaction.guild?.members.cache.get(user)?.roles.add(process.env.VERIFIED_ROLE, "verification").catch(console.error);
                    // Deletes user and their code from the map
                    codes.delete(user);
                    await interaction.reply({ content: 'Your account has successfully been verified! Enjoy the server!', ephemeral: true }).catch(console.error);
                } else {
                    await interaction.reply({ content: 'Error: Incorrect verification code entered', ephemeral: true }).catch(console.error);
                }
            } else {
                await interaction.reply({ content: 'Error: Verification code not found, please enter your email again', ephemeral: true }).catch(console.error);
            }
            break;
    
        default:
            await interaction.reply({ content: 'Error: Unknown interaction', ephemeral: true }).catch(console.error);
            break;
    }
}

if (client != null) {
    /**
     * Logs bot into Discord and reads token data from config.json
     */
    client.on('ready', () => {
        console.log(`Logged in as ${client.user ? client.user.tag : ''}!`);
        getTokenConfig();
    });

    /**
     * Handles Discord interaction events
     */
    client.on('interactionCreate', async (interaction: Interaction) => {
        try {
            if (interaction.isButton()) {
                handleButton(interaction);
            } else if (interaction.isModalSubmit()) {
                handleModalSubmit(interaction);
            }
        } catch (error) {
            console.error(error);
            if (interaction.isRepliable()) {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true }).catch(console.error);
            }
        }

    });

    client.login(process.env.TOKEN);
}