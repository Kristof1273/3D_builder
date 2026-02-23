import React, { useState } from 'react';

const NewProjectModal = ({ onClose, onCreate }) => {
    const [projectName, setProjectName] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault(); // Ne töltse újra az oldalt
        if (projectName.trim()) {
            onCreate(projectName);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h3>NEW PROJECT</h3>
                    <button onClick={onClose} style={styles.closeHeaderBtn}>✕</button>
                </div>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <label style={styles.label}>Project Name:</label>
                    <input
                        type="text"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="Project name"
                        style={styles.input}
                        autoFocus
                    />

                    <div style={styles.actions}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={styles.cancelBtn}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={styles.createBtn}
                        >
                            CREATE
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Ugyanaz a stílus, mint a Load ablaknál
const styles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex',
        justifyContent: 'center', alignItems: 'center', zIndex: 2000,
        backdropFilter: 'blur(3px)'
    },
    modal: {
        backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '4px',
        width: '350px', color: '#eee', border: '1px solid #444',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px'
    },
    closeHeaderBtn: {
        background: 'none', border: 'none', color: '#888',
        fontSize: '1.2em', cursor: 'pointer'
    },
    form: { display: 'flex', flexDirection: 'column', gap: '15px' },
    label: { fontSize: '0.9em', color: '#aaa' },
    input: {
        padding: '10px', backgroundColor: '#333', border: '1px solid #555',
        color: 'white', borderRadius: '2px', outline: 'none', fontSize: '1em'
    },
    actions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' },

    // Gombok
    createBtn: {
        backgroundColor: '#1a1a1a', // Fekete (nagyon sötét szürke)
        color: 'white',
        border: '1px solid #444', // Vékony keret
        padding: '8px 20px', cursor: 'pointer', fontWeight: 'bold',
        borderRadius: '2px', fontSize: '0.9em'
    },
    cancelBtn: {
        backgroundColor: 'transparent', color: '#888', border: '1px solid #444',
        padding: '8px 15px', cursor: 'pointer',
        borderRadius: '2px', fontSize: '0.9em'
    }
};

export default NewProjectModal;