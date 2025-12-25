import React, { useState } from "react";
import "./auth.css";

// import * as libsignal from "@signalapp/libsignal-client";
import * as libsignal from "@privacyresearch/libsignal-protocol-typescript";

import Button from "../../components/button/button";
import Input from "../../components/input/input";
import Nav from "../../components/nav/nav";
import { redirect, useSearchParams } from "react-router-dom";
import { type } from "@testing-library/user-event/dist/type";
import adiStore from "../../adiStore";

import { Argon2, Argon2Mode } from "@sphereon/isomorphic-argon2";
import { ident } from "pg-format";

export default function Auth() {
    const [signup, setSignup] = useState(false);
    const [google, setGoogle] = useState(false);
    const [csrfToken, setCSRFToken] = useState("");
    const [name, setName] = useState("User");
    const [verifierData, setVerifierData] = useState({});
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
        setVerifierData({
            salt: res1.salt,
            password_iv: res1.passwordIV,
        });

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

    // Accept either a base64 string or a BufferSource and return an ArrayBuffer
    function ensureArrayBuffer(input) {
        if (!input) return input;
        if (typeof input === "string") return base64ToArrayBuffer(input);
        if (input instanceof ArrayBuffer) return input;
        if (ArrayBuffer.isView(input)) return input.buffer;
        // object with { data: [...] }
        if (input && typeof input === "object" && Array.isArray(input.data))
            return new Uint8Array(input.data).buffer;
        return input;
    }

    // Create key from password using Argon2id
    const createKey = async (password, salt) => {
        const key = await Argon2.hash(password, Uint8Array.fromHex(salt), {
            mode: Argon2Mode.Argon2id,
            hashLength: 32,
            memory: 65536,
            parallelism: 1,
            iterations: 3,
        });
        const cryptoKey = await window.crypto.subtle.importKey(
            "raw",
            hexToUint8Array(key.hex),
            { name: "AES-GCM" },
            false,
            ["encrypt", "decrypt"]
        );
        const hkdfKey = await window.crypto.subtle.importKey(
            "raw",
            hexToUint8Array(key.hex),
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
        let registrationBundle;
        let privateKeys = {
            identityKey: {
                pubKey: null,
                privKey: null,
            },
        }; // To store private keys for later upload
        const opk = []; // One-time PreKeys
        let signalVerifier; // Password verifier key
        let prevCsrfToken = csrfToken;

        // If new user, set criteria
        if (signup) {
            console.log("[INFO][SIGNUP] User is new: using signup flow");
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
            console.log(
                "[INFO][SIGNUP] Generating Signal protocol long-term identity key"
            );
            // Generate registration ID
            const registrationId = libsignal.KeyHelper.generateRegistrationId();
            // Generate identity key pair
            const identityKey =
                await libsignal.KeyHelper.generateIdentityKeyPair();
            privateKeys.identityKey = identityKey;

            const timestamp = Date.now();

            registrationBundle = {
                registrationId: registrationId,
                identityKey: arrayBufferToBase64(identityKey.pubKey),
                timestamp: timestamp,
            };

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

        // ! SIGNAL PROTOCOL IMPLEMENTATION CONTINUES HERE
        // Login flow
        console.log("[INFO][BOTH] Preparing password verifier key...");
        if (!signup) {
            const [_, hkdfKey] = await createKey(password, verifierData.salt);
            signalVerifier = await window.crypto.subtle.deriveKey(
                {
                    name: "HKDF",
                    hash: "SHA-256",
                    salt: hexToUint8Array(verifierData.salt),
                    info: str2ab("E2E_PASSW_VERIFIER"),
                },
                hkdfKey,
                { name: "HMAC", hash: "SHA-256", length: 256 },
                true,
                ["sign", "verify"]
            );
        }
        // ! SIGNAL PROTOCOL IMPLEMENTATION STOPS HERE

        console.log("[INFO][LOGIN] Sending login/signup request to server...");
        // Send password to server & create user if needed
        const req = await fetch("http://localhost:8080/auth/verify", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": prevCsrfToken,
            },
            body: JSON.stringify({
                password: signup
                    ? password
                    : arrayBufferToBase64(
                          await window.crypto.subtle.exportKey(
                              "raw",
                              signalVerifier
                          )
                      ), // send derived verifier if logging in
                keyBundle: signup ? registrationBundle : null, // send registration bundle if signing up
            }),
            credentials: "include",
        });

        const res = await req.json();
        console.log(res);
        setCSRFToken(res.csrfToken);
        prevCsrfToken = res.csrfToken;

        // Handle response
        if (req.status !== 200) {
            console.error(
                "[ERROR][LOGIN] Failed to log in! Status: " + req.statusText
            );
            document.getElementById("login-error").innerText =
                "Failed to log in! Please try again. (" + req.statusText + ")";
            clearInterval(interval);
            document.getElementById("login-overlay").style.display = "none";

            return;
        }
        privateKeys.identityKey.pubKey = base64ToArrayBuffer(
            res.prekeyBundle.identityKey
        );

        console.log("[INFO][BOTH] Decrypting legacy private key...");
        let rsaKey;
        const [key, hkdfKey] = await createKey(password, res.salt);

        try {
            const rsaKeyRaw = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: new Uint8Array(
                        res.psswIV.match(/../g).map((h) => parseInt(h, 16))
                    ),
                },
                key,
                hexToUint8Array(res.privKey)
            );
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
            console.log("[INFO][BOTH] Legacy private key ready.");
        } catch (e) {
            console.error(
                "[ERROR][BOTH] Failed to decrypt legacy private key:",
                e
            );
            document.getElementById("login-error").innerText =
                "Failed to decrypt private key! Plesae try again or use a different browser";
            console.error(e);
            clearInterval(interval);
            document.getElementById("login-overlay").style.display = "none";
        }

        // ! SIGNAL IMPLEMENTATION CONTINUES HERE
        // Signup & login flow
        // HKDF-Expand to create separate keys for encryption and verification
        console.log(
            "[INFO][BOTH] Prepping password-derived verifier and encryption keys..."
        );
        const verifierKey = await window.crypto.subtle.deriveKey(
            {
                name: "HKDF",
                hash: "SHA-256",
                salt: hexToUint8Array(res.salt),
                info: str2ab("E2E_PASSW_VERIFIER"),
            },
            hkdfKey,
            { name: "HMAC", hash: "SHA-256", length: 256 },
            true,
            ["sign", "verify"]
        );

        const encKey = await window.crypto.subtle.deriveKey(
            {
                name: "HKDF",
                hash: "SHA-256",
                salt: hexToUint8Array(res.salt),
                info: str2ab("E2E_PASSW_ENC"),
            },
            hkdfKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );

        if (signup) {
            // Signup flow
            // Encrypt private keys before uploading
            const idkIV = crypto.getRandomValues(new Uint8Array(12));
            // const spkIV = crypto.getRandomValues(new Uint8Array(12));

            const encryptedIdentityKey = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: new Uint8Array(idkIV) },
                encKey,
                ensureArrayBuffer(privateKeys.identityKey.privKey)
            );

            // const spk = await crypto.subtle.encrypt(
            //     { name: "AES-GCM", iv: new Uint8Array(spkIV) },
            //     encKey,
            //     ensureArrayBuffer(privateKeys.signedPreKey)
            // );
            console.log(
                "[INFO][SIGNUP] Securely storing Signal Protocol private keys..."
            );
            const keyReq = await fetch(
                "http://localhost:8080/auth/upload-privkeys",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": prevCsrfToken,
                    },
                    body: JSON.stringify({
                        identityKey: arrayBufferToBase64(encryptedIdentityKey),
                        idkIV: arrayBufferToBase64(idkIV.buffer),
                        // signedPreKey: arrayBufferToBase64(spk),
                        // spkIV: arrayBufferToBase64(spkIV.buffer),
                        verifierKey: await window.crypto.subtle
                            .exportKey("raw", verifierKey)
                            .then((buf) => arrayBufferToBase64(buf)),
                    }),
                    credentials: "include",
                }
            );

            const keyRes = await keyReq.json();
            prevCsrfToken = keyRes.csrfToken;
            setCSRFToken(keyRes.csrfToken);

            if (keyReq.status !== 200) {
                console.error(
                    "[ERROR][SIGNUP] Failed to upload private keys! Status: " +
                        keyReq.statusText
                );
                document.getElementById("login-error").innerText =
                    "Failed to store private keys! Please refresh and try again. (" +
                    keyRes.error +
                    ")";
                clearInterval(interval);
                document.getElementById("login-overlay").style.display = "none";
                setCSRFToken(keyRes.csrfToken);
                return;
            }
        } else {
            // Login flow
            // Decrypt private keys from server response
            const decryptedIdentityKey = await crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: ensureArrayBuffer(res.idkIV),
                },
                encKey,
                ensureArrayBuffer(res.identityKey)
            );
            // const decryptedSignedPreKey = await crypto.subtle.decrypt(
            //     {
            //         name: "AES-GCM",
            //         iv: ensureArrayBuffer(res.spkIV),
            //     },
            //     encKey,
            //     ensureArrayBuffer(res.signedPreKey)
            // );

            privateKeys.identityKey.privKey = decryptedIdentityKey;
            // spk_key = decryptedSignedPreKey;
        }

        // Login & Signup flow
        // Registering a new device
        // Upload One-time Prekeys to server
        console.log("[INFO][BOTH] Generating keys for device registration...");

        // Generating one-time prekeys
        const OPK_COUNT = 50;

        for (let i = 0; i < OPK_COUNT; i++) {
            const prekey = await libsignal.KeyHelper.generatePreKey(i + 1);
            opk.push(prekey);
        }

        const prekeysSend = opk.map((pk) => ({
            keyId: pk.keyId,
            publicKey: arrayBufferToBase64(pk.keyPair.pubKey),
            privKey: null,
            iv: null,
        }));

        for (let i = 0; i < prekeysSend.length; i++) {
            const iv = crypto.getRandomValues(new Uint8Array(12));
            prekeysSend[i].privKey = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                encKey,
                ensureArrayBuffer(opk[i].keyPair.privKey)
            );

            prekeysSend[i].iv = arrayBufferToBase64(iv.buffer);
            prekeysSend[i].privKey = arrayBufferToBase64(
                prekeysSend[i].privKey
            );
        }

        // Generating signed prekey
        const signedPrekeyId = Math.floor(Math.random() * 1e9); // stable unique id for this prekey

        console.log(privateKeys.identityKey);
        const signedPreKey = await libsignal.KeyHelper.generateSignedPreKey(
            privateKeys.identityKey,
            signedPrekeyId
        );
        privateKeys.signedPreKey = signedPreKey;

        // Signed pre-key signature verification
        const lib = await libsignal.default(); // Returns a Curve instance object

        // Use the async verifier and treat "no throw" as valid
        let verified = false;
        try {
            // This will throw on an invalid signature (per the library implementation)
            await lib.Curve.async.verifySignature(
                privateKeys.identityKey.pubKey,
                signedPreKey.keyPair.pubKey,
                signedPreKey.signature
            );
            // If we reached here, verification succeeded
            verified = true;
        } catch (err) {
            console.error(
                "[ERROR][SIGNUP] Signature verification failed:",
                err
            );
            verified = false;
        }

        console.log(
            "[INFO][BOTH] Key validation result: " +
                verified +
                ". Registering device..."
        );
        if (!verified) {
            console.error(
                "[ERROR][BOTH] Key signature verification failed. Keys need to be regenerated."
            );
            document.getElementById("login-error").innerText =
                "Failed to securely create your account! Signature verification failed.";
            return;
        }

        const registrationReq = await fetch(
            "http://localhost:8080/auth/register-device",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": prevCsrfToken,
                },
                body: JSON.stringify({
                    prekeys: prekeysSend,
                    spkId: signedPrekeyId,
                    spkPubKey: arrayBufferToBase64(signedPreKey.keyPair.pubKey),
                    spkSignature: arrayBufferToBase64(signedPreKey.signature),
                    identityKey: arrayBufferToBase64(
                        privateKeys.identityKey.pubKey
                    ),
                }),
                credentials: "include",
            }
        );

        const registrationRes = await registrationReq.json();
        if (registrationReq.status !== 200) {
            console.error(
                "[ERROR][BOTH] Failed to register device! Status: " +
                    registrationReq.statusText
            );
            document.getElementById("login-error").innerText =
                "Failed to register device! Please refresh and try again. (" +
                registrationRes.error +
                ")";
            clearInterval(interval);
            document.getElementById("login-overlay").style.display = "none";
            setCSRFToken(registrationRes.csrfToken);
            return;
        }

        setCSRFToken(registrationRes.csrfToken);
        prevCsrfToken = registrationRes.csrfToken;

        // Persist current deviceId for selecting ciphertexts on this client
        try {
            if (registrationRes.deviceId) {
                localStorage.setItem("deviceId", String(registrationRes.deviceId));
            }
        } catch (_) {}

        // Store keys in adiStore (for libsignal)
        adiStore.putIdentityKeyPair({
            privKey: ensureArrayBuffer(privateKeys.identityKey.privKey),
            // privateKeys only stores the private key; we get the public key from server response.
            pubKey: ensureArrayBuffer(res.prekeyBundle.identityKey),
        });

        adiStore.putLocalRegistrationId(res.prekeyBundle.registrationId);

        adiStore.storeSignedPreKey(privateKeys.signedPreKey.keyId, {
            privKey: ensureArrayBuffer(
                privateKeys.signedPreKey.keyPair.privKey
            ),
            pubKey: ensureArrayBuffer(privateKeys.signedPreKey.keyPair.pubKey),
            signature: ensureArrayBuffer(privateKeys.signedPreKey.signature),
            keyId: privateKeys.signedPreKey.keyId,
        });

        // for (let i = 0; i < res.oneTimePreKeys.length; i++) {
        //     const opk = res.oneTimePreKeys[i];

        //     const privOpk = await crypto.subtle.decrypt(
        //         {
        //             name: "AES-GCM",
        //             iv: ensureArrayBuffer(opk.iv),
        //         },
        //         encKey,
        //         ensureArrayBuffer(opk.privKey)
        //     );

        //     adiStore.storePreKey(opk.keyId, {
        //         privKey: ensureArrayBuffer(privOpk),
        //         pubKey: ensureArrayBuffer(opk.publicKey),
        //         keyId: opk.keyId,
        //     });
        // }
        console.log(opk);
        for (let i = 0; i < opk.length; i++) {
            const opki = opk[i];
            // const privOpk = await crypto.subtle.decrypt(
            //     {
            //         name: "AES-GCM",
            //         iv: ensureArrayBuffer(opk.iv),
            //     },
            //     encKey,
            //     ensureArrayBuffer(opk.privKey)
            // );

            adiStore.storePreKey(opki.keyId, {
                privKey: ensureArrayBuffer(opki.keyPair.privKey),
                pubKey: ensureArrayBuffer(opki.keyPair.pubKey),
                keyId: opki.keyId,
            });
        }
        // TODO: you left here. bad mac error solved. finish message receiving.

        // ! SIGNAL IMPLEMENTATION STOPS HERE

        // Setup service worker with decrypted RSA key
        const serviceWorkerSetup = () => {
            // Set service worker (legacy RSA key for now)
            navigator.serviceWorker.getRegistration("/").then((reg) => {
                reg.active.postMessage({
                    test: "test",
                });
            });

            try {
                if ("serviceWorker" in navigator) {
                    if (!rsaKey) {
                        console.error(
                            "[ERROR][LOGIN] Cannot proceed. Legacy private key is undefined."
                        );
                        document.getElementById("login-error").innerText =
                            "Failed to decrypt private key! Please try again or use a different browser";
                        clearInterval(interval);
                        document.getElementById("login-overlay").style.display =
                            "none";

                        setCSRFToken(res.csrfToken);
                        return;
                    }

                    // Listen for response
                    const messageHandler = (event) => {
                        if (event.data.type === "success") {
                            console.log(
                                "[INFO][LOGIN] Key setup successful in Service Worker."
                            );
                            navigator.serviceWorker.controller.removeEventListener(
                                "message",
                                messageHandler
                            );
                            clearInterval(interval);
                            console.log(
                                "[INFO][LOGIN] Process complete. Redirecting..."
                            );

                            localStorage.setItem("isAuthenticated", true);
                            window.location.href = `/${
                                searchParams.get("redirect")
                                    ? searchParams.get("redirect")
                                    : "home"
                            }`;
                        } else {
                            console.log(
                                "[ERROR][LOGIN] Key setup failed in Service Worker"
                            );
                        }
                    };

                    navigator.serviceWorker.addEventListener(
                        "message",
                        messageHandler
                    );

                    navigator.serviceWorker
                        .register("/sw.js")
                        .then(async (reg) => {
                            reg.active.postMessage({
                                type: "setKey",
                                key: rsaKey,
                            });
                        });
                    console.log(
                        "[INFO][LOGIN] Service Worker registered. Awaiting key setup..."
                    );
                    return;
                } else {
                    throw new Error("Service Worker not supported");
                }
            } catch (e) {
                console.error(e);
                document.getElementById("login-error").innerText =
                    "Failed to securely set private key! Please try again or use a different browser";
                clearInterval(interval);
                document.getElementById("login-overlay").style.display = "none";

                setCSRFToken(res.csrfToken);
            }
        };
        serviceWorkerSetup();
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
