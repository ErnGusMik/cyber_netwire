import React from "react";
import "./button.css";

export default function Button ({ text, onClick=()=>{}, id, narrow=false }) {
    return (
        <button className={narrow ? "button narrow" : "button"} onClick={onClick} id={id}>
                {text}
        </button>
    );
};
