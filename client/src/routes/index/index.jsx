import React from "react";
import "./index.css";

export default function Index() {

    const handleEncryptionMouseMove = (e) => {
        const encryptBackg = document.getElementById("home-encrypt-backg");
        const rect = encryptBackg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        encryptBackg.style.setProperty("--cursor-x", `${x}px`);
        encryptBackg.style.setProperty("--cursor-y", `${y}px`);
    };

    return (
        <div className="homepage">
            <div className="nav">
                <ul>
                    <li>
                        <a href="">Features</a>
                    </li>
                    <li>
                        <a href="">About</a>
                    </li>
                    <li>
                        <a href="">More</a>
                    </li>
                    <li>
                        <a href="/auth">Log in</a>
                    </li>
                    <li className="nav-emphasis">
                        <a href="/auth">Sign up</a>
                    </li>
                </ul>
            </div>
            <div className="banner">
                <div className="banner-text">
                    <div className="cta">
                        <h2>Ignite</h2>
                        <h1>Your messaging</h1>
                    </div>
                    <p>
                        Join Cyber Netwire for a chat experience thats as
                        electrifying as the neon skyline. <br />
                        Secure, fast, and dazzling.
                    </p>
                    <a href="/auth">
                        <button className="btn">
                            <h3>Join the revolution</h3>
                        </button>
                    </a>
                </div>
                <img
                    src="img-placeholder.webp"
                    alt="A banner pic will go here at some point"
                />
            </div>
            <div className="interface">
                <div className="transition">
                    <p className="module-name">/// MODULE._FEATURES_MAIN</p>
                    <h2>Welcome to the Future</h2>
                    <hr />
                </div>
                <div className="content">
                    <div className="image">
                        <p className="module-name primary">/// .SUBMODULE.$INTERFACE</p>
                        <img src="./interface.png" alt="Image of the product's user interface" />
                    </div>
                    <hr />
                    <div className="text">
                        <h2>An interface that glows</h2>
                        <hr />
                        <p className="tertiary">Navigate with style through our neon-drenched design</p>
                    </div>
                </div>
            </div>
            <div className="encryption">
                <p className="module-name tertiary">/// .SUBMODULE.$SECURITY</p>
                <hr />
                <div className="content">
                    <div className="anim-text"></div>
                    <div className="main" id="home-encrypt-backg" onMouseMove={handleEncryptionMouseMove}>
                        <div className="main-backg">
                            <h2 className="secondary text-shadow-secondary">Top-tier encryption</h2>
                            <hr className="content-hr"/>
                            <p className="tertiary">Your privacy is our priority: <br />stay secure in the urban jungle</p>
                        </div>
                    </div>
                    <div className="anim-text"></div>
                </div>
                <hr />
            </div>
        </div>
    );
}
