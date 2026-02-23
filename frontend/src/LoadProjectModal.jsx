import React, { useState, useEffect } from 'react';

const LoadProjectModal = ({ onClose, onLoad }) => {
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        fetch('http://localhost:8080/api/projects')
            .then(res => res.json())
            .then(data => setProjects(data))
            .catch(err => console.error("Failed to load projects:", err));
    }, []);

    // Törlés kezelése
    const handleDelete = (id) => {
        if (window.confirm("Are you sure you want to delete this project?")) {
            fetch(`http://localhost:8080/api/projects/${id}`, { method: 'DELETE' })
                .then(() => setProjects(projects.filter(p => p.id !== id)))
                .catch(err => console.error("Failed to delete:", err));
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h3>SAVED PROJECTS</h3>
                    <button onClick={onClose} style={styles.closeHeaderBtn}>✕</button>
                </div>

                {projects.length === 0 ? (
                    <p style={{color: '#888', textAlign: 'center'}}>No saved projects yet.</p>
                ) : (
                    <ul style={styles.list} className="dark-scrollbar">
                        {projects.map(proj => (
                            <li key={proj.id} style={styles.listItem}>
                                <div style={styles.info}>
                                    <strong style={{fontSize: '1.1em'}}>{proj.name}</strong>
                                    <small style={{color: '#666', display: 'block', fontSize: '0.8em'}}>
                                        {new Date(proj.createdAt).toLocaleDateString()}
                                    </small>
                                </div>

                                <div style={styles.actions}>
                                    <button
                                        onClick={() => onLoad(proj.id, proj.name)}
                                        style={styles.loadBtn}
                                        title="Load Project"
                                    >
                                        LOAD
                                    </button>

                                    <button
                                        onClick={() => handleDelete(proj.id)}
                                        style={styles.deleteBtn}
                                        title="Delete Project"
                                    >
                                        DELETE
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

// Fekete-Fehér Minimalista Stílusok
const styles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex',
        justifyContent: 'center', alignItems: 'center', zIndex: 2000,
        backdropFilter: 'blur(3px)'
    },
    modal: {
        backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '4px',
        width: '450px', color: '#eee', border: '1px solid #444',
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
    list: { listStyle: 'none', padding: 0, margin: 0, maxHeight: '300px', overflowY: 'auto' },
    listItem: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '15px 10px', borderBottom: '1px solid #2a2a2a'
    },
    info: { flex: 1 },
    actions: { display: 'flex', gap: '10px' },

    // Gombok stílusa (Fekete/Fehér/Szürke)
    loadBtn: {
        backgroundColor: '#1a1a1a', // Fekete
        color: 'white',
        border: '1px solid #444', // Vékony keret
        padding: '6px 15px', cursor: 'pointer', fontWeight: 'bold',
        borderRadius: '2px', fontSize: '0.8em'
    },
    deleteBtn: {
        backgroundColor: 'transparent', color: '#666', border: '1px solid #444',
        padding: '6px 12px', cursor: 'pointer',
        borderRadius: '2px', fontSize: '0.8em', transition: 'all 0.2s'
    }
};

export default LoadProjectModal;