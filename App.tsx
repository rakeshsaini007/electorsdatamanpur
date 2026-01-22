
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Member, DeleteReason } from './types';
import { fetchData, saveMember, deleteMember } from './services/gasService';
import { DELETE_REASONS, TARGET_DATE, GENDER_OPTIONS } from './constants';

const App: React.FC = () => {
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchMode, setSearchMode] = useState<'selection' | 'name' | 'svn'>('selection');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    booth: '',
    ward: '',
    house: ''
  });

  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<{ show: boolean, member: Member | null, reason: DeleteReason }>({
    show: false,
    member: null,
    reason: 'शादी'
  });
  const [aadhaarWarning, setAadhaarWarning] = useState<{ show: boolean, duplicate: Member | null }>({
    show: false,
    duplicate: null
  });

  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await fetchData();
      if (res.success && res.data) {
        setAllMembers(res.data);
      } else {
        alert(res.error || 'डाटा प्राप्त करने में त्रुटि');
      }
      setLoading(false);
    };
    load();
  }, []);

  // Handle camera stream assignment after component mount
  useEffect(() => {
    if (isCameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [isCameraActive, stream]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Filter derivations
  const booths = useMemo(() => Array.from(new Set(allMembers.map(m => m.boothNo))).sort((a, b) => Number(a) - Number(b)), [allMembers]);
  
  const wards = useMemo(() => {
    if (!filters.booth) return [];
    return Array.from(new Set(allMembers.filter(m => m.boothNo === filters.booth).map(m => m.wardNo))).sort((a, b) => Number(a) - Number(b));
  }, [allMembers, filters.booth]);
  
  const houses = useMemo(() => {
    if (!filters.booth || !filters.ward) return [];
    return Array.from(new Set(allMembers.filter(m => m.boothNo === filters.booth && m.wardNo === filters.ward).map(m => m.houseNo))).sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
  }, [allMembers, filters.booth, filters.ward]);

  const filteredMembers = useMemo(() => {
    if (searchMode === 'selection') {
      if (!filters.booth || !filters.ward || !filters.house) return [];
      return allMembers.filter(m => 
        m.boothNo === filters.booth && 
        m.wardNo === filters.ward && 
        m.houseNo === filters.house
      );
    } else if (searchMode === 'name') {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return [];
      return allMembers.filter(m => 
        m.voterName.toLowerCase().includes(q) || 
        m.relativeName.toLowerCase().includes(q)
      );
    } else if (searchMode === 'svn') {
      const q = searchQuery.trim().toUpperCase();
      if (!q) return [];
      return allMembers.filter(m => m.svn.toUpperCase().includes(q));
    }
    return [];
  }, [allMembers, filters, searchQuery, searchMode]);

  const calculateAgeAtTarget = (dobString: string): string => {
    if (!dobString) return '';
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return '';
    
    let age = TARGET_DATE.getFullYear() - birthDate.getFullYear();
    const m = TARGET_DATE.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && TARGET_DATE.getDate() < birthDate.getDate())) {
      age--;
    }
    return age.toString();
  };

  const handleEditChange = (field: keyof Member, value: string) => {
    setEditingMember(prev => {
      if (!prev) return null;
      const updated = { ...prev, [field]: value };
      if (field === 'dob') {
        updated.calculatedAge = calculateAgeAtTarget(value);
      }
      return updated;
    });
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("आपका ब्राउज़र कैमरा एक्सेस का समर्थन नहीं करता है।");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      setStream(s);
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera access error:", err);
      alert("कैमरा एक्सेस करने में विफल। कृपया अनुमतियों की जांच करें।");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      
      // Target smaller size for Google Sheets compatibility (Cell limit 50,000 chars)
      const MAX_WIDTH = 480; 
      let width = video.videoWidth;
      let height = video.videoHeight;
      
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        // Compressed JPEG at 0.4 quality to significantly reduce string length
        const dataUrl = canvas.toDataURL('image/jpeg', 0.4);
        console.log(`Captured Image Length: ${dataUrl.length} characters`);
        
        if (dataUrl.length > 49000) {
          alert("चेतावनी: फोटो का आकार बड़ा है, यह सुरक्षित नहीं हो सकता। कृपया दोबारा खींचें।");
        }
        
        handleEditChange('aadhaarImage', dataUrl);
        stopCamera();
      }
    }
  };

  const handleSave = async (member: Member) => {
    if (member.aadhaarImage && member.aadhaarImage.length > 50000) {
      alert("फोटो का आकार बहुत बड़ा है (50KB से अधिक)। कृपया कम रोशनी या छोटे बैकग्राउंड में फोटो लें।");
      return;
    }

    if (member.aadhaar) {
      const duplicate = allMembers.find(m => m.aadhaar === member.aadhaar && m.svn !== member.svn);
      if (duplicate) {
        setAadhaarWarning({ show: true, duplicate });
        return;
      }
    }

    setLoading(true);
    const res = await saveMember(member);
    if (res.success) {
      alert('डाटा सफलतापूर्वक सुरक्षित किया गया!');
      const refreshRes = await fetchData();
      if (refreshRes.data) setAllMembers(refreshRes.data);
      setEditingMember(prev => prev ? {...member} : null);
    } else {
      alert(res.error || 'डाटा सुरक्षित करने में त्रुटि');
    }
    setLoading(false);
  };

  const handleDeleteConfirm = async () => {
    if (!showDeleteModal.member) return;
    setLoading(true);
    const res = await deleteMember(showDeleteModal.member, showDeleteModal.reason);
    if (res.success) {
      alert('सदस्य सफलतापूर्वक हटाया गया!');
      const refreshRes = await fetchData();
      if (refreshRes.data) setAllMembers(refreshRes.data);
      setShowDeleteModal({ show: false, member: null, reason: 'शादी' });
      setEditingMember(null);
    } else {
      alert(res.error || 'हटाने में त्रुटि');
    }
    setLoading(false);
  };

  const resetSearchState = () => {
    setSearchQuery('');
    setFilters({ booth: '', ward: '', house: '' });
    setEditingMember(null);
  };

  const originalMember = useMemo(() => {
    return allMembers.find(m => m.svn === editingMember?.svn);
  }, [allMembers, editingMember?.svn]);

  const isPhotoChanged = editingMember?.aadhaarImage && editingMember.aadhaarImage !== originalMember?.aadhaarImage;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <header className="mb-10 text-center">
        <div className="inline-block bg-blue-100 p-3 rounded-2xl mb-4">
          <i className="fa-solid fa-users-viewfinder text-3xl text-blue-700"></i>
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">मतदाता प्रबंधन पोर्टल</h1>
        <p className="text-gray-500 font-medium">निर्वाचक नामावली विवरण खोजें एवं अद्यतन करें</p>
      </header>

      <div className="flex justify-center mb-10">
        <div className="bg-gray-200/50 backdrop-blur-sm p-1.5 rounded-2xl inline-flex shadow-inner border border-gray-200">
          <button 
            onClick={() => { setSearchMode('selection'); resetSearchState(); }}
            className={`px-6 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${searchMode === 'selection' ? 'bg-white text-blue-700 shadow-lg transform scale-105' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <i className="fa-solid fa-filter-list"></i> चयन द्वारा
          </button>
          <button 
            onClick={() => { setSearchMode('name'); resetSearchState(); }}
            className={`px-6 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${searchMode === 'name' ? 'bg-white text-blue-700 shadow-lg transform scale-105' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <i className="fa-solid fa-magnifying-glass"></i> नाम से
          </button>
          <button 
            onClick={() => { setSearchMode('svn'); resetSearchState(); setSearchQuery('SUR'); }}
            className={`px-6 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${searchMode === 'svn' ? 'bg-white text-blue-700 shadow-lg transform scale-105' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <i className="fa-solid fa-address-card"></i> SVN से
          </button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 mb-10 transition-all duration-300">
        {searchMode === 'selection' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 animate-in fade-in slide-in-from-top-4">
            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">बूथ संख्या</label>
              <select className="w-full border-gray-200 rounded-2xl p-4 bg-gray-50 border-2 focus:border-blue-500 focus:ring-0 transition-all font-bold text-gray-700" value={filters.booth} onChange={(e) => setFilters({ booth: e.target.value, ward: '', house: '' })}>
                <option value="">-- बूथ चुनें --</option>
                {booths.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">वार्ड संख्या</label>
              <select className="w-full border-gray-200 rounded-2xl p-4 bg-gray-50 border-2 focus:border-blue-500 focus:ring-0 transition-all font-bold text-gray-700 disabled:opacity-40" disabled={!filters.booth} value={filters.ward} onChange={(e) => setFilters({ ...filters, ward: e.target.value, house: '' })}>
                <option value="">-- वार्ड चुनें --</option>
                {wards.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">मकान नं०</label>
              <select className="w-full border-gray-200 rounded-2xl p-4 bg-gray-50 border-2 focus:border-blue-500 focus:ring-0 transition-all font-bold text-gray-700 disabled:opacity-40" disabled={!filters.ward} value={filters.house} onChange={(e) => setFilters({ ...filters, house: e.target.value })}>
                <option value="">-- मकान चुनें --</option>
                {houses.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
        )}

        {(searchMode === 'name' || searchMode === 'svn') && (
          <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-top-4">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">{searchMode === 'name' ? 'निर्वाचक का नाम या पिता का नाम' : 'SVN नंबर (SUR...)'}</label>
            <div className="relative group">
              <input type="text" className="w-full border-gray-200 rounded-2xl p-5 pl-14 bg-gray-50 border-2 focus:border-blue-500 focus:ring-0 transition-all font-bold uppercase text-lg shadow-inner" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="यहां टाइप करना शुरू करें..." />
              <i className={`fa-solid ${searchMode === 'name' ? 'fa-user-tag' : 'fa-id-badge'} absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 text-xl group-focus-within:text-blue-500 transition-colors`}></i>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="fixed inset-0 bg-white/60 flex items-center justify-center z-[200] backdrop-blur-md">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in duration-300">
            <div className="relative">
              <div className="h-20 w-20 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin"></div>
              <i className="fa-solid fa-cloud-arrow-down absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600 text-2xl"></i>
            </div>
            <span className="font-black text-xl text-gray-800 tracking-tight">डाटा लोड हो रहा है...</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
              <span className="w-2 h-8 bg-blue-600 rounded-full shadow-lg shadow-blue-200"></span>
              परिणाम <span className="text-blue-600 bg-blue-50 px-3 py-1 rounded-xl text-lg">{filteredMembers.length}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[80vh] overflow-y-auto pr-3 custom-scrollbar">
            {filteredMembers.length === 0 ? (
              <div className="md:col-span-2 bg-white rounded-3xl p-20 text-center border-4 border-dashed border-gray-100 flex flex-col items-center justify-center space-y-4">
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
                  <i className="fa-solid fa-magnifying-glass text-5xl"></i>
                </div>
                <div>
                  <p className="font-black text-xl text-gray-400">कोई रिकॉर्ड नहीं मिला</p>
                  <p className="text-gray-400 font-medium">कृपया ऊपर दिए गए विकल्पों का उपयोग करें</p>
                </div>
              </div>
            ) : (
              filteredMembers.map(member => (
                <div 
                  key={member.svn} 
                  onClick={() => {
                    setEditingMember({...member, calculatedAge: calculateAgeAtTarget(member.dob)});
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`group relative cursor-pointer transition-all p-6 rounded-3xl border-2 overflow-hidden flex flex-col justify-between h-full hover:shadow-2xl hover:-translate-y-1 ${editingMember?.svn === member.svn ? 'border-blue-600 bg-blue-50 shadow-xl shadow-blue-100' : 'border-white bg-white shadow-md shadow-gray-100'}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      {member.aadhaarImage ? (
                        <div className="w-14 h-14 rounded-xl overflow-hidden shadow-sm border border-gray-100 shrink-0" onClick={(e) => { e.stopPropagation(); setEnlargedImage(member.aadhaarImage!); }}>
                          <img src={member.aadhaarImage} alt="Voter" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="bg-gray-100/80 p-2.5 rounded-2xl group-hover:bg-blue-100 transition-colors shrink-0">
                          <i className={`fa-solid ${member.gender === 'म' ? 'fa-person-dress' : 'fa-person'} text-xl text-gray-500 group-hover:text-blue-600`}></i>
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] font-black text-blue-600 bg-blue-100/50 px-3 py-1.5 rounded-full tracking-tighter">
                      CR#{member.voterSerial}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-gray-900 leading-tight group-hover:text-blue-700 transition-colors">{member.voterName}</h3>
                    <p className="text-sm text-gray-500 font-bold mb-4 flex items-center gap-1.5">
                      <i className="fa-solid fa-user-friends text-[10px] opacity-40"></i>
                      {member.relativeName}
                    </p>
                  </div>

                  <div className="mt-auto pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                    <div className="bg-gray-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                      <i className="fa-solid fa-id-card text-[10px] text-gray-400"></i>
                      <span className="text-[10px] font-black text-gray-600 uppercase tracking-tighter">{member.svn}</span>
                    </div>
                    <div className="bg-gray-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                      <i className="fa-solid fa-location-dot text-[10px] text-gray-400"></i>
                      <span className="text-[10px] font-black text-gray-600 uppercase tracking-tighter">
                        {member.boothNo}/{member.wardNo}/{member.houseNo}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-8">
          {editingMember ? (
            <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in slide-in-from-right-8 duration-500 ring-1 ring-black/5">
              <div className="bg-gray-900 p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 p-2.5 rounded-xl">
                    <i className="fa-solid fa-user-pen text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-black text-lg tracking-tight">सदस्य विवरण</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">संपादन मोड</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingMember(null)} 
                  className="bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center transition-all"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              
              <div className="p-7 space-y-6">
                <div className="bg-blue-50 p-4 rounded-3xl border-2 border-dashed border-blue-200">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-xs font-black text-blue-700 uppercase tracking-widest">आधार कार्ड फोटो</label>
                    <div className="flex gap-2">
                      {editingMember.aadhaarImage && (
                        <button onClick={() => setEnlargedImage(editingMember.aadhaarImage!)} className="text-[10px] font-black text-blue-600 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-blue-100">देखें</button>
                      )}
                      {isPhotoChanged && (
                        <button 
                          onClick={() => handleSave(editingMember)} 
                          className="text-[10px] font-black text-white bg-blue-600 px-3 py-1.5 rounded-xl shadow-md border border-blue-700 flex items-center gap-1.5"
                        >
                          <i className="fa-solid fa-cloud-arrow-up"></i> फोटो सुरक्षित करें
                        </button>
                      )}
                    </div>
                  </div>

                  {isCameraActive ? (
                    <div className="space-y-4 animate-in fade-in zoom-in">
                      <div className="relative aspect-video bg-black rounded-2xl overflow-hidden ring-4 ring-blue-500/20">
                        <video 
                          ref={videoRef} 
                          autoPlay 
                          playsInline 
                          muted
                          className="w-full h-full object-cover" 
                        />
                        <div className="absolute inset-0 border-[30px] border-black/30 pointer-events-none"></div>
                        <div className="absolute inset-[30px] border-2 border-white/50 border-dashed pointer-events-none rounded-lg"></div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={capturePhoto} className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2">
                          <i className="fa-solid fa-camera"></i> फोटो खींचें
                        </button>
                        <button onClick={stopCamera} className="bg-gray-200 text-gray-600 font-black px-6 py-4 rounded-2xl">रद्द</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 bg-white rounded-2xl border-2 border-gray-100 shadow-inner flex items-center justify-center overflow-hidden shrink-0 group relative" onClick={() => editingMember.aadhaarImage && setEnlargedImage(editingMember.aadhaarImage)}>
                        {editingMember.aadhaarImage ? (
                          <img src={editingMember.aadhaarImage} alt="Capture" className="w-full h-full object-cover" />
                        ) : (
                          <i className="fa-solid fa-id-card text-gray-200 text-3xl"></i>
                        )}
                        {isPhotoChanged && (
                          <div className="absolute top-1 right-1">
                            <span className="flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                            </span>
                          </div>
                        )}
                      </div>
                      <button onClick={startCamera} className="flex-1 bg-white hover:bg-gray-50 text-blue-700 border-2 border-blue-100 font-black py-4 px-4 rounded-2xl flex items-center justify-center gap-3 transition-all">
                        <i className="fa-solid fa-camera-retro text-xl"></i>
                        {editingMember.aadhaarImage ? 'फोटो बदलें' : 'कैमरा शुरू करें'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">बूथ संख्या</span>
                    <p className="text-sm font-black text-gray-700">{editingMember.boothNo}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">वार्ड संख्या</span>
                    <p className="text-sm font-black text-gray-700">{editingMember.wardNo}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">मकान नं०</span>
                    <p className="text-sm font-black text-gray-700">{editingMember.houseNo}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">मतदाता क्रमांक</span>
                    <p className="text-sm font-black text-gray-700">{editingMember.voterSerial}</p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-gray-100 flex items-center gap-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">SVN:</span>
                    <span className="text-sm font-black text-blue-600 uppercase">{editingMember.svn}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">निर्वाचक का नाम</label>
                    <input className="w-full border-gray-200 rounded-2xl p-4 border-2 font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all text-gray-800" value={editingMember.voterName} onChange={(e) => handleEditChange('voterName', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">पिता/पति/माता का नाम</label>
                    <input className="w-full border-gray-200 rounded-2xl p-4 border-2 font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all text-gray-800" value={editingMember.relativeName} onChange={(e) => handleEditChange('relativeName', e.target.value)} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">लिंग</label>
                      <select className="w-full border-gray-200 rounded-2xl p-4 border-2 font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all text-gray-800 bg-gray-50" value={editingMember.gender} onChange={(e) => handleEditChange('gender', e.target.value as any)}>
                        {GENDER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">आयु (अभिलेख)</label>
                      <input className="w-full border-gray-200 rounded-2xl p-4 border-2 font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all text-gray-800" value={editingMember.age} onChange={(e) => handleEditChange('age', e.target.value)} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">आधार संख्या</label>
                    <div className="relative">
                      <input maxLength={12} className="w-full border-gray-200 rounded-2xl p-4 pl-12 border-2 font-mono tracking-[0.3em] text-xl font-black text-center focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all text-gray-800" value={editingMember.aadhaar} onChange={(e) => handleEditChange('aadhaar', e.target.value.replace(/\D/g, ''))} placeholder="000000000000" />
                      <i className="fa-solid fa-fingerprint absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 text-lg"></i>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">जन्म तिथि</label>
                    <input type="date" className="w-full border-gray-200 rounded-2xl p-4 border-2 font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all text-gray-800 bg-gray-50" value={editingMember.dob} onChange={(e) => handleEditChange('dob', e.target.value)} />
                  </div>

                  <div className="flex items-center justify-between p-5 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-80">अनुमानित उम्र</span>
                      <span className="text-xs font-bold opacity-70">(01-01-2026 तक)</span>
                    </div>
                    <span className="text-3xl font-black">{editingMember.calculatedAge || '--'} <span className="text-sm">वर्ष</span></span>
                  </div>
                </div>

                <div className="pt-6 flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => handleSave(editingMember)} 
                    className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 transform hover:-translate-y-1 active:translate-y-0 transition-all"
                  >
                    <i className="fa-solid fa-circle-check text-xl"></i>
                    विवरण सुरक्षित करें
                  </button>
                  <button 
                    onClick={() => setShowDeleteModal({ show: true, member: editingMember, reason: 'शादी' })} 
                    className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-black py-5 rounded-2xl flex items-center justify-center gap-2 transition-all border border-rose-100"
                  >
                    <i className="fa-solid fa-user-xmark"></i>
                    हटाएं
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-16 text-center border-4 border-dashed border-gray-100 text-gray-300 flex flex-col items-center justify-center space-y-4 shadow-sm">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
                <i className="fa-solid fa-pen-nib text-3xl"></i>
              </div>
              <div>
                <p className="font-black text-xl text-gray-400">संपादन के लिए चुनें</p>
                <p className="text-sm font-medium text-gray-400">किसी कार्ड पर क्लिक करके विवरण संपादित करें</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {enlargedImage && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[500] p-4 backdrop-blur-sm" onClick={() => setEnlargedImage(null)}>
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <img src={enlargedImage} alt="Aadhaar" className="w-full rounded-3xl shadow-2xl" />
            <button onClick={() => setEnlargedImage(null)} className="absolute -top-12 right-0 text-white text-3xl hover:text-gray-300"><i className="fa-solid fa-circle-xmark"></i></button>
          </div>
        </div>
      )}

      {aadhaarWarning.show && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[300] p-4 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] max-w-md w-full p-10 shadow-2xl border-t-[14px] border-amber-500 animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fa-solid fa-triangle-exclamation text-amber-500 text-3xl"></i>
            </div>
            <h3 className="text-2xl font-black text-gray-900 text-center mb-4">आधार पहले से मौजूद है!</h3>
            <div className="bg-amber-50 p-6 rounded-3xl border-2 border-amber-100 mb-8 space-y-2">
              <p className="text-xs font-black text-amber-600 uppercase tracking-widest">मौजूदा सदस्य</p>
              <p className="text-xl font-black text-gray-900">{aadhaarWarning.duplicate?.voterName}</p>
              <p className="text-sm text-gray-600 font-bold">SVN: {aadhaarWarning.duplicate?.svn}</p>
            </div>
            <button 
              onClick={() => setAadhaarWarning({ show: false, duplicate: null })} 
              className="w-full bg-gray-900 hover:bg-black text-white font-black py-5 rounded-2xl shadow-xl transition-all"
            >
              ठीक है, विवरण जांचें
            </button>
          </div>
        </div>
      )}

      {showDeleteModal.show && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[300] p-4 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] max-w-md w-full p-10 shadow-2xl border-t-[14px] border-rose-600 animate-in zoom-in duration-300">
            <h3 className="text-2xl font-black text-gray-900 mb-2 text-center">सदस्य को हटाएं?</h3>
            <p className="text-gray-500 text-center font-bold mb-8">क्या आप निश्चित रूप से <span className="text-rose-600">{showDeleteModal.member?.voterName}</span> का रिकॉर्ड हटाना चाहते हैं?</p>
            
            <div className="mb-10">
              <label className="block text-xs font-black text-gray-400 uppercase text-center mb-4 tracking-widest">हटाने का कारण</label>
              <div className="grid grid-cols-2 gap-3">
                {DELETE_REASONS.map(r => (
                  <button 
                    key={r} 
                    onClick={() => setShowDeleteModal({...showDeleteModal, reason: r})} 
                    className={`p-4 rounded-2xl font-black text-sm border-2 transition-all ${showDeleteModal.reason === r ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-100' : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-rose-200'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowDeleteModal({show: false, member: null, reason: 'शादी'})} 
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 font-black py-5 rounded-2xl transition-all"
              >
                रद्द करें
              </button>
              <button 
                onClick={handleDeleteConfirm} 
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-rose-100 transition-all"
              >
                पुष्टि करें
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 20px; border: 2px solid transparent; background-clip: content-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d1d5db; border: 2px solid transparent; background-clip: content-box; }
      `}</style>
    </div>
  );
};

export default App;
