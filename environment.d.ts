// Types for the .env fiels
declare global {
    namespace NodeJS {
      interface ProcessEnv {
        TOKEN: string;
        CLIENT_ID: string;
        GUILD_ID: string;
        VERIFICATION_CHANNEL: string;
        VERIFIED_ROLE: string;
        WA_ACCOUNT_ID: string;
        WA_CLIENT_ID: string;
        WA_CLIENT_SECRET: string;
      }
    }
  }
  
  // If this file has no import/export statements (i.e. is a script)
  // convert it into a module by adding an empty export statement.
  export {}