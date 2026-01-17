
import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  ChevronRight, 
  Loader2, 
  FileText, 
  Sparkles,
  RefreshCcw,
  Trash2,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  X,
  Printer,
  FileType,
  Globe,
  UploadCloud,
  Link as LinkIcon,
  CreditCard,
  Plus,
  Users,
  Code,
  Download,
  Edit3,
  Eye,
  CheckCircle2,
  Image as ImageIcon,
  Save,
  Library,
  Upload,
  AlertCircle,
  Hash,
  FileCode
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  EbookProject, 
  EbookStructure, 
  GenerationStatus,
  CREDIT_PACKS,
  CreditPack,
  TargetAudience
} from './types';
import { 
  generateEbookStructure, 
  generateEbookContent, 
  generateBookCover 
} from './services/geminiService';

const LANGUAGES = ['C', 'C++', 'Python', 'Verilog', 'VHDL', 'Rust', 'JavaScript', 'Go', 'Java'];

const WRITING_STYLES = [
  { id: 'Technical Manual', name: '技术手册', desc: '严谨专业的技术文档风格' },
  { id: 'Tutorial', name: '教学教程', desc: '循序渐进的教学风格' },
  { id: 'Practical Guide', name: '实战指南', desc: '注重实践的动手风格' },
  { id: 'Reference Manual', name: '参考手册', desc: '快速查阅的工具书风格' }
];

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
  const [isEditing, setIsEditing] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  const [userBalance, setUserBalance] = useState<number>(10000); 
  const [showBilling, setShowBilling] = useState(false);
  const [isTopUpPending, setIsTopUpPending] = useState<string | null>(null);
  const [newLink, setNewLink] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const manuscriptRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

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
    if (newLink && newLink.trim() !== '') {
      if (!newLink.startsWith('http')) {
        setError("请输入有效的 URL (以 http:// 或 https:// 开头)");
        return;
      }
      setProject(p => ({ ...p, referenceLinks: [...p.referenceLinks, newLink.trim()] }));
      setNewLink('');
      setError(null);
    }
  };

  const removeLink = (index: number) => {
    setProject(p => ({ ...p, referenceLinks: p.referenceLinks.filter((_, i) => i !== index) }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let newMaterials = project.materials;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const content = await readFileAsText(file);
      newMaterials += `\n\n--- 文件来源: ${file.name} ---\n${content}`;
    }

    setProject(p => ({ ...p, materials: newMaterials }));
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || "");
      reader.onerror = () => resolve(`[无法读取文件内容: ${file.name}]`);
      reader.readAsText(file);
    });
  };

  const startStructureGeneration = async () => {
    if (userBalance < 500) { setShowBilling(true); return; }
    try {
      setError(null);
      setStatus(GenerationStatus.GENERATING_STRUCTURE);
      const ebookStructure = await generateEbookStructure(project);
      setUserBalance(prev => Math.max(0, prev - 500));
      setStructure(ebookStructure);
      setStatus(GenerationStatus.REVIEW_STRUCTURE);
    } catch (err: any) {
      setError(err.message || '大纲规划失败');
      setStatus(GenerationStatus.ERROR);
    }
  };

  const startContentGeneration = async () => {
    if (!structure) return;
    if (userBalance < 1000) { setShowBilling(true); return; }
    try {
      setError(null);
      setStatus(GenerationStatus.GENERATING_CONTENT);
      const fullContent = await generateEbookContent(project, structure);
      setUserBalance(prev => Math.max(0, prev - Math.floor(fullContent.length / 2)));
      setContent(fullContent);
      setStatus(GenerationStatus.GENERATING_COVER);
      try {
        const cover = await generateBookCover(structure.coverPrompt);
        setCoverUrl(cover);
      } catch (e) { console.warn(e); }
      setStatus(GenerationStatus.COMPLETED);
      setTimeout(() => saveToLibrary(), 100);
    } catch (err: any) {
      setError(err.message || '内容生成失败');
      setStatus(GenerationStatus.ERROR);
    }
  };

  const reset = () => {
    setProject({
      description: '', materials: '', language: 'Python', outputLanguage: 'Chinese',
      writingStyle: 'Technical Manual', targetAudience: 'Intermediate',
      referenceLinks: [], targetLength: 'Medium', chapterCount: 8
    });
    setStatus(GenerationStatus.IDLE);
    setStructure(null); setContent(''); setCoverUrl(''); setError(null); setIsEditing(false);
  };

  const updateChapter = (index: number, field: 'title' | 'description', value: string) => {
    if (!structure) return;
    const newChapters = [...structure.chapters];
    newChapters[index] = { ...newChapters[index], [field]: value };
    setStructure({ ...structure, chapters: newChapters });
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCoverUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTopUp = (pack: CreditPack) => {
    setIsTopUpPending(pack.id);
    setTimeout(() => {
      setUserBalance(prev => prev + pack.credits);
      setIsTopUpPending(null);
      setShowBilling(false);
    }, 1500);
  };

  const handleExportMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${structure?.title || 'ebook'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportWord = () => {
    const htmlHeader = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${structure?.title}</title>
      <style>
        body { font-family: sans-serif; padding: 40px; }
        h1 { text-align: center; font-size: 24pt; margin-bottom: 50pt; }
        h2 { font-size: 18pt; border-bottom: 1px solid #ddd; margin-top: 30pt; }
        pre { background: #f4f4f4; padding: 10px; border: 1px solid #ccc; font-family: monospace; }
        code { background: #eee; padding: 2px 4px; border-radius: 4px; font-family: monospace; }
      </style>
      </head><body>
    `;
    const htmlFooter = `</body></html>`;
    
    // Very basic markdown to HTML conversion for word (mostly for bold/headers)
    let processedContent = content
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
      .replace(/\*(.*)\*/gim, '<i>$1</i>')
      .replace(/```([\s\S]*?)```/gim, '<pre>$1</pre>')
      .replace(/`(.*?)`/gim, '<code>$1</code>')
      .replace(/\n/gim, '<br/>');

    const blob = new Blob([htmlHeader + processedContent + htmlFooter], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${structure?.title || 'ebook'}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Navbar */}
      <nav className="h-20 flex items-center justify-between px-8 bg-white border-b border-slate-200 no-print sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/10">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <div>
             <h1 className="text-xl font-black text-slate-900 tracking-tight">TechBook AI 创作工坊</h1>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">多源驱动智能技术创作</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-200 shadow-inner">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">可用点数</span>
              <span className="text-base font-black text-indigo-600">{userBalance.toLocaleString()} Credits</span>
            </div>
            <button onClick={() => setShowBilling(true)} className="p-2 bg-indigo-600 rounded-xl hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/10 active:scale-95">
              <Plus className="w-5 h-5 text-white" />
            </button>
          </div>
          {status !== GenerationStatus.IDLE && (
            <button onClick={reset} className="p-3 text-slate-500 hover:text-indigo-600 transition bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200">
              <RefreshCcw className="w-6 h-6" />
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto">
        {error && (
          <div className="max-w-6xl mx-auto mt-8 px-8 no-print">
            <div className="bg-red-50 border border-red-100 p-6 rounded-[32px] flex items-center gap-4 text-red-700 animate-in slide-in-from-top-4 shadow-sm">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <p className="font-bold">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto p-2 hover:bg-red-100 rounded-full transition"><X className="w-5 h-5" /></button>
            </div>
          </div>
        )}

        {status === GenerationStatus.IDLE && (
          <div className="max-w-7xl mx-auto py-12 px-8 flex flex-col xl:flex-row gap-12 no-print">
            <div className="flex-1 space-y-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                  <Sparkles className="text-indigo-600 w-8 h-8" /> 开启创作
                </h2>
                <div className="flex gap-4">
                  <div className="bg-white border border-slate-200 px-4 py-2 rounded-2xl text-xs font-bold text-slate-400 shadow-sm flex items-center gap-2">
                    <Hash className="w-4 h-4 text-indigo-400" /> ID: {Date.now().toString().slice(-6)}
                  </div>
                </div>
              </div>
              
              {/* Step 1: Core Description */}
              <section className="bg-white border border-slate-200 p-8 rounded-[40px] shadow-xl space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-indigo-50 rounded-xl"><FileText className="w-6 h-6 text-indigo-600" /></div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">1. 书籍描述与创作目标</h3>
                </div>
                <textarea 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-6 text-slate-900 font-bold text-lg placeholder:text-slate-300 focus:border-indigo-600 transition outline-none min-h-[160px] shadow-inner"
                  placeholder="你想写一本什么样的书？请描述主题、深度及核心产出..."
                  value={project.description}
                  onChange={e => setProject({...project, description: e.target.value})}
                />
              </section>

              {/* Step 2: Knowledge Sources (URLs & Files) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="bg-white border border-slate-200 p-8 rounded-[40px] shadow-xl space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-blue-50 rounded-xl"><LinkIcon className="w-6 h-6 text-blue-600" /></div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">2. 参考网页链接</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <input 
                        className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold placeholder:text-slate-300 focus:border-indigo-600 outline-none transition"
                        placeholder="https://..."
                        value={newLink}
                        onChange={e => setNewLink(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddLink()}
                      />
                      <button onClick={handleAddLink} className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 active:scale-95 transition shadow-lg"><Plus className="w-6 h-6"/></button>
                    </div>
                    {project.referenceLinks.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {project.referenceLinks.map((link, idx) => (
                          <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-500">
                            <Globe className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="max-w-[150px] truncate">{link}</span>
                            <button onClick={() => removeLink(idx)} className="hover:text-red-500"><X className="w-3.5 h-3.5"/></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section className="bg-white border border-slate-200 p-8 rounded-[40px] shadow-xl space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-orange-50 rounded-xl"><UploadCloud className="w-6 h-6 text-orange-600" /></div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">3. 上传本地参考文档</h3>
                  </div>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`group relative h-40 border-4 border-slate-100 border-dashed rounded-[32px] flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-indigo-600/30 hover:bg-indigo-50/30 transition-all ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    {isUploading ? <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /> : <Upload className="w-8 h-8 text-slate-300 group-hover:text-indigo-600 transition" />}
                    <div className="text-center">
                      <p className="text-sm font-black text-slate-400 group-hover:text-slate-600 transition">点击上传或拖拽文件</p>
                      <p className="text-[10px] text-slate-300 font-bold">PDF, Word, TXT, Markdown (支持多选)</p>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" multiple accept=".pdf,.doc,.docx,.txt,.md" onChange={handleFileUpload} />
                  </div>
                  {project.materials.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-100 rounded-xl">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-bold text-green-700">已加载本地资料库 (~{(project.materials.length / 1024).toFixed(1)} KB)</span>
                    </div>
                  )}
                </section>
              </div>

              {/* Step 3: Audience & Style */}
              <section className="bg-white border border-slate-200 p-8 rounded-[40px] shadow-xl space-y-8">
                 <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">4. 读者适配与技术风格</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">目标受众</p>
                      <div className="grid grid-cols-3 gap-3">
                        {AUDIENCES.map(aud => (
                          <button
                            key={aud.id}
                            onClick={() => setProject({...project, targetAudience: aud.id})}
                            className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                              project.targetAudience === aud.id ? 'bg-indigo-50 border-indigo-600' : 'bg-slate-50 border-slate-100'
                            }`}
                          >
                            <aud.icon className={`w-6 h-6 mb-2 ${project.targetAudience === aud.id ? 'text-indigo-600' : 'text-slate-300'}`} />
                            <span className="text-[10px] font-black">{aud.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">代码主语言</p>
                      <div className="flex flex-wrap gap-2">
                         {LANGUAGES.map(l => (
                           <button 
                            key={l}
                            onClick={() => setProject({...project, language: l})}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition ${project.language === l ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                           >
                            {l}
                           </button>
                         ))}
                      </div>
                    </div>
                 </div>
              </section>

              <button
                onClick={startStructureGeneration}
                disabled={!project.description}
                className="w-full py-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-[40px] text-2xl font-black shadow-2xl shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-4"
              >
                <Sparkles className="w-8 h-8" />
                立即规划大纲 (需 500 点)
              </button>
            </div>

            {/* Library Sidebar */}
            <div className="w-full xl:w-96 space-y-8">
               <div className="flex items-center justify-between">
                 <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Library className="text-indigo-600" /> 我的作品库</h2>
                 <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black">{savedProjects.length}</span>
               </div>
               <div className="space-y-4 max-h-[1000px] overflow-y-auto pr-2 custom-scrollbar">
                  {savedProjects.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-200 p-12 rounded-[40px] text-center space-y-3">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto"><FileText className="w-8 h-8 text-slate-200" /></div>
                      <p className="text-slate-400 font-bold text-xs uppercase">暂无本地存档</p>
                    </div>
                  ) : (
                    savedProjects.map(p => (
                      <div 
                        key={p.id} 
                        onClick={() => loadProject(p)}
                        className="group relative bg-white border border-slate-200 p-5 rounded-[32px] shadow-sm hover:shadow-xl hover:border-indigo-300 transition-all cursor-pointer flex gap-4 items-center"
                      >
                         <div className="w-20 h-24 bg-slate-50 rounded-xl overflow-hidden border border-slate-100 flex-shrink-0 shadow-inner">
                           {p.coverUrl ? <img src={p.coverUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-5 h-5 text-slate-200" /></div>}
                         </div>
                         <div className="flex-1 min-w-0">
                           <h4 className="text-sm font-black text-slate-900 truncate mb-1">{p.structure?.title || '未命名项目'}</h4>
                           <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400">{new Date(p.lastUpdated || 0).toLocaleDateString()}</span>
                              <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">{p.language}</span>
                           </div>
                         </div>
                         <button 
                           onClick={(e) => deleteProject(p.id!, e)}
                           className="p-3 opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all"
                         >
                           <Trash2 className="w-5 h-5" />
                         </button>
                      </div>
                    ))
                  )}
               </div>
            </div>
          </div>
        )}

        {/* Outline Review */}
        {status === GenerationStatus.REVIEW_STRUCTURE && structure && (
          <div className="max-w-4xl mx-auto py-16 px-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="bg-white border border-slate-200 rounded-[48px] p-12 shadow-2xl space-y-10">
              <div className="flex flex-col md:flex-row justify-between items-start gap-8 border-b border-slate-100 pb-10">
                <div className="space-y-2">
                  <h2 className="text-4xl font-black text-slate-900 leading-tight">完善内容大纲</h2>
                  <p className="text-slate-500 font-medium text-lg">AI 已根据您的需求编排了章节逻辑，请在开始写作前最后确认。</p>
                </div>
                <button 
                  onClick={startContentGeneration}
                  className="group px-12 py-6 bg-indigo-600 text-white font-black text-xl rounded-[32px] hover:bg-indigo-500 transition shadow-2xl shadow-indigo-600/20 flex items-center gap-3 active:scale-95"
                >
                  <span>全自动撰写原稿</span>
                  <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition" />
                </button>
              </div>

              <div className="space-y-6">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">书籍标题</label>
                <input 
                  className="w-full bg-slate-50 border-2 border-slate-100 p-8 rounded-[32px] text-3xl font-black text-slate-900 focus:border-indigo-600 outline-none transition shadow-inner" 
                  value={structure.title}
                  onChange={e => setStructure({...structure, title: e.target.value})}
                />
              </div>

              <div className="space-y-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">章节逻辑</h4>
                {structure.chapters.map((ch, i) => (
                  <div key={i} className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex gap-6 items-start shadow-sm">
                    <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center font-black text-indigo-600 flex-shrink-0">{i+1}</div>
                    <div className="flex-1 space-y-2">
                       <input className="bg-transparent font-bold text-slate-900 text-lg outline-none w-full" value={ch.title} onChange={e => updateChapter(i, 'title', e.target.value)} />
                       <textarea className="w-full bg-white border border-slate-100 p-4 rounded-xl text-slate-500 text-sm resize-none outline-none focus:border-indigo-300" value={ch.description} onChange={e => updateChapter(i, 'description', e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Editor / Completed State */}
        {status === GenerationStatus.COMPLETED && content && (
          <div className="max-w-[1400px] mx-auto py-12 px-8 animate-in fade-in duration-1000">
            <div className="bg-white border border-slate-200 p-8 rounded-[32px] shadow-xl mb-8 no-print flex flex-col md:flex-row justify-between items-center gap-8">
               <div className="flex items-center gap-6 flex-1 min-w-0">
                  <div className="group relative w-24 h-32 bg-slate-100 rounded-xl overflow-hidden shadow-lg border-2 border-white cursor-pointer flex-shrink-0">
                    {coverUrl ? <img src={coverUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-slate-50"><ImageIcon className="w-6 h-6 text-slate-200" /></div>}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                       <button onClick={() => coverInputRef.current?.click()} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg text-white"><Upload className="w-4 h-4" /></button>
                       <button onClick={() => {}} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg text-white"><RefreshCcw className="w-4 h-4" /></button>
                       <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={handleCoverUpload} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <input 
                      className="w-full bg-transparent text-xl font-black text-slate-900 mb-2 border-b border-transparent focus:border-indigo-300 outline-none transition" 
                      value={structure?.title}
                      onChange={e => structure && setStructure({...structure, title: e.target.value})}
                      onBlur={saveToLibrary}
                      placeholder="图书标题"
                    />
                    <div className="flex items-center gap-3">
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">完成</span>
                      <button onClick={saveToLibrary} className="flex items-center gap-1.5 text-indigo-600 text-xs font-black hover:bg-indigo-50 px-3 py-1 rounded-full transition"><Save className="w-3 h-3"/> 保存</button>
                    </div>
                  </div>
               </div>

               <div className="flex items-center gap-4">
                  <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200 shadow-inner">
                    <button onClick={() => { setIsEditing(false); saveToLibrary(); }} className={`flex items-center gap-2 px-6 py-2 rounded-xl font-black text-sm transition ${!isEditing ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>预览</button>
                    <button onClick={() => setIsEditing(true)} className={`flex items-center gap-2 px-6 py-2 rounded-xl font-black text-sm transition ${isEditing ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>编辑</button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleExportMarkdown} title="下载 Markdown" className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 border border-slate-200 shadow-sm transition active:scale-95"><FileCode className="w-5 h-5" /></button>
                    <button onClick={handleExportWord} title="下载 Word (.doc)" className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 border border-blue-200 shadow-sm transition active:scale-95"><FileType className="w-5 h-5" /></button>
                    <button onClick={() => { window.print(); }} title="打印为 PDF" className="p-3 bg-red-600 text-white rounded-xl hover:bg-red-500 shadow-lg shadow-red-600/10 transition active:scale-95"><Printer className="w-5 h-5" /></button>
                  </div>
               </div>
            </div>

            {isEditing ? (
              <div className="bg-white p-12 rounded-[48px] shadow-2xl border border-slate-200 min-h-[700px]">
                <textarea 
                  className="w-full h-full min-h-[600px] bg-transparent text-slate-800 font-mono text-lg leading-relaxed outline-none resize-none"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  onBlur={saveToLibrary}
                  placeholder="编辑原稿..."
                />
              </div>
            ) : (
              <div className="bg-white p-12 lg:p-24 rounded-[48px] shadow-2xl manuscript-container text-slate-900 border border-slate-100 min-h-[700px]">
                 <div ref={manuscriptRef} className="prose prose-slate prose-lg max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        code({ node, inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline && match ? (
                            <SyntaxHighlighter style={vscDarkPlus as any} language={match[1]} PreTag="div" className="rounded-2xl my-8 border border-slate-100" {...props}>
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className="bg-slate-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold" {...props}>{children}</code>
                          );
                        }
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                 </div>
              </div>
            )}
          </div>
        )}

        {(status === GenerationStatus.GENERATING_STRUCTURE || 
          status === GenerationStatus.GENERATING_CONTENT || 
          status === GenerationStatus.GENERATING_COVER) && (
          <div className="h-[80vh] flex flex-col items-center justify-center text-center px-8">
             <div className="relative w-32 h-32 mb-10">
                <div className="absolute inset-0 bg-indigo-600/5 rounded-full animate-ping"></div>
                <div className="absolute inset-2 bg-white border border-indigo-100 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-600/10">
                   <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                </div>
             </div>
             <div className="space-y-3">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                    {status === GenerationStatus.GENERATING_STRUCTURE ? '正在构建知识体系...' : 
                     status === GenerationStatus.GENERATING_COVER ? '正在打磨视觉形象...' : '正在进行深度创作...'}
                </h2>
                <p className="text-slate-400 font-black text-sm uppercase tracking-widest">基于 Gemini 2.5 高性能引擎</p>
             </div>
          </div>
        )}
      </main>

      {/* Billing Modal */}
      {showBilling && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-[40px] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">获取更多创作点数</h2>
              <button onClick={() => setShowBilling(false)} className="p-3 hover:bg-slate-100 rounded-full transition"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <div className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {CREDIT_PACKS.map(pack => (
                <div key={pack.id} className={`p-6 bg-white rounded-3xl border-2 transition-all hover:scale-[1.03] flex flex-col ${pack.popular ? 'border-indigo-600 shadow-xl' : 'border-slate-100 shadow-sm'}`}>
                  <h3 className="text-xs font-black text-slate-400 uppercase mb-2">{pack.name}</h3>
                  <div className="text-2xl font-black text-slate-900 mb-2">{pack.credits.toLocaleString()} <span className="text-xs text-indigo-600">点</span></div>
                  <p className="text-[10px] text-slate-400 mb-8 leading-tight h-8">{pack.description}</p>
                  <div className="mt-auto">
                    <div className="text-xl font-black text-slate-900 mb-6">{pack.price}</div>
                    <button onClick={() => handleTopUp(pack)} disabled={isTopUpPending !== null} className={`w-full py-3 rounded-xl font-black text-xs transition ${pack.popular ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-900'}`}>
                      {isTopUpPending === pack.id ? '支付中...' : '购买'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="h-14 flex items-center justify-center px-8 border-t border-slate-200 bg-white text-slate-400 font-bold text-[9px] uppercase tracking-widest no-print">
        &copy; 2025 TechBook AI 创作工坊 - 基于 Google Gemini 系列模型
      </footer>
    </div>
  );
};

export default App;
