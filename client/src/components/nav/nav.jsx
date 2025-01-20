import React from "react";
import "./nav.css";

export default function Nav({
    active = false,
    msg_count = 0,
    friends_count = 0,
}) {
    return (
        <div className="nav-container">
            <div className="nav">
                <h2 className="logo pixel-font">Cyber Netwire</h2>
                <div className="nav-chooser">
                    <a href="/app/dashboard">
                        <h2
                            className={
                                active === 1 ? "nav-value active" : "nav-value"
                            }
                        >
                            Home
                        </h2>
                    </a>
                    <div className="nav-group">
                        <a href="/app/msg">
                            <h2
                                className={
                                    active === 2
                                        ? "nav-value active"
                                        : "nav-value"
                                }
                            >
                                Messages
                            </h2>
                        </a>
                        {msg_count > 0 && (
                            <div className="msg-count">{msg_count}</div>
                        )}
                    </div>
                    <div className="nav-group">
                        <a href="/app/friends">
                            <h2
                                className={
                                    active === 3
                                        ? "nav-value active"
                                        : "nav-value"
                                }
                            >
                                Friends
                            </h2>
                        </a>
                        {friends_count > 0 && (
                            <div className="msg-count">{friends_count}</div>
                        )}
                    </div>
                    <a href="/app/settings">
                        <h2
                            className={
                                active === 4 ? "nav-value active" : "nav-value"
                            }
                        >
                            Settings
                        </h2>
                    </a>
                </div>
                <h2
                    className="logo pixel-font"
                    style={{ visibility: "hidden" }}
                >
                    Cyber Netwire
                </h2>
            </div>
            <hr className="nav-hr" />
        </div>
    );
}
