import React from 'react';
import './input.css';

export default function Input({ label, placeholder="", value, id, onChange = () => {}, type = "text", textarea=false }) {
        return (
                <div className="input-container">
                        <div className="label-container">
                        <label className="input-label" htmlFor={id} >{label}</label>
                        <span className="triangle"></span>
                        </div>
                        {!textarea &&
                        <input
                                type={type}
                                className="input"
                                placeholder={placeholder}
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                id={id}
                        />
                        }
                        {textarea &&
                        <textarea
                                className="input"
                                placeholder={placeholder}
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                id={id}
                        />
                        }
                </div>
        )
}