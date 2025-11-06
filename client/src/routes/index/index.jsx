import React from "react";
import './index.css';

export default function Index() {
    return (
        <div className="homepage">
            <div className="nav">
                <ul>
                    <li><a href="">Features</a></li>
                    <li><a href="">About</a></li>
                    <li><a href="">More</a></li>
                    <li><a href="/auth">Log in</a></li>
                    <li className="nav-emphasis"><a href="/auth">Sign up</a></li>
                </ul>
            </div>
            <div className="banner">
                <div className="banner-text">
                    <div className="cta">
                        <h2>Ignite</h2>
                        <h1>Your messaging</h1>
                    </div>
                    <p>Join Cyber Netwire for a chat experience thats as electrifying as the neon skyline. <br />Secure, fast, and dazzling.</p>
                    <a href="/auth"><button className="btn"><h3>Join the revolution</h3></button></a>
                </div>
                <img src="img-placeholder.webp" alt="A banner pic will go here at some point" />
            </div>
            <div className="interface">
                <div className="transition">
                    <p>/// MODULE._FEATURES_MAIN</p>
                </div>
                <h2>Welcome to the Future</h2>
                <hr />
                
            </div>
        </div>
    )
}