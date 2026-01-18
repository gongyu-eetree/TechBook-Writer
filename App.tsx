
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  BookOpen, Loader2, FileText, Sparkles, RefreshCcw, Trash2, X, Printer, FileType, 
  Globe, UploadCloud, Link as LinkIcon, Plus, CheckCircle2, Image as ImageIcon, 
  Save, Library, Upload, AlertCircle, FileCode, Presentation, PlusCircle, ArrowLeft, 
  Zap, Check, Maximize2, Download, AlignCenter, AlignLeft, AlignRight, Coins, Users, Code, Layers, FileDown, Eye
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import html2pdf from 'html2pdf.js';
import { 
  EbookProject, EbookStructure, GenerationStatus, CREDIT_PACKS, CreditPack, TargetAudience
} from './types';
import { 
  generateEbookStructure, generateEbookContent, generateBookCover, generateChapterContent
} from './services/geminiService';

const CREDITS_PER_PAGE = 100;
const STRUCTURE_COST = 500;
const COVER_REGEN_COST = 300;
const PPT_GEN_COST = 800;

const AUDIENCES: { id: TargetAudience; name: string; icon: any }[] = [
  { id: 'Novice', name: '入门新手', icon: Users },
  { id: 'Intermediate', name: '中级工程师', icon: Code },
  { id: 'Expert', name: '高级专家', icon: Sparkles }
];

const App: React.FC = () => {
  const [project, setProject] = useState<EbookProject>({
    description: '',
    materials: '',
    language: 'Python',
    outputLanguage: 'Chinese',
    writingStyle: 'Technical Manual',
    targetAudience: 'Intermediate',
    referenceLinks: [],
    targetLength: 'Medium',
    chapterCount: 8
  });

  const [savedProjects, setSavedProjects] = useState<EbookProject[]>([]);
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [structure, setStructure] = useState<EbookStructure | null>(null);
  const [content, setContent] = useState<string>('');
  const [chapterContents, setChapterContents] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isFullscreenCover, setIsFullscreenCover] = useState(false);
  
  const [userBalance, setUserBalance] = useState<number>(10000); 
  const [showBilling, setShowBilling] = useState(false);
  const [isTopUpPending, setIsTopUpPending] = useState<string | null>(null);
  const [newLink, setNewLink] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imgUrl, setImgUrl] = useState('');
  const [imgWidth, setImgWidth] = useState('100%');
  const [imgAlign, setImgAlign] = useState<'left' | 'center' | 'right'>('center');
  const [imageTab, setImageTab] = useState<'upload' | 'link'>('upload');

  const manuscriptRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputImgRef = useRef<HTMLInputElement>(null);

  const remainingUnbuiltCost = useMemo(() => {
    if (!structure) return 0;
    return structure.chapters
      .filter(ch => !ch.isGenerated)
      .reduce((sum, ch) => sum + (ch.estimatedPages * CREDITS_PER_PAGE), 0);
  }, [structure]);

  useEffect(() => {
    try {
      const localData = localStorage.getItem('techbook_projects');
      if (localData) {
        const parsed = JSON.parse(localData);
        if (Array.isArray(parsed)) setSavedProjects(parsed);
      }
    } catch (e) { console.error(e); }
  }, []);

  const saveToLibrary = () => {
    if (!structure) return;
    const newProject: EbookProject = {
      ...project,
      id: project.id || Date.now().toString(),
      content,
      chapterContents,
      coverUrl,
      structure,
      lastUpdated: Date.now()
    };
    setSavedProjects(prev => {
      const updated = [newProject, ...prev.filter(p => p.id !== newProject.id)];
      localStorage.setItem('techbook_projects', JSON.stringify(updated));
      return updated;
    });
    setProject(newProject);
  };

  const loadProject = (p: EbookProject) => {
    setProject(p);
    setStructure(p.structure || null);
    setContent(p.content || '');
    setChapterContents(p.chapterContents || []);
    setCoverUrl(p.coverUrl || '');
    setStatus(GenerationStatus.COMPLETED);
    setIsEditing(false);
    setError(null);
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedProjects(prev => {
      const updated = prev.filter(p => p.id !== id);
      localStorage.setItem('techbook_projects', JSON.stringify(updated));
      return updated;
    });
  };

  const handleAddLink = () => {
    if (newLink && newLink.trim().startsWith('http')) {
      setProject(p => ({ ...p, referenceLinks: [...p.referenceLinks, newLink.trim()] }));
      setNewLink('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    let newMaterials = project.materials;
    for (let i = 0; i < files.length; i++) {
      const content = await files[i].text();
      newMaterials += `\n\n--- 文件来源: ${files[i].name} ---\n${content}`;
    }
    setProject(p => ({ ...project, materials: newMaterials }));
    setIsUploading(false);
  };

  const startStructureGeneration = async () => {
    if (userBalance < STRUCTURE_COST) { setShowBilling(true); return; }
    try {
      setStatus(GenerationStatus.GENERATING_STRUCTURE);
      const res = await generateEbookStructure(project);
      setUserBalance(prev => prev - STRUCTURE_COST);
      setStructure(res);
      setChapterContents(new Array(res.chapters.length).fill(''));
      setStatus(GenerationStatus.REVIEW_STRUCTURE);
    } catch (err: any) { setStatus(GenerationStatus.ERROR); setError(err.message); }
  };

  const updateChapter = (index: number, field: keyof EbookStructure['chapters'][0], value: any) => {
    if (!structure) return;
    const newChapters = [...structure.chapters];
    newChapters[index] = { ...newChapters[index], [field]: value };
    setStructure({ ...structure, chapters: newChapters });
  };

  const addChapter = () => {
    if (!structure) return;
    const newChapters = [...structure.chapters, { title: '新章节', description: '请描述章节内容...', estimatedPages: 5, isGenerated: false }];
    setStructure({ ...structure, chapters: newChapters });
    setChapterContents([...chapterContents, '']);
  };

  const removeChapter = (index: number) => {
    if (!structure || structure.chapters.length <= 1) return;
    setStructure({
      ...structure,
      chapters: structure.chapters.filter((_, i) => i !== index)
    });
    setChapterContents(chapterContents.filter((_, i) => i !== index));
  };

  const generateChapter = async (index: number) => {
    if (!structure) return;
    const cost = structure.chapters[index].estimatedPages * CREDITS_PER_PAGE;
    if (userBalance < cost) { setShowBilling(true); return; }
    setGeneratingIndex(index);
    try {
      const chContent = await generateChapterContent(project, structure, index);
      const newChapters = [...structure.chapters];
      newChapters[index] = { ...newChapters[index], isGenerated: true };
      setStructure({ ...structure, chapters: newChapters });
      const newContents = [...chapterContents];
      newContents[index] = chContent;
      setChapterContents(newContents);
      setUserBalance(prev => prev - cost);
      setContent(newContents.filter(c => c).join('\n\n---\n\n'));
    } catch (err: any) { setError(err.message); } finally { setGeneratingIndex(null); }
  };

  const startContentGeneration = async () => {
    if (!structure || userBalance < remainingUnbuiltCost) return;
    try {
      setStatus(GenerationStatus.GENERATING_CONTENT);
      const full = await generateEbookContent(project, structure);
      setUserBalance(prev => prev - remainingUnbuiltCost);
      setContent(full);
      if (!coverUrl) {
        setStatus(GenerationStatus.GENERATING_COVER);
        const cover = await generateBookCover(structure.coverPrompt);
        setCoverUrl(cover);
      }
      setStatus(GenerationStatus.COMPLETED);
    } catch (err: any) { setStatus(GenerationStatus.ERROR); setError(err.message); }
  };

  const handleRegenerateCover = async () => {
    if (!structure || userBalance < COVER_REGEN_COST) {
      if (userBalance < COVER_REGEN_COST) setShowBilling(true);
      return;
    }
    try {
      setError(null);
      const newCover = await generateBookCover(structure.coverPrompt);
      if (newCover) {
        setCoverUrl(newCover);
        setUserBalance(prev => prev - COVER_REGEN_COST);
      }
    } catch (err: any) { setError("封面生成失败: " + err.message); }
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setCoverUrl(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleInsertImage = () => {
    if (!imgUrl) return;
    const imgTag = `\n\n<div style="text-align: ${imgAlign};"><img src="${imgUrl}" style="width: ${imgWidth}; max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" /></div>\n\n`;
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      setContent(content.substring(0, start) + imgTag + content.substring(end));
    } else { setContent(prev => prev + imgTag); }
    setShowImageModal(false); setImgUrl('');
  };

  const handleExportMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${structure?.title || 'TechBook'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportWord = () => {
    // 简单的 HTML-to-Word 导出方案（使用 Blob 模拟）
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
            "xmlns:w='urn:schemas-microsoft-com:office:word' "+
            "xmlns='http://www.w3.org/TR/REC-html40'>"+
            "<head><meta charset='utf-8'><title>Export</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + (manuscriptRef.current?.innerHTML || "") + footer;
    
    const blob = new Blob(['\ufeff', sourceHTML], {
        type: 'application/msword'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${structure?.title || 'TechBook'}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    if (!manuscriptRef.current || isExportingPDF) return;
    setIsExportingPDF(true);
    
    // 强制显示克隆 DOM 并渲染
    const element = manuscriptRef.current;
    const opt = {
      margin: 10,
      filename: `${structure?.title || 'TechBook'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      setError("PDF 渲染受限，请尝试使用浏览器打印功能 (Ctrl+P) 并选择另存为 PDF。");
    } finally { setIsExportingPDF(false); }
  };

  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setImgUrl(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleTopUp = (pack: CreditPack) => {
    setIsTopUpPending(pack.id);
    setTimeout(() => { setUserBalance(prev => prev + pack.credits); setIsTopUpPending(null); setShowBilling(false); }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <nav className="h-20 flex items-center justify-between px-8 bg-white border-b sticky top-0 z-50 shadow-sm no-print">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/10"><BookOpen className="w-7 h-7 text-white" /></div>
          <div><h1 className="text-xl font-black tracking-tight">TechBook AI 创作工坊</h1><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">多源驱动智能技术创作</p></div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-200 shadow-inner">
            <div className="flex flex-col items-end"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">可用点数</span><span className="text-base font-black text-indigo-600">{userBalance.toLocaleString()} Credits</span></div>
            <button onClick={() => setShowBilling(true)} className="p-2 bg-indigo-600 rounded-xl hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/10 active:scale-95"><Plus className="w-5 h-5 text-white" /></button>
          </div>
          {status !== GenerationStatus.IDLE && (<button onClick={() => window.location.reload()} className="p-3 text-slate-500 hover:text-indigo-600 transition bg-white rounded-2xl border border-slate-200 shadow-sm"><RefreshCcw className="w-6 h-6" /></button>)}
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto pb-20">
        {error && <div className="max-w-6xl mx-auto mt-8 px-8"><div className="bg-red-50 border border-red-100 p-6 rounded-[32px] flex items-center gap-4 text-red-700 animate-in slide-in-from-top-4 shadow-sm"><AlertCircle className="w-6 h-6" /><p className="font-bold">{error}</p><button onClick={() => setError(null)} className="ml-auto p-2 hover:bg-red-100 rounded-full transition"><X className="w-5 h-5" /></button></div></div>}

        {status === GenerationStatus.IDLE && (
          <div className="max-w-7xl mx-auto py-12 px-8 flex flex-col xl:flex-row gap-12 no-print">
            <div className="flex-1 space-y-10">
              <div className="flex items-center justify-between mb-4"><h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><Sparkles className="text-indigo-600 w-8 h-8" /> 开启创作</h2></div>
              
              <section className="bg-white border border-slate-200 p-8 rounded-[40px] shadow-xl space-y-6">
                <div className="flex items-center gap-4"><div className="p-2.5 bg-indigo-50 rounded-xl"><FileText className="w-6 h-6 text-indigo-600" /></div><h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">1. 书籍描述与创作目标</h3></div>
                <textarea className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-8 text-xl font-bold placeholder:text-slate-300 focus:border-indigo-600 transition outline-none min-h-[180px] shadow-inner" placeholder="描述你的书籍主题、深度、目标读者和核心产出..." value={project.description} onChange={e => setProject({...project, description: e.target.value})} />
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="bg-white border border-slate-200 p-8 rounded-[40px] shadow-xl space-y-6">
                  <div className="flex items-center gap-4"><div className="p-2.5 bg-blue-50 rounded-xl"><Users className="w-6 h-6 text-blue-600" /></div><h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">2. 目标读者</h3></div>
                  <div className="grid grid-cols-1 gap-3">
                    {AUDIENCES.map(aud => (
                      <button key={aud.id} onClick={() => setProject({...project, targetAudience: aud.id})} className={`flex items-center gap-4 p-5 rounded-3xl border-2 transition-all ${project.targetAudience === aud.id ? 'bg-indigo-50 border-indigo-600 shadow-md' : 'bg-white border-slate-100 hover:border-indigo-200'}`}>
                        <aud.icon className={`w-6 h-6 ${project.targetAudience === aud.id ? 'text-indigo-600' : 'text-slate-300'}`} />
                        <span className={`font-black ${project.targetAudience === aud.id ? 'text-indigo-600' : 'text-slate-400'}`}>{aud.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="bg-white border border-slate-200 p-8 rounded-[40px] shadow-xl space-y-6">
                  <div className="flex items-center gap-4"><div className="p-2.5 bg-orange-50 rounded-xl"><Layers className="w-6 h-6 text-orange-600" /></div><h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">3. 参考资料</h3></div>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none focus:border-indigo-600 transition" placeholder="粘贴网页链接..." value={newLink} onChange={e => setNewLink(e.target.value)} />
                      <button onClick={handleAddLink} className="p-4 bg-slate-900 text-white rounded-2xl"><Plus/></button>
                    </div>
                    <div onClick={() => fileInputRef.current?.click()} className={`h-32 border-4 border-dashed rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition ${isUploading ? 'opacity-50' : ''}`}>
                      <UploadCloud className="w-8 h-8 text-slate-300" />
                      <span className="text-xs font-black text-slate-400">点击上传 PDF/DOC/TXT 文档</span>
                      <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                    </div>
                  </div>
                </section>
              </div>

              <button onClick={startStructureGeneration} disabled={!project.description} className="w-full py-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-[40px] text-2xl font-black shadow-2xl shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-4"><Sparkles className="w-8 h-8" />立即规划大纲 (需 {STRUCTURE_COST} 点)</button>
            </div>

            <div className="w-full xl:w-96 space-y-8">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Library className="text-indigo-600" /> 我的作品库</h2>
              <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                {savedProjects.length === 0 ? (
                  <div className="bg-white border-2 border-dashed border-slate-200 p-12 rounded-[40px] text-center"><p className="text-slate-400 font-bold text-xs uppercase">暂无本地项目</p></div>
                ) : (
                  savedProjects.map(p => (
                    <div key={p.id} onClick={() => loadProject(p)} className="group bg-white border border-slate-200 p-5 rounded-[32px] shadow-sm hover:shadow-xl hover:border-indigo-300 transition-all cursor-pointer flex gap-4 items-center">
                      <div className="w-16 h-20 bg-slate-50 rounded-xl flex-shrink-0 border flex items-center justify-center">
                        {p.coverUrl ? <img src={p.coverUrl} className="w-full h-full object-cover rounded-xl" /> : <BookOpen className="text-slate-200" />}
                      </div>
                      <div className="flex-1 min-w-0"><h4 className="text-sm font-black text-slate-900 truncate mb-1">{p.structure?.title || '未命名项目'}</h4><p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(p.lastUpdated || Date.now()).toLocaleDateString()}</p></div>
                      <button onClick={(e) => deleteProject(p.id!, e)} className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-500 rounded-xl transition"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {status === GenerationStatus.REVIEW_STRUCTURE && structure && (
          <div className="max-w-4xl mx-auto py-16 px-8 animate-in fade-in slide-in-from-bottom-8">
            <button onClick={() => setStatus(GenerationStatus.IDLE)} className="mb-8 flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-black text-sm uppercase transition"><ArrowLeft className="w-4 h-4" /> 返回修改设置</button>
            
            <div className={`mb-8 p-6 rounded-[32px] border-2 transition-all flex items-center justify-between ${userBalance < remainingUnbuiltCost ? 'bg-red-50 border-red-200 text-red-700' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}>
               <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${userBalance < remainingUnbuiltCost ? 'bg-red-100' : 'bg-indigo-100'}`}><Coins className="w-6 h-6" /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">创作预算明细</p>
                    <p className="text-lg font-black">预计消耗：{remainingUnbuiltCost.toLocaleString()} 点 <span className="mx-2 opacity-30">|</span> 余额：{userBalance.toLocaleString()} 点</p>
                  </div>
               </div>
               {userBalance < remainingUnbuiltCost && (
                 <button onClick={() => setShowBilling(true)} className="px-6 py-3 bg-red-600 text-white rounded-xl font-black text-sm shadow-lg shadow-red-600/20 hover:bg-red-500 transition">点数不足，立即充值</button>
               )}
            </div>

            <div className="bg-white border border-slate-200 rounded-[48px] p-12 shadow-2xl space-y-10">
              <div className="flex flex-col md:flex-row justify-between items-start gap-8 border-b pb-10">
                <div className="space-y-2"><h2 className="text-4xl font-black text-slate-900 leading-tight">完善内容大纲</h2><p className="text-slate-500 font-medium">计费标准：{CREDITS_PER_PAGE} 点 / 每页预计内容</p></div>
                <button onClick={startContentGeneration} disabled={userBalance < remainingUnbuiltCost} className="px-12 py-6 bg-indigo-600 text-white font-black text-xl rounded-[32px] hover:bg-indigo-500 shadow-2xl active:scale-95 transition flex flex-col items-center gap-1">一键生成全文<span className="text-[10px] uppercase font-black opacity-60">总计消耗 {remainingUnbuiltCost.toLocaleString()} 点</span></button>
              </div>
              
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">最终书名</label>
                <input className="w-full bg-slate-50 border-2 border-slate-100 p-8 rounded-[32px] text-3xl font-black text-slate-900 focus:border-indigo-600 outline-none transition" value={structure.title} onChange={e => setStructure({...structure, title: e.target.value})} />
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center px-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">章节排布与内容设定</label>
                   <button onClick={addChapter} className="flex items-center gap-1.5 text-indigo-600 text-xs font-black hover:bg-indigo-50 px-3 py-1 rounded-full transition"><PlusCircle className="w-3.5 h-3.5"/> 添加新章节</button>
                </div>
                {structure.chapters.map((ch, i) => (
                  <div key={i} className={`group relative bg-slate-50 p-8 rounded-[32px] border-2 transition-all ${ch.isGenerated ? 'border-green-100' : 'border-slate-100 hover:border-indigo-200'}`}>
                    <div className="flex flex-col gap-6">
                      <div className="flex gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-indigo-600 border flex-shrink-0">{i+1}</div>
                        <div className="flex-1 space-y-4">
                          <div className="flex gap-4">
                            <input 
                              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-900 text-lg outline-none focus:border-indigo-400 transition" 
                              value={ch.title} 
                              onChange={e => updateChapter(i, 'title', e.target.value)} 
                              placeholder="章节标题"
                            />
                            <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl">
                              <span className="text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">页数</span>
                              <input 
                                type="number" 
                                min="1" 
                                className="w-12 font-black text-indigo-600 outline-none text-center bg-transparent" 
                                value={ch.estimatedPages} 
                                onChange={e => updateChapter(i, 'estimatedPages', Math.max(1, parseInt(e.target.value) || 1))} 
                              />
                            </div>
                          </div>
                          <textarea 
                            className="w-full bg-white border border-slate-200 p-4 rounded-xl text-slate-600 text-sm outline-none focus:border-indigo-400 transition min-h-[80px]" 
                            value={ch.description} 
                            onChange={e => updateChapter(i, 'description', e.target.value)} 
                            placeholder="描述本章节的核心知识点..."
                          />
                        </div>
                      </div>
                      
                      <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
                        <button onClick={() => generateChapter(i)} disabled={generatingIndex !== null} className={`px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition active:scale-95 ${ch.isGenerated ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>
                          {generatingIndex === i ? <Loader2 className="w-4 h-4 animate-spin" /> : ch.isGenerated ? <Check className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                          {generatingIndex === i ? '生成中...' : ch.isGenerated ? '重新生成本章' : `生成本章 (${ch.estimatedPages * 100} 点)`}
                        </button>
                        <button onClick={() => removeChapter(i)} className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {status === GenerationStatus.COMPLETED && (
          <div className="max-w-[1400px] mx-auto py-12 px-8 animate-in fade-in">
            <button onClick={() => setStatus(GenerationStatus.REVIEW_STRUCTURE)} className="mb-8 flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-black text-sm uppercase transition no-print"><ArrowLeft className="w-4 h-4" /> 返回大纲调整</button>
            
            <div className="bg-white border border-slate-200 p-10 rounded-[40px] shadow-xl mb-12 no-print flex flex-col lg:flex-row justify-between items-center gap-10">
              <div className="flex items-center gap-8 group">
                <div className="relative w-32 h-44 bg-slate-100 rounded-2xl shadow-2xl overflow-hidden border-4 border-white transition-transform group-hover:scale-105">
                  {coverUrl ? <img src={coverUrl} className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-8 text-slate-300" />}
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <button onClick={() => setIsFullscreenCover(true)} className="p-2 bg-white/20 hover:bg-white/40 rounded-lg text-white"><Maximize2 className="w-5 h-5"/></button>
                    <button onClick={() => coverInputRef.current?.click()} className="p-2 bg-white/20 hover:bg-white/40 rounded-lg text-white"><Upload className="w-5 h-5"/></button>
                    <button onClick={handleRegenerateCover} className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white"><RefreshCcw className="w-5 h-5"/></button>
                    <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={handleCoverUpload} />
                  </div>
                </div>
                <div>
                  <h2 className="text-3xl font-black mb-3">{structure?.title}</h2>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-green-100"><CheckCircle2 className="w-3.5 h-3.5"/> 稿件已就绪</div>
                    <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-indigo-100">{structure?.chapters.length} 个章节</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">视图管理</span>
                  <div className="flex bg-slate-50 p-1.5 rounded-2xl border"><button onClick={() => setIsEditing(false)} className={`px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 ${!isEditing ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}><Eye className="w-4 h-4"/>预览</button><button onClick={() => setIsEditing(true)} className={`px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 ${isEditing ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}><FileCode className="w-4 h-4"/>编辑</button></div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">导出选项</span>
                  <div className="flex gap-2">
                    <button onClick={handleExportMarkdown} title="导出 Markdown" className="p-3.5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition"><FileCode className="w-5 h-5"/></button>
                    <button onClick={handleExportWord} title="导出 Word" className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition"><FileType className="w-5 h-5"/></button>
                    <button onClick={handleExportPDF} disabled={isExportingPDF} title="打印/PDF" className={`p-3.5 rounded-2xl transition shadow-lg ${isExportingPDF ? 'bg-slate-100 text-slate-400' : 'bg-red-600 text-white hover:bg-red-500 shadow-red-600/20'}`}>{isExportingPDF ? <Loader2 className="w-5 h-5 animate-spin"/> : <Printer className="w-5 h-5"/></button>
                    <button onClick={saveToLibrary} title="保存项目" className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition"><Save className="w-5 h-5"/></button>
                  </div>
                </div>
              </div>
            </div>

            {/* 插入图片工具栏 - 独立于输出区 */}
            <div className="max-w-4xl mx-auto mb-8 no-print">
              <button onClick={() => setShowImageModal(true)} className="w-full py-4 bg-orange-50 border-2 border-dashed border-orange-200 rounded-[24px] text-orange-600 font-black flex items-center justify-center gap-3 hover:bg-orange-100 transition active:scale-[0.99]">
                <PlusCircle className="w-6 h-6" /> 插入技术插图 (支持本地/远程)
              </button>
            </div>

            {isEditing ? (
              <div className="bg-white p-12 rounded-[48px] shadow-2xl border min-h-[700px] flex flex-col">
                <textarea ref={textareaRef} className="w-full h-full min-h-[600px] bg-transparent text-slate-800 font-mono text-lg leading-relaxed outline-none resize-none flex-1" value={content} onChange={e => setContent(e.target.value)} onBlur={saveToLibrary} placeholder="在此处编辑 Markdown 源码..." />
              </div>
            ) : (
              <div className="bg-white p-12 lg:p-24 rounded-[48px] shadow-2xl border min-h-[800px]">
                <div ref={manuscriptRef} className="prose prose-slate prose-lg max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, rehypeRaw]} components={{
                    code({ node, inline, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (<SyntaxHighlighter style={vscDarkPlus as any} language={match[1]} PreTag="div" className="rounded-2xl my-8" {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter>) : (<code className="bg-slate-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold" {...props}>{children}</code>);
                    }
                  }}>{content}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {(status === GenerationStatus.GENERATING_STRUCTURE || status === GenerationStatus.GENERATING_CONTENT || status === GenerationStatus.GENERATING_COVER) && (
          <div className="h-[80vh] flex flex-col items-center justify-center text-center px-8">
             <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mb-8" />
             <h2 className="text-3xl font-black text-slate-900 tracking-tight">AI 正在深度创作中...</h2>
             <p className="mt-4 text-slate-400 font-bold uppercase tracking-widest text-xs">正在分析上下文并生成专业技术原稿</p>
          </div>
        )}
      </main>

      {/* 封面全屏预览 */}
      {isFullscreenCover && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-8" onClick={() => setIsFullscreenCover(false)}>
          <button className="absolute top-8 right-8 text-white hover:rotate-90 transition"><X className="w-10 h-10" /></button>
          <img src={coverUrl} className="max-w-full max-h-full rounded-3xl shadow-2xl border-4 border-white/10" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {showImageModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
           <div className="bg-white border border-slate-200 rounded-[40px] shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b flex justify-between items-center bg-slate-50/50"><div className="flex items-center gap-4"><div className="p-3 bg-orange-600 rounded-2xl"><ImageIcon className="text-white w-6 h-6" /></div><h2 className="text-2xl font-black">插入技术插图</h2></div><button onClick={() => setShowImageModal(false)}><X /></button></div>
              <div className="p-10 flex flex-col md:flex-row gap-10">
                <div className="flex-1 space-y-8">
                  <div className="flex bg-slate-100 p-1 rounded-2xl border">
                    <button onClick={() => setImageTab('upload')} className={`flex-1 py-2 rounded-xl font-black text-xs ${imageTab === 'upload' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>本地上传</button>
                    <button onClick={() => setImageTab('link')} className={`flex-1 py-2 rounded-xl font-black text-xs ${imageTab === 'link' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>外部链接</button>
                  </div>
                  {imageTab === 'link' ? (
                    <input className="w-full bg-slate-50 border-2 rounded-2xl px-5 py-4 font-bold outline-none focus:border-orange-600 transition" placeholder="输入图片 URL..." value={imgUrl} onChange={e => setImgUrl(e.target.value)} />
                  ) : (
                    <div onClick={() => fileInputImgRef.current?.click()} className="w-full h-32 border-4 border-dashed rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition">
                      <UploadCloud className="w-8 h-8 text-slate-300" /><span className="text-xs font-black text-slate-400 mt-2">选择图片文件</span>
                      <input type="file" ref={fileInputImgRef} className="hidden" accept="image/*" onChange={handleLocalImageUpload} />
                    </div>
                  )}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">对齐与宽度 ({imgWidth})</label>
                    <div className="flex gap-2">
                      <button onClick={() => setImgAlign('left')} className={`flex-1 p-3 rounded-xl border-2 font-bold text-xs ${imgAlign === 'left' ? 'bg-orange-50 border-orange-600' : 'bg-white'}`}>居左</button>
                      <button onClick={() => setImgAlign('center')} className={`flex-1 p-3 rounded-xl border-2 font-bold text-xs ${imgAlign === 'center' ? 'bg-orange-50 border-orange-600' : 'bg-white'}`}>居中</button>
                      <button onClick={() => setImgAlign('right')} className={`flex-1 p-3 rounded-xl border-2 font-bold text-xs ${imgAlign === 'right' ? 'bg-orange-50 border-orange-600' : 'bg-white'}`}>居右</button>
                    </div>
                    <input type="range" min="10" max="100" step="5" value={parseInt(imgWidth)} onChange={e => setImgWidth(e.target.value + '%')} className="w-full accent-orange-600" />
                  </div>
                </div>
                <div className="w-full md:w-64 flex flex-col items-center justify-center p-6 bg-slate-50 rounded-[32px] border-4 border-dashed border-slate-100 overflow-hidden">
                  {imgUrl ? <img src={imgUrl} className="max-h-40 rounded-xl shadow-md" /> : <ImageIcon className="w-12 h-12 text-slate-200" />}
                </div>
              </div>
              <div className="p-8 bg-slate-50 border-t flex gap-4"><button onClick={() => setShowImageModal(false)} className="flex-1 py-4 bg-white border rounded-2xl font-black">取消</button><button onClick={handleInsertImage} disabled={!imgUrl} className="flex-[2] py-4 bg-orange-600 text-white rounded-2xl font-black shadow-xl hover:bg-orange-500 transition">插入原稿</button></div>
           </div>
        </div>
      )}

      {showBilling && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-[40px] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95">
            <div className="p-10 border-b flex justify-between items-center"><h2 className="text-3xl font-black text-slate-900 tracking-tight">点数充值</h2><button onClick={() => setShowBilling(false)} className="p-3 hover:bg-slate-100 rounded-full transition"><X className="w-6 h-6 text-slate-400" /></button></div>
            <div className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {CREDIT_PACKS.map(pack => (
                <div key={pack.id} onClick={() => handleTopUp(pack)} className={`p-6 bg-white rounded-3xl border-2 transition-all hover:scale-[1.03] cursor-pointer flex flex-col ${pack.popular ? 'border-indigo-600 shadow-xl' : 'border-slate-100 shadow-sm'}`}>
                  <h3 className="text-xs font-black text-slate-400 uppercase mb-2">{pack.name}</h3>
                  <div className="text-2xl font-black text-slate-900 mb-2">{pack.credits.toLocaleString()} <span className="text-xs text-indigo-600">点</span></div>
                  <div className="text-xl font-black text-indigo-600 mt-auto">{pack.price}</div>
                  <p className="text-[10px] text-slate-400 mt-4 font-bold leading-relaxed">{pack.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="h-14 flex items-center justify-center border-t bg-white text-slate-400 font-bold text-[9px] uppercase tracking-widest no-print">&copy; 2025 TechBook AI 创作工坊 - 深度集成 Gemini 系列模型</footer>
    </div>
  );
};

export default App;
