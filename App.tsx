
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
  History,
  TrendingUp,
  Coins,
  Code2,
  Plus,
  Users,
  Code,
  Sparkles as SparklesIcon,
  Download,
  Edit3,
  Eye,
  CheckCircle2,
  Image as ImageIcon
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

const LANGUAGES = ['C', 'C++', 'Python', 'Verilog', 'VHDL', 'Rust'];

const WRITING_STYLES = [
  { id: 'Technical Manual', name: '技术手册', desc: '严谨专业的技术文档风格' },
  { id: 'Tutorial', name: '教学教程', desc: '循序渐进的教学风格' },
  { id: 'Practical Guide', name: '实战指南', desc: '注重实践的动手风格' },
  { id: 'Reference Manual', name: '参考手册', desc: '快速查阅的工具书风格' }
];

const AUDIENCES: { id: TargetAudience; name: string; icon: any }[] = [
  { id: 'Novice', name: '入门新手', icon: Users },
  { id: 'Intermediate', name: '中级工程师', icon: Code },
  { id: 'Expert', name: '高级专家', icon: SparklesIcon }
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

  const manuscriptRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const estStructureCost = 500;
  const estContentCostPerPage = 400; 
  const estTotalContentCost = project.chapterCount * 8 * estContentCostPerPage; 

  const startStructureGeneration = async () => {
    if (userBalance < estStructureCost) {
      setShowBilling(true);
      return;
    }

    try {
      setError(null);
      setStatus(GenerationStatus.GENERATING_STRUCTURE);
      const ebookStructure = await generateEbookStructure(project);
      setUserBalance(prev => Math.max(0, prev - estStructureCost));
      setStructure(ebookStructure);
      setStatus(GenerationStatus.REVIEW_STRUCTURE);
    } catch (err: any) {
      setError(err.message || '规划大纲时出错');
      setStatus(GenerationStatus.ERROR);
    }
  };

  const startContentGeneration = async () => {
    if (!structure) return;
    if (userBalance < 1000) {
      setShowBilling(true);
      return;
    }

    try {
      setError(null);
      setStatus(GenerationStatus.GENERATING_CONTENT);
      const fullContent = await generateEbookContent(project, structure);
      const actualLength = fullContent.length;
      setUserBalance(prev => Math.max(0, prev - actualLength));
      setContent(fullContent);
      setStatus(GenerationStatus.GENERATING_COVER);
      
      try {
        const cover = await generateBookCover(structure.coverPrompt);
        setCoverUrl(cover);
      } catch (e) {
        console.warn("封面生成失败");
      }

      setStatus(GenerationStatus.COMPLETED);
    } catch (err: any) {
      setError(err.message || '全书生成过程中出错');
      setStatus(GenerationStatus.ERROR);
    }
  };

  const handleTopUp = (pack: CreditPack) => {
    setIsTopUpPending(pack.id);
    setTimeout(() => {
      setUserBalance(prev => prev + pack.credits);
      setIsTopUpPending(null);
      setShowBilling(false);
    }, 1500);
  };

  const handleAddLink = () => {
    if (newLink && newLink.trim() !== '') {
      setProject(p => ({ ...p, referenceLinks: [...p.referenceLinks, newLink] }));
      setNewLink('');
    }
  };

  const removeLink = (index: number) => {
    setProject(p => ({ ...p, referenceLinks: p.referenceLinks.filter((_, i) => i !== index) }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setProject(p => ({ 
          ...p, 
          materials: p.materials + `\n\n--- 资料名: ${file.name} ---\n${text}` 
        }));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportPdf = () => { window.print(); };
  const handleExportDoc = () => {
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${structure?.title}</title><style>body{font-family:'Segoe UI';padding:2in;}h1{text-align:center;margin-bottom:2in;}h2{page-break-before:always;border-bottom:1px solid #eee;padding-bottom:10pt;}pre{background:#f4f4f4;padding:12pt;font-family:monospace;}</style></head><body>`;
    const footer = "</body></html>";
    const blob = new Blob([header + content.split('\n').map(l => `<p>${l}</p>`).join('') + footer], { type: 'application/vnd.ms-word' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${structure?.title || 'ebook'}.doc`;
    a.click();
  };

  const handleExportMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${structure?.title || 'ebook'}.md`;
    a.click();
  };

  const reset = () => { setStatus(GenerationStatus.IDLE); setStructure(null); setContent(''); setCoverUrl(''); setError(null); setIsEditing(false); };
  
  const updateChapter = (index: number, field: 'title' | 'description', value: string) => {
    if (!structure) return;
    const newChapters = [...structure.chapters];
    newChapters[index] = { ...newChapters[index], [field]: value };
    setStructure({ ...structure, chapters: newChapters });
  };

  const addChapter = () => {
    if (!structure) return;
    setStructure({ ...structure, chapters: [...structure.chapters, { title: '新章节', description: '描述该章节的核心内容...' }] });
  };

  const removeChapter = (index: number) => {
    if (!structure) return;
    setStructure({ ...structure, chapters: structure.chapters.filter((_, i) => i !== index) });
  };

  const moveChapter = (index: number, direction: 'up' | 'down') => {
    if (!structure) return;
    const newChapters = [...structure.chapters];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newChapters.length) return;
    [newChapters[index], newChapters[targetIndex]] = [newChapters[targetIndex], newChapters[index]];
    setStructure({ ...structure, chapters: newChapters });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* 顶部导航 */}
      <nav className="h-20 flex items-center justify-between px-8 bg-white border-b border-slate-200 no-print sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/10">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <div>
             <h1 className="text-xl font-black text-slate-900 tracking-tight">TechBook AI 创作工坊</h1>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">智能文档生成系统</p>
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

      <main className="flex-1 overflow-y-auto scroll-smooth">
        {/* 充值弹窗 */}
        {showBilling && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white border border-slate-200 rounded-[48px] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
              <div className="p-12 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">充值点数</h2>
                  <p className="text-slate-500 font-medium text-lg">支持 12+ 种技术语言的深度生成，按量付费。</p>
                </div>
                <button onClick={() => setShowBilling(false)} className="p-4 hover:bg-slate-100 rounded-full transition">
                  <X className="w-8 h-8 text-slate-400" />
                </button>
              </div>
              <div className="p-12 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {CREDIT_PACKS.map(pack => (
                    <div 
                      key={pack.id}
                      className={`relative p-8 bg-white rounded-[40px] border-2 transition-all hover:scale-[1.03] flex flex-col ${
                        pack.popular ? 'border-indigo-600 bg-white shadow-2xl shadow-indigo-600/10' : 'border-slate-100 shadow-sm'
                      }`}
                    >
                      {pack.popular && (
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-black px-5 py-2 rounded-full uppercase tracking-widest shadow-xl">
                          最受欢迎
                        </div>
                      )}
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">{pack.name}</h3>
                      <div className="text-3xl font-black text-slate-900 mb-5">{pack.credits.toLocaleString()} <span className="text-sm text-indigo-600">点</span></div>
                      <p className="text-[12px] font-semibold text-slate-500 mb-10 leading-relaxed h-12">{pack.description}</p>
                      
                      <div className="mt-auto">
                        <div className="text-4xl font-black text-slate-900 mb-8">{pack.price}</div>
                        <button 
                          onClick={() => handleTopUp(pack)}
                          disabled={isTopUpPending !== null}
                          className={`w-full py-5 rounded-[24px] font-black text-sm flex items-center justify-center gap-2 transition active:scale-95 ${
                            pack.popular ? 'bg-indigo-600 text-white shadow-xl hover:bg-indigo-500' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                          }`}
                        >
                          {isTopUpPending === pack.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                          {isTopUpPending === pack.id ? '支付中...' : '立即购买'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 初始表单页面 */}
        {status === GenerationStatus.IDLE && (
          <div className="max-w-4xl mx-auto py-16 px-8 space-y-12 no-print">
            {/* 1. 书籍描述 */}
            <section className="bg-white border border-slate-200 p-10 rounded-[48px] shadow-xl space-y-6">
              <div className="flex items-center gap-4">
                <FileText className="w-6 h-6 text-indigo-500" />
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">书籍描述与目标</h3>
              </div>
              <textarea 
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-8 text-slate-900 font-bold text-lg placeholder:text-slate-300 placeholder:font-medium focus:border-indigo-600 transition outline-none min-h-[220px] shadow-inner"
                placeholder="描述你想要生成的电子书主题、内容范围和目标。例如：基于 STM32F4 开发板的嵌入式入门教程，面向大学生和初学者，涵盖 GPIO、定时器、串口通信等基础外设的使用..."
                value={project.description}
                onChange={e => setProject({...project, description: e.target.value})}
              />
            </section>

            {/* 2. 目标读者 */}
            <section className="bg-white border border-slate-200 p-10 rounded-[48px] shadow-xl space-y-6">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">目标读者</h3>
              <div className="grid grid-cols-3 gap-6">
                {AUDIENCES.map(aud => (
                  <button
                    key={aud.id}
                    onClick={() => setProject({...project, targetAudience: aud.id})}
                    className={`flex flex-col items-center justify-center p-10 rounded-[40px] border-2 transition-all active:scale-[0.98] ${
                      project.targetAudience === aud.id 
                        ? 'bg-indigo-50 border-indigo-600 shadow-lg' 
                        : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <aud.icon className={`w-12 h-12 mb-4 ${project.targetAudience === aud.id ? 'text-indigo-600' : 'text-slate-300'}`} />
                    <span className={`text-base font-black ${project.targetAudience === aud.id ? 'text-indigo-900' : 'text-slate-400'}`}>{aud.name}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* 3. 写作风格 */}
            <section className="bg-white border border-slate-200 p-10 rounded-[48px] shadow-xl space-y-6">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">写作风格</h3>
              <div className="grid grid-cols-2 gap-6">
                {WRITING_STYLES.map(style => (
                  <button
                    key={style.id}
                    onClick={() => setProject({...project, writingStyle: style.id})}
                    className={`text-left p-8 rounded-[40px] border-2 transition-all active:scale-[0.99] ${
                      project.writingStyle === style.id 
                        ? 'bg-indigo-50 border-indigo-600 shadow-lg' 
                        : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <p className={`text-lg font-black mb-2 ${project.writingStyle === style.id ? 'text-indigo-900' : 'text-slate-600'}`}>{style.name}</p>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">{style.desc}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* 4. 代码语言 */}
            <section className="bg-white border border-slate-200 p-10 rounded-[48px] shadow-xl space-y-6">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">示例代码语言</h3>
              <div className="flex flex-wrap gap-4">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang}
                    onClick={() => setProject({...project, language: lang})}
                    className={`px-8 py-4 rounded-2xl text-sm font-black transition active:scale-95 ${
                      project.language === lang 
                        ? 'bg-indigo-600 text-white shadow-xl' 
                        : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </section>

            {/* 5. 章节数量 */}
            <section className="bg-white border border-slate-200 p-10 rounded-[48px] shadow-xl space-y-6">
               <div className="flex items-center justify-between">
                 <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">期望章节数量</h3>
                 <span className="text-[11px] font-black bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full uppercase tracking-widest">预计消耗: ~{estTotalContentCost.toLocaleString()} 点</span>
               </div>
               <div className="flex items-center gap-8">
                  <input 
                    type="number"
                    min="3" max="20"
                    value={project.chapterCount}
                    onChange={e => setProject({...project, chapterCount: parseInt(e.target.value) || 3})}
                    className="w-32 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-slate-900 font-black text-xl outline-none focus:border-indigo-600 text-center shadow-inner"
                  />
                  <span className="text-slate-400 text-sm font-bold">章（建议 6-12 章，单章约 2000 字）</span>
               </div>
            </section>

            {/* 6. 参考资料 */}
            <section className="bg-white border border-slate-200 p-10 rounded-[48px] shadow-xl space-y-6">
              <div className="flex items-center gap-4">
                <LinkIcon className="w-6 h-6 text-indigo-500" />
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">参考资料链接</h3>
              </div>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <input 
                    className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-3xl px-8 py-5 text-slate-900 font-bold placeholder:text-slate-300 outline-none focus:border-indigo-600 transition shadow-inner"
                    placeholder="请输入参考网址 https://..."
                    value={newLink}
                    onChange={e => setNewLink(e.target.value)}
                  />
                  <button onClick={handleAddLink} className="px-8 bg-slate-900 text-white rounded-3xl font-black hover:bg-slate-800 transition flex items-center gap-2 active:scale-95">
                    <Plus className="w-6 h-6" /> 添加
                  </button>
                </div>
                {project.referenceLinks.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {project.referenceLinks.map((link, idx) => (
                      <div key={idx} className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-600">
                        <Globe className="w-4 h-4 text-indigo-500" />
                        <span className="max-w-[200px] truncate">{link}</span>
                        <button onClick={() => removeLink(idx)} className="text-slate-400 hover:text-red-500 transition"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* 7. 文件上传 */}
            <section className="bg-white border border-slate-200 p-10 rounded-[48px] shadow-xl space-y-6">
              <div className="flex items-center gap-4">
                <UploadCloud className="w-6 h-6 text-indigo-500" />
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">上传参考文档</h3>
              </div>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="group relative h-48 border-4 border-slate-100 border-dashed rounded-[40px] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-indigo-600/30 hover:bg-indigo-50 transition-all duration-300 shadow-inner bg-slate-50"
              >
                <div className="p-5 bg-white rounded-3xl shadow-md group-hover:scale-110 transition-transform duration-300">
                  <ImageIcon className="w-10 h-10 text-slate-300 group-hover:text-indigo-500" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-slate-400 group-hover:text-slate-600 transition">拖放文件或点击上传</p>
                  <p className="text-sm text-slate-300 font-medium">支持 PDF、Word、Markdown 等格式</p>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
              </div>
              {project.materials.length > 0 && (
                <div className="px-6 py-4 bg-green-50 border border-green-100 rounded-3xl flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  <span className="text-base font-black text-green-700 tracking-wide">已成功加载参考资料，辅助 AI 创作</span>
                </div>
              )}
            </section>

            <button
              onClick={startStructureGeneration}
              disabled={!project.description}
              className="w-full py-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-[40px] text-2xl font-black shadow-2xl shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-4"
            >
              <Sparkles className="w-8 h-8" />
              立即规划大纲 (需 {estStructureCost} 点)
            </button>
          </div>
        )}

        {/* 大纲审核页面 */}
        {status === GenerationStatus.REVIEW_STRUCTURE && structure && (
          <div className="max-w-4xl mx-auto py-16 px-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="bg-white border border-slate-200 rounded-[48px] p-12 shadow-2xl space-y-12">
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

              <div className="space-y-10">
                <div className="space-y-4">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">书籍标题</label>
                  <input 
                    className="w-full bg-slate-50 border-2 border-slate-100 p-8 rounded-[32px] text-3xl font-black text-slate-900 focus:border-indigo-600 outline-none transition shadow-inner" 
                    value={structure.title}
                    onChange={e => setStructure({...structure, title: e.target.value})}
                  />
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center px-4">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">章节排版</h4>
                    <button onClick={addChapter} className="text-indigo-600 font-black text-sm flex items-center gap-2 hover:text-indigo-500 active:scale-95"><PlusCircle className="w-5 h-5" /> 增加新章节</button>
                  </div>
                  {structure.chapters.map((ch, i) => (
                    <div key={i} className="bg-slate-50 p-8 rounded-[40px] border-2 border-slate-100 flex gap-8 items-start group hover:border-indigo-600/30 transition-all duration-300 shadow-sm">
                      <div className="w-14 h-14 bg-white rounded-2xl border border-slate-200 flex items-center justify-center font-black text-2xl text-indigo-600 flex-shrink-0 shadow-md">{i+1}</div>
                      <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-center">
                          <input className="bg-transparent font-black text-slate-900 text-2xl outline-none w-full" value={ch.title} onChange={e => updateChapter(i, 'title', e.target.value)} />
                          <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition duration-300">
                            <button onClick={() => moveChapter(i, 'up')} className="p-2 bg-white rounded-xl text-slate-400 hover:text-indigo-600 shadow-sm"><ChevronUp className="w-5 h-5" /></button>
                            <button onClick={() => moveChapter(i, 'down')} className="p-2 bg-white rounded-xl text-slate-400 hover:text-indigo-600 shadow-sm"><ChevronDown className="w-5 h-5" /></button>
                            <button onClick={() => removeChapter(i)} className="p-2 bg-red-50 rounded-xl text-red-500 hover:bg-red-100 shadow-sm"><Trash2 className="w-5 h-5" /></button>
                          </div>
                        </div>
                        <textarea className="w-full bg-white border border-slate-200 p-6 rounded-2xl text-slate-600 font-bold text-base resize-none min-h-[120px] outline-none focus:border-indigo-600/50 shadow-inner" value={ch.description} onChange={e => updateChapter(i, 'description', e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 完成状态 - 编辑与预览 */}
        {status === GenerationStatus.COMPLETED && content && (
          <div className="max-w-[1400px] mx-auto py-12 px-8 animate-in fade-in duration-1000">
            {/* 工具栏 */}
            <div className="bg-white border border-slate-200 p-8 rounded-[32px] shadow-xl mb-8 no-print flex flex-col md:flex-row justify-between items-center gap-8">
               <div className="flex items-center gap-6">
                  <div className="w-24 h-32 bg-slate-100 rounded-xl overflow-hidden shadow-xl border-4 border-white">
                    {coverUrl ? <img src={coverUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-100 animate-pulse flex items-center justify-center"><ImageIcon className="w-6 h-6 text-slate-300" /></div>}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">{structure?.title}</h2>
                    <div className="flex items-center gap-3">
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">智能生成已完成</span>
                      <span className="text-slate-400 text-xs font-bold">实际消耗: {content.length.toLocaleString()} 点</span>
                    </div>
                  </div>
               </div>

               <div className="flex items-center gap-4">
                  <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                    <button 
                      onClick={() => setIsEditing(false)} 
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition ${!isEditing ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Eye className="w-4 h-4" /> 预览文档
                    </button>
                    <button 
                      onClick={() => setIsEditing(true)} 
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition ${isEditing ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Edit3 className="w-4 h-4" /> 自由编辑
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleExportMarkdown} title="导出 Markdown" className="p-4 bg-white text-slate-600 border border-slate-200 rounded-2xl hover:bg-slate-50 transition shadow-sm active:scale-95"><Download className="w-5 h-5" /></button>
                    <button onClick={handleExportDoc} title="导出 Word" className="p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 transition shadow-lg shadow-blue-600/10 active:scale-95"><FileType className="w-5 h-5" /></button>
                    <button onClick={handleExportPdf} title="打印/导出 PDF" className="p-4 bg-red-600 text-white rounded-2xl hover:bg-red-500 transition shadow-lg shadow-red-600/10 active:scale-95"><Printer className="w-5 h-5" /></button>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 gap-12">
               {isEditing ? (
                 <div className="bg-white p-12 rounded-[48px] shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-300 min-h-[800px]">
                    <textarea 
                      className="w-full h-full min-h-[700px] bg-transparent text-slate-800 font-mono text-lg leading-relaxed outline-none resize-none placeholder:text-slate-300"
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder="在这里自由修改生成的 Markdown 内容..."
                    />
                 </div>
               ) : (
                 <div className="bg-white p-16 lg:p-32 rounded-[60px] shadow-2xl manuscript-container text-slate-900 border border-slate-100 min-h-[800px] animate-in slide-in-from-bottom-4 duration-500">
                    <div ref={manuscriptRef} className="prose prose-slate prose-xl max-w-none manual-prose">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            code({ node, inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  style={vscDarkPlus as any}
                                  language={match[1]}
                                  PreTag="div"
                                  className="rounded-[32px] my-12 shadow-2xl border-8 border-slate-50"
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              ) : (
                                <code className={`${className} bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg font-black text-[0.85em] border border-indigo-100`} {...props}>
                                  {children}
                                </code>
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
          </div>
        )}

        {/* 状态加载动画 */}
        {(status === GenerationStatus.GENERATING_STRUCTURE || status === GenerationStatus.GENERATING_CONTENT || status === GenerationStatus.GENERATING_COVER) && (
          <div className="h-[75vh] flex flex-col items-center justify-center text-center animate-pulse px-8">
             <div className="relative w-48 h-48 mb-16">
                <div className="absolute inset-0 bg-indigo-600/5 rounded-full animate-ping"></div>
                <div className="absolute inset-4 bg-white border border-indigo-100 rounded-full flex items-center justify-center shadow-3xl shadow-indigo-600/10">
                   <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
                </div>
             </div>
             <div className="space-y-4">
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter">
                    {status === GenerationStatus.GENERATING_STRUCTURE ? '正在编排内容逻辑...' : 
                     status === GenerationStatus.GENERATING_COVER ? '正在设计精美封面...' : '正在进行深度创作...'}
                </h2>
                <p className="text-slate-400 font-black text-xl uppercase tracking-[0.4em]">Gemini 引擎全速运行中</p>
             </div>
          </div>
        )}
      </main>

      {/* 底部版权 */}
      <footer className="h-16 flex items-center justify-center px-8 border-t border-slate-200 bg-white text-slate-400 font-bold text-[10px] uppercase tracking-widest no-print">
        &copy; 2025 TechBook AI 创作工坊 - 基于 Gemini 2.5 系列模型
      </footer>
    </div>
  );
};

export default App;
