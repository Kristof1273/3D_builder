import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Client } from '@stomp/stompjs';
import { ChromePicker } from 'react-color';
import './App.css';
import LoadProjectModal from './LoadProjectModal';
import NewProjectModal from './NewProjectModal';

// =========================================
// 1. KÜLÖN KOMPONENSEK
// =========================================

// =========================================
// ÚJ KÖZÖS KOMPONENS: MOZGATHATÓ ABLAK
// =========================================
const DraggableWindow = ({ title, windowKey, positions, onMove, onClose, zIndex, onFocus, children, width = '500px' }) => {
    const [isMinimized, setIsMinimized] = useState(false);

    // Mozgatás logika
    const handleMouseDown = (e) => {
        e.stopPropagation();
        onFocus(windowKey); // Előtérbe hozzuk

        const startX = e.clientX - positions[windowKey].x;
        const startY = e.clientY - positions[windowKey].y;

        const handleMouseMove = (moveEvent) => {
            onMove(windowKey, moveEvent.clientX - startX, moveEvent.clientY - startY);
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            className="draggable-window"
            onMouseDown={() => onFocus(windowKey)}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
                left: positions[windowKey]?.x || 100,
                top: positions[windowKey]?.y || 100,
                zIndex: zIndex,
                width: width,
                height: isMinimized ? 'auto' : 'auto' // Ha le van csukva, csak a fejléc látszik
            }}
        >
            {/* FEJLÉC */}
            <div className="window-header" onMouseDown={handleMouseDown}>
                <span className="window-title">{title}</span>
                <div className="window-controls">
                    {/* MINIMIZE GOMB (_) */}
                    <button
                        className="window-btn minimize"
                        onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                        title={isMinimized ? "Expand" : "Minimize"}
                    >
                        {isMinimized ? "□" : "−"}
                    </button>

                    {/* CLOSE GOMB (X) */}
                    <button
                        className="window-btn close"
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        title="Close"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* TARTALOM (Csak akkor látszik, ha nincs lekicsinyítve) */}
            {!isMinimized && (
                <div className="window-content-wrapper">
                    {children}
                </div>
            )}
        </div>
    );
};

// Ezt tedd az App függvénybe a többi függvény közé
const handleWindowMove = (key, x, y) => {
    setPositions(prev => ({
        ...prev,
        [key]: { x, y }
    }));
};

const TimelineClipItem = ({ clip, maxTime, onUpdate, onDelete }) => {
    const [isRenaming, setIsRenaming] = useState(false);
    const [tempName, setTempName] = useState(clip.name);
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const startPercent = (clip.startTime / maxTime) * 100;
    const widthPercent = ((clip.endTime - clip.startTime) / maxTime) * 100;

    const handleRenameSubmit = () => {
        setIsRenaming(false);
        if (tempName !== clip.name) {
            onUpdate(clip.id, tempName, clip.startTime, clip.endTime);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleRenameSubmit();
        if (e.key === 'Escape') {
            setTempName(clip.name);
            setIsRenaming(false);
        }
    };

    // --- TÖRLÉS KEZELÉSE ---
    const handleDeleteClick = (e) => {
        e.stopPropagation(); // Ne induljon el a drag
        // Opcionális: megerősítés kérése
        if (window.confirm(`Delete clip "${clip.name}"?`)) {
            onDelete(clip.id);
        }
    };

    // --- ÁTMÉRETEZÉS (RESIZE) ---
    const handleResizeMouseDown = (e, direction) => {
        e.stopPropagation();

        const startX = e.clientX;
        const originalStart = clip.startTime;
        const originalEnd = clip.endTime;
        // -65 a padding és label miatt (App.css-hez igazítva)
        const trackWidth = e.target.closest('.timeline-tracks-area').getBoundingClientRect().width - 65;

        const handleMouseMove = (moveEvent) => {
            const deltaPixels = moveEvent.clientX - startX;
            const deltaSeconds = (deltaPixels / trackWidth) * maxTime;

            let newStart = originalStart;
            let newEnd = originalEnd;

            if (direction === 'left') {
                newStart += deltaSeconds;
                if (newStart < 0) newStart = 0;
                if (newStart >= newEnd - 0.1) newStart = newEnd - 0.1;
            } else if (direction === 'right') {
                newEnd += deltaSeconds;
                if (newEnd <= newStart + 0.1) newEnd = newStart + 0.1;
            }
            onUpdate(clip.id, tempName, newStart, newEnd);
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // --- MOZGATÁS (DRAG) ---
    const handleDragMouseDown = (e) => {
        if (isRenaming) return;
        e.stopPropagation();

        setIsDragging(true);

        const startX = e.clientX;
        const originalStart = clip.startTime;
        const originalEnd = clip.endTime;
        const duration = originalEnd - originalStart;
        const trackWidth = e.target.closest('.timeline-tracks-area').getBoundingClientRect().width - 65;

        const handleMouseMove = (moveEvent) => {
            const deltaPixels = moveEvent.clientX - startX;
            const deltaSeconds = (deltaPixels / trackWidth) * maxTime;

            let newStart = originalStart + deltaSeconds;
            if (newStart < 0) newStart = 0;
            let newEnd = newStart + duration;

            onUpdate(clip.id, tempName, newStart, newEnd);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            className={`timeline-clip-block ${isDragging ? 'dragging' : ''}`}
            style={{
                left: `${startPercent}%`,
                width: `${widthPercent}%`,
                backgroundColor: clip.type === 'MOVE' ? '#007bff' : '#ff9900',
                cursor: isRenaming ? 'text' : (isDragging ? 'grabbing' : 'grab')
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onDoubleClick={() => setIsRenaming(true)}
            onMouseDown={handleDragMouseDown}
        >
            <div className="resize-handle left" onMouseDown={(e) => handleResizeMouseDown(e, 'left')}></div>

            <div className="clip-content">
                {isRenaming ? (
                    <input
                        className="rename-input"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onBlur={handleRenameSubmit}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        onMouseDown={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="clip-name">{clip.name}</span>
                )}
            </div>

            {/* TÖRLÉS GOMB (X) */}
            <button
                className="delete-clip-btn"
                onClick={handleDeleteClick}
                title="Delete Clip"
            >
                ✕
            </button>

            <div className="resize-handle right" onMouseDown={(e) => handleResizeMouseDown(e, 'right')}></div>

            {(isHovered || isDragging) && !isRenaming && (
                <>
                    <div className="time-tooltip start">{clip.startTime.toFixed(2)}s</div>
                    <div className="time-tooltip end">{clip.endTime.toFixed(2)}s</div>
                </>
            )}
        </div>
    );
};






// Külön komponens egy sorhoz, hogy a gépelés (input state) ne akadjon
const PointRow = ({ point, onMove, onColorChange, onDelete }) => {
    // Helyi state a szerkesztéshez
    const [coords, setCoords] = useState({ x: point.x, y: point.y, z: point.z });

    // Segédfüggvény: Ha a szerverről név jön (pl. "red"), konvertáljuk vagy adjunk alapértelmezett HEX-et
    // Az input type="color" CSAK a hétjegyű HEX kódot fogadja el (#ffffff)
    const formatToHex = (colorStr) => {
        if (!colorStr) return "#ffa500"; // Alapértelmezett narancs, ha üres
        if (colorStr.startsWith("#")) return colorStr;

        // Opcionális: alapvető színnevek lekezelése, ha a backend nem HEX-et küld
        const basicColors = {
            "red": "#ff0000",
            "blue": "#0000ff",
            "green": "#00ff00",
            "orange": "#ffa500",
            "white": "#ffffff",
            "black": "#000000"
        };
        return basicColors[colorStr.toLowerCase()] || "#ffffff";
    };

    const [localColor, setLocalColor] = useState(formatToHex(point.color));

    // Amikor a szerverről (world state) frissítés érkezik
    useEffect(() => {
        setCoords({ x: point.x, y: point.y, z: point.z });
        setLocalColor(formatToHex(point.color));
    }, [point.x, point.y, point.z, point.color]);

    const handleChange = (e, axis) => {
        setCoords({ ...coords, [axis]: e.target.value });
    };

    const commitChange = () => {
        const nx = parseFloat(coords.x);
        const ny = parseFloat(coords.y);
        const nz = parseFloat(coords.z);
        if (!isNaN(nx) && !isNaN(ny) && !isNaN(nz)) {
            if (nx !== point.x || ny !== point.y || nz !== point.z) {
                onMove(point.id, nx, ny, nz);
            }
        } else {
            setCoords({ x: point.x, y: point.y, z: point.z });
        }
    };

    const commitColor = () => {
        // Csak akkor küldjük, ha tényleg változott
        if (localColor.toLowerCase() !== formatToHex(point.color).toLowerCase()) {
            onColorChange(point.id, localColor);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') e.target.blur();
    };

    return (
        <tr>
            <td style={{fontWeight: 'bold', color: '#ffffff'}}>p{point.id}</td>
            <td>
                <span style={{color:'#888', marginRight:'4px'}}>x:</span>
                <input className="coord-input" value={coords.x} onChange={(e) => handleChange(e, 'x')} onBlur={commitChange} onKeyDown={handleKeyDown} />
            </td>
            <td>
                <span style={{color:'#888', marginRight:'4px'}}>y:</span>
                <input className="coord-input" value={coords.y} onChange={(e) => handleChange(e, 'y')} onBlur={commitChange} onKeyDown={handleKeyDown} />
            </td>
            <td>
                <span style={{color:'#888', marginRight:'4px'}}>z:</span>
                <input className="coord-input" value={coords.z} onChange={(e) => handleChange(e, 'z')} onBlur={commitChange} onKeyDown={handleKeyDown} />
            </td>

            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                <input
                    type="color"
                    value={localColor}
                    onChange={(e) => setLocalColor(e.target.value)}
                    onBlur={commitColor}
                    title="Change Color"
                    /* Kivettük az inline style nagy részét, hogy a CSS érvényesüljön */
                />
            </td>

            <td style={{textAlign: 'center'}}>
                <button className="table-delete-btn" onClick={() => onDelete(point.id)}>✕</button>
            </td>
        </tr>
    );
};

// ÚJ KOMPONENS: Egy Collection sor kezelése (FEKETE + SZÖGLETES STYLE)
// ÚJ KOMPONENS: Collection sor (Átnevezés + Fekete Stílus)
const CollectionRow = ({ name, ids, onAdd, onRemove, onRename }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [inputVal, setInputVal] = useState("");
    const [renameVal, setRenameVal] = useState(name);

    // --- HOZZÁADÁS LOGIKA ---
// --- MÓDOSÍTOTT INPUT LOGIKA ---
    const handleAddSubmit = () => {
        const rawVal = inputVal.toLowerCase().trim();

        // ELLENŐRZÉS: Tartalmaz "..."-ot? (pl. p3...p6 vagy 3..6)
        if (rawVal.includes('..')) {
            // RANGE Feldolgozása
            const parts = rawVal.split(/\.{2,3}/); // 2 vagy 3 pont mentén vág
            if (parts.length === 2) {
                const start = parseInt(parts[0].replace('p', '').trim());
                const end = parseInt(parts[1].replace('p', '').trim());

                if (!isNaN(start) && !isNaN(end)) {
                    const idsToAdd = [];
                    const min = Math.min(start, end);
                    const max = Math.max(start, end);

                    // Ciklus a két szám között
                    for (let i = min; i <= max; i++) {
                        idsToAdd.push(i);
                    }

                    // Küldés a szülőnek (tömbként)
                    onAdd(name, idsToAdd);
                    setInputVal("");
                    setIsAdding(false);
                }
            }
        } else {
            // SIMA EGYEDI PONT (Régi működés)
            const cleanVal = rawVal.replace('p', '').trim();
            const id = parseInt(cleanVal);
            if (!isNaN(id)) {
                onAdd(name, [id]); // Most már ezt is tömbként küldjük az egységesség kedvéért
                setInputVal("");
                setIsAdding(false);
            }
        }
    };

    // --- ÁTNEVEZÉS LOGIKA ---
    const handleRenameSubmit = () => {
        if (renameVal.trim() && renameVal !== name) {
            onRename(name, renameVal); // Régi név, Új név
            setIsRenaming(false);
        } else {
            setIsRenaming(false);
            setRenameVal(name); // Visszaállítás
        }
    };

    const handleKeyDown = (e, mode) => {
        if (e.key === 'Enter') mode === 'add' ? handleAddSubmit() : handleRenameSubmit();
        if (e.key === 'Escape') {
            setIsAdding(false);
            setIsRenaming(false);
            setRenameVal(name);
        }
    };

    return (
        <div className="collection-item" style={{
            display: 'flex', flexDirection: 'column', gap: '8px',
            marginBottom: '10px', padding: '10px',
            borderBottom: '1px solid #333',
            backgroundColor: 'rgba(0,0,0,0.2)'
        }}>
            {/* CÍM SOR: KATTINTHATÓ (ÁTNEVEZÉS) */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', height: '24px' }}>
                {!isRenaming ? (
                    <span
                        onClick={() => setIsRenaming(true)}
                        title="Click to rename"
                        style={{
                            fontWeight: 'bold', color: '#ffffff', fontSize: '0.95rem',
                            cursor: 'pointer', borderBottom: '1px dashed transparent',
                            transition: 'border-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.borderBottomColor = '#666'}
                        onMouseLeave={(e) => e.target.style.borderBottomColor = 'transparent'}
                    >
                        {name}
                    </span>
                ) : (
                    <input
                        autoFocus
                        value={renameVal}
                        onChange={(e) => setRenameVal(e.target.value)}
                        onBlur={handleRenameSubmit}
                        onKeyDown={(e) => handleKeyDown(e, 'rename')}
                        style={{
                            background: '#000', border: '1px solid #4caf50', color: 'white',
                            fontSize: '0.95rem', fontWeight: 'bold', padding: '2px 4px',
                            borderRadius: '0px', outline: 'none', width: '150px'
                        }}
                    />
                )}
                <span style={{ fontSize:'0.75rem', color:'#666', fontFamily: 'monospace' }}>[{ids.length} points]</span>
            </div>

            {/* PONTOK LISTÁJA */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                {ids.map(id => (
                    <div key={id} style={{
                        backgroundColor: '#000', border: '1px solid #444', borderRadius: '0px',
                        color: '#ddd', padding: '2px 6px', fontSize: '0.85em',
                        display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace'
                    }}>
                        <span>p{id}</span>
                        <button
                            onClick={() => onRemove(name, id)}
                            style={{
                                background: 'none', border: 'none', color: '#888', cursor: 'pointer',
                                padding: '0', fontSize: '1.1em', lineHeight: '1'
                            }}
                            onMouseEnter={(e) => e.target.style.color = '#ff4444'}
                            onMouseLeave={(e) => e.target.style.color = '#888'}
                        >
                            ×
                        </button>
                    </div>
                ))}

                {/* + GOMB ÉS INPUT */}
                {!isAdding ? (
                    <button
                        onClick={() => setIsAdding(true)}
                        style={{
                            backgroundColor: '#111', border: '1px solid #555', borderRadius: '0px',
                            width: '24px', height: '24px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: '14px', fontWeight: 'bold'
                        }}
                        onMouseEnter={(e) => { e.target.style.backgroundColor = '#333'; e.target.style.borderColor = '#fff'; }}
                        onMouseLeave={(e) => { e.target.style.backgroundColor = '#111'; e.target.style.borderColor = '#555'; }}
                    >
                        +
                    </button>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                        <input
                            autoFocus
                            type="text"
                            placeholder="p..."
                            value={inputVal}
                            onChange={(e) => setInputVal(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, 'add')}
                            style={{
                                width: '40px', height: '24px', background: '#000', border: '1px solid #444',
                                borderRight: 'none', color: 'white', fontSize: '0.8em', padding: '0 4px',
                                borderRadius: '0px', outline: 'none', fontFamily: 'monospace'
                            }}
                        />
                        <button onClick={handleAddSubmit} style={{ height: '24px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '0px', cursor: 'pointer', padding:'0 6px' }}>✓</button>
                        <button onClick={() => setIsAdding(false)} style={{ height: '24px', background: '#222', border: '1px solid #444', borderLeft: 'none', color: '#888', borderRadius: '0px', cursor: 'pointer', padding:'0 6px' }}>✕</button>
                    </div>
                )}
            </div>
        </div>
    );
};
// ÚJ KOMPONENS: Lábléc az új kollekció létrehozásához
const NewCollectionFooter = ({ onCreate }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState("");

    const handleSubmit = () => {
        if (newName.trim()) {
            onCreate(newName.trim());
            setNewName("");
            setIsCreating(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSubmit();
        if (e.key === 'Escape') setIsCreating(false);
    };

    if (!isCreating) {
        return (
            <button
                onClick={() => setIsCreating(true)}
                style={{
                    backgroundColor: '#111', border: '1px solid #444', borderRadius: '0px',
                    width: '100%', padding: '8px', cursor: 'pointer',
                    color: 'white', fontWeight: 'bold', fontSize: '1.2em', lineHeight: '1',
                    transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.target.style.backgroundColor = '#222'; e.target.style.borderColor = '#fff'; }}
                onMouseLeave={(e) => { e.target.style.backgroundColor = '#111'; e.target.style.borderColor = '#444'; }}
                title="Create New Collection"
            >
                +
            </button>
        );
    }

    return (
        <div style={{ display: 'flex', width: '100%', gap: '0' }}>
            <input
                autoFocus
                type="text"
                placeholder="Collection Name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                    flexGrow: 1, background: '#000', border: '1px solid #444', borderRight: 'none',
                    color: 'white', padding: '8px', borderRadius: '0px', outline: 'none'
                }}
            />
            <button
                onClick={handleSubmit}
                style={{
                    background: '#222', border: '1px solid #444', color: '#fff',
                    borderRadius: '0px', cursor: 'pointer', padding: '0 15px', fontWeight: 'bold'
                }}
            >CREATE</button>
            <button
                onClick={() => setIsCreating(false)}
                style={{
                    background: '#222', border: '1px solid #444', borderLeft: 'none', color: '#888',
                    borderRadius: '0px', cursor: 'pointer', padding: '0 10px'
                }}
            >✕</button>
        </div>
    );
};


function Point({ position, id, color, labelMode,onClick}) {
    const [x, y, z] = position;
    let labelText = "";
    if (labelMode === 0) labelText = `p${id}`;
    else if (labelMode === 1) {
        const fx = Number(x).toFixed(1).replace('.0', '');
        const fy = Number(y).toFixed(1).replace('.0', '');
        const fz = Number(z).toFixed(1).replace('.0', '');
        labelText = `p${id} (${fx}, ${fy}, ${fz})`;
    }
    return (
        <group position={position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
            <mesh>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshStandardMaterial color={color} />
            </mesh>
            {labelMode >= 0 && (
                <Text position={[0, 0.4, 0]} fontSize={0.35} color="white" outlineWidth={0.02} outlineColor="black" anchorX="center" anchorY="bottom">
                    {labelText}
                </Text>
            )}
        </group>
    );
}

function Connection({ start, end, color, thickness }) {
    const width = Number(thickness) > 0 ? Number(thickness) : 3;
    return <Line points={[start, end]} color={color || 'white'} lineWidth={width} segments={true} />;
}

function FaceMesh({ pointIds, color, allPoints }) {
    const geometry = useMemo(() => {
        if (!allPoints || pointIds.length < 3) return null;
        const vertices = pointIds.map(id => {
            const p = allPoints.find(ap => ap.id === id);
            return p ? new THREE.Vector3(p.x, p.y, p.z) : null;
        }).filter(v => v !== null);
        if (vertices.length < 3) return null;
        const geo = new THREE.BufferGeometry();
        const pointsArray = [];
        const v0 = vertices[0];
        for (let i = 1; i < vertices.length - 1; i++) {
            const v1 = vertices[i];
            const v2 = vertices[i + 1];
            pointsArray.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pointsArray, 3));
        geo.computeVertexNormals();
        return geo;
    }, [pointIds, allPoints]);
    if (!geometry) return null;
    return <mesh geometry={geometry}><meshStandardMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.7} /></mesh>;
}

// =========================================
// 2. FŐ ALKALMAZÁS
// =========================================

function App() {
    const [world, setWorld] = useState({
        points: [], connections: [], faces: [], collections: {},
        currentTime: 0.0, isPlaying: false, clips: []
    });
    const [zIndices, setZIndices] = useState({ help: 2000, points: 2001, collections: 2002, color: 2003, materials: 2004 });
    const [topZ, setTopZ] = useState(2100);

    const [positions, setPositions] = useState({
        help: { x: 100, y: 100 },
        points: { x: 150, y: 150 },
        collections: { x: 200, y: 200 },
        color: { x: 50, y: 500 },
        materials: { x: 400, y: 100 }
    });
    const normalizeColor = (colorStr) => {
        if (!colorStr) return "#ffffff";
        if (colorStr.startsWith("#")) return colorStr.toLowerCase();

        const ctx = document.createElement('canvas').getContext('2d');
        ctx.fillStyle = colorStr;
        return ctx.fillStyle; // Ez visszaadja a szabványos #hex kódot
    };
    const bringToFront = (windowKey) => {
        setTopZ(prev => prev + 1);
        setZIndices(prev => ({ ...prev, [windowKey]: topZ + 1 }));
    };
    const [command, setCommand] = useState("");
    const [suggestion, setSuggestion] = useState("");
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [showPointTable, setShowPointTable] = useState(false);
    const [showLoadModal, setShowLoadModal] = useState(false);
    const [showNewProjectModal, setShowNewProjectModal] = useState(false);
    const [currentProjectName, setCurrentProjectName] = useState(null);
    const [isSaveAsMode, setIsSaveAsMode] = useState(false);
    const [showSaveNotification, setShowSaveNotification] = useState(false);
    const [activeBuildMaterial, setActiveBuildMaterial] = useState(null);
    const [pendingStartId, setPendingStartId] = useState(null);

    const timelineHeight = 300; // Fix magasság, nem változik többé
    const [isDraggingWindow, setIsDraggingWindow] = useState(false);
    // ... (A többi state után, pl. a showSaveNotification alá) ...

    // ÚJ: Anyaglista ablak állapota
    const [showMaterials, setShowMaterials] = useState(false);

    // ÚJ: Egységárak tárolása (Kulcs: "color-thickness", Érték: Ár)
    //const [materialPrices, setMaterialPrices] = useState({});

    // 1. Az új anyag adatbázis (Név, Ár, Szín egyben)
    const [materials, setMaterials] = useState([]);




    // ÚJ: Segédfüggvény a távolság számoláshoz
    const calculateDistance = (p1, p2) => {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2) + Math.pow(p2.z - p1.z, 2));
    };

    // Szinkronizáció: Ha a 3D térben (world) megjelenik egy új anyag, adjuk hozzá a listához
    useEffect(() => {
        if (world.connections.length === 0) return;

        setMaterials(prevMaterials => {
            const newMaterials = [...prevMaterials];
            let changed = false;

            world.connections.forEach(conn => {
                // Megnézzük, létezik-e már ez a szín+vastagság kombináció
                const exists = newMaterials.find(m => m.color === conn.color && m.thickness === conn.thickness);

                if (!exists) {
                    // Ha nem létezik, létrehozzuk (automatikusan elnevezzük)
                    const nextNum = newMaterials.length + 1;
                    newMaterials.push({
                        id: Date.now() + Math.random(), // Egyedi ID
                        name: `Material ${nextNum}`,    // Default név
                        color: conn.color,
                        thickness: conn.thickness,
                        price: 0
                    });
                    changed = true;
                }
            });

            return changed ? newMaterials : prevMaterials;
        });
    }, [world.connections]); // Csak akkor fut le, ha változnak a kapcsolatok

    // Segédfüggvény: Anyag módosítása (Név, Ár, Szín, Vastagság)
    const updateMaterial = (index, field, value) => {
        setMaterials(prev => {
            const clone = [...prev];
            clone[index] = { ...clone[index], [field]: value };
            return clone;
        });
    };

    // Segédfüggvény: Új üres anyag hozzáadása a "+" gombbal
// Segédfüggvény: Új anyag hozzáadása (Auto-increment vastagsággal)
    const addNewMaterial = () => {
        setMaterials(prev => {
            const defaultColor = '#ffffff';
            let safeThickness = 2;

            // Addig növeljük a számot, amíg találunk olyat, ami még nincs használatban ezzel a színnel
            // (Így elkerüljük az azonnali ütközést)
            while (prev.some(m => m.color === defaultColor && m.thickness === safeThickness)) {
                safeThickness++;
            }

            return [
                ...prev,
                {
                    id: Date.now(),
                    name: `Material ${prev.length + 1}`,
                    color: defaultColor,
                    thickness: safeThickness, // A kiszámolt biztonságos méret
                    price: 0
                }
            ];
        });
    };

    // Számítás: Mennyi van az egyes anyagokból a térben?
// JAVÍTOTT BOM SZÁMÍTÁS (Szín normalizálással)
    const calculatedMaterials = useMemo(() => {
        let grandTotal = 0;

        const rows = materials.map(mat => {
            let totalLen = 0;
            // Normalizáljuk az anyag színét is
            const matColorHex = normalizeColor(mat.color);

            world.connections.forEach(conn => {
                // Normalizáljuk a kapcsolat színét is (pl. "white" -> "#ffffff")
                const connColorHex = normalizeColor(conn.color);

                // Most már biztonságos az összehasonlítás
                if (connColorHex === matColorHex && conn.thickness === mat.thickness) {
                    const p1 = world.points.find(p => p.id === conn.fromId);
                    const p2 = world.points.find(p => p.id === conn.toId);
                    if (p1 && p2) {
                        totalLen += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2) + Math.pow(p2.z - p1.z, 2));
                    }
                }
            });

            const cost = totalLen * (mat.price || 0);
            grandTotal += cost;

            return { ...mat, totalLen, cost };
        });

        return { rows, grandTotal };
    }, [materials, world.connections, world.points]);




    /*
    // ÚJ: Az üzleti logika - Kapcsolatok csoportosítása és árazása
    const materialGroups = useMemo(() => {
        const groups = {};
        let grandTotal = 0;

        world.connections.forEach(conn => {
            const p1 = world.points.find(p => p.id === conn.fromId);
            const p2 = world.points.find(p => p.id === conn.toId);

            if (p1 && p2) {
                // Egyedi kulcs: Szín és Vastagság kombinációja
                const key = `${conn.color}-${conn.thickness}`;
                const length = calculateDistance(p1, p2);

                if (!groups[key]) {
                    groups[key] = {
                        color: conn.color,
                        thickness: conn.thickness,
                        totalLength: 0,
                        count: 0
                    };
                }

                groups[key].totalLength += length;
                groups[key].count += 1;
            }
        });

        // Árak hozzárendelése és végösszeg számolása
        return Object.entries(groups).map(([key, data]) => {
            const unitPrice = materialPrices[key] || 0; // Ha nincs ár, 0
            const cost = data.totalLength * unitPrice;
            grandTotal += cost;
            return { ...data, key, unitPrice, cost };
        }).sort((a, b) => b.cost - a.cost); // A legdrágább legyen elöl

    }, [world.connections, world.points, materialPrices]);


    */

    // Végösszeg kiszámolása külön (megjelenítéshez)
    //const totalProjectCost = materialGroups.reduce((sum, item) => sum + item.cost, 0);


    const [showTerminal, setShowTerminal] = useState(true);
    const [showHelp, setShowHelp] = useState(false);
    const [showCollections, setShowCollections] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showTimeline, setShowTimeline] = useState(false);

    const [labelMode, setLabelMode] = useState(0);
    const [pickedColor, setPickedColor] = useState("#ffffff");
    const [isCopied, setIsCopied] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const stompClientRef = useRef(null);
    const inputRef = useRef(null);
    const helpSearchRef = useRef(null);

    const helpCommands = [
        { name: "addpoint", syntax: "AddPoint(x, y, z, color)", desc: "Adds a point.", cmd: "AddPoint(0, 0, 0, #ffffff)" },
        { name: "connect", syntax: "Connect(from, to, color, size)", desc: "Connects points (p1 to p2 or list).", cmd: "Connect(p0, p1, #ffffff, 3)" },
        { name: "addface", syntax: "AddFace([ids], color)", desc: "Creates a polygon.", cmd: "AddFace([p0, p1, p2], #888888)" },
        { name: "color", syntax: "Color(pID, color)", desc: "Updates color.", cmd: "Color(p0, #ff0000)" },
        { name: "move", syntax: "Move(pID, x, y, z)", desc: "Absolute move.", cmd: "Move(p0, 5, 5, 5)" },
        { name: "delete", syntax: "Delete(target)", desc: "Removes point/face/link.", cmd: "Delete(p0)" },

        { name: "addcollection", syntax: "AddCollection(name, [ids])", desc: "Creates group.", cmd: "AddCollection(fal, [p0, p1])" },
        { name: "addtocollection", syntax: "AddToCollection(name, [ids])", desc: "Adds to group.", cmd: "AddToCollection(fal, [p2])" },
        { name: "removefromcollection", syntax: "RemoveFromCollection(name, [ids])", desc: "Removes from group.", cmd: "RemoveFromCollection(fal, [p0])" },

        { name: "addclip", syntax: "AddClip(target, type, start, end, axis, val)", desc: "Anim: Move p0 on Y by 5.", cmd: "AddClip(p0, Move, 0, 5, y, 5, \"Name\")" },
        { name: "updateclip", syntax: "UpdateClip(id, name, start, end)", desc: "Updates a clip.", cmd: "" },
        { name: "deleteclip", syntax: "DeleteClip(name)", desc: "Removes clip by name.", cmd: "DeleteClip(Move1)" },
        { name: "deleteclipbyid", syntax: "DeleteClipById(id)", desc: "Removes clip by ID.", cmd: "" },

        { name: "play", syntax: "Play", desc: "Starts timeline.", cmd: "Play" },
        { name: "pause", syntax: "Pause", desc: "Pauses timeline.", cmd: "Pause" },
        { name: "seek", syntax: "Seek(seconds)", desc: "Jumps to time.", cmd: "Seek(2.5)" },
        { name: "stop", syntax: "Stop", desc: "Stops/Resets everything.", cmd: "Stop" },

        { name: "showindexes", syntax: "ShowIndexes(mode)", desc: "0: ID, 1: Coords.", cmd: "ShowIndexes(1)" },
        { name: "hideindexes", syntax: "HideIndexes", desc: "Hides labels.", cmd: "HideIndexes" },
        { name: "clear", syntax: "Clear", desc: "Wipes world.", cmd: "Clear" },
    ];

    const filteredCommands = useMemo(() => {
        return helpCommands.filter(c =>
            c.syntax.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.desc.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm]);

    const updateSuggestion = (input) => {
        if (!input) { setSuggestion(""); return; }
        const lowerInput = input.toLowerCase();
        const match = helpCommands.find(c => c.name.startsWith(lowerInput));
        setSuggestion(match && match.name !== lowerInput ? match.syntax : "");
    };

    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (e.key === 'F1') { e.preventDefault(); setShowHelp(prev => !prev); }
            if (e.key === 'Escape') { setShowHelp(false); setShowMaterials(false); setPendingStartId(null); setShowPointTable(false); setShowColorPicker(false); setShowCollections(false); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                if (showHelp) { e.preventDefault(); helpSearchRef.current?.focus(); }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault(); // Ne mentse le a böngésző az oldalt html-ként
                handleSmartSave(); // Meghívjuk az okos mentést
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (stompClientRef.current) stompClientRef.current.publish({ destination: '/app/send-command', body: "Undo" });
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                if (stompClientRef.current) stompClientRef.current.publish({ destination: '/app/send-command', body: "Redo" });
            }
            if (e.code === 'Space' && document.activeElement !== inputRef.current && document.activeElement !== helpSearchRef.current) {
                e.preventDefault();
                togglePlay();
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [world.isPlaying, currentProjectName]);

    useEffect(() => {
        const client = new Client({
            brokerURL: 'ws://localhost:8080/3d-ws/websocket',
            onConnect: () => {
                client.subscribe('/topic/world-updates', (message) => {
                    try {
                        const data = JSON.parse(message.body);
                        setWorld(prev => ({
                            ...prev,
                            ...data,
                            collections: data.collections || {},
                            currentTime: data.currentTime !== undefined ? data.currentTime : prev.currentTime,
                            isPlaying: data.isPlaying !== undefined ? data.isPlaying : prev.isPlaying,
                            clips: data.clips || []
                        }));
                    } catch (e) { console.error("WS Error:", e); }
                });
            },
        });
        client.activate();
        stompClientRef.current = client;
        return () => client.deactivate();
    }, []);

    const sendCommand = (cmdText) => {
        let txt = cmdText || command;
        if (!txt.trim()) return;

        // --- ÚJ: Connect parancs előfeldolgozása (Anyagnév keresés) ---
        // Regex: Connect(p1, p2, VALAMI) -> A VALAMI lehet anyagnév is
        const connectMatch = txt.match(/^Connect\s*\(([^,]+),\s*([^,]+),\s*(.+)\)$/i);

        if (connectMatch) {
            const pFrom = connectMatch[1].trim();
            const pTo = connectMatch[2].trim();
            let rawMaterial = connectMatch[3].trim(); // Ez lehet "Material 1" vagy "white, 2"

            // Ha az utolsó részben nincs vessző (tehát csak egy nevet adtak meg, nem színt+méretet)
            // VAGY idézőjelben van a név
            const isPotentialMaterialName = !rawMaterial.includes(',') || rawMaterial.startsWith('"') || rawMaterial.startsWith("'");

            if (isPotentialMaterialName) {
                // Idézőjelek levétele
                const searchName = rawMaterial.replace(/['"]/g, "");

                // KERESÉS: Van ilyen nevű anyagunk?
                const foundMat = materials.find(m => m.name.toLowerCase() === searchName.toLowerCase());

                if (foundMat) {
                    // TALÁLTUNK ANYAGOT! -> Átírjuk a parancsot a szerver számára
                    // Connect(p0, p1, #szín, vastagság)
                    txt = `Connect(${pFrom}, ${pTo}, ${foundMat.color}, ${foundMat.thickness})`;
                    console.log("Material resolved:", searchName, "->", txt);
                }
            }
        }

        setHistory(prev => [...prev, txt]); // Az eredetit vagy az átírtat mentjük? (Itt most az átírtat fogja)
        setHistoryIndex(-1);

        const cmdLower = txt.trim().toLowerCase();

        if (cmdLower.startsWith('showindexes')) {
            const match = cmdLower.match(/\((\d)\)/);
            setLabelMode(match ? (parseInt(match[1]) === 1 ? 1 : 0) : 0);
        } else if (cmdLower === 'hideindexes') setLabelMode(-1);
        else if (cmdLower === 'clearhistory') setHistory([]);
        else if (stompClientRef.current) {
            stompClientRef.current.publish({ destination: '/app/send-command', body: txt });
        }
        setCommand("");
        setSuggestion("");
    };

    // 3D PONT KATTINTÁS KEZELÉSE
    const handlePointClick = (id) => {
        // Csak akkor csinálunk valamit, ha "USE" módban vagyunk
        if (activeBuildMaterial) {

            if (pendingStartId === null) {
                // 1. KATTINTÁS: Kezdőpont kijelölése
                setPendingStartId(id);
            } else {
                // 2. KATTINTÁS: Végpont kijelölése -> Összekötés
                if (pendingStartId !== id) {
                    // Connect(from, to, color, thickness)
                    const cmd = `Connect(p${pendingStartId}, p${id}, ${activeBuildMaterial.color}, ${activeBuildMaterial.thickness})`;

                    // Küldés a szervernek
                    if (stompClientRef.current) {
                        stompClientRef.current.publish({ destination: '/app/send-command', body: cmd });
                    }

                    // Reseteljük a kezdőpontot, de maradunk építő módban (folyamatos munka)
                    setPendingStartId(null);
                }
            }
        }
    };






    const handleInputKeyDown = (e) => {
        if (e.key === 'Tab' && suggestion) {
            e.preventDefault();
            setCommand(suggestion);
            setSuggestion("");
        } else if (e.key === 'Enter') {
            sendCommand();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (history.length > 0) {
                const newIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
                setHistoryIndex(newIdx);
                setCommand(history[newIdx]);
                setSuggestion("");
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex !== -1) {
                const newIdx = historyIndex >= history.length - 1 ? -1 : historyIndex + 1;
                setHistoryIndex(newIdx);
                setCommand(newIdx === -1 ? "" : history[newIdx]);
                setSuggestion("");
            }
        }
    };

    const fillCommand = (template) => {
        setCommand(template);
        setShowHelp(false);
        setShowTerminal(true);
        setSearchTerm("");
        setTimeout(() => inputRef.current?.focus(), 50);
    };
    const startDragging = (e, windowKey) => {
        // Hozzuka az ablakot előtérbe
        bringToFront(windowKey);

        const startX = e.clientX - positions[windowKey].x;
        const startY = e.clientY - positions[windowKey].y;

        const onMouseMove = (moveEvent) => {
            setPositions(prev => ({
                ...prev,
                [windowKey]: {
                    x: moveEvent.clientX - startX,
                    y: moveEvent.clientY - startY
                }
            }));
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };




    const togglePlay = () => {
        const cmd = world.isPlaying ? "Pause" : "Play";
        if (stompClientRef.current) stompClientRef.current.publish({ destination: '/app/send-command', body: cmd });
    };
    const stopTimeline = () => {
        if (stompClientRef.current) stompClientRef.current.publish({ destination: '/app/send-command', body: "Stop" });
    };
    const handleSeek = (e) => {
        const newTime = e.target.value;
        setWorld(prev => ({ ...prev, currentTime: parseFloat(newTime) }));
        if (stompClientRef.current) stompClientRef.current.publish({ destination: '/app/send-command', body: `Seek(${newTime})` });
    };

    const handleClipUpdate = (id, name, start, end) => {
        if (stompClientRef.current) {
            const cmd = `UpdateClip(${id}, ${name}, ${start.toFixed(2)}, ${end.toFixed(2)})`;
            stompClientRef.current.publish({ destination: '/app/send-command', body: cmd });
        }
    };

    const handleClipDelete = (id) => {
        if (stompClientRef.current) {
            const cmd = `DeleteClipById(${id})`;
            stompClientRef.current.publish({ destination: '/app/send-command', body: cmd });
        }
    };

    const handleTableMove = (id, x, y, z) => {
        if (stompClientRef.current) {
            // Move(pID, x, y, z)
            const cmd = `Move(p${id}, ${x}, ${y}, ${z})`;
            stompClientRef.current.publish({ destination: '/app/send-command', body: cmd });
        }
    };

    const handleTableColorChange = (id, newColor) => {
        if (stompClientRef.current) {
            // Color(pID, #hex) parancs küldése
            const cmd = `Color(p${id}, ${newColor})`;
            stompClientRef.current.publish({ destination: '/app/send-command', body: cmd });
        }
    };
    const handleTableDelete = (id) => {
        if (window.confirm(`Delete point p${id}?`)) {
            if (stompClientRef.current) {
                const cmd = `Delete(p${id})`;
                stompClientRef.current.publish({ destination: '/app/send-command', body: cmd });
            }
        }
    };
    // ÚJ: Kézi hozzáadás a collectionhöz
    // MÓDOSÍTOTT: Kézi hozzáadás (tömböt és single int-et is kezel)
    const handleCollectionAddPoint = (name, idsInput) => {
        // Ha nem tömb, csinálunk belőle tömböt
        const ids = Array.isArray(idsInput) ? idsInput : [idsInput];

        // Összerakjuk a stringet: [p1, p2, p3]
        const idString = `[${ids.map(id => `p${id}`).join(', ')}]`;

        // Parancs: AddToCollection(name, [p1, p2...])
        const cmd = `AddToCollection(${name}, ${idString})`;
        sendCommand(cmd);
    };

    // ÚJ: Kézi törlés a collectionből
    const handleCollectionRemovePoint = (name, id) => {
        // Parancs: RemoveFromCollection(name, [ids])
        const cmd = `RemoveFromCollection(${name}, [p${id}])`;
        sendCommand(cmd);
    };
    const handleCreateCollection = (name) => {
        if (!name.trim()) return;
        // AddCollection(name, []) - üres lista
        sendCommand(`AddCollection(${name}, [])`);
    };

    // ÚJ: Valódi átnevezés a backend támogatásával
    const handleRenameCollection = (oldName, newName) => {
        sendCommand(`RenameCollection(${oldName}, ${newName})`);
    };
// 1. HA BETÖLTÜNK EGY PROJEKTET
    const handleLoadProject = (id, name) => {
        sendCommand(`LoadProject(${id})`);
        setCurrentProjectName(name); // Beállítjuk a nevet
        setShowLoadModal(false);
    };

// --- JAVÍTOTT CSV IMPORTÁLÁS (Magyar Excel kompatibilis) ---
    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            // Kezeljük a Windows (\r\n) és Linux (\n) sorvégeket is
            const lines = text.split(/\r\n|\n/);

            let count = 0;

            lines.forEach((line) => {
                if (!line.trim()) return; // Üres sorok kihagyása

                let x, y, z, color;
                let parts;

                // 1. STRATÉGIA: PONTOSVESSZŐ (;) detektálása (Magyar Excel)
                if (line.includes(';')) {
                    parts = line.split(';');
                    // Magyar formátum esetén a tizedesvesszőt pontra cseréljük
                    if (parts.length >= 3) {
                        x = parseFloat(parts[0].replace(',', '.').trim());
                        y = parseFloat(parts[1].replace(',', '.').trim());
                        z = parseFloat(parts[2].replace(',', '.').trim());
                        color = (parts.length > 3 && parts[3].trim()) ? parts[3].trim() : '#ffffff';
                    }
                }
                // 2. STRATÉGIA: VESSZŐ (,) detektálása (Standard CSV)
                else {
                    parts = line.split(',');
                    if (parts.length >= 3) {
                        x = parseFloat(parts[0].trim());
                        y = parseFloat(parts[1].trim());
                        z = parseFloat(parts[2].trim());
                        color = (parts.length > 3 && parts[3].trim()) ? parts[3].trim() : '#ffffff';
                    }
                }

                // Ha sikeres volt a konvertálás, küldjük a szervernek
                if (x !== undefined && !isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    sendCommand(`AddPoint(${x}, ${y}, ${z}, ${color})`);
                    count++;
                }
            });

            if (count > 0) {
                alert(`Successfully imported ${count} points!`);
            } else {
                alert("No valid points found. Please check your CSV format (x,y,z or x;y;z).");
            }
        };
        reader.readAsText(file);
        event.target.value = null; // Reset, hogy újra be lehessen tölteni ugyanazt
    };



// 2. AZ "OKOS MENTÉS" (Gomb vagy Ctrl+S)
    const handleSmartSave = () => {
        if (currentProjectName) {
            // Ha már van neve, azonnal mentünk
            sendCommand(`SaveProject(${currentProjectName})`);

            // --- ÉRTESÍTÉS MEGJELENÍTÉSE ---
            setShowSaveNotification(true);

            // 2 másodperc múlva eltüntetjük
            setTimeout(() => {
                setShowSaveNotification(false);
            }, 2000);

        } else {
            // Ha még nincs neve (Unsaved), kérünk egy nevet
            setIsSaveAsMode(false);
            setShowNewProjectModal(true);
        }
    };
    const handleNewProject = () => {
        // Biztonsági kérdés, nehogy véletlenül töröld a munkád
        if (window.confirm("Start new project? Unsaved changes will be lost.")) {
            sendCommand("Clear"); // Törli a 3D teret a backend-en
            setCurrentProjectName(null); // Visszaállítja a nevet "Unsaved"-re
            // Opcionális: A fájl input előzményeket is törölheted: setHistory([]);
        }
    };

    // 3. MENTÉS MÁSKÉNT (Gomb)
    const handleSaveAsClick = () => {
        setIsSaveAsMode(true); // Ez "másként mentés", tehát NEM váltunk át az új névre
        setShowNewProjectModal(true);
    };

    // 4. AMIKOR A MODALBAN RÁNYOMNAK A CREATE GOMBRA
    const handleModalSubmit = (name) => {
        sendCommand(`SaveProject(${name})`);

        if (isSaveAsMode) {
            // Ha "Mentés másként" volt, akkor NEM váltunk át az új névre.
            // Maradunk az eredetiben (ahogy kérted).
            console.log(`Saved copy as: ${name}, staying in: ${currentProjectName}`);
        } else {
            // Ha ez volt az első mentés, akkor mostantól ez a projekt neve.
            setCurrentProjectName(name);
        }

        setShowNewProjectModal(false);
    };
    return (
        <div className="container">
            {/* 1. BAL FELSŐ SAROK: UNDO / REDO */}
            <div className="undo-redo-container">
                <button className="icon-btn-small" onClick={() => stompClientRef.current.publish({ destination: '/app/send-command', body: "Undo" })} title="Undo (Ctrl+Z)">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7v6h6"></path>
                        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
                    </svg>
                </button>
                <button className="icon-btn-small" onClick={() => stompClientRef.current.publish({ destination: '/app/send-command', body: "Redo" })} title="Redo (Ctrl+Y)">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 7v6h-6"></path>
                        <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path>
                    </svg>
                </button>
            </div>
            {/* PROJEKT NÉV KIJELZÉSE - KÖZÉPEN FELÜL */}
            <div style={{
                position: 'absolute', top: 15, left: '50%', transform: 'translateX(-50%)',
                zIndex: 90, color: '#ccc', backgroundColor: 'rgba(0,0,0,0.6)',
                padding: '6px 16px', borderRadius: '20px', fontSize: '0.9em',
                pointerEvents: 'none', border: '1px solid #444'
            }}>
                Current: <span style={{color: 'white'}}>{currentProjectName || "Unsaved Project"}</span>
            </div>

            {/* 2. BAL ALSÓ SAROK: ESZKÖZÖK */}
            <div className="left-icon-bar">

                {/* 1. TERMINÁL */}
                <button
                    className={`icon-btn ${showTerminal ? 'active' : ''}`}
                    onClick={() => setShowTerminal(!showTerminal)}
                    title="Toggle Terminal"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 17 10 11 4 5"></polyline>
                        <line x1="12" y1="19" x2="20" y2="19"></line>
                    </svg>
                </button>

                {/* 2. PONT TÁBLÁZAT */}
                <button
                    className={`icon-btn ${showPointTable ? 'active' : ''}`}
                    onClick={() => { setShowPointTable(!showPointTable); bringToFront('points'); }}
                    title="Points Table"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M3 12h18"></path>
                        <path d="M3 18h18"></path>
                    </svg>
                </button>

                {/* 3. HELP */}
                <button
                    className={`icon-btn ${showHelp ? 'active' : ''}`}
                    onClick={() => { setShowHelp(!showHelp); bringToFront('help'); }}
                    title="Help (F1)"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </button>

                {/* 4. SZÍNVÁLASZTÓ */}
                <button
                    className={`icon-btn ${showColorPicker ? 'active' : ''}`}
                    onClick={() => { setShowColorPicker(!showColorPicker); bringToFront('color'); }}
                    title="Color Picker"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2.69l5.74 5.74c1.5 1.5 1.5 3.93 0 5.42 0 3-2.5 5.15-5 5.15s-5-2.15-5-5.15c0-1.49 0-3.92 1.5-5.42L12 2.69z"></path>
                    </svg>
                </button>

                {/* 5. GYŰJTEMÉNYEK */}
                <button
                    className={`icon-btn ${showCollections ? 'active' : ''}`}
                    onClick={() => { setShowCollections(!showCollections); bringToFront('collections'); }}
                    title="Show Collections"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                        <polyline points="2 17 12 22 22 17"></polyline>
                        <polyline points="2 12 12 17 22 12"></polyline>
                    </svg>
                </button>

                {/* 6. TIMELINE */}
                <button
                    className={`icon-btn ${showTimeline ? 'active' : ''}`}
                    onClick={() => setShowTimeline(!showTimeline)}
                    title="Toggle Timeline"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="9" y1="21" x2="9" y2="9"></line>
                    </svg>
                </button>
                {/* 7. MATERIALS & PRICING (Dollár jel) */}
                <button
                    className={`icon-btn ${showMaterials ? 'active' : ''}`}
                    onClick={() => {
                        if (!showMaterials) bringToFront('materials'); // Ezt majd add hozzá a pozíció state-hez is!
                        setShowMaterials(!showMaterials);
                    }}
                    title="Materials & Pricing"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                </button>
            </div>

            {/* 3. TIMELINE UI */}
            {showTimeline && (
                <div
                    className="timeline-container"
                    style={{
                        height: `${timelineHeight}px`,
                        transition: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative' // Hogy a handle pozicionálható legyen
                    }}
                >
                    {/* FEJLÉC (Most ez van legfelül) */}
                    <div className="timeline-header">
                        <div className="timeline-controls">
                            <button className="timeline-btn stop" onClick={stopTimeline} title="Stop">⏹</button>
                            <button className={`timeline-btn play ${world.isPlaying ? 'active' : ''}`} onClick={togglePlay} title="Play/Pause">
                                {world.isPlaying ? "⏸" : "▶"}
                            </button>
                            <div className="time-display">{Number(world.currentTime).toFixed(2)}s</div>
                        </div>
                        <div className="timeline-scrubber-track">
                            <input type="range" min="0" max="60" step="0.1" value={world.currentTime} onChange={handleSeek} className="timeline-slider" />
                        </div>
                    </div>

                    {/* SÁVOK (Középen, kitöltik a helyet) */}
                    <div className="timeline-tracks-area" style={{ flexGrow: 1, overflowY: 'auto' }}>
                        {/* PLAYHEAD */}
                        <div className="timeline-playhead">
                            <div
                                className="playhead-line"
                                style={{ left: `${(world.currentTime / 60) * 100}%` }}
                            />
                        </div>

                        {Object.entries((world.clips || []).reduce((acc, clip) => {
                            (acc[clip.targetId] = acc[clip.targetId] || []).push(clip);
                            return acc;
                        }, {})).map(([targetId, clips]) => (
                            <div key={targetId} className="timeline-track-row">
                                <div className="track-label">p{targetId}</div>
                                <div className="track-content">
                                    {clips.map((clip) => (
                                        <TimelineClipItem
                                            key={clip.id}
                                            clip={clip}
                                            maxTime={60}
                                            onUpdate={handleClipUpdate}
                                            onDelete={handleClipDelete}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                        {(world.clips || []).length === 0 && <div className="empty-timeline">No clips yet. Use AddClip(...)</div>}
                    </div>
                </div>
            )}
            {/* JOBB FELSŐ GOMBOK */}
            <div style={{position: 'absolute', top: 10, right: 10, zIndex: 100, display: 'flex', gap: '8px'}}>
                {/* --- CSV IMPORT GOMB --- */}
                <label style={{
                    padding: '8px 12px', cursor: 'pointer', fontWeight: 'bold',
                    backgroundColor: '#1a1a1a', color: 'white',
                    border: '1px solid #444', borderRadius: '4px',
                    display: 'inline-block' // Hogy gombnak nézzen ki
                }} title="Import Points from CSV">
                    Import CSV
                    <input
                        type="file"
                        accept=".csv"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                    />
                </label>
                {/* NEW PROJECT GOMB */}
                <button
                    onClick={handleNewProject}
                    title="New Project (Clear)"
                    style={{
                        padding: '8px 12px', cursor: 'pointer', fontWeight: 'bold',
                        backgroundColor: '#1a1a1a', // Fekete (nagyon sötét szürke)
                        color: 'white',
                        border: '1px solid #444',
                        borderRadius: '4px'
                    }}
                >
                    + New
                </button>

                {/* SAVE GOMB */}
                <button
                    onClick={handleSmartSave}
                    title="Save (Ctrl+S)"
                    style={{
                        padding: '8px 12px', cursor: 'pointer', fontWeight: 'bold',
                        backgroundColor: '#1a1a1a',
                        color: 'white',
                        border: '1px solid #444',
                        borderRadius: '4px'
                    }}
                >
                    Save
                </button>

                {/* SAVE AS GOMB */}
                <button
                    onClick={handleSaveAsClick}
                    title="Save Copy As..."
                    style={{
                        padding: '8px 12px', cursor: 'pointer', fontWeight: 'bold',
                        backgroundColor: '#1a1a1a',
                        color: '#ffffff', // Kicsit halványabb szöveg, hogy elkülönüljön
                        border: '1px solid #444',
                        borderRadius: '4px'
                    }}
                >
                    Save As
                </button>

                {/* LOAD GOMB */}
                <button
                    onClick={() => setShowLoadModal(true)}
                    style={{
                        padding: '8px 12px', cursor: 'pointer', fontWeight: 'bold',
                        backgroundColor: '#1a1a1a',
                        color: 'white',
                        border: '1px solid #444',
                        borderRadius: '4px'
                    }}
                >
                    Load
                </button>
            </div>

            {/* OVERLAYS */}
            {/* --- EZ AZ ÚJ BLOKK, AMIT BE KELL ILLESZTENED --- */}
            {showCollections && (
                <div className="collections-overlay" style={{
                    backgroundColor: 'rgba(10, 10, 10, 0.95)',
                    border: '1px solid #333',
                    borderRadius: '0px',
                    display: 'flex', flexDirection: 'column',
                    height: 'auto', maxHeight: '600px'
                }}>
                    {/* FEJLÉC */}
                    <div className="collections-title" style={{
                        borderBottom: '1px solid #333', padding: '10px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        flexShrink: 0
                    }}>
                        <span style={{ color: '#ffffff', fontWeight: 'bold' }}>COLLECTIONS EDITOR</span>
                        <button onClick={() => setShowCollections(false)} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer' }}>✕</button>
                    </div>

                    {/* LISTA (Görgethető) */}
                    <div className="help-scroll-container" style={{ padding: '0', flexGrow: 1, overflowY: 'auto' }}>
                        {Object.keys(world.collections).length > 0 ? (
                            Object.entries(world.collections).map(([name, ids]) => (
                                <CollectionRow
                                    key={name}
                                    name={name}
                                    ids={ids}
                                    onAdd={handleCollectionAddPoint}
                                    onRemove={handleCollectionRemovePoint}
                                    onRename={handleRenameCollection}
                                />
                            ))
                        ) : (
                            <div className="empty-msg" style={{ padding: '20px', color: '#666', textAlign: 'center' }}>
                                No collections created yet.
                            </div>
                        )}
                    </div>

                    {/* LÁBLÉC: LÉTREHOZÁS */}
                    <div style={{
                        borderTop: '1px solid #333',
                        padding: '10px',
                        backgroundColor: '#0e0e0e',
                        display: 'flex', justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <NewCollectionFooter onCreate={handleCreateCollection} />
                    </div>
                </div>
            )}
            {showColorPicker && (
                <div className="color-picker-overlay">
                    <div className="color-picker-header">
                        <span className="color-picker-title">PICK A COLOR</span>
                        <button className="close-btn" onClick={() => setShowColorPicker(false)}>✕</button>
                    </div>

                    {/* CSAK EZ AZ EGY PICKER MARADJON, A DUPLIKÁLTAT TÖRÖLD KI */}
                    <ChromePicker
                        color={pickedColor}
                        onChange={(c) => setPickedColor(c.hex)}
                        disableAlpha={true}
                        styles={{
                            default: {
                                picker: {
                                    background: '#1a1a1a',
                                    borderRadius: '4px',
                                    border: '1px solid #444',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                    fontFamily: 'Inter, sans-serif'
                                },
                                body: {
                                    padding: '12px 10px',
                                    background: '#1a1a1a'
                                },
                                input: {
                                    background: '#333',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '2px',
                                    fontSize: '11px'
                                },
                                label: {
                                    color: '#888',
                                    fontSize: '10px',
                                    textTransform: 'uppercase',
                                    marginTop: '5px'
                                }
                            }
                        }}
                    />
                    <button className={`hex-copy-btn ${isCopied ? "copied" : ""}`} onClick={() => { navigator.clipboard.writeText(pickedColor); setIsCopied(true); setTimeout(()=>setIsCopied(false), 2000); }}>
                        <span>{pickedColor}</span>
                        <svg className="copy-icon" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                    </button>
                </div>
            )}
            {showMaterials && (
                <div className="point-table-overlay"
                     onPointerDown={(e) => e.stopPropagation()}
                     onMouseDown={(e) => {
                         e.stopPropagation();
                         bringToFront('materials');
                     }}
                     style={{
                         position: 'absolute', margin: 0, transform: 'none',
                         left: positions.materials?.x || 300,
                         top: positions.materials?.y || 100,
                         zIndex: zIndices.materials || 2005,
                         width: '850px'
                     }}>

                    {/* --- FEJLÉC --- */}
                    <div className="point-table-header" onMouseDown={(e) => startDragging(e, 'materials')} style={{ cursor: 'move', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            {/* CÍM: FEHÉR */}
                            <span style={{ color: '#ffffff' }}>BILL OF MATERIALS</span>

                            {/* INFO: SZÜRKE (#b0b0b0) */}
                            {activeBuildMaterial && (
                                <span style={{ fontSize: '0.85rem', color: '#b0b0b0', fontWeight: 'normal', fontFamily: 'monospace' }}>
                                    Building with: {materials.find(m =>
                                    m.color === activeBuildMaterial.color &&
                                    m.thickness === activeBuildMaterial.thickness
                                )?.name || "Unknown"}
                                </span>
                            )}
                        </div>

                        <button className="close-btn" onClick={() => setShowMaterials(false)}>✕</button>
                    </div>

                    <div className="point-table-scroll">
                        <table className="styled-table">
                            <thead>
                            {/* TÁBLÁZAT FEJLÉC: SZÜRKE (#b0b0b0) - Hogy egységes legyen */}
                            <tr style={{ color: '#b0b0b0' }}>
                                <th style={{width:'180px', color: '#b0b0b0'}}>Material Name</th>
                                <th style={{color: '#b0b0b0'}}>Properties (Color / Size)</th>
                                <th style={{textAlign:'right', color: '#b0b0b0'}}>Len (m)</th>
                                <th style={{textAlign:'right', color: '#b0b0b0'}}>Price/m</th>
                                <th style={{textAlign:'right', color: '#b0b0b0'}}>Cost</th>
                                <th style={{textAlign:'center', color: '#b0b0b0'}}>Action</th>
                            </tr>
                            </thead>
                            <tbody>
                            {calculatedMaterials.rows.length > 0 ? (
                                calculatedMaterials.rows.map((item, idx) => {

                                    const isDuplicate = materials.some(m =>
                                        m.id !== item.id &&
                                        m.color === item.color &&
                                        m.thickness === item.thickness
                                    );

                                    return (
                                        <tr key={item.id} style={{ backgroundColor: isDuplicate ? 'rgba(255, 0, 0, 0.1)' : 'transparent' }}>

                                            {/* NÉV */}
                                            <td>
                                                <input
                                                    className="coord-input"
                                                    style={{width:'100%', textAlign:'left'}}
                                                    value={item.name}
                                                    onChange={(e) => updateMaterial(idx, 'name', e.target.value)}
                                                />
                                            </td>

                                            {/* TULAJDONSÁGOK */}
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input
                                                        type="color"
                                                        value={item.color}
                                                        onChange={(e) => updateMaterial(idx, 'color', e.target.value)}
                                                        title="Change Color"
                                                    />
                                                    <input
                                                        type="number"
                                                        className="coord-input"
                                                        style={{
                                                            width:'50px',
                                                            borderColor: isDuplicate ? '#ff4444' : '#444',
                                                            color: isDuplicate ? '#ff4444' : 'white'
                                                        }}
                                                        value={item.thickness}
                                                        onChange={(e) => updateMaterial(idx, 'thickness', parseFloat(e.target.value))}
                                                        title="Thickness (px)"
                                                    />
                                                    <span style={{color:'#666', fontSize:'0.8em'}}>px</span>
                                                </div>

                                                {isDuplicate && (
                                                    <div style={{ color: '#ff4444', fontSize: '0.75rem', marginTop: '4px', fontWeight: 'bold' }}>
                                                        Exists already!
                                                    </div>
                                                )}
                                            </td>

                                            {/* HOSSZ */}
                                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '1.1em', color: item.totalLen > 0 ? '#fff' : '#555' }}>
                                                {item.totalLen.toFixed(2)}
                                            </td>

                                            {/* ÁR */}
                                            <td style={{ textAlign: 'right' }}>
                                                <input
                                                    type="number"
                                                    className="price-input"
                                                    value={item.price || ''}
                                                    placeholder="0"
                                                    onChange={(e) => updateMaterial(idx, 'price', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>

                                            {/* KÖLTSÉG - Most már ez is szürke/fehér, a designhoz igazítva */}
                                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#ffffff' }}>
                                                {Math.round(item.cost).toLocaleString()}
                                            </td>

                                            {/* GOMB */}
                                            <td style={{ textAlign: 'center' }}>
                                                {(() => {
                                                    const isActive = activeBuildMaterial?.color === item.color && activeBuildMaterial?.thickness === item.thickness;
                                                    return (
                                                        <button
                                                            className="use-material-btn"
                                                            disabled={isDuplicate}
                                                            style={{
                                                                backgroundColor: '#111',
                                                                color: isActive ? '#ffffff' : '#888',
                                                                borderColor: isActive ? '#ffffff' : '#444',
                                                                opacity: isDuplicate ? 0.5 : 1,
                                                                cursor: isDuplicate ? 'not-allowed' : 'pointer',
                                                                fontWeight: isActive ? 'bold' : 'normal'
                                                            }}
                                                            onClick={() => {
                                                                if (!isDuplicate) {
                                                                    if (isActive) {
                                                                        setActiveBuildMaterial(null);
                                                                    } else {
                                                                        setActiveBuildMaterial({ color: item.color, thickness: item.thickness });
                                                                    }
                                                                    setPendingStartId(null);
                                                                }
                                                            }}
                                                        >
                                                            {isActive ? "USING" : "USE"}
                                                        </button>
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr><td colSpan="6" style={{textAlign:'center', color:'#555', padding:'20px'}}>No materials defined. Add one below.</td></tr>
                            )}
                            </tbody>
                        </table>
                    </div>

                    {/* PLUSZ GOMB */}
                    <div className="materials-actions" style={{
                        display: 'flex', justifyContent: 'center', padding: '10px',
                        borderTop: '1px solid #333', backgroundColor: '#0e0e0e'
                    }}>
                        <button className="add-point-inline-btn" onClick={addNewMaterial} title="Add New Material Type">
                            <span style={{ fontSize: '22px', color: 'white', fontWeight: 'bold', lineHeight: '1' }}>+</span>
                        </button>
                    </div>

                    {/* LÁBLÉC: MINDKÉT SZÖVEG SZÜRKE (#b0b0b0) */}
                    <div className="materials-footer">
                        <span style={{ fontSize: '1rem', color: '#b0b0b0', textTransform: 'uppercase', letterSpacing:'1px' }}>Total Estimate: </span>
                        <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#b0b0b0', fontFamily: 'monospace' }}>
                            {Math.round(calculatedMaterials.grandTotal).toLocaleString()} Ft
                        </span>
                    </div>
                </div>
            )}
            {showPointTable && (
                <div className="point-table-overlay" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                    <div className="point-table-header">
                        <span>POINTS EDITOR</span>
                        <button className="close-btn" onClick={() => setShowPointTable(false)}>✕</button>
                    </div>
                    <div className="point-table-scroll">
                        <table className="styled-table">

                            <tbody>
                            {world.points.length > 0 ? (
                                world.points.map(p => (
                                    <PointRow
                                        key={p.id}
                                        point={p}
                                        onMove={handleTableMove}
                                        onColorChange={handleTableColorChange}
                                        onDelete={handleTableDelete}
                                    />
                                ))
                            ) : (
                                <tr><td colSpan="5" style={{textAlign:'center', color:'#555', padding:'20px'}}>No points yet. Use AddPoint(...)</td></tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                    {/* --- ÚJ ALSÓ RÉSZ A PLUSZ GOMBBAL --- */}
                    <div className="point-table-footer">
                        <button
                            className="add-point-inline-btn"
                            onClick={() => sendCommand("AddPoint(0, 0, 0, #ffffff)")}
                            title="Add New Point (0,0,0)"
                        >
                            {/* SVG helyett karaktert használunk a biztos láthatóságért */}
                            <span style={{ fontSize: '22px', color: 'white', fontWeight: 'bold', lineHeight: '1' }}>+</span>
                        </button>
                    </div>
                </div>
            )}
            {showHelp && (
                <div className="help-overlay">
                    <div className="help-title"><h3>Commands Reference</h3><button onClick={() => {setShowHelp(false); setSearchTerm("");}}>✕</button></div>
                    <div className="help-search-container"><input ref={helpSearchRef} type="text" className="help-search-input" placeholder="Search commands (Ctrl+F)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoFocus /></div>
                    <div className="help-scroll-container">
                        {filteredCommands.length > 0 ? (
                            <table className="help-table">
                                <thead><tr><th>Syntax</th><th>Description</th><th></th></tr></thead>
                                <tbody>{filteredCommands.map((cmd, idx) => (
                                    <tr key={idx}><td><code>{cmd.syntax}</code></td><td>{cmd.desc}</td><td className="action-col"><button className="use-cmd-btn" onClick={() => fillCommand(cmd.cmd)}>Use</button></td></tr>
                                ))}</tbody>
                            </table>
                        ) : <div className="no-results">No results for "{searchTerm}"</div>}
                    </div>
                </div>
            )}
            <div className={`ui-overlay ${showTerminal ? '' : 'hidden'}`}>
                <div className="log">V: {world.points.length} • E: {world.connections.length} • F: {world.faces.length}</div>
                <div style={{display:'flex', gap:'10px'}}>
                    <div className="input-wrapper">
                        {suggestion && <div className="suggestion-ghost">{command}<span style={{opacity: 0.5}}>{suggestion.slice(command.length)}</span></div>}
                        <div className="input-bg"></div>
                        <input ref={inputRef} type="text" className="terminal-input" placeholder="Type command..." value={command} onChange={(e) => { setCommand(e.target.value); updateSuggestion(e.target.value); }} onKeyDown={handleInputKeyDown} autoFocus />
                    </div>
                    <button className="send-btn" onClick={sendCommand}>Submit</button>
                </div>
            </div>

            <Canvas camera={{ position: [8, 8, 8], fov: 50 }}>
                <ambientLight intensity={0.6} />
                <pointLight position={[10, 10, 10]} />
                <Grid infiniteGrid sectionColor={'#444'} cellColor={'#222'} fadeDistance={30} />
                <OrbitControls/>
                {world.faces.map((f, i) => <FaceMesh key={i} pointIds={f.pointIds} color={f.color} allPoints={world.points} />)}
                {world.connections.map((c, i) => {
                    const p1 = world.points.find(p => p.id === c.fromId);
                    const p2 = world.points.find(p => p.id === c.toId);
                    return p1 && p2 ? <Connection key={i} start={[p1.x, p1.y, p1.z]} end={[p2.x, p2.y, p2.z]} color={c.color} thickness={c.thickness} /> : null;
                })}
                {world.points.map(p => (
                    <Point
                        key={p.id}
                        id={p.id}
                        position={[p.x, p.y, p.z]}
                        color={
                            // Ha ez a pont a kijelölt kezdőpont, legyen villogó vagy más színű (pl. Sárga)
                            pendingStartId === p.id ? "#ffff00" : p.color
                        }
                        labelMode={labelMode}
                        // Itt adjuk át a kattintást!
                        onClick={() => handlePointClick(p.id)}
                    />
                ))}
            </Canvas>
            {/* A MODAL MEGJELENÍTÉSE */}
            {showNewProjectModal && (
                <NewProjectModal
                    onClose={() => setShowNewProjectModal(false)}
                    onCreate={handleModalSubmit} // Itt az új közös kezelőt hívjuk!
                />
            )}

            {showLoadModal && (
                <LoadProjectModal
                    onClose={() => setShowLoadModal(false)}
                    onLoad={handleLoadProject} // Ez frissíti a nevet is
                />
            )}
            {showSaveNotification && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)', // Pontosan középre igazítás
                    backgroundColor: 'black',
                    color: 'white',
                    padding: '20px 40px',
                    borderRadius: '8px',
                    zIndex: 3000, // Legyen mindennek a tetején
                    border: '1px solid #444',
                    boxShadow: '0 0 20px rgba(0,0,0,0.8)',
                    fontWeight: 'bold',
                    fontSize: '1.2em',
                    pointerEvents: 'none', // Hogy át lehessen kattintani rajta, ha útban van
                    animation: 'fadeInOut 2s ease-in-out' // Opcionális animáció
                }}>
                    Project Saved!
                </div>
            )}
        </div>
    );
}

export default App;