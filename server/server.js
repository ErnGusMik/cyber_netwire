import 'dotenv/config';
import session from 'express-session';
import { pool } from './db/db.connect.js';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import connectPgSimple from 'connect-pg-simple';

import express from 'express';
const app = express();
const FALLBACK_PORT = 3001;

// For POST routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Allows cookie use
app.use(cookieParser());

// Session setup
app.use(session({
    secret: crypto.randomBytes(64).toString('hex'),
    resave: false,
    saveUninitialized: true,
    cookie: { secure: 'auto' },
    store: new (connectPgSimple(session))({
        pool: pool
    })
}));

// CORS
app.use((req, res, next) => {
    res.set("Access-Control-Allow-Origin", "http://localhost:3000");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.set("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token, Accept, Authorization");
    res.set("Access-Control-Allow-Credentials", "true");
    next();
});


// Routes
import router from './handlers/auth.handlers.js';
app.use('/auth', router);

import appRouter from './handlers/app.handlers.js'
app.use('/api', appRouter);


app.listen(process.env.PORT || FALLBACK_PORT, () => {
    console.log(`Server is running on port ${process.env.PORT || FALLBACK_PORT}`);
})