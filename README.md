# Cyber Netwire

A work-in-progress online chat application.

### This branch is for progress regarding the implementation of the Signal protocol!

Read the threat model and design decisions in the [THREAT_MODEL.md](THREAT_MODEL.md) file.

![image](https://github.com/user-attachments/assets/d2cd63f3-0107-45d6-9415-8367a693cb21)

Cyber Netwire is an online, end-to-end encrypted chat app with similar functions to Discord or Slack. Or at least, that's the plan.

| Task                | Status      |
| ------------------- | ----------- |
| Database            | Created     |
| Access control      | Implemented |
| Static msg page     | Implemented |
| Creating new chats  | Implemented |
| Real-time messaging | Implemented |
| Friends page        | Not started |
| Settings page       | Not started |
| Landing page        | Implemented |
| Responsive design   | Not started |

It must be noted, that messages don't transfer from onde device to another yet. I decided on a solution to combat this early on, but found out that it was more complex than I initially thought, so I had to put it on hold for now.

##### A bit about the encryption:

The app now uses an adapted version of the Signal Protocol, to allow this web app to run as a base device. More info about the implementation can be found in the [SIGNAL_PROTOCOL.md](SIGNAL_PROTOCOL.md) file. Information about the threat model, design decisions and security considerations can be found in the [THREAT_MODEL.md](THREAT_MODEL.md) file. The code still contains remnants of the old encryption scheme, but it will be removed in the future.

### So, then, what works?
Here's a small list of what shouldn't return any errors:
- Registration & login with Google
- Sign up & login password
- Creating new chats (only DMs for now! feeds won't work!)
- Sending and receiving messages in real-time (better to use one device for each user for now). Find the user no. and display name in the bottom right corner of the screen.
- Changing chats
- Changing status, eg. offline/idle/online
- That's about it for now, unfortunately.


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
    SESSION_SECRET=64_byte_secret_string_for_session_encryption
    ```

6. In a new window run `node server.js` in the `\server` directory

### Demo video

As of 28.01.2025

https://github.com/user-attachments/assets/c3477104-0235-4d1c-9696-cb31ce359375
