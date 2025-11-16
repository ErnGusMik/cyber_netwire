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

    const handleEncryptAnimation = () => {
        for (let i = 1; i <= 4; i++) {
            const animContent1 = document.getElementById(
                "encrypt-anim-content-" + i
            );
            const content1 = animContent1.textContent;

            animContent1.classList.add("anim-ended");

            // hacking effect -- letters change (for every character) for 3s, reveal real text one character at a time
            let revealIndex = 0;
            const interval = setInterval(() => {
                let displayedText = "";
                for (let i = 0; i < content1.length; i++) {
                    if (i < revealIndex) {
                        displayedText += content1[i];
                    } else {
                        const randomChar = String.fromCharCode(
                            33 + Math.floor(Math.random() * 94)
                        );
                        displayedText += randomChar;
                    }
                }
                animContent1.textContent = displayedText;
                revealIndex++;
                if (revealIndex > content1.length) {
                    clearInterval(interval);
                    animContent1.textContent = content1;
                }
            }, 100);

            // add active class to status overlay to expand it after 2.5s
            setTimeout(() => {
                const statusOverlay1 =
                    animContent1.parentElement.querySelector(".status-overlay");
                statusOverlay1.classList.add("active");
            }, 2500);
        }

        for (let i = 1; i <= 4; i++) {
            const animContent1 = document.getElementById(
                "encrypt-anim-fail-content-" + i
            );

            // generate a random string the same length as the original content
            let content1 = "";
            for (let j = 0; j < animContent1.textContent.length; j++) {
                const randomChar = String.fromCharCode(
                    33 + Math.floor(Math.random() * 94)
                );
                content1 += randomChar;
            }

            animContent1.classList.add("anim-ended");

            // hacking effect -- letters change (for every character) for 3s, reveal real text one RANDOM character at a time
            let revealIndex = 0;
            const interval = setInterval(() => {
                let displayedText = "";
                for (let i = 0; i < content1.length; i++) {
                    if (i < revealIndex) {
                        displayedText += content1[i];
                    } else {
                        const randomChar = String.fromCharCode(
                            33 + Math.floor(Math.random() * 94)
                        );
                        displayedText += randomChar;
                    }
                }
                animContent1.textContent = displayedText;
                revealIndex++;
                if (revealIndex > content1.length) {
                    clearInterval(interval);
                    animContent1.textContent = displayedText;
                }
            }, 100);

            // add active class to status overlay to expand it after 2.5s
            setTimeout(() => {
                const statusOverlay1 =
                    animContent1.parentElement.querySelector(".status-overlay");
                statusOverlay1.classList.add("active");
            }, 2500);
        }
    };

    const handleConnectionsAnimation = () => {
        const scrollCont = document.querySelectorAll(
            ".homepage .connections .scroll-cont"
        );

        scrollCont.forEach((cont) => {
            cont.innerHTML = "";
            const textItem = document.createElement("span");
            textItem.classList.add("text-item");
            textItem.innerHTML = "Instant Connections";
            for (let i = 0; i < 5; i++) {
                const clone = textItem.cloneNode(true);
                cont.appendChild(clone);
            }
            cont.appendChild(textItem);
        });
    };

    React.useEffect(() => {
        // when scroll into view, trigger encryption animation
        const encryptSection = document.querySelector(".homepage .encryption");
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        handleEncryptAnimation();
                        observer.unobserve(encryptSection);
                    }
                });
            },
            { threshold: 0.5 }
        );
        observer.observe(encryptSection);

        // trigger connections animation
        handleConnectionsAnimation();
    }, []);

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
                        <p className="module-name primary">
                            /// .SUBMODULE.$INTERFACE
                        </p>
                        <img
                            src="./interface.png"
                            alt="Image of the product's user interface"
                        />
                    </div>
                    <hr />
                    <div className="text">
                        <h2>An interface that glows</h2>
                        <hr />
                        <p className="tertiary">
                            Navigate with style through our neon-drenched design
                        </p>
                    </div>
                </div>
            </div>
            <div className="encryption">
                <p className="module-name tertiary">/// .SUBMODULE.$SECURITY</p>
                <hr />
                <div className="content">
                    <div className="anim-text">
                        <div className="anim-line">
                            <span className="primary" id="encrypt-anim-tag-1">
                                wifey123
                            </span>
                            <p id="encrypt-anim-content-1">
                                John, did you buy milk?
                            </p>
                            <div className="status-overlay">
                                <i className="fa-solid fa-lock-open"></i>
                                <h6>Breached</h6>
                            </div>
                        </div>
                        <div className="anim-line">
                            <span className="primary" id="encrypt-anim-tag-2">
                                agent007
                            </span>
                            <p id="encrypt-anim-content-2">
                                Meet at the gas station.
                            </p>
                            <div className="status-overlay">
                                <i className="fa-solid fa-lock-open"></i>
                                <h6>Breached</h6>
                            </div>
                        </div>
                        <div className="anim-line">
                            <span className="primary" id="encrypt-anim-tag-3">
                                !12john91
                            </span>
                            <p id="encrypt-anim-content-3">
                                I'm a whistleblower
                            </p>
                            <div className="status-overlay">
                                <i className="fa-solid fa-lock-open"></i>
                                <h6>Breached</h6>
                            </div>
                        </div>
                        <div className="anim-line">
                            <span className="primary" id="encrypt-anim-tag-4">
                                ben_dover
                            </span>
                            <p id="encrypt-anim-content-4">sussy 6 7 l-bozo</p>
                            <div className="status-overlay">
                                <i className="fa-solid fa-lock-open"></i>
                                <h6>Breached</h6>
                            </div>
                        </div>
                    </div>
                    <div
                        className="main"
                        id="home-encrypt-backg"
                        onMouseMove={handleEncryptionMouseMove}
                    >
                        <div className="main-backg">
                            <h2 className="secondary text-shadow-secondary">
                                Top-tier encryption
                            </h2>
                            <hr className="content-hr" />
                            <p className="tertiary">
                                Your privacy is our priority: <br />
                                stay secure in the urban jungle
                            </p>
                        </div>
                    </div>
                    <div className="anim-text anim-text-fail">
                        <div className="anim-line">
                            <span
                                className="primary"
                                id="encrypt-anim-fail-tag-1"
                            >
                                wifey123
                            </span>
                            <p id="encrypt-anim-fail-content-1">
                                John, did you buy milk?
                            </p>
                            <div className="status-overlay">
                                <i className="fa-solid fa-lock"></i>
                                <h6>Failed</h6>
                            </div>
                        </div>
                        <div className="anim-line">
                            <span
                                className="primary"
                                id="encrypt-anim-fail-tag-2"
                            >
                                agent007
                            </span>
                            <p id="encrypt-anim-fail-content-2">
                                Meet at the gas station.
                            </p>
                            <div className="status-overlay">
                                <i className="fa-solid fa-lock"></i>
                                <h6>Failed</h6>
                            </div>
                        </div>
                        <div className="anim-line">
                            <span
                                className="primary"
                                id="encrypt-anim-fail-tag-3"
                            >
                                !12john91
                            </span>
                            <p id="encrypt-anim-fail-content-3">
                                I'm a whistleblower
                            </p>
                            <div className="status-overlay">
                                <i className="fa-solid fa-lock"></i>
                                <h6>Failed</h6>
                            </div>
                        </div>
                        <div className="anim-line">
                            <span
                                className="primary"
                                id="encrypt-anim-fail-tag-4"
                            >
                                ben_dover
                            </span>
                            <p id="encrypt-anim-fail-content-4">
                                sussy 6 7 l-bozo
                            </p>
                            <div className="status-overlay">
                                <i className="fa-solid fa-lock"></i>
                                <h6>Failed</h6>
                            </div>
                        </div>
                    </div>
                </div>
                <hr />
            </div>
            <div className="connections">
                <p className="module-name secondary">/// .SUBMODULE.$CONNECT</p>
                <div className="main">
                    {/* infinite horizontal scroll of the text 'instant connections' multiple times */}
                    <div className="text-cont">
                        <div className="inf-scroll-cont">
                            <div className="scroll-cont"></div>
                            <div className="scroll-cont"></div>
                        </div>
                    </div>
                    <div className="additional-text">
                        <p className="tertiary additional-text">
                            Stream through your conversations with lightning
                            fast performance
                        </p>
                    </div>
                </div>
            </div>
            <div className="more">
                <h2 className="secondary">And There's More</h2>
                <p className="module-name secondary">/// .SUBMODULE.$MORE</p>
                <hr />
                <div className="content">
                    <div className="feature-card">
                        <span className="keyword">_Online</span>
                        <img src="more_online.png" alt="Image showing online users" />
                        <p className="tertiary">Always see who's around</p>
                    </div>
                    <div className="feature-card">
                        <span className="keyword">_Discover</span>
                        <img src="more_discover.png" alt="Image showing user feeds" />
                        <p className="tertiary">Discover user created feeds</p>
                    </div>
                    <div className="feature-card">
                        <span className="keyword">_Create</span>
                        <img src="more_create.png" alt="Image showing feed creation" />
                        <p className="tertiary">Create & secure your feeds and DMs</p>
                    </div>
                </div>
                <hr />
            </div>
            <div className="join">
                <p className="module-name">/// MODULE._GET_STARTED</p>
                <div className="content">
                    <div className="text">
                        <h2 className="secondary">You can't scroll anymore.</h2>
                        <h2>Better go hang out.</h2>
                    </div>
                    <a href="/auth">
                        <button className="btn">
                            <h3>Join the revolution</h3>
                        </button>
                    </a>
                </div>
            </div>
            <div className="footer">
                <p className="module-name tertiary">/// MODULE._FOOTER</p>
                <hr />
                <div className="sitemap">
                    <ul>
                        <li>
                            <a href="">About</a>
                        </li>
                        <li>
                            <a href="">Status</a>
                        </li>
                        <li>
                            <a href="">Support</a>
                        </li>
                        <li>
                            <a href="">Terms of Use & Privacy Policy</a>
                        </li>
                        <li>
                            <a href="">EN</a>
                        </li>
                    </ul>
                </div>
                <hr />
                <div className="content">
                    <div className="copyright">
                        <h4>Cyber Netwire</h4>
                        <p className="tertiary">Copyright &copy; 2025 ernestsgm.</p>
                    </div>
                    <a href="/auth">
                        <button className="btn">
                            <h3>Open Cyber Netwire</h3>
                        </button>
                    </a>
                </div>
            </div>
        </div>
    );
}
