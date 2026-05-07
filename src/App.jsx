import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import gsap from 'gsap';
import { ParticleDispersion } from './components/ParticleDispersion';
import { SHAPE_LIBRARY } from './library/shapes';
import { parseSVGPathToPoints } from './library/svgParser';

function SliderRow({ label, value, min, max, step, onChange, display }) {
  return (
    <div className="pf-slider">
      <div className="pf-slider-head">
        <span className="pf-label">{label}</span>
        <span className="pf-slider-value">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function ColorPickerRow({ label, color, onChange }) {
  return (
    <div className="pf-slider" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
      <span className="pf-label">{label}</span>
      <label style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <span className="pf-slider-value">{color.toUpperCase()}</span>
        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: color, border: '1px solid rgba(255,255,255,0.3)', boxShadow: `0 0 10px ${color}88` }} />
        <input type="color" value={color} onChange={(e) => onChange(e.target.value)} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
      </label>
    </div>
  );
}

function createTextPoints(text, fontValue, count = 20000, scale = 0.05) {
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 800;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 800, 800);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  
  let fontSize = 300;
  if (text.length > 4) fontSize = 1200 / text.length;
  if (fontSize > 400) fontSize = 400;

  ctx.font = `900 ${fontSize}px ${fontValue}`;
  ctx.fillText(text.toUpperCase(), 400, 400);

  const imgData = ctx.getImageData(0, 0, 800, 800).data;
  const validPoints = [];

  for (let y = 0; y < 800; y += 3) {
    for (let x = 0; x < 800; x += 3) {
      if (imgData[(y * 800 + x) * 4] > 128) {
        validPoints.push({
          x: (x - 400) * scale,
          y: -(y - 400) * scale,
          z: (Math.random() - 0.5) * 1.5
        });
      }
    }
  }

  if (validPoints.length === 0) {
    for(let i=0; i<count; i++) validPoints.push({x:0, y:0, z:0});
  }

  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const pt = validPoints[Math.floor(Math.random() * validPoints.length)];
    positions[i * 3] = pt.x; positions[i * 3 + 1] = pt.y; positions[i * 3 + 2] = pt.z;
  }
  return positions;
}

const MODES = ["Organic Noise", "Vortex Swirl", "Gravity Implode", "Directional Wind"];

const FONT_OPTIONS = [
  { label: "SYSTEM SANS", value: "system-ui, -apple-system, sans-serif" },
  { label: "IMPACT", value: "Impact, Charcoal, sans-serif" },
  { label: "ARIAL BLACK", value: "'Arial Black', Gadget, sans-serif" },
  { label: "COURIER MONO", value: "'Courier New', Courier, monospace" },
  { label: "TIMES SERIF", value: "'Times New Roman', Times, serif" }
];

export default function App() {
  const [isDockOpen, setIsDockOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('settings');
  const [customText, setCustomText] = useState("");
  const [selectedFont, setSelectedFont] = useState(FONT_OPTIONS[0].value);
  
  // NEW: Modal State
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [copyTextReact, setCopyTextReact] = useState("Copy for React");
  const [copyTextFramer, setCopyTextFramer] = useState("Copy for Framer");
  
  const [imgText, setImgText] = useState("IMAGE");

  const [activeShapes, setActiveShapes] = useState(SHAPE_LIBRARY);
  const [pixelSize, setPixelSize] = useState(6.0);
  const [dispersion, setDispersion] = useState(8.0);
  const [bloomIntensity, setBloomIntensity] = useState(1.5);
  const [colorStart, setColorStart] = useState("#00f5ff");
  const [colorEnd, setColorEnd] = useState("#ff0055");
  const [dispersionMode, setDispersionMode] = useState(0);
  const [isDualTone, setIsDualTone] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const progressRef = useRef({ value: 0 });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showCodeModal) setShowCodeModal(false);
      if (e.key.toLowerCase() === 'h' && !['INPUT', 'SELECT'].includes(e.target.tagName) && !showCodeModal) {
        setIsDockOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCodeModal]);

  useEffect(() => {
    return () => gsap.killTweensOf(progressRef.current);
  }, []);

  const handleShuffle = (targetIndex) => {
    if (isAnimating || targetIndex === currentIndex) return;
    setIsAnimating(true);
    setNextIndex(targetIndex);

    gsap.to(progressRef.current, {
      value: 1.0, duration: 2.0, ease: "power2.inOut",
      onComplete: () => {
        setCurrentIndex(targetIndex);
        progressRef.current.value = 0;
        setIsAnimating(false);
      }
    });
  };

  const handleNextShape = () => {
    if (isAnimating) return;
    const next = (currentIndex + 1) % activeShapes.length;
    handleShuffle(next);
  };

  const handleSVGUpload = (e) => {
    if (isAnimating) return; 
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.type !== "image/svg+xml") return alert("Please upload a valid SVG file.");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const svgContent = event.target.result;
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, "image/svg+xml");
        const paths = doc.querySelectorAll('path');
        if (paths.length === 0) return alert("No valid <path> tags found in this SVG.");
        
        const extractedColors = new Set();
        const svgTag = doc.querySelector('svg');
        if (svgTag) {
          if (svgTag.getAttribute('fill') && svgTag.getAttribute('fill') !== 'none') extractedColors.add(svgTag.getAttribute('fill'));
          if (svgTag.getAttribute('stroke') && svgTag.getAttribute('stroke') !== 'none') extractedColors.add(svgTag.getAttribute('stroke'));
        }
        paths.forEach(p => {
          if (p.getAttribute('fill') && p.getAttribute('fill') !== 'none') extractedColors.add(p.getAttribute('fill'));
          if (p.getAttribute('stroke') && p.getAttribute('stroke') !== 'none') extractedColors.add(p.getAttribute('stroke'));
        });
        const validHexColors = Array.from(extractedColors).filter(c => /^#[0-9A-F]{6}$/i.test(c));
        if (validHexColors.length >= 2) {
          setColorStart(validHexColors[0]); setColorEnd(validHexColors[1]); setIsDualTone(true);
        } else if (validHexColors.length === 1) {
          setColorStart(validHexColors[0]); setIsDualTone(false);
        }
        let combinedPathData = "";
        paths.forEach(p => { const d = p.getAttribute('d'); if (d) combinedPathData += d + " "; });
        
        const newBuffer = parseSVGPathToPoints(combinedPathData, 20000, 1.2);
        let shortName = file.name.replace('.svg', '').toUpperCase().substring(0, 10);
        const newShape = { id: 'upload_' + Date.now(), name: shortName, buffer: newBuffer };
        
        setActiveShapes(prev => [...prev, newShape]);
        handleShuffle(activeShapes.length);
      } catch (err) { alert("Error parsing SVG file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (!customText.trim() || isAnimating) return;
    const newBuffer = createTextPoints(customText.trim(), selectedFont, 20000, 0.05);
    let shortName = customText.trim().toUpperCase().substring(0, 8);
    const newShape = { id: 'text_' + Date.now(), name: `T: ${shortName}`, buffer: newBuffer };
    setActiveShapes(prev => [...prev, newShape]);
    handleShuffle(activeShapes.length);
    setCustomText(""); 
  };

  const handleDownloadImage = () => {
    const canvas = document.querySelector('.pf-canvas canvas');
    if (!canvas) return;
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Dispersion_Render_${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    setImgText("SAVED!");
    setTimeout(() => setImgText("IMAGE"), 2000);
  };

  // NEW: Split Copy Logic
  const handleCopyReact = () => {
    const codeSnippet = `
import { ParticleDispersion } from "./ParticleDispersion" 

// Drop this into your React Three Fiber <Canvas>
<ParticleDispersion 
  dispersionStrength={${dispersion.toFixed(1)}}
  pointSize={${pixelSize.toFixed(1)}}
  colorStart="${colorStart}"
  colorEnd="${colorEnd}"
  dispersionMode={${dispersionMode}}
  isDualTone={${isDualTone}}
  autoRotate={${autoRotate}}
  shapeA={myGeometryBufferArray} 
  shapeB={myTargetBufferArray}
  progressRef={myGsapProgressRef}
/>
`.trim();

    navigator.clipboard.writeText(codeSnippet);
    setCopyTextReact("COPIED!");
    setTimeout(() => {
      setCopyTextReact("Copy for React");
      setShowCodeModal(false);
    }, 1500);
  };

  const handleCopyFramer = () => {
    const codeSnippet = `
import * as React from "react"
import { addPropertyControls, ControlType } from "framer"
import { Canvas } from "https://esm.sh/@react-three/fiber"
import { EffectComposer, Bloom } from "https://esm.sh/@react-three/postprocessing"
import * as THREE from "https://esm.sh/three"

// ⚠️ IMPORTANT: Paste the ParticleDispersion material code below this file!
import { ParticleDispersion } from "./ParticleDispersion" 

export default function DispersionEngine(props) {
    const progressRef = React.useRef({ value: props.morphProgress })

    React.useEffect(() => {
        if (progressRef.current) progressRef.current.value = props.morphProgress
    }, [props.morphProgress])

    return (
        <div style={{ width: "100%", height: "100%", background: props.backgroundColor }}>
            <Canvas camera={{ position: [0, 0, 30] }} dpr={[1, 1.5]} gl={{ antialias: false, powerPreference: "high-performance", alpha: true }}>
                <ParticleDispersion 
                    dispersionStrength={props.turbulence}
                    pointSize={props.pointSize}
                    colorStart={props.primaryColor}
                    colorEnd={props.secondaryColor}
                    dispersionMode={props.behaviorMode}
                    isDualTone={props.isDualTone}
                    autoRotate={props.autoRotate}
                    progressRef={progressRef}
                />
                {props.enableBloom && (
                    <EffectComposer disableNormalPass multisampling={0}>
                        <Bloom luminanceThreshold={0.1} mipmapBlur intensity={props.bloomIntensity} resolutionScale={0.5} />
                    </EffectComposer>
                )}
            </Canvas>
        </div>
    )
}

addPropertyControls(DispersionEngine, {
    primaryColor: { type: ControlType.Color, title: "Primary Hue", defaultValue: "${colorStart}" },
    secondaryColor: { type: ControlType.Color, title: "Secondary Hue", defaultValue: "${colorEnd}", hidden(props) { return !props.isDualTone } },
    isDualTone: { type: ControlType.Boolean, title: "Dual Tone", defaultValue: ${isDualTone} },
    behaviorMode: { type: ControlType.Enum, title: "Behavior", options: [0, 1, 2, 3], optionTitles: ["Organic", "Vortex", "Implode", "Wind"], defaultValue: ${dispersionMode} },
    turbulence: { type: ControlType.Number, title: "Turbulence", defaultValue: ${dispersion}, min: 0, max: 20 },
    pointSize: { type: ControlType.Number, title: "Point Size", defaultValue: ${pixelSize}, min: 1, max: 32 },
    autoRotate: { type: ControlType.Boolean, title: "Auto Rotate", defaultValue: ${autoRotate} },
    enableBloom: { type: ControlType.Boolean, title: "Enable Bloom", defaultValue: true },
    bloomIntensity: { type: ControlType.Number, title: "Bloom Glow", defaultValue: ${bloomIntensity}, min: 0, max: 5, step: 0.1, hidden(props) { return !props.enableBloom } },
    backgroundColor: { type: ControlType.Color, title: "Background", defaultValue: "#000000" },
    morphProgress: { type: ControlType.Number, title: "Morph Progress", defaultValue: 0, min: 0, max: 1, step: 0.01 }
})
`.trim();

    navigator.clipboard.writeText(codeSnippet);
    setCopyTextFramer("COPIED!");
    setTimeout(() => {
      setCopyTextFramer("Copy for Framer");
      setShowCodeModal(false);
    }, 1500);
  };

  const uiColor = isDualTone ? `linear-gradient(135deg, ${colorStart}, ${colorEnd})` : colorStart;

  return (
    <div className="pf-root">
      <Canvas 
        className="pf-canvas" 
        camera={{ position: [0, 0, 30] }} 
        dpr={[1, 1.5]} 
        gl={{ antialias: false, powerPreference: "high-performance", alpha: false, preserveDrawingBuffer: true }}
      >
        <ParticleDispersion 
          shapeA={activeShapes[currentIndex].buffer}
          shapeB={activeShapes[nextIndex].buffer}
          progressRef={progressRef}
          dispersionStrength={dispersion}
          pointSize={pixelSize}
          colorStart={colorStart}
          colorEnd={colorEnd}
          dispersionMode={dispersionMode}
          isDualTone={isDualTone}
          autoRotate={autoRotate}
        />
        <EffectComposer disableNormalPass multisampling={0}>
          <Bloom luminanceThreshold={0.1} mipmapBlur intensity={bloomIntensity} resolutionScale={0.5} />
        </EffectComposer>
      </Canvas>

      <div className="pf-header" style={{ opacity: isDockOpen ? 1 : 0.2, transition: 'opacity 0.4s ease' }}>
        <div className="pf-wordmark">
          <div className="pf-wordmark-row">
            <span className="pf-wordmark-dot" style={{ background: uiColor, boxShadow: `0 0 8px ${colorStart}88` }} />
            <span className="pf-wordmark-title">DISPERSION ENGINE</span>
          </div>
          <div className="pf-wordmark-sub">WEBGL / SHADER / REACT</div>
        </div>
        <div className="pf-actions">
          {isDockOpen && (
            <>
              <button onClick={handleDownloadImage} className="pf-icon-btn pf-action-btn" title="Download High-Res Render">
                <span>⤓</span> {imgText}
              </button>
              {/* NOW OPENS MODAL INSTEAD OF COPYING DIRECTLY */}
              <button onClick={() => setShowCodeModal(true)} className="pf-icon-btn pf-action-btn" title="Export Configuration">
                <span>&lt;/&gt;</span> EXPORT
              </button>
            </>
          )}
        </div>
      </div>

      <div className="pf-bottom-dock">
        <div className="pf-quick-bar">
          <button className="pf-dock-toggle" onClick={handleNextShape} title="Next Shape" style={{ opacity: isAnimating ? 0.5 : 1, cursor: isAnimating ? 'wait' : 'pointer' }}>
            <span className="pf-pixel" style={{ background: uiColor, boxShadow: `0 0 10px ${colorStart}88` }} />
            NEXT SHAPE
          </button>
          
          <button className="pf-dock-toggle" onClick={() => setIsDockOpen(!isDockOpen)} title="Toggle Controls (H)">
            {isDockOpen ? '▼ HIDE SETTINGS' : '▲ SHOW SETTINGS'}
          </button>
        </div>

        <div className={`pf-dock-panel-wrapper ${!isDockOpen ? 'closed' : ''}`}>
          <div className="pf-dock-panel">
            <div className="pf-dock-panel-inner">
              
              <div className="pf-tabs">
                <button onClick={() => setActiveTab('shuffle')} className={"pf-tab " + (activeTab === 'shuffle' ? 'active' : '')} style={activeTab === 'shuffle' ? { borderColor: colorStart, color: '#fff', background: `${colorStart}22` } : {}}>
                  SHAPE LIBRARY
                </button>
                <button onClick={() => setActiveTab('text')} className={"pf-tab " + (activeTab === 'text' ? 'active' : '')} style={activeTab === 'text' ? { borderColor: colorStart, color: '#fff', background: `${colorStart}22` } : {}}>
                  CUSTOM TEXT
                </button>
                <button onClick={() => setActiveTab('settings')} className={"pf-tab " + (activeTab === 'settings' ? 'active' : '')} style={activeTab === 'settings' ? { borderColor: colorStart, color: '#fff', background: `${colorStart}22` } : {}}>
                  ENGINE SETTINGS
                </button>
              </div>

              <div className="pf-tab-content">
                {activeTab === 'shuffle' && (
                  <div className="pf-section">
                    <div className="pf-label" style={{ marginBottom: '8px' }}>Active Shape Library</div>
                    <div className="pf-row">
                      {activeShapes.map((shape, index) => (
                        <button
                          key={shape.id} onClick={() => handleShuffle(index)}
                          className={"pf-pill" + (currentIndex === index ? " active" : "")}
                          style={{ opacity: isAnimating ? 0.5 : 1, cursor: isAnimating ? "wait" : "pointer" }}
                        >
                          <span className="pf-pixel" style={currentIndex === index ? { background: uiColor, boxShadow: `0 0 10px ${colorStart}88` } : {}} />
                          <span>{shape.name}</span>
                        </button>
                      ))}
                      <label className="pf-pill" style={{ cursor: isAnimating ? "wait" : "pointer", borderStyle: "dashed", opacity: isAnimating ? 0.5 : 1 }}>
                        <span>+ UPLOAD SVG</span>
                        <input type="file" accept=".svg" style={{ display: "none" }} onChange={handleSVGUpload} disabled={isAnimating} />
                      </label>
                    </div>
                  </div>
                )}

                {activeTab === 'text' && (
                  <form onSubmit={handleTextSubmit} className="pf-section" style={{ display: 'flex', flexDirection: 'row', gap: '12px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <div className="pf-label" style={{ marginBottom: '8px' }}>Generate Vector Text</div>
                      <input 
                        type="text" className="pf-text-input" placeholder="TYPE SOMETHING..." 
                        value={customText} onChange={(e) => setCustomText(e.target.value)} 
                        maxLength={12} disabled={isAnimating}
                      />
                    </div>
                    
                    <div style={{ flex: 0.5 }}>
                      <div className="pf-label" style={{ marginBottom: '8px' }}>Font</div>
                      <select className="pf-select-input" value={selectedFont} onChange={(e) => setSelectedFont(e.target.value)} disabled={isAnimating}>
                        {FONT_OPTIONS.map(font => (
                          <option key={font.label} value={font.value}>{font.label}</option>
                        ))}
                      </select>
                    </div>

                    <button type="submit" className="pf-pill active" style={{ height: '40px', padding: '0 24px', background: uiColor, borderColor: 'transparent', opacity: isAnimating ? 0.5 : 1, cursor: isAnimating ? "wait" : "pointer" }}>
                      <span style={{ color: '#000', fontWeight: 'bold' }}>GENERATE</span>
                    </button>
                  </form>
                )}

                {activeTab === 'settings' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '32px' }}>
                      <div className="pf-section" style={{ flex: 1 }}>
                        <div className="pf-label" style={{ marginBottom: '8px' }}>Turbulence Behavior</div>
                        <div className="pf-row">
                          {MODES.map((name, idx) => (
                            <button key={name} onClick={() => setDispersionMode(idx)} className={"pf-pill" + (dispersionMode === idx ? " active" : "")}>
                              <span className="pf-pixel" style={dispersionMode === idx ? { background: uiColor, boxShadow: `0 0 10px ${colorStart}88` } : {}} />
                              <span>{name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pf-section">
                        <div className="pf-label" style={{ marginBottom: '8px' }}>Render Toggles</div>
                        <div className="pf-row">
                          <button onClick={() => setIsDualTone(!isDualTone)} className={"pf-pill" + (!isDualTone ? " active" : "")}>
                            <span>MONOCHROME</span>
                          </button>
                          <button onClick={() => setAutoRotate(!autoRotate)} className={"pf-pill" + (!autoRotate ? " active" : "")}>
                            <span style={{ color: !autoRotate ? '#ff4444' : 'inherit' }}>{autoRotate ? "ANIMATED" : "STATIC MODE"}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="pf-sliders" style={{ paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <SliderRow label="Point Size" value={pixelSize} min={1} max={32} step={1} onChange={setPixelSize} display={pixelSize.toFixed(1)} />
                      <SliderRow label="Turbulence" value={dispersion} min={0} max={20} step={1} onChange={setDispersion} display={dispersion.toString()} />
                      <SliderRow label="Bloom Glow" value={bloomIntensity} min={0} max={5} step={0.1} onChange={setBloomIntensity} display={bloomIntensity.toFixed(1)} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <ColorPickerRow label={isDualTone ? "Primary Hue" : "Base Hue"} color={colorStart} onChange={setColorStart} />
                        {isDualTone && <ColorPickerRow label="Secondary Hue" color={colorEnd} onChange={setColorEnd} />}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Modal Overlay UI */}
      {showCodeModal && (
        <div className="pf-modal-overlay" onClick={() => setShowCodeModal(false)}>
          <div className="pf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pf-modal-title">
              EXPORT CONFIGURATION
              <button className="pf-modal-close" onClick={() => setShowCodeModal(false)}>×</button>
            </div>
            
            <button className="pf-modal-btn" onClick={handleCopyFramer}>
              <span className="pf-modal-btn-title" style={{ color: colorStart }}>{copyTextFramer}</span>
              <span className="pf-modal-btn-desc">Generates a complete component with addPropertyControls ready for Framer's cloud editor.</span>
            </button>
            
            <button className="pf-modal-btn" onClick={handleCopyReact}>
              <span className="pf-modal-btn-title">{copyTextReact}</span>
              <span className="pf-modal-btn-desc">Generates standard JSX props to drop into an existing Next.js, Vite, or React Three Fiber project.</span>
            </button>
          </div>
        </div>
      )}

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .pf-root { width: 100vw; height: 100vh; overflow: hidden; background: #000; position: relative; font-family: system-ui, -apple-system, sans-serif; -webkit-user-select: none; user-select: none; }
        .pf-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: crosshair; touch-action: none; z-index: 1; }
        .pf-header { position: absolute; top: 12px; left: 12px; right: 12px; z-index: 10; display: flex; justify-content: space-between; align-items: flex-start; pointer-events: none; }
        .pf-wordmark { pointer-events: none; }
        .pf-wordmark-row { display: flex; align-items: center; gap: 8px; }
        .pf-wordmark-dot { width: 7px; height: 7px; border-radius: 2px; transition: all 0.3s; }
        .pf-wordmark-title { font-family: ui-monospace, monospace; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.95); letter-spacing: 0.14em; }
        .pf-wordmark-sub { margin-top: 4px; font-family: ui-monospace, monospace; font-size: 9.5px; color: rgba(255,255,255,0.4); letter-spacing: 0.15em; padding-left: 15px; }
        .pf-actions { display: flex; gap: 8px; pointer-events: auto; }
        .pf-icon-btn { background: rgba(15,15,20,0.7); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; backdrop-filter: blur(12px); transition: all 0.2s; }
        .pf-icon-btn:hover { background: rgba(25,25,30,0.9); color: #fff; border-color: rgba(255,255,255,0.3); }
        .pf-action-btn { padding: 0 12px; font-family: ui-monospace, monospace; font-size: 10px; font-weight: 600; letter-spacing: 0.1em; gap: 6px; }
        .pf-action-btn span { font-size: 14px; opacity: 0.7; }
        .pf-bottom-dock { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); width: calc(100% - 24px); max-width: 800px; z-index: 10; display: flex; flex-direction: column; pointer-events: none; }
        .pf-quick-bar { display: flex; gap: 8px; justify-content: center; margin-bottom: 8px; pointer-events: auto; }
        .pf-dock-toggle { display: inline-flex; align-items: center; justify-content: center; padding: 8px 18px; border-radius: 20px; background: rgba(10,10,14,0.72); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.8); font-family: ui-monospace, monospace; font-size: 10px; font-weight: 600; letter-spacing: 0.15em; cursor: pointer; backdrop-filter: blur(12px); transition: all 0.2s; gap: 8px; }
        .pf-dock-toggle:hover { background: rgba(25,25,30,0.9); color: #fff; border-color: rgba(255,255,255,0.3); }
        .pf-dock-panel-wrapper { display: grid; grid-template-rows: 1fr; transition: grid-template-rows 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease; width: 100%; pointer-events: auto; opacity: 1; }
        .pf-dock-panel-wrapper.closed { grid-template-rows: 0fr; opacity: 0; pointer-events: none; }
        .pf-dock-panel { overflow: hidden; }
        .pf-dock-panel-inner { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
        .pf-tabs { display: flex; gap: 8px; justify-content: center; }
        .pf-tab { padding: 8px 20px; border-radius: 20px; background: rgba(10,10,14,0.72); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); font-family: ui-monospace, monospace; font-size: 10.5px; font-weight: 600; letter-spacing: 0.1em; cursor: pointer; backdrop-filter: blur(12px); transition: all 0.2s; }
        .pf-tab:hover { color: #fff; background: rgba(20,20,25,0.8); }
        .pf-tab-content { padding: 16px; background: rgba(10,10,14,0.72); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; backdrop-filter: blur(20px) saturate(1.2); box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02) inset; }
        .pf-section { display: flex; flex-direction: column; }
        .pf-label { font-family: ui-monospace, monospace; font-size: 9.5px; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.35); }
        .pf-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .pf-pill { display: inline-flex; align-items: center; gap: 8px; padding: 7px 12px 7px 9px; border-radius: 8px; background: rgba(20,20,25,0.55); border: 1px solid rgba(255,255,255,0.07); color: rgba(255,255,255,0.55); font-family: ui-monospace, monospace; font-size: 10.5px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; backdrop-filter: blur(8px); }
        .pf-pill:hover { border-color: rgba(255,255,255,0.18); color: rgba(255,255,255,0.85); }
        .pf-pill.active { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.4); color: #fff; }
        .pf-pixel { width: 10px; height: 10px; border-radius: 3px; background: rgba(255,255,255,0.15); position: relative; transition: all 0.25s; }
        .pf-text-input, .pf-select-input { width: 100%; height: 40px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-family: ui-monospace, monospace; font-size: 14px; padding: 0 16px; outline: none; transition: all 0.2s; }
        .pf-text-input:focus, .pf-select-input:focus { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); }
        .pf-select-input { cursor: pointer; appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E"); background-repeat: no-repeat; background-position: right 12px top 50%; background-size: 10px auto; }
        .pf-select-input option { background: #111; color: #fff; font-family: sans-serif; }
        .pf-sliders { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .pf-slider { display: flex; flex-direction: column; gap: 5px; }
        .pf-slider-head { display: flex; justify-content: space-between; align-items: baseline; }
        .pf-slider-value { font-family: ui-monospace, monospace; font-size: 10px; font-weight: 500; color: rgba(255,255,255,0.85); letter-spacing: 0.04em; }
        .pf-slider input[type="range"] { -webkit-appearance: none; appearance: none; width: 100%; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; outline: none; cursor: pointer; }
        .pf-slider input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: white; cursor: pointer; box-shadow: 0 0 10px rgba(255,255,255,0.4); }
        
        /* NEW MODAL STYLES */
        .pf-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 100; display: flex; align-items: center; justify-content: center; }
        .pf-modal { background: rgba(15,15,20,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; width: 400px; max-width: 90%; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
        .pf-modal-title { font-family: ui-monospace, monospace; font-size: 14px; font-weight: 600; color: #fff; letter-spacing: 0.1em; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .pf-modal-close { background: none; border: none; color: rgba(255,255,255,0.5); font-size: 20px; cursor: pointer; transition: color 0.2s; padding: 0 4px; }
        .pf-modal-close:hover { color: #fff; }
        .pf-modal-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 16px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 6px; text-align: left; transition: all 0.2s; }
        .pf-modal-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); }
        .pf-modal-btn-title { font-family: ui-monospace, monospace; font-size: 13px; font-weight: 600; letter-spacing: 0.05em; color: #fff; transition: color 0.2s; }
        .pf-modal-btn-desc { font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4; color: rgba(255,255,255,0.5); }
      `}</style>
    </div>
  );
}