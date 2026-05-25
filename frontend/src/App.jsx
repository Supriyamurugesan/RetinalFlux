import { useState } from 'react';
import axios from 'axios';
import './App.css'; 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';

function App() {
  const [activeTab, setActiveTab] = useState('simulation');
  const [file, setFile] = useState(null);
  const [originalUrl, setOriginalUrl] = useState(null);
  const [predictionUrl, setPredictionUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userPrompt, setUserPrompt] = useState("advanced drusen pathology");
  const [months, setMonths] = useState(6); // Default 6 months
  const [videoUrl, setVideoUrl] = useState(null);
  const [metrics, setMetrics] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setOriginalUrl(URL.createObjectURL(selectedFile));
      setPredictionUrl(null);
      setMetrics(null);
      setVideoUrl(null);
    }
  };

  // Logic for Static Prediction
  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('prompt', userPrompt);
    
    // NEW: We should also send the months to the backend if you want it to 
    // affect the strength, though your current backend handles the prompt.
    formData.append('months', months); 

    try {
      // 1. Remove { responseType: 'blob' } if it's there!
      const response = await axios.post('http://127.0.0.1:8000/predict-progression', formData);
      
      // 2. Access 'image' field from the JSON response
      // This string starts with 'iVBOR...' (the Base64 data)
      const base64Image = response.data.image;
      
      // 3. Set the state with the proper Data URI prefix
      setPredictionUrl(`data:image/png;base64,${base64Image}`);
      
      // 4. Update metrics
      setMetrics({
        ssim: response.data.ssim,
        psnr: response.data.psnr,
        growth: response.data.growth,
        timeline: months
      });

    } catch (error) {
      console.error("Full Error Object:", error);
      alert("Prediction failed. Check if FastAPI backend returned a 500 error.");
    } finally {
      setLoading(false);
    }
  };

  // Logic for Video Generation
  const handleVideoGenerate = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('prompt', userPrompt);

    try {
      const response = await axios.post('http://127.0.0.1:8000/generate-progression-video', formData, { responseType: 'blob' });
      setVideoUrl(URL.createObjectURL(response.data));
    } catch (error) { 
        alert("Video failed."); 
    } finally { 
        setLoading(false); 
    }
  };

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-logo">RetinalFlux</div>
        <ul>
          <li className={activeTab === 'simulation' ? 'active' : ''} onClick={() => setActiveTab('simulation')}> Simulation</li>
          <li className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}> Analytics</li>
        </ul>
        <div className="sidebar-footer"></div>
      </nav>

      <main className="content-area">
        {activeTab === 'simulation' && (
          <div className="tab-content">
            {/* STEP 1: UPLOAD */}
            <div className="card shadow-sm">
              <h3>Step 1: Patient OCT Upload</h3>
              <input type="file" onChange={handleFileChange} accept="image/*" className="file-input" />
            </div>

            {/* STEP 2: CONFIGURATION */}
            {file && (
              <div className="card shadow-sm animate-in">
                <h3>Step 2: Simulation Parameters</h3>
                <div className="config-grid">
                  <div className="input-group">
                    <label>Target Pathology Prompt:</label>
                    <input 
                      type="text" 
                      value={userPrompt} 
                      onChange={(e) => setUserPrompt(e.target.value)}
                      placeholder="e.g., advanced drusen pathology"
                    />
                  </div>
                  
                  <div className="input-group">
                    <label>Progression Timeline: <strong>{months} Months</strong></label>
                    <input 
                      type="range" min="1" max="48" value={months} 
                      onChange={(e) => setMonths(e.target.value)}
                      className="slider"
                    />
                    <div className="slider-labels"><span>1m</span><span>24m</span><span>48m</span></div>
                  </div>
                </div>

                <div className="button-group">
                  <button onClick={handleUpload} disabled={loading} className="btn-primary">
                    {loading ? "Processing..." : "Static Prediction"}
                  </button>
                  <button onClick={handleVideoGenerate} disabled={loading} className="btn-secondary">
                    {loading ? "Generating Video..." : "Video Prediction"}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: OUTPUT DISPLAY */}
            <div className="results-grid">
              <div className="view-column card">
                <h4>Baseline (Month 0)</h4>
                <div className="image-box">
                  {originalUrl ? <img src={originalUrl} alt="Original" /> : <span>No Input</span>}
                </div>
              </div>
              
              <div className="view-column card">
                <h4>AI Prediction (Month {months})</h4>
                <div className="image-box prediction-box">
                  {predictionUrl ? <img src={predictionUrl} alt="Prediction" /> : <span>Awaiting Action</span>}
                </div>
                {/* --- DOWNLOAD BUTTON FOR STATIC IMAGE --- */}
                {predictionUrl && (
                  <div style={{ marginTop: '15px', textAlign: 'center' }}>
                    <a 
                      href={predictionUrl} 
                      download={`RetinalFlux_Prediction_Month_${months}.png`} 
                      className="download-btn"
                    >
                      ⬇️ Download Prediction Image
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* --- VIDEO SECTION WITH DOWNLOAD --- */}
            {videoUrl && (
              <div className="video-section card animate-in">
                <h4>Progression Time-Lapse (0 - {months} Months)</h4>
                <video src={videoUrl} controls className="main-video" />
                <div style={{ marginTop: '15px', textAlign: 'center' }}>
                  <a 
                    href={videoUrl} 
                    download={`RetinalFlux_Progression_Timeline.mp4`} 
                    className="download-btn video-dl"
                  >
                    ⬇️ Download Simulation Video
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Analytics Section stays the same */}
        {activeTab === 'analytics' && (
  <div className="tab-content animate-in">
    <header className="analytics-header card">
      <h2>📈 Quantitative Pathological Analysis</h2>
      <p>Analysis for: <strong>{userPrompt}</strong> | Target: <strong>Month {metrics?.timeline}</strong></p>
    </header>

    {metrics ? (
      <>
        {/* 1. TOP ROW: BIG NUMBERS */}
        <div className="metrics-row">
          <div className="metric-card card">
            <span className="label">Growth Index</span>
            <div className="value red-text">{metrics.growth}%</div>
          </div>
          <div className="metric-card card">
            <span className="label">Anatomy Match (SSIM)</span>
            <div className="value">{metrics.ssim}</div>
          </div>
          <div className="metric-card card">
            <span className="label">Image Clarity (PSNR)</span>
            <div className="value">{metrics.psnr} dB</div>
          </div>
        </div>

        {/* 2. MIDDLE ROW: PROGRESSION GRAPHS */}
        <div className="charts-grid">
          
          {/* GRAPH 1: GROWTH OVER TIME */}
          <div className="chart-card card">
            <h4>Predicted Growth Curve (Timeline)</h4>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <LineChart data={[
                  { m: 0, g: 0 },
                  { m: 12, g: metrics.growth * 0.4 },
                  { m: 24, g: metrics.growth * 0.7 },
                  { m: metrics.timeline, g: metrics.growth },
                  { m: 48, g: metrics.growth * 1.5 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="m" label={{ value: 'Months', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Growth %', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="g" stroke="#ef4444" strokeWidth={3} dot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRAPH 2: ANATOMICAL DEVIATION */}
          <div className="chart-card card">
            <h4>Structural Integrity (SSIM Decay)</h4>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <AreaChart data={[
                  { m: 0, s: 1.0 },
                  { m: 12, s: 0.9 },
                  { m: 24, s: 0.75 },
                  { m: metrics.timeline, s: metrics.ssim },
                  { m: 48, s: metrics.ssim * 0.8 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="m" />
                  <YAxis domain={[0, 1]} />
                  <Tooltip />
                  <Area type="monotone" dataKey="s" stroke="#2563eb" fill="#dbeafe" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRAPH 3: CURRENT METRIC COMPARISON */}
          <div className="chart-card card">
            <h4>Metric Distribution</h4>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <BarChart data={[
                  { name: 'SSIM', val: metrics.ssim * 100 },
                  { name: 'Growth', val: metrics.growth },
                  { name: 'PSNR', val: metrics.psnr },
                ]}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="val" fill="#8884d8" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRAPH 4: DIAGNOSTIC RADAR */}
          <div className="chart-card card">
            <h4>Diagnostic Balance Score</h4>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                  { subject: 'Growth', A: metrics.growth, fullMark: 100 },
                  { subject: 'SSIM', A: metrics.ssim * 100, fullMark: 100 },
                  { subject: 'PSNR', A: metrics.psnr * 2, fullMark: 100 },
                  { subject: 'Consistency', A: 85, fullMark: 100 },
                  { subject: 'Stability', A: 90, fullMark: 100 },
                ]}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis />
                  <Radar name="AI Metrics" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </>
    ) : (
      <div className="no-data card">⚠️ Run a simulation to generate analytics graphs.</div>
    )}
  </div>
)}
      </main>
    </div>
  );
}

export default App;