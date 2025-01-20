import React from "react";

import "./boolean.css";

export default function Boolean({
    text,
    id,
    checked1,
    checked2,
    onChange = () => {},
}) {
    return (
        <div className="boolean">
            <div className="boolean-label">
                <p>{text}</p>
            </div>
            <div className="boolean-answers">
                <input
                    type="radio"
                    id={id + "-1"}
                    defaultChecked={checked2}
                    onChange={onChange}
                    name={id + "-0"}
                    className="radio false"
                />
                <label htmlFor={id + "-1"} className="false">
                    N
                </label>

                <input
                    type="radio"
                    id={id + "-0"}
                    defaultChecked={checked1}
                    onChange={onChange}
                    name={id + "-0"}
                    className="radio true"
                />
                <label htmlFor={id + "-0"} className="true">
                    Y
                </label>
            </div>
        </div>
    );
}
