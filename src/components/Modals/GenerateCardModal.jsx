import React, { useRef, useEffect, useState } from 'react';
import { X, Download, Image as ImageIcon, Sliders, Layers, Upload, Copy, Share2, CalendarClock } from 'lucide-react';
import { getThumbnailUrl, BOT_API_URL, getAdminKey, setAdminKey } from '../../utils.js';

export default function GenerateCardModal({ student, onClose }) {
  const canvasRef = useRef(null);
  const [templateImg, setTemplateImg] = useState(null);
  const [userImg, setUserImg] = useState(null);
  
  // Controls state
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [photoLayer, setPhotoLayer] = useState('behind'); // 'behind' or 'above'
  const [textY, setTextY] = useState(330);
  const [textSize, setTextSize] = useState(56);
  const [textColor, setTextColor] = useState('#f9f2e3');
  const [fontLoaded, setFontLoaded] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('00:00');
  const [targetGroup, setTargetGroup] = useState(() => {
    return localStorage.getItem('foc_target_group') || 'FOC USJ Birthdays';
  });

  const handleTargetGroupChange = (val) => {
    setTargetGroup(val);
    localStorage.setItem('foc_target_group', val);
  };

  // Canvas fixed dimensions
  const CANVAS_W = 1080;
  const CANVAS_H = 1350;

  useEffect(() => {
    const font = new FontFace('Megasta', 'url(/megasta-signateria-serif.otf)');
    font.load().then((loadedFont) => {
      document.fonts.add(loadedFont);
      setFontLoaded(true);
    }).catch(err => {
      console.error("Failed to load font", err);
      setFontLoaded(true);
    });
  }, []);

  useEffect(() => {
    // Load Template Image
    const tImg = new Image();
    tImg.crossOrigin = "anonymous";
    tImg.src = '/Template FOC BD.png';
    tImg.onload = () => setTemplateImg(tImg);

    // Load User Image
    const uImg = new Image();
    uImg.crossOrigin = "anonymous";
    // Get high-res image if possible, but fallback to thumbnail
    uImg.src = student.photo_url || getThumbnailUrl(student);
    uImg.onload = () => {
        // Initial defaults based on image aspect ratio vs canvas
        // Let's make it cover roughly 50% of the canvas initially
        const targetSize = Math.min(CANVAS_W, CANVAS_H) * 0.8;
        const initialScale = targetSize / Math.max(uImg.width, uImg.height);
        setScale(initialScale);
        
        setUserImg(uImg);
    };
    uImg.onerror = () => {
        // Fallback to placeholder if user image fails
        uImg.src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=600";
    }
  }, [student]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const uImg = new Image();
    // No crossOrigin needed for local blob object URLs
    uImg.src = url;
    uImg.onload = () => {
        const targetSize = Math.min(CANVAS_W, CANVAS_H) * 0.8;
        const initialScale = targetSize / Math.max(uImg.width, uImg.height);
        setScale(initialScale);
        setPanX(0);
        setPanY(0);
        setUserImg(uImg);
    };
  };

  useEffect(() => {
    if (!templateImg || !userImg || !canvasRef.current || !fontLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Calculate user image position
    const uW = userImg.width * scale;
    const uH = userImg.height * scale;
    // Center it initially, then apply pan
    const centerX = (CANVAS_W - uW) / 2 + panX;
    const centerY = (CANVAS_H - uH) / 2 + panY;

    if (photoLayer === 'behind') {
        // Draw User Photo first (Behind)
        ctx.drawImage(userImg, centerX, centerY, uW, uH);
        // Draw Template (Top)
        ctx.drawImage(templateImg, 0, 0, CANVAS_W, CANVAS_H);
    } else {
        // Draw Template first (Behind)
        ctx.drawImage(templateImg, 0, 0, CANVAS_W, CANVAS_H);
        // Draw User Photo (Top)
        ctx.drawImage(userImg, centerX, centerY, uW, uH);
    }

    // Draw Student Name and Frame
    const nameText = student.featured_name || student.name || "Student";
    const fontSize = textSize;
    
    // Save context to apply rotation
    ctx.save();
    
    // Translate to the center of the frame's expected position to rotate around it
    // The frame is centered horizontally, and vertically around textY
    ctx.translate(CANVAS_W / 2, textY);
    ctx.rotate((-3 * Math.PI) / 180);

    ctx.font = `${fontSize}px Megasta, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textMetrics = ctx.measureText(nameText);
    const textWidth = textMetrics.width;
    
    // Frame padding
    const paddingX = 20;
    const paddingY = 8;
    const frameWidth = textWidth + paddingX * 2;
    const frameHeight = fontSize + paddingY * 2;
    // Because we translated to (CANVAS_W/2, textY), the new origin is there.
    // So X goes from -frameWidth/2 to frameWidth/2
    // Y goes from -frameHeight/2 to frameHeight/2
    const frameX = -frameWidth / 2;
    const frameY = -frameHeight / 2;
    const radius = frameHeight / 2; // Pill shape

    // Draw Double Frame
    ctx.strokeStyle = textColor;

    // Outer frame
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(frameX, frameY, frameWidth, frameHeight, radius);
    ctx.stroke();

    // Inner frame
    const innerOffset = 4;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(
        frameX + innerOffset, 
        frameY + innerOffset, 
        frameWidth - innerOffset * 2, 
        frameHeight - innerOffset * 2, 
        radius - innerOffset
    );
    ctx.stroke();

    // Draw Text
    ctx.fillStyle = textColor;
    // Small shadow for text readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    // Y is slightly offset because textBaseline middle sometimes isn't visually centered depending on font
    ctx.fillText(nameText, 0, 4);
    
    // Restore context to remove rotation/translation for anything else
    ctx.restore();

  }, [templateImg, userImg, scale, panX, panY, photoLayer, fontLoaded, textY, textSize, textColor, student]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Birthday_Card_${student.featured_name.replace(/\s+/g, '_')}.png`;
    link.href = dataUrl;
    link.click();
  };

  const studentName = student.featured_name || student.name || 'Student';
  const [caption, setCaption] = useState(
    `Happy Birthday from the Faculty of Computing at USJ! 🎉💻🎂\n\nWishing you a year where your programs compile on the first try, your joy causes a stack overflow, and your future shines as bright as your screen in dark mode.🥳💾🎈\n\n#FOC\n#USJ`
  );

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(caption).then(() => {
        alert("Caption copied to clipboard!");
    }).catch(err => {
        console.error("Failed to copy text: ", err);
        alert("Failed to copy caption");
    });
  };

  const handleShareWhatsApp = async () => {
    if (!canvasRef.current) return;
    setIsSending(true);

    canvasRef.current.toBlob(async (blob) => {
        if (!blob) {
            alert("Failed to generate image.");
            setIsSending(false);
            return;
        }

        const fileName = `Birthday_Card_${studentName.replace(/\s+/g, '_')}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        // 1. Copy image to Clipboard for instant pasting (Ctrl+V) into WhatsApp
        try {
            if (navigator.clipboard && window.ClipboardItem) {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
            }
        } catch (clipErr) {
            console.log("Could not copy image to clipboard:", clipErr);
        }

        // 2. Copy caption text to clipboard
        try {
            await navigator.clipboard.writeText(caption);
        } catch (e) {
            console.log("Could not copy caption text to clipboard:", e);
        }

        // 3. Try sending automatically via local WhatsApp Bot API if active
        let botSent = false;
        try {
            const formData = new FormData();
            formData.append('image', blob, fileName);
            formData.append('caption', caption);
            formData.append('targetGroup', targetGroup.trim() || 'FOC USJ Birthdays');

            let adminKey = getAdminKey();
            let response = await fetch(`${BOT_API_URL}/send-to-group`, {
                method: 'POST',
                headers: { ...(adminKey && { 'x-admin-key': adminKey }) },
                body: formData
            });

            if (response.status === 401) {
                const enteredKey = prompt("Sending WhatsApp messages requires the Admin Key. Please enter it:");
                if (enteredKey) {
                    setAdminKey(enteredKey);
                    response = await fetch(`${BOT_API_URL}/send-to-group`, {
                        method: 'POST',
                        headers: { 'x-admin-key': enteredKey.trim() },
                        body: formData
                    });
                }
            }

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    botSent = true;
                    alert("Successfully sent the birthday card & caption to WhatsApp group via Bot!");
                }
            }
        } catch (error) {
            console.log("WhatsApp Bot server not active:", error);
        }

        // 4. Try Web Share API (Mobile devices / Native app share)
        let sharedViaNative = false;
        if (!botSent) {
            try {
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: `Happy Birthday ${studentName}!`,
                        text: caption
                    });
                    sharedViaNative = true;
                }
            } catch (shareError) {
                console.log("Web Share API skipped or cancelled:", shareError);
            }
        }

        // 5. Open WhatsApp Application / WhatsApp Web if not sent via Bot or Native Share
        if (!botSent && !sharedViaNative) {
            const encodedText = encodeURIComponent(caption);
            const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
            window.open(whatsappUrl, '_blank');
            alert("Opening WhatsApp with caption! The card image has been copied to your clipboard — press Ctrl+V (Paste) in your chat to attach the image.");
        }

        setIsSending(false);
    }, 'image/png');
  };

  const handleScheduleWhatsApp = async () => {
    if (!canvasRef.current) return;

    // Calculate upcoming birthday + selected time
    const parts = student.birthday.split('/');
    if (parts.length !== 3) {
        alert("Invalid birthday format for this student.");
        return;
    }
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    
    const now = new Date();
    let targetDate = new Date(now.getFullYear(), month, day);
    
    // If birthday has passed this year (comparing dates ignoring time)
    if (targetDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        targetDate.setFullYear(now.getFullYear() + 1);
    }

    const [hours, minutes] = scheduleTime.split(':');
    targetDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

    // If target date with time is in the past (e.g. today earlier), schedule for next year
    if (targetDate <= now) {
        targetDate.setFullYear(targetDate.getFullYear() + 1);
    }

    setIsSending(true);

    canvasRef.current.toBlob(async (blob) => {
        if (!blob) {
            alert("Failed to generate image.");
            setIsSending(false);
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append('image', blob, `Birthday_Card_${studentName.replace(/\s+/g, '_')}.png`);
            formData.append('caption', caption);
            formData.append('targetGroup', targetGroup.trim() || 'FOC USJ Birthdays'); 
            formData.append('scheduledTime', targetDate.toISOString());

            let adminKey = getAdminKey();
            let response = await fetch(`${BOT_API_URL}/schedule-card`, {
                method: 'POST',
                headers: { ...(adminKey && { 'x-admin-key': adminKey }) },
                body: formData
            });

            if (response.status === 401) {
                const enteredKey = prompt("Scheduling WhatsApp messages requires the Admin Key. Please enter it:");
                if (enteredKey) {
                    setAdminKey(enteredKey);
                    response = await fetch(`${BOT_API_URL}/schedule-card`, {
                        method: 'POST',
                        headers: { 'x-admin-key': enteredKey.trim() },
                        body: formData
                    });
                }
            }

            const result = await response.json();
            
            if (result.success) {
                alert(`Successfully scheduled! The card will be sent on ${targetDate.toLocaleString()}`);
            } else {
                alert(`Failed to schedule: ${result.message}`);
            }
        } catch (error) {
            console.error("Network or API error:", error);
            alert("Could not connect to the WhatsApp Bot API. Please ensure the bot service is running.");
        } finally {
            setIsSending(false);
        }
    }, 'image/png');
  };

  const [activeTab, setActiveTab] = useState('photo'); // 'photo', 'text', 'message'

  return (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target.classList.contains('modal-overlay')) onClose();
    }}>
      <div className="modal-content glass-panel generate-modal">
        <div className="modal-header">
          <h2><ImageIcon size={20} /> Generate Birthday Card</h2>
          <button className="icon-btn close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="generate-layout">
          <div className="canvas-preview-area">
            <div className="canvas-wrapper">
                <canvas 
                    ref={canvasRef} 
                    width={CANVAS_W} 
                    height={CANVAS_H}
                    className="preview-canvas"
                />
            </div>
            {!templateImg || !userImg ? (
                <div className="canvas-loading">Loading assets...</div>
            ) : null}
          </div>

          <div className="canvas-controls-area">
            {/* Control Tabs */}
            <div className="control-tabs">
              <button 
                className={`tab-btn ${activeTab === 'photo' ? 'active' : ''}`}
                onClick={() => setActiveTab('photo')}
              >
                <Upload size={15} /> Photo
              </button>
              <button 
                className={`tab-btn ${activeTab === 'text' ? 'active' : ''}`}
                onClick={() => setActiveTab('text')}
              >
                <Sliders size={15} /> Text & Style
              </button>
              <button 
                className={`tab-btn ${activeTab === 'message' ? 'active' : ''}`}
                onClick={() => setActiveTab('message')}
              >
                <Share2 size={15} /> Caption
              </button>
            </div>

            {activeTab === 'photo' && (
              <div className="tab-pane">
                <h3><Sliders size={18} /> Adjust Photo</h3>
                
                <div className="control-group" style={{ marginBottom: '8px' }}>
                    <label className="file-upload-label" style={{ padding: '14px 12px', marginTop: 0, gap: '8px' }}>
                        <Upload size={20} />
                        <span>Upload Custom Photo</span>
                        <input type="file" accept="image/*" onChange={handleImageUpload} />
                    </label>
                </div>

                <div className="control-group">
                    <label>Layer Order <Layers size={14}/></label>
                    <div className="toggle-group">
                        <button 
                            className={`toggle-btn ${photoLayer === 'behind' ? 'active' : ''}`}
                            onClick={() => setPhotoLayer('behind')}
                        >
                            Photo Behind
                        </button>
                        <button 
                            className={`toggle-btn ${photoLayer === 'above' ? 'active' : ''}`}
                            onClick={() => setPhotoLayer('above')}
                        >
                            Photo Above
                        </button>
                    </div>
                    <small className="control-hint">If template middle is transparent, use 'Behind'.</small>
                </div>

                <div className="control-group">
                    <label>Scale ({scale.toFixed(2)}x)</label>
                    <input 
                        type="range" 
                        min="0.1" 
                        max="5" 
                        step="0.05" 
                        value={scale} 
                        onChange={(e) => setScale(parseFloat(e.target.value))} 
                    />
                </div>

                <div className="control-group">
                    <label>Horizontal Pan (X: {panX}px)</label>
                    <input 
                        type="range" 
                        min={-CANVAS_W} 
                        max={CANVAS_W} 
                        step="10" 
                        value={panX} 
                        onChange={(e) => setPanX(parseInt(e.target.value))} 
                    />
                </div>

                <div className="control-group">
                    <label>Vertical Pan (Y: {panY}px)</label>
                    <input 
                        type="range" 
                        min={-CANVAS_H} 
                        max={CANVAS_H} 
                        step="10" 
                        value={panY} 
                        onChange={(e) => setPanY(parseInt(e.target.value))} 
                    />
                </div>
              </div>
            )}

            {activeTab === 'text' && (
              <div className="tab-pane">
                <h3><Sliders size={18} /> Name & Text Style</h3>

                <div className="control-group">
                    <label>Name Text Y (Y: {textY}px)</label>
                    <input 
                        type="range" 
                        min="0" 
                        max={CANVAS_H} 
                        step="5" 
                        value={textY} 
                        onChange={(e) => setTextY(parseInt(e.target.value))} 
                    />
                </div>

                <div className="control-group">
                    <label>Name Text Size ({textSize}px)</label>
                    <input 
                        type="range" 
                        min="20" 
                        max="150" 
                        step="1" 
                        value={textSize} 
                        onChange={(e) => setTextSize(parseInt(e.target.value))} 
                    />
                </div>

                <div className="control-group">
                    <label>Name Text Color</label>
                    <input 
                        type="color" 
                        value={textColor} 
                        onChange={(e) => setTextColor(e.target.value)} 
                        style={{ width: '100%', height: '40px', cursor: 'pointer' }}
                    />
                </div>
              </div>
            )}

            {activeTab === 'message' && (
              <div className="tab-pane">
                <h3><Share2 size={18} /> Caption & Delivery</h3>

                <div className="control-group">
                    <label>Target WhatsApp Group</label>
                    <input 
                        type="text" 
                        value={targetGroup} 
                        onChange={(e) => handleTargetGroupChange(e.target.value)} 
                        placeholder="e.g. FOC USJ Birthdays"
                        style={{ 
                            width: '100%', 
                            padding: '10px', 
                            borderRadius: 'var(--radius-sm)', 
                            border: '1px solid var(--border-glass)', 
                            background: 'rgba(0,0,0,0.15)', 
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            marginTop: '6px'
                        }}
                    />
                    <small className="control-hint" style={{ marginTop: '4px', display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      Exact name of the WhatsApp group where the bot is a member.
                    </small>
                </div>

                <div className="control-group">
                    <label>WhatsApp Message / Caption</label>
                    <textarea 
                        rows={4}
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        style={{ 
                            width: '100%', 
                            padding: '10px', 
                            borderRadius: 'var(--radius-sm)', 
                            border: '1px solid var(--border-glass)', 
                            background: 'rgba(0,0,0,0.15)', 
                            color: 'var(--text-primary)',
                            resize: 'vertical',
                            fontSize: '0.85rem',
                            fontFamily: 'inherit',
                            marginTop: '6px'
                        }}
                    />
                </div>

                <div className="control-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label>Schedule Delivery Time</label>
                      <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }}>
                        {scheduleTime === '00:00' ? '12:00 AM (Midnight)' : `${scheduleTime}`}
                      </span>
                    </div>
                    <input 
                        type="time" 
                        value={scheduleTime} 
                        onChange={(e) => setScheduleTime(e.target.value)} 
                        style={{ 
                            width: '100%', 
                            padding: '10px', 
                            borderRadius: 'var(--radius-sm)', 
                            border: '1px solid var(--border-glass)', 
                            background: 'rgba(0,0,0,0.15)', 
                            color: 'var(--text-primary)',
                            marginTop: '6px'
                        }}
                    />
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <button 
                        type="button" 
                        onClick={() => setScheduleTime('00:00')}
                        style={{
                          padding: '5px 10px',
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-glass)',
                          background: scheduleTime === '00:00' ? '#0284c7' : 'rgba(255,255,255,0.06)',
                          color: '#fff',
                          cursor: 'pointer',
                          fontWeight: scheduleTime === '00:00' ? '600' : 'normal'
                        }}
                      >
                        🌙 12:00 AM (Midnight - Default)
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setScheduleTime('08:00')}
                        style={{
                          padding: '5px 10px',
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-glass)',
                          background: scheduleTime === '08:00' ? '#0284c7' : 'rgba(255,255,255,0.06)',
                          color: '#fff',
                          cursor: 'pointer',
                          fontWeight: scheduleTime === '08:00' ? '600' : 'normal'
                        }}
                      >
                        ☀️ 08:00 AM (Morning)
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setScheduleTime('09:00')}
                        style={{
                          padding: '5px 10px',
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-glass)',
                          background: scheduleTime === '09:00' ? '#0284c7' : 'rgba(255,255,255,0.06)',
                          color: '#fff',
                          cursor: 'pointer',
                          fontWeight: scheduleTime === '09:00' ? '600' : 'normal'
                        }}
                      >
                        09:00 AM
                      </button>
                    </div>
                </div>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: 'auto', paddingTop: '24px' }}>
              <button className="secondary-btn" onClick={onClose}>
                Cancel
              </button>
              <button className="secondary-btn" onClick={handleCopyCaption}>
                <Copy size={18} /> Copy
              </button>
              <button className="primary-btn" onClick={handleShareWhatsApp} disabled={!templateImg || !userImg || isSending} style={{ backgroundColor: '#25D366', color: 'white', borderColor: '#25D366', opacity: isSending ? 0.7 : 1 }}>
                <Share2 size={18} /> {isSending ? "Sending..." : "Share to Group"}
              </button>
              <button className="primary-btn" onClick={handleScheduleWhatsApp} disabled={!templateImg || !userImg || isSending} style={{ backgroundColor: '#10B981', color: 'white', borderColor: '#10B981', opacity: isSending ? 0.7 : 1 }}>
                <CalendarClock size={18} /> {isSending ? "Scheduling..." : "Schedule"}
              </button>
              <button className="primary-btn download-btn" onClick={handleDownload} disabled={!templateImg || !userImg} style={{ gridColumn: 'span 2' }}>
                <Download size={18} /> Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
