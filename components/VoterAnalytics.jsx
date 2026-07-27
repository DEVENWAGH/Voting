'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, ShieldAlert, ShieldCheck, Map, Users, Award, Percent } from 'lucide-react';
import { motion } from 'framer-motion';

export default function VoterAnalytics({ slug, electionId, electionTitle }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const mapRef = useRef(null);
  const leafletMapInstance = useRef(null);

  // 1. Fetch demographics and analytics data
  useEffect(() => {
    if (!electionId) return;
    setLoading(true);
    setError('');
    fetch(`/api/analytics/${electionId}`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) throw new Error(res.error || 'Failed to fetch analytics');
        setData(res.data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [electionId]);

  // 2. Load Leaflet script and CSS dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if Leaflet is already loaded
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(cssLink);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      // Clean up scripts & style to prevent double loads
      try {
        document.head.removeChild(cssLink);
        document.body.removeChild(script);
      } catch (err) {}
    };
  }, []);

  // 3. Initialize/update Map
  useEffect(() => {
    if (!leafletLoaded || !window.L || !mapRef.current || !data?.demographics?.locations) return;

    // Destroy existing map
    if (leafletMapInstance.current) {
      leafletMapInstance.current.remove();
      leafletMapInstance.current = null;
    }

    const L = window.L;
    const locs = data.demographics.locations;

    // Center in India by default or the first marker
    const center = locs.length > 0 ? [locs[0].latitude, locs[0].longitude] : [20.5937, 78.9629];
    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
    }).setView(center, locs.length > 0 ? 8 : 4);

    leafletMapInstance.current = map;

    // Sleek Dark Matter tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    const markers = [];
    locs.forEach((loc) => {
      if (loc.latitude && loc.longitude) {
        const dotIcon = L.divIcon({
          className: 'custom-leaflet-dot-marker',
          html: `<div class="w-4 h-4 rounded-full bg-indigo-500 border-2 border-white shadow-lg flex items-center justify-center animate-pulse"><div class="w-1.5 h-1.5 rounded-full bg-white"></div></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        const timeStr = new Date(loc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = new Date(loc.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });

        const m = L.marker([loc.latitude, loc.longitude], { icon: dotIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: sans-serif; color: #1e293b; padding: 2px;">
              <h5 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700;">📍 ${loc.city}</h5>
              <p style="margin: 0; font-size: 10px; color: #64748b;">${loc.country}</p>
              <div style="margin-top: 6px; font-size: 9px; color: #94a3b8; font-weight: 500;">
                Cast at: ${dateStr} ${timeStr}
              </div>
            </div>
          `);
        markers.push(m);
      }
    });

    if (markers.length > 0) {
      const group = new L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.3));
    }
  }, [leafletLoaded, data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted">
        <Loader2 className="animate-spin text-primary mb-3" size={32} />
        <p className="text-xs font-semibold">Retrieving Voter Demographics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-canvas border border-red-250 rounded-xl p-5 text-sm text-semantic-down flex items-start gap-3">
        <AlertCircle size={18} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Failed to load analytics</p>
          <p className="text-xs opacity-80">{error || 'Unknown analytics retrieve error'}</p>
        </div>
      </div>
    );
  }

  const { demographics, stats } = data;
  const matchStats = demographics.genderMatchStats;

  // Max count helper for age bar sizing
  const ageCounts = Object.values(demographics.ageGroups);
  const maxAgeCount = Math.max(...ageCounts, 1);

  return (
    <div className="space-y-6">
      
      {/* Visual Analytics Title */}
      <div className="border-b border-hairline pb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-ink text-base flex items-center gap-2">
            <Users size={18} className="text-primary" />
            Voter Demographics & Geography
          </h3>
          <p className="text-xs text-body mt-0.5">Demographic statistics & voter density mapping for {electionTitle || 'this election'}.</p>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider bg-surface-strong px-2.5 py-1 rounded-full text-ink">
          Verified Nodes: {stats.totalVotes}
        </span>
      </div>

      {/* Grid of Demographics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* 1. Age Distribution (SVG Bar Chart) */}
        <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm space-y-4">
          <h4 className="font-bold text-ink text-sm flex items-center gap-1.5">
            <Award size={15} className="text-indigo-500" />
            Age Distribution (Official Roster)
          </h4>
          <div className="space-y-3">
            {Object.entries(demographics.ageGroups).map(([group, count]) => {
              const pct = stats.totalVotes > 0 ? ((count / stats.totalVotes) * 100).toFixed(1) : '0.0';
              const barWidth = ((count / maxAgeCount) * 100).toFixed(1);
              return (
                <div key={group} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-ink">{group} yrs</span>
                    <span className="text-body font-mono">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2.5 w-full bg-surface-soft border border-hairline rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-indigo-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. AWS Rekognition Gender Integrity Check */}
        <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h4 className="font-bold text-ink text-sm flex items-center gap-1.5">
              <Percent size={15} className="text-primary" />
              AWS Rekognition Biometric Validation
            </h4>
            <p className="text-xs text-body mt-1">Cross-referencing voter list genders against face-scan estimations.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 items-center">
            {/* Giant Circular Match Rate Gauge */}
            <div className="flex flex-col items-center justify-center text-center">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-surface-strong"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <motion.path
                    className={matchStats.matchRate >= 90 ? "text-green-500" : matchStats.matchRate >= 75 ? "text-amber-500" : "text-red-500"}
                    strokeWidth="3.2"
                    strokeDasharray={`${matchStats.matchRate}, 100`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    initial={{ strokeDasharray: "0, 100" }}
                    animate={{ strokeDasharray: `${matchStats.matchRate}, 100` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-xl font-bold font-mono text-ink">{matchStats.matchRate}%</span>
                  <p className="text-[8px] text-muted font-bold uppercase tracking-wider">Match Rate</p>
                </div>
              </div>
            </div>

            {/* Match / Mismatch statistics */}
            <div className="space-y-2 text-xs font-semibold text-body">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Matches</span>
                <span className="font-mono text-ink">{matchStats.matches}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Mismatches</span>
                <span className="font-mono text-ink">{matchStats.mismatches}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> Uncompared</span>
                <span className="font-mono text-ink">{matchStats.unknowns}</span>
              </div>
            </div>
          </div>

          {/* Verification Status Alert */}
          {matchStats.mismatches > 0 ? (
            <div className="bg-red-50/55 border border-red-150 rounded-lg p-3 text-red-700 text-xs flex items-start gap-2">
              <ShieldAlert size={14} className="shrink-0 mt-0.5 animate-bounce" />
              <div>
                <p className="font-bold">Biometric Gender Mismatches Flagged</p>
                <p className="text-[10px] opacity-90">{matchStats.mismatches} vote(s) cast with a gender mismatch. Please review twin verification logs or audit registry logs.</p>
              </div>
            </div>
          ) : (
            <div className="bg-green-50/50 border border-green-150 rounded-lg p-3 text-green-700 text-xs flex items-start gap-2">
              <ShieldCheck size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Biometric Integrity Confirmed</p>
                <p className="text-[10px] opacity-90">All verified voters match their official roster genders perfectly.</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 3. Geographical Mapping (Leaflet Map) */}
      <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm space-y-4">
        <h4 className="font-bold text-ink text-sm flex items-center gap-1.5">
          <Map size={15} className="text-primary" />
          Geographical Footprint (Real-time Voter Geolocation)
        </h4>

        {/* Map Container */}
        <div className="relative border border-hairline rounded-lg overflow-hidden h-72 bg-slate-950">
          <div ref={mapRef} className="w-full h-full z-0" />
          {!leafletLoaded && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center text-white text-xs font-semibold gap-2">
              <Loader2 className="animate-spin text-primary" size={16} /> Loading Interactive Map...
            </div>
          )}
        </div>

        {/* Locations List */}
        {demographics.locations.length > 0 ? (
          <div className="overflow-hidden border border-hairline rounded-lg bg-surface-soft/40">
            <div className="max-h-36 overflow-y-auto divide-y divide-hairline">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-soft text-body font-semibold uppercase tracking-wider text-[9px] border-b border-hairline">
                    <th className="px-4 py-2">City</th>
                    <th className="px-4 py-2">Country</th>
                    <th className="px-4 py-2">Coordinates</th>
                    <th className="px-4 py-2 text-right">Time Cast</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline bg-canvas">
                  {demographics.locations.map((loc, i) => (
                    <tr key={i} className="hover:bg-surface-soft/30 transition text-body font-medium">
                      <td className="px-4 py-2 font-bold text-ink">{loc.city}</td>
                      <td className="px-4 py-2">{loc.country}</td>
                      <td className="px-4 py-2 font-mono text-[10px] text-muted">{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</td>
                      <td className="px-4 py-2 text-right font-mono text-muted">{new Date(loc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-center py-6 text-muted text-xs border border-dashed border-hairline rounded-lg">No geolocation coordinates recorded yet.</p>
        )}
      </div>

    </div>
  );
}
