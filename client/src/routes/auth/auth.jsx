import React, { useState } from "react";
import "./auth.css";

// import * as libsignal from "@signalapp/libsignal-client";
import * as libsignal from "@privacyresearch/libsignal-protocol-typescript";

import Button from "../../components/button/button";
import Input from "../../components/input/input";
import Nav from "../../components/nav/nav";
import { redirect, useSearchParams } from "react-router-dom";
import { type } from "@testing-library/user-event/dist/type";
import * as argon from "argon2-browser";

export default function Auth() {
    const [signup, setSignup] = useState(false);
    const [google, setGoogle] = useState(false);
    const [csrfToken, setCSRFToken] = useState("");
    const [name, setName] = useState("User");
    const searchParams = new URLSearchParams(window.location.search);

    const handleGoogleResponse = async (res) => {
        // Disable Google button
        document.getElementById("google_btn").style.pointerEvents = "none";

        // Verify Google response
        const req = await fetch("http://localhost:8080/auth/google", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({
                idToken: res.credential,
            }),
            // Send cookies -- important!
            credentials: "include",
        });

        // Handle Google verify response
        if (req.status !== 200) {
            document.getElementById("login-error").innerText =
                "Failed to log in with Google! Please refresh the page and try again. (" +
                req.statusText +
                ")";
            console.error(
                "[FATAL] Failed to log in with Google: " + req.statusText
            );
            document.getElementById("google_btn").style.pointerEvents = "auto";
            return;
        }
        console.log("Logged in with Google: " + req.statusText);

        const res1 = await req.json();
        console.log(res1);

        // Set Google state and CSRF token
        setGoogle(true);
        setCSRFToken(res1.csrfToken);
        setName(res1.name);

        // Show password input
        document.getElementById("passw-cont").style.display = "block";
        document.getElementById("login-error").innerText = "";
        document.getElementById("google_btn").style.display = "none";

        if (res1.newUser) {
            setSignup(true);
        }
    };

    // Sign in with Google setup
    React.useEffect(() => {
        if (google) return;

        // Load script
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        document.body.appendChild(script);
        script.onload = () => {
            // Initialize Google Sign-In with client ID
            window.google.accounts.id.initialize({
                client_id:
                    "693806857679-9nfcgrccu4cb1s2u09jcv691pi44mb6n.apps.googleusercontent.com",
                callback: handleGoogleResponse,
            });
            // Render Google Sign-In button
            window.google.accounts.id.renderButton(
                document.getElementById("google_btn"),
                {
                    theme: "filled_black",
                    text: signup ? "signup_with" : "continue_with",
                    shape: "pill",
                    locale: "en",
                    width: "240",
                    size: "large",
                    logo_alignment: "left",
                }
            );
        };
        // Cleanup
        return () => {
            document.body.removeChild(script);
        };
    }, [csrfToken]);

    // Load CSRF Token
    React.useEffect(() => {
        const loadCSRF = async () => {
            const req = await fetch("http://localhost:8080/auth/csrf-token", {
                method: "GET",
                credentials: "include",
            });
            console.log("CSRF Token loaded: " + req.statusText);
            const res = await req.json();

            setCSRFToken(res["x-csrf-token"]);
            console.log("CSRF Token stored in Cookies: " + document.cookie);
            // .split("; ")
            // .find((row) => row.startsWith("csrf_token="))
            // ?.split("=")[1]);
        };

        loadCSRF();
    }, []);

    const createLoadAnimation = () => {
        const overlay = document.getElementById("overlay-text");
        let i = 0;
        const interval = setInterval(() => {
            overlay.innerText = ".".repeat(i % 4);
            i++;
        }, 500);
        return interval;
    };

    function hexToUint8Array(hexString) {
        return new Uint8Array(
            hexString.match(/../g).map((h) => parseInt(h, 16))
        ).buffer;
    }

    function str2ab(str) {
        var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
        var bufView = new Uint16Array(buf);
        for (var i = 0, strLen = str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        return buf;
    }

    // Browser: arrayBuffer -> base64 (chunked to avoid stack issues)
    function arrayBufferToBase64(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);
        const chunkSize = 0x8000;
        let binary = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(
                null,
                bytes.subarray(i, i + chunkSize)
            );
        }
        return btoa(binary);
    }

    // Browser: base64 -> ArrayBuffer
    function base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // Create key from password
    const createKey = async (password, salt) => {
        // Transform password to CryptoKey object
        // password = await window.crypto.subtle.importKey(
        //     "raw",
        //     new TextEncoder().encode(password),
        //     "PBKDF2",
        //     false,
        //     ["deriveKey"]
        // );

        // // Use the password to create a key using the PBKDF2 algorithm
        // // to be used by the AES-GCM algorithm
        // const key = await crypto.subtle.deriveKey(
        //     {
        //         name: "PBKDF2",
        //         salt: hexToUint8Array(salt),
        //         iterations: 100000,
        //         hash: "SHA-256",
        //     },
        //     password,
        //     {
        //         name: "AES-GCM",
        //         length: 256,
        //     },
        //     false,
        //     ["encrypt", "decrypt"]
        // );
        // return key;

        const key = await argon.hash({
            pass: password,
            salt: salt,
            type: argon.ArgonType.Argon2id,
            hashLen: 32,
            time: 3,
            mem: 65536,
            parallelism: 1,
        });
        const cryptoKey = await window.crypto.subtle.importKey(
            "raw",
            key.hash,
            { name: "AES-GCM" },
            false,
            ["encrypt", "decrypt"]
        );
        const hkdfKey = await window.crypto.subtle.importKey(
            "raw",
            key.hash,
            { name: "HKDF" },
            false,
            ["deriveKey", "deriveBits"]
        );
        return [cryptoKey, hkdfKey];
    };

    // Handle password field & user creation
    const logInHandler = async (e) => {
        e.preventDefault();

        if (!google) {
            document.getElementById("login-error").innerText =
                "You need to log in with Google first!";
            return;
        }

        const password = document.getElementById("login-passw").value;

        // ! SIGNAL PROTOCOL IMPLEMENTATION VARIABLES
        let prekeyBundle;
        const opk = []; // One-time PreKeys

        // If new user, set criteria
        if (signup) {
            if (password.length < 8) {
                document.getElementById("login-error").innerText =
                    "Password must be at least 8 characters long!";
                return;
            }
            if (!/[A-Z]/.test(password)) {
                document.getElementById("login-error").innerText =
                    "Password must contain at least one uppercase letter!";
                return;
            }
            if (!/[a-z]/.test(password)) {
                document.getElementById("login-error").innerText =
                    "Password must contain at least one lowercase letter!";
                return;
            }
            if (!/[0-9]/.test(password)) {
                document.getElementById("login-error").innerText =
                    "Password must contain at least one number!";
                return;
            }
            if (!/[!@#$%^&*]/.test(password)) {
                document.getElementById("login-error").innerText =
                    "Password must contain at least one special character!";
                return;
            }

            // ! SIGNAL PROTOCOL IMPLEMENTATION STARTS HERE
            // Signup flow
            // Generate registration ID
            const registrationId = libsignal.KeyHelper.generateRegistrationId();

            // Generate identity key pair
            const identityKey =
                await libsignal.KeyHelper.generateIdentityKeyPair();

            // Generating signed prekey
            const signedPrekeyId = Math.floor(Math.random() * 1e9); // stable unique id for this prekey
            const timestamp = Date.now();

            // Generate a fresh keypair for the signed prekey (libsignal official)
            // const signedPriv = libsignal.PrivateKey.generate();
            // const signedPub = signedPriv.getPublicKey();
            // Creating signature
            // const signedPubBytes = signedPub.getPublicKeyBytes(); // Uint8Array -- needed for signing
            // const signature = identityKey.privateKey.sign(signedPubBytes); // Uint8Array

            // Create SignedPreKeyRecord, to be sent to server (libsignal official)
            // const signedPreKeyRecord = libsignal.SignedPreKeyRecord.new(
            //     signedPrekeyId,
            //     timestamp,
            //     signedPub,
            //     signedPriv,
            //     signature
            // );

            const signedPreKey = await libsignal.KeyHelper.generateSignedPreKey(
                identityKey,
                signedPrekeyId
            );

            // Signature verification (libsignal official)
            // const ok = identityKey.publicKey.verify(
            //     signedPubBytes,
            //     signature
            // );

            // Signed pre-key signature verification
            const lib = await libsignal.default(); // Returns a Curve instance object
            // basic sanity checks (helpful debugging)
            console.log(
                "lens:",
                identityKey.pubKey?.byteLength,
                signedPreKey.keyPair?.pubKey?.byteLength,
                signedPreKey.signature?.byteLength
            );

            // Use the async verifier and treat "no throw" as valid
            let verified = false;
            try {
                // This will throw on an invalid signature (per the library implementation)
                await lib.Curve.async.verifySignature(
                    identityKey.pubKey,
                    signedPreKey.keyPair.pubKey,
                    signedPreKey.signature
                );
                // If we reached here, verification succeeded
                verified = true;
            } catch (err) {
                console.error("Signature verification failed:", err);
                verified = false;
            }

            console.log("Signed PreKey signature valid:", verified);

            if (!verified) {
                document.getElementById("login-error").innerText =
                    "Failed to securely create your account! Signature verification failed.";
                return;
            }

            // Generating one-time prekeys
            const OPK_COUNT = 100;

            for (let i = 0; i < OPK_COUNT; i++) {
                // const id = i + 1;
                // const priv = libsignal.PrivateKey.generate(); // Generate private key
                // const pub = priv.getPublicKey(); // Derive public key
                // const record = libsignal.PreKeyRecord.new(id, pub, priv); // Create PreKeyRecord from keys
                // opk.push(record);
                // // For upload of public key, call record.publicKey().serialize()

                const prekey = await libsignal.KeyHelper.generatePreKey(i + 1);
                opk.push(prekey);
            }

            // Create Post Quantum Kyber PreKey (libsignal official)
            // const kyberKeyPair = libsignal.KEMKeyPair.generate();
            // const kyberPubKey = kyberKeyPair.getPublicKey();
            // const kyberPubBytes = kyberPubKey.serialize(); // Uint8Array

            // Sign Kyber public key with identity private key (libsignal official)
            // const kyberSignature = identityKey.privateKey.sign(kyberPubBytes); // Uint8Array

            // Create KyberPreKeyRecord for storage / upload (libsignal official)
            // const kyberPreKeyRecord = libsignal.KyberPreKeyRecord.new(
            //     1, // kyberPreKeyId -- can be any number for now
            //     Date.now(), // timestamp
            //     kyberKeyPair, // Kyber keypair
            //     kyberSignature // signature
            // );

            // Get prekey bundle ready (libsignal official)
            // const prekeyBundle = libsignal.PreKeyBundle.new(
            //     1, // registrationId -- can be any number for now
            //     1, // deviceId -- can be any number for now
            //     1, // preKeyId -- selecting first prekey for now
            //     opk[0].publicKey(), // preKey public key
            //     signedPrekeyId, // signed prekey id
            //     signedPreKeyRecord.publicKey(), // signed prekey public key
            //     signedPreKeyRecord.signature, // signed prekey signature
            //     identityKey.publicKey, // identity public key
            //     kyberPreKeyRecord.id, // Kyber prekey id
            //     kyberPreKeyRecord.publicKey, // Kyber public key
            //     kyberPreKeyRecord.signature // Kyber public key signature
            // );

            prekeyBundle = {
                registrationId: registrationId,
                deviceId: 1,
                signedPreKey: {
                    keyId: signedPreKey.keyId,
                    publicKey: arrayBufferToBase64(signedPreKey.keyPair.pubKey),
                    signature: arrayBufferToBase64(signedPreKey.signature),
                },
                identityKey: arrayBufferToBase64(identityKey.pubKey),
                timestamp: timestamp,
            };

            console.log("PreKey Bundle created:", prekeyBundle);

            // ! SIGNAL PROTOCOL IMPLEMENTATION STOPS HERE
        }

        // Check if password is empty
        if (password.length === 0) {
            document.getElementById("login-error").innerText =
                "Please enter your password!";
            return;
        }

        // Create loading animation
        document.getElementById("login-overlay").style.display = "flex";
        const interval = createLoadAnimation();

        // Send password to server
        const req = await fetch("http://localhost:8080/auth/verify", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({
                password: password,
                keyBundle: signup ? prekeyBundle : null, // send prekey bundle if signing up
            }),
            credentials: "include",
        });

        console.log("Password verification: " + req.statusText);

        const res = await req.json();
        console.log(res);
        setCSRFToken(res.csrfToken);

        // Handle response
        if (req.status !== 200) {
            document.getElementById("login-error").innerText =
                "Failed to log in! Please try again. (" + req.statusText + ")";
            clearInterval(interval);
            document.getElementById("login-overlay").style.display = "none";

            return;
        }

        // ! SIGNAL PROTOCOL IMPLEMENTATION CONTINUES HERE
        // Signup flow
        // Upload One-time Prekeys to server
        if (signup) {
            const opkReq = await fetch(
                "http://localhost:8080/auth/upload-prekeys",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": res.csrfToken,
                    },
                    body: JSON.stringify({
                        prekeys: opk.map((pk) => ({
                            keyId: pk.keyId,
                            publicKey: arrayBufferToBase64(pk.keyPair.pubKey),
                        })),
                    }), // send one-time prekeys if signing up
                    credentials: "include",
                }
            );

            const opkRes = await opkReq.json();
            if (opkReq.status !== 200) {
                document.getElementById("login-error").innerText =
                    "Failed to upload one-time prekeys! Please refresh and try again. (" +
                    opkRes.error +
                    ")";
                clearInterval(interval);
                document.getElementById("login-overlay").style.display = "none";
                setCSRFToken(opkRes.csrfToken);
                return;
            }

            console.log("One-time prekeys uploaded: " + opkRes.uploadedCount);
        }
        // ! SIGNAL PROTOCOL IMPLEMENTATION STOPS HERE

        let rsaKey;
        const [key, hkdfKey] = await createKey(password, res.salt);

        try {
            console.log("Key created");
            const rsaKeyRaw = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: new Uint8Array(
                        res.psswIV.match(/../g).map((h) => parseInt(h, 16))
                    ).buffer,
                },
                key,
                hexToUint8Array(res.privKey)
            );
            console.log("RSA key decrypted");
            rsaKey = await window.crypto.subtle.importKey(
                "pkcs8",
                rsaKeyRaw,
                {
                    name: "RSA-OAEP",
                    hash: "SHA-256",
                },
                true, //! change
                ["decrypt"]
            );
            console.log("RSA key imported");
        } catch (e) {
            document.getElementById("login-error").innerText =
                "Failed to decrypt private key! Plesae try again or use a different browser";
            console.error(e);
            clearInterval(interval);
            document.getElementById("login-overlay").style.display = "none";

            setCSRFToken(res.csrfToken);
        }

        // ! SIGNAL IMPLEMENTATION CONTINUES HERE
        // Signup flow
        // HKDF-Expand to create separate keys for encryption and verification
        if (signup) {
            const verifierKey = await window.crypto.subtle.deriveKey(
                {
                    name: "HKDF",
                    hash: "SHA-256",
                    salt: res.salt,
                    info: str2ab("E2E_PASSW_VERIFIER"),
                },
                hkdfKey,
                { name: "HMAC", hash: "SHA-256", length: 256 },
                false,
                ["sign", "verify"]
            );

            const encKey = await window.crypto.subtle.deriveKey(
                {
                    name: "HKDF",
                    hash: "SHA-256",
                    salt: res.salt,
                    info: str2ab("E2E_PASSW_ENC"),
                },
                hkdfKey,
                { name: "AES-GCM", length: 256 },
                false,
                ["encrypt", "decrypt"]
            );

            const encryptedIdentityKey = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: new Uint8Array(res.idkIV) },
                encKey,
                base64ToArrayBuffer(res.identityKey)
            );

            const spk = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: new Uint8Array(res.spkIV) },
                encKey,
                base64ToArrayBuffer(res.signedPreKey)
            );
            const keyReq = await fetch(
                "http://localhost:8080/auth/upload-privkeys",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": res.csrfToken,
                    },
                    body: JSON.stringify({
                        identityKey: arrayBufferToBase64(
                            encryptedIdentityKey
                        ),
                        signedPreKey: arrayBufferToBase64(spk),
                        verifierKey: await window.crypto.subtle.exportKey(
                            "raw",
                            verifierKey
                        ).then((buf) => arrayBufferToBase64(buf)),
                    }),
                }
            ); // DO SERVER THEN RETURN

            const keyRes = await keyReq.json();

            console.log("Private keys uploaded: " + keyRes.rows);
        }

        // Set service worker
        navigator.serviceWorker.getRegistration("/").then((reg) => {
            reg.active.postMessage({
                test: "test",
            });
        });

        try {
            if ("serviceWorker" in navigator) {
                if (!rsaKey) {
                    document.getElementById("login-error").innerText =
                        "Failed to decrypt private key! Plesae try again or use a different browser";
                    clearInterval(interval);
                    document.getElementById("login-overlay").style.display =
                        "none";

                    setCSRFToken(res.csrfToken);
                    return;
                }

                // Listen for response
                const messageHandler = (event) => {
                    console.log("Message from service worker:", event.data);
                    if (event.data.type === "success") {
                        console.log("Key set successfully");
                        navigator.serviceWorker.controller.removeEventListener(
                            "message",
                            messageHandler
                        );
                        clearInterval(interval);
                        // localStorage.setItem("isAuthenticated", true);
                        // window.location.href = `/${
                        //     searchParams.get("redirect")
                        //         ? searchParams.get("redirect")
                        //         : "home"
                        // }`;
                    }
                };

                navigator.serviceWorker.addEventListener(
                    "message",
                    messageHandler
                );

                navigator.serviceWorker.register("/sw.js").then(async (reg) => {
                    reg.active.postMessage({
                        type: "setKey",
                        key: rsaKey,
                    });
                    //
                    //!
                    //
                    function buf2hex(buffer) {
                        // buffer is an ArrayBuffer
                        return [...new Uint8Array(buffer)]
                            .map((x) => x.toString(16).padStart(2, "0"))
                            .join("");
                    }
                    const exportedkey = await crypto.subtle.exportKey(
                        "pkcs8",
                        rsaKey
                    );
                    console.log(buf2hex(exportedkey));
                    //
                    //!
                    //
                });

                return;
            }
            throw new Error("Service Worker not supported");
        } catch (e) {
            console.error(e);
            document.getElementById("login-error").innerText =
                "Failed to securely set private key! Please try again or use a different browser";
            clearInterval(interval);
            document.getElementById("login-overlay").style.display = "none";

            setCSRFToken(res.csrfToken);
        }
    };

    return (
        <div className="auth">
            <Nav active={1} />
            <div className="login">
                <i className="fa-solid fa-lock" />
                <h1>{signup ? "Sign up" : "Log in"}</h1>
                <hr className="hr" />
                <div className="overlay-cont">
                    <div className="overlay" id="login-overlay">
                        <h3 className="pixel-font" id="overlay-text">
                            ...
                        </h3>
                    </div>
                    <div id="google_btn"></div>
                    <div className="passw-cont" id="passw-cont">
                        <p
                            className="secondary pixel-font"
                            style={
                                signup
                                    ? { display: "block", marginBottom: "10px" }
                                    : { display: "none" }
                            }
                        >
                            Welcome, {name}!<br />
                            Create a password strong enough to encrypt all your
                            data!
                        </p>
                        <Input
                            label="Passsword"
                            type="password"
                            id="login-passw"
                        />
                    </div>
                    <div className="submit-cont">
                        <p className="pixel-font secondary">
                            {signup
                                ? "Have an acount? Log in "
                                : "No account? Sign up "}{" "}
                            <span
                                className="primary pixel-font"
                                onClick={() => setSignup(!signup)}
                            >
                                here
                            </span>
                        </p>
                        <Button
                            text={signup ? "Sign up" : "Log in"}
                            onClick={logInHandler}
                        />
                    </div>
                </div>
                <p
                    className="pixel-font primary"
                    id="login-error"
                    style={{ marginTop: "10px" }}
                ></p>
                <p className="pixel-font secured-by">Secured by netOS.</p>
            </div>
        </div>
    );
}
