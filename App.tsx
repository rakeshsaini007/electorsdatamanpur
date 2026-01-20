
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

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Member selection logic based on active mode
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

  // Age calculation helper
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
    if (!editingMember) return;
    const updated = { ...editingMember, [field]: value };
    if (field === 'dob') {
      updated.calculatedAge = calculateAgeAtTarget(value);
    }
    setEditingMember(updated);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Resize image to ensure base64 string doesn't exceed Google Sheet cell limits (~50k chars)
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Export as low-quality jpeg to save space
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        handleEditChange('aadhaarImage', dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (member: Member) => {
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
      setEditingMember(null);
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

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold text-blue-700 mb-2">मतदाता प्रबंधन प्रणाली</h1>
        <p className="text-gray-500 font-medium">मतदाता विवरण खोजें, संपादित करें और सुरक्षित करें</p>
      </header>

      {/* Mode Selector */}
      <div className="flex justify-center mb-6">
        <div className="bg-gray-200 p-1 rounded-2xl inline-flex shadow-inner">
          <button 
            onClick={() => { setSearchMode('selection'); resetSearchState(); }}
            className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${searchMode === 'selection' ? 'bg-white text-blue-700 shadow-md transform scale-105' : 'text-gray-600 hover:text-gray-800'}`}
          >
            <i className="fa-solid fa-list-check mr-2"></i>
            चयन द्वारा
          </button>
          <button 
            onClick={() => { setSearchMode('name'); resetSearchState(); }}
            className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${searchMode === 'name' ? 'bg-white text-blue-700 shadow-md transform scale-105' : 'text-gray-600 hover:text-gray-800'}`}
          >
            <i className="fa-solid fa-user mr-2"></i>
            नाम से
          </button>
          <button 
            onClick={() => { 
              setSearchMode('svn'); 
              resetSearchState(); 
              setSearchQuery('SUR'); 
            }}
            className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${searchMode === 'svn' ? 'bg-white text-blue-700 shadow-md transform scale-105' : 'text-gray-600 hover:text-gray-800'}`}
          >
            <i className="fa-solid fa-id-card mr-2"></i>
            SVN से
          </button>
        </div>
      </div>

      {/* Main Controls */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 transition-all duration-300">
        {searchMode === 'selection' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">बूथ संख्या</label>
              <select 
                className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-3 bg-gray-50 border transition-all font-bold"
                value={filters.booth}
                onChange={(e) => setFilters({ booth: e.target.value, ward: '', house: '' })}
              >
                <option value="">चुनें...</option>
                {booths.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">वार्ड संख्या</label>
              <select 
                className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-3 bg-gray-50 border disabled:opacity-50 transition-all font-bold"
                disabled={!filters.booth}
                value={filters.ward}
                onChange={(e) => setFilters({ ...filters, ward: e.target.value, house: '' })}
              >
                <option value="">चुनें...</option>
                {wards.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">मकान नं०</label>
              <select 
                className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-3 bg-gray-50 border disabled:opacity-50 transition-all font-bold"
                disabled={!filters.ward}
                value={filters.house}
                onChange={(e) => setFilters({ ...filters, house: e.target.value })}
              >
                <option value="">चुनें...</option>
                {houses.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
        )}

        {(searchMode === 'name' || searchMode === 'svn') && (
          <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 text-center sm:text-left">
              {searchMode === 'name' ? 'निर्वाचक का नाम या पिता का नाम' : 'SVN नंबर (उदा. SURFAN689)'}
            </label>
            <div className="relative group">
              <input 
                type="text"
                placeholder={searchMode === 'name' ? 'नाम टाइप करना शुरू करें...' : 'SVN आईडी टाइप करें...'}
                className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 text-lg p-4 pl-12 bg-gray-50 border transition-all font-bold uppercase"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <i className={`fa-solid ${searchMode === 'name' ? 'fa-search' : 'fa-id-card'} absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors`}></i>
            </div>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 backdrop-blur-[2px]">
          <div className="bg-white p-6 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in zoom-in duration-200">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
            <span className="font-bold text-gray-700">प्रक्रिया जारी है...</span>
          </div>
        </div>
      )}

      {/* Results Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Member List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
              परिणाम ({filteredMembers.length})
            </h2>
          </div>
          
          <div className="max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            {filteredMembers.length === 0 ? (
              <div className="bg-white p-16 text-center rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
                <i className={`fa-solid ${searchMode === 'selection' ? 'fa-filter' : (searchMode === 'name' ? 'fa-keyboard' : 'fa-id-card')} text-5xl mb-4 opacity-20`}></i>
                <p className="font-medium">
                  {searchMode === 'selection' 
                    ? "कृपया बूथ, वार्ड और मकान नंबर का चयन करें।" 
                    : searchQuery.trim() === '' 
                      ? "खोजने के लिए जानकारी दर्ज करें।" 
                      : "कोई सदस्य नहीं मिला।"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 pb-4">
                {filteredMembers.map(member => (
                  <div 
                    key={member.svn}
                    onClick={() => setEditingMember({...member, calculatedAge: calculateAgeAtTarget(member.dob)})}
                    className={`cursor-pointer transition-all p-5 rounded-2xl border-2 hover:shadow-lg transform active:scale-[0.98] ${editingMember?.svn === member.svn ? 'border-blue-500 bg-blue-50 shadow-md ring-4 ring-blue-50' : 'border-white bg-white shadow-sm'}`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-black text-gray-900 leading-tight">{member.voterName}</h3>
                        <p className="text-sm text-gray-500 font-medium mb-3">{member.relativeName}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-1 bg-gray-100 rounded-lg text-[10px] font-black text-gray-600 uppercase tracking-tighter">बूथ/वार्ड/मकान: {member.boothNo}/{member.wardNo}/{member.houseNo}</span>
                          <span className="px-2 py-1 bg-gray-100 rounded-lg text-[10px] font-black text-gray-600 uppercase tracking-tighter">SVN: {member.svn}</span>
                          <span className="px-2 py-1 bg-gray-100 rounded-lg text-[10px] font-black text-gray-600 uppercase tracking-tighter">आयु: {member.age}</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <div className="bg-blue-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-sm">
                          #{member.voterSerial}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Editor Form */}
        <div className="lg:sticky lg:top-8">
          {editingMember ? (
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-right-4 duration-300">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-3">
                   <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                     <i className="fa-solid fa-user-edit"></i>
                   </div>
                   <h3 className="font-black text-lg">विवरण संपादित करें</h3>
                </div>
                <button 
                  onClick={() => setEditingMember(null)}
                  className="bg-black/10 hover:bg-black/20 rounded-full w-8 h-8 flex items-center justify-center transition-all"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {[
                    { label: 'बूथ', val: editingMember.boothNo },
                    { label: 'वार्ड', val: editingMember.wardNo },
                    { label: 'क्रमांक', val: editingMember.voterSerial },
                    { label: 'मकान', val: editingMember.houseNo },
                    { label: 'SVN', val: editingMember.svn }
                  ].map((item, idx) => (
                    <div key={idx} className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <label className="block text-[10px] uppercase font-black text-gray-400 mb-0.5 whitespace-nowrap">{item.label}</label>
                      <div className="font-bold text-gray-800 text-sm truncate">{item.val}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  {/* Aadhaar Image Section */}
                  <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-100">
                    <label className="block text-xs font-black text-blue-700 mb-3 uppercase tracking-wider">आधार कार्ड फोटो</label>
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                      <div 
                        className="w-full sm:w-32 h-32 bg-white rounded-xl border-2 border-dashed border-blue-200 flex items-center justify-center overflow-hidden cursor-pointer hover:bg-blue-100 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {editingMember.aadhaarImage ? (
                          <img src={editingMember.aadhaarImage} alt="Aadhaar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-center p-2">
                            <i className="fa-solid fa-camera text-blue-300 text-2xl mb-1"></i>
                            <p className="text-[10px] font-bold text-blue-400">फोटो चुनें</p>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2 w-full">
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full bg-white border-2 border-blue-200 text-blue-700 font-bold py-2 px-4 rounded-xl text-sm hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                        >
                          <i className="fa-solid fa-camera-rotate"></i>
                          {editingMember.aadhaarImage ? 'फोटो बदलें' : 'कैमरा / गैलरी'}
                        </button>
                        {editingMember.aadhaarImage && (
                          <button 
                            onClick={() => handleEditChange('aadhaarImage', '')}
                            className="w-full text-rose-500 font-bold text-xs hover:underline"
                          >
                            फोटो हटाएं
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="col-span-1 sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">निर्वाचक का नाम</label>
                      <input 
                        className="w-full border-gray-200 rounded-xl p-3 border-2 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-bold"
                        value={editingMember.voterName}
                        onChange={(e) => handleEditChange('voterName', e.target.value)}
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">पिता/पति/माता का नाम</label>
                      <input 
                        className="w-full border-gray-200 rounded-xl p-3 border-2 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-bold"
                        value={editingMember.relativeName}
                        onChange={(e) => handleEditChange('relativeName', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">लिंग</label>
                      <select 
                        className="w-full border-gray-200 rounded-xl p-3 border-2 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-bold bg-white"
                        value={editingMember.gender}
                        onChange={(e) => handleEditChange('gender', e.target.value as any)}
                      >
                        {GENDER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">आयु (अभिलेख)</label>
                      <input 
                        type="number"
                        className="w-full border-gray-200 rounded-xl p-3 border-2 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-bold"
                        value={editingMember.age}
                        onChange={(e) => handleEditChange('age', e.target.value)}
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">आधार संख्या</label>
                      <input 
                        maxLength={12}
                        className="w-full border-gray-200 rounded-xl p-3 border-2 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-mono tracking-[0.2em] font-black text-lg text-center"
                        value={editingMember.aadhaar}
                        placeholder="0000 0000 0000"
                        onChange={(e) => handleEditChange('aadhaar', e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">जन्म तिथि</label>
                      <input 
                        type="date"
                        className="w-full border-gray-200 rounded-xl p-3 border-2 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-bold bg-white"
                        value={editingMember.dob}
                        onChange={(e) => handleEditChange('dob', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-blue-700 mb-1.5 text-center">उम्र (01-01-2026)</label>
                      <div className="w-full bg-blue-600 border-none rounded-xl p-3 text-white font-black text-center text-lg shadow-inner ring-4 ring-blue-100">
                        {editingMember.calculatedAge || '--'} वर्ष
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={() => handleSave(editingMember)}
                    className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-lg hover:shadow-emerald-200 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1 active:translate-y-0"
                  >
                    <i className="fa-solid fa-cloud-arrow-up text-xl"></i>
                    {allMembers.find(m => m.svn === editingMember.svn)?.aadhaar ? 'अपडेट करें' : 'सुरक्षित करें'}
                  </button>
                  <button 
                    onClick={() => setShowDeleteModal({ show: true, member: editingMember, reason: 'शादी' })}
                    className="flex-1 bg-rose-100 hover:bg-rose-200 text-rose-700 font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-user-minus"></i>
                    हटाएं
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-16 text-center border-4 border-dashed border-gray-100 text-gray-300 flex flex-col items-center justify-center animate-pulse">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                <i className="fa-solid fa-mouse-pointer text-4xl"></i>
              </div>
              <p className="font-black text-xl text-gray-400">संपादित करने के लिए सदस्य चुनें</p>
              <p className="text-sm mt-2 font-medium">बाईं ओर दी गई सूची से किसी एक पर क्लिक करें</p>
            </div>
          )}
        </div>
      </div>

      {aadhaarWarning.show && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] max-w-md w-full p-8 shadow-2xl border-t-[12px] border-amber-500 animate-in fade-in zoom-in duration-300">
            <div className="text-amber-500 text-6xl mb-6 text-center">
              <i className="fa-solid fa-id-card-clip"></i>
            </div>
            <h3 className="text-2xl font-black text-gray-900 text-center mb-4 leading-tight">आधार संख्या पहले से मौजूद है!</h3>
            <div className="bg-amber-50 p-5 rounded-2xl border-2 border-amber-100 space-y-3 mb-8">
              <div className="flex justify-between items-center pb-2 border-b border-amber-200">
                <span className="text-[10px] font-black text-amber-600 uppercase">मौजूदा सदस्य</span>
                <span className="text-xs font-bold text-amber-700">SVN: {aadhaarWarning.duplicate?.svn}</span>
              </div>
              <p className="text-xl font-black text-gray-900">{aadhaarWarning.duplicate?.voterName}</p>
              <p className="text-sm text-gray-700 font-medium">
                बूथ: {aadhaarWarning.duplicate?.boothNo} • 
                वार्ड: {aadhaarWarning.duplicate?.wardNo} • 
                मकान: {aadhaarWarning.duplicate?.houseNo}
              </p>
            </div>
            <button 
              onClick={() => setAadhaarWarning({ show: false, duplicate: null })}
              className="w-full bg-gray-900 hover:bg-black text-white font-black py-4 rounded-2xl transition-all shadow-xl hover:shadow-gray-200"
            >
              ठीक है, समझ गया
            </button>
          </div>
        </div>
      )}

      {showDeleteModal.show && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] max-w-md w-full p-8 shadow-2xl border-t-[12px] border-rose-600 animate-in fade-in zoom-in duration-300">
            <h3 className="text-2xl font-black text-gray-900 mb-2 text-center">सदस्य हटाएं</h3>
            <p className="text-sm text-gray-500 text-center mb-8 font-medium">
              क्या आप <span className="font-black text-rose-600 underline decoration-rose-200 decoration-4 underline-offset-4">{showDeleteModal.member?.voterName}</span> को हटाना चाहते हैं?
            </p>
            
            <div className="mb-8">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 text-center">हटाने का कारण चुनें</label>
              <div className="grid grid-cols-2 gap-3">
                {DELETE_REASONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setShowDeleteModal({ ...showDeleteModal, reason: r })}
                    className={`p-3 rounded-xl font-bold text-sm transition-all border-2 ${showDeleteModal.reason === r ? 'bg-rose-600 border-rose-600 text-white shadow-lg' : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-rose-200'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setShowDeleteModal({ show: false, member: null, reason: 'शादी' })}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 font-black py-4 rounded-2xl transition-all"
              >
                रद्द करें
              </button>
              <button 
                onClick={handleDeleteConfirm}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-4 rounded-2xl shadow-lg hover:shadow-rose-200 transition-all"
              >
                पुष्टि करें
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f3f4f6;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
    </div>
  );
};

export default App;
