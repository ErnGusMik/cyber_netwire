import React from "react";

import "./profile.css";
import { redirect } from "react-router-dom";


export default function Profile({ loaderData }) {
    const [displayName, setDisplayName] = React.useState("Loading...");
    const [userNo, setUserNo] = React.useState("1234");
    const initStatusChange = (e) => {
        const overlay = document.querySelector(".overlay");
        overlay.style.display = "flex";
    };

    const handleStatusChange = async (val) => {
        const req = await fetch("https://ernestsgm.com/api/status", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                status: val,
            }),
            credentials: "include",
        })

        const res = await req.json();

        if (req.status != 200) {
            console.error(res.error);
        } else {
            const statusIcon = document.getElementById("user-status-icon");
            const statusText = document.getElementById("user-status");

            statusIcon.classList.remove("online", "idle", "offline");
            statusIcon.classList.add(val);
            statusText.textContent = val.charAt(0).toUpperCase() + val.slice(1);

            const overlay = document.querySelector(".overlay");
            overlay.style.display = "none";
        }
    };

    React.useEffect(() => {
        const getStatus = async () => {
            const req = await fetch("https://ernestsgm.com/api/status", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
            });

            const res = await req.json();

            if (!req.ok) {
                console.error(res.error);
                if (req.status === 401) {
                    return false
                }
            } else {
                let status = res.status;
                const statusIcon = document.getElementById("user-status-icon");
                const statusText = document.getElementById("user-status");

                statusIcon.classList.remove("online", "idle", "offline");
                switch (status) {
                    case 1:
                        status = "online";
                        break;
                    case 2:
                        status = "idle";
                        break;
                    default:
                        status = "offline";
                        break;
                };
                statusIcon.classList.add(status);
                statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
                setDisplayName(res.display_name);
                setUserNo(String(res.user_no).padStart(4, '0'));
                return true
            }
        };

        getStatus().then((res) => {
            if (!res) {
                localStorage.removeItem("isAuthenticated");
                console.error("User is not authenticated");
                console.log(res)
            }
        });
    }, []);

    return (
        <section className="profile">
            <h3 className="pixel-font primary">{displayName}</h3><span>#{userNo}</span>
            <div className="status-bar">
                <div className="status">
                    <span className="status-circle offline" id="user-status-icon"></span>
                    <p className="secondary" id="user-status">Offline</p>
                </div>
                <div className="status-changer" onClick={initStatusChange}>
                    <i className="fa-solid fa-arrow-rotate-left" />
                </div>
            </div>
            <div className="overlay">
                <div className="overlay-content">
                    <h2>Choose your status</h2>
                    <div className="status-options">
                        <div className="status-option" onClick={() => handleStatusChange('online')}>
                            <span className="status-circle online"></span>
                            <p className="secondary">Online</p>
                        </div>
                        <div className="status-option" onClick={() => handleStatusChange('idle')}>
                            <span className="status-circle idle"></span>
                            <p className="secondary">Idle</p>
                        </div>
                        <div className="status-option" onClick={() => handleStatusChange('offline')}>
                            <span className="status-circle offline"></span>
                            <p className="secondary">Offline</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
