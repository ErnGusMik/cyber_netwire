# Cyber Netwire

A work-in-progress online chat application.

### This branch is for progress regarding the implementation of the Signal protocol! 
Read the threat model and design decisions in the [THREAT_MODEL.md](THREAT_MODEL.md) file.

![image](https://github.com/user-attachments/assets/d2cd63f3-0107-45d6-9415-8367a693cb21)

Cyber Netwire is an online, end-to-end encrypted chat app with similar functions to Discord or Slack. Or at least, that's the plan.

| Task            | Status      |
|-----------------|-------------|
| Database        | Created     |
| Access control  | Implemented |
| Static msg page | Implemented |
| Creating new chats | Implemented |
| Real-time messaging | In progress |
| Friends page    | Not started |
| Settings page   | Not started |
| Landing page    | Not started |
| Responsive design | Not started |

##### A bit about the encryption:
Once a new user is created, a RSA key pair is created for it and stored in the database (the private key is encrypted with the user's password). Once a new chat is created a new AES-256 key is generated and sent to the other user (encrypted with its public key). This key is used for encrypting messages and is rotated once in a while.

### Running locally
Due to the unfinished stage of the project, I will not yet publish the site online, but you are free to host it locally :)

1. Clone the repo
2. Run `npm install` in the directory
3. Create a `.env` file in the `\server` directory and 
4. Run `npm start` in the `\client` directory and make sure it contains the following:
   ```env
   PORT=8080 # Client calls this port
   DBUSER=your_databse_username
   DBPASSW=your_database_password
   DBHOST=your_database_host
   DBPORT=your_database_port
   DBNAME=your_database_name
   NODE_ENV=development    
   CSRF_SECRET=64_byte_secret_string_for_csrf_protection
   GOOGLE_CLIENT_ID=google_client_id_for_google_signin
6. In a new window run `node server.js` in the `\server` directory

### Demo video
As of 28.01.2025

https://github.com/user-attachments/assets/c3477104-0235-4d1c-9696-cb31ce359375

